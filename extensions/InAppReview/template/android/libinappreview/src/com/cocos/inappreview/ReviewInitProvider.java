package com.cocos.inappreview;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.util.Log;

/**
 * Auto-initialising {@link ContentProvider} that registers the
 * {@link ReviewBridge} JsbBridgeWrapper listener before
 * {@code Application.onCreate()} is called.
 *
 * <p>This is the same zero-permission initialisation pattern used by
 * Firebase, WorkManager, and the sibling Share extension — no
 * Application subclass is required from the host app.</p>
 */
public class ReviewInitProvider extends ContentProvider {

    private static final String TAG = "ReviewInitProvider";

    @Override
    public boolean onCreate() {
        Log.d(TAG, "onCreate — registering ReviewBridge");
        ReviewBridge.register(getContext());
        return true;
    }

    // -------------------------------------------------------------------------
    // Stubs — ContentProvider contract (unused)
    // -------------------------------------------------------------------------

    @Override
    public Cursor query(Uri uri, String[] projection, String selection,
                        String[] selectionArgs, String sortOrder) {
        return null;
    }

    @Override
    public String getType(Uri uri) {
        return null;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection,
                      String[] selectionArgs) {
        return 0;
    }
}
