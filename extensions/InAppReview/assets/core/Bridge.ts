/**
 * InAppReview Bridge — Cocos Creator 3.8.8
 *
 * Registers a native event listener on the "inappreview" channel using
 * native.jsbBridgeWrapper, multiplexing incoming JSON messages into pending
 * promise resolutions by numeric id.
 *
 * Wire protocol (fixed — both JS and native sides must agree):
 *
 *   JS → native:
 *     dispatchEventToNative("inappreview", JSON.stringify({ id, method, args }))
 *
 *   native → JS (single string argument):
 *     Response (success):
 *       { "kind": "response", "id": <int>, "success": true,
 *         "data": { ... } }
 *     Response (failure):
 *       { "kind": "response", "id": <int>, "success": false,
 *         "error": { "code": string, "message": string } }
 *
 * Timeout: the default timeout for native calls is 30 s, which is appropriate
 * for both methods — requestReview resolves quickly (the OS UI is fire-and-
 * forget from the JS side), and getAppReviewUrl involves at most one network
 * hop. Pass a `timeoutMs` override of `0` to disable the timeout entirely if
 * needed.
 *
 * Guard: on non-native platforms call() rejects immediately with
 * { code: 'E_NOT_SUPPORTED', message: '...' }.
 */

import { log } from 'cc';
import { native } from 'cc';
import { NATIVE } from 'cc/env';
import { ReviewError } from '../Types';

const _TAG = '[InAppReview/Bridge]';

/** Default timeout in milliseconds for a pending native call. */
const DEFAULT_CALL_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Internal wire-protocol types
// ---------------------------------------------------------------------------

interface _WireResponse {
    kind: 'response';
    id: number;
    success: true;
    data: unknown;
}

interface _WireError {
    kind: 'response';
    id: number;
    success: false;
    error: ReviewError;
}

type _WireMessage = _WireResponse | _WireError;

// ---------------------------------------------------------------------------
// Internal pending-call entry
// ---------------------------------------------------------------------------

interface _PendingCall {
    resolve: (data: unknown) => void;
    reject: (err: ReviewError) => void;
    /** The active timeout handle, or null when timeout is disabled (0). */
    timer: ReturnType<typeof setTimeout> | null;
}

// ---------------------------------------------------------------------------
// Bridge singleton
// ---------------------------------------------------------------------------

/**
 * Internal bridge between TypeScript and the native InAppReview layer.
 *
 * Only one instance is created (exported as `inAppReviewBridge`). Game code
 * should use InAppReviewClient rather than interacting with the bridge
 * directly.
 */
export class Bridge {

    /**
     * Default milliseconds before an unanswered call is rejected with
     * E_TIMEOUT. Individual calls may override this via their `timeoutMs`
     * argument; pass `0` to disable timeout for that call.
     */
    public defaultCallTimeoutMs: number = DEFAULT_CALL_TIMEOUT_MS;

    private _nextId: number = 1;
    private _pending: Map<number, _PendingCall> = new Map();
    private _registered: boolean = false;

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    /**
     * Initialise the bridge: registers the jsbBridgeWrapper listener once.
     * Safe to call on non-native platforms — the listener registration is
     * guarded by the NATIVE constant.
     */
    public init(): this {
        if (this._registered) {
            return this;
        }
        this._registered = true;

        if (NATIVE) {
            (native as any).jsbBridgeWrapper.addNativeEventListener('inappreview', (payload: string) => {
                this._onNativeMessage(payload);
            });
            log(_TAG, 'native listener registered on channel "inappreview"');
        } else {
            log(_TAG, 'non-native platform — listener registration skipped');
        }

        return this;
    }

    // ------------------------------------------------------------------
    // Public call API
    // ------------------------------------------------------------------

    /**
     * Send a request to the native InAppReview layer and return a Promise
     * that resolves with the response data or rejects with a ReviewError.
     *
     * @param method     camelCase method name matching the native implementation.
     * @param args       Argument object; serialised as JSON.
     * @param timeoutMs  Per-call timeout override. Pass `0` to disable the
     *                   timeout for this call. Omit to use
     *                   `defaultCallTimeoutMs`.
     *
     * @throws ReviewError with code `E_NOT_SUPPORTED` on non-native platforms.
     * @throws ReviewError with code `E_TIMEOUT` if no response arrives within
     *         the effective timeout (skipped when `timeoutMs` is 0).
     */
    public call<T>(method: string, args: object = {}, timeoutMs?: number): Promise<T> {
        if (!NATIVE || !(native as any).jsbBridgeWrapper) {
            return Promise.reject<T>({
                code: 'E_NOT_SUPPORTED',
                message: 'InAppReview is only available on native iOS/Android',
            } as ReviewError);
        }

        const effectiveTimeout = timeoutMs !== undefined ? timeoutMs : this.defaultCallTimeoutMs;
        const id = this._nextId++;
        const payload = JSON.stringify({ id, method, args });

        return new Promise<T>((resolve, reject) => {
            let timer: ReturnType<typeof setTimeout> | null = null;

            if (effectiveTimeout > 0) {
                timer = setTimeout(() => {
                    this._pending.delete(id);
                    reject({
                        code: 'E_TIMEOUT',
                        message: `Native call "${method}" timed out after ${effectiveTimeout}ms`,
                    } as ReviewError);
                }, effectiveTimeout);
            }

            this._pending.set(id, {
                resolve: (data) => resolve(data as T),
                reject,
                timer,
            });

            log(_TAG, `call id=${id} method=${method} timeoutMs=${effectiveTimeout}`);
            (native as any).jsbBridgeWrapper.dispatchEventToNative('inappreview', payload);
        });
    }

    // ------------------------------------------------------------------
    // Private message routing
    // ------------------------------------------------------------------

    private _onNativeMessage(raw: string): void {
        let msg: _WireMessage;
        try {
            msg = JSON.parse(raw) as _WireMessage;
        } catch (e) {
            log(_TAG, 'failed to parse native message:', raw);
            return;
        }

        if (msg.kind === 'response') {
            this._handleResponse(msg);
        } else {
            log(_TAG, 'unknown message kind:', (msg as any).kind);
        }
    }

    private _handleResponse(msg: _WireResponse | _WireError): void {
        const entry = this._pending.get(msg.id);
        if (!entry) {
            log(_TAG, `no pending call for id=${msg.id}`);
            return;
        }

        if (entry.timer !== null) {
            clearTimeout(entry.timer);
        }
        this._pending.delete(msg.id);

        if (msg.success) {
            entry.resolve((msg as _WireResponse).data);
        } else {
            entry.reject((msg as _WireError).error);
        }
    }
}

/** Singleton bridge instance. Initialised on module load. */
export const inAppReviewBridge = new Bridge().init();
