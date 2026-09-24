# 在 iPad 上安装 DSH Remote

应用需要 iPadOS 16 或更新版本，也可在 iPhone 上运行。包含远程会话、通知与审批、六类通知开关和简略通知。横竖屏共享同一个 WKWebView，声音和震动交给系统通知设置。

## 获取并签名 IPA

1. 打开 [GitHub Releases](https://github.com/Loki-0228/dsh-remote-link/releases/latest)。
2. 下载附件 DSH-Remote-iPad-unsigned.ipa。
3. 准备对应 Bundle ID 的签名证书与描述文件。
4. 用你的签名工具和描述文件重新签名，再安装到 iPad。

默认 Bundle ID 为 `com.dsh.remote`。如果侧载工具改变 Bundle ID，电脑端 APNs 的 topic 必须改为最终 Bundle ID。

IPA 没有签名，也不含描述文件。需要后台推送时，签名描述文件必须包含对应 App ID 的 Push Notifications 权限，重签名后需保留有效的 `aps-environment` entitlement。仅能安装应用的普通签名不代表能够接收 APNs。参见 [Apple 的 APNs 注册说明](https://developer.apple.com/documentation/usernotifications/registering-your-app-with-apns)。

## 连接电脑

电脑需运行提供 `nativeNotifications` 服务的 DSH-Web.exe，并加载 0.4.0 或更新版本的 remote-link 插件。普通 dsh 宿主缺少该服务时，通知接口返回 503。

1. 在电脑的「远程链接」面板生成配对链接。
2. 在 iPad 的「连接电脑」页面粘贴完整链接。
3. 点击「配对电脑」。
4. 在系统提示中允许通知。
5. 在「远程会话」中打开电脑上的会话。

外网地址必须使用 HTTPS。HTTP 仅允许私有局域网地址、localhost 和 .local 名称，并在配对前要求确认。配对凭据保存在 Keychain，不写入通知载荷。

## 启用 APNs 后台通知

准备 Apple Developer Team ID、APNs Key ID、P-256 的 .p8 私钥，以及最终签名的 Bundle ID。创建密钥的方法见 [Apple 的 token 认证说明](https://developer.apple.com/documentation/usernotifications/establishing-a-token-based-connection-to-apns)。

1. 在电脑用户目录的 `.dsh/apns` 下保存私钥，例如 `AuthKey.p8`。
2. 将 [config.example.json](../../docs/apns/config.example.json) 复制到该目录，改名为 `config.json`。
3. 填写 teamId、keyId、topic 和 privateKeyFile。
4. 重启电脑上的 DSH-Web。
5. 在 iPad「通知设置」中开启「后台推送」，选择与签名描述文件一致的 APNs 环境。
6. 确认状态显示「已注册 APNs 后台推送」。

私钥只留在电脑。配置文件支持用环境变量 `DSH_APNS_CONFIG` 指定路径，设备登记目录支持 `DSH_APNS_DIR`。修改配置后需重启宿主。没有密钥时，应用保留前台连接和通知功能，并显示 APNs 待配置。

任务开始、结束、失败、审批、问题及插件消息会经过已配对设备与通知类型筛选，再发往 Apple。电脑须保持运行并能连接 Apple 推送服务，iPad 收到提醒无需保持应用前台运行。通知的送达和显示受系统权限、专注模式与网络状态影响。

默认推送包含任务名称与摘要。在「通知设置」关闭内容预览后，Apple 只接收通用提醒、事件标识与必要元数据。关闭「后台推送」会注销电脑端登记。在电脑撤销设备后，电脑不再为该设备发送新推送；已交给 Apple 的通知不能撤回。

## 在 Mac 上构建

需要 Xcode 与 iOS Simulator，无第三方 Swift 依赖。在仓库根目录运行：

```bash
bash apps/ios/scripts/build-unsigned.sh
bash apps/ios/scripts/test-ipad.sh
```

IPA 位于 `release/DSH-Remote-iPad-unsigned.ipa`。测试结果和截图位于 `apps/ios/build`。脚本生成的 Xcode 项目不提交到仓库。

## 验证边界

Actions 编译真实 iOS 设备包，并在 iPad Simulator 运行模型解码、配对校验、通知开关和横竖屏测试。WebView 旋转测试用离线页面验证输入保留。深色模式截图也保存在验证产物中。

真实 APNs 送达需要 Apple 密钥、有效推送签名与实体设备；未配置这些条件时，自动测试只验证签名算法、筛选、鉴权和队列行为。实体 iPad 的网络配对、分屏与后台送达仍需安装后验证。
