/**
 * Remote-link channel constants — the shared vocabulary of the host half, the
 * browser half, and the parse-time boot patch.
 *
 * The gated mirror lives at `/remote`: every same-origin path the paired
 * remote browser rewrites there is re-issued to 127.0.0.1 by the host half, so
 * sibling plugin loopback fences (and the connection plugin's `/api`) accept
 * the request without a `--trusted-host` entry.
 * @module dsh-remote-link/remote-methods
 */

/** Gated mirror of same-origin fenced paths (`/remote` + original pathname). */
export const REMOTE_PREFIX = '/remote'

/**
 * The read-only file viewer's page. Its own top-level route (not under
 * `/remote`): the page is served to the remote device directly, like the
 * pairing entry pages, and the endpoints it reads are gated by the same
 * paired-device credential.
 */
export const REMOTE_VIEWER_PATH = '/files'

/** Connection-plugin method prefix under the gated channel. */
export const REMOTE_API_PREFIX = `${REMOTE_PREFIX}/api`

/**
 * The gated mirror of the one persistent client stream socket (the Typert
 * gateway mux). Every Remote stream rides it, so it must never be missing
 * from the rewrite tables: an unrewritten mux dies at the connection fence
 * and the remote UI shows an empty workspace.
 */
export const REMOTE_API_PATHS = {
  mux: `${REMOTE_API_PREFIX}/remote.mux`,
} as const

/**
 * Exact upgrade paths registered on the web server (upgrades match by exact
 * path, not prefix). Query strings ride on the request URL.
 */
export const REMOTE_UPGRADE_PATHS = [
  REMOTE_API_PATHS.mux,
  `${REMOTE_PREFIX}/sidebar/ws/terminal`,
  `${REMOTE_PREFIX}/sidebar/ws/agent-terminals`,
  `${REMOTE_API_PREFIX}/dsh-ssh/terminal`,
] as const

/** Plugin-manager HTTP prefix: install/remove stay physically local. */
export const PLUGIN_MANAGER_PATH = '/api/plugin-manager'

/** Family settings-bridge HTTP prefix (kept local, same plane as SDK settings). */
export const WEB_UI_SETTINGS_BRIDGE_PATH = '/api/dsh-web-ui-settings'

/**
 * The cookieless device credential. `/pair-app` captures the device id into
 * sessionStorage; the boot patch attaches it to gated fetches as this header
 * and to WebSocket/EventSource handshakes as the `device` query parameter
 * (handshakes cannot carry headers from the Web API). The pairing cookie
 * remains the primary credential on normal browsers.
 */
export const REMOTE_DEVICE_HEADER = 'x-dsh-remote-device'
export const REMOTE_DEVICE_QUERY = 'device'

/** sessionStorage key holding the device credential. */
export const REMOTE_DEVICE_STORAGE_KEY = 'dsh-remote-device'

/**
 * Path prefixes that stay physically local even for a paired device: the
 * control plane of the link itself, the self-update installer, and plugin
 * install/remove. Everything else (chat, sessions, settings, credentials,
 * presets, deliverables) rides the gated channel — a paired device is a
 * full-control credential by design.
 */
export const LOCAL_ONLY_PREFIXES: readonly string[] = [
  '/api/pair',
  '/api/update',
  '/api/native-notifications',
  '/api/remote-notifications',
  PLUGIN_MANAGER_PATH,
] as const

/**
 * Whether a paired inner path must stay physically local.
 * @param innerPath - the rewritten inner path (e.g. `/api/session.list`).
 * @returns a denial message, or undefined when the path may be proxied.
 */
export function localOnlyDenial(innerPath: string): string | undefined {
  for (const prefix of LOCAL_ONLY_PREFIXES) {
    if (innerPath === prefix || innerPath.startsWith(`${prefix}/`)) {
      return `${prefix.slice(1)} stays physically local and stays unreachable from a paired remote device`
    }
  }
  return undefined
}

/** The window global the parse-time boot patch publishes its seat under. */
export const REMOTE_CHANNEL_BOOT_GLOBAL = '__DSH_REMOTE_LINK_BOOT__'

/** The seat the parse-time boot patch installs (see remote-channel-boot.ts). */
export interface RemoteChannelBootSeat {
  onUnpaired: (() => void) | null
  onPaired: (() => void) | null
  pendingUnpaired: boolean
  restore(): void
}

/** Every decision input of the remote-channel rewrite (JSON-serializable). */
export interface RemoteChannelRules {
  readonly remotePrefix: string
  readonly apiPrefix: string
  readonly pairPrefix: string
  readonly updatePrefix: string
  readonly settingsBridgePrefix: string
  readonly sidebarPrefix: string
  readonly gitPrefix: string
  readonly wsPaths: readonly string[]
  readonly deviceHeader: string
  readonly deviceKey: string
  readonly deviceQuery: string
}

/**
 * The live rule set: one table both the browser patch and the parse-time boot
 * patch read, so the two can never drift apart.
 */
export const REMOTE_CHANNEL_RULES: RemoteChannelRules = {
  remotePrefix: REMOTE_PREFIX,
  apiPrefix: '/api/',
  pairPrefix: '/api/pair/',
  updatePrefix: '/api/update/',
  settingsBridgePrefix: WEB_UI_SETTINGS_BRIDGE_PATH,
  sidebarPrefix: '/sidebar/',
  gitPrefix: '/git/',
  wsPaths: [
    '/api/remote.mux',
    '/sidebar/ws/terminal',
    '/sidebar/ws/agent-terminals',
    '/api/dsh-ssh/terminal',
  ],
  deviceHeader: REMOTE_DEVICE_HEADER,
  deviceKey: REMOTE_DEVICE_STORAGE_KEY,
  deviceQuery: REMOTE_DEVICE_QUERY,
}
