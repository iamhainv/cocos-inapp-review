# Cocos InAppReview — Android Requirements (English)

## Permissions / Capabilities

No manifest permissions are required. The library declares a single
zero-permission `<provider>`:

```xml
<provider
    android:name="com.cocos.inappreview.ReviewInitProvider"
    android:authorities="${applicationId}.reviewinit"
    android:exported="false"/>
```

`ReviewInitProvider` auto-registers the JS↔native bridge before
`Application.onCreate()` runs — the same zero-permission `ContentProvider`
init pattern used by Firebase, WorkManager, and this repo's sibling `Share`
extension. You do not need to modify `AppActivity.java` or add any code.

The underlying **Google Play In-App Review API** requires:

- **Google Play Services** to be present on the device (it is not available
  on devices without the Play Store, e.g. some China ROMs, or emulators
  without the Google APIs image).
- The app to be installed **through a Google Play distribution channel**
  (internal test track or higher) for the dialog to reliably appear — see
  the quota section in [doc/en/index.md](../index.md).

## Build Configuration

- Gradle dependency (added automatically to the generated
  `libinappreview` module — you do not add this yourself):

  ```gradle
  implementation 'com.google.android.play:review:2.0.2'
  ```

- **minSdkVersion**: the `com.google.android.play:review` library requires
  `minSdkVersion >= 19`. Cocos Creator's Android build panel typically
  targets a higher minimum already; if you have manually lowered
  `PROP_MIN_SDK_VERSION` below 19, raise it back.
- No `compileSdkVersion` / `targetSdkVersion` floor beyond what Cocos
  Creator's own Android build panel already requires.
- The extension injects two things into the generated Android project when
  **Enable In-App Review** is checked:
  1. `implementation project(':libinappreview')` appended to
     `native/engine/android/app/build.gradle`.
  2. `include ':libinappreview'` appended to the built project's
     `settings.gradle`.

  Both insertions are idempotent (checked for the exact snippet before
  appending) and are cleanly removed if you uncheck the option and rebuild.
- The `libinappreview` Android library module itself is copied into
  `<build output>/proj/libinappreview/`. Use **Force overwrite the In-App
  Review library** to control whether this copy step overwrites an
  already-present, possibly hand-edited copy.

## Known Limitations

- The Play In-App Review API is Google Play–specific; it has no equivalent
  on Play-less Android distributions (e.g. some third-party Android app
  stores). On such devices `requestReview()` will fail with
  `E_REVIEW_FAILED` rather than silently succeeding — handle that case by
  falling back to `getAppReviewUrl()` or hiding the "rate us" affordance
  entirely for those channels if you support them.
- A concurrent-request guard means calling `requestReview()` again while
  one is already in flight resolves the second call with `E_REVIEW_FAILED
  "review request already in progress"` — this is intentional, not a bug.
