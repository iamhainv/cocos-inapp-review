/**
 * ReviewServiceHub.h — InAppReview extension iOS bridge singleton interface
 *
 * Registers a "inappreview" JsbBridgeWrapper channel that forwards
 * SKStoreReviewController calls from the JS layer to the native OS dialog.
 *
 * Wire protocol (must match assets/scripts/extensions/InAppReview/Bridge.ts):
 *   JS → native : {"id":int,"method":"requestReview"|"getAppReviewUrl","args":{}}
 *   native → JS : {"kind":"response","id":N,"success":true,"data":{...}}
 *                 {"kind":"response","id":N,"success":false,"error":{"code":"...","message":"..."}}
 *
 * Deviations from godot-inapp-review InappReview.swift:
 *   - keyWindow usage (deprecated iOS 13+): Cocos Creator 3.x does not adopt
 *     UISceneDelegate so there is only one UIWindow; keyWindow is safe and
 *     consistent with ShareServiceHub. The deprecation warning is suppressed
 *     with a pragma (same approach as ShareServiceHub.mm).
 *   - requestReview completion: SKStoreReviewController gives no callback;
 *     the response {"launched":true} is sent immediately after the dispatch_async
 *     fires, before the OS decides whether to display the dialog. This is
 *     documented with a comment in the implementation and matches the Swift original.
 *   - iOS 18 deprecation: AppStore.requestReview is Swift-only; the ObjC
 *     SKStoreReviewController path continues to work on iOS 18 (generates a
 *     deprecation warning at compile time, suppressed with pragma).
 */

#pragma once

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

/**
 * ReviewServiceHub — iOS bridge singleton for the InAppReview extension.
 *
 * Call [[ReviewServiceHub sharedInstance] initReviewService] once from
 * AppDelegate didFinishLaunchingWithOptions to register the JsbBridgeWrapper
 * channel. All subsequent JS calls are handled automatically.
 */
@interface ReviewServiceHub : NSObject

/** Returns the process-singleton. Never nil after class load. */
+ (instancetype)sharedInstance;

/**
 * Register the "inappreview" script event listener.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
- (void)initReviewService;

@end

NS_ASSUME_NONNULL_END
