# Changelog

All notable changes to this extension will be documented in this file.

## 1.0.0 — Initial release

- Initial open-source release of Cocos InAppReview.
- Native "rate this app" prompt on Android (Google Play In-App Review API) and iOS (`SKStoreReviewController` / `AppStore.requestReview`).
- `inAppReview.requestReview()`, `inAppReview.getAppReviewUrl()` — Promise-based API with typed error codes.
- Graceful degradation on web/editor preview (`E_NOT_SUPPORTED` rejection instead of a crash).
- Documentation covers Google/Apple's server-side quota throttling and how to test reliably (Play internal test track, iOS TestFlight vs. development builds).
- Demo scene and runtime-built test UI at `assets/scene/main.scene` / `assets/script/test/InAppReviewTest.ts`.
