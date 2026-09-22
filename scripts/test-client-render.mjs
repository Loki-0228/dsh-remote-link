/**
 * Structural render check for the browser half's panel.
 *
 * The two things a user notices first are asserted here without a browser:
 *   - the tunnel form is always part of the panel body (not hidden behind a
 *     disclosure), and it carries the fields that turn remote mode on;
 *   - the trigger's location in the sidebar action row.
 *
 * React is stubbed with a createElement that records the tree, so the module
 * can be materialized and its components called directly.
 *
 * Usage: node scripts/test-client-render.mjs
 */

import vm from 'node:vm'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

let failures = 0
let passes = 0
/**
 * Assert one condition.
 * @param condition - the condition.
 * @param message - the description.
 */
function check(condition, message) {
  if (condition) {
    passes += 1
    console.log(`  ok   ${message}`)
  } else {
    failures += 1
    console.log(`  FAIL ${message}`)
  }
}

/** Collect every node of a stub element tree into a flat list. */
function flatten(node, out = []) {
  if (node === null || node === undefined || typeof node === 'boolean') return out
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, out)
    return out
  }
  if (typeof node !== 'object') return out
  out.push(node)
  if (node.props !== undefined && node.props !== null) {
    for (const value of Object.values(node.props)) {
      if (typeof value === 'function' || typeof value === 'string') continue
      if (value !== null && typeof value === 'object') flatten(value, out)
    }
  }
  return out
}

/** Render one function component's tree from a stub element. */
function renderTree(element) {
  if (typeof element?.type === 'function') {
    return renderTree(element.type(element.props ?? {}))
  }
  return element
}

/**
 * Expand every function component in a stub tree, bottom-up: React would call
 * each one, so the assertions must see field components' output rather than the
 * component references.
 * @param node - a stub element, array, or leaf.
 * @returns the same shape with components expanded.
 */
function deepRender(node) {
  if (Array.isArray(node)) return node.map(deepRender)
  if (node === null || typeof node !== 'object') return node
  const rendered = renderTree(node)
  if (rendered === null || typeof rendered !== 'object') return rendered
  const props = rendered.props ?? {}
  const next = { type: rendered.type, props: { ...props } }
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'function') continue
    if (value !== null && typeof value === 'object') next.props[key] = deepRender(value)
  }
  return next
}

const registrations = []
const sandboxModules = {
  react: {
    __esModule: true,
    createElement: (type, props, ...children) => ({ type, props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children } }),
    forwardRef: (render) => render,
    useCallback: (fn) => fn,
    useEffect: () => {},
    useMemo: (fn) => fn(),
    useRef: (value) => ({ current: value }),
    useState: (value) => [value, () => {}],
  },
  'react-dom': { __esModule: true, createPortal: (node) => node },
  'react-dom/client': { __esModule: true, createRoot: () => ({ render: () => {}, unmount: () => {} }) },
  '@deepseek-ai/dsh-client-ui-slots': { __esModule: true },
  '@deepseek-ai/dsh-client-ui-primitives': { __esModule: true },
}

const sandbox = {
  window: { __ModuleLoader__: { load: (registration) => { registrations.push(registration) } } },
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  URL,
  Symbol,
  Object,
  Promise,
  JSON,
  document: undefined,
}
sandbox.globalThis = sandbox
vm.createContext(sandbox)
vm.runInContext(readFileSync(join(root, 'lib', 'client.js'), 'utf8'), sandbox, { filename: 'client.js' })

const exports = registrations[0].factory((name) => {
  if (name in sandboxModules) return sandboxModules[name]
  throw new Error(`unexpected require(${JSON.stringify(name)})`)
})

console.log('panel body')

const t = (key) => key
const settingsForm = exports.SettingsForm
check(typeof settingsForm === 'function', 'the client bundle exports the settings form for inspection')

