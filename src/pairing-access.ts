/**
 * The optional cordis service other host plugins resolve by name to consult
 * the live paired-device table for routes outside /api (and therefore outside
 * the api/gate seam). Registered under the same lookup key the upstream
 * remote-control plugin uses, so sibling plugins keep working when they are
 * paired with this one instead.
 * @module dsh-remote-link/pairing-access
 */

import type { IncomingMessage } from 'node:http'
import { Service, type Context } from '@deepseek-ai/cordis'

/**
 * Named lookup key sibling plugins pass to `ctx.get`. Deliberately the
 * upstream spelling (`remoteWebUiPairing`) rather than this package's own
 * name: consumers look the service up by that key.
 */
export const REMOTE_LINK_PAIRING = 'remoteWebUiPairing'

/** The service shape consumers rely on (structural). */
export interface PairingAccess {
  /** Whether the request carries a live paired-device cookie. */
  isPairedDevice(request: IncomingMessage): boolean
}

/**
 * Pairing identity for one HTTP request.
 */
export class RemoteLinkPairing extends Service implements PairingAccess {
  /**
   * @param ctx - host plugin context.
   * @param check - live cookie + session predicate (re-read per request).
   */
  constructor(
    ctx: Context,
    private readonly check: (request: IncomingMessage) => boolean,
  ) {
    super(ctx, REMOTE_LINK_PAIRING)
  }

  /**
   * Whether the request carries a live paired-device cookie.
   * @param request - the incoming HTTP request.
   * @returns true when the session is live and was refreshed.
   */
  isPairedDevice(request: IncomingMessage): boolean {
    return this.check(request)
  }
}

/**
 * Register the pairing-access service (service registration is the side
 * effect; the returned handle is for tests and diagnostics).
 * @param ctx - host plugin context.
 * @param check - the live paired-device predicate.
 * @returns the registered service.
 */
export function makePairingAccess(ctx: Context, check: (request: IncomingMessage) => boolean): RemoteLinkPairing {
  return new RemoteLinkPairing(ctx, check)
}
