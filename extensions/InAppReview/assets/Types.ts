/**
 * InAppReview extension — public types.
 *
 * Import from the barrel:
 *   import { ReviewResult, ReviewUrlResult, ReviewError } from 'db://inappreview/index';
 */

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/**
 * Successful result returned by {@link InAppReviewClient.requestReview}.
 *
 * `launched: true` means the review request was successfully delivered to the
 * OS — it does NOT mean the rating dialog was shown to the user. Both Google
 * Play (quota: roughly once per user per app per period) and iOS (maximum
 * 3 prompts per year; never in TestFlight) decide independently whether to
 * display the dialog.
 */
export interface ReviewResult {
    /**
     * `true` when the OS accepted the review request. The rating dialog may or
     * may not have appeared, depending on platform quotas and eligibility.
     */
    launched: boolean;
}

/**
 * Successful result returned by {@link InAppReviewClient.getAppReviewUrl}.
 *
 * - Android: a Play Store details URL (`market://` or `https://play.google.com/…`)
 * - iOS: an `https://apps.apple.com/…?action=write-review` URL resolved via
 *   iTunes Search API — requires network access; may reject with E_URL_FAILED
 *   if the lookup fails.
 *
 * Open it with `sys.openURL(url)` to send the user directly to the store
 * review form.
 */
export interface ReviewUrlResult {
    /** The platform-specific store review URL. */
    url: string;
}

/**
 * Error object rejected by any InAppReview call.
 *
 * Built-in codes:
 *   `E_NOT_SUPPORTED`  — called on a non-native platform (web / editor)
 *   `E_TIMEOUT`        — no response within the configured timeout window
 *   `E_REVIEW_FAILED`  — Android: ReviewInfo generation or launch failed;
 *                         iOS: unexpected failure after dispatch
 *   `E_URL_FAILED`     — `getAppReviewUrl` could not resolve a store URL
 *                         (e.g. iTunes lookup network error or unknown bundle)
 *   Any additional platform-specific code returned by the native layer.
 */
export interface ReviewError {
    /** Machine-readable error code. */
    code: string;
    /** Human-readable description of the error. */
    message: string;
}
