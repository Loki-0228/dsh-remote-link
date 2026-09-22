/** Injected clock, entropy, filesystem, and process seams for the tunnel manager. */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { delimiter, join } from 'node:path'

/** One spawned child process, narrowed to what the manager uses. */
export interface TunnelChild {
  readonly pid: number | undefined
  readonly stdout: { on(event: 'data', listener: (chunk: Buffer) => void): unknown } | null
  readonly stderr: { on(event: 'data', listener: (chunk: Buffer) => void): unknown } | null
  on(event: 'exit', listener: (code: number | null) => void): unknown
  on(event: 'error', listener: (error: Error) => void): unknown
  kill(): boolean
}

/** The observability state of one managed tunnel. */
export type TunnelPhase = 'idle' | 'starting' | 'running' | 'failed'

/** One phase frame handed to the state listener. */
export interface TunnelInfo {
  phase: TunnelPhase
  /** The public base URL, once the tunnel reports its address. */
  url?: string
  /** Human-readable failure detail. */
  error?: string
}

/** Everything one start needs. */
export interface TunnelOptions {
  /** SakuraFrp access token (`<token>:<tunnelId[,tunnelId...]>` also accepted). */
  token: string
  /** Tunnel ids to run; empty means "whatever the token's own config lines carry". */
  tunnelIds: string
  /** Absolute path to frpc.exe, or a bare name resolved from PATH. */
  frpcPath: string
  /** Optional public base URL override when the parsed address is unusable. */
  fallbackBaseUrl?: string
  /** Local port the tunnels forward to (informational; frpc config owns the target). */
  localPort: number
}

/** Tunables for one manager instance. */
export interface TunnelConfig {
  /** How long the manager waits for the frpc log's success line. */
  startTimeoutMs: number
  /** Delay before an unexpected exit is retried. */
  restartDelayMs: number
}

/** Defaults: a slow SakuraFrp node handshake still fits in 60s. */
export const DEFAULT_TUNNEL_CONFIG: TunnelConfig = {
  startTimeoutMs: 60_000,
  restartDelayMs: 8_000,
}

/** Injectable seams (tests replace all four). */
export interface TunnelSeams {
  spawn: (file: string, args: readonly string[]) => TunnelChild
  exists: (path: string) => boolean
  now: () => number
  /**
   * Whether a bare binary name must be resolved from PATH before spawning.
   * Node's spawn already searches PATH; this seam exists so a test can assert
   * the resolution branch without a real filesystem.
   */
  pathEntries: () => readonly string[]
}

/**
 * Resolve the frpc executable: an absolute/existing path wins, otherwise the
 * bare name is looked up in PATH so the failure message can name what was
 * tried instead of leaving the operator guessing.
 * @param configured - the configured path or bare name.
 * @param seams - filesystem/PATH seams.
 * @returns the executable to spawn, or undefined when nothing matches.
 */
export function resolveFrpc(configured: string, seams: Pick<TunnelSeams, 'exists' | 'pathEntries'>): string | undefined {
  const trimmed = configured.trim()
  if (trimmed === '') return undefined
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return seams.exists(trimmed) ? trimmed : undefined
  }
  const suffix = process.platform === 'win32' && !trimmed.toLowerCase().endsWith('.exe') ? '.exe' : ''
  for (const entry of seams.pathEntries()) {
    if (entry.trim() === '') continue
    const candidate = join(entry, `${trimmed}${suffix}`)
    if (seams.exists(candidate)) return candidate
  }
  return seams.exists(trimmed) ? trimmed : undefined
}

/** The default spawn: piped stdio, no shell, detached from the console. */
function defaultSpawn(file: string, args: readonly string[]): TunnelChild {
  return spawn(file, [...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }) as unknown as TunnelChild
}

/** The default seams. */
export const defaultTunnelSeams: TunnelSeams = {
  spawn: defaultSpawn,
  exists: existsSync,
  now: () => Date.now(),
  pathEntries: () => (process.env.PATH ?? '').split(delimiter),
}

