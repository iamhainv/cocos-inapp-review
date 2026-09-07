/**
 * ReviewServiceHub.mm — InAppReview extension iOS bridge singleton implementation
 *
 * Bootstrap pattern mirrors ShareServiceHub.mm exactly:
 *   - Singleton via dispatch_once.
 *   - initReviewService called from AppDelegate.mm.
 *   - JsbBridgeWrapper "inappreview" channel listener registered once.
 *   - No pending-guard needed for requestReview (fire-and-forget; OS decides
 *     whether to show dialog) or getAppReviewUrl (id-correlated network calls
 *     can safely overlap without a global guard).
 *
 * Wire protocol (must match assets/scripts/extensions/InAppReview/Bridge.ts):
 *   JS → native : {"id":int,"method":"requestReview"|"getAppReviewUrl","args":{}}
 *   native → JS : {"kind":"response","id":N,"success":true,"data":{"launched":true}}
 *                 {"kind":"response","id":N,"success":true,"data":{"url":"https://apps.apple.com/app/id<trackId>?action=write-review"}}
 *                 {"kind":"response","id":N,"success":false,"error":{"code":"...","message":"..."}}
 *
 * Threading: UIKit/StoreKit calls must happen on the main thread. NSURLSession
 * completion handlers arrive on a background queue — results are marshalled back
 * to the main queue before calling dispatchEventToScript:arg:, matching the
 * pattern established by ShareServiceHub and IapServiceHub.
 */

#import "ReviewServiceHub.h"

#import <StoreKit/StoreKit.h>
#import <UIKit/UIKit.h>

// Cocos JSB bridge — same header path used by ShareServiceHub.mm.
#import "platform/apple/JsbBridgeWrapper.h"

// ---------------------------------------------------------------------------
// Channel name (must match Bridge.ts: channel "inappreview")
// ---------------------------------------------------------------------------

static NSString *const kReviewChannel = @"inappreview";

// ---------------------------------------------------------------------------
// Wire-protocol helpers: build JSON response strings.
// Mirrors the static helper pattern from ShareServiceHub.mm.
// ---------------------------------------------------------------------------

/// Build a success-response JSON string for the given call id.
static NSString *ReviewResponseSuccess(NSInteger callId, NSDictionary *data) {
    NSError *jsonErr = nil;
    NSData *bodyData = [NSJSONSerialization dataWithJSONObject:@{
        @"kind"    : @"response",
        @"id"      : @(callId),
        @"success" : @YES,
        @"data"    : data,
    } options:0 error:&jsonErr];
    if (jsonErr || !bodyData) {
        // Fallback: omit data rather than crash.
        bodyData = [NSJSONSerialization dataWithJSONObject:@{
            @"kind"    : @"response",
            @"id"      : @(callId),
            @"success" : @YES,
            @"data"    : [NSNull null],
        } options:0 error:nil];
    }
    return [[NSString alloc] initWithData:bodyData encoding:NSUTF8StringEncoding];
}

/// Build an error-response JSON string for the given call id.
static NSString *ReviewResponseError(NSInteger callId, NSString *code, NSString *message) {
    NSData *bodyData = [NSJSONSerialization dataWithJSONObject:@{
        @"kind"    : @"response",
        @"id"      : @(callId),
        @"success" : @NO,
        @"error"   : @{
            @"code"    : code,
            @"message" : message,
        },
    } options:0 error:nil];
    return [[NSString alloc] initWithData:bodyData encoding:NSUTF8StringEncoding];
}

// ---------------------------------------------------------------------------
// ReviewServiceHub private interface
// ---------------------------------------------------------------------------

@interface ReviewServiceHub ()

/** Guard against double-initialisation. */
@property (nonatomic, assign) BOOL initialised;

@end

// ---------------------------------------------------------------------------
// ReviewServiceHub implementation
// ---------------------------------------------------------------------------

@implementation ReviewServiceHub

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

+ (instancetype)sharedInstance {
    static ReviewServiceHub *sInstance = nil;
    static dispatch_once_t sOnce;
    dispatch_once(&sOnce, ^{
        sInstance = [[super allocWithZone:NULL] init];
    });
    return sInstance;
}

