/**
 * dsh-remote-link — browser half. Registers the sidebar pairing entry, the
 * pairing panel (QR + link + device roster + SakuraFrp settings), and the
 * remote-channel behavior: the same-origin rewrite that lets a browser opened
 * at a LAN or tunnel origin ride this plugin's gated `/remote` channel, the
 * pair boot flow (`?pair=<token>`), and presence heartbeats.
 *
 * Deliberately absent compared with the upstream remote-control plugin: the
 * portrait-touch ("mobile skin") adaptation, the presence pet link, the family
 * self-update surface, the relay UI, and anonymous telemetry.
 * @module dsh-remote-link/client
 */

import { createElement as h, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { PropsLocale, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  SettingsScope,
  SettingsScopeBinder,
  SettingsScopeSnapshot,
} from '@deepseek-ai/dsh-client-ui-settings/client'
import { PairPanel, ensureStyles, type PanelState } from './PairPanel.tsx'
import { SettingsForm, type RemoteLinkSettings } from './SettingsForm.tsx'
import { LanAccess } from './LanAccess.tsx'
import {
  canControlLanBind,
  copyText,
  issuePair,
  readLanBindStatus,
  revokePair,
  stopPair,
  type DeviceFrame,
  type IssueResponse,
  type LanBindFrame,
  type PairStateFrame,
} from './pair-api.ts'
import {
  channelTransition,
  installRemoteChannel,
  isLoopbackHostname,
  remoteChannelRequired,
  REMOTE_CHANNEL_BOOT_GLOBAL,
  type RemoteChannelBootSeat,
} from './remote-channel.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'remote-link'

/**
 * Re-exports for the build checks and for hosts that embed this panel
 * directly: the stylesheet text, and the two pure components (calling them
 * needs no browser, so their structure is asserted in CI).
 */
export { STYLE_TEXT, ensureStyles, PairPanel, type PanelState } from './PairPanel.tsx'
export { SettingsForm, type RemoteLinkSettings as RemoteLinkSettingsForm } from './SettingsForm.tsx'
export { LanAccess } from './LanAccess.tsx'

/** Settings namespace the panel edits (the host plugin registers it). */
const REMOTE_LINK_NS = 'remote-link'

/** Heartbeat cadence from a paired device (presence + revocation liveness). */
const HEARTBEAT_INTERVAL_MS = 10_000

/** sessionStorage marker for a failed pair accept. */
const PAIR_FAILED_MARKER = 'dsh-remote-link-pair-failed'

/** Services required by this plugin. */
export const inject = ['slots', 'locale', 'connection', 'settingsScope']

/** The host-authoritative pairing policy read by the channel decision. */
interface PairGatePolicy {
  requirePairingForLan: boolean
}

/** Minimal settings snapshot shape the channel decision consumes. */
interface ChannelSettingsSnapshot {
  status: string
  value?: { enabled?: boolean; requirePairingForLan?: boolean }
}

/** Chinese copy (the default locale). */
const zh: Record<string, string> = {
  'entry.label': '远程链接（扫码配对）',
  'title': '远程链接',
  'subtitle': '用另一台设备扫码或打开链接，即可进入同一个 Web GUI。',
  'close.label': '关闭',
  'status.lanRequired': '当前没有可用的访问地址',
  'status.lanRequiredHint': '请在设置里开启 SakuraFrp 隧道，或用 --host 0.0.0.0 允许局域网访问后重试。',
  'status.loopbackRequired': '请在桌面端（127.0.0.1）打开本面板',
  'status.loopbackRequiredHint': '配对属于本机控制面，只能从本机打开；远程设备请直接访问已配对链接。',
  'status.unreachable': '无法连接到 host',
  'status.unreachableHint': '请确认 dsh web 仍在运行，然后重试。',
  'status.connected': '已连接（{n} 台在线）',
  'status.disconnected': '设备已离线',
  'status.stopped': '已停止',
  'status.waiting': '等待扫码',
  'card.title': '配对二维码',
  'public.badge': '隧道',
  'pair.expired': '二维码已过期，点“刷新”生成新的。',
  'pair.expires': '有效期至 {time}',
  'pair.hint': '用手机扫上面的二维码，或直接打开下面这条链接。',
  'pair.publicHint': '这条链接走 SakuraFrp 隧道，手机在任意网络扫码即可远程进入；隧道地址就是上面二维码里的地址。',
  'pair.linkLabel': '访问链接',
  'pair.tokenLabel': '配对令牌',
  'viewer.label': '只读文件查看器',
  'pair.oneTimeHint': '一次只保留一个有效令牌；刷新二维码会让上一条链接立即失效。',
  'action.copyLink': '复制链接',
  'action.copied': '已复制',
  'action.copyToken': '复制令牌',
  'action.copiedToken': '已复制',
  'action.stop': '停止并撤销',
  'action.refresh': '刷新二维码',
  'stopped.hint': '远程访问已停止；点“刷新二维码”重新开启。',
  'devices.title': '已授权设备',
  'devices.empty': '暂无已配对设备。',
  'devices.unknown': '未知设备',
  'devices.online': '在线',
  'devices.offline': '离线',
  'devices.lastSeen': '最近活动 {time}',
  'devices.revoke': '撤销',
  'devices.revoke.label': '撤销该设备的访问',
  'address.label': '二维码使用的地址',
  'address.public': '隧道地址',
  'address.lan': '局域网',
  'address.virtual': '虚拟网卡，一般连不上',
  'lan.title': '局域网访问',
  'lan.subtitle': '关掉时只绑 127.0.0.1，局域网设备连不上。',
  'lan.toggle': '允许局域网设备连接（写配置，重启生效）',
  'lan.boundOn': '当前绑定: 所有网卡（0.0.0.0），端口 {port} —— 局域网可访问',
  'lan.boundOff': '当前绑定: 仅本机（127.0.0.1）—— 局域网不可访问',
  'lan.remoteView': '当前绑定: 所有网卡（你正从其它设备打开本页）',
  'lan.pendingRestart': '配置已改，重启 dsh web 后生效。',
  'lan.firewallBlocked': '防火墙缺该端口的放行规则（需管理员），局域网设备可能连不上。',
  'tunnel.starting': 'SakuraFrp 隧道启动中…',
  'tunnel.failed': 'SakuraFrp 隧道失败：{error}',
  'tunnel.unknownError': '未知错误',
  'settings.title': 'SakuraFrp 隧道',
  'settings.subtitle': '填密钥并开启：插件自动拉起 frpc，二维码改用公网地址。',
  'settings.tunnelEnabled': '开启隧道（远程模式）',
  'settings.frpcToken': '访问密钥',
  'settings.frpcTokenPlaceholder': 'token 或 token:隧道ID',
  'settings.frpcTokenHint': '只写不读：保存后不回显，留空不清除。',
  'settings.frpcTokenSave': '保存',
  'settings.frpcTokenClear': '清除',
  'settings.frpcTokenSaved': '已保存（不回显）',
  'settings.frpcTokenCleared': '已清除',
  'settings.frpcTunnelIds': '隧道 ID',
  'settings.frpcTunnelIdsHint': '逗号分隔；留空用 token 自带',
  'settings.frpcPath': 'frpc 路径',
  'settings.frpcPublicBaseUrl': '公网地址（兜底）',
  'settings.frpcPublicBaseUrlHint': '日志里解析不到地址时用',
  'settings.frpcManageProcess': '托管 frpc 进程',
  'settings.requirePairingForLan': '非本机访问需配对',
  'settings.lanBind': '允许局域网访问（写配置，重启生效）',
  'settings.hint': '密钥与隧道 ID 来自 natfrp.com。',
  'settings.advanced': '高级',
  'settings.hostPageHint': '其余项（令牌有效期、设备上限等）在 settings.yaml 的 remote-link 段。',
  'settings.loading': '读取设置…',
  'settings.unavailable': '远程页面不能改设置；请在桌面端（127.0.0.1）打开本面板。',
  'settings.readonly': '当前不接受设置写入。',
  'fence.title': '此设备尚未配对',
  'fence.body': '请用桌面端“远程链接”面板重新生成二维码并扫码；重新配对后本页即可正常使用。',
  'fence.retry': '重新载入',
  'pairFailed.title': '配对失败',
  'pairFailed.body': '链接可能已过期或被替换，请在桌面端刷新二维码后重试。',
  'pairFailed.close': '知道了',
}

/** English copy. */
const en: Record<string, string> = {
  'entry.label': 'Remote link (scan to pair)',
  'title': 'Remote link',
  'subtitle': 'Scan the code or open the link on another device to enter this same Web GUI.',
  'close.label': 'Close',
  'status.lanRequired': 'No reachable address yet',
  'status.lanRequiredHint': 'Turn the SakuraFrp tunnel on in settings, or start dsh web with --host 0.0.0.0 for LAN access.',
  'status.loopbackRequired': 'Open this panel on the desktop (127.0.0.1)',
  'status.loopbackRequiredHint': 'Pairing is a local control plane; remote devices use an already-paired link.',
  'status.unreachable': 'Cannot reach the host',
  'status.unreachableHint': 'Check that dsh web is still running, then retry.',
  'status.connected': 'Connected ({n} online)',
  'status.disconnected': 'Devices offline',
  'status.stopped': 'Stopped',
  'status.waiting': 'Waiting for a scan',
  'card.title': 'Pairing QR',
  'public.badge': 'Tunnel',
  'pair.expired': 'This QR expired — press Refresh for a new one.',
  'pair.expires': 'Valid until {time}',
  'pair.hint': 'Scan the code with a phone, or open the link below.',
  'pair.publicHint': 'This link rides the SakuraFrp tunnel, so any network can open it.',
  'pair.linkLabel': 'Link',
  'pair.tokenLabel': 'Pairing token',
  'viewer.label': 'Read-only file viewer',
  'pair.oneTimeHint': 'One token is live at a time; refreshing the QR invalidates the previous link.',
  'action.copyLink': 'Copy link',
  'action.copied': 'Copied',
  'action.copyToken': 'Copy token',
  'action.copiedToken': 'Copied',
  'action.stop': 'Stop and revoke',
  'action.refresh': 'Refresh QR',
  'stopped.hint': 'Remote access is stopped; press Refresh QR to re-arm it.',
  'devices.title': 'Authorized devices',
  'devices.empty': 'No paired device yet.',
  'devices.unknown': 'Unknown device',
  'devices.online': 'online',
  'devices.offline': 'offline',
  'devices.lastSeen': 'last seen {time}',
  'devices.revoke': 'Revoke',
  'devices.revoke.label': 'Revoke this device',
  'address.label': 'Address the QR uses',
  'address.public': 'Tunnel',
  'address.lan': 'LAN',
  'address.virtual': 'virtual adapter (usually unreachable)',
  'lan.title': 'LAN access',
  'lan.subtitle': 'Off binds 127.0.0.1 only — no LAN device can connect.',
  'lan.toggle': 'Allow LAN devices (writes config; restart applies it)',
  'lan.boundOn': 'Bound to: all interfaces (0.0.0.0), port {port} — reachable on the LAN',
  'lan.boundOff': 'Bound to: loopback only (127.0.0.1) — not reachable on the LAN',
  'lan.remoteView': 'Bound to: all interfaces (you opened this page from another device)',
  'lan.pendingRestart': 'Config changed — restart dsh web to apply it.',
  'lan.firewallBlocked': 'No firewall allow rule for this port yet (needs admin); LAN devices may fail to connect.',
  'tunnel.starting': 'SakuraFrp tunnel is starting…',
  'tunnel.failed': 'SakuraFrp tunnel failed: {error}',
  'tunnel.unknownError': 'unknown error',
  'settings.title': 'SakuraFrp tunnel',
  'settings.subtitle': 'Token in, tunnel on: frpc starts and the QR uses the public address.',
  'settings.tunnelEnabled': 'Enable tunnel (remote mode)',
  'settings.frpcToken': 'Access token',
  'settings.frpcTokenPlaceholder': 'token or token:tunnelId',
  'settings.frpcTokenHint': 'Write-only: never shown again; empty keeps it.',
  'settings.frpcTokenSave': 'Save',
  'settings.frpcTokenClear': 'Clear',
  'settings.frpcTokenSaved': 'Saved (not shown again)',
  'settings.frpcTokenCleared': 'Cleared',
  'settings.frpcTunnelIds': 'Tunnel id(s)',
  'settings.frpcTunnelIdsHint': 'comma-separated; empty uses the token',
  'settings.frpcPath': 'frpc path',
  'settings.frpcPublicBaseUrl': 'Public URL (fallback)',
  'settings.frpcPublicBaseUrlHint': 'used when the log has no address',
  'settings.frpcManageProcess': 'Manage the frpc process',
  'settings.requirePairingForLan': 'Non-local access needs pairing',
  'settings.lanBind': 'Allow LAN access (writes config; restart)',
  'settings.hint': 'Token and tunnel id come from natfrp.com.',
  'settings.advanced': 'Advanced',
  'settings.hostPageHint': 'Everything else (token lifetime, device cap, …) is in the remote-link section of settings.yaml.',
  'settings.loading': 'Reading settings…',
  'settings.unavailable': 'Remote pages cannot write settings — open this panel on the desktop (127.0.0.1).',
  'settings.readonly': 'Settings writes are refused right now.',
  'fence.title': 'This device is not paired',
  'fence.body': 'Open the Remote link panel on the desktop, refresh the QR, and scan again.',
  'fence.retry': 'Reload',
  'pairFailed.title': 'Pairing failed',
  'pairFailed.body': 'The link may have expired or been replaced. Refresh the QR on the desktop and try again.',
  'pairFailed.close': 'Dismiss',
}

/** Translate one key with `{name}` interpolation, falling back to the key. */
function translate(dict: Record<string, string>, key: string, params?: Record<string, unknown>): string {
  const template = dict[key] ?? en[key] ?? key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

/** The sidebar pairing trigger icon (an inline glyph: no icon import needed). */
function LinkGlyph({ size = 16 }: { size?: number }): ReactElement {
  return h('svg', { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
    h('path', {
      d: 'M6.4 9.6a3 3 0 0 1 0-4.2l1.4-1.4a3 3 0 0 1 4.2 4.2l-.7.7M9.6 6.4a3 3 0 0 1 0 4.2l-1.4 1.4a3 3 0 0 1-4.2-4.2l.7-.7',
      stroke: 'currentColor',
      'stroke-width': '1.5',
      'stroke-linecap': 'round',
    }),
  )
}

/** Owner share of the sidebar foot seat. */
type EntryProps = PropsLocale<typeof NS> & { wide: boolean }

/** The bottom-sheet style notice shown when the channel reports an unpaired device. */
function FenceNotice({ t, onRetry }: { t: TranslateNS<string>; onRetry(): void }): ReactElement {
  return h('div', { className: 'rl-overlay' },
    h('div', { className: 'rl-mask' }),
    h('div', { className: 'rl-panel', role: 'alertdialog' },
      h('h2', { className: 'rl-title' }, t('fence.title')),
      h('p', { className: 'rl-hint' }, t('fence.body')),
      h('div', { className: 'rl-actions' },
        h('button', { type: 'button', className: 'rl-action', onClick: onRetry }, t('fence.retry')),
      ),
    ),
  )
}

/**
 * The sidebar entry: the trigger plus the pairing panel portal. The bound
 * settings scope arrives as a prop (built by `apply` once the scope service is
 * resolved through the module-scope settings accessor because
 * not a scope: reading it lazily protects against the service mounting after
 * this entry first renders.
 */
function RemoteLinkEntry({ wide, t }: EntryProps): ReactElement {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<PanelState>({ kind: 'lan-required' })
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])
  const [copied, setCopied] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)
  const [copiedViewer, setCopiedViewer] = useState(false)
  const [lanBindFrame, setLanBindFrame] = useState<LanBindFrame | undefined>(undefined)
  const eventSource = useRef<EventSource | undefined>(undefined)
  const openSeq = useRef(0)
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const [scope, setScope] = useState<SettingsScope<RemoteLinkSettings> | undefined>(undefined)
  const [snapshot, setSnapshot] = useState<SettingsScopeSnapshot<RemoteLinkSettings> | undefined>(undefined)

  const closeEventSource = useCallback(() => {
    eventSource.current?.close()
    eventSource.current = undefined
  }, [])

  const mint = useCallback(async (address?: string): Promise<PanelState> => {
    let result: IssueResponse
    try {
      result = await issuePair(address)
    } catch {
      return { kind: 'unreachable' }
    }
    if (!result.ok) {
      if (result.code === 'forbidden') return { kind: 'loopback-required' }
      if (result.code === 'unknown-address') return { kind: 'unreachable' }
      return { kind: 'lan-required' }
    }
    const publicBaseUrl = result.publicBaseUrl
    return {
      kind: 'ready',
      url: result.url,
      token: result.token,
      expiresAt: result.expiresAt,
      expired: Date.now() > result.expiresAt,
      phase: 'waiting',
      deviceCount: 0,
      onlineCount: 0,
      devices: [] as DeviceFrame[],
      public: publicBaseUrl !== undefined && result.url.startsWith(publicBaseUrl),
      ...(publicBaseUrl !== undefined ? { publicBaseUrl } : {}),
      address: address ?? result.lanAddresses[0] ?? '',
      lanAddresses: result.lanAddresses,
      ...(result.lanVirtualAddresses !== undefined ? { lanVirtualAddresses: result.lanVirtualAddresses } : {}),
    }
  }, [])

  const openPanel = useCallback(async (): Promise<void> => {
    const seq = ++openSeq.current
    setOpen(true)
    const next = await mint()
    if (seq !== openSeq.current) return
    setState(next)
    if (next.kind !== 'ready' && next.kind !== 'lan-required') return
    const source = new EventSource('/api/pair/events')
    eventSource.current = source
    source.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data as string) as PairStateFrame
        if (frame.type !== 'state') return
        const previous = stateRef.current
        if (previous.kind === 'lan-required' && frame.tunnel?.state === 'running' && previous.tunnel?.state !== 'running') {
          void mint().then(setState)
          return
        }
        setState(currentState => mergeFrame(currentState, frame))
      } catch {
        // Malformed frames are dropped; the snapshot on open is authoritative.
      }
    }
  }, [mint])

  const closePanel = useCallback(() => {
    openSeq.current += 1
    closeEventSource()
    setOpen(false)
  }, [closeEventSource])

  // 局域网绑定的实时事实（只在回环控制面可读）：打开面板时读一次，切换开关后再读一次，
  // 这样面板能立刻告诉你「改完了，但还没生效，需要重启」。
  useEffect(() => {
    if (!open || !canControlLanBind()) return
    let cancelled = false
    void readLanBindStatus()
      .then((frame) => { if (!cancelled) setLanBindFrame(frame) })
      .catch(() => { if (!cancelled) setLanBindFrame(undefined) })
    return () => { cancelled = true }
  }, [open, snapshot?.value?.lanBind])

  const handleLanToggle = useCallback((next: boolean) => {
    void scope?.set('lanBind', next).catch(() => {})
  }, [scope])

  const handleCopyAddress = useCallback((url: string) => {
    void copyText(url).then((ok) => {
      if (!ok) return
      setCopiedAddress(true)
      window.setTimeout(() => { setCopiedAddress(false) }, 1500)
    })
  }, [])

  useEffect(() => {
    if (state.kind !== 'ready' || state.expired) return
    const delay = state.expiresAt - Date.now()
    if (delay <= 0) {
      setState(previous => previous.kind === 'ready' ? { ...previous, expired: true } : previous)
      return
    }
    const timer = window.setTimeout(() => {
      setState(previous => previous.kind === 'ready' ? { ...previous, expired: true } : previous)
    }, delay)
    return () => { window.clearTimeout(timer) }
  }, [state])

  useEffect(() => closeEventSource, [closeEventSource])

  // 把触发按钮搬进侧边栏「工作区」标题右侧的动作区（视图选项 / 添加工作区 那组图标），
  // 放在这组图标的最左侧。插槽体系没有这个位置，所以走 DOM 注入；注入失败时按钮
  // 留在侧边栏底部的原位置，功能不受影响。
  useEffect(() => installWorkspaceHeaderTrigger(triggerRef.current), [])

  // The settings namespace binding is resolved lazily through the module-scope
  // accessor: the client settings service mounts as its own plugin, which can
  // settle after this entry's first render.
  useEffect(() => {
    const bound = settingsScope()
    if (bound === undefined) return
    setScope(bound)
    const sync = (): void => { setSnapshot(bound.getSnapshot()) }
    sync()
    return bound.subscribe(sync)
  }, [open])

  const handleStop = useCallback(() => {
    void stopPair().catch(() => {})
    setState(previous => previous.kind === 'ready' ? { ...previous, phase: 'stopped', devices: [] } : previous)
  }, [])

  const handleRevoke = useCallback((deviceId: string) => {
    void revokePair(deviceId).catch(() => {})
    setState(previous => previous.kind === 'ready'
      ? { ...previous, devices: previous.devices.filter(device => device.id !== deviceId) }
      : previous)
  }, [])

  const handleCopy = useCallback((url: string) => {
    void copyText(url).then((ok) => {
      if (!ok) return
      setCopied(true)
      window.setTimeout(() => { setCopied(false) }, 1500)
    })
  }, [])

  const handleCopyToken = useCallback((token: string) => {
    void copyText(token).then((ok) => {
      if (!ok) return
      setCopiedToken(true)
      window.setTimeout(() => { setCopiedToken(false) }, 1500)
    })
  }, [])

  const handleCopyViewer = useCallback((url: string) => {
    void copyText(url).then((ok) => {
      if (!ok) return
      setCopiedViewer(true)
      window.setTimeout(() => { setCopiedViewer(false) }, 1500)
    })
  }, [])

  const localT = useMemo(() => (key: string, params?: Record<string, unknown>) => {
    try {
      return (t as unknown as (k: string, p?: Record<string, unknown>) => string)(key, params)
    } catch {
      return translate(zh, key, params)
    }
  }, [t])

  return h('div', null,
    h('div', { className: 'rl-trigger-host', ref: triggerRef, 'data-dsh-remote-link-trigger': '' },
      h('button', {
        type: 'button',
        className: 'rl-trigger',
        'aria-label': localT('entry.label'),
        'aria-expanded': open,
        title: localT('entry.label'),
        onClick: () => { void openPanel() },
      }, h(LinkGlyph, { size: 16 })),
    ),
    open
      ? createPortal(h('div', { className: 'rl-overlay' },
          h('div', { className: 'rl-mask', 'aria-hidden': 'true', onClick: closePanel }),
          h(PairPanel, {
            t: localT,
            state,
            copied,
            copiedToken,
            copiedViewer,
            // The LAN-bind control and the tunnel form ride the panel body
            // (directly under the header, above the QR): the LAN switch is a
            // first-class control — without it the exposure can only be changed
            // by editing the profile patch by hand — and the tunnel form owns
            // the settings scope, which lives here.
            settings: h('div', null,
              h(LanAccess, {
                t: localT,
                ...(lanBindFrame !== undefined ? { frame: lanBindFrame } : {}),
                controllable: canControlLanBind(),
                setting: snapshot?.value?.lanBind,
                onToggle: handleLanToggle,
                onCopy: handleCopyAddress,
                copied: copiedAddress,
              }),
              snapshot !== undefined
                ? h(SettingsForm, {
                    t: localT,
                    snapshot,
                    save: (field, value) => { void scope?.set(field, value).catch(() => {}) },
                    clear: (field) => { void scope?.unset(field).catch(() => {}) },
                  })
                : h('section', { className: 'rl-settings' },
                    h('h3', { className: 'rl-settingsTitle' }, localT('settings.title')),
                    h('p', { className: 'rl-note' }, localT('settings.loading')),
                  ),
            ),
            onClose: closePanel,
            onStop: handleStop,
            onRefresh: () => { void mint().then(setState) },
            onCopy: handleCopy,
            onCopyToken: handleCopyToken,
            onCopyViewer: handleCopyViewer,
            onPickAddress: (address: string) => { void mint(address).then(setState) },
            onPickPublic: () => { void mint().then(setState) },
            onRevoke: handleRevoke,
          }),
        ), document.body)
      : null,
  )
}

