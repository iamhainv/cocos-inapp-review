package com.cocos.inappreview;

import android.app.Activity;
import android.content.Context;
import android.util.Log;

import com.cocos.lib.GlobalObject;
import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;
import com.google.android.gms.tasks.OnFailureListener;
import com.google.android.gms.tasks.OnSuccessListener;
import com.google.android.gms.tasks.Task;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Business logic for the In-App Review extension.
 *
 * <p>All public methods are called from {@link ReviewBridge} on the Cocos
 * game thread.  Heavy Play Core work is dispatched to the UI thread via
 * {@link Activity#runOnUiThread(Runnable)}.  Responses route back through
 * {@link ReviewBridge#respondOk} / {@link ReviewBridge#respondErr}, which
 * re-enter the game thread via {@code CocosHelper.runOnGameThread}.</p>
 *
 * <h3>Unified single-call design</h3>
 * <p>The Godot reference plugin (InappReviewPlugin.java) exposed a two-step
 * API: {@code requestReviewFlow()} followed by a separate
 * {@code launchReviewFlow(reviewInfo)} call.  This implementation collapses
 * both into a single {@code requestReview} command: the JS caller fires once
 * and receives either {@code {"launched":true}} or an error response.  The
 * intermediate {@code ReviewInfo} token never surfaces to JS.</p>
 */
public class ReviewServiceHub {

    private static final String TAG = "ReviewServiceHub";

    /** Application context — set once in {@link #init(Context)}. */
    private static Context sAppContext;

    /**
     * Concurrent-request guard.  {@code true} while a
     * {@code requestReviewFlow} / {@code launchReviewFlow} cycle is in
     * flight.  Checked and set atomically on the UI thread.
     */
    private static volatile boolean sPending = false;

    /**
     * Initialise the hub.  Called once from {@link ReviewBridge#register(Context)}.
     *
     * @param context Application context.
     */
    public static void init(Context context) {
        sAppContext = context.getApplicationContext();
        Log.d(TAG, "init()");
    }

    // -------------------------------------------------------------------------
    // Public handlers (called from ReviewBridge on the game thread)
    // -------------------------------------------------------------------------

    /**
     * Trigger the Google Play In-App Review flow.
     *
     * <p>Acquires a {@link ReviewInfo} token via
     * {@link ReviewManager#requestReviewFlow()} and immediately launches the
     * review dialog via {@link ReviewManager#launchReviewFlow(Activity, ReviewInfo)}.
     * On success responds {@code {"launched":true}}.  Any failure or missing
     * Play Core library responds with {@code E_REVIEW_FAILED}.</p>
     *
     * <p>Concurrent calls while a review is already in progress respond
     * immediately with {@code E_REVIEW_FAILED "review request already in progress"}.</p>
     *
     * @param id JS request identifier; forwarded to the response envelope.
     */
    public static void requestReview(final int id) {
        try {
            final Activity activity = GlobalObject.getActivity();
            if (activity == null) {
                ReviewBridge.respondErr(id, "E_REVIEW_FAILED",
                        "Activity is null — cannot launch review flow");
                return;
            }

            if (sPending) {
                ReviewBridge.respondErr(id, "E_REVIEW_FAILED",
                        "review request already in progress");
                return;
            }
            sPending = true;

            activity.runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    launchOnUiThread(id, activity);
                }
            });

        } catch (NoClassDefFoundError e) {
            // Play Review library absent — non-Play device or misconfigured build.
            sPending = false;
            Log.e(TAG, "Play Review library not found", e);
            ReviewBridge.respondErr(id, "E_REVIEW_FAILED",
                    "Play Review library missing: " + e.getMessage());
        } catch (Exception e) {
            sPending = false;
            Log.e(TAG, "requestReview unexpected error", e);
            ReviewBridge.respondErr(id, "E_REVIEW_FAILED",
                    "requestReview failed: " + e.getMessage());
        }
    }

    /**
     * Return the Google Play store URL for this application.
     *
     * <p>Responds {@code {"url":"https://play.google.com/store/apps/details?id=<pkg>"}}.
     * Any failure responds with {@code E_URL_FAILED}.</p>
     *
     * @param id JS request identifier; forwarded to the response envelope.
     */
    public static void getAppReviewUrl(final int id) {
        try {
            String pkg = sAppContext.getPackageName();
            String url = "https://play.google.com/store/apps/details?id=" + pkg;

            JSONObject data = new JSONObject();
            data.put("url", url);
            ReviewBridge.respondOk(id, data);
        } catch (Exception e) {
            Log.e(TAG, "getAppReviewUrl failed", e);
            ReviewBridge.respondErr(id, "E_URL_FAILED",
                    "getAppReviewUrl failed: " + e.getMessage());
        }
    }

    // -------------------------------------------------------------------------
    // Private — UI-thread review logic
    // -------------------------------------------------------------------------

    /**
     * Must run on the UI thread.  Creates a {@link ReviewManager}, requests a
     * {@link ReviewInfo} token, and on success immediately launches the review
     * flow.  {@link #sPending} is cleared (to {@code false}) in every terminal
     * branch (success or failure) before a response is sent.
     */
    private static void launchOnUiThread(final int id, final Activity activity) {
        try {
            final ReviewManager manager = ReviewManagerFactory.create(activity);

            Task<ReviewInfo> requestTask = manager.requestReviewFlow();

            requestTask.addOnSuccessListener(new OnSuccessListener<ReviewInfo>() {
                @Override
                public void onSuccess(final ReviewInfo reviewInfo) {
                    Task<Void> launchTask = manager.launchReviewFlow(activity, reviewInfo);

                    launchTask.addOnSuccessListener(new OnSuccessListener<Void>() {
                        @Override
                        public void onSuccess(Void unused) {
                            sPending = false;
                            try {
                                JSONObject data = new JSONObject();
                                data.put("launched", true);
                                ReviewBridge.respondOk(id, data);
                            } catch (JSONException e) {
                                Log.e(TAG, "JSON build failed after launchReviewFlow", e);
                            }
                        }
                    });

                    launchTask.addOnFailureListener(new OnFailureListener() {
                        @Override
                        public void onFailure(Exception e) {
                            sPending = false;
                            Log.e(TAG, "launchReviewFlow failed", e);
                            ReviewBridge.respondErr(id, "E_REVIEW_FAILED",
                                    "launchReviewFlow failed: " + e.getMessage());
                        }
                    });
                }
            });

            requestTask.addOnFailureListener(new OnFailureListener() {
                @Override
                public void onFailure(Exception e) {
                    sPending = false;
                    Log.e(TAG, "requestReviewFlow failed", e);
                    ReviewBridge.respondErr(id, "E_REVIEW_FAILED",
                            "requestReviewFlow failed: " + e.getMessage());
                }
            });

        } catch (NoClassDefFoundError e) {
            sPending = false;
            Log.e(TAG, "Play Review library not found on UI thread", e);
            ReviewBridge.respondErr(id, "E_REVIEW_FAILED",
                    "Play Review library missing: " + e.getMessage());
        } catch (Exception e) {
            sPending = false;
            Log.e(TAG, "launchOnUiThread unexpected error", e);
            ReviewBridge.respondErr(id, "E_REVIEW_FAILED",
                    "requestReview failed: " + e.getMessage());
        }
    }
}
