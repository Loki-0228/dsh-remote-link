# bin/ — 随插件打包的 SakuraFrp 客户端

`frpc.exe` 是 SakuraFrp（<https://www.natfrp.com/>）的官方命令行客户端，随本插件一起分发，
所以安装插件就等于装好了隧道客户端，不再需要 `D:\dsh-web-exe\frpc.exe` 那一份。

| 文件 | 说明 |
| --- | --- |
| `frpc.exe` | frpc 客户端，实测版本 `0.51.0-sakura-14`（`frpc --version`） |

插件默认的 `frpcPath` 就指向本目录（`defaultFrpcPath()` 用 `import.meta.url` 推出包根，
所以插件装在哪个 profile、是不是软链/junction 都不影响）。要换成自己的副本时：

- 在插件设置里改 `frpcPath`（绝对路径，或只写 `frpc` 让它走 PATH）；
- 或设环境变量 `DSH_REMOTE_LINK_FRPC=<绝对路径>`。

本目录只放二进制，**不放访问密钥**：token / 隧道 ID 属于用户凭据，写在插件设置里
（`frpcToken` / `frpcTunnelIds`，前者在设置界面按 secret 脱敏存储）。

更新 frpc：从 natfrp.com 下载新的 `frpc.exe` 覆盖本文件即可；插件的日志解析对
TCP（`使用 >>host:port<< 连接你的隧道`）与 HTTP/HTTPS（`domain:` + 端口）两种输出都适配。
