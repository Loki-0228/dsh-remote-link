/**
 * Host-side settings probe: mount the real settings-file provider, apply this
 * plugin on top of it, and print what a configuration UI would see — the
 * namespace list (with redaction, exactly as the wire surfaces it), the field
 * list from the serialized schema, and whether a write through the provider
 * lands in the plugin's live config.
 *
 * This is the check that answers "the tunnel form is empty in the browser": the
 * browser half only binds `remote-link` and renders fields the schema carries,
 * so a missing or unregistered namespace renders nothing at all.
 *
 * Usage: node scripts/test-settings-namespace.mjs [--home DIR]
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const profileModules = 'C:/Users/lq/.dsh/profiles/node_modules'
const dshModules = 'D:/nodejs/node_modules/@deepseek-ai/dsh/node_modules'

const homeAt = process.argv.indexOf('--home')
const home = homeAt === -1 ? mkdtempSync(join(tmpdir(), 'dsh-remote-link-settings-')) : resolve(process.argv[homeAt + 1])
// The real provider resolves via dsh-home-paths, not its legacy root option.
// Set this before importing the provider so tests never touch the live home.
process.env.DSH_HOME = home

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

/** Minimal web-server stand-in: the plugin only registers routes on it. */
function fakeWebServer() {
  return {
    host: '0.0.0.0',
    port: 3080,
    register: () => () => {},
    registerUpgrade: () => () => {},
  }
}

/**
 * Read one descriptor's redacted view.
 * @param settings - the mounted settings provider.
 * @param ns - the namespace.
 * @returns the descriptor, or undefined.
 */
function findDescriptor(settings, ns) {
  return settings.describe({ redactSecrets: true }).find(entry => entry.ns === ns)
}

/**
 * Read the resolved value of one namespace.
 * @param settings - the mounted settings provider.
 * @param ns - the namespace.
 * @param field - the field to read.
 * @returns the resolved field value.
 */
function describeValue(settings, ns, field) {
  return findDescriptor(settings, ns)?.value?.[field]
}

/**
 * Snapshot the raw user section of one namespace, so a probe write can be undone.
 * @param settings - the mounted settings provider.
 * @param ns - the namespace.
 * @returns the raw user section and whether one exists.
 */
function describeSection(settings, ns) {
  const descriptor = findDescriptor(settings, ns)
  const user = descriptor?.user
  return {
    userSection: user !== null && typeof user === 'object' ? user : {},
    hasUserSection: user !== null && typeof user === 'object' && Object.keys(user).length > 0,
    tunnelEnabled: descriptor?.value?.tunnelEnabled,
  }
}