/**
 * The sidebar header action group: the container the workspace browser renders
 * around its view-options and add-workspace icon buttons, alongside the section
 * title 工作区. The leading hash of the CSS-module class is build-generated, so
 * the suffix is matched instead — and the active selector excludes the
 * collapsed variant the same class family carries while the search box opens.
 */
const HEADER_ACTIONS_ACTIVE_SELECTOR = '[class*="_headerActions"]:not([class*="_headerActionsHidden"])'
/**
 * Marker added to the action row while the trigger lives in it. The row ships
 * with `max-width:60px` — exactly the two icons it normally holds — and
 * `overflow:hidden`, so a third icon would be clipped away (the rightmost one,
 * the folder/add-workspace button). The class lets the stylesheet widen the cap.
 */
const HEADER_ACTIONS_CLASS = 'rl-header-actions'

/**
 * Move the pairing trigger into the sidebar's header action row — as the FIRST
 * icon, left of the view-options and add-workspace buttons — and keep it there
 * across the sidebar's re-renders.
 *
 * The trigger is React-owned where it renders (inside the footer slot); this
 * only relocates that DOM node, so re-renders mutate it in place and the click
 * handler, aria state and portal keep working. If the header row never appears
 * (a different sidebar composition, or the workspace browser collapsed), the
 * node stays in the footer and the button simply remains reachable there.
 *
 * @param host - the trigger host element rendered by the footer slot.
 * @returns a disposer that stops observing and clears the row marker.
 */
