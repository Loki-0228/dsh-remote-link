# dsh-remote-link

扫码即用的远程访问（remote link）插件，从 `@linxin666/dsh-remote-web-ui` 改写而来，
**只保留核心链路**，并把隧道换成 **SakuraFrp**。

仓库：<https://github.com/Loki-0228/dsh-remote-link> · 包名：`@loki-0228/dsh-remote-link`

一个包、一行插件（`cordis.patch.yml`），两面：

| 半边 | 产物 | 作用 |
| --- | --- | --- |
| Host（Node） | `lib/index.js` | 一次性配对令牌 + 设备会话表 + 撤销、`/api/pair/*` 路由族、`/remote` 受控通道（把远端浏览器的流量以 loopback 身份转回本机）、**只读文件查看器 `/files`**、可选 SakuraFrp 隧道托管、LAN 绑定开关 |
| Browser（Web） | `lib/client.js` | 侧边栏入口 + 配对面板（二维码/链接/有效期/设备列表撤销/查看器链接）、隧道设置表单、`/remote` 通道改写、`?pair=` 配对落地、在线心跳；设备凭据优先读 `sessionStorage`、退回 `localStorage`（新标签页/恢复的标签页同样带上它） |

## 界面位置与主题

- **按钮位置**：挂在侧边栏「工作区」标题右侧那组动作图标里（视图选项 / 添加工作区），
  排在这组图标的**最左侧**，与同排图标同尺寸（28px 圆形），搜索框展开时随这组图标一起收敛。
  插槽体系没有这个位置（`sidebar.workspaces` 是 workspace 插件自己的渲染树，只开了一个
  `*_directoryFlow` 子槽），所以用 DOM 注入实现：把 `sidebar.footer.action` 插槽里渲染的
  宿主节点搬进 `[class*="_headerActions"]` 的首位。注入失败（别的侧边栏组合、
  workspace 插件缺席）时按钮就留在侧边栏底部原位置，功能不受影响。
  判据用 CSS-module 类名的**后缀**匹配（前缀 hash 是构建生成的），并且避开搜索展开时的
  `*_headerActionsHidden` 变体。
- **动作区的宽度上限**：那行自带 `max-width:60px` + `overflow:hidden`，而 60px 正好只装得下
  原来的两个 28px 图标（28 + 4 + 28）——插第三个图标时最右边那个会被裁掉（就是文件夹/
  添加工作区按钮）。所以注入时给容器挂上 `rl-header-actions` 标记类，由本插件样式把上限放到
  96px（28×3 + 4×2 = 92，留点余量）；卸载时摘掉标记，行恢复原状。
- **暗色模式**：面板、按钮、输入框、徽标全部改用宿主主题令牌 `--dsw-alias-*`
  （由 `@deepseek-ai/dsh-client-ui-theme` 提供，跟随亮/暗切换），共 22 个令牌、68 处引用，
  每个都带显式兜底值，缺 ui-theme 的组合也不会变成白底黑字。
  唯一保留的硬编码颜色是二维码的 `#fff` 底：二维码跟着暗色反色会扫不出来。

## 1. 和上游插件的区别

保留（核心）：

- 二维码配对：一次性令牌 → `/pair-accept` → 设备 cookie / 无 cookie 的设备凭据 → `/pair-app` 落地官方界面
- 设备与令牌管理：在线状态、最近活动、逐设备撤销、`停止并撤销`
- `/remote` 受控通道：未配对 403（SDK 信封），已配对则把 `/api`、`/sidebar`、`/git` 与
  事件流 socket 以 127.0.0.1 身份转回本机（自动附带进程自身的浏览器凭据）
- 只有物理本机可达的控制面：`/api/pair`、`/api/update`、`/api/plugin-manager`
- **只读文件查看器**（本次改写新增、上游没有）：独立页面 `/files` + 三个只读接口，把远端
  限制在「当前会话所在的项目目录」之内，见第 4 节
- LAN 绑定开关（写 profile patch + 防火墙规则）、`crypto.randomUUID` 垫片（明文 HTTP 的局域网可用）
- 解析期 boot patch：在 `dsh-client-connection` 之前装上通道改写，并置 `ownsHost`

移除（上游有、这里没有）：

- 移动端皮肤：`client/mobile-adapt.ts`（5.9 万字符的竖屏触摸适配、鲸鱼悬浮按钮、手势钩子）——整块删除
- 匿名遥测 `telemetry.ts`
- 自我更新面板 `update.ts` / `update-routes.ts` / `UpdatePanel`
- 稳定域名中转 `relay-registry.ts`
- Cloudflare 隧道（quick / named），换成 SakuraFrp
- 宠物联动 `remote-presence-pet.ts`、`/api` 姿态探测 `posture.ts`、widget `PluginSettingsCard`

配置项也随之精简：`autoTunnel`、`tunnelToken`、`relay` 换成 `tunnelEnabled`、
`frpcToken`、`frpcTunnelIds`、`frpcPath`、`frpcManageProcess`、`frpcPublicBaseUrl`。

## 2. 安装

