"use strict";
/*
 InAppReview — In-App Review extension for Cocos Creator 3.8.8
 Google Play In-App Review API (Android) / SKStoreReviewController (iOS)

 MIT License
*/
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTaskiOS = exports.BuildTaskiOS = void 0;
const builder_1 = require("./builder");
const fse = __importStar(require("fs-extra"));
const TAG = '[BuildTaskiOS]';
/**
 * @en
 * Handles all iOS post-build tasks for the InAppReview extension.
 *
 * Responsibilities:
 *  - Copy Pre-inappreview.cmake / Post-inappreview.cmake into native/engine/ios so
 *    Cocos' CMake include chain picks them up.
 *  - Copy the inappreview bridge directory into the built Xcode project's
 *    proj/inappreview folder so the CMake integration can reference it.
 *  - Honour the `enableInAppReview` flag: when false, remove the cmake files from
 *    native/engine/ios instead of copying them.
 */
class BuildTaskiOS {
    /**
     * @en
     * Copy Pre-inappreview.cmake and Post-inappreview.cmake into native/engine/ios,
     * and copy the inappreview bridge directory into the built Xcode project.
     *
     * @param option       Typed build-task options from the build panel.
     * @param buildResult  Build result carrying the destination path.
     */
    copyInAppReviewResources(option, buildResult) {
        console.log(TAG, 'copyInAppReviewResources', 'start');
        const reviewOption = option.packages[builder_1.PACKAGE_NAME];
        const overwrite = reviewOption.overwriteLibrary;
        // --- CMake integration files → native/engine/ios ---
        const preCmakeSrc = `${BuildTaskiOS.InAppReviewTemplatePath}/Pre-inappreview.cmake`;
        const postCmakeSrc = `${BuildTaskiOS.InAppReviewTemplatePath}/Post-inappreview.cmake`;
        const preCmakeDest = `${BuildTaskiOS.NativePath}/Pre-inappreview.cmake`;
        const postCmakeDest = `${BuildTaskiOS.NativePath}/Post-inappreview.cmake`;
        fse.copySync(preCmakeSrc, preCmakeDest, { overwrite });
        fse.copySync(postCmakeSrc, postCmakeDest, { overwrite });
        // --- inappreview bridge directory → <buildDest>/proj/inappreview ---
        const reviewSrc = `${BuildTaskiOS.InAppReviewTemplatePath}/inappreview`;
        const reviewDest = `${buildResult.dest}/proj/inappreview`;
        fse.copySync(reviewSrc, reviewDest, { recursive: true, overwrite });
        console.log(TAG, 'copyInAppReviewResources', 'end');
    }
    /**
     * @en
     * Remove the CMake integration files from native/engine/ios.
     *
     * Called when enableInAppReview is false so that a previously-enabled build does
     * not leave stale cmake includes in the shared native directory.
     */
    removeInAppReviewCmakeFiles() {
        console.log(TAG, 'removeInAppReviewCmakeFiles', 'start');
        const preCmakeDest = `${BuildTaskiOS.NativePath}/Pre-inappreview.cmake`;
        const postCmakeDest = `${BuildTaskiOS.NativePath}/Post-inappreview.cmake`;
        fse.removeSync(preCmakeDest);
        fse.removeSync(postCmakeDest);
        console.log(TAG, 'removeInAppReviewCmakeFiles', 'end');
    }
    /**
     * @en
     * Entry point called by the build hook for iOS post-build tasks.
     *
     * @param options      Typed build-task options from the build panel.
     * @param buildResult  Build result carrying the destination path.
     */
    executePostBuildTasks(options, buildResult) {
        console.log(TAG, 'executePostBuildTasks', 'start');
        const reviewOption = options.packages[builder_1.PACKAGE_NAME];
        const enableInAppReview = reviewOption.enableInAppReview;
        if (enableInAppReview) {
            this.copyInAppReviewResources(options, buildResult);
        }
        else {
            console.log(TAG, 'executePostBuildTasks', 'enableInAppReview is false — removing cmake files');
            this.removeInAppReviewCmakeFiles();
        }
        console.log(TAG, 'executePostBuildTasks', 'all tasks done.');
    }
}
exports.BuildTaskiOS = BuildTaskiOS;
/** Absolute path to the extension's iOS template directory. */
BuildTaskiOS.InAppReviewTemplatePath = `${__dirname}/../template/ios`;
/** Absolute path to the engine's native iOS directory (shared across builds). */
BuildTaskiOS.NativePath = `${Editor.Project.path}/native/engine/ios`;
/**
 * @en
 * The global instance of the iOS build task.
 * Exported as `buildTaskiOS.ios` to match the shape hooks.ts expects.
 */
exports.buildTaskiOS = {
    ios: new BuildTaskiOS(),
};
