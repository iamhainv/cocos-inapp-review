# Cocos InAppReview

[![CI](https://github.com/iamhainv/cocos-inapp-review/actions/workflows/ci.yml/badge.svg)](https://github.com/iamhainv/cocos-inapp-review/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[English](#english) | [中文](#中文)

---

<a id="english"></a>
## English

A Cocos Creator 3.8.x extension that triggers the native "rate this app"
prompt on iOS (`SKStoreReviewController`) and Android (Google Play
In-App Review API) — plus a fallback that resolves the store page URL — with
a small Promise-based TypeScript API.

### Features

| Feature | API | Notes |
| --- | --- | --- |
| Request the native review prompt | `inAppReview.requestReview()` | Android: Play In-App Review API. iOS: `SKStoreReviewController` / `AppStore.requestReview`. Both platforms throttle the dialog server-side — see [Known limitations](#known-limitations-quota-throttling). |
| Get the store review page URL | `inAppReview.getAppReviewUrl()` | Fallback for when the native prompt can't be shown. Android returns a Play Store details URL; iOS resolves via the iTunes Search API. |
| Graceful web/editor degradation | — | Every call rejects with `{ code: 'E_NOT_SUPPORTED' }` on non-native platforms instead of throwing or crashing. |
| No third-party native SDK to configure | — | Android depends on Google's own `com.google.android.play:review` Play Services library (pulled via Maven); iOS uses Apple's built-in StoreKit — nothing to register or key-manage. |

### Known limitations (quota throttling)

<a id="known-limitations-quota-throttling"></a>

**Both platforms silently limit how often the review dialog is actually
shown, independent of how often you call `requestReview()`:**

- **Android (Play In-App Review API)** — Google does not document an exact
  quota, but the review dialog is shown roughly **once per user per app per
  time window** (empirically on the order of weeks). `requestReview()`
  resolving with `{ launched: true }` means the request was accepted by the
  Play Core library and the review flow ran to completion — it does **not**
  mean the dialog was displayed to the user.
- **iOS (`SKStoreReviewController` / `AppStore.requestReview`)** — Apple
  enforces a hard cap of **at most 3 prompts per app per 365-day rolling
  window** per user, and the decision to actually show it is entirely up to
  the OS. The Promise resolves as soon as the request is dispatched, not
  after (or if) the user sees anything.

**This means seeing nothing happen after calling `requestReview()` is normal,
expected behaviour** — not a bug in this extension, and not something you
can force. See [extensions/InAppReview/doc/en/index.md](./extensions/InAppReview/doc/en/index.md#troubleshooting)
for how to actually test the prompt (internal test track / TestFlight), and
do not call `requestReview()` in a loop or gate other functionality on it.

### Demo

A runnable demo lives at the project root:

- Scene: [`assets/scene/main.scene`](./assets/scene/main.scene)
- Script: [`assets/script/test/InAppReviewTest.ts`](./assets/script/test/InAppReviewTest.ts)

Open this repo as a Cocos Creator 3.8.x project, open `main.scene`, and run
it on an Android or iOS device/simulator build. It builds its whole UI in
code (two buttons: Request Review / Open Store Page, plus a scrolling log
panel) so the example is readable in one file. The log panel explicitly
distinguishes "request accepted by the OS" from "dialog shown" — because
the API can only ever tell you the former. On web preview it shows a status
message instead of attempting a native call, since the review prompt isn't
available there.

> **Known first-open caveat**: `main.scene` was hand-authored (not saved by
> the Creator GUI), and the `InAppReviewTest` component is referenced by the
> script asset's full UUID rather than Creator's internal compressed script
> id. If Creator shows a "script asset lost" / missing-script warning on the
> `Content` node the first time you open the project, just re-drag
> `assets/script/test/InAppReviewTest.ts` onto that node in the Inspector and
> re-save the scene — a one-time fix; only the `Content` node is affected,
> nothing else is at risk.

### Compatibility

| Cocos Creator | Android | iOS | Web |
| --- | --- | --- | --- |
| >= 3.8.0 | Yes (minSdk per project `PROP_MIN_SDK_VERSION`) | Yes | Preview only (native features degrade gracefully) |

### Installation

1. Copy `extensions/InAppReview` into your project's `extensions/` folder.
2. Restart Cocos Creator, or use **Extension → Extension Manager** to enable it.
3. Import from the extension's asset-db mount:
   ```ts
   import { inAppReview } from 'db://inappreview/index';

   try {
     await inAppReview.requestReview();
   } catch (err) {
     const url = await inAppReview.getAppReviewUrl();
     sys.openURL(url);
   }
   ```
4. See the full documentation: [doc/en](./extensions/InAppReview/doc/en/index.md)

### Documentation

- English: [extensions/InAppReview/doc/en/index.md](./extensions/InAppReview/doc/en/index.md)
- 中文: [extensions/InAppReview/doc/zh/index.md](./extensions/InAppReview/doc/zh/index.md)

### License

MIT — see [LICENSE](./LICENSE).

### Trademarks

This project is an independent, community-maintained wrapper and is **not
affiliated with, endorsed by, or sponsored by** Cocos, Google, or Apple.
"Cocos Creator", "AdMob", "Firebase", "Google Play" and "App Store" are
trademarks of their respective owners.

---

<a id="中文"></a>
## 中文

一个 Cocos Creator 3.8.x 扩展，用于调起 iOS（`SKStoreReviewController`）和
Android（Google Play 应用内评价 API）的原生"给应用评分"提示 —— 并附带一个
在无法显示原生提示时可回退到商店评价页面 URL 的方法 —— 提供一套小巧的基于
Promise 的 TypeScript API。

### 功能特性

| 功能 | API | 说明 |
| --- | --- | --- |
| 请求原生评价提示 | `inAppReview.requestReview()` | Android：Play 应用内评价 API。iOS：`SKStoreReviewController` / `AppStore.requestReview`。两个平台都会在服务端对弹窗频率进行限制 —— 详见[已知限制](#已知限制配额限流)。 |
| 获取商店评价页面 URL | `inAppReview.getAppReviewUrl()` | 当原生提示无法显示时的回退方案。Android 返回 Play 商店详情页 URL；iOS 通过 iTunes Search API 解析。 |
| Web/编辑器优雅降级 | — | 在非原生平台上，所有调用都会以 `{ code: 'E_NOT_SUPPORTED' }` 被拒绝，而不是抛出异常或崩溃。 |
| 无需配置第三方原生 SDK | — | Android 依赖 Google 自己的 `com.google.android.play:review` Play Services 库（通过 Maven 拉取）；iOS 使用苹果内置的 StoreKit —— 无需注册或管理密钥。 |

### 已知限制（配额限流）

<a id="已知限制配额限流"></a>

**两个平台都会在后台限制评价弹窗的实际展示频率，与你调用 `requestReview()`
的次数无关：**

- **Android（Play 应用内评价 API）**——Google 没有公布确切配额，但评价弹窗
  大约**每个用户每个应用每个时间窗口只会展示一次**（经验值约为数周量级）。
  `requestReview()` 以 `{ launched: true }` 成功返回，只代表 Play Core 库
  已接受请求并且评价流程执行完毕 —— **并不代表**弹窗真的展示给了用户。
- **iOS（`SKStoreReviewController` / `AppStore.requestReview`）**——苹果规定
  每个应用、每个用户在**滚动 365 天内最多弹出 3 次**，并且是否真正展示完全
  由系统决定。Promise 会在请求被派发后立即 resolve，而不是等到（或确认）
  用户看到了什么之后。

**这意味着调用 `requestReview()` 后什么都没发生是正常的、预期内的行为** ——
不是本扩展的 bug，也不是你能强制触发的。关于如何真正测试弹窗（内部测试轨道
/ TestFlight），请参阅
[extensions/InAppReview/doc/zh/index.md](./extensions/InAppReview/doc/zh/index.md#故障排查)。
请勿在循环中调用 `requestReview()`，也不要用它的结果来控制其他功能的开关。

### 演示

项目根目录内置了一个可直接运行的演示：

- 场景：[`assets/scene/main.scene`](./assets/scene/main.scene)
- 脚本：[`assets/script/test/InAppReviewTest.ts`](./assets/script/test/InAppReviewTest.ts)

用 Cocos Creator 3.8.x 打开本仓库作为项目，打开 `main.scene`，然后构建到
Android 或 iOS 设备/模拟器运行。界面完全由代码构建（两个按钮：请求评价 /
打开商店页面，以及一个滚动日志面板），方便在单个文件中读懂整个示例。日志面板
明确区分"请求被系统接受"和"弹窗已展示" —— 因为 API 只能告诉你前者。Web
预览下会显示状态提示而不会尝试真正调用原生接口，因为评价提示在 Web 上不可用。

> **首次打开的已知注意事项**：`main.scene` 是手工编写的（并非通过 Creator
> 编辑器保存），其中 `InAppReviewTest` 组件是通过脚本资源的完整 UUID 引用的，
> 而不是 Creator 内部的压缩脚本 ID。如果首次打开项目时 Creator 在 `Content`
> 节点上提示"脚本丢失"之类的警告，只需将
> `assets/script/test/InAppReviewTest.ts` 重新拖拽到该节点的 Inspector 面板上
> 并重新保存场景即可 —— 这是一次性修复，只影响 `Content` 节点，不会影响项目
> 其他部分。

### 兼容性

| Cocos Creator | Android | iOS | Web |
| --- | --- | --- | --- |
| >= 3.8.0 | 支持（minSdk 取决于项目的 `PROP_MIN_SDK_VERSION`） | 支持 | 仅预览（原生功能会优雅降级） |

### 安装

1. 将 `extensions/InAppReview` 复制到项目的 `extensions/` 目录下。
2. 重启 Cocos Creator，或通过 **扩展 → 扩展管理器** 启用该扩展。
3. 从扩展的 asset-db 挂载路径导入：
   ```ts
   import { inAppReview } from 'db://inappreview/index';

   try {
     await inAppReview.requestReview();
   } catch (err) {
     const url = await inAppReview.getAppReviewUrl();
     sys.openURL(url);
   }
   ```
4. 查看完整文档：[doc/zh](./extensions/InAppReview/doc/zh/index.md)

### 文档

- English: [extensions/InAppReview/doc/en/index.md](./extensions/InAppReview/doc/en/index.md)
- 中文: [extensions/InAppReview/doc/zh/index.md](./extensions/InAppReview/doc/zh/index.md)

### 许可证

MIT — 详见 [LICENSE](./LICENSE)。

### 商标声明

本项目为独立的社区维护封装库，**与 Cocos、Google、Apple 均无关联，未获得其
认可或赞助**。"Cocos Creator"、"AdMob"、"Firebase"、"Google Play" 与
"App Store" 均为其各自所有者的商标。