```powershell
# 装进 web profile（路径用绝对路径，dsh 会转发给 pnpm 并自动把 bundle 加进 profile）
# --config.auto-install-peers=false 不是可选项：见下面的说明
dsh plugin --profile web add --config.auto-install-peers=false D:\dsh-web-exe\dsh-remote-link

# 也可以直接从 GitHub 装（仓库公开：https://github.com/Loki-0228/dsh-remote-link）
# lib/ 产物已提交，所以 pnpm 的 git 安装不需要再跑 prepare 构建
dsh plugin --profile web add --config.auto-install-peers=false github:Loki-0228/dsh-remote-link
```

然后重启 `dsh web`（或 DSH-Web.exe）。卸载：

```powershell
dsh plugin --profile web remove @loki-0228/dsh-remote-link
```

> **为什么必须带 `--config.auto-install-peers=false`。** `pnpm` 8 起默认
> `auto-install-peers=true`：它会去 registry 把「宿主提供的 peer」也当成要下载的依赖，
> 于是每个插件声明的 `@deepseek-ai/dsh-*` peer 都会被解析。而 harness 的这些包**只有预发布
> 版本**（`@deepseek-ai/dsh-llm` 的 `latest` 是 `0.0.1-rc.1`，真正在用的是 `next` 标签下的
> `0.1.5-rc.2`），像 `dsh-command-code-review` 声明的 `^0.1.1` 这种稳定范围**在 registry 上
> 没有任何版本可匹配**，pnpm 直接以 `ERR_PNPM_NO_MATCHING_VERSION` 中止——报错里点名的是
> *别的插件* 的 peer，本插件（零运行时依赖）只是恰好在那次解析里被一起算进去。profile 的
> lockfile 里本来就写着 `autoInstallPeers: false`，加这个参数只是把当初的组合条件还原。
>
> 那次中止发生在 pnpm 阶段，所以 profile 的 `dependencies` 与 `dsh.profile.bundles` 都不会
> 被改动，可以放心重试。
>
> 本包**没有任何运行时依赖**（schemastery/zod/qrcode.react 都已打进产物）。如果 pnpm 在这台
> 机器上被环境整个拦下（例如沙箱禁止 Node `spawn`，报 `EPERM`），可以手动接入：
>
> ```powershell
> $profile = "C:\Users\lq\.dsh\profiles\web"
> # 1) 在 profile 的 package.json 的 dependencies 里加一行
> #    "@loki-0228/dsh-remote-link": "link:D:\\dsh-web-exe\\dsh-remote-link"
> # 2) 建立链接（Node 解析会向外层目录查找 node_modules）
> New-Item -ItemType Directory -Force "$profile\node_modules\@loki-0228" | Out-Null
> cmd /c mklink /J "$profile\node_modules\@loki-0228\dsh-remote-link" "D:\dsh-web-exe\dsh-remote-link"
> # 3) 在 profile 的 package.json 的 dsh.profile.bundles 里加 "@loki-0228/dsh-remote-link"
> # 4) 想顺手把 lockfile 也补一致（不改 node_modules），再跑一次：
> #    dsh plugin --profile web add --config.auto-install-peers=false --lockfile-only D:\dsh-web-exe\dsh-remote-link
> ```

> ⚠️ **不要和老插件同时启用。** 两者都注册 `remoteWebUiPairing` 服务、都占用
> `/api/pair/*` 与 `/remote` 路由。要并行只能二选一启用（在 profile 的
> `cordis.patch.yml` 里给另一个加 `disabled: true`）。

## 3. SakuraFrp 隧道（远程模式）

面板打开后**紧跟标题的第二块就是隧道配置**（常显，不再藏在折叠区里）：

1. 勾选「开启 SakuraFrp 隧道（远程模式）」；
2. 填「访问密钥」——可以只填 token，也可以填 `token:隧道ID`（相当于 `frpc-token.txt` 的格式），
   按回车或点「保存」提交；
3. 隧道 ID 留空即用 token 自带的配置，也可单独填；
4. 地址解析不到时再填「公网地址（兜底）」，例如 `http://frp-cup.com:34437`。

frpc 路径、是否由插件托管进程、非本机访问是否要求已配对这几项收在同一个块的
「高级」折叠里（仍在面板内，避免长表单）。面板文案按「一行一件事」写：标签说字段、
占位符说格式、提示只说那条不回显/生效的规则。

**密钥那一行是只写的，这是宿主契约决定的**：`frpcToken` 在 schema 里声明为
`role('secret')`，而每一路远程读都走 `redactSecrets`，所以浏览器拿到的设置段里**根本没有**
这个字段。把输入框直接绑到设置段的旧写法因此永远渲染成空，而且每敲一个字符就写一次、
写回的值又不会回来推动 `value`，React 会把输入框还原——字段实际上**敲不进去字**（用
`settings.yaml` 手改才能生效）。现在这一行自己持有草稿：回车 / 失焦 / 「保存」/ 关掉面板时
提交，留空不会清除已存密钥，「清除」是唯一的删除入口，提交后提示「已保存（不回显）」。

