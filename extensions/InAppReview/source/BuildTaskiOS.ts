/*
 InAppReview — In-App Review extension for Cocos Creator 3.8.8
 Google Play In-App Review API (Android) / SKStoreReviewController (iOS)

 MIT License
*/

import { IBuildResult } from '../@types';
import { PACKAGE_NAME } from './builder';
import { ReviewOption } from './ReviewOptions';
import * as fse from 'fs-extra';
import { ITaskOptions } from './hooks';

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
export class BuildTaskiOS {

    /** Absolute path to the extension's iOS template directory. */
    static readonly InAppReviewTemplatePath = `${__dirname}/../template/ios`;

    /** Absolute path to the engine's native iOS directory (shared across builds). */
    static readonly NativePath = `${Editor.Project.path}/native/engine/ios`;

    /**
     * @en
     * Copy Pre-inappreview.cmake and Post-inappreview.cmake into native/engine/ios,
     * and copy the inappreview bridge directory into the built Xcode project.
     *
     * @param option       Typed build-task options from the build panel.
     * @param buildResult  Build result carrying the destination path.
     */
    copyInAppReviewResources(option: ITaskOptions, buildResult: IBuildResult): void {
        console.log(TAG, 'copyInAppReviewResources', 'start');

        const reviewOption = option.packages[PACKAGE_NAME] as ReviewOption;
        const overwrite = reviewOption.overwriteLibrary;

        // --- CMake integration files → native/engine/ios ---
        const preCmakeSrc  = `${BuildTaskiOS.InAppReviewTemplatePath}/Pre-inappreview.cmake`;
        const postCmakeSrc = `${BuildTaskiOS.InAppReviewTemplatePath}/Post-inappreview.cmake`;
        const preCmakeDest  = `${BuildTaskiOS.NativePath}/Pre-inappreview.cmake`;
        const postCmakeDest = `${BuildTaskiOS.NativePath}/Post-inappreview.cmake`;

        fse.copySync(preCmakeSrc,  preCmakeDest,  { overwrite });
        fse.copySync(postCmakeSrc, postCmakeDest, { overwrite });

        // --- inappreview bridge directory → <buildDest>/proj/inappreview ---
        const reviewSrc  = `${BuildTaskiOS.InAppReviewTemplatePath}/inappreview`;
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
    removeInAppReviewCmakeFiles(): void {
        console.log(TAG, 'removeInAppReviewCmakeFiles', 'start');

        const preCmakeDest  = `${BuildTaskiOS.NativePath}/Pre-inappreview.cmake`;
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
    executePostBuildTasks(options: ITaskOptions, buildResult: IBuildResult): void {
        console.log(TAG, 'executePostBuildTasks', 'start');

        const reviewOption = options.packages[PACKAGE_NAME] as ReviewOption;
        const enableInAppReview = reviewOption.enableInAppReview;

        if (enableInAppReview) {
            this.copyInAppReviewResources(options, buildResult);
        } else {
            console.log(TAG, 'executePostBuildTasks', 'enableInAppReview is false — removing cmake files');
            this.removeInAppReviewCmakeFiles();
        }

        console.log(TAG, 'executePostBuildTasks', 'all tasks done.');
    }
}

/**
 * @en
 * The global instance of the iOS build task.
 * Exported as `buildTaskiOS.ios` to match the shape hooks.ts expects.
 */
export const buildTaskiOS = {
    ios: new BuildTaskiOS(),
};
