/**
 * The remote-link settings form: the SakuraFrp tunnel fields and the pairing
 * policy switches for the same `remote-link` namespace the host plugin
 * registers, edited in place from the pairing panel.
 *
 * The panel is the only settings surface this namespace has: the shared
 * Settings → Plugins tab dispatches `settings.plugin.item` by namespace, and an
 * unclaimed namespace renders nothing there, so this compact form is not a
 * convenience over another editor — it is the editor. The tunnel fields
 * therefore have to be complete and, above all, writable.
 *
 * Writes ride the settings scope (`set`/`unset` per field), so a committed
 * field lands in the host document and the host re-reads it live.
 *
 * `frpcToken` is the one field whose value can never be read back: the host
 * declares it `role('secret')`, and every wire read goes through
 * `redactSecrets`, so the browser section carries no token at all. An input
 * bound to the snapshot value renders empty forever and — because each
 * keystroke was written and nothing came back to move the value prop — React
 * reset the box on every character, so the field accepted no input. The
 * credential row below keeps its own draft and commits it explicitly instead.
 * @module dsh-remote-link/client/SettingsForm
 */

import { createElement as h, useEffect, useRef, useState, type ReactElement } from 'react'
import type { SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'

/** The settings section this form edits (mirrors the host schema). */
export interface RemoteLinkSettings {
  enabled?: boolean
  requirePairingForLan?: boolean
  tunnelEnabled?: boolean
  /** Write-only: the host redacts it on every wire read, so it never arrives. */
  frpcToken?: string
  frpcTunnelIds?: string
  frpcPath?: string
  frpcManageProcess?: boolean
  frpcPublicBaseUrl?: string
  publicBaseUrl?: string
  tokenTtlMs?: number
  maxDevices?: number
  lanBind?: boolean
}

/** One field row. */
interface FieldProps {
  label: string
  value: string
  placeholder?: string
  onChange(value: string): void
}

/** A single text field, bound to the section value it echoes back. */
function Field({ label, value, placeholder, onChange }: FieldProps): ReactElement {
  return h('div', { className: 'rl-field' },
    h('label', null, label),
    h('input', {
      type: 'text',
      value,
      ...(placeholder !== undefined ? { placeholder } : {}),
      onChange: (event: { target: { value: string } }) => { onChange(event.target.value) },
    }),
  )
}

/** One boolean row. */
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(value: boolean): void }): ReactElement {
  return h('label', { className: 'rl-fieldRow' },
    h('input', {
      type: 'checkbox',
      checked,
      onChange: (event: { target: { checked: boolean } }) => { onChange(event.target.checked) },
    }),
    h('span', null, label),
  )
}

/** Props of the write-only credential row. */
interface SecretFieldProps {
  label: string
  placeholder?: string
  /** Shown while nothing has been typed (what the control stores, and how). */
  hint: string
  /** Shown after a save — the stored value never comes back, so this is the only receipt. */
  savedNote: string
  /** Shown after a clear. */
  clearedNote: string
  saveLabel: string
  clearLabel: string
  disabled: boolean
  /** Store one committed value (empty strings never reach here). */
  onSave(value: string): void
  /** Drop the stored value so the field re-inherits the composition layer. */
  onClear(): void
}

/**
 * The write-only credential row: a local draft that is committed explicitly.
 *
 * The section cannot carry the value back (see the module note), so the draft
 * is the only place the text lives. It commits on Enter, on blur, on the save
 * button, and — because the panel can be closed mid-edit — when the component
 * unmounts. A blank draft writes nothing, which is what keeps the stored token;
 * removing it takes the explicit clear button.
 * @param props - the row's copy, its disabled state, and the two write sinks.
 * @returns the labelled credential row.
 */
function SecretField(props: SecretFieldProps): ReactElement {
  const [draft, setDraft] = useState('')
  const [note, setNote] = useState<'idle' | 'saved' | 'cleared'>('idle')
  // Read by the unmount flush: the newest pending text and the newest sink.
  const pending = useRef('')
  const sink = useRef(props.onSave)
  sink.current = props.onSave

  useEffect(() => () => {
    const text = pending.current.trim()
    if (text !== '') sink.current(text)
  }, [])

  const commit = (): void => {
    const text = draft.trim()
    if (text === '') return
    pending.current = ''
    setDraft('')
    setNote('saved')
    props.onSave(text)
  }
  const drop = (): void => {
    pending.current = ''
    setDraft('')
    setNote('cleared')
    props.onClear()
  }
  // Both buttons act on mousedown-with-default-prevented so the input never
  // blurs first: otherwise a click on clear would commit the draft on its way
  // out and write the token it is about to remove.
  const hold = { onMouseDown: (event: { preventDefault?(): void }) => { event.preventDefault?.() } }
  const noteText = note === 'saved' ? props.savedNote : note === 'cleared' ? props.clearedNote : props.hint
  return h('div', { className: 'rl-field' },
    h('label', null, props.label),
    h('div', { className: 'rl-secretRow' },
      h('input', {
        type: 'password',
        value: draft,
        autoComplete: 'off',
        ...(props.placeholder !== undefined ? { placeholder: props.placeholder } : {}),
        disabled: props.disabled,
        onChange: (event: { target: { value: string } }) => {
          pending.current = event.target.value
          setNote('idle')
          setDraft(event.target.value)
        },
        onBlur: () => { commit() },
        onKeyDown: (event: { key?: string }) => { if (event.key === 'Enter') commit() },
      }),
      h('button', {
        ...hold,
        type: 'button',
        className: 'rl-secretAction',
        disabled: props.disabled || draft.trim() === '',
        onClick: () => { commit() },
      }, props.saveLabel),
      h('button', {
        ...hold,
        type: 'button',
        className: 'rl-secretAction',
        disabled: props.disabled,
        onClick: () => { drop() },
      }, props.clearLabel),
    ),
    h('p', { className: note === 'saved' ? 'rl-note rl-secretSaved' : 'rl-note', role: 'status' }, noteText),
  )
}