打开后：插件拉起 frpc → 解析日志拿到公网地址 → **二维码与链接改用该公网地址**
（卡片上出现「隧道」徽标，提示语也变成“任意网络扫码即可远程进入”）→ 配对入口页的信任主机
加上该 authority。

面板是 `remote-link` 命名空间**唯一的**设置界面：共享的「设置 → 插件」页按命名空间派发
`settings.plugin.item` 插槽，没有卡片认领的命名空间在那里什么都不会渲染（本插件没有卡片）。
其余字段（令牌有效期、设备上限、可信主机等）直接改设置文档 `$DSH_HOME/settings.yaml` 的
`remote-link:` 段。另外，设置写入只接受来自本机回环页面：从局域网/隧道地址打开的面板里
整套表单是只读的（宿主的 `settingsScope` 在非回环页面按 memory 模式跑，写入被丢弃），
要改设置请在桌面端 `127.0.0.1` 打开面板。

**frpc 随插件一起打包**：`bin/frpc.exe`（SakuraFrp 官方客户端，实测 `0.51.0-sakura-14`）。
安装插件就等于装好了隧道客户端，不再依赖 `D:\dsh-web-exe\frpc.exe`。插件默认的
`frpcPath` 用 `import.meta.url` 推出包根，所以无论插件装在哪个 profile、是软链还是
junction，都指向本包内的 `bin/frpc.exe`。要换自己的副本：改 `frpcPath`（绝对路径，或只写
`frpc` 走 PATH），或设环境变量 `DSH_REMOTE_LINK_FRPC=<绝对路径>`。

`bin/` 里只放二进制，**不放访问密钥**——token / 隧道 ID 是用户凭据，写在插件设置里
（`frpcToken` 按 secret 脱敏存储）。

面板下方「SakuraFrp 隧道」直接写 `remote-link` 设置段（其余字段也可以直接在
`$DSH_HOME/settings.yaml` 里改），字段：

| 字段 | 说明 | 示例 |
| --- | --- | --- |
| `tunnelEnabled` | 启用隧道；开启后二维码自动换成公网地址 | `true` |
| `frpcToken` | 访问密钥；可只填 token，也可填 `token:隧道ID`（`frpc-token.txt` 的格式） | `token:12345678` |
| `frpcTunnelIds` | 隧道 ID，多个逗号分隔；留空则用 token 自带的 | `12345678` |
| `frpcPath` | frpc 路径；默认 `<插件>/bin/frpc.exe`，只写 `frpc` 会去 PATH 找 | `D:\dsh-web-exe\dsh-remote-link\bin\frpc.exe` |
| `frpcManageProcess` | 由插件启动/托管 frpc（退出时一并杀掉，异常退出按 8s 退避重启） | `true` |
| `frpcPublicBaseUrl` | 兜底公网地址：当日志里解析不到时使用（例如面板自配域名） | `http://frp-cup.com:34437` |

### 插件在控制台/`DSH-Web.log` 里的日志行

插件（宿主半边）打出的每一行都以 `dsh-remote-link:` 开头，launcher 会原样收进 `DSH-Web.log`：

| 行（前缀） | 含义 | 级别 |
| --- | --- | --- |
| `LAN pairing pages are reachable at http://…` | 绑定了 0.0.0.0，这些是可以出二维码的地址（**第一个是可达的那个**） | 正常 |
| `SakuraFrp tunnel mode is on — the QR link uses the tunnel address once frpc reports it` | `tunnelEnabled` 已开，等 frpc 上报地址 | 正常 |
| `lan-bind block written for profile …; it takes effect when the profile next applies` | 你（或设置里）打开了 LAN 绑定开关，已改写 profile 补丁 | 正常 |
| `read-only file viewer on /files — root: <路径> (<标题>)` | 只读查看器已挂载；后面是**启动时**算出的默认根（会话/工作区变了会在每次请求时重算，日志不追） | 正常 |
| `tunnelEnabled is on but frpcToken is empty — the QR link stays LAN-only` | 开了隧道但没填密钥 | 警告 |
| `frpc not found at … — install the SakuraFrp client or point frpcPath at it` | 找不到 frpc 可执行文件 | 警告 |
| `ignoring malformed publicBaseUrl "…" (expected https://host[:port])` | 手工填的公网地址不合法，已忽略 | 警告 |
| `settings registration failed (…) — using the composition entry` | 宿主设置服务没挂上，退回组合配置（面板里的设置表单会因此拿不到命名空间） | 警告 |
| `refused /pair-app from host … (untrusted-host; …)` | 有人用未受信任的 Host 打开了配对入口页（同一形状只打一次，用于排查手机连不上） | 正常/排查 |
| `cannot assert the lan-bind block — the web server port is not known yet` | 端口还没确定，暂不写 LAN 绑定 | 错误 |
| `failed to write the lan-bind block: …` / `the host firewall rule could not be updated (admin rights required…)` | 写 profile 补丁失败 / 改防火墙需要管理员 | 错误 |
| `failed to persist paired devices` / `pairing state listener failed` | 设备表写盘失败 / 状态监听抛错 | 错误 |