export function installWorkspaceHeaderTrigger(host: HTMLElement | null): () => void {
  if (host === null || typeof document === 'undefined') return () => {}
  let observer: MutationObserver | undefined
  let claimed: Element | null = null

  const place = (): void => {
    const target = document.querySelector(HEADER_ACTIONS_ACTIVE_SELECTOR)
    if (target === null) return
    if (claimed !== null && claimed !== target) claimed.classList.remove(HEADER_ACTIONS_CLASS)
    // Already first here: nothing to do. This also stops the observer from
    // looping on the mutation this function itself just made.
    if (target.firstElementChild !== host || !host.classList.contains('rl-in-header')) {
      target.insertBefore(host, target.firstChild)
      host.classList.add('rl-in-header')
    }
    if (!target.classList.contains(HEADER_ACTIONS_CLASS)) target.classList.add(HEADER_ACTIONS_CLASS)
    claimed = target
  }

  place()
  observer = new MutationObserver(() => { place() })
  try {
    observer.observe(document.body, { childList: true, subtree: true })
  } catch {
    observer = undefined
  }
  return () => {
    // Only the observation stops: React still owns the node (removing it would
    // strip a node React believes it rendered) and the browser drops it when
    // the entry unmounts. The row marker is dropped so the row returns to its
    // own width cap.
    try { observer?.disconnect() } catch { /* already gone */ }
    try { claimed?.classList.remove(HEADER_ACTIONS_CLASS) } catch { /* already gone */ }
    claimed = null
  }
}

