# Cocos InAppReview — iOS 相关要求（中文）

## 权限 / 能力声明

不需要任何 `Info.plist` 条目、entitlements 或额外能力声明。
`SKStoreReviewController` 是一个 StoreKit UI API——没有任何需要声明、注册
或申请用户授权的内容。

原生桥接层（`ReviewServiceHub`）是一个纯 Objective-C 单例，在
`AppDelegate` 的 `application:didFinishLaunchingWithOptions:` 中被自动
注册一次（由构建 hook 自动接入，与本仓库姊妹扩展 `Share` 采用的模式完全
相同）——你不需要手动修改 `AppDelegate.mm` 或任何 Info.plist key。

## 构建配置

- 本扩展链接了 `StoreKit.framework` 和 `Foundation.framework`（均为系统
  framework，没有第三方或 `xcframework` 依赖，也不需要添加任何
  CocoaPods/SPM 包）：

  ```cmake
  target_link_libraries(inappreview "-framework StoreKit")
  target_link_libraries(inappreview "-framework Foundation")
  ```

- **最低部署目标**：`SKStoreReviewController` 首次出现于 iOS 10.3；基于
  scene 的 `requestReviewInScene:` 调用路径需要 iOS 14+，桥接层会在更低
  版本上自动回退到 iOS 14 之前的 `requestReview` 调用。实际上有效的下限
  取决于你项目自身的 iOS 部署目标（本扩展的模板沿用了 `Share` 扩展的
  基线，即 iOS >= 13.0）——InAppReview 本身没有需要单独配置的最低版本。
- 本扩展会把 `ReviewServiceHub.mm`/`.h` 编译成一个小型静态库
  （`inappreview`），并通过 `-ObjC` 把它强制链接进最终的可执行文件；这一切
  通过 `Pre-inappreview.cmake` / `Post-inappreview.cmake` 在 iOS 构建任务
  勾选 **启用应用内评价** 时自动接入。取消勾选该选项后，下一次构建会移除
  已注入的 `proj/inappreview` 目录以及对应的 `include()`。
- 使用 **强制覆盖应用内评价库文件** 来控制构建步骤是否会覆盖已存在的
  （可能是手动修改过的）`proj/inappreview` 目录副本。
- 桥接源码按文件启用了 ARC；如果你需要阅读原生代码，不需要手动管理内存或
  进行任何桥接类型转换。

## iOS 平台特有的 API 行为

- `requestReview()` 会在请求被派发给 `SKStoreReviewController` 之后
  **立即** resolve——Apple 没有为调用方提供任何完成回调，因此
  `{ launched: true }` 只能确认请求已经被提交，绝不代表弹窗真的出现过。
- `SKStoreReviewController` 的 `requestReviewInScene:`/`requestReview`
  **在 TestFlight 构建中永远不会显示**——这是 Apple 明确的限制，本扩展
  无法改变或检测到这一点。请只用 TestFlight 来确认*调用本身能成功、不会
  崩溃*，而不要指望在其中看到弹窗。
- `getAppReviewUrl()` 通过
  `https://itunes.apple.com/lookup?bundleId=<你的 bundle id>` 解析出 App
  Store 的 `trackId`，并返回
  `https://apps.apple.com/app/id<trackId>?action=write-review`。这需要
  网络访问，并且要求该应用已经至少向 App Store Connect 提交过一次——对于
  从未发布过的应用会以 `E_URL_FAILED` 失败。

## 如何正确测试

除了上面提到的 TestFlight 限制之外，Apple 还强制规定**每个应用每个用户在
滚动的 365 天窗口内最多显示 3 次评价弹窗**。要在开发阶段真正看到弹窗：

1. 使用 **Xcode 直接构建并运行到真机（或模拟器）**——而不是 TestFlight
   构建。开发版/Ad-Hoc 构建不受 TestFlight 的限制。
2. 如果在全新安装后仍然看不到弹窗，很可能是该 Apple ID / 设备组合最近已经
   用完了配额。Apple 没有提供在真机上重置该计数器的官方方式；实践中的
   变通办法是换一个沙盒 Apple ID，或换一台设备/模拟器继续迭代。
3. 把"Promise 以 `launched: true` resolve，但没有看到弹窗"当作**通过**，
   而不是失败——这是该 API 的既定行为，Apple 自己的开发者文档中也对
   `SKStoreReviewController` 做了同样的说明。
4. 只在正式发布之后，谨慎地、少量地核实真实终端用户的行为——即便到了这一
   步，你也依然无法按需强制弹出该对话框。

## 已知限制

- 没有完成信号：本扩展（以及底层的操作系统 API）无法告诉你的游戏用户是否
  真的看到或与弹窗进行了交互——只能告诉你请求已被接受。
- 无论配额状态如何，在 TestFlight 中永远不会显示——请把 QA 流程建立在
  开发版构建之上，而不是 TestFlight。
- `getAppReviewUrl()` 需要网络访问，以及一个已被 App Store 收录的 bundle
  ID；对于预发布/未发布的应用，不能把它当作可靠的兜底方案使用。
- "每 365 天最多 3 次弹窗"这一限制完全由 Apple 在服务器端强制执行；本扩展
  没有任何方式查询剩余配额，也无法预测下一次调用是否真的会显示任何内容。