不属于插件的行：`dsh web: http://…` / `(LAN: …)`、`config-manager 已挂载`、`缓存自动清理完成`、
`dsh web: opening the default browser` 都是 dsh / 其它插件打印的；launcher 自己的行则不带
`dsh-remote-link:` 前缀（启动头、`局域网:`、`SakuraFrp:`、`日志:`、`托盘:` 等），
其中 `局域网:` / `SakuraFrp:` 两行是 launcher 从上面那两条插件日志里提取的**纯状态**。

插件解析 frpc 日志里的地址行来拿公网地址（实测于 `frpc 0.51.0-sakura-14`）：

```
[I] 隧道启动中: [dsh, tcp]
TCP 隧道启动成功
使用 >>frp-cup.com:34437<< 连接你的隧道      ← 取这一行
或使用节点 IP 连接 (不推荐) >>45.95.212.18:34437<<   ← 故意忽略
```

拿到后自动做两件事：二维码/链接改用该公网地址；配对入口页的信任主机加上该 authority。
HTTP/HTTPS 隧道的 `domain:` + 端口行同样支持。启动成功 60s 内没拿到地址会记为
`failed` 并在面板显示原因，token 无效/隧道不存在这类**不可重试**的错误会让出重试，
网络抖动则照常重启。

### 局域网开关（面板里的「局域网访问」）

`lanBind` 是**唯一**决定绑定的地方（launcher 不再插手）。它在面板里是一个**一级控件**，
和隧道设置并列、不在「高级」折叠里——之前把它塞进折叠区，结果就是「找不到开关」。

面板里这一块包含：

- **开关**「允许局域网设备连接（写配置，重启生效）」；
- **当前绑定**（读 `/api/pair/lan-bind`，回环专属接口）：
  `当前绑定: 所有网卡（0.0.0.0），端口 3080 —— 局域网可访问` /
  `当前绑定: 仅本机（127.0.0.1）—— 局域网不可访问`；
- 已生效时把**局域网地址**列出来并带复制按钮（如 `http://192.168.68.161:3080`）；
- 改了但没生效时明确红字提示：**需要重启 dsh web**（托盘菜单「重启 dsh web 服务」）；
- 防火墙缺放行规则时提示一句（需要管理员权限）。

从非回环地址打开面板（手机/别的电脑）时，这个接口按设计返回 403，面板于是**只说明状态、
不渲染开关**——改绑定本来就是本机动作。

生效是**两阶段**的，这是机制决定的而不是 bug：

1. 打开开关 → 插件往 profile 的 `cordis.patch.yml` 写一个带标记的托管块（`host: '0.0.0.0'`）；
2. **下次启动**才真正绑 0.0.0.0 —— 监听套接字在进程启动时就定了，而且 harness 的 `/api` 信任
   列表也是按当时的绑定推导的（这也是为什么不能在运行中偷偷再开一个监听来「立即生效」：
   那样拿不到 harness 的信任列表）。关闭同理。

两个刻意的设计：

- 托管块**只钉 host，保留端口表达式**（`port: !!js ctx.webStartup.port ?? 3080`）。
  早期实现把当时的端口写成字面量，结果一次 `--port 3411` 的调试会把 3411 永久钉进配置；
  现在测试与 `--port` 都不再污染。
- 写块是**原子替换**（临时文件 + rename），并且不会堆叠第二行 `webserver`；手写的其它内容保留。

隔离环境实测（`DSH_HOME` 指向临时目录、`--port 3411`）：

| 轮次 | 结果 |
| --- | --- |
| 第 1 次 | 日志 `lan-bind block written for profile web (host 0.0.0.0)`；本轮仍绑回环 |
| 第 2 次 | 补丁生效：绑定 0.0.0.0，日志 `LAN pairing pages are reachable at http://192.168.68.161:3411`，**端口仍是 3411**（没被钉成别的值） |

防火墙规则需要管理员权限；拿不到时只提示一次，局域网绑定本身照常生效（端口可能被系统防火墙拦住）。

### 与 DSH-Web.exe（launcher）的分工

launcher 是**纯启动器**：启动 `dsh web`、收日志、管托盘，**不管绑定、不生成补丁、不管隧道**。
局域网与 SakuraFrp 都由 Web GUI 里的插件设置负责，两边不再争同一条配置。

launcher 新增能力（截至 1.8.0.0）：

- **`DSH-Web.log`（与 exe 同目录）**：每次启动截断重写、只保留最近一次。内容 = 启动头
  （时间 / node / bin.js / 实际命令行 / 日志路径）+ launcher 的每一行提示 + `dsh web`
  的完整 stdout+stderr，退出时追加退出码。`dsh web` 起不来时直接看这个文件。
- **状态两行（只在插件加载后打印）**：launcher 只从插件的日志行里取事实，然后打印
  `局域网: 已开启  <地址>`／`未开启（仅本机）` 与 `SakuraFrp: 已开启  <地址>`／`未开启`，
  **不含任何引导语**；插件没加载就一行都不打印——launcher 不替它编内容。
- **不打开浏览器**：浏览器由 `dsh web` 自己打开（早期那个「launcher 兜底打开」已删除，
  免得和 dsh 抢着开、多开标签页）。