/** Merge one status frame onto the current panel state. */
function mergeFrame(state: PanelState, frame: PairStateFrame): PanelState {  if (state.kind === 'lan-required') {
    return { ...state, ...(frame.tunnel !== undefined ? { tunnel: frame.tunnel } : {}) }
  }
  if (state.kind !== 'ready') return state
  return {
    ...state,
    phase: frame.phase,
    deviceCount: frame.deviceCount,
    onlineCount: frame.onlineCount,
    devices: frame.devices ?? [],
    ...(frame.tunnel !== undefined ? { tunnel: frame.tunnel } : {}),
  }
}

/**
 * The module-scope settings accessor. The harness mounts client plugins
 * through the vendored loader, which hands `apply` its context; keeping the
 * bound scope here lets the slot component read it without threading the
 * context through the slot props contract.
 */
let settingsScope: () => SettingsScope<RemoteLinkSettings> | undefined = () => undefined

/** The pair boot flow: `?pair=<token>` → accept → reload. */
function runPairBootFlow(): void {
  const url = new URL(window.location.href)
  const token = url.searchParams.get('pair')
  if (token === null || token === '') return
  void (async () => {
    let ok = false
    try {
      const response = await fetch('/api/pair/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      ok = response.ok
    } catch {
      ok = false
    }
    if (!ok) {
      try { sessionStorage.setItem(PAIR_FAILED_MARKER, 'failed') } catch { /* private mode */ }
    }
    url.searchParams.delete('pair')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    if (ok) window.location.reload()
  })()
}

/** Register the remote-link surface. */
export function apply(ctx: ClientContext): void {
  if (typeof document !== 'undefined') ensureStyles(document)

  ctx.effect(() => {
    try {
      return (ctx.locale as unknown as {
        register(ns: string, dicts: Record<string, Record<string, string>>): () => void
      }).register(NS, { zh, en })
    } catch {
      return () => {}
    }
  }, 'dsh-remote-link: dictionaries')

  const t = (() => {
    try {
      return (ctx.locale as unknown as { bind(ns: string): TranslateNS<string> }).bind(NS)
    } catch {
      return ((key: string, params?: Record<string, unknown>) => translate(zh, key, params)) as TranslateNS<string>
    }
  })()

  // The settings scope is bound once and reused by the entry: the service is a
  // binder (`bind({ namespace })` → scope), and it can mount after this apply
  // ran, so binding happens lazily and the result is memoized.
  let boundScope: SettingsScope<RemoteLinkSettings> | undefined
  settingsScope = (): SettingsScope<RemoteLinkSettings> | undefined => {
    if (boundScope !== undefined) return boundScope
    const binder = (ctx.get('settingsScope') ?? ctx.get('webUiSettings')) as SettingsScopeBinder | undefined
    if (binder === undefined || typeof binder.bind !== 'function') return undefined
    try {
      boundScope = binder.bind<RemoteLinkSettings>({ namespace: REMOTE_LINK_NS })
    } catch {
      boundScope = undefined
    }
    return boundScope
  }

  // Pair boot flow + presence heartbeats. Loopback pages never heartbeat (the
  // desktop is the host); the server ignores unpaired heartbeats anyway.
  ctx.effect(() => {
    const connection = ctx.get('connection') as { isLoopback?: boolean } | undefined
    const loopback = connection?.isLoopback ?? isLoopbackHostname(window.location.hostname)
    runPairBootFlow()
    if (loopback) return () => {}
    const timer = window.setInterval(() => {
      void fetch('/api/pair/heartbeat', { method: 'POST' }).catch(() => {})
    }, HEARTBEAT_INTERVAL_MS)
    return () => { window.clearInterval(timer) }
  }, 'dsh-remote-link: pair flow + heartbeats')

  // The gated channel: on a non-loopback origin the connection plugin's /api
  // fence refuses this browser, and pairing is the access control — so the
  // same-origin traffic is rewritten onto the plugin's gated /remote prefix.
  let disposeChannel: (() => void) | undefined
  let hostPairingPolicy: boolean | undefined
  let unpairedWhilePolicyPending = false
  let fenceNotice: { unmount(): void } | undefined
  const showFenceNotice = (): void => {
    if (fenceNotice !== undefined) return
    const node = document.createElement('div')
    document.body.appendChild(node)
    const root = createRoot(node)
    root.render(h(FenceNotice, { t, onRetry: () => { window.location.reload() } }))
    fenceNotice = { unmount: () => { root.unmount(); node.remove() } }
  }
  const hideFenceNotice = (): void => {
    fenceNotice?.unmount()
    fenceNotice = undefined
  }
  const handleUnpaired = (): void => {
    if (hostPairingPolicy === undefined && settingsStatus() !== 'ready') {
      unpairedWhilePolicyPending = true
      return
    }
    showFenceNotice()
  }
  const settingsStatus = (): string => {
    const scope = ctx.get('settingsScope') as { getSnapshot?(): { status: string; value?: ChannelSettingsSnapshot['value'] } } | undefined
    return scope?.getSnapshot?.().status ?? 'unavailable'
  }
  const settingsValue = (): ChannelSettingsSnapshot['value'] => {
    const scope = ctx.get('settingsScope') as { getSnapshot?(): { value?: ChannelSettingsSnapshot['value'] } } | undefined
    return scope?.getSnapshot?.().value
  }
  const channelActive = (): boolean => remoteChannelRequired(
    window.location.hostname,
    { status: settingsStatus(), ...(settingsValue() !== undefined ? { value: settingsValue() } : {}) },
    hostPairingPolicy,
  )
  const bootSeat = (): RemoteChannelBootSeat | undefined =>
    (window as unknown as Record<string, RemoteChannelBootSeat | undefined>)[REMOTE_CHANNEL_BOOT_GLOBAL]
  const syncChannel = (): void => {
    const transition = channelTransition(channelActive(), disposeChannel !== undefined)
    if (transition === 'install') {
      const seat = bootSeat()
      if (seat !== undefined) {
        seat.onUnpaired = handleUnpaired
        seat.onPaired = hideFenceNotice
        if (seat.pendingUnpaired) {
          seat.pendingUnpaired = false
          handleUnpaired()
        }
        disposeChannel = ctx.effect(() => () => {
          seat.onUnpaired = null
          seat.onPaired = null
        }, 'dsh-remote-link: remote channel (boot patch)')
      } else {
        disposeChannel = ctx.effect(
          () => installRemoteChannel(window, { onUnpaired: handleUnpaired, onPaired: hideFenceNotice }),
          'dsh-remote-link: remote channel',
        )
      }
    } else if (transition === 'retire' && disposeChannel !== undefined) {
      disposeChannel()
      disposeChannel = undefined
      bootSeat()?.restore()
      hideFenceNotice()
    } else if (transition === 'none' && !channelActive()) {
      bootSeat()?.restore()
    }
  }
  syncChannel()
  // The channel decision must follow live settings: the settings mirror is
  // async, so re-evaluate whenever the namespace commits.
  try {
    const scope = ctx.get('settingsScope') as { subscribe?(listener: () => void): () => void } | undefined
    scope?.subscribe?.(syncChannel)
  } catch {
    // Settings scope unavailable: the initial decision stands.
  }
  if (!isLoopbackHostname(window.location.hostname) && settingsStatus() !== 'ready') {
    void fetch('/api/pair/status')
      .then(async response => {
        const body = await response.json() as Partial<PairGatePolicy>
        return body
      })
      .then((policy) => {
        hostPairingPolicy = policy.requirePairingForLan
        syncChannel()
        if (hostPairingPolicy && unpairedWhilePolicyPending) showFenceNotice()
        unpairedWhilePolicyPending = false
      })
      .catch(() => {
        hostPairingPolicy = true
        syncChannel()
        if (unpairedWhilePolicyPending) showFenceNotice()
        unpairedWhilePolicyPending = false
      })
  }

  // Sidebar foot entry beside the settings trigger.
  ctx.slots.inject('sidebar.footer.action', () => {
    try {
      return ctx.slots.register({ name: 'sidebar.footer.action', id: 'remote-link', locale: NS }, RemoteLinkEntry)
    } catch {
      return () => {}
    }
  })

  // One-time failed-pair notice: the accept round trip settles after the page
  // scripted its reload, so the marker is checked on the next load.
  ctx.effect(() => {
    const timer = window.setTimeout(() => {
      let marker: string | null = null
      try { marker = sessionStorage.getItem(PAIR_FAILED_MARKER) } catch { marker = null }
      if (marker === null) return
      try { sessionStorage.removeItem(PAIR_FAILED_MARKER) } catch { /* private mode */ }
      const node = document.createElement('div')
      document.body.appendChild(node)
      const root = createRoot(node)
      root.render(h('div', { className: 'rl-overlay' },
        h('div', { className: 'rl-mask' }),
        h('div', { className: 'rl-panel', role: 'alertdialog' },
          h('h2', { className: 'rl-title' }, t('pairFailed.title')),
          h('p', { className: 'rl-hint' }, t('pairFailed.body')),
          h('div', { className: 'rl-actions' },
            h('button', { type: 'button', className: 'rl-action', onClick: () => { root.unmount(); node.remove() } }, t('pairFailed.close')),
          ),
        ),
      ))
    }, 1500)
    return () => { window.clearTimeout(timer) }
  }, 'dsh-remote-link: failed-pair notice')
}
