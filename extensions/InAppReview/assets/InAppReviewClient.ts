/**
 * InAppReviewClient — Cocos Creator 3.8.8
 *
 * Public API for triggering the native in-app review prompt on iOS and Android,
 * and for retrieving the store review URL as a fallback.
 *
 * Platform behaviour summary
 * ──────────────────────────
 * requestReview():
 *   Both platforms decide independently whether the rating dialog is actually
 *   shown to the user:
 *     • Android (Google Play In-App Review API): quota is enforced by Play —
 *       roughly once per user per app per period. ReviewInfo generation and
 *       launch are async; the Promise resolves once the flow completes (i.e.
 *       after the dialog is dismissed or skipped by the OS).
 *     • iOS (SKStoreReviewController): maximum 3 prompts per year per app.
 *       The dialog is never shown in TestFlight builds; it always appears in
 *       development / sandbox builds. The Promise resolves immediately after
 *       the request is dispatched to the OS — not after user interaction.
 *   Resolving with { launched: true } means the request was successfully
 *   delivered to the OS, NOT that the dialog was displayed.
 *
 * getAppReviewUrl():
 *   Returns the platform store URL for the app's review page. Useful as a
 *   fallback when the in-app prompt cannot be shown (quota exhausted, etc.).
 *   Open it with `sys.openURL(url)`.
 *     • Android: Play Store details URL.
 *     • iOS: resolved via iTunes Search API — requires network; may reject
 *       with E_URL_FAILED if the lookup fails or the bundle ID is unknown.
 *
 * Usage:
 *   import { inAppReview } from 'db://inappreview/index';
 *
 *   // Attempt in-app prompt, fall back to store URL on failure:
 *   try {
 *     await inAppReview.requestReview();
 *   } catch (err) {
 *     const { url } = await inAppReview.getAppReviewUrl();
 *     sys.openURL(url);
 *   }
 */

import { inAppReviewBridge } from './core/Bridge';
import { ReviewError, ReviewResult, ReviewUrlResult } from './Types';

// ---------------------------------------------------------------------------
// InAppReviewClient
// ---------------------------------------------------------------------------

/**
 * Cross-platform in-app review client.
 *
 * Obtain the singleton via the exported `inAppReview` constant. Do not
 * instantiate directly.
 */
export class InAppReviewClient {

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    /**
     * Request the native in-app review prompt.
     *
     * Dispatches the platform review request to the OS. Both Google Play and
     * iOS enforce their own display quotas — resolving with `{ launched: true }`
     * means the OS accepted the request, NOT that the dialog was shown.
     *
     * Platform notes:
     *   - Android: the Promise resolves once the Review flow completes (after
     *     the dialog is dismissed or the OS skips it). ReviewInfo generation
     *     or launch failure rejects with E_REVIEW_FAILED.
     *   - iOS: the Promise resolves immediately after dispatch. The dialog may
     *     appear asynchronously (or not at all, per iOS quota rules). Never
     *     shown in TestFlight; always shown in development / sandbox builds.
     *
     * @returns A promise resolving to a {@link ReviewResult}.
     * @throws {@link ReviewError} with code `E_REVIEW_FAILED` if Android
     *         ReviewInfo generation or launch fails.
     * @throws {@link ReviewError} with code `E_NOT_SUPPORTED` on non-native
     *         platforms (web / editor).
     * @throws {@link ReviewError} with code `E_TIMEOUT` if no response
     *         arrives within 30 s.
     */
    public requestReview(): Promise<ReviewResult> {
        return inAppReviewBridge.call<ReviewResult>('requestReview', {});
    }

    /**
     * Retrieve the platform store URL for the app's review page.
     *
     * The returned URL can be opened directly with `sys.openURL(url)` to send
     * the user to the store review form — useful as a fallback when the in-app
     * prompt cannot be displayed due to platform quotas.
     *
     *   - Android: returns a Play Store details URL
     *     (`market://` deep link or `https://play.google.com/…`).
     *   - iOS: resolved via the iTunes Search API (network call required).
     *     Rejects with E_URL_FAILED if the lookup fails or the app's bundle ID
     *     is not found. The resolved URL includes `?action=write-review` to
     *     open the review form directly.
     *
     * @returns A promise resolving to a {@link ReviewUrlResult} containing the
     *          store review URL string.
     * @throws {@link ReviewError} with code `E_URL_FAILED` if the URL cannot
     *         be resolved (iOS network error, unknown bundle ID, etc.).
     * @throws {@link ReviewError} with code `E_NOT_SUPPORTED` on non-native
     *         platforms (web / editor).
     * @throws {@link ReviewError} with code `E_TIMEOUT` if no response
     *         arrives within 30 s.
     */
    public getAppReviewUrl(): Promise<string> {
        return inAppReviewBridge.call<ReviewUrlResult>('getAppReviewUrl', {})
            .then((result) => result.url);
    }
}

/** Singleton in-app review client instance. Import this in your game code. */
export const inAppReview = new InAppReviewClient();
