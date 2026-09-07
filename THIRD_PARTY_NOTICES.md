# Third-Party Notices

Cocos InAppReview may bundle or depend on third-party software. Their licenses are
reproduced below (or referenced) as required by their respective terms.

This extension does not vendor or commit any third-party binaries. It links
one Gradle-resolved Android library (fetched from Google's Maven repository
at build time, not committed to this repository) and two stock Apple system
frameworks on iOS (no third-party code at all).

| Component | Version | License | Notes |
| --- | --- | --- | --- |
| Google Play In-App Review (`com.google.android.play:review`) | 2.0.2 | [Play Core Software Development Kit Terms of Service](https://developer.android.com/guide/playcore/license) — **not** an OSS license | Declared as a Gradle dependency in `extensions/InAppReview/template/android/libinappreview/build.gradle`; resolved from Google's Maven repository at build time. Verified against the published POM (`https://maven.google.com/com/google/android/play/review/2.0.2/review-2.0.2.pom`), which declares the license as `Play Core Software Development Kit Terms of Service` — Google's own terms for the Play Core SDK family, distinct from any Apache/MIT/BSD license. Redistribution/modification rights are governed entirely by those terms; Google retains all IP. Transitively pulls in `com.google.android.gms:play-services-basement`, `com.google.android.gms:play-services-tasks`, and `com.google.android.play:core-common`, all under the same terms. Not vendored in this repository — resolved from Google's Maven repository at build time only. |
| Apple `StoreKit.framework` | iOS SDK (system) | Apple SDK license (part of Xcode/iOS SDK) | Linked in `extensions/InAppReview/template/ios/inappreview/inappreview.cmake` for `SKStoreReviewController`. Ships with Xcode; not distributed by this repository. |
| Apple `Foundation.framework` | iOS SDK (system) | Apple SDK license (part of Xcode/iOS SDK) | Linked alongside `StoreKit.framework`. Ships with Xcode; not distributed by this repository. |

The Android and iOS native bridges under `extensions/InAppReview/template/`
are this project's own source code (`ReviewServiceHub.h`/`.mm` on iOS, the
`libinappreview` sources on Android); no third-party native code is bundled.
Consumers of this extension should review the
[Play Core SDK Terms of Service](https://developer.android.com/guide/playcore/license)
themselves before shipping an app that depends on it.
