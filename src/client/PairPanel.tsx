/**
 * The remote-link panel: the pairing QR, the link, the expiry clock, the
 * device roster with revoke, and the tunnel/SakuraFrp status. Pure
 * presentation — every action arrives through props from the entry.
 *
 * Styling is a single injected stylesheet (see STYLE_ID) rather than CSS
 * modules: the plugin ships as one hand-maintained client bundle with no CSS
 * pipeline, and the panel is small enough that local class names in one
 * scoped sheet are easier to audit than a module graph.
 * @module dsh-remote-link/client/PairPanel
 */

import { createElement as h, type ReactElement } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { REMOTE_VIEWER_PATH } from '../remote-methods.ts'
import type { PairingPhase } from '../pairing.ts'
import { formatClock, formatLastSeen, type DeviceFrame, type PairStateFrame } from './pair-api.ts'
import { deviceNameFromUserAgent } from './device-name.ts'

/** The panel's view state, owned by the entry component. */
export type PanelState =
  | { kind: 'lan-required'; tunnel?: PairStateFrame['tunnel'] }
  | { kind: 'loopback-required' }
  | { kind: 'unreachable' }
  | {
      kind: 'ready'
      url: string
      token?: string
      expiresAt: number
      expired: boolean
      phase: PairingPhase
      deviceCount: number
      onlineCount: number
      devices: DeviceFrame[]
      /** The LAN literal the current QR was built from ('' for the public base). */
      address: string
      lanAddresses: string[]
      /** LAN literals that look like virtual/tunnel adapters (labelled in the picker). */
      lanVirtualAddresses?: string[]
      /** Whether this QR is built on the configured public (tunneled) base. */
      public: boolean
      publicBaseUrl?: string
      tunnel?: PairStateFrame['tunnel']
    }

/** Full panel props. */
export interface PairPanelProps {
  t: (key: string, params?: Record<string, unknown>) => string
  state: PanelState
  copied: boolean
  copiedToken: boolean
  /** Set once the read-only viewer URL was copied. */
  copiedViewer: boolean
  /**
   * The tunnel/policy form, injected by the entry (it owns the settings scope).
   * Rendered directly under the header, above the QR: turning the tunnel on is
   * what gives the QR link a public address, so it must not be buried.
   */
  settings?: ReactElement
  onClose(): void
  onStop(): void
  onRefresh(): void
  onCopy(url: string): void
  onCopyToken(token: string): void
  onCopyViewer(url: string): void
  onPickAddress(address: string): void
  onPickPublic(): void
  onRevoke(deviceId: string): void
}

/** Stylesheet id (one sheet per document, inserted at first panel mount). */
export const STYLE_ID = 'dsh-remote-link-styles'

/**
 * The panel stylesheet.
 *
 * Every colour is a harness theme token (`--dsw-alias-*`, owned by
 * `@deepseek-ai/dsh-client-ui-theme`) with an explicit fallback: the token
 * follows the active light/dark theme, the fallback keeps the panel legible on
 * a composition without ui-theme. No hard-coded surface colours — those are
 * what made the first version a white box in dark mode.
 */