+ (id)allocWithZone:(struct _NSZone *)zone { return [ReviewServiceHub sharedInstance]; }
+ (id)copyWithZone:(struct _NSZone *)zone  { return [ReviewServiceHub sharedInstance]; }

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------

/**
 * Register the "inappreview" script event listener.
 *
 * The static block reference mirrors the ShareServiceHub pattern:
 * JsbBridgeWrapper calls [listener release] on the block, so we keep
 * a strong static reference to avoid a use-after-free.
 */
- (void)initReviewService {
    if (self.initialised) { return; }
    self.initialised = YES;

    __weak __typeof__(self) wself = self;
    static OnScriptEventListener sReviewListener = nil;
    sReviewListener = ^(NSString *payload) {
        ReviewServiceHub *hub = wself;
        if (!hub) { return; }
        [hub handleIncomingMessage:payload];
    };
    [[JsbBridgeWrapper sharedInstance] addScriptEventListener:kReviewChannel listener:sReviewListener];

    NSLog(@"[ReviewServiceHub] initReviewService — channel %@ registered", kReviewChannel);
}

// ---------------------------------------------------------------------------
// Incoming message handler (called from JsbBridgeWrapper listener)
// ---------------------------------------------------------------------------

/**
 * Parse the incoming JSON envelope and dispatch to the appropriate handler.
 * Malformed JSON, missing id, or unknown method → send an error response
 * (never crash).
 */
- (void)handleIncomingMessage:(NSString *)payload {
    NSData *data = [payload dataUsingEncoding:NSUTF8StringEncoding];
    if (!data) {
        NSLog(@"[ReviewServiceHub] empty or non-UTF8 payload, ignoring");
        return;
    }

    NSError *parseErr = nil;
    id parsed = [NSJSONSerialization JSONObjectWithData:data options:0 error:&parseErr];
    if (parseErr || ![parsed isKindOfClass:[NSDictionary class]]) {
        NSLog(@"[ReviewServiceHub] malformed JSON envelope: %@", payload);
        // id unknown — cannot send a correlated error response; send developer error
        // to channel so the TS side can surface it in dev builds.
        NSString *json = ReviewResponseError(0, @"E_DEVELOPER_ERROR",
                                             [NSString stringWithFormat:@"Malformed JSON envelope: %@", payload]);
        [self sendJson:json];
        return;
    }

    NSDictionary *envelope = (NSDictionary *)parsed;
    id rawId      = envelope[@"id"];
    NSString *method = envelope[@"method"];
    id rawArgs    = envelope[@"args"];

    // Validate required fields before using them.
    if (![rawId isKindOfClass:[NSNumber class]]) {
        NSLog(@"[ReviewServiceHub] envelope missing numeric id: %@", payload);
        NSString *json = ReviewResponseError(0, @"E_DEVELOPER_ERROR",
                                             @"Envelope missing numeric 'id' field");
        [self sendJson:json];
        return;
    }
    if (![method isKindOfClass:[NSString class]]) {
        NSLog(@"[ReviewServiceHub] envelope missing string method: %@", payload);
        NSString *json = ReviewResponseError([rawId integerValue], @"E_DEVELOPER_ERROR",
                                             @"Envelope missing string 'method' field");
        [self sendJson:json];
        return;
    }

    NSInteger callId = [rawId integerValue];
    // args is optional per spec; default to empty dict if absent or wrong type.
    NSDictionary *args = [rawArgs isKindOfClass:[NSDictionary class]] ? rawArgs : @{};
    (void)args; // Both current methods take no args; kept for forward compatibility.

    if ([method isEqualToString:@"requestReview"]) {
        [self executeRequestReview:callId];
    } else if ([method isEqualToString:@"getAppReviewUrl"]) {
        [self executeGetAppReviewUrl:callId];
    } else {
        NSString *json = ReviewResponseError(callId,
                                             @"E_NOT_SUPPORTED",
                                             [NSString stringWithFormat:@"Unknown method: %@", method]);
        [self sendJson:json];
    }
}

// ---------------------------------------------------------------------------
// requestReview handler
// ---------------------------------------------------------------------------

