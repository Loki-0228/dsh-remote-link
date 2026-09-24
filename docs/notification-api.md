# 通知接口参考

remote-link 0.4.0 将电脑端 `nativeNotifications` 服务提供给已配对的移动设备，并把符合条件的新事件发送到 APNs。iPad、Android 与其他插件可共用事件类型。

## 插件内调用

插件通过 Cordis 上下文取得通知服务。该服务由支持原生通知的 DSH-Web.exe 注入；普通宿主需先加载对应通知模块。

```javascript
const notifications = ctx.get('nativeNotifications')
notifications.publish({
  kind: 'task-completed',
  title: '导出完成',
  taskTitle: '导出季度报表',
  summary: '已生成 120 行，保存为 report.csv',
  body: '报表已导出到当前工作区的 report.csv。',
  source: 'my-plugin',
  sessionId: 'your-session-id',
})
```

`kind` 可取 `task-started`、`task-completed`、`task-failed`、`approval`、`question` 和 `info`。提供 taskTitle 与 summary 后，移动通知直接显示任务名称和结果摘要。发布事件不代表创建待审批请求；审批应调用服务的 `requestApproval`。

电脑端 nativeNotifications 服务负责事件创建、待处理请求和响应。remote-link 不提供匿名事件发布接口。

## 移动端 HTTP 接口

所有接口都要求有效配对设备。原生客户端携带 `x-dsh-remote-device` 请求头，浏览器可使用配对 cookie。跨站请求被拒绝；撤销设备后返回 403。响应禁止缓存。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | /api/remote-notifications/poll | 读取通知与待处理请求。支持 epoch、after、wait 查询参数。 |
| POST | /api/remote-notifications/respond | 提交待处理请求的 id 和 value。 |
| GET | /api/remote-notifications/push/status | 查询本设备 APNs 登记状态与电脑配置状态。 |
| POST | /api/remote-notifications/push/register | 登记 APNs token、环境、Bundle ID 与通知偏好。 |
| POST | /api/remote-notifications/push/unregister | 删除本设备的 APNs 登记。 |

register 请求体最多 4 KiB：

```json
{
  "token": "来自系统注册回调的十六进制设备 token",
  "topic": "com.dsh.remote",
  "environment": "production",
  "disabled": ["task-started"],
  "brief": true,
  "previewContent": true
}
```

environment 仅接受 production 或 development，需与签名描述文件一致。disabled 仅接受上述六类通知。已配置 APNs 时，topic 必须与电脑端配置匹配。请求只能修改当前配对设备的登记，不能指定其他设备。

status 返回 configured 和 registered；电脑已配置时还包含 topic。它不返回私钥、APNs token 或配对凭据。registered 表示电脑保存了登记，并不代表 Apple 已确认通知送达。

设备记录存于电脑的 `.dsh/apns/devices.json`，以配对设备凭据的 SHA-256 作为索引。发送前重新检查设备是否有效、通知类型是否开启、审批是否仍待处理。Apple 返回失效 token 时删除登记。

完整安装与密钥配置步骤见 [iPad 安装说明](../ios/README.md)。