export const STYLE_TEXT = `
.rl-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center}
.rl-mask{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-3,rgba(0,0,0,.45))}
.rl-panel{position:relative;z-index:1;width:min(440px,calc(100vw - 24px));max-height:calc(100vh - 48px);overflow:auto;
background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,inherit);
border:1px solid var(--dsw-alias-border-l3,#d8d8d8);border-radius:12px;padding:16px;
box-shadow:0 12px 40px var(--dsw-alias-bg-mask-drop,rgba(0,0,0,.28));font:inherit}
.rl-header{display:flex;align-items:flex-start;gap:12px}
.rl-heading{flex:1;min-width:0}
.rl-title{margin:0;font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}
.rl-subtitle{margin:2px 0 0;font-size:12px;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-close{border:0;background:transparent;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer;font-size:16px;
line-height:1;padding:4px;border-radius:6px}
.rl-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.18))}
.rl-banner{margin-top:12px;padding:10px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(180,120,0,.14));
border:1px solid var(--dsw-alias-border-l2,transparent);font-size:12px;line-height:1.6}
.rl-bannerTitle{margin:0;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}
.rl-bannerHint{margin:4px 0 0;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-card{margin-top:14px;padding:12px;border:1px solid var(--dsw-alias-border-l4,#d8d8d8);border-radius:10px;
background:var(--dsw-alias-bg-layer-2,transparent)}
.rl-cardHeader{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;
color:var(--dsw-alias-label-secondary,inherit)}
.rl-badges{display:flex;gap:6px;flex-wrap:wrap}
.rl-badge{padding:1px 8px;border-radius:999px;font-size:11px;background:var(--dsw-alias-bg-mask-2,rgba(127,127,127,.18));
color:var(--dsw-alias-label-secondary,inherit)}
.rl-badge-connected{background:var(--dsw-alias-state-business-primary,rgba(30,150,80,.85));
color:var(--dsw-alias-label-primary-foreground,#fff)}
.rl-badge-waiting{background:var(--dsw-alias-button-info-fill,rgba(40,120,220,.85));
color:var(--dsw-alias-label-primary-foreground,#fff)}
.rl-badge-stopped,.rl-badge-disconnected{background:var(--dsw-alias-state-error-primary,rgba(150,60,60,.85));
color:var(--dsw-alias-label-primary-foreground,#fff)}
.rl-qrWrap{display:flex;justify-content:center;padding:12px 0 6px}
/* 二维码必须始终白底深码：跟着暗色主题反色会导致扫不出来。 */
.rl-qr{background:#fff;padding:6px;border-radius:8px}
.rl-expiry{margin:0;text-align:center;font-size:12px;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-expired{margin:0;text-align:center;font-size:12px;color:var(--dsw-alias-state-error-primary,#c0392b)}
.rl-hint{margin:10px 0 0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-pairLinks{margin-top:8px;display:flex;flex-direction:column;gap:6px}
.rl-pairLinkRow{display:flex;align-items:center;gap:8px}
.rl-pairLinkText{flex:1;min-width:0}
.rl-pairLinkLabel{display:block;font-size:11px;color:var(--dsw-alias-label-caption,inherit)}
.rl-link{display:block;font-size:11px;word-break:break-all;color:var(--dsw-alias-label-secondary,inherit);
background:var(--dsw-alias-markdown-inline-code,rgba(127,127,127,.12));padding:2px 4px;border-radius:4px}
.rl-copyLink{flex:0 0 auto;font-size:12px;padding:4px 10px;border-radius:6px;
border:1px solid var(--dsw-alias-border-l3,#d8d8d8);background:var(--dsw-alias-button-elevated-fill,transparent);
color:var(--dsw-alias-label-primary,inherit);cursor:pointer}
.rl-copyLink:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.rl-note{margin:10px 0 0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-failed{margin:10px 0 0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary,#c0392b)}
.rl-addresses{margin:14px 0 0;padding:8px 10px;border:1px solid var(--dsw-alias-border-l4,#d8d8d8);
border-radius:8px;font-size:12px;color:var(--dsw-alias-label-secondary,inherit)}
.rl-addresses legend{padding:0 4px;font-size:11px;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-address{display:flex;align-items:center;gap:6px;padding:3px 0}
.rl-addressValue{font-size:11px;color:var(--dsw-alias-label-secondary,inherit)}
.rl-addressWarn{font-size:10px;color:var(--dsw-alias-state-error-primary,#c0392b);border:1px solid currentColor;
border-radius:4px;padding:0 4px;line-height:14px}
.rl-actions{display:flex;gap:8px;margin-top:14px}
.rl-action{flex:1;padding:7px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l3,#d8d8d8);
background:var(--dsw-alias-button-elevated-fill,transparent);color:var(--dsw-alias-label-primary,inherit);
cursor:pointer;font-size:12px}
.rl-action:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.rl-devices{margin-top:16px}
.rl-devicesTitle{margin:0 0 6px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,inherit)}
.rl-devicesEmpty{margin:0;font-size:12px;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-deviceList{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.rl-deviceRow{display:flex;align-items:center;gap:8px;font-size:12px}
.rl-deviceMeta{flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:6px;align-items:baseline}
.rl-deviceName{font-weight:600;color:var(--dsw-alias-label-primary,inherit)}
.rl-devicePresence{font-size:11px;color:var(--dsw-alias-label-secondary,inherit)}
.rl-deviceOnline{color:var(--dsw-alias-state-business-primary,#1e9650)}
.rl-deviceOffline{color:var(--dsw-alias-label-dimmed,inherit)}
.rl-deviceSeen{font-size:11px;color:var(--dsw-alias-label-caption,inherit)}
.rl-deviceRevoke{border:1px solid var(--dsw-alias-border-l3,#d8d8d8);background:var(--dsw-alias-button-elevated-fill,transparent);
color:var(--dsw-alias-label-secondary,inherit);border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer}
.rl-deviceRevoke:hover{background:var(--dsw-alias-interactive-bg-hover-danger,rgba(180,60,60,.16))}
/* 局域网绑定块：一级控件（不在高级折叠里），与隧道块同一套主题令牌。 */
.rl-lan{margin-top:14px;padding:12px;border:1px solid var(--dsw-alias-border-l4,#d8d8d8);border-radius:10px;
background:var(--dsw-alias-bg-layer-2,transparent);font-size:12px}
.rl-lanAddress{display:flex;align-items:center;gap:8px;margin-top:6px}
/* 隧道配置块：常显、紧跟标题，样式与上面的一致（全部走主题令牌）。 */
.rl-settings{margin-top:14px;padding:12px;border:1px solid var(--dsw-alias-border-l4,#d8d8d8);border-radius:10px;
background:var(--dsw-alias-bg-layer-2,transparent);font-size:12px}
.rl-settingsTitle{margin:0;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,inherit)}
.rl-settingsBody{border:0;margin:0;padding:0;min-width:0}
.rl-settingsBody:disabled{opacity:.6}
.rl-advanced{margin-top:10px;border-top:1px solid var(--dsw-alias-border-l4,#d8d8d8);padding-top:8px}
.rl-advanced summary{cursor:pointer;font-size:11px;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-field{display:flex;flex-direction:column;gap:3px;margin-top:8px}
.rl-field label{font-size:11px;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-field input{font:inherit;font-size:12px;padding:4px 6px;border-radius:6px;
border:1px solid var(--dsw-alias-border-l3,#d8d8d8);background:var(--dsw-alias-bg-layer-1,transparent);
color:var(--dsw-alias-label-primary,inherit)}
.rl-field input::placeholder{color:var(--dsw-alias-label-dimmed,inherit)}
.rl-field input:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#4b8bf5)}
/* 只写凭据行（访问密钥）：值不回显，所以草稿留在输入框里、靠按钮显式提交。 */
.rl-secretRow{display:flex;align-items:center;gap:6px;margin-top:3px}
.rl-secretRow input{flex:1;min-width:0}
.rl-secretAction{flex:0 0 auto;font:inherit;font-size:11px;padding:4px 8px;border-radius:6px;cursor:pointer;
border:1px solid var(--dsw-alias-border-l3,#d8d8d8);background:var(--dsw-alias-button-elevated-fill,transparent);
color:var(--dsw-alias-label-secondary,inherit)}
.rl-secretAction:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.rl-secretAction:disabled{cursor:default;opacity:.5}
.rl-secretSaved{color:var(--dsw-alias-state-business-primary,#1e9650)}
.rl-fieldRow{display:flex;align-items:center;gap:6px;margin-top:8px;color:var(--dsw-alias-label-secondary,inherit)}
.rl-fieldRow input{accent-color:var(--dsw-alias-brand-primary,#4b8bf5)}
.rl-trigger{border:0;background:transparent;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer;
padding:4px;border-radius:6px;line-height:0}
.rl-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.16))}
/* 注入到侧边栏「工作区」标题右侧动作区时的形态：与同排图标按钮同尺寸（28px 圆形）。 */
.rl-trigger-host{display:inline-flex;align-items:center;flex:none;max-width:28px;overflow:hidden;
transition:max-width .18s var(--ds-ease-in-out),opacity .12s var(--ds-ease-in-out)}
/*
 * 动作区自己带 max-width:60px + overflow:hidden，而 60px 正好只装得下原来的两个
 * 28px 图标（28 + 4 + 28）：多出第三个就会被裁掉最右边那个（文件夹/添加工作区）。
 * 所以插进这一行时，把容器的宽度上限一起放开——三个图标 28*3 + 4*2 = 92，留 96。
 * 类名由 installWorkspaceHeaderTrigger 挂上/摘掉，跟着注入走。
 */
[class*="_headerActions"].rl-header-actions{max-width:96px}
/* 该动作区在搜索框展开时会收缩（父级 class 变为 *Hidden）；宿主同步收敛，
   否则它会顶上搜索框、把那一行挤变形。 */
[class*="_headerActionsHidden"] .rl-trigger-host{max-width:0;opacity:0;pointer-events:none}
.rl-trigger-host .rl-trigger{width:28px;height:28px;padding:0;border-radius:50%;
display:inline-flex;align-items:center;justify-content:center}
.rl-trigger-host .rl-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.16))}
`

