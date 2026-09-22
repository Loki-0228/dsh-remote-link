/**
 * dsh-remote-link — host half. One package, one plugin row: it mounts the
 * pairing service (one-time token, device sessions, revocation), the
 * `/api/pair` route family with its phone-facing entry pages, the presence
 * sweep, the gated `/remote` channel that carries a remote desktop's traffic
 * to loopback, and the optional SakuraFrp tunnel that gives the QR link a
 * public address.
 *
 * Deliberately absent compared with the upstream remote-control plugin: the
 * portrait-touch ("mobile skin") adaptation layer, telemetry, the self-update
 * surface, the stable-origin relay registry, and the Cloudflare tunnel. What
 * remains is the pairing link itself.
 * @module dsh-remote-link
 */

import { join } from 'node:path'
import { setInterval as nodeSetInterval } from 'node:timers'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import Schema from 'schemastery'
import { dshHome } from './dsh-home.ts'
import { PairingService, DEFAULT_IDLE_EXPIRE_MS, type PairingConfig } from './pairing.ts'
import { makeGateListener, isPairedDeviceRequest } from './gate.ts'
import { makeRoutes } from './routes.ts'
import { makeRemoteApiRoutes, makeRemoteApiUpgradeRoutes } from './remote-api.ts'
import { makePairingAccess } from './pairing-access.ts'
import { createInnerAuth } from './inner-auth.ts'
import { lanIPv4Addresses, whenDefaultRouteKnown } from './lan.ts'
import { ensureFirewallRule, firewallSummary, removeFirewallRule } from './firewall.ts'
import { lanBindState, writeLanBind } from './lan-bind.ts'
import {
  desiredBindHost,
  firewallActionNeeded,
  pendingRestartOf,
  type AppliedFirewallState,
  type StartupFacts,
} from './lan-bind-plan.ts'
import { DEFAULT_TUNNEL_CONFIG, FrpcTunnel, splitToken, type TunnelInfo } from './frpc-tunnel.ts'
import { REMOTE_CHANNEL_BOOT_SCRIPT } from './remote-channel-boot.ts'
import { UUID_POLYFILL_SCRIPT } from './uuid-polyfill.ts'
import { VIEWER_PATHS, viewerRoots, type ViewerContext } from './file-viewer.ts'

/** Stable cordis plugin name. */
export const name = 'remote-link'

/** Services required before the pairing surfaces can mount. */
export const inject = ['webServer', 'typertGateway', 'connection']

/**
 * Settings namespace of the remote-link capability — the section the web
 * settings surface edits and the browser half binds to.
 */
export const REMOTE_LINK_SETTINGS_NAMESPACE = 'remote-link'