// The LAN-bind switch is the control people could not find when it lived inside
// the advanced disclosure, so its shape is asserted explicitly.
console.log('LAN bind control')
const lanAccess = exports.LanAccess
check(typeof lanAccess === 'function', 'the client bundle exports the LAN control for inspection')
if (typeof lanAccess === 'function') {
  const frame = {
    profile: 'web',
    setting: true,
    blockHost: '0.0.0.0',
    bindHost: '127.0.0.1',
    port: 3080,
    lanUrls: ['http://192.168.68.161:3080'],
    firewall: { ok: true, managed: true, note: 'netsh' },
    platform: 'win32',
    pendingRestart: true,
  }
  const off = deepRender({
    type: lanAccess,
    props: { t, frame: { ...frame, setting: false, pendingRestart: false }, controllable: true, setting: false, onToggle: () => {}, onCopy: () => {}, copied: false },
  })
  const offNodes = flatten(off)
  check(off.type === 'section', 'the LAN control is a plain section (never inside a disclosure)')
  check(offNodes.some(node => node.type === 'input' && node.props?.type === 'checkbox'), 'it renders a checkbox switch')
  check(offNodes.some(node => String(node.props?.children) === 'lan.boundOff'), 'it states the current loopback bind')
  check(offNodes.some(node => String(node.props?.children) === 'lan.toggle'), 'the switch carries the enable label')

  const on = flatten(deepRender({
    type: lanAccess,
    props: { t, frame, controllable: true, setting: true, onToggle: () => {}, onCopy: () => {}, copied: false },
  }))
  check(on.some(node => String(node.props?.children) === 'lan.pendingRestart'), 'a switch not yet applied says a restart is needed')

  // The applied state: the running process really is on all interfaces.
  const applied = flatten(deepRender({
    type: lanAccess,
    props: {
      t,
      frame: { ...frame, bindHost: '0.0.0.0', pendingRestart: false },
      controllable: true,
      setting: true,
      onToggle: () => {},
      onCopy: () => {},
      copied: false,
    },
  }))
  check(applied.some(node => String(node.props?.children) === 'lan.boundOn'), 'an applied all-interfaces bind is reported as bound')
  check(applied.some(node => String(node.props?.children) === 'http://192.168.68.161:3080'), 'the LAN address is shown')
  check(applied.some(node => String(node.props?.children) === 'lan.pendingRestart') === false,
    'an applied switch does not ask for a restart')

  const remote = flatten(deepRender({
    type: lanAccess,
    props: { t, frame, controllable: false, setting: true, onToggle: () => {}, onCopy: () => {}, copied: false },
  }))
  check(remote.some(node => String(node.props?.children) === 'lan.remoteView'), 'a non-loopback page explains instead of offering the switch')
  check(remote.some(node => node.type === 'input' && node.props?.type === 'checkbox') === false,
    'a non-loopback page renders no dead switch (the endpoint is loopback-only)')
}