/**
 * Insert the panel stylesheet once per document.
 * @param doc - the target document (defaults to the current one).
 */
export function ensureStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID) !== null) return
  const style = doc.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLE_TEXT
  doc.head.appendChild(style)
}

/**
 * The read-only viewer's URL on the origin the QR link already uses (the
 * viewer's page path is fixed), or undefined when that link is unparsable.
 * @param state - the ready panel state.
 * @returns the absolute `/files` URL, or undefined.
 */
function viewerUrlOf(state: Extract<PanelState, { kind: 'ready' }>): string | undefined {
  try {
    return new URL(REMOTE_VIEWER_PATH, state.url).toString()
  } catch {
    return undefined
  }
}

/** Badge text + tone per phase (ready states only). */function statusOf(t: PairPanelProps['t'], state: Extract<PanelState, { kind: 'ready' }>): { text: string; tone: string } {
  switch (state.phase) {
    case 'connected': return { text: t('status.connected', { n: state.onlineCount }), tone: 'connected' }
    case 'disconnected': return { text: t('status.disconnected'), tone: 'disconnected' }
    case 'stopped': return { text: t('status.stopped'), tone: 'stopped' }
    case 'lan-required': return { text: t('status.lanRequired'), tone: 'stopped' }
    case 'waiting': return { text: t('status.waiting'), tone: 'waiting' }
  }
}

