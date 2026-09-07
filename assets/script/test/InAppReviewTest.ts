/**
 * InAppReviewTest — runtime demo for the Cocos InAppReview extension.
 *
 * Builds its whole UI in code (no scene-baked buttons) so the example is
 * fully readable in a single file. Attach this component to any Node in a
 * scene with a UI camera (see assets/scene/main.scene) and it will lay out
 * two buttons plus a scrollable-looking log area:
 *
 *   - Request Review    — inAppReview.requestReview()
 *   - Open Store Review  — inAppReview.getAppReviewUrl() + sys.openURL(url)
 *
 * IMPORTANT — read before you tap "Request Review" in a loop: both Google
 * Play and Apple silently throttle this prompt (see the big warning label in
 * the demo UI and README/doc for details). Resolving with
 * `{ launched: true }` only means the OS accepted the request — it does NOT
 * mean the dialog was actually shown. Seeing nothing happen after tapping is
 * expected behaviour, not a bug.
 *
 * On web preview / editor (non-native), the extension's bridge already
 * rejects every call with { code: 'E_NOT_SUPPORTED' } — this component just
 * catches that and shows a friendly status message instead of crashing.
 */

import { _decorator, Component, Node, Label, Graphics, Color, UITransform, Vec3, sys } from 'cc';
import { inAppReview } from 'db://inappreview/index';
import type { ReviewError } from 'db://inappreview/index';

const { ccclass } = _decorator;

const TAG = '[InAppReviewTest]';

/** Max number of lines kept in the on-screen log before older lines are dropped. */
const MAX_LOG_LINES = 10;

@ccclass('InAppReviewTest')
export class InAppReviewTest extends Component {

    private _logLabel: Label | null = null;
    private _logLines: string[] = [];

    onLoad() {
        this._buildUI();
    }

    // -----------------------------------------------------------------
    // UI construction (no scene-baked prefabs — everything built in code)
    // -----------------------------------------------------------------

    private _buildUI(): void {
        const root = this.node;
        const rootUi = root.getComponent(UITransform) ?? root.addComponent(UITransform);
        rootUi.setContentSize(640, 720);

        this._addLabel(root, 'Cocos InAppReview Demo', 0, 300, 26, true);

        this._addLabel(
            root,
            'Google Play and Apple silently throttle this prompt.\n'
            + 'Seeing nothing happen after tapping is expected — it does\n'
            + 'NOT mean the extension is broken. See doc/ for how to test\n'
            + 'properly (internal test track / TestFlight).',
            0, 230, 14, false,
        );

        this._addButton(root, 'Request Review', 130, () => this._onRequestReview());
        this._addButton(root, 'Open Store Review Page', 60, () => this._onOpenStoreReview());

        this._logLabel = this._addLabel(
            root,
            sys.isNative
                ? 'Tap a button to test in-app review.'
                : 'Web/editor preview — native review prompt is disabled here.\nBuild to Android/iOS to test.',
            0, -80, 16, false,
        );
        const logUi = this._logLabel.node.getComponent(UITransform)!;
        logUi.setContentSize(600, 320);
        this._logLabel.verticalAlign = Label.VerticalAlign.TOP;
        this._logLabel.overflow = Label.Overflow.CLAMP;
    }

    private _addLabel(parent: Node, text: string, x: number, y: number, fontSize: number, bold: boolean): Label {
        const node = new Node('Label');
        parent.addChild(node);
        node.setPosition(new Vec3(x, y, 0));
        const ui = node.addComponent(UITransform);
        ui.setContentSize(600, 80);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 6;
        label.isBold = bold;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.RESIZE_HEIGHT;
        label.color = new Color(255, 255, 255, 255);
        return label;
    }

    private _addButton(parent: Node, text: string, y: number, onClick: () => void): Node {
        const node = new Node(`Button_${text.replace(/\s+/g, '')}`);
        parent.addChild(node);
        node.setPosition(new Vec3(0, y, 0));

        const ui = node.addComponent(UITransform);
        ui.setContentSize(360, 64);

        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(43, 108, 176, 255);
        graphics.roundRect(-180, -32, 360, 64, 12);
        graphics.fill();

        const labelNode = new Node('Label');
        node.addChild(labelNode);
        const labelUi = labelNode.addComponent(UITransform);
        labelUi.setContentSize(360, 64);
        const label = labelNode.addComponent(Label);
        label.string = text;
        label.fontSize = 20;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.color = new Color(255, 255, 255, 255);

        node.on(Node.EventType.TOUCH_END, () => onClick(), this);

        return node;
    }

    // -----------------------------------------------------------------
    // Log helper — appends a line instead of replacing the whole label so
    // the user can see the history of a session (e.g. quota being hit).
    // -----------------------------------------------------------------

    private _log(text: string): void {
        this._logLines.push(text);
        if (this._logLines.length > MAX_LOG_LINES) {
            this._logLines.shift();
        }
        if (this._logLabel) {
            this._logLabel.string = this._logLines.join('\n');
        }
        console.log(TAG, text);
    }

    // -----------------------------------------------------------------
    // Button handlers
    // -----------------------------------------------------------------

    private async _onRequestReview(): Promise<void> {
        this._log('Requesting review prompt...');
        try {
            const result = await inAppReview.requestReview();
            this._log(
                `requestReview() resolved: launched=${result.launched}. `
                + 'This means the OS accepted the request, NOT that the dialog '
                + 'was shown — quota rules decide that independently.',
            );
        } catch (e) {
            this._reportError('requestReview', e as ReviewError);
        }
    }

    private async _onOpenStoreReview(): Promise<void> {
        this._log('Resolving store review URL...');
        try {
            const url = await inAppReview.getAppReviewUrl();
            this._log(`Store review URL resolved: ${url}`);
            sys.openURL(url);
        } catch (e) {
            this._reportError('getAppReviewUrl', e as ReviewError);
        }
    }

    private _reportError(what: string, err: ReviewError): void {
        if (err && err.code === 'E_NOT_SUPPORTED') {
            this._log(`${what}: native only — build to Android/iOS to try this.`);
            return;
        }
        const message = (err && err.message) || String(err);
        const code = (err && err.code) || 'E_UNKNOWN';
        this._log(`${what} failed [${code}]: ${message}`);
    }
}
