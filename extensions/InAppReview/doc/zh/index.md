# Cocos InAppReview（中文）

一个 Cocos Creator 3.8.x 扩展，用于在 Android（Google Play 应用内评价 API）
和 iOS（`SKStoreReviewController`）上调起原生"给应用评分"提示，并提供一个
商店页面回退 URL。提供基于 Promise 的 TypeScript API、JSB 桥接，除 Google
自带的 Play Core 库外无需任何第三方原生依赖。

> **集成前请先阅读**：Google 和 Apple 都会在后台对该提示进行限流。一次成功
> 的调用**很常见**地不会在屏幕上显示任何东西 —— 这是平台预期行为，不是本
> 扩展的 bug。详见下方的
> [配额限制与如何正确测试](#配额限制与如何正确测试)。

## 兼容性

| Cocos Creator | Android | iOS |
| --- | --- | --- |
| >= 3.8.0 | minSdk >= 19（`com.google.android.play:review` 要求） | 部署目标 >= 13.0（API 本身自 iOS 10.3 起可用） |

Web / 编辑器预览：该模块不可用；所有调用都会以
`{ code: 'E_NOT_SUPPORTED' }` 被拒绝，而不是抛出异常或崩溃（详见
[已知限制](#已知限制)）。

## 安装

1. 将 `extensions/InAppReview` 复制到项目的 `extensions/` 目录下。
2. 重启 Cocos Creator，或打开 **扩展 → 扩展管理器**，在已安装列表中启用
   **InAppReview**。
3. 在游戏代码中从扩展的 asset-db 挂载路径导入客户端：

   ```ts
   import { inAppReview } from 'db://inappreview/index';

   try {
     const result = await inAppReview.requestReview();
     console.log('launched =', result.launched);
   } catch (err) {
     // err.code, err.message
   }
   ```
4. 在 **项目 → 构建** 中添加 Android 和/或 iOS 构建任务，确认下方描述的
   **InAppReview** 面板选项，然后构建。

## 构建面板选项

InAppReview 面板会出现在 **Android** 和 **iOS** 构建任务标签页下（两个
平台的选项相同）。本次初始发布未附带截图 —— 启用扩展后可从
**项目 → 构建** 中自行截取，并放入 `doc/img/`（该目录已预留，目前仅有
`.gitkeep`）。

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| **启用应用内评价**（`enableInAppReview`） | 复选框 | `true` | 启用/禁用本次构建的评价模块。启用时，原生评价提示集成文件会被复制进构建后的工程（Android 为 Gradle 模块，iOS 为 CMake 目标）。禁用时，之前注入的所有内容会被彻底移除。 |
| **强制覆盖应用内评价库**（`overwriteLibrary`） | 复选框 | `true` | 每次构建时用扩展模板覆盖构建输出中已存在的原生库文件。如果你手动修改过生成的 `libinappreview`（Android）/ `inappreview`（iOS）目录并希望在重新构建时保留这些修改，请取消勾选。 |

## API 参考

完整 JSDoc 位于
[`assets/InAppReviewClient.ts`](../../assets/InAppReviewClient.ts) 和
[`assets/Types.ts`](../../assets/Types.ts)；下方为摘要。

### `inAppReview.requestReview(): Promise<ReviewResult>`

向操作系统发起评价请求。

- **Android**（Play 应用内评价 API）：返回的 Promise 会在评价流程*完成*
  （对话框被关闭或被系统跳过）后 resolve。如果 `ReviewInfo` 生成失败或
  发起调用失败，则以 `E_REVIEW_FAILED` reject。
- **iOS**（`SKStoreReviewController`）：Promise 会在请求被派发后**立即**
  resolve —— 而不是等用户与对话框交互之后，因为系统不提供完成回调。在
  TestFlight 构建中永远不会显示；在开发/沙盒构建中无论配额如何都会显示。
- 两个平台均：`{ launched: true }` 表示系统**已接受**该请求 —— 并**不**
  代表评分对话框真的显示出来了。
- 在 Web / 编辑器预览下以 `E_NOT_SUPPORTED` reject。
- 如果 30 秒内原生层没有响应，则以 `E_TIMEOUT` reject（仅 Android —— 这是
  桥接层的默认调用超时；iOS 会立即 resolve，实际上几乎不会触发这个错误）。

```ts
import { inAppReview } from 'db://inappreview/index';

try {
  const { launched } = await inAppReview.requestReview();
  console.log('评价请求已被系统接受：', launched);
} catch (err) {
  console.warn('评价请求失败：', err.code, err.message);
}
```

### `inAppReview.getAppReviewUrl(): Promise<string>`

返回平台的商店评价页面 URL —— 当你怀疑应用内提示被限流时，可作为回退方案
使用（例如展示一个"给我们评分"按钮，直接打开商店页面而不是依赖系统提示）。

- **Android**：由应用自身包名构建的
  `https://play.google.com/store/apps/details?id=<package>` URL —— 始终
  可解析，无需网络请求。
- **iOS**：通过 iTunes Search API
  （`https://itunes.apple.com/lookup?bundleId=<bundle id>`）解析 —— 需要
  网络访问。如果查找失败，或该 bundle ID 尚未发布到 App Store（例如尚未
  发布的应用），则以 `E_URL_FAILED` reject。解析出的 URL 会带上
  `?action=write-review`，因此会直接打开评价表单，而不仅仅是应用详情页。

```ts
import { inAppReview } from 'db://inappreview/index';
import { sys } from 'cc';

try {
  await inAppReview.requestReview();
} catch {
  // 回退方案：直接引导用户前往商店页面。
  try {
    const url = await inAppReview.getAppReviewUrl();
    sys.openURL(url);
  } catch (err) {
    console.warn('无法解析商店评价 URL：', err);
  }
}
```

### 错误码（`ReviewError.code`）

| 错误码 | 含义 |
| --- | --- |
| `E_NOT_SUPPORTED` | 在非原生平台（Web / 编辑器预览）上调用。 |
| `E_TIMEOUT` | 原生层 30 秒内没有响应。 |
| `E_REVIEW_FAILED` | Android：`ReviewInfo` 生成或 `launchReviewFlow` 失败（例如 Play Core 库缺失、没有 Activity，或已有一个评价请求正在进行中）。 |
| `E_URL_FAILED` | `getAppReviewUrl` 无法解析出商店 URL（iOS iTunes 查询网络错误、bundle ID 未知/未发布，或设备无法读取自身的 bundle identifier）。 |

## 示例

项目根目录内置了一个可直接运行的演示：

- 场景：[`assets/scene/main.scene`](../../../../assets/scene/main.scene)
- 脚本：[`assets/script/test/InAppReviewTest.ts`](../../../../assets/script/test/InAppReviewTest.ts)

用 Cocos Creator 3.8.x 打开本仓库作为项目，打开 `main.scene`，然后构建到
Android 或 iOS 设备/模拟器上运行。界面上有两个按钮（"Request Review" 和
"Open Store Review Page"）以及一个屏幕日志区域，可以观察每次调用的
resolve/reject 结果 —— 包括非常常见的情形：`requestReview()` 以
`launched: true` resolve，但对话框始终没有出现，因为系统决定跳过它。

## 配额限制与如何正确测试

Google 和 Apple 都不允许你按需展示这个提示，也都不会告诉你*为什么*某次
调用没有显示对话框。请把"什么都没发生"当作默认结果，而不是错误。

- **Android**：Google 没有公布确切配额，但实践中该对话框大约**在一个滚动
  时间窗口内每个应用每个用户只显示一次**（经观察约为数周量级），无论你调用
  `requestReview()` 多少次。要可靠地测试，需要：
  - 将应用发布到 Google Play 的**内部测试轨道**（或更高轨道）—— 对于不是
    通过 Play 分发渠道安装的 APK，评价流程无法可靠显示。
  - 使用**通过 Play 商店安装**（而非侧载）应用的测试账号。
  - 不要假设同一会话/设备内的第二次调用会显示任何东西 —— 几乎肯定不会。
- **iOS**：Apple 强制规定**每个应用每个用户在滚动 365 天内最多弹出 3 次**，
  与应用的发布节奏无关，且按用户单独追踪。要可靠地测试，需要：
  - 使用 **TestFlight** 构建来验证*调用本身能成功并 resolve* —— 但请注意
    `SKStoreReviewController` **在 TestFlight 构建中永远不会真正显示对话框**，
    这是 Apple 的设计决定。
  - 使用**开发/沙盒构建**（Xcode → 设备，而非 TestFlight）来查看对话框本身，
    因为该场景下的配额限制要宽松得多，便于测试。
  - 只在发布后、以少量频次核实真实生产环境的表现。

**请勿在循环中、每次启动应用时，或作为"重试直到显示"的策略调用
`requestReview()`。** 这样做会浪费本应留给正常提示的配额，并可能被两个
平台都视为对该 API 的滥用。应在一个积极的用户时刻之后调用（例如完成一个
关卡、完成一次购买），并且每个版本最多调用几次。

## 故障排查

- **Android 构建时出现 Gradle 同步 / 重复类错误，提及
  `com.google.android.play`**：另一个扩展或你自己应用的 `build.gradle`
  已经声明了不同版本的 `com.google.android.play:review`。请将两者对齐到
  同一版本，或从其中一方排除该传递依赖。
- **Android 上出现 `E_REVIEW_FAILED`，提示 "Play Review library
  missing"**：设备上没有 Play 商店 / Play Core 服务（例如没有 Google
  Play 的模拟器，或非 Play 分发渠道）。Play 应用内评价 API 仅在具备
  Google Play 服务的设备上可用。
- **iOS CMake 找不到 `StoreKit`**：确认在 iOS 构建任务中已勾选扩展的
  **启用应用内评价** 选项，并且在启用后重新执行了构建 —— CMake 集成文件
  只有在该选项开启时才会被复制进 `native/engine/ios`。
- **点击"Request Review"没有任何反应**：这很可能是配额限流，而不是 bug ——
  请阅读[配额限制与如何正确测试](#配额限制与如何正确测试)。
- **构建面板中出现原始文本 `i18n:inappreview.xxx`**：`i18n/en.js` /
  `i18n/zh.js` 缺少 `source/builder.ts` 使用的某个键。请提交 issue 并附上
  确切的键名。

## 已知限制

- 不支持 Web 或编辑器预览 —— 底层 API（`SKStoreReviewController`、Play
  应用内评价）属于系统级 UI，在原生移动运行时之外并不存在。所有调用在此
  环境下都会以 `E_NOT_SUPPORTED` reject；请将演示场景构建到 Android/iOS
  以体验真实流程。
- 在任一平台上，`requestReview()` 都**不保证对话框已被展示** —— 这是平台
  层面的设计约束，本扩展无法绕过。不要构建依赖对话框一定会出现的交互逻辑。
- 在 iOS 上，`getAppReviewUrl()` 需要网络访问，以及一个已被 App Store
  收录的 bundle ID；对于尚未提交/发布的应用会失败。
- 本扩展自身不会持久化任何"最近是否已请求过"的本地状态 —— 如果你需要比
  系统级配额更严格的控制，请自行配合一个轻量的冷却逻辑（例如"每个版本最多
  一次，且在一个积极的用户时刻之后"）。
