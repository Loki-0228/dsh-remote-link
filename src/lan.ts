/**
 * LAN address derivation for the pairing URLs.
 *
 * The fence accepts the same non-internal IPv4 literals the harness itself
 * samples, so every address here is one the /api and pairing fences already
 * trust. What this module adds is *ordering*: an all-interfaces bind exposes
 * every adapter, and the first one is not necessarily reachable by a phone —
 * a WSL / Hyper-V / VPN adapter is up, non-internal, and completely
 * unroutable from the LAN, which is exactly how a QR link ends up pointing at
 * a dead address.
 *
 * Ranking, strongest signal first:
 *   1. a physical-looking interface over a virtual one;
 *   2. the default route among interfaces in the same class;
 *   3. the driver's interface order (last resort, keeps behaviour stable).
 * Nothing is dropped: a machine whose only address is virtual still gets a
 * link, it just sorts last.
 * @module dsh-remote-link/lan
 */

import { networkInterfaces } from 'node:os'
import { createSocket } from 'node:dgram'

/** One candidate address with the facts needed to rank it. */
export interface LanAddress {
  /** IPv4 literal. */
  address: string
  /** The interface's display name (`WLAN`, `vEthernet (Default Switch)`, …). */
  iface: string
  /** True when the interface looks like a virtual/tunnel adapter. */
  virtual: boolean
  /** True for the APIPA range (169.254/16), which is never routable. */
  apipa: boolean
}

/**
 * Interface-name patterns that are up and non-internal but cannot carry a LAN
 * connection: virtualization switches, VPN/tunnel adapters, and phone-tethering
 * pseudo-adapters. Matching is case-insensitive and name-based rather than
 * range-based, so a legitimate 172.16/12 LAN address is untouched.
 */
const VIRTUAL_IFACE_PATTERNS: readonly RegExp[] = [
  /vEthernet/i, /Hyper-V/i, /WSL/i, /VMware/i, /VirtualBox/i, /Virtual Adapter/i,
  /TAP-Windows/i, /OpenVPN/i, /WireGuard/i, /Tunnel/i, /Tailscale/i, /ZeroTier/i,
  /Radmin/i, /Loopback/i, /Clash/i, /Mihomo/i, /Meta/i, /sing-box/i, /Wintun/i, /^tun\d*$/i,
]

/** How long to wait for the route probe before falling back to interface order. */
const ROUTE_PROBE_MS = 150

/** Waiters resolved when the route probe settles (see {@link defaultRouteAddress}). */
const routeWaiters: (() => void)[] = []

/**
 * The local address the OS would use to reach a public destination — i.e. the
 * address on the interface carrying the default route. A VPN can own that
 * route, so it only breaks ties within the same physical/virtual class.
 *
 * No packet is sent: connecting a UDP socket only resolves a route. The result
 * is cached for the process, matching the harness's once-per-invocation
 * sampling stance.
 * @param timeoutMs - how long to wait before giving up.
 * @returns the local address, or undefined when the probe has not settled yet
 * (or the machine has no default route).
 */
let cachedRouteAddress: string | undefined
let routeProbed = false
export function defaultRouteAddress(timeoutMs: number = ROUTE_PROBE_MS): string | undefined {
  if (routeProbed) return cachedRouteAddress
  routeProbed = true
  let settled = false
  const settle = (): void => {
    if (settled) return
    settled = true
    for (const waiter of routeWaiters.splice(0)) {
      try { waiter() } catch { /* a listener must not break the probe */ }
    }
  }
  let socket: ReturnType<typeof createSocket> | undefined
  try {
    socket = createSocket('udp4')
    socket.connect(53, '8.8.8.8', () => {
      try { cachedRouteAddress = socket?.address()?.address } catch { /* closed early */ }
      try { socket?.close() } catch { /* already closed */ }
      settle()
    })
    socket.on('error', () => {
      try { socket?.close() } catch { /* already closed */ }
      settle()
    })
  } catch {
    // No socket available (a locked-down host): the naming heuristics still rank.
    settle()
  }
  const timer = setTimeout(() => {
    try { socket?.close() } catch { /* already closed */ }
    settle()
  }, timeoutMs)
  timer.unref?.()
  return cachedRouteAddress
}

/**
 * Resolve once the default-route probe has settled, so a caller can re-rank
 * with the routing fact (the probe is asynchronous by nature).
 * @param onKnown - invoked when the answer — or the timeout — has landed.
 * @returns nothing.
 */
export function whenDefaultRouteKnown(onKnown: () => void): void {
  if (routeProbed && cachedRouteAddress !== undefined) { onKnown(); return }
  if (routeProbed) { routeWaiters.push(onKnown); return }
  defaultRouteAddress()
  routeWaiters.push(onKnown)
}

/**
 * Rank one set of interfaces. Pure, so the ordering rules are testable without
 * depending on the build machine's adapters.
 * @param interfaces - an `os.networkInterfaces()`-shaped map.
 * @param routeAddress - the address on the default-route interface, if known.
 * @returns the ranked candidates, best first.
 */
export function rankLanCandidates(
  interfaces: Record<string, readonly { address: string; family: string; internal: boolean }[] | undefined>,
  routeAddress: string | undefined,
): LanAddress[] {
  const entries: (LanAddress & { order: number; route: boolean })[] = []
  let order = 0
  for (const [iface, list] of Object.entries(interfaces)) {
    for (const info of list ?? []) {
      if (info.family !== 'IPv4' || info.internal) continue
      // 198.18/15 is the benchmark range commonly used by local TUN proxies.
      const virtual = VIRTUAL_IFACE_PATTERNS.some(pattern => pattern.test(iface))
        || /^198\.(18|19)\./.test(info.address)
      entries.push({
        address: info.address,
        iface,
        virtual,
        apipa: info.address.startsWith('169.254.'),
        order: order++,
        route: routeAddress !== undefined && info.address === routeAddress,
      })
    }
  }
  entries.sort((a, b) => {
    if (a.virtual !== b.virtual) return a.virtual ? 1 : -1
    if (a.apipa !== b.apipa) return a.apipa ? 1 : -1
    if (a.route !== b.route) return a.route ? -1 : 1
    return a.order - b.order
  })
  return entries.map(({ address, iface, virtual, apipa }) => ({ address, iface, virtual, apipa }))
}

/**
 * Every non-internal IPv4 address with its ranking facts, best candidate first.
 * @returns the ranked candidates (possibly empty).
 */
export function lanCandidates(): LanAddress[] {
  return rankLanCandidates(networkInterfaces(), defaultRouteAddress())
}

/**
 * Non-internal IPv4 interface addresses of this machine, ranked so the first
 * entry is the one a LAN device can actually reach.
 * @returns the addresses in preference order (possibly empty).
 */
export function lanIPv4Addresses(): string[] {
  return lanCandidates().map(candidate => candidate.address)
}

/**
 * The single best LAN address, or undefined when the machine has none.
 * @returns the preferred LAN IPv4 literal.
 */
export function preferredLanAddress(): string | undefined {
  return lanIPv4Addresses()[0]
}