- 以 UTF-8 读取子进程输出（此前按系统 ANSI 解码，中文日志会变成乱码）。
- **托盘行为明确分工**：点最小化按钮（含 Win+Down、任务栏右键“最小化”）直接把窗口
  收回系统托盘——不留最小化窗口、不做动画；点 **X 会弹出确认框**问“终止服务并退出”
  还是“最小化到托盘”（不会再默默隐藏）。对话框自己的 X / Esc = 取消，程序继续运行；
  默认按钮是“最小化到托盘”，回车不会误退出。勾选“记住我的选择”会写入 exe 同目录的
  **`DSH-Web.config.json`**（`{"confirmOnExit":false}`），之后点 X 直接收托盘；托盘右键
  的“关闭窗口时询问（推荐）”可随时改回。托盘菜单另有“重启 dsh web 服务”。
- **launcher 是纯粹的启动器**（1.8.0.0）：它不生成补丁、不写绑定配置、不碰局域网开关——
  命令行就是 `dsh web` 加上你透传的参数。启动日志里与插件有关的内容只有那两行状态，
   而且必须等插件自报之后才出现。这样插件与 launcher 不会再抢同一条 `webserver` 配置。
- **托盘“重启服务”不会再被当成崩溃**（1.9.2.0）：被顶替的旧 dsh 退出得慢（node 要收尾、
  frpc 要断）时，它的退出事件会晚到界面线程——那一刻 `restarting` 已经复位，旧版本会因此
  弹“dsh 意外退出”并连带退出 launcher，看起来就像“重启只会退出”。现在 launcher 按
  **进程身份**（被顶替者 + 子进程代号）忽略这类退出，只有当前子进程真的异常退出才报错。
  回归测试脚本在 `launcher-tests/`（`build-test.ps1` 编出带钩子的测试 exe，`run-test.ps1`
  自动点托盘菜单并核对结果）。
- `--launcher-frpc` 保留旧的“launcher 自管 frpc”行为（默认关闭）。
  已移除：`--no-frpc`、`--lan`/`--no-lan`、`--no-open`（浏览器交给 dsh web 自己开）。

`DSH-Web.exe` 正在运行时无法覆盖（Windows 锁定），所以新版本先编成 `DSH-Web.new.exe`，
用根目录脚本替换：

```powershell
pwsh -File D:\dsh-web-exe\build-launcher.ps1        # launcher.cs -> DSH-Web.new.exe（csc / .NET FW 4.8，约 30 KB）
pwsh -File D:\dsh-web-exe\swap-launcher.ps1          # 会先提示（需先退出 DSH-Web），退出码 2 = 仍在运行
pwsh -File D:\dsh-web-exe\swap-launcher.ps1 -Force   # 直接结束 DSH-Web 进程并替换（会断开当前 Web GUI）
```

`swap-launcher.ps1` 替换前会先备份成 `DSH-Web.exe.bak`。`build-launcher.ps1` 用
`C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` + .NET FW 4.8 引用程序集
（`/noconfig`，显式引用 System.Web.Extensions 仅供偏好文件用），产物不依赖 .NET Core 运行时。

`frpc.exe` 与 `frpc-token.txt` 仍留在 `D:\dsh-web-exe\`：launcher 的 `--launcher-frpc`
自管模式会用它，但插件的默认路径已经指向包内的 `bin\frpc.exe`——两者互不影响
（**同一条隧道 ID 只能有一个 frpc**，所以别同时开）。

## 4. 只读文件查看器（远端只能看，不能改）

配对设备打开 `http://<与二维码同一个地址>/files` 就是查看器：宽屏左列目录、右侧预览，
窄屏上下排布。面板的二维码卡片里也有一行**只读文件查看器**（带复制按钮），把它发到手机即可。
它是**独立页面**（自带样式与脚本、无外部资源、无构建产物），所以不依赖官方 SPA 能否在远端启动。

**根目录跟随当前会话**：每次请求现算，默认是**最近活跃的在线会话的工作目录**（你正在干活的那个
项目），下拉框里再列出 harness 注册的全部工作区，最后兜底 `process.cwd()`。桌面端把
`/api/remote-files/roots` 的返回原样渲染，客户端只能回传**根 id**，永远不能指定路径当根。

**只能看**：

- 路由族只有 GET：没有写文件、上传、重命名或编辑器，其它方法一律 405；
- 请求路径必须是相对根目录的：任何 `..` 段（含反斜杠写法）、NUL、绝对路径直接 400/404；
- 根与目标都过 `fs.realpath`：**符号链接/junction 指向根外同样被拒**（测试用 junction 实测过）；
- 文本按 UTF-8 预览（前 8 KiB 含 NUL 即判二进制，只报大小）；图片按扩展名内联
  base64（png/jpg/jpeg/gif/webp/bmp/ico/avif/svg）；单文件上限 1 MB，超了只报大小；
  单次列目录最多 2000 项（超出标记 `truncated`）。