/** Props of the settings form. */
export interface SettingsFormProps {
  t: (key: string, params?: Record<string, unknown>) => string
  snapshot: SettingsScopeSnapshot<RemoteLinkSettings>
  /** Write one field (undefined = field absent, '' = explicit empty). */
  save(field: string, value: unknown): void
  /** Clear one field so it re-inherits the default. */
  clear(field: string): void
}

/**
 * Render the tunnel + policy form.
 *
 * Always visible near the top of the panel (never behind a collapsed
 * disclosure): without these fields the tunnel can never be turned on, and the
 * QR link then has no public address to hand a phone.
 * @param props - copy, the namespace snapshot, and the two write sinks.
 * @returns the form element tree.
 */
export function SettingsForm({ t, snapshot, save, clear }: SettingsFormProps): ReactElement {
  const value = snapshot.value ?? {}
  const disabled = snapshot.status !== 'ready' || !snapshot.writable
  const text = (field: keyof RemoteLinkSettings): string => {
    const raw = value[field]
    return typeof raw === 'string' ? raw : typeof raw === 'number' ? String(raw) : ''
  }
  const write = (field: keyof RemoteLinkSettings, next: string): void => {
    if (next === '') clear(field)
    else save(field, next)
  }
  return h('section', { className: 'rl-settings', 'aria-label': t('settings.title') },
    h('h3', { className: 'rl-settingsTitle' }, t('settings.title')),
    h('p', { className: 'rl-note' }, t('settings.subtitle')),
    snapshot.status !== 'ready'
      ? h('p', { className: 'rl-note' }, t('settings.unavailable'))
      : null,
    !snapshot.writable && snapshot.status === 'ready'
      ? h('p', { className: 'rl-note' }, t('settings.readonly'))
      : null,
    h('fieldset', { disabled, className: 'rl-settingsBody' },
      h(Toggle, {
        label: t('settings.tunnelEnabled'),
        checked: value.tunnelEnabled === true,
        onChange: (next) => { save('tunnelEnabled', next) },
      }),
      h(SecretField, {
        label: t('settings.frpcToken'),
        placeholder: t('settings.frpcTokenPlaceholder'),
        hint: t('settings.frpcTokenHint'),
        savedNote: t('settings.frpcTokenSaved'),
        clearedNote: t('settings.frpcTokenCleared'),
        saveLabel: t('settings.frpcTokenSave'),
        clearLabel: t('settings.frpcTokenClear'),
        disabled,
        onSave: (next) => { save('frpcToken', next) },
        onClear: () => { clear('frpcToken') },
      }),
      h(Field, {
        label: t('settings.frpcTunnelIds'),
        value: text('frpcTunnelIds'),
        placeholder: t('settings.frpcTunnelIdsHint'),
        onChange: (next) => { write('frpcTunnelIds', next.trim()) },
      }),
      h(Field, {
        label: t('settings.frpcPublicBaseUrl'),
        value: text('frpcPublicBaseUrl'),
        placeholder: 'http://example.com:12345',
        onChange: (next) => { write('frpcPublicBaseUrl', next.trim()) },
      }),
      h('details', { className: 'rl-advanced' },
        h('summary', null, t('settings.advanced')),
        h(Field, {
          label: t('settings.frpcPath'),
          value: text('frpcPath'),
          placeholder: '<插件>/bin/frpc.exe',
          onChange: (next) => { write('frpcPath', next.trim()) },
        }),
        h(Toggle, {
          label: t('settings.frpcManageProcess'),
          checked: value.frpcManageProcess !== false,
          onChange: (next) => { save('frpcManageProcess', next) },
        }),
        h(Toggle, {
          label: t('settings.requirePairingForLan'),
          checked: value.requirePairingForLan !== false,
          onChange: (next) => { save('requirePairingForLan', next) },
        }),
        // The panel is the only settings surface this namespace has (no card
        // claims it on Settings → Plugins), so the namespaces this form does
        // not show (token lifetime, device cap, trusted hosts, …) are named
        // with the document that holds them rather than a page that is empty.
        h('p', { className: 'rl-note' }, t('settings.hostPageHint')),
      ),
    ),
    h('p', { className: 'rl-note' }, t('settings.hint')),
  )
}
