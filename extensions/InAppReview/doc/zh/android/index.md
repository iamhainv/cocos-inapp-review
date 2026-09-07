# Cocos InAppReview — Android 相关要求（中文）

## 权限 / 能力声明

不需要任何 manifest 权限。该库只声明了一个零权限的 `<provider>`：

```xml
<provider
    android:name="com.cocos.inappreview.ReviewInitProvider"
    android:authorities="${applicationId}.reviewinit"
    android:exported="false"/>
```

`ReviewInitProvider` 会在 `Application.onCreate()` 执行之前自动注册好
JS↔原生的桥接——这与 Firebase、WorkManager 以及本仓库的姊妹扩展 `Share`
所使用的零权限 `ContentProvider` 初始化方式完全一致。你不需要修改
`AppActivity.java`，也不需要额外添加任何代码。

底层的 **Google Play 应用内评价 API** 要求：

- 设备上需要有 **Google Play 服务**（在没有 Play 商店的设备上不可用，例如
  部分中国大陆的定制 ROM，或未安装 Google APIs 镜像的模拟器）。
- 应用需要**通过 Google Play 的分发渠道**（内部测试轨道或更高级别）安装，
  评价弹窗才能可靠地出现——详见
  [doc/zh/index.md](../index.md) 中的配额说明章节。

## 构建配置

- Gradle 依赖（会被自动添加到生成的 `libinappreview` 模块中，不需要你手动
  添加）：

  ```gradle
  implementation 'com.google.android.play:review:2.0.2'
  ```

- **minSdkVersion**：`com.google.android.play:review` 库要求
  `minSdkVersion >= 19`。Cocos Creator 的 Android 构建面板通常本来就会
  设置更高的最小版本；如果你手动把 `PROP_MIN_SDK_VERSION` 降到了 19 以下，
  请把它调回去。
- 除了 Cocos Creator 自身 Android 构建面板已经要求的下限之外，本扩展没有
  额外的 `compileSdkVersion` / `targetSdkVersion` 要求。
- 当勾选 **启用应用内评价** 时，本扩展会向生成的 Android 工程注入两处内容：
  1. 在 `native/engine/android/app/build.gradle` 中追加
     `implementation project(':libinappreview')`。
  2. 在构建输出工程的 `settings.gradle` 中追加 `include ':libinappreview'`。

  这两处插入都是幂等的（追加前会先检查是否已存在完全相同的片段），并且当你
  取消勾选该选项并重新构建时会被彻底移除。
- `libinappreview` 这个 Android 库模块本身会被复制到
  `<构建输出>/proj/libinappreview/`。使用 **强制覆盖应用内评价库文件**
  选项来控制这一步复制操作是否会覆盖已经存在的（可能是手动修改过的）副本。

## 已知限制

- Play 应用内评价 API 是 Google Play 专属的；在没有 Play 服务的 Android
  分发渠道（例如某些第三方 Android 应用商店）上没有等价物。在这类设备上，
  `requestReview()` 会以 `E_REVIEW_FAILED` 失败，而不是静默地"假装成功"——
  如果你支持这些渠道，请通过回退到 `getAppReviewUrl()`，或者干脆隐藏
  "给我们评分"入口来处理这种情况。
- 存在一个并发请求保护机制：在一次 `requestReview()` 调用还在进行中时再次
  调用它，第二次调用会以
  `E_REVIEW_FAILED "review request already in progress"` 结束——这是有意
  为之的设计，不是 bug。
