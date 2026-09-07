"use strict";
/*
 InAppReview — In-App Review extension for Cocos Creator 3.8.8
 Google Play In-App Review API (Android) / SKStoreReviewController (iOS)

 MIT License
*/
Object.defineProperty(exports, "__esModule", { value: true });
exports.AndroidConstants = void 0;
/**
 * @en
 * Compile-time path constants for the Android build task.
 * All paths are derived from `Editor.Project.path` or `__dirname` at runtime —
 * no hardcoded absolute paths.
 */
class AndroidConstants {
}
exports.AndroidConstants = AndroidConstants;
/**
 * @en The native android engine path inside the Cocos project. */
AndroidConstants.NativePath = `${Editor.Project.path}/native/engine/android`;
/**
 * @en The project-level build.gradle that receives the InAppReview dependency snippet. */
AndroidConstants.AppBuildGradle = `${AndroidConstants.NativePath}/app/build.gradle`;
/**
 * @en The template directory of this extension on disk. */
AndroidConstants.InAppReviewTemplatePath = `${__dirname}/../template/android`;
/**
 * @en
 * The build.gradle snippet template that is appended to (or removed from)
 * the built project's build.gradle. */
AndroidConstants.InAppReviewTemplateGradlePath = `${AndroidConstants.InAppReviewTemplatePath}/build.gradle`;
/**
 * @en The name of the Android native library module. */
AndroidConstants.InAppReviewLibName = 'libinappreview';
/**
 * @en Source path of the libinappreview module inside this extension's template. */
AndroidConstants.InAppReviewLibSrcPath = `${AndroidConstants.InAppReviewTemplatePath}/${AndroidConstants.InAppReviewLibName}`;
/**
 * @en
 * Relative destination path (appended to `buildResult.dest`) where the
 * libinappreview module is copied inside the built project. */
AndroidConstants.InAppReviewLibDestPath = `/proj/${AndroidConstants.InAppReviewLibName}`;
/**
 * @en The filename of the settings.gradle used by the Android project. */
AndroidConstants.SettingGradle = 'settings.gradle';
/**
 * @en
 * The settings.gradle snippet template (adds `include ':libinappreview'`) stored
 * inside this extension's template directory. */
AndroidConstants.InAppReviewTemplateSettingGradle = `${AndroidConstants.InAppReviewTemplatePath}/${AndroidConstants.SettingGradle}`;