/**
 * One SakuraFrp tunnel run: spawn `frpc -f <token>` and translate its log into
 * a phase + public URL. The address line is the only machine-readable output
 * the client produces:
 *
 * ```
 * 隧道启动中: [dsh, tcp]
 * TCP 隧道启动成功
 * 使用 >>frp-cup.com:34437<< 连接你的隧道
 * [q5s**twm.dsh] 隧道启动成功
 * ```
 *
 * The parser tolerates the "或使用节点 IP 连接 (不推荐) >>ip:port<<" line (it
 * never matches the 使用 prefix), localized log_level noise, and repeated
 * startup announcements after a reconnect.
 */
export class FrpcTunnel {
  private child: TunnelChild | undefined
  private options: TunnelOptions | undefined
  private phase: TunnelPhase = 'idle'
  private url: string | undefined
  private error: string | undefined
  /** Rolling tail of the log for diagnostics (bounded). */
  private tail: string[] = []
  private startTimer: NodeJS.Timeout | undefined
  private restartTimer: NodeJS.Timeout | undefined
  private stopping = false
  /** Set when an exit was expected (stop/dispose/config change). */
  private intentional = false
  private disposed = false
  private readonly onInfo: (info: TunnelInfo) => void
  private readonly config: TunnelConfig
  private readonly seams: TunnelSeams

  /**
   * @param onInfo - phase listener (fires on every observable transition).
   * @param config - tunables.
   * @param seams - process/clock seams.
   */
  constructor(
    onInfo: (info: TunnelInfo) => void,
    config: TunnelConfig = DEFAULT_TUNNEL_CONFIG,
    seams: TunnelSeams = defaultTunnelSeams,
  ) {
    this.onInfo = onInfo
    this.config = config
    this.seams = seams
  }

  /** The current frame (without re-emitting). */
  get info(): TunnelInfo {
    return {
      phase: this.phase,
      ...(this.url !== undefined ? { url: this.url } : {}),
      ...(this.error !== undefined ? { error: this.error } : {}),
    }
  }

  /** Whether a child process is currently alive. */
  get running(): boolean {
    return this.child !== undefined
  }

  /** The last N log lines, joined (diagnostics). */
  get logTail(): string {
    return this.tail.join('\n')
  }

  /**
   * Start (or restart) the tunnel toward one configuration. A start with the
   * same token/ids/path while the tunnel is alive is a no-op; anything else
   * tears the old child down first.
   * @param options - the resolved tunnel configuration.
   * @returns the executable that was spawned, or undefined when it could not be resolved.
   */
  start(options: TunnelOptions): string | undefined {
    if (this.disposed) return undefined
    if (this.sameTarget(options) && this.child !== undefined) return this.options?.frpcPath
    this.stopChild()
    const exe = resolveFrpc(options.frpcPath, this.seams)
    if (exe === undefined) {
      this.options = options
      this.fail(`frpc executable not found (configured: ${options.frpcPath || '<empty>'})`)
      return undefined
    }
    this.options = { ...options, frpcPath: exe }
    this.stopping = false
    this.spawnChild()
    return exe
  }

  /** Stop the tunnel for good: no restart, state returns to idle. */
  stop(): void {
    this.stopping = true
    this.options = undefined
    this.stopChild()
    this.clearTimers()
    this.setPhase('idle', undefined, undefined)
  }

  /** Stop and refuse further starts. */
  dispose(): void {
    this.disposed = true
    this.stop()
  }

  private sameTarget(next: TunnelOptions): boolean {
    const current = this.options
    if (current === undefined) return false
    return current.token === next.token
      && current.tunnelIds === next.tunnelIds
      && current.frpcPath === next.frpcPath
      && current.fallbackBaseUrl === next.fallbackBaseUrl
  }