**谁能看**：回环（桌面端自己）直接放行；其它来源必须过与配对入口页同一道 LAN/隧道 fence，
且在 `requirePairingForLan` 打开（默认）时**还必须携带活的配对凭据**——设备 cookie，或
`/pair-app` 捕获进 sessionStorage、以 `x-dsh-remote-device` 头回传的无 cookie 凭据。
所以把隧道地址发给别人，不等于把项目文件发出去。

路由：`/files`（页面）、`/api/remote-files/roots`、`/api/remote-files/list`、
`/api/remote-files/file`（数据，全部 GET）。

## 4.1 配对之后的重开路径（刷新 / 书签 / 恢复标签页）

扫码链路只有一跳是新访客能走的：`/pair-accept?pair=<token>` 换到设备凭据，
再 303 到 `/pair-app?device=<id>`——那里由**插件**把官方外壳发下来（`fetchAppShell`
绕回环抓 index 再注入），并顺手做三件事：把设备 id 写进 `sessionStorage` **和**
`localStorage`、把地址栏改写成 `/`（凭据不进地址栏）、注册重开用的 service worker。

问题就出在地址栏那个 `/`。它是**官方 SPA 的根**，由 harness 的 index fallback 负责，
而那个 fallback 只认**浏览器认证 cookie**；配对设备从来没有过那个 cookie（无 cookie
流程正是设计目标），于是刷新 `http://<局域网IP>:3080/` 得到的是
`401 dsh web authentication required`。HTTP 局域网源不是安全上下文，service worker
注册不上，也就没有兜底——唯一的回头路是把二维码里那条带 `?pair=` 的原链接再贴一次，
而那条链接（令牌在 TTL 内可重复使用）本该随二维码失效。

现在插件自己占了 `/` 这一个精确路由：

- **持有活的配对凭据**（设备 cookie，或 `/pair-app` 抓进 localStorage 的那份）→ 发
  和 `/pair-app` **同一份**外壳（含设备捕捉脚本与 `<base href="/">`），地址栏保持 `/`，
  刷新就是刷新；
- **没有凭据、或凭据已撤销** → 原样写回 harness fallback 那条
  `401 dsh web authentication required`，未配对访客看到的东西一个字节都没变；
- **带 `?token=` 的请求**（`dsh web` 打印的启动链接、以及局域网那条带 token 的地址）
  → 显式调用官方 `connection.authorizeIndex()` 完成令牌兑换，保留 303 跳转和登录 cookie；
- **本机浏览器已有官方登录 cookie** → 校验后显示原始页面，不要求 remote 配对；
- 内部页面抓取使用 `/index.html`，避免抓取 `/` 再次进入插件而递归。
- 只接受 GET/HEAD；其余路径（`/assets/…`、`/plugins/…`、插件自己的路由）走的还是
  原来的分发，与本机渲染的 HTML 一致 —— 外壳本身是**同一份**，桌面端刷新照旧。

所以配对令牌不必再被「留着当密码用」：它只负责一次配对，过期或刷新二维码都不影响
已配对设备的日常重开。`/pair-app?device=<id>` 仍然是备用入口（另一台已配对设备记下
这条 URL 也能进），只是不再需要它来救刷新。

### 0.2.1 本机登录修复

旧版精确路由 `/` 错误地把 `/?token=…` 回应为 404，并把本机 cookie 当成未配对访问。
HTTP handler 写出 404 后不会继续进入 fallback。新版显式调用官方认证接口，再读取
经过认证的 `/index.html`。从 DSH-Web 启动器或托盘「打开网页」进入即可自动登录，
无需手填密钥。手动使用启动链接时要保留完整的 `/?token=…`，它是查询参数，
不是 `/token` 路径。局域网或公网设备仍使用面板生成的配对链接。

二维码地址优先选物理网卡；TUN/VPN 默认路由及 `198.18.0.0/15` 虚拟地址排在后面。

## 5. 端口与地址约定

- 隧道目标端口写在 SakuraFrp 面板的隧道配置里（本机 `dsh web` 的端口，默认 3080）；
  设置里的 `frpcLocalPort` 只是记录，不参与 frpc 配置。
- frpc 目标写 `127.0.0.1:3080` 或 `局域网IP:3080` 都可；本插件的 `/remote` 代理固定
  转回 `127.0.0.1:<webServer.port>`。
- 未开隧道时：`--host 0.0.0.0`（或 LAN 绑定开关）会用局域网 IP 生成二维码。

## 6. 构建与自检

构建工具链**不需要** `node_modules`：`vendor/` 里是构建所需的依赖副本（schemastery、
zod、qrcode.react、cordis 及 cosmokit/spec），esbuild 二进制放在工作区的
`..\.tools\node_modules\@esbuild\win32-x64\esbuild.exe`。