async function main() {
  const { Context } = await import(pathToFileURL(join(dshModules, '@deepseek-ai/cordis', 'lib', 'index.js')).href)
  const dshHome = await import(pathToFileURL(join(dshModules, '@deepseek-ai/dsh-home-paths', 'lib', 'index.js')).href)

  const ctx = new Context()
  ctx.baseUrl = pathToFileURL(join(home, 'profiles', 'web') + '/').href
  ctx.provide('dshHomePath', dshHome.dshHomePath)
  Object.defineProperty(ctx, 'webServer', { value: fakeWebServer(), writable: true, configurable: true })
  Object.defineProperty(ctx, 'typertGateway', { value: {}, writable: true, configurable: true })
  Object.defineProperty(ctx, 'connection', { value: {}, writable: true, configurable: true })

  // The real provider the shipped web profile uses (`id: settings`).
  const SettingsFile = (await import(pathToFileURL(join(profileModules, '@deepseek-ai/dsh-settings-file', 'lib', 'index.js')).href)).default
  await ctx.plugin(SettingsFile, { root: home })
  const settings = ctx.get('settings')
  check(settings !== undefined, 'the real settings-file provider mounted')

  const plugin = await import(pathToFileURL(join(root, 'lib', 'index.js')).href)
  plugin.apply(ctx, { devicesFile: join(home, 'devices.json') })
  check(true, 'plugin applied on top of the provider')

  // `ctx.inject(['settings'], …)` is asynchronous: the registration lands when
  // the injected edge settles, so the descriptors must be read after it.
  const deadline = Date.now() + 5_000
  let descriptors = []
  while (Date.now() < deadline) {
    descriptors = settings.describe({ redactSecrets: true })
    if (descriptors.some(entry => entry.ns === 'remote-link')) break
    await new Promise(resolvePromise => setTimeout(resolvePromise, 50))
  }

  // What a configuration UI reads: redacted descriptors, one per namespace.
  const names = descriptors.map(entry => entry.ns)
  check(names.includes('remote-link'), `the namespace is registered (${names.join(', ')})`)
  const descriptor = descriptors.find(entry => entry.ns === 'remote-link')
  if (descriptor !== undefined) {
    const value = descriptor.value
    check(value !== null && typeof value === 'object', 'the descriptor carries a resolved value')

    // A schema-driven form (the shared Plugins settings page) renders from the
    // serialized schema's field dictionary, so every configurable field must be
    // there. Some fields legitimately carry no default and are therefore absent
    // from the RESOLVED value — which is why this checks the schema, not the
    // value: the plugin's own panel reads a missing field as an empty input.
    const schemaJson = descriptor.schema
    const root = schemaJson?.refs?.[schemaJson.uid] ?? schemaJson?.refs?.[String(schemaJson?.uid)]
    const fields = Object.keys(root?.dict ?? {})
    for (const field of ['tunnelEnabled', 'frpcToken', 'frpcTunnelIds', 'frpcPath', 'frpcManageProcess', 'frpcPublicBaseUrl']) {
      check(fields.includes(field), `the tunnel field "${field}" reaches a schema-driven config UI`)
    }
    check(fields.includes('requirePairingForLan') && fields.includes('lanBind'), 'the access-policy fields reach a config UI')
    check(value.tunnelEnabled === false, 'the tunnel starts off by default')
    check(value.frpcManageProcess === true, 'frpc is managed by the plugin by default')
    check(Array.isArray(descriptor.secrets) && descriptor.secrets.some(secret => String(secret?.path ?? secret).includes('frpcToken')),
      `frpcToken is declared as a secret (${JSON.stringify(descriptor.secrets ?? [])})`)
    check(value.frpcPath.endsWith(join('bin', 'frpc.exe')), `frpcPath defaults inside the package (${String(value.frpcPath)})`)
  }

  // A write through the provider must reach the plugin's live config: this is
  // the round trip the browser form performs.
  //
  // The provider persists to ITS OWN document — with a real provider that is
  // $DSH_HOME/settings.yaml, i.e. the user's live configuration. So the probe
  // snapshots the section first and always restores it, and it never invents a
  // value the user did not have: restoring means removing the section again.
  const before = describeSection(settings, 'remote-link')
  try {
    await settings.update('remote-link', { tunnelEnabled: !before.tunnelEnabled })
    const after = describeSection(settings, 'remote-link')
    check(after.tunnelEnabled === !before.tunnelEnabled, 'a provider write flips the live value the host reads')
    check(describeValue(settings, 'remote-link', 'frpcManageProcess') === true,
      'the write does not disturb the other resolved fields')
  } catch (error) {
    console.log(`  skip provider write (${error instanceof Error ? error.code ?? error.message : String(error)})`)
  } finally {
    // Put the user's document back exactly as it was.
    try {
      if (before.hasUserSection) await settings.update('remote-link', before.userSection)
      else await settings.replace('remote-link', {})
      check(describeSection(settings, 'remote-link').tunnelEnabled === before.tunnelEnabled,
        'the probe restored the section it wrote')
    } catch (error) {
      console.log(`  WARNING: could not restore the section (${error instanceof Error ? error.message : String(error)}) — remove "remote-link:" from the settings document by hand`)
    }
  }

  console.log('')
  console.log(`${String(passes)} passed, ${String(failures)} failed`)
  await ctx.fiber.dispose()
  if (homeAt === -1) rmSync(home, { recursive: true, force: true })
  if (failures > 0) process.exitCode = 1
}

await main()
