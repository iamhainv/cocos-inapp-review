# Cocos InAppReview — iOS Requirements (English)

## Permissions / Capabilities

No `Info.plist` entries, entitlements, or capabilities are required.
`SKStoreReviewController` is a StoreKit UI API — there is nothing to
declare, register, or request user permission for.

The native bridge (`ReviewServiceHub`) is a plain Objective-C singleton
registered once from `AppDelegate` during
`application:didFinishLaunchingWithOptions:` (wired in automatically by the
build hook, same pattern as this repo's sibling `Share` extension) — you do
not need to modify `AppDelegate.mm` or any Info.plist key by hand.

## Build Configuration

- The extension links `StoreKit.framework` and `Foundation.framework`
  (system frameworks, no third-party or `xcframework` dependency, no
  CocoaPods/SPM package to add):

  ```cmake
  target_link_libraries(inappreview "-framework StoreKit")
  target_link_libraries(inappreview "-framework Foundation")
  ```

- **Minimum deployment target**: `SKStoreReviewController` first shipped in
  iOS 10.3; the scene-based `requestReviewInScene:` call path requires
  iOS 14+ and the bridge falls back to the pre-14 `requestReview` call
  automatically on older versions. In practice the effective floor is
  whatever your project's own iOS deployment target already is (this
  extension's template mirrors the `Share` extension's baseline of
  iOS >= 13.0) — there is no separate minimum to configure for InAppReview
  itself.
- The extension builds `ReviewServiceHub.mm`/`.h` into a small static
  library (`inappreview`) and force-loads it into the final executable via
  `-ObjC`, wired in through `Pre-inappreview.cmake` / `Post-inappreview.cmake`
  when **Enable In-App Review** is checked for the iOS build task. Unchecking
  the option removes the injected `proj/inappreview` folder and the
  corresponding `include()` on the next build.
- Use **Force overwrite the In-App Review library** to control whether the
  build step overwrites an already-present, possibly hand-edited copy of
  the generated `proj/inappreview` folder.
- ARC is enabled per-file for the bridge sources; no manual memory
  management or bridging casts are required if you ever need to read the
  native code.

## API behaviour specific to iOS

- `requestReview()` resolves **immediately** after the call is dispatched to
  `SKStoreReviewController` — Apple gives the calling code no completion
  callback, so `{ launched: true }` only confirms the request was submitted,
  never that the dialog appeared.
- `SKStoreReviewController requestReviewInScene:`/`requestReview` is
  **never shown in TestFlight builds** — this is an explicit Apple
  restriction, not something this extension can change or detect. Use
  TestFlight only to confirm the *call succeeds without crashing*, not to
  see the dialog.
- `getAppReviewUrl()` resolves the App Store `trackId` via
  `https://itunes.apple.com/lookup?bundleId=<your bundle id>` and returns
  `https://apps.apple.com/app/id<trackId>?action=write-review`. This
  requires network access and an app that has already been submitted to
  App Store Connect at least once — it will reject with `E_URL_FAILED` for
  an app that has never been published.

## Testing reliably

Apple enforces a hard cap of **at most 3 review prompts per app per user
per rolling 365-day window**, on top of the TestFlight restriction above.
To actually see the dialog during development:

1. Build and run **directly from Xcode to a device (or the Simulator)** —
   not a TestFlight build. Development/ad-hoc builds are exempt from the
   TestFlight suppression.
2. If you don't see the dialog on a fresh install, you have likely already
   exhausted the quota for that Apple ID / device combination recently.
   Apple does not expose a supported way to reset this counter on a real
   device; using a different sandbox Apple ID, or a different
   device/simulator, is the practical workaround while iterating.
3. Treat a resolved Promise with `launched: true` and no visible dialog as
   a **pass**, not a failure — that is the documented behaviour of the API,
   confirmed by Apple's own developer documentation for
   `SKStoreReviewController`.
4. Verify true end-user behaviour only after a production release, and only
   as a spot-check — you cannot force the dialog on demand even then.

## Known Limitations

- No completion signal: this extension (and the underlying OS API) cannot
  tell your game whether the user actually saw or interacted with the
  dialog — only that the request was accepted.
- Never shown in TestFlight, regardless of quota state — plan your QA
  around development builds instead.
- `getAppReviewUrl()` needs network access and a bundle ID already known to
  the App Store; it is not usable for pre-release/unpublished apps as a
  reliable fallback.
- The 3-prompts-per-365-days cap is enforced entirely server-side by Apple;
  this extension has no way to query remaining quota or predict whether the
  next call will actually display anything.