  private spawnChild(): void {
    const options = this.options
    if (options === undefined) return
    const args = options.tunnelIds.trim() === ''
      ? ['-f', options.token]
      : ['-f', `${options.token}:${options.tunnelIds.trim().replace(/^:+/, '')}`]
    this.url = undefined
    this.error = undefined
    this.tail = []
    this.setPhase('starting', undefined, undefined)
    let child: TunnelChild
    try {
      child = this.seams.spawn(options.frpcPath, args)
    } catch (error) {
      this.fail(error instanceof Error ? error.message : String(error))
      return
    }
    this.child = child
    this.stopping = false
    this.intentional = false
    child.stdout?.on('data', (chunk: Buffer) => { this.consume(chunk.toString('utf8')) })
    child.stderr?.on('data', (chunk: Buffer) => { this.consume(chunk.toString('utf8')) })
    child.on('error', (error: Error) => {
      this.child = undefined
      this.fail(`frpc failed to start: ${error.message}`)
    })
    child.on('exit', (code: number | null) => {
      this.child = undefined
      if (this.intentional || this.stopping || this.disposed) return
      // SakuraFrp nodes drop connections routinely; frpc exits only when it
      // gives up, so the manager retries with a delay instead of dying.
      this.setPhase('failed', undefined, `frpc exited (code ${code === null ? 'unknown' : String(code)})`)
      this.scheduleRestart()
    })
    const timer = setTimeout(() => {
      if (this.phase === 'starting') {
        this.fail(`frpc did not report a tunnel address within ${String(Math.round(this.config.startTimeoutMs / 1000))}s — check the token/tunnel id and the frpc log`)
      }
    }, this.config.startTimeoutMs)
    timer.unref()
    this.startTimer = timer
  }

  private scheduleRestart(): void {
    if (this.restartTimer !== undefined) return
    const timer = setTimeout(() => {
      this.restartTimer = undefined
      if (this.disposed || this.stopping || this.options === undefined) return
      this.spawnChild()
    }, this.config.restartDelayMs)
    timer.unref()
    this.restartTimer = timer
  }

  private stopChild(): void {
    this.intentional = true
    const child = this.child
    this.child = undefined
    if (child !== undefined) {
      try { child.kill() } catch { /* already gone */ }
    }
  }

  private clearTimers(): void {
    if (this.startTimer !== undefined) { clearTimeout(this.startTimer); this.startTimer = undefined }
    if (this.restartTimer !== undefined) { clearTimeout(this.restartTimer); this.restartTimer = undefined }
  }

  /**
   * Parse one log chunk: append to the bounded tail, then look for the
   * tunnel-start success marker (which carries the public address) or an
   * address line that arrived before it.
   * @param text - decoded stdout/stderr text.
   */
  private consume(text: string): void {
    const lines = text.split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed === '') continue
      this.tail.push(trimmed)
      if (this.tail.length > 40) this.tail.splice(0, this.tail.length - 40)
      const address = parseTunnelAddress(trimmed)
      if (address !== undefined) {
        this.markRunning(address)
        continue
      }
      if (isTunnelReadyLine(trimmed)) {
        // The success marker without a parsed address: only usable when a
        // configured public base exists (frpc logs the address line before
        // this marker, so the normal path already ran above).
        if (this.url === undefined && this.options?.fallbackBaseUrl !== undefined) {
          this.markRunning(new URL(this.options.fallbackBaseUrl).host)
        }
      }
      if (isFatalLine(trimmed)) {
        this.fail(trimmed)
      }
    }
  }

  private markRunning(hostPort: string): void {
    if (this.phase === 'running' && this.url === `${this.baseUrl(hostPort)}`) return
    this.url = `${this.baseUrl(hostPort)}`
    this.clearTimers()
    this.setPhase('running', this.url, undefined)
  }

  /**
   * The public base URL for one `host:port` address line. Port 80/443 are
   * folded into the scheme; anything else keeps the explicit port, which is
   * what a SakuraFrp TCP tunnel advertises (`frp-cup.com:34437`).
   */
  private baseUrl(hostPort: string): string {
    const scheme = /:(443)$/.test(hostPort) ? 'https' : 'http'
    return `${scheme}://${hostPort}`
  }

  private fail(message: string): void {
    this.clearTimers()
    this.setPhase('failed', undefined, message)
  }

  private setPhase(phase: TunnelPhase, url: string | undefined, error: string | undefined): void {
    const changed = phase !== this.phase || url !== this.url || error !== this.error
    this.phase = phase
    this.url = url
    this.error = error
    if (changed) this.onInfo(this.info)
  }
}