```powershell
node scripts/fetch-esbuild.mjs   # 需要时重新拉取 esbuild 二进制（走注册表 + 校验 sha512）
pwsh -File scripts/build.ps1     # 产出 lib/index.js 与 lib/client.js
pwsh -File scripts/build.ps1 -Check   # 比对已提交产物是否过期
node scripts/verify-artifacts.mjs      # 产物形态 / 包装 / require 清单 / 侧边栏注入逻辑
node scripts/test-client-render.mjs    # 桩 React 渲染组件树（面板结构 / 字段 / 折叠 / 只写凭据行 / 查看器行，38 例）
node scripts/test-host.mjs             # frpc 解析与托管、配置映射、局域网地址排序、查看器越界防护（38 例）
node scripts/test-plugin-boot.mjs      # 假 cordis 上下文端到端（配对、通道、根路径外壳、只读查看器的围栏与越界，33 例）
node scripts/test-settings-namespace.mjs  # 真 settings provider 下的命名空间/字段/secret（18 例；本机已配隧道时须给临时 DSH_HOME，否则读的是线上设置文档）
node scripts/test-lan-qr.mjs           # 二维码到底用哪个地址（绑 0.0.0.0 时）
node scripts/test-live-tunnel.mjs      # 把随包 frpc.exe 的真实输出喂给解析器
node scripts/dump-viewer-page.mjs [out.html]  # 把 /files 的页面写成文件，肉眼核对排版（本沙箱没有浏览器）
```

### 局域网地址排序（二维码为什么不会选到虚拟网卡）

`0.0.0.0` 绑定会暴露每一块网卡，而 Hyper-V / WSL / VPN 的虚拟网卡同样“Up、非 loopback”，
却**从局域网根本连不上**（本机就是 `172.19.240.1` 与 `192.168.68.161` 并存，枚举顺序还把虚拟
网卡排在前面）。所以 `src/lan.ts` 不再只做枚举，而是排序：

1. **默认路由所在网卡的地址优先** —— 用 UDP connect 解析路由（不发包）拿到 OS 实际用于外连的
   本地地址，这是最强的“手机能连上”信号；
2. 物理网卡优先于名字像虚拟/隧道的适配器（`vEthernet`/`Hyper-V`/`WSL`/`VMware`/`VirtualBox`/
   `TAP-Windows`/`OpenVPN`/`WireGuard`/`Tailscale`/`ZeroTier`/`Tunnel`…）；
3. `169.254.x` 之类地址最后；**一个都不丢**——只有虚拟网卡的机器照样能拿到链接，只是排在后面。

二维码与配对链接默认用列表**第一项**，所以它拿到的是 `192.168.68.161` 而不是虚拟网卡地址
（`node scripts/test-lan-qr.mjs` 会打印实际选中的地址）。面板里的单选列表仍保留全部候选，
并在地址后标注「(虚拟网卡)」，默认选中可达的那个。

esbuild 装在**包内** `tools/` 下（`node scripts/fetch-esbuild.mjs`，可用 `--tools DIR` 改位置）：
工作区里那份临时工具目录会被清理，放包内才不会被连带删掉。构建只在包内目录（`vendor/`、
`tools/`）与 `lib/` 上工作，不碰 profile。

构建为什么绕开 Node 直接调二进制：当前环境的沙箱禁止 Node `child_process.spawn`，
esbuild 的 JS API 需要它，所以 `scripts/build.mjs` 只负责算出参数，由 `build.ps1` 执行二进制
（`--format=cjs` + `__ModuleLoader__.load({ id, factory })` 包装，React 等走宿主静态模块表）。

## 7. 已验证 / 未验证

已在**真实 profile** 上验证过（`dsh web` 实跑 + HTTP 探测，不只是在假上下文里）：

- 插件行被组合进 profile 树，`apply()` 执行，boot graph 引用它，
  `GET /plugins/??@loki-0228/dsh-remote-link/client.js&rev=…` 返回 200（约 100KB，含面板样式类）。
- `GET /api/pair/status` → `{"ok":true,"paired":false,"requirePairingForLan":true,...}`。
- `POST /api/pair/issue` → 在 `127.0.0.1` 绑定时如实返回 `409 {"code":"lan-required"}`
  （要二维码得开隧道或 `--host 0.0.0.0`）。注意：`dsh web` 在绑定回环时不外发地址，这是符合设计的。
- 客户端 combo bundle 含 `__ModuleLoader__` 包装与 `dsh-remote-link` 标识。

已验证（自动化）：

- 产物：host 可被 Node 以 ESM 导入并导出 cordis 插件面；client 是合法的懒加载 CJS 工厂，
  运行时 `require` 只有 react / react-dom / react-dom/client（其余都在宿主静态表里）。
- 侧边栏注入：用假 DOM 断言注入函数把宿主插到动作区**首位**、给动作区挂上放宽容量的
  `rl-header-actions` 标记（并断言样式表里那条 96px 规则存在——不挂标记就会裁掉
  「添加工作区/文件夹」）、避开搜索展开时的 `*_headerActionsHidden` 变体、目标缺席时
  退化为 no-op、`null` 宿主安全。
- 面板结构：用桩 React 渲染组件树，断言隧道表单是面板体的一部分（不是折叠区）、
  在 `lan-required` 与 `ready` 两种状态下都在、紧跟标题之上、包含隧道开关与 token/tunnelId/
  frpcPath 字段、token 是 password 输入、表单里只有「高级」一个折叠；
  并断言**局域网开关是独立 section**（不在任何折叠里）、有 checkbox、三种状态文案正确
  （仅本机 / 已绑所有网卡并显示地址 / 改了未生效提示重启）、非回环页面不渲染死开关、
  且隧道表单里**不再重复**出现该开关。
