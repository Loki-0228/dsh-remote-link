/**
 * DSH_HOME resolution for the host half: the environment override wins, the
 * platform home fallback follows.
 * @module dsh-remote-link/dsh-home
 */

import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Resolve the DSH home directory.
 * @param env - process environment to read DSH_HOME from.
 * @param home - platform home directory fallback (test seam).
 * @returns the absolute DSH home path.
 */
export function resolveDshHome(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const configured = env.DSH_HOME?.trim()
  if (configured !== undefined && configured !== '') return configured
  return join(home, '.dsh')
}

/** Resolve the DSH home directory from the live environment. */
export function dshHome(): string {
  return resolveDshHome()
}