/** Plugin config, validated by the same-named schemastery schema. */
export interface Config {
  /** Token lifetime in ms; the QR link dies after this. */
  tokenTtlMs?: number
  /** A device is "online" while its lastSeenAt is newer than this (ms). */
  offlineAfterMs?: number
  /** Hard cap on paired device sessions (oldest evicted when full). */
  maxDevices?: number
  /** Idle sessions older than this (ms) are deleted on sweep. */
  idleExpireMs?: number
  /** Cookie name carrying the paired device id. */
  cookieName?: string
  /**
   * When true (default), a browser opened at a non-loopback origin (LAN
   * address or public tunnel) rides the gated `/remote` channel and must
   * carry a live paired-device cookie. Set false to leave the desktop on
   * plain `/api` (only useful when that origin is already trusted).
   */
  requirePairingForLan?: boolean
  /**
   * Public base URL of a tunnel in front of this server when it is NOT
   * managed by this plugin (e.g. a SakuraFrp HTTP tunnel mapped to your own
   * domain, or any reverse proxy). When set, the QR link is built from it and
   * its host is trusted by the phone-facing fence. Ignored while the managed
   * SakuraFrp tunnel below is active.
   */
  publicBaseUrl?: string
  /** Extra trusted host authorities (exact `host:port`, or port-less `host`). */
  trustedHosts?: string[]
  /** Absolute path of the paired-device JSON store. */
  devicesFile?: string
  /** Master switch for the plugin. */
  enabled?: boolean
  /**
   * Whether the paired-device cookie gates the `/remote` channel. Leaves with
   * `requirePairingForLan`; kept as a separate knob for a LAN-only deployment
   * that still wants a public QR.
   */
  tunnelEnabled?: boolean
  /**
   * SakuraFrp access token ("访问密钥"). Either the bare token or the
   * combined `<token>:<tunnelId[,tunnelId]>` form that `frpc-token.txt` uses.
   * Stored redacted by the settings surface.
   */
  frpcToken?: string
  /**
   * SakuraFrp tunnel ids to run, comma-separated. Empty runs whatever the
   * token's own configuration carries (the `frpc -f <token>` form).
   */
  frpcTunnelIds?: string
  /**
   * Path to the SakuraFrp client (`frpc.exe`). A bare name is resolved from
   * PATH. The default is the copy this package ships under `bin/`, so the
   * tunnel client travels with the plugin; point it elsewhere for your own.
   */
  frpcPath?: string
  /**
   * Start the frpc process together with `dsh web` and tear it down on exit.
   * Turn off when frpc is managed by something else (a service manager) and
   * only the address matters here.
   */
  frpcManageProcess?: boolean
  /**
   * Local port the tunnel forwards to. Informational: frpc's own tunnel
   * configuration owns the real target.
   */
  frpcLocalPort?: number
  /**
   * Public base URL override, used when frpc's log cannot be parsed (a
   * dashboard-configured domain, or a tunnel whose address line is missing).
   */
  frpcPublicBaseUrl?: string
  /** LAN bind toggle; undefined until the user flips it once. */
  lanBind?: boolean
  /** Profile whose cordis.patch.yml the LAN bind toggle manages. */
  profile?: string
}