- 设置命名空间：用**真实的 settings-file provider** 挂载插件，断言 `remote-link` 命名空间
  注册成功、schema 字段字典里六个隧道字段都在（schema 驱动表单据此渲染）、
  `frpcToken` 声明为 secret、`frpcPath` 默认落在包内 `bin/frpc.exe`。
- 配对全链路：issue → `/pair-accept` → 设备 cookie → status/heartbeat → 失效链接的兜底页。
- `/remote` 通道：未配对 403（`unpaired` 信封）、本地专属前缀拦截、已配对时真实 HTTP 代理
  成功（内层 Host 改写为 `127.0.0.1:port`、自动附带 `dsh-auth-*` 凭据）。
- `/pair-app`：抓取官方 index 并注入设备凭据捕获脚本。
- **重开路径**（第 4.1 节）：`/` 对已配对设备发同一份外壳（200 + 设备 cookie + 捕捉脚本）、
  对没有凭据的访客原样回 `401 dsh web authentication required`、对带 `?token=` 的请求不拦、
  非 GET/HEAD 405；外壳抓取按「本机认证 → 设备所在 authority 重试」两次尝试，且缓存**按
  authority 分键**（同一 authority 命中缓存，另一个 authority 必须自己抓一份，抓不到时 502）。
- 只读查看器（假 cordis 上下文 + 真 HTTP 处理器 + 真文件系统）：页面 200 且内联脚本能被
  `new Function` 编译通过、没有表单/可编辑面；列表目录在前并给出**相对根**的路径；文本/图片/
  二进制/超大 四种结果；`../`（正斜杠与反斜杠）、绝对路径、根外的同名文件全部拒绝；未知 root id
  回落到默认根（客户端无法指定根）；**junction 指向根外被 realpath 拦下**；POST/DELETE → 405；
  非回环无凭据 403、带设备 cookie 或 `x-dsh-remote-device` 头 200；根目录解析按「最近活跃会话
  → 工作区 → cwd」排序并去重。
- frpc：真实 `frpc 0.51.0-sakura-14` 日志样本的解析、进程生命周期（假子进程）、PATH 解析，
  以及**随包 `bin\frpc.exe` 用真实 token/隧道 ID 实跑**：输出被解析出
  `frp-cup.com:34437`（`node scripts/test-live-tunnel.mjs`）。

未验证（需要真实浏览器/隧道，本环境起不了）：

- 真机扫码后的官方 SPA 行为（`/remote` 通道 + `ownsHost` 在真实浏览器里的表现）
  ——浏览器侧 `settingsScope`/`locale`/`slots` 的真实握手同样只做到契约核对。
- 真实 frpc 进程托管：日志触发地址解析 → 二维码切换（解析与生命周期都已逐一验证，
  只差“进程由插件在 dsh web 内拉起”这一步在本沙箱跑不了子进程）。
- 二维码在`--host 0.0.0.0` 或隧道下的实际可扫性。
- **侧边栏注入在真实 DOM 里的观感**（首位、同尺寸、搜索展开时一起收敛）、**暗色模式观感**、
  以及**面板里隧道表单的实际外观**：选择器/插入顺序/组件树都已断言，像素级效果需要你在
  浏览器里看一眼。本沙箱连 headless Edge 都起不来（crashpad 被拒），所以这一步只能由你完成。
- 设置表单的**写回**：宿主侧读到了命名空间与字段（真 provider 探针），浏览器侧的写路径
  （`settingsScope.set`）只做了契约核对；探针里的 provider 写入在临时 `DSH_HOME` 下已验证
  （给脚本一个临时 `DSH_HOME`，否则它读的、写的都是线上设置文档）。
- **访问密钥那一行在真实浏览器里的输入体验**：结构上已断言「草稿只属于输入框、提交走
  回车/失焦/保存/关面板、清除不会被失焦提交抢先」（`node scripts/test-client-render.mjs`），
  但“敲进去字不再被 React 还原”这件事只有真浏览器能最终确认——本沙箱起不了浏览器。
- **只读查看器在手机上的实际观感**：页面结构、内联脚本语法、围栏与越界拒绝都已断言，但
  「目录点开 → 预览渲染」的浏览器行为、以及长文件在窄屏上的滚动体验需要你用手机看一眼。
  另外 `/files` 是宿主路由，**插件更新后必须重启 `dsh web`** 才会注册（托盘菜单
  「重启 dsh web 服务」）；面板里那一行链接在刷新页面后就会出现。
- **重开路径在真机上的最后一跳**：`/` 的判决、它发的字节（同一份外壳 + 捕捉脚本 + 设备
  cookie）、以及抓不到外壳时的 502 都已断言，但“手机刷新一次就回来、且不再需要那条
  `?pair=` 原链接”这件事要你用手机确认。**`/` 是新增的宿主路由，改完必须重启 `dsh web`**
  （托盘菜单「重启 dsh web 服务」）；重启前刷新仍旧是 401。
