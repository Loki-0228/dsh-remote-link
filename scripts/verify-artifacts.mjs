/**
 * Verify the two built artifacts without a running dsh host.
 *
 * - `lib/index.js` must import cleanly as Node ESM and export the cordis
 *   plugin face (`name` / `inject` / `Config` / `apply`).
 * - `lib/client.js` must be loadable in a bare browser-like global (no
 *   `require`, no `module`) and register exactly one lazy-CJS factory under
 *   this package's id; the factory must then materialize against a stubbed
 *   `require` and expose `apply` + `inject`.
 *
 * Run: node scripts/verify-artifacts.mjs
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const hostFile = join(root, 'lib', 'index.js')
const clientFile = join(root, 'lib', 'client.js')
const expectedId = '@loki-0228/dsh-remote-link'

const failures = []

/**
 * Assert one condition, recording a failure instead of throwing.
 * @param condition - the condition.
 * @param message - the failure message.
 */
function check(condition, message) {
  if (condition) {
    console.log(`  ok   ${message}`)
  } else {
    console.log(`  FAIL ${message}`)
    failures.push(message)
  }
}

console.log('host artifact (lib/index.js)')
const host = await import(`${new URL(`file:///${hostFile.replace(/\\/g, '/')}`).href}?t=${String(Date.now())}`)
check(typeof host.name === 'string' && host.name === 'remote-link', 'exports name = remote-link')
check(Array.isArray(host.inject) && host.inject.includes('webServer'), 'exports inject including webServer')
check(typeof host.apply === 'function', 'exports apply()')
check(typeof host.Config === 'function', 'exports the schemastery Config schema')
check(typeof host.defaultFrpcPath === 'function', 'exports defaultFrpcPath()')
check(typeof host.tunnelBaseUrl === 'function', 'exports tunnelBaseUrl()')
check(typeof host.pairingConfigOf === 'function', 'exports pairingConfigOf()')

// The schema must accept an empty section and apply its defaults.
const resolved = host.Config({})
check(resolved.tokenTtlMs === 600_000, 'schema default tokenTtlMs')
check(resolved.requirePairingForLan === true, 'schema default requirePairingForLan')
check(resolved.tunnelEnabled === false, 'schema default tunnelEnabled')
check(resolved.cookieName === 'dsh_remote_link', 'schema default cookieName')

console.log('client artifact (lib/client.js)')
const source = readFileSync(clientFile, 'utf8')
const registrations = []
const requireCalls = []
const stubModules = {
  react: {
    __esModule: true,
    createElement: (...args) => ({ type: args[0], props: args[1] }),
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

/**
 * Swap the sandbox's `document` (and `MutationObserver`) for one assertion
 * block. The client bundle resolves both from the sandbox globals at call time,
 * so mutating the sandbox is what the injected code actually observes — a
 * swap on this script's own `globalThis` is invisible to it.
 * @param sandbox - the vm sandbox holding the client module's globals.
 * @param fakeDocument - the document stand-in.
 * @returns the restoring disposer.
 */
function stubDocument(sandbox, fakeDocument) {
  const previousDocument = sandbox.document
  const previousObserver = sandbox.MutationObserver
  sandbox.document = fakeDocument
  sandbox.MutationObserver = class {
    observe() {}
    disconnect() {}
  }
  return () => {
    sandbox.document = previousDocument
    sandbox.MutationObserver = previousObserver
  }
}

const sandbox = {
  window: {
    __ModuleLoader__: { load: (registration) => { registrations.push(registration) } },
  },
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
  // Defined up front: the client module reads `document` at call time, so the
  // standalone guard and the header-placement helper both see this binding.
  document: undefined,
}
sandbox.globalThis = sandbox
vm.createContext(sandbox)
try {
  vm.runInContext(source, sandbox, { filename: 'client.js' })
  check(true, 'evaluates in a browser-like global with no bundler wrapper')
} catch (error) {
  check(false, `evaluates in a browser-like global (${String(error.message)})`)
}
check(registrations.length === 1, 'registers exactly one module factory')
const registration = registrations[0]
check(registration?.id === expectedId, `registers under ${expectedId}`)
check(typeof registration?.factory === 'function', 'factory is callable')

if (typeof registration?.factory === 'function') {
  const clientExports = registration.factory((name) => {
    requireCalls.push(name)
    if (name in stubModules) return stubModules[name]
    throw new Error(`unexpected require(${JSON.stringify(name)})`)
  })
  check(typeof clientExports.apply === 'function', 'factory exports apply()')
  check(Array.isArray(clientExports.inject) && clientExports.inject.includes('slots'), 'factory exports inject including slots')
  check(requireCalls.includes('react'), 'factory requires react from the module table')
  const unexpected = requireCalls.filter(name => !(name in stubModules))
  check(unexpected.length === 0, `every runtime require is a shell-provided module (${requireCalls.join(', ')})`)

  // The sidebar-header placement is pure DOM, so it is asserted here with a
  // minimal fake document: the selector must match the workspace browser's
  // action row (and skip its collapsed twin), the trigger must land FIRST, and
  // the row must be marked so the stylesheet can widen its 60px cap (three
  // 28px icons would otherwise clip the folder button).
  console.log('sidebar header placement')
  const makeEl = (className) => {
    const classes = new Set(className.split(/\s+/).filter(Boolean))
    const el = {
      className,
      firstElementChild: null,
      children: [],
      classList: {
        contains: (name) => classes.has(name),
        add: (name) => { classes.add(name); el.className = [...classes].join(' ') },
        remove: (name) => { classes.delete(name); el.className = [...classes].join(' ') },
      },
      insertBefore(node) { this.children.unshift(node); this.firstElementChild = node; return node },
    }
    return el
  }
  check(typeof clientExports.installWorkspaceHeaderTrigger === 'function', 'exports installWorkspaceHeaderTrigger()')

  const hidden = makeEl('bhn1Oq_headerActions bhn1Oq_headerActionsHidden')
  const visible = makeEl('bhn1Oq_headerActions')
  const host = makeEl('rl-trigger-host')
  const fakeDocument = {
    querySelector(selector) {
      if (selector.includes('_headerActionsHidden')) {
        // Mirrors the real :not([class*="_headerActionsHidden"]) selector.
        return [hidden, visible].find(el => !el.className.includes('_headerActionsHidden')) ?? null
      }
      return visible
    },
    body: {},
  }
  const restore = stubDocument(sandbox, fakeDocument)
  try {
    const dispose = clientExports.installWorkspaceHeaderTrigger(host)
    check(visible.children[0] === host, 'injects the trigger as the FIRST icon in the workspace action row')
    check(visible.children.includes(hidden) === false, 'never lands in the collapsed (hidden) action row')
    check(host.className.includes('rl-in-header'), 'adds the in-header marker class')
    check(visible.className.includes('rl-header-actions'), 'marks the action row so its width cap can widen')
    const stylesheet = clientExports.STYLE_TEXT ?? ''
    check(
      stylesheet.includes('.rl-header-actions{max-width:96px}'),
      'the stylesheet widens the marked row past the 60px cap (three 28px icons fit)',
    )
    check(typeof dispose === 'function', 'returns a disposer')
    dispose()
    const bareHost = makeEl('rl-trigger-host')
    stubDocument(sandbox, { querySelector: () => null, body: {} })
    const noop = clientExports.installWorkspaceHeaderTrigger(bareHost)
    check(typeof noop === 'function', 'degrades to a no-op when the action row is absent')
    noop()
    const nullDispose = clientExports.installWorkspaceHeaderTrigger(null)
    check(typeof nullDispose === 'function', 'tolerates a null host')
    nullDispose()
  } finally {
    restore()
  }
}

console.log('packaging')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
check(manifest.name === '@loki-0228/dsh-remote-link', 'package name matches the plugin id')
check(manifest.dsh?.bundle?.patch === './cordis.patch.yml', 'declares the profile patch (dsh.bundle.patch)')
check(manifest.dsh?.client?.platform === 'web', 'declares the browser half (dsh.client.platform = web)')
check(manifest.exports?.['.'] === './lib/index.js', 'exports the host half as the package root')
check(manifest.exports?.['./client'] === './lib/client.js', 'exports the browser half at ./client')
check(manifest.files?.includes('bin'), 'the package manifest ships the bin/ folder')

console.log('bundled tunnel client')
const bundledFrpc = join(root, 'bin', 'frpc.exe')
check(existsSync(bundledFrpc), 'bin/frpc.exe ships with the plugin')
if (existsSync(bundledFrpc)) {
  const size = readFileSync(bundledFrpc).length
  check(size > 5_000_000, `bin/frpc.exe looks like the real client (${String(size)} bytes)`)
}
check(host.defaultFrpcPath().endsWith(join('bin', 'frpc.exe')) || process.env.DSH_REMOTE_LINK_FRPC !== undefined,
  `defaultFrpcPath() resolves inside the package (${host.defaultFrpcPath()})`)
check(host.packageRoot().replace(/[\\/]+$/, '') === root.replace(/[\\/]+$/, ''),
  `packageRoot() is the package directory (${host.packageRoot()})`)
const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
check(patch.includes(`name: '${manifest.name}'`), 'the patch row names this package')
check(patch.includes('id: remote-link'), 'the patch row id is remote-link')
check(existsSync(join(root, 'lib', 'index.js')) && existsSync(join(root, 'lib', 'client.js')), 'both artifacts exist')

console.log('')
if (failures.length > 0) {
  console.log(`${String(failures.length)} check(s) failed`)
  process.exitCode = 1
} else {
  console.log('all artifact checks passed')
}