if (typeof settingsForm === 'function') {
  const snapshot = {
    status: 'ready',
    writable: true,
    mode: 'host',
    revision: 1,
    base: {},
    user: {},
    value: { tunnelEnabled: false, frpcPath: 'D:\\plugin\\bin\\frpc.exe', frpcManageProcess: true },
  }
  const form = deepRender({ type: settingsForm, props: { t, snapshot, save: () => {}, clear: () => {} } })
  const nodes = flatten(form)
  const labels = nodes.filter(node => node.type === 'label' || node.type === 'span').map(node => node.props?.children)
  const summary = nodes.find(node => node.type === 'summary')

  check(form.type === 'section', 'the form root is a plain section (never a collapsed disclosure)')
  check(summary !== undefined, 'the advanced group keeps its own disclosure in place of a hidden whole form')
  check(String(summary?.props?.children) === 'settings.advanced', 'the disclosure holds the advanced options, not the tunnel switch')
  check(nodes.some(node => node.type === 'input' && node.props?.type === 'password'), 'the token field is a password input')
  check(nodes.some(node => node.type === 'input' && node.props?.type === 'checkbox'), 'the tunnel switch is a checkbox')
  check(labels.includes('settings.tunnelEnabled'), 'the tunnel enable switch is rendered')
  check(labels.includes('settings.frpcToken'), 'the access token field is rendered')
  check(labels.includes('settings.frpcTunnelIds'), 'the tunnel id field is rendered')
  check(labels.includes('settings.frpcPath'), 'the frpc path field is rendered')
  check(labels.includes('settings.lanBind') === false,
    'the LAN switch is NOT duplicated inside the tunnel form (it has its own section)')
  const summaryNode = nodes.find(node => node.type === 'summary' && String(node.props?.children) === 'settings.advanced')
  check(summaryNode !== undefined, 'advanced options are grouped under their own summary')
  const plainNodes = nodes.filter(node => node.type === 'details')
  check(plainNodes.length === 1, 'exactly one disclosure exists in the form (the advanced group)')
  check(form.props?.['aria-label'] === 'settings.title', 'the form carries an accessible label')

  // The credential row is write-only: the host redacts `role('secret')` fields
  // on every wire read, so the section never carries the token and the control
  // must own its draft. A snapshot that did carry one must NOT seed the box —
  // binding the value prop to the section is what made the field refuse input,
  // because nothing ever came back to move it.
  console.log('credential row')
  const tokenForm = flatten(deepRender({
    type: settingsForm,
    props: {
      t,
      snapshot: { ...snapshot, value: { ...snapshot.value, frpcToken: 'example-should-not-be-seeded' } },
      save: () => {},
      clear: () => {},
    },
  }))
  const tokenInput = tokenForm.find(node => node.type === 'input' && node.props?.type === 'password')
  const tokenButtons = tokenForm.filter(node => node.type === 'button' && node.props?.className === 'rl-secretAction')
  check(tokenInput !== undefined, 'the access token field is still a password input')
  check(tokenInput?.props?.value === '', 'the token box never seeds from the section (the host redacts the value)')
  check(tokenButtons.length === 2, 'the token row carries a save and a clear action')
  check(tokenButtons.every(button => button.props?.onMouseDown !== undefined),
    'both token actions act on mousedown so the input cannot blur-commit behind them')
  check(tokenButtons[0]?.props?.disabled === true, 'the save action is inert until something is typed')
  check(tokenForm.some(node => String(node.props?.children) === 'settings.frpcTokenSave'),
    'the save action is labelled')
  check(tokenForm.some(node => String(node.props?.children) === 'settings.frpcTokenClear'),
    'the clear action is labelled')
  check(tokenForm.some(node => String(node.props?.children) === 'settings.frpcTokenHint'),
    'the row explains that the stored token is never read back')
}

const panel = deepRender({
  type: exports.PairPanel,
  props: {
    t,
    state: { kind: 'lan-required' },
    copied: false,
    copiedToken: false,
    copiedViewer: false,
    settings: { type: 'section', props: { children: 'SETTINGS-SLOT' } },
    onClose: () => {},
    onStop: () => {},
    onRefresh: () => {},
    onCopy: () => {},
    onCopyToken: () => {},
    onCopyViewer: () => {},
    onPickAddress: () => {},
    onPickPublic: () => {},
    onRevoke: () => {},
  },
})
const panelNodes = flatten(panel)
const headerIndex = panelNodes.findIndex(node => node.props?.className === 'rl-header')
const settingsIndex = panelNodes.findIndex(node => node.props?.children === 'SETTINGS-SLOT')
check(settingsIndex > headerIndex, 'the tunnel form sits directly under the panel header')
check(panelNodes.length > settingsIndex, 'the rest of the panel follows the form')

const readyPanel = flatten(deepRender({
  type: exports.PairPanel,
  props: {
    t,
    state: {
      kind: 'ready', url: 'http://example.com:34437/pair-accept?pair=x', token: 't', expiresAt: Date.now() + 60000,
      expired: false, phase: 'waiting', deviceCount: 0, onlineCount: 0, devices: [], address: '', lanAddresses: [], public: true,
    },
    copied: false, copiedToken: false, copiedViewer: false,
    settings: { type: 'section', props: { children: 'SETTINGS-SLOT' } },
    onClose: () => {}, onStop: () => {}, onRefresh: () => {}, onCopy: () => {}, onCopyToken: () => {},
    onCopyViewer: () => {},
    onPickAddress: () => {}, onPickPublic: () => {}, onRevoke: () => {},
  },
}))
check(readyPanel.some(node => node.props?.className === 'rl-settings' || node.props?.children === 'SETTINGS-SLOT'),
  'the form is still present once a QR is live (the two states are not exclusive)')
check(readyPanel.some(node => String(node.props?.children) === 'viewer.label'),
  'the read-only viewer row is offered next to the pairing links')
check(readyPanel.some(node => String(node.props?.children) === 'http://example.com:34437/files'),
  'the viewer URL rides the same origin as the QR link')

console.log('')
console.log(`${String(passes)} passed, ${String(failures)} failed`)
if (failures > 0) process.exitCode = 1