/** The schemastery schema the settings surface renders. */
export const Config: Schema<Config> = Schema.object({
  tokenTtlMs: Schema.number().step(1).min(60_000).default(10 * 60_000),
  offlineAfterMs: Schema.number().step(1).min(5_000).default(25_000),
  maxDevices: Schema.number().step(1).min(1).max(64).default(4),
  idleExpireMs: Schema.number().step(1).min(60_000).default(DEFAULT_IDLE_EXPIRE_MS),
  cookieName: Schema.string().min(1).default('dsh_remote_link'),
  requirePairingForLan: Schema.boolean().default(true),
  publicBaseUrl: Schema.string(),
  trustedHosts: Schema.array(Schema.string()),
  devicesFile: Schema.string(),
  enabled: Schema.boolean().default(true),
  tunnelEnabled: Schema.boolean().default(false),
  frpcToken: Schema.string().role('secret'),
  frpcTunnelIds: Schema.string(),
  frpcPath: Schema.string().default(defaultFrpcPath()),
  frpcManageProcess: Schema.boolean().default(true),
  frpcLocalPort: Schema.number().step(1).min(1).max(65_535).default(3080),
  frpcPublicBaseUrl: Schema.string(),
  lanBind: Schema.boolean(),
  profile: Schema.string().pattern(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
})

/** Presence sweep cadence (a stale device flips to disconnected within two sweeps). */
const SWEEP_INTERVAL_MS = 10_000

/** How long the /pair-app shell is reused before re-fetching (it is static). */
const APP_SHELL_TTL_MS = 30_000

/**
 * The bundled frpc location: this package ships the SakuraFrp client under
 * `bin/`, so the plugin is self-contained — installing the plugin installs the
 * tunnel client with it. `DSH_REMOTE_LINK_FRPC` overrides for deployments that
 * keep their own copy elsewhere.
 */
export function defaultFrpcPath(): string {
  return process.env.DSH_REMOTE_LINK_FRPC ?? join(packageRoot(), 'bin', 'frpc.exe')
}

/**
 * The directory this package was loaded from. `import.meta.url` points at the
 * bundled `lib/index.js` (the build keeps the entry path), so the package root
 * is one level up; the fallback covers a source-mode load.
 */
export function packageRoot(): string {
  try {
    return fileURLToPath(new URL('..', import.meta.url))
  } catch {
    return process.cwd()
  }
}

/** The default paired-session store: `$DSH_HOME/dsh-remote-link-devices.json`. */
export function defaultDevicesFile(home: string = dshHome()): string {
  return join(home, 'dsh-remote-link-devices.json')
}

/** Fully resolved config (schema defaults applied). */
interface ResolvedConfig {
  tokenTtlMs: number
  offlineAfterMs: number
  maxDevices: number
  idleExpireMs: number
  cookieName: string
  requirePairingForLan: boolean
  publicBaseUrl: string | undefined
  trustedHosts: string[] | undefined
  devicesFile: string
  enabled: boolean
  tunnelEnabled: boolean
  frpcToken: string | undefined
  frpcTunnelIds: string
  frpcPath: string
  frpcManageProcess: boolean
  frpcLocalPort: number
  frpcPublicBaseUrl: string | undefined
  lanBind: boolean | undefined
  profile: string
}

/** Schema defaults, re-read for hand-built contexts. */
const DEFAULTS: ResolvedConfig = {
  tokenTtlMs: 10 * 60_000,
  offlineAfterMs: 25_000,
  maxDevices: 4,
  idleExpireMs: DEFAULT_IDLE_EXPIRE_MS,
  cookieName: 'dsh_remote_link',
  requirePairingForLan: true,
  publicBaseUrl: undefined,
  trustedHosts: undefined,
  devicesFile: defaultDevicesFile(),
  enabled: true,
  tunnelEnabled: false,
  frpcToken: undefined,
  frpcTunnelIds: '',
  frpcPath: defaultFrpcPath(),
  frpcManageProcess: true,
  frpcLocalPort: 3080,
  frpcPublicBaseUrl: undefined,
  lanBind: undefined,
  profile: process.env.DSH_PROFILE ?? 'web',
}

/** The single mapping from resolved config to the pairing service config. */
export function pairingConfigOf(resolved: Pick<
  ResolvedConfig,
  'tokenTtlMs' | 'offlineAfterMs' | 'maxDevices' | 'idleExpireMs' | 'cookieName' | 'devicesFile'
>): PairingConfig {
  return {
    tokenTtlMs: resolved.tokenTtlMs,
    offlineAfterMs: resolved.offlineAfterMs,
    maxDevices: resolved.maxDevices,
    idleExpireMs: resolved.idleExpireMs,
    cookieName: resolved.cookieName,
    devicesFile: resolved.devicesFile,
  }
}

/** Whether a configured value is a usable http(s) base URL. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * The public base a tunnel frame advertises: the tunnel's own parsed address
 * wins (it is what a phone can actually reach), the configured override is the
 * fallback.
 * @param info - the current tunnel frame.
 * @param override - the configured `frpcPublicBaseUrl`.
 * @returns the base URL without a trailing slash, or undefined.
 */
export function tunnelBaseUrl(info: TunnelInfo, override: string | undefined): string | undefined {
  const fromLog = info.phase === 'running' && info.url !== undefined && isHttpUrl(info.url) ? info.url : undefined
  const manual = override !== undefined && override !== '' && isHttpUrl(override) ? override : undefined
  const chosen = fromLog ?? manual
  return chosen?.replace(/\/+$/, '')
}

/**
 * Mount the pairing service, its routes, the gated channel, the sweep, and the
 * SakuraFrp tunnel.
 * @param ctx - host plugin context carrying webServer.
 * @param config - resolved plugin config (schema defaults applied by the loader).
 */
export function apply(ctx: Context, config?: Config): void {
  const envPublicBase = process.env.DSH_REMOTE_LINK_PUBLIC_BASE_URL?.trim() || undefined
  let current: () => Config = () => config ?? {}
  const resolve = (): ResolvedConfig => {
    const value = current()
    return {
      tokenTtlMs: value.tokenTtlMs ?? DEFAULTS.tokenTtlMs,
      offlineAfterMs: value.offlineAfterMs ?? DEFAULTS.offlineAfterMs,
      maxDevices: value.maxDevices ?? DEFAULTS.maxDevices,
      idleExpireMs: value.idleExpireMs ?? DEFAULTS.idleExpireMs,
      cookieName: value.cookieName ?? DEFAULTS.cookieName,
      requirePairingForLan: value.requirePairingForLan ?? DEFAULTS.requirePairingForLan,
      publicBaseUrl: value.publicBaseUrl ?? envPublicBase,
      trustedHosts: value.trustedHosts,
      devicesFile: value.devicesFile ?? DEFAULTS.devicesFile,
      enabled: value.enabled ?? DEFAULTS.enabled,
      tunnelEnabled: value.tunnelEnabled ?? DEFAULTS.tunnelEnabled,
      frpcToken: value.frpcToken,
      frpcTunnelIds: value.frpcTunnelIds ?? DEFAULTS.frpcTunnelIds,
      frpcPath: value.frpcPath ?? DEFAULTS.frpcPath,
      frpcManageProcess: value.frpcManageProcess ?? DEFAULTS.frpcManageProcess,
      frpcLocalPort: value.frpcLocalPort ?? DEFAULTS.frpcLocalPort,
      frpcPublicBaseUrl: value.frpcPublicBaseUrl,
      lanBind: value.lanBind,
      profile: value.profile ?? process.env.DSH_PROFILE ?? DEFAULTS.profile,
    }
  }

  const service = new PairingService(pairingConfigOf(resolve()))

  // ── SakuraFrp tunnel ────────────────────────────────────────────────────
  // The managed tunnel owns the public base while it runs: the phase listener
  // pushes the parsed address into the pairing service, which the QR builder
  // and the phone-facing fence both read. No harness configuration is touched
  // (a distributable plugin must not rewrite the connection plugin).
  let tunnelMode: 'off' | 'managed' | 'manual' = 'off'
  const tunnel = new FrpcTunnel((info: TunnelInfo) => {
    if (tunnelMode !== 'managed') return
    if (info.phase === 'running') {
      service.setTunnelStatus({ state: 'running', ...(info.url !== undefined ? { url: info.url } : {}) })
    } else if (info.phase === 'starting') {
      service.setTunnelStatus({ state: 'starting' })
    } else if (info.phase === 'failed') {
      service.setTunnelStatus(info.error === undefined ? { state: 'failed' } : { state: 'failed', error: info.error })
    } else {
      service.setTunnelStatus(undefined)
    }
    service.setPublicBaseUrl(tunnelBaseUrl(info, resolve().frpcPublicBaseUrl))
  }, DEFAULT_TUNNEL_CONFIG)
  ctx.effect(() => () => { tunnel.dispose() }, 'dsh-remote-link: sakurafrp tunnel')

  // ── bind facts ──────────────────────────────────────────────────────────
  // webServer is an inject edge, so the bind is known by now. A recompose pass
  // can hand a not-yet-settled server (host unset, port undefined); deriving
  // LAN bases from that would advertise `:undefined` links.
  let lastKnownPort: number | undefined
  const bindKnown = (ctx.webServer.host === '0.0.0.0' || ctx.webServer.host === '127.0.0.1')
    && Number.isFinite(ctx.webServer.port)
  /**
   * Publish the LAN bases, best candidate first. Ordering matters: the QR link
   * defaults to the FIRST entry, and an all-interfaces bind exposes adapters a
   * phone cannot reach (WSL/Hyper-V/virtual switches), so the ranked list — not
   * the OS enumeration order — decides which address the QR advertises.
   */
  const publishLanBases = (): void => {
    service.setLanBases(ctx.webServer.host === '0.0.0.0'
      ? lanIPv4Addresses().map(address => ({ address, base: `http://${address}:${String(ctx.webServer.port)}` }))
      : [])
  }
  if (bindKnown) {
    lastKnownPort = ctx.webServer.port
    publishLanBases()
    // Which adapter carries the default route settles a turn later, and it is
    // the strongest "a phone can reach this" signal — so re-rank once it lands.
    if (ctx.webServer.host === '0.0.0.0') whenDefaultRouteKnown(publishLanBases)
  }

  // ── inner browser credential + the official shell ───────────────────────
  // The proxied /api re-issues to 127.0.0.1, where the connection route
  // enforces the harness browser-auth cookie; the plugin redeems its own
  // launch token once and attaches that cookie to inner requests. Exercised
  // only behind the pairing gate in remote-api.ts.
  const innerAuth = createInnerAuth(() => {
    if (!Number.isFinite(ctx.webServer.port)) return undefined
    try {
      return (ctx.connection as { authenticatedUrl?: (base: string) => string }).authenticatedUrl?.(`http://127.0.0.1:${String(ctx.webServer.port)}/`)
    } catch {
      return undefined
    }
  })
  let appShellCache: { key: string; at: number; html: string } | undefined
  /**
   * One attempt at the official index document over loopback.
   * @param port - the live webServer port.
   * @param host - the Host header to present (loopback, or the device's own
   *   authority when the process credential was refused).
   * @param cookie - the inner browser credential, when one resolved.
   * @returns the document, or undefined when the seat did not answer it.
   */
  const requestAppShell = async (port: number, host: string, cookie: string | undefined): Promise<string | undefined> => {
    try {
      // / is owned by this plugin. Fetch the explicit index file through the
      // static fallback to avoid recursing into our own root handler.
      const response = await fetch(`http://127.0.0.1:${String(port)}/index.html`, {
        redirect: 'follow',
        headers: { host, ...(cookie !== undefined ? { cookie } : {}) },
      })
      if (!response.ok) return undefined
      return await response.text()
    } catch {
      return undefined
    }
  }
  /**
   * The official shell for a pairing landing, cached briefly per requester
   * authority (the cache must never hand one origin's document to another, and
   * the render depends on the Host it was asked for).
   *
   * The loopback fetch carries the process's own browser credential. When that
   * is missing or refused there is still a way in for any origin the device is
   * actually browsing: the harness's index gate is what MINTS the browser
   * cookie for an authority, and it does so for a `GET /` on that very
   * authority. So the retry presents the device's own authority (the Host
   * header is only an authority subject there — the bind is the real fence,
   * since the request still comes in over loopback and is issued by us), which
   * either redeems a browser credential this process already holds for that
   * origin or answers 401 like any credential-less visit.
   * @param _deviceId - the paired device id (the fetch itself is device-blind).
   * @param requesterAuthority - the device's `host[:port]`, when known.
   * @returns the document, or undefined when nothing served it.
   */
  const fetchAppShell = async (_deviceId: string, requesterAuthority?: string): Promise<string | undefined> => {
    if (!Number.isFinite(ctx.webServer.port)) return undefined
    const port = ctx.webServer.port
    const authority = requesterAuthority !== undefined && requesterAuthority !== '' ? requesterAuthority : undefined
    const key = `${String(port)}|${authority ?? ''}`
    if (appShellCache !== undefined && appShellCache.key === key && Date.now() - appShellCache.at < APP_SHELL_TTL_MS) {
      return appShellCache.html
    }
    const cookie = await innerAuth.ready()
    const html = (await requestAppShell(port, `127.0.0.1:${String(port)}`, cookie))
      ?? (authority !== undefined && authority !== `127.0.0.1:${String(port)}`
        ? await requestAppShell(port, authority, undefined)
        : undefined)
    if (html === undefined) return undefined
    appShellCache = { key, at: Date.now(), html }
    return html
  }

  // ── routes ──────────────────────────────────────────────────────────────
  const trustedHostsNow = (): string[] => {
    const list: string[] = []
    const envHosts = process.env.DSH_REMOTE_LINK_TRUSTED_HOSTS ?? process.env.DSH_REMOTE_TRUSTED_HOSTS
    if (typeof envHosts === 'string' && envHosts.trim() !== '') {
      for (const item of envHosts.split(',')) {
        const trimmed = item.trim()
        if (trimmed !== '') list.push(trimmed)
      }
    }
    const configured = resolve().trustedHosts
    if (Array.isArray(configured)) {
      for (const item of configured) {
        if (typeof item === 'string' && item.trim() !== '') list.push(item.trim())
      }
    }
    return list
  }
  let lastFirewallApplied: AppliedFirewallState | undefined
  const lanBindStatus = (): Record<string, unknown> => {
    const resolvedNow = resolve()
    let state: { blockPresent: boolean; host?: string; port?: number }
    try {
      state = lanBindState(resolvedNow.profile)
    } catch {
      state = { blockPresent: false }
    }
    const lanOn = state.host === '0.0.0.0'
    const port = Number.isFinite(ctx.webServer.port) ? ctx.webServer.port : lastKnownPort
    if (Number.isFinite(ctx.webServer.port)) lastKnownPort = ctx.webServer.port
    const startup = ctx.get('webStartup') as StartupFacts | undefined
    const desiredHost = resolvedNow.lanBind === undefined
      ? undefined
      : desiredBindHost(resolvedNow.lanBind === true, startup?.host)
    return {
      profile: resolvedNow.profile,
      setting: resolvedNow.lanBind ?? null,
      blockHost: state.host ?? null,
      bindHost: ctx.webServer.host,
      port,
      lanUrls: ctx.webServer.host === '0.0.0.0' && port !== undefined
        ? lanIPv4Addresses().map(address => `http://${address}:${String(port)}`)
        : [],
      firewall: port !== undefined ? firewallSummary(port, lanOn) : { ok: true, managed: false },
      platform: process.platform,
      pendingRestart: pendingRestartOf(resolvedNow.lanBind, desiredHost, ctx.webServer.host),
    }
  }
  const routes = [
    ...makeRoutes({
      service,
      requirePairingForLan: () => resolve().requirePairingForLan,
      lanBindStatus,
      indexDocument: fetchAppShell,
      authorizeIndex: (req, res) => ctx.connection.authorizeIndex(req, res),
      trustedHosts: trustedHostsNow,
      viewer: { roots: viewerRoots, ctx: ctx as unknown as ViewerContext },
    }),
    ...makeRemoteApiRoutes({
      service,
      port: ctx.webServer.port,
      requirePairingForLan: () => resolve().requirePairingForLan,
      auth: innerAuth,
    }),
  ]
  const upgrades = makeRemoteApiUpgradeRoutes({
    service,
    port: ctx.webServer.port,
    requirePairingForLan: () => resolve().requirePairingForLan,
    auth: innerAuth,
  })
  const gate = makeGateListener(service, () => resolve().requirePairingForLan, () => resolve().enabled)
  ctx.effect(() => ctx.on('api/gate', gate), 'dsh-remote-link: api gate')

  // Sibling plugins (terminal, sidebar, …) resolve this service by name to
  // consult the same device table.
  makePairingAccess(ctx, request => {
    if (!resolve().enabled) return false
    return isPairedDeviceRequest(service, request)
  })

  // ── index injections ────────────────────────────────────────────────────
  // The crypto.randomUUID polyfill keeps the shell alive on a plain-HTTP LAN
  // origin, and the parse-time channel patch must be active before ANY boot
  // entry runs (the connection plugin opens its streams first).
  ctx.effect(() => ctx.on('webserver/index-inject', (table: { push(row: unknown): void }) => {
    table.push({ kind: 'script', placement: 'head', text: UUID_POLYFILL_SCRIPT })
  }), 'dsh-remote-link: uuid polyfill')
  ctx.effect(() => ctx.on('webserver/index-inject', (table: { push(row: unknown): void }) => {
    const value = resolve()
    if (!value.enabled || !value.requirePairingForLan) return
    table.push({ kind: 'script', placement: 'head', text: REMOTE_CHANNEL_BOOT_SCRIPT })
  }), 'dsh-remote-link: remote channel boot patch')

  // ── live sync ───────────────────────────────────────────────────────────
  let disposeRoutes: (() => void) | undefined
  let disposeSweep: (() => void) | undefined
  const sync = (): void => {
    const value = resolve()
    service.config = pairingConfigOf(value)

    // LAN bind toggle: only ever written once the user has flipped it. This is
    // the ONLY place the LAN binding is decided — the launcher deliberately
    // writes no patch of its own, so the two can never fight over the row.
    if (value.lanBind !== undefined) {
      const startup = ctx.get('webStartup') as StartupFacts | undefined
      const desiredHost = desiredBindHost(value.lanBind === true, startup?.host)
      try {
        const currentState = lanBindState(value.profile)
        if (currentState.host !== desiredHost) {
          // The block keeps the composition's port expression, so a restart
          // lands back on the same port instead of pinning today's one.
          writeLanBind(desiredHost, undefined, value.profile)
          console.log(`dsh-remote-link: lan-bind block written for profile ${value.profile} (host ${desiredHost}); it takes effect when the profile next applies`)
        }
      } catch (error) {
        console.error(`dsh-remote-link: failed to write the lan-bind block: ${error instanceof Error ? error.message : String(error)}`)
      }
      const livePort = Number.isFinite(ctx.webServer.port) ? ctx.webServer.port : lastKnownPort
      if (livePort !== undefined) {
        const nextFirewall: AppliedFirewallState = { enabled: value.lanBind === true, port: livePort }
        if (firewallActionNeeded(lastFirewallApplied, nextFirewall)) {
          const ok = nextFirewall.enabled ? ensureFirewallRule(nextFirewall.port) : removeFirewallRule(nextFirewall.port)
          // Record the attempt either way. `sync()` runs on every settings
          // commit and on boot; retrying a blocked netsh call each time would
          // print the same failure line over and over without ever succeeding.
          lastFirewallApplied = nextFirewall
          if (!ok) {
            console.error('dsh-remote-link: the host firewall rule could not be updated (admin rights required on managed platforms); LAN access still binds, but the port may stay blocked until the rule is added by hand')
          }
        }
      }
    }

    // Tunnel: the managed SakuraFrp process owns the public base while it
    // runs; otherwise the manual publicBaseUrl applies (or nothing at all).
    const token = splitToken(value.frpcToken ?? '')
    const wantManaged = value.tunnelEnabled && value.enabled && token.token !== ''
    if (wantManaged) {
      tunnelMode = 'managed'
      if (value.frpcManageProcess) {
        const exe = tunnel.start({
          token: token.token,
          tunnelIds: value.frpcTunnelIds.trim() === '' ? token.tunnelIds : value.frpcTunnelIds,
          frpcPath: value.frpcPath,
          ...(value.frpcPublicBaseUrl !== undefined && value.frpcPublicBaseUrl !== ''
            ? { fallbackBaseUrl: value.frpcPublicBaseUrl }
            : {}),
          localPort: value.frpcLocalPort,
        })
        if (exe === undefined) {
          console.warn(`dsh-remote-link: frpc not found at ${value.frpcPath} — install the SakuraFrp client or point frpcPath at it`)
        }
      } else {
        // External frpc: only the address override can feed the QR.
        tunnel.stop()
        const manual = value.frpcPublicBaseUrl !== undefined && isHttpUrl(value.frpcPublicBaseUrl)
          ? value.frpcPublicBaseUrl.replace(/\/+$/, '')
          : undefined
        service.setPublicBaseUrl(manual)
        service.setTunnelStatus(manual === undefined
          ? { state: 'failed', error: 'frpcManageProcess is off but no frpcPublicBaseUrl is set' }
          : { state: 'running', url: manual })
      }
    } else {
      tunnelMode = 'off'
      tunnel.stop()
      if (value.tunnelEnabled && token.token === '') {
        console.warn('dsh-remote-link: tunnelEnabled is on but frpcToken is empty — the QR link stays LAN-only')
      }
      if (value.publicBaseUrl !== undefined && value.publicBaseUrl !== '' && !isHttpUrl(value.publicBaseUrl)) {
        console.warn(`dsh-remote-link: ignoring malformed publicBaseUrl ${JSON.stringify(value.publicBaseUrl)} (expected https://host[:port])`)
        service.setPublicBaseUrl(undefined)
      } else {
        service.setPublicBaseUrl(value.publicBaseUrl?.replace(/\/+$/, ''))
      }
    }

    const enabled = value.enabled
    if (!enabled) service.stop()
    if (disposeRoutes === undefined && enabled) {
      disposeRoutes = ctx.effect(() => {
        const disposers = [
          ...routes.map(route => ctx.webServer.register(route)),
          ...upgrades.map(route => ctx.webServer.registerUpgrade(route)),
        ]
        return () => { for (const dispose of disposers) dispose() }
      }, 'dsh-remote-link: pairing routes')
    } else if (disposeRoutes !== undefined && !enabled) {
      disposeRoutes()
      disposeRoutes = undefined
    }
    if (disposeSweep === undefined && enabled) {
      disposeSweep = ctx.effect(() => {
        const timer = nodeSetInterval(() => { service.sweep() }, SWEEP_INTERVAL_MS)
        timer.unref()
        return () => { clearInterval(timer) }
      }, 'dsh-remote-link: presence sweep')
    } else if (disposeSweep !== undefined && !enabled) {
      disposeSweep()
      disposeSweep = undefined
    }
  }

  ctx.inject(['settings'], (settingsCtx: Context) => {
    try {
      const settings = (settingsCtx as unknown as {
        settings?: {
          installSection?: (owner: Context, ns: string, schema: unknown, entry: unknown, hooks: unknown) => void
          register?: (ns: string, schema: unknown, options: unknown) => { get(): unknown; watch(cb: () => void): () => void }
        }
      }).settings
      if (typeof settings?.installSection === 'function') {
        settings.installSection(ctx, REMOTE_LINK_SETTINGS_NAMESPACE, Config, config ?? {}, {
          setSource: (source: () => Config) => {
            current = source
            sync()
          },
          onChange: sync,
        })
      } else if (typeof settings?.register === 'function') {
        const scope = settings.register(REMOTE_LINK_SETTINGS_NAMESPACE, Config, { base: config ?? {} })
        current = () => (scope?.get?.() as Config | undefined) ?? (config ?? {})
        scope?.watch?.(() => { sync() })
        sync()
      }
    } catch (error) {
      console.warn(`dsh-remote-link: settings registration failed (${error instanceof Error ? error.message : String(error)}) — using the composition entry`)
    }
  })
  sync()

  const resolved = resolve()
  if (ctx.webServer.host === '0.0.0.0' && service.lanAddresses.length > 0) {
    const urls = service.lanAddresses.map(ip => `http://${ip}:${String(ctx.webServer.port)}`).join(' , ')
    console.log(`dsh-remote-link: LAN pairing pages are reachable at ${urls}`)
  }
  if (resolved.tunnelEnabled) {
    console.log('dsh-remote-link: SakuraFrp tunnel mode is on — the QR link uses the tunnel address once frpc reports it')
  }
  // The read-only viewer's default root follows the live session, so only the
  // boot-time answer is logged; /files re-resolves it on every request.
  void viewerRoots(ctx as unknown as ViewerContext)
    .then((roots) => {
      const first = roots[0]
      if (first !== undefined) {
        console.log(`dsh-remote-link: read-only file viewer on ${VIEWER_PATHS.page} — root: ${first.path} (${first.title})`)
      }
    })
    .catch(() => {})
}

/**
 * The read-only viewer's confinement primitives, re-exported for the host
 * tests (they are pure and browser-free, so they can be asserted directly).
 */
export {
  VIEWER_PATHS,
  VIEWER_MAX_BYTES,
  normalizeViewerPath,
  resolveInsideRoot,
  viewerRoots,
  type ViewerRoot,
} from './file-viewer.ts'
