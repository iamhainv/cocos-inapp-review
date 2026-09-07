/**
 * InAppReview extension — public barrel export.
 *
 * Import via the extension alias:
 *   import { inAppReview, ReviewResult, ReviewUrlResult } from 'db://inappreview/index';
 */

export { inAppReview, InAppReviewClient } from './InAppReviewClient';
export type { ReviewResult, ReviewUrlResult, ReviewError } from './Types';
