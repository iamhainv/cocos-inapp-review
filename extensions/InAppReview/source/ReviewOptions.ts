/*
 InAppReview — In-App Review extension for Cocos Creator 3.8.8
 Google Play In-App Review API (Android) / SKStoreReviewController (iOS)

 MIT License
*/

/**
 * @en
 * ReviewOption holds the build-panel configurations for the InAppReview extension.
 * After the build process completes the custom options are passed via
 * `onAfterBuild` / `onAfterCompressSettings` in `hooks.ts`.
 * Fetch them with `options.packages[PACKAGE_NAME]`.
 */
export interface ReviewOption {
    /**
     * @en
     * Enable or disable the InAppReview extension.
     * When true, native library files are copied and Gradle/CMake snippets are
     * injected into the built project.  When false, all injected content is
     * cleanly removed.
     */
    enableInAppReview?: boolean;

    /**
     * @en
     * Force-overwrite the native library directory in the built project on every
     * build, even when it already exists.  Disable to preserve manual edits.
     */
    overwriteLibrary?: boolean;
}