/**
 * Extract the public `host:port` from one frpc log line, if it carries one.
 * @param line - one trimmed log line.
 * @returns the address, or undefined when the line is not an address line.
 */
export function parseTunnelAddress(line: string): string | undefined {
  // frpc's own "[name] 隧道启动成功" notice often embeds the domain
  // (`[q5s**twm.dsh]`); it is decorative and never a connect address.
  if (/隧道启动成功/u.test(line) && !/使用/u.test(line)) return undefined
  const connect = /使用\s*>>([^<>\s]+)<<\s*连接/u.exec(line)
  if (connect?.[1] !== undefined) return normalizeHostPort(connect[1])
  // HTTP/HTTPS tunnels announce a domain and the local proxy port instead.
  const domain = /(?:start\s+proxy\s+success|proxy\s+success|隧道启动成功).*?domain\s*[:=]\s*([^\s,]+)/iu.exec(line)
  if (domain?.[1] !== undefined) {
    const port = /(?:local|remote|https?_port|port)\s*[:=]\s*(\d+)/iu.exec(line)
    return normalizeHostPort(port?.[1] !== undefined ? `${domain[1]}:${port[1]}` : domain[1])
  }
  return undefined
}

/**
 * Normalize one address token: strip a scheme and any path, reject a bare
 * IPv4 node address (frpc prints it as the "not recommended" alternative under
 * a different prefix, but a hand-edited log could still slip one through) and
 * reject values that are obviously not an authority.
 * @param raw - the address token.
 * @returns the normalized `host[:port]`, or undefined when unusable.
 */
export function normalizeHostPort(raw: string): string | undefined {
  const withoutScheme = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  const authority = withoutScheme.split('/')[0]?.trim() ?? ''
  if (authority === '') return undefined
  if (!/^[A-Za-z0-9._:[\]-]+$/.test(authority)) return undefined
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(authority)) return undefined
  return authority
}

/** Whether one line is frpc's tunnel-start success notice. */
export function isTunnelReadyLine(line: string): boolean {
  return /隧道启动成功/u.test(line) || /start\s+proxy\s+success/iu.test(line)
}

/** Whether one line names a condition that will not resolve by retrying. */
export function isFatalLine(line: string): boolean {
  if (/token|密钥/iu.test(line) && /(无效|错误|invalid|not\s+found|失败)/iu.test(line)) return true
  if (/隧道.*(不存在|已过期)/u.test(line)) return true
  if (/no\s+such\s+tunnel/iu.test(line)) return true
  return false
}

/** A token/id pair split from one `<token>:<ids>` string. */
export interface TokenParts {
  token: string
  tunnelIds: string
}

/**
 * Split a `<token>:<tunnelId[,tunnelId]>` string. SakuraFrp's offline config
 * file (`frpc-token.txt`) carries the combined form while the settings form
 * has separate fields, so both shapes must resolve to the same parts.
 * @param raw - the configured token, possibly combined.
 * @returns the token and the comma-separated ids (empty when none were given).
 */
export function splitToken(raw: string): TokenParts {
  const trimmed = raw.trim()
  const at = trimmed.indexOf(':')
  if (at === -1) return { token: trimmed, tunnelIds: '' }
  return { token: trimmed.slice(0, at), tunnelIds: trimmed.slice(at + 1) }
}

/** A random nonce for temp filenames (kept beside the seams for consistency). */
export function tunnelNonce(): string {
  return randomBytes(4).toString('hex')
}