/** The tunnel status note (only when a managed tunnel exists and is not up). */
function tunnelNote(t: PairPanelProps['t'], tunnel: PairStateFrame['tunnel']): ReactElement | null {
  if (tunnel === undefined || tunnel.state === 'running') return null
  if (tunnel.state === 'failed') {
    return h('p', { className: 'rl-failed', role: 'status' }, t('tunnel.failed', { error: tunnel.error ?? t('tunnel.unknownError') }))
  }
  return h('p', { className: 'rl-note', role: 'status' }, t('tunnel.starting'))
}

/**
 * Render the pairing panel.
 * @param props - copy, state, and actions.
 * @returns the panel element tree.
 */
export function PairPanel(props: PairPanelProps): ReactElement {
  const { t, state } = props
  return h('div', { className: 'rl-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('title') },
    h('div', { className: 'rl-header' },
      h('div', { className: 'rl-heading' },
        h('h2', { className: 'rl-title' }, t('title')),
        h('p', { className: 'rl-subtitle' }, t('subtitle')),
      ),
      h('button', { type: 'button', className: 'rl-close', 'aria-label': t('close.label'), onClick: props.onClose }, '✕'),
    ),
    // 隧道配置紧跟标题：它是「二维码能不能给远程用」的唯一开关，
    // 不能藏在折叠区里（外层也刻意不折叠，只把 frpcPath 等冷门项收进“高级”）。
    props.settings ?? null,
    state.kind === 'lan-required'
      ? h('div', { className: 'rl-banner', role: 'alert' },
          h('p', { className: 'rl-bannerTitle' }, t('status.lanRequired')),
          h('p', { className: 'rl-bannerHint' }, t('status.lanRequiredHint')),
          tunnelNote(t, state.tunnel),
        )      : state.kind === 'loopback-required'
        ? h('div', { className: 'rl-banner', role: 'alert' },
            h('p', { className: 'rl-bannerTitle' }, t('status.loopbackRequired')),
            h('p', { className: 'rl-bannerHint' }, t('status.loopbackRequiredHint')),
          )
        : state.kind === 'unreachable'
          ? h('div', { className: 'rl-banner', role: 'alert' },
              h('p', { className: 'rl-bannerTitle' }, t('status.unreachable')),
              h('p', { className: 'rl-bannerHint' }, t('status.unreachableHint')),
            )
          : renderReady(props, state),
  )
}

/** The ready body (QR card, links, address picker, actions, roster). */
function renderReady(props: PairPanelProps, state: Extract<PanelState, { kind: 'ready' }>): ReactElement {
  const { t } = props
  const status = statusOf(t, state)
  const viewerUrl = viewerUrlOf(state)
  return h('div', null,
    h('div', { className: 'rl-card' },
      h('div', { className: 'rl-cardHeader' },
        h('span', { className: 'rl-cardTitle' }, t('card.title')),
        h('span', { className: 'rl-badges' },
          state.public ? h('span', { className: 'rl-badge' }, t('public.badge')) : null,
          h('span', { className: `rl-badge rl-badge-${status.tone}` }, status.text),
        ),
      ),
      h('div', { className: 'rl-qrWrap' },
        h(QRCodeSVG, { value: state.url, size: 184, level: 'M', marginSize: 1, className: 'rl-qr' }),
      ),
      state.expired
        ? h('p', { className: 'rl-expired' }, t('pair.expired'))
        : h('p', { className: 'rl-expiry' }, t('pair.expires', { time: formatClock(state.expiresAt) })),
    ),
    h('p', { className: 'rl-hint' }, state.public ? t('pair.publicHint') : t('pair.hint')),
    h('div', { className: 'rl-pairLinks' },
      h('div', { className: 'rl-pairLinkRow' },
        h('div', { className: 'rl-pairLinkText' },
          h('span', { className: 'rl-pairLinkLabel' }, t('pair.linkLabel')),
          h('code', { className: 'rl-link', title: state.url }, state.url),
        ),
        h('button', { type: 'button', className: 'rl-copyLink', onClick: () => { props.onCopy(state.url) } },
          props.copied ? t('action.copied') : t('action.copyLink')),
      ),
      state.token !== undefined && state.token !== ''
        ? h('div', { className: 'rl-pairLinkRow' },
            h('div', { className: 'rl-pairLinkText' },
              h('span', { className: 'rl-pairLinkLabel' }, t('pair.tokenLabel')),
              h('code', { className: 'rl-link', title: state.token }, state.token),
            ),
            h('button', { type: 'button', className: 'rl-copyLink', onClick: () => { props.onCopyToken(state.token ?? '') } },
              props.copiedToken ? t('action.copiedToken') : t('action.copyToken')),
          )
        : null,
      // The read-only viewer rides the same origin as the QR link, so a phone
      // that can open the pairing link can open `/files` — and nothing else.
      viewerUrl !== undefined
        ? h('div', { className: 'rl-pairLinkRow' },
            h('div', { className: 'rl-pairLinkText' },
              h('span', { className: 'rl-pairLinkLabel' }, t('viewer.label')),
              h('code', { className: 'rl-link', title: viewerUrl }, viewerUrl),
            ),
            h('button', { type: 'button', className: 'rl-copyLink', onClick: () => { props.onCopyViewer(viewerUrl) } },
              props.copiedViewer ? t('action.copied') : t('action.copyLink')),
          )
        : null,
    ),
    h('p', { className: 'rl-note' }, t('pair.oneTimeHint')),
    state.phase === 'stopped' ? h('p', { className: 'rl-note' }, t('stopped.hint')) : null,
    tunnelNote(t, state.tunnel),
    (state.publicBaseUrl !== undefined || state.lanAddresses.length > 1)
      ? h('fieldset', { className: 'rl-addresses' },
          h('legend', null, t('address.label')),
          state.publicBaseUrl !== undefined
            ? h('label', { className: 'rl-address', key: 'public' },
                h('input', {
                  type: 'radio',
                  name: 'rl-address',
                  checked: state.public,
                  onChange: () => { props.onPickPublic() },
                }),
                h('span', null, t('address.public')),
                h('code', { className: 'rl-addressValue' }, state.publicBaseUrl),
              )
            : null,
          ...state.lanAddresses.map(address => h('label', { className: 'rl-address', key: address },
            h('input', {
              type: 'radio',
              name: 'rl-address',
              checked: !state.public && address === state.address,
              onChange: () => { props.onPickAddress(address) },
            }),
            h('span', null, t('address.lan')),
            h('code', { className: 'rl-addressValue' }, address),
            // 虚拟网卡（Hyper-V/WSL/VPN）同样“Up、非 loopback”，却从局域网连不上：
            // 选它就是扫码连不上的常见原因，所以明确标出来。
            state.lanVirtualAddresses?.includes(address) === true
              ? h('span', { className: 'rl-addressWarn' }, t('address.virtual'))
              : null,
          )),
        )
      : null,
    h('div', { className: 'rl-actions' },
      h('button', { type: 'button', className: 'rl-action', onClick: props.onStop }, t('action.stop')),
      h('button', { type: 'button', className: 'rl-action', onClick: props.onRefresh }, t('action.refresh')),
    ),
    h('section', { className: 'rl-devices', 'aria-label': t('devices.title') },
      h('h3', { className: 'rl-devicesTitle' }, t('devices.title')),
      state.devices.length === 0
        ? h('p', { className: 'rl-devicesEmpty' }, t('devices.empty'))
        : h('ul', { className: 'rl-deviceList' },
            ...state.devices.map(device => h('li', { className: 'rl-deviceRow', key: device.id },
              h('div', { className: 'rl-deviceMeta' },
                h('span', { className: 'rl-deviceName' }, deviceNameFromUserAgent(device.userAgent) ?? t('devices.unknown')),
                h('span', { className: `rl-devicePresence ${device.online ? 'rl-deviceOnline' : 'rl-deviceOffline'}` },
                  device.online ? t('devices.online') : t('devices.offline')),
                h('span', { className: 'rl-deviceSeen' }, t('devices.lastSeen', { time: formatLastSeen(device.lastSeenAt) })),
              ),
              h('button', {
                type: 'button',
                className: 'rl-deviceRevoke',
                'aria-label': t('devices.revoke.label'),
                onClick: () => { props.onRevoke(device.id) },
              }, t('devices.revoke')),
            )),
          ),
    ),
  )
}
