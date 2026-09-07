# Cocos InAppReview (English)

A Cocos Creator 3.8.x extension that triggers the native "rate this app"
prompt on Android (Google Play In-App Review API) and iOS
(`SKStoreReviewController`), with a store-page fallback URL. Promise-based
TypeScript API, JSB bridge, no third-party native dependency beyond Google's
own Play Core library.

> **Read this before you integrate**: both Google and Apple silently
> throttle this prompt. A successful call very often shows **nothing** on
> screen — that is expected platform behaviour, not a bug in this extension.
> See [Quota limits and how to actually test this](#quota-limits-and-how-to-actually-test-this)
> below.

## Compatibility

| Cocos Creator | Android | iOS |
| --- | --- | --- |
| >= 3.8.0 | minSdk >= 19 (required by `com.google.android.play:review`) | deployment target >= 13.0 (API itself available from iOS 10.3) |

Web / editor preview: the module is not available; every call rejects with
`{ code: 'E_NOT_SUPPORTED' }` instead of throwing or crashing (see
[Known Limitations](#known-limitations)).

## Installation

1. Copy `extensions/InAppReview` into your project's `extensions/` folder.
2. Restart Cocos Creator, or open **Extension → Extension Manager** and
   enable **InAppReview** from the installed list.
3. Import the client from the extension's asset-db mount in your game code:

   ```ts
   import { inAppReview } from 'db://inappreview/index';

   try {
     const result = await inAppReview.requestReview();
     console.log('launched =', result.launched);
   } catch (err) {
     // err.code, err.message
   }
   ```
4. Add an Android and/or iOS build task in **Project → Build**, confirm the
   **InAppReview** panel options described below, then build.

## Build Panel Options

The InAppReview panel appears under both the **Android** and **iOS** build
task tabs (same two options on each platform). No screenshots are bundled
in this initial release — capture them from **Project → Build** after
enabling the extension and drop them into `doc/img/` (reserved, currently
empty except for `.gitkeep`).

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| **Enable In-App Review** (`enableInAppReview`) | checkbox | `true` | Enables/disables the module for this build. When enabled, the native review-prompt integration files are copied into the built project (Gradle module on Android, CMake target on iOS). When disabled, all previously-injected content is cleanly removed. |
| **Force overwrite the In-App Review library** (`overwriteLibrary`) | checkbox | `true` | Overwrites the native library files already present in the built project output with the extension's template on every build. Uncheck this if you have hand-modified the generated `libinappreview` (Android) / `inappreview` (iOS) folder and want to preserve those edits across rebuilds. |

## API Reference

Full JSDoc lives in
[`assets/InAppReviewClient.ts`](../../assets/InAppReviewClient.ts) and
[`assets/Types.ts`](../../assets/Types.ts); summarized here.

### `inAppReview.requestReview(): Promise<ReviewResult>`

Dispatches the platform review request to the OS.

- **Android** (Play In-App Review API): the returned Promise resolves once
  the review flow *completes* (dialog dismissed or skipped by the OS).
  Rejects with `E_REVIEW_FAILED` if `ReviewInfo` generation or the launch
  call fails.
- **iOS** (`SKStoreReviewController`): the Promise resolves **immediately**
  after the request is dispatched — not after the user interacts with a
  dialog, because the OS gives no completion callback. Never shown in
  TestFlight builds; always shown in development/sandbox builds regardless
  of quota.
- Both platforms: `{ launched: true }` means the OS **accepted** the
  request — it does **not** mean the rating dialog was actually displayed.
- Rejects with `E_NOT_SUPPORTED` on web/editor preview.
- Rejects with `E_TIMEOUT` if no native response arrives within 30 s
  (Android only — the bridge's default call timeout; iOS resolves
  immediately so this practically never fires there).

```ts
import { inAppReview } from 'db://inappreview/index';

try {
  const { launched } = await inAppReview.requestReview();
  console.log('review request accepted by OS:', launched);
} catch (err) {
  console.warn('review request failed:', err.code, err.message);
}
```

### `inAppReview.getAppReviewUrl(): Promise<string>`

Returns the platform's store review URL — useful as a fallback when you
suspect the in-app prompt was throttled (e.g. show a "Rate us" button that
opens the store page directly instead of relying on the OS prompt).

- **Android**: a `https://play.google.com/store/apps/details?id=<package>`
  URL built from the app's own package name — always resolves, no network
  call.
- **iOS**: resolved via the iTunes Search API
  (`https://itunes.apple.com/lookup?bundleId=<bundle id>`) — requires
  network access. Rejects with `E_URL_FAILED` if the lookup fails or the
  bundle ID has not been published to the App Store yet (e.g. a
  not-yet-released app). The resolved URL includes `?action=write-review`
  so it opens the review form directly, not just the app page.

```ts
import { inAppReview } from 'db://inappreview/index';
import { sys } from 'cc';

try {
  await inAppReview.requestReview();
} catch {
  // Fallback: send the user to the store page directly.
  try {
    const url = await inAppReview.getAppReviewUrl();
    sys.openURL(url);
  } catch (err) {
    console.warn('could not resolve store review URL:', err);
  }
}
```

### Error codes (`ReviewError.code`)

| Code | Meaning |
| --- | --- |
| `E_NOT_SUPPORTED` | Called on a non-native platform (web / editor preview). |
| `E_TIMEOUT` | No response from the native layer within 30 s. |
| `E_REVIEW_FAILED` | Android: `ReviewInfo` generation or `launchReviewFlow` failed (e.g. Play Core library missing, no Activity, or a review request was already in progress). |
| `E_URL_FAILED` | `getAppReviewUrl` could not resolve a store URL (iOS iTunes lookup network error, unknown/unpublished bundle ID, or the device could not read its own bundle identifier). |

## Examples

A runnable demo lives at the project root:

- Scene: [`assets/scene/main.scene`](../../../../assets/scene/main.scene)
- Script: [`assets/script/test/InAppReviewTest.ts`](../../../../assets/script/test/InAppReviewTest.ts)

Open this repo as a Cocos Creator 3.8.x project, open `main.scene`, and run
it on an Android or iOS device/simulator build. It shows two buttons
("Request Review" and "Open Store Review Page") and an on-screen log so you
can watch each call resolve or reject — including the very common case
where `requestReview()` resolves with `launched: true` but no dialog ever
appears, because the OS decided to skip it.

## Quota limits and how to actually test this

Neither Google nor Apple lets you show this prompt on demand, and neither
tells you *why* a given call didn't show the dialog. Treat "nothing
happened" as the default outcome, not an error.

- **Android**: Google does not publish an exact quota, but in practice the
  dialog shows roughly **once per app per user within a rolling window**
  (observed to be on the order of weeks), regardless of how many times you
  call `requestReview()`. Testing reliably requires:
  - Publishing the app to an **internal test track** (or higher) on Google
    Play — the review flow does not reliably show for APKs installed
    outside of a Play-distributed track.
  - Using a tester account that has the app installed **from the Play
    Store**, not sideloaded.
  - Not assuming a second call in the same session/device will show
    anything — it almost certainly won't.
- **iOS**: Apple enforces a hard cap of **3 prompts per app per 365-day
  rolling window**, tracked per user, independent of your app's release
  cadence. Testing reliably requires:
  - Using a **TestFlight** build to verify the *call succeeds and resolves*
    — but note `SKStoreReviewController` **never actually shows the
    dialog in TestFlight builds**, by Apple's design.
  - Using a **development/sandbox build** (Xcode → device, not TestFlight)
    to see the dialog itself, since the quota there is much more lenient
    for testing purposes.
  - Verifying real production behaviour only after release, sparingly.

**Do not call `requestReview()` in a loop, on every app launch, or as a
retry-until-shown strategy.** Doing so wastes your quota allowance for
legitimate prompts and can be interpreted as abuse of the API by both
platforms. Call it after a positive user moment (e.g. completing a level,
finishing a purchase) and at most a few times total per release.

## Troubleshooting

- **Android build fails with a Gradle sync / duplicate class error
  mentioning `com.google.android.play`**: another extension or your app's
  own `build.gradle` already declares a different version of
  `com.google.android.play:review`. Align both to the same version, or
  exclude the transitive dependency from one of them.
- **`E_REVIEW_FAILED` with "Play Review library missing" on Android**: the
  device does not have the Play Store / Play Core services available (e.g.
  emulator without Google Play, or a non-Play distribution channel). The
  Play In-App Review API only works on devices with Google Play Services.
- **iOS CMake fails to find `StoreKit`**: confirm the extension's
  **Enable In-App Review** option was checked for the iOS build task, and
  that you re-ran the build after enabling it — the CMake integration files
  are only copied into `native/engine/ios` when the option is on.
- **Nothing happens when I tap "Request Review"**: this is very likely
  quota throttling, not a bug — read
  [Quota limits and how to actually test this](#quota-limits-and-how-to-actually-test-this).
- **`i18n:inappreview.xxx` shows up as raw text in the build panel**: the
  `i18n/en.js` / `i18n/zh.js` files are missing a key used by
  `source/builder.ts`. File an issue with the exact key name.

## Known Limitations

- No web or editor-preview support — the underlying APIs
  (`SKStoreReviewController`, Play In-App Review) are OS-level UI and do
  not exist outside a native mobile runtime. Every call rejects with
  `E_NOT_SUPPORTED` there; build the demo scene to Android/iOS to exercise
  the real flow.
- `requestReview()` gives **no guarantee the dialog was shown** on either
  platform — this is a platform design constraint, not something this
  extension can work around. Do not build UX that assumes the dialog always
  appears.
- On iOS, `getAppReviewUrl()` requires network access and a bundle ID that
  is already known to the App Store; it will fail for apps that have not
  yet been submitted/released.
- This extension does not persist any local "have I asked recently" state
  of its own — pair it with your own light-weight cooldown logic (e.g. "at
  most once per release, after a positive moment") if you want tighter
  control than the OS-level quota alone provides.