/**
 * Request an App Store review dialog via SKStoreReviewController.
 *
 * Ported from godot-inapp-review InappReview.swift with ObjC adaptations:
 *   - Swift DispatchQueue.main.async → dispatch_async(dispatch_get_main_queue(), …)
 *   - Swift UIApplication.shared.connectedScenes → UIApplication sharedApplication
 *     approach; keyWindow.windowScene used for the iOS 14+ scene API path.
 *   - Swift @available(iOS 14, *) → __builtin_available(iOS 14, *) in ObjC.
 *
 * IMPORTANT: SKStoreReviewController gives NO completion callback. The response
 * {"launched":true} is sent immediately after the dispatch fires because the OS
 * decides independently whether to present the dialog (rate-limit, prior reviews,
 * TestFlight vs. production, etc.). "launched" means the request was submitted to
 * the OS, NOT that the dialog was shown. Document this in Bridge.ts accordingly.
 *
 * Deprecation note: [SKStoreReviewController requestReviewInScene:] was deprecated
 * in iOS 18 in favour of the Swift-only AppStore.requestReview. The ObjC path
 * continues to function correctly on iOS 18; the deprecation warning is suppressed
 * with a pragma (same approach as ShareServiceHub.mm for keyWindow).
 */
- (void)executeRequestReview:(NSInteger)callId {
    __weak __typeof__(self) wself = self;
    dispatch_async(dispatch_get_main_queue(), ^{
        ReviewServiceHub *hub = wself;
        if (!hub) { return; }

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"

        if (__builtin_available(iOS 14, *)) {
            // iOS 14+ path: use the scene-based API.
            // Cocos Creator 3.x does not adopt UISceneDelegate, so we obtain the
            // windowScene from keyWindow. If keyWindow or its windowScene is nil
            // (which should not happen in a running Cocos app but we guard anyway),
            // we fall through to the no-scene API below rather than crashing.
            UIWindow *keyWindow = [UIApplication sharedApplication].keyWindow;
            UIWindowScene *windowScene = (UIWindowScene *)keyWindow.windowScene;
            if (windowScene) {
                [SKStoreReviewController requestReviewInScene:windowScene];
            } else {
                // windowScene unexpectedly nil — use the pre-14 API as fallback.
                [SKStoreReviewController requestReview];
            }
        } else {
            // iOS 10.3–13 path: no scene API available.
            [SKStoreReviewController requestReview];
        }

#pragma clang diagnostic pop

        // Respond immediately — the OS gives no callback (see method doc above).
        NSString *json = ReviewResponseSuccess(callId, @{@"launched": @YES});
        [hub sendJson:json];
    });
}

// ---------------------------------------------------------------------------
// getAppReviewUrl handler
// ---------------------------------------------------------------------------

/**
 * Look up the app's trackId via the iTunes lookup API and build the
 * App Store write-review deep-link URL.
 *
 * Endpoint: https://itunes.apple.com/lookup?bundleId=<percent-encoded bundleId>
 * Expected response shape: {"results":[{"trackId":<number>,...},...]}
 *
 * Any failure (network error, HTTP non-200, JSON parse failure, missing
 * results array, missing trackId in results[0]) produces E_URL_FAILED.
 * No force-unwraps; all optionals checked defensively.
 *
 * id-correlated: multiple concurrent calls with different ids are fine; no
 * global guard is needed because each call is self-contained.
 */
