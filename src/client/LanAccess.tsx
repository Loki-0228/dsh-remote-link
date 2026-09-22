/**
 * The 局域网绑定 control — the switch that decides whether `dsh web` accepts
 * connections from other devices, plus the facts needed to trust it:
 * what the running server is bound to right now, the address to type on the
 * phone, and whether the change still needs a restart.
 *
 * It is a first-class panel section (never inside the advanced disclosure):
 * without it the LAN exposure can only be changed by hand-editing the profile
 * patch, which is exactly what people could not find.
 *
 * Why a restart: the listening socket is fixed when `dsh web` starts, and the
 * harness derives its `/api` trust list from the bind at that same moment — so
 * flipping this writes the profile patch and the harness picks it up on the
 * next start. The panel says so instead of pretending the change is live.
 * @module dsh-remote-link/client/LanAccess
 */

import { createElement as h, type ReactElement } from 'react'
import type { LanBindFrame } from './pair-api.ts'

/** Props of the LAN-bind section. */
export interface LanAccessProps {
  t: (key: string, params?: Record<string, unknown>) => string
  /** The loopback-only status frame; undefined while loading or unreachable. */
  frame?: LanBindFrame
  /** Whether this page may change the bind (loopback control surface). */
  controllable: boolean
  /** The configured value (undefined = never flipped). */
  setting: boolean | undefined
  /** Writes the new value through the settings scope. */
  onToggle(next: boolean): void
  /** Copy one URL to the clipboard. */
  onCopy(url: string): void
  copied: boolean
}

/**
 * Render the 局域网绑定 section.
 * @param props - status frame, the toggle value, and the two callbacks.
 * @returns the section element tree.
 */
export function LanAccess({ t, frame, controllable, setting, onToggle, onCopy, copied }: LanAccessProps): ReactElement {
  const bound = frame?.bindHost === '0.0.0.0'
  const pending = frame?.pendingRestart === true
  const url = frame?.lanUrls?.[0]
  const firewallNote = frame?.firewall?.managed === true && frame.firewall.ok === false
    ? t('lan.firewallBlocked')
    : null

  const statusLine = !controllable
    ? t('lan.remoteView')
    : bound
      ? t('lan.boundOn', { port: frame?.port ?? '' })
      : t('lan.boundOff')

  return h('section', { className: 'rl-lan', 'aria-label': t('lan.title') },
    h('h3', { className: 'rl-settingsTitle' }, t('lan.title')),
    h('p', { className: 'rl-note' }, t('lan.subtitle')),
    controllable
      ? h('label', { className: 'rl-fieldRow' },
          h('input', {
            type: 'checkbox',
            checked: setting === true,
            onChange: (event: { target: { checked: boolean } }) => { onToggle(event.target.checked) },
          }),
          h('span', null, t('lan.toggle')),
        )
      : null,
    h('p', { className: 'rl-note', role: 'status' }, statusLine),
    bound && url !== undefined
      ? h('div', { className: 'rl-lanAddress' },
          h('code', { className: 'rl-link', title: url }, url),
          h('button', { type: 'button', className: 'rl-copyLink', onClick: () => { onCopy(url) } },
            copied ? t('action.copied') : t('action.copyLink')),
        )
      : null,
    pending
      ? h('p', { className: 'rl-failed', role: 'alert' }, t('lan.pendingRestart'))
      : null,
    firewallNote !== null ? h('p', { className: 'rl-failed', role: 'alert' }, firewallNote) : null,
  )
}