- (void)executeGetAppReviewUrl:(NSInteger)callId {
    // Percent-encode the bundle ID for safe URL embedding.
    NSString *bundleId = [[NSBundle mainBundle] bundleIdentifier];
    if (!bundleId || bundleId.length == 0) {
        NSString *json = ReviewResponseError(callId,
                                             @"E_URL_FAILED",
                                             @"Could not read bundle identifier");
        [self sendJson:json];
        return;
    }

    NSString *encodedBundleId =
        [bundleId stringByAddingPercentEncodingWithAllowedCharacters:
            [NSCharacterSet URLQueryAllowedCharacterSet]];
    if (!encodedBundleId) {
        NSString *json = ReviewResponseError(callId,
                                             @"E_URL_FAILED",
                                             @"Failed to percent-encode bundle identifier");
        [self sendJson:json];
        return;
    }

    NSString *lookupURLString =
        [NSString stringWithFormat:@"https://itunes.apple.com/lookup?bundleId=%@", encodedBundleId];
    NSURL *lookupURL = [NSURL URLWithString:lookupURLString];
    if (!lookupURL) {
        NSString *json = ReviewResponseError(callId,
                                             @"E_URL_FAILED",
                                             @"Failed to construct iTunes lookup URL");
        [self sendJson:json];
        return;
    }

    __weak __typeof__(self) wself = self;
    NSURLSessionDataTask *task =
        [[NSURLSession sharedSession] dataTaskWithURL:lookupURL
                                    completionHandler:^(NSData *responseData,
                                                        NSURLResponse *response,
                                                        NSError *error) {
        ReviewServiceHub *hub = wself;
        if (!hub) { return; }

        if (error) {
            NSString *msg = error.localizedDescription ?: @"Network request failed";
            NSString *json = ReviewResponseError(callId, @"E_URL_FAILED", msg);
            [hub sendJson:json];
            return;
        }

        // Verify HTTP 200.
        NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
        if (![httpResponse isKindOfClass:[NSHTTPURLResponse class]] ||
            httpResponse.statusCode != 200) {
            NSString *json = ReviewResponseError(callId,
                                                 @"E_URL_FAILED",
                                                 [NSString stringWithFormat:
                                                  @"iTunes lookup returned status %ld",
                                                  (long)(httpResponse.statusCode)]);
            [hub sendJson:json];
            return;
        }

        if (!responseData || responseData.length == 0) {
            NSString *json = ReviewResponseError(callId,
                                                 @"E_URL_FAILED",
                                                 @"Empty response from iTunes lookup");
            [hub sendJson:json];
            return;
        }

        // Parse JSON.
        NSError *parseErr = nil;
        id parsed = [NSJSONSerialization JSONObjectWithData:responseData
                                                    options:0
                                                      error:&parseErr];
        if (parseErr || ![parsed isKindOfClass:[NSDictionary class]]) {
            NSString *json = ReviewResponseError(callId,
                                                 @"E_URL_FAILED",
                                                 @"Failed to parse iTunes lookup response");
            [hub sendJson:json];
            return;
        }

        NSDictionary *body = (NSDictionary *)parsed;
        id results = body[@"results"];
        if (![results isKindOfClass:[NSArray class]] || [(NSArray *)results count] == 0) {
            NSString *json = ReviewResponseError(callId,
                                                 @"E_URL_FAILED",
                                                 @"iTunes lookup returned no results for this bundle ID");
            [hub sendJson:json];
            return;
        }

        id firstResult = [(NSArray *)results firstObject];
        if (![firstResult isKindOfClass:[NSDictionary class]]) {
            NSString *json = ReviewResponseError(callId,
                                                 @"E_URL_FAILED",
                                                 @"Unexpected shape in iTunes lookup results[0]");
            [hub sendJson:json];
            return;
        }

        id trackIdValue = ((NSDictionary *)firstResult)[@"trackId"];
        if (![trackIdValue isKindOfClass:[NSNumber class]]) {
            NSString *json = ReviewResponseError(callId,
                                                 @"E_URL_FAILED",
                                                 @"trackId not found or not a number in iTunes lookup result");
            [hub sendJson:json];
            return;
        }

        long long trackId = [(NSNumber *)trackIdValue longLongValue];
        NSString *reviewURL =
            [NSString stringWithFormat:@"https://apps.apple.com/app/id%lld?action=write-review", trackId];

        NSString *json = ReviewResponseSuccess(callId, @{@"url": reviewURL});
        [hub sendJson:json];
    }];

    [task resume];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Marshal a JSON string to JS via JsbBridgeWrapper on the main queue.
 * Completion handlers and NSURLSession callbacks arrive on arbitrary queues,
 * so we always hop to the main queue before calling dispatchEventToScript:arg:,
 * matching the threading model of ShareServiceHub and IapServiceHub.
 */
- (void)sendJson:(NSString *)json {
    if (!json) { return; }
    dispatch_async(dispatch_get_main_queue(), ^{
        [[JsbBridgeWrapper sharedInstance] dispatchEventToScript:kReviewChannel arg:json];
    });
}

@end
