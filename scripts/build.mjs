/**
 * Emit the esbuild command lines (or a JSON argument list) for this package's
 * two artifacts.
 *
 * The build itself runs from PowerShell (`scripts/build.ps1`), not from Node:
 * this sandbox blocks `child_process.spawn` (the esbuild JS API needs it), so
 * Node's job here is to compute the argument lists — paths, aliases, and the
 * lazy-CJS wrapper — and PowerShell's job is to run the binary.
 *
 * Usage:
 *   node scripts/build.mjs                        # human-readable commands
 *   node scripts/build.mjs --json host --out DIR  # JSON argv for build.ps1
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const packageName = '@loki-0228/dsh-remote-link'

/** Candidate esbuild binaries (win32 layout first, then POSIX). */
export const ESBUILD_CANDIDATES = [
  // 包内工具目录优先：工作区里的临时目录会被清理，包内这份跟包走。
  join(root, 'tools', 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe'),
  join(root, 'tools', 'node_modules', 'esbuild', 'bin', 'esbuild'),
  join(root, '..', '.tools', 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe'),
  join(root, '..', '.tools', 'node_modules', 'esbuild', 'bin', 'esbuild'),
  join(root, 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe'),
  join(root, 'node_modules', 'esbuild', 'bin', 'esbuild'),
]

/**
 * Vendor aliases: every runtime dependency resolves to the checked-in copy
 * under `vendor/`, so the build needs no node_modules tree.
 * @returns esbuild `--alias:` arguments.
 */
export function aliasArgs() {
  const vendor = join(root, 'vendor')
  const map = {
    schemastery: join(vendor, 'schemastery'),
    zod: join(vendor, 'zod'),
    'qrcode.react': join(vendor, 'qrcode.react'),
    cosmokit: join(vendor, '@deepseek-ai', 'cosmokit'),
    '@deepseek-ai/cosmokit': join(vendor, '@deepseek-ai', 'cosmokit'),
    '@deepseek-ai/cordis': join(vendor, 'cordis'),
    '@standard-schema/spec': join(vendor, '@standard-schema', 'spec'),
  }
  return Object.entries(map).map(([name, path]) => `--alias:${name}=${path}`)
}

/**
 * Find the esbuild binary.
 * @returns the absolute path, or undefined when it was never fetched.
 */
export function findEsbuild() {
  return ESBUILD_CANDIDATES.find(candidate => existsSync(candidate))
}

/** Arguments shared by both artifacts. */
function commonArgs(outfile) {
  return ['--bundle', `--outfile=${outfile}`, '--sourcemap', '--log-level=warning', ...aliasArgs()]
}

/**
 * The host artifact (Node ESM), with only the builtins and cordis external.
 * @param outfile - destination path.
 * @returns esbuild arguments.
 */
export function hostArgs(outfile) {
  return [
    join(root, 'src', 'index.ts'),
    '--format=esm',
    '--platform=node',
    '--target=node22',
    '--external:node:*',
    '--external:@deepseek-ai/cordis',
    ...commonArgs(outfile),
  ]
}

/** The lazy-CJS wrapper the client artifact must carry. */
export function clientBanner() {
  return [
    'window.__ModuleLoader__.load({',
    `\tid: ${JSON.stringify(packageName)},`,
    '\tfactory: (require) => {',
    '\t\tvar module = { exports: {} };',
    '\t\tvar exports = module.exports;',
    '\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
    '',
  ].join('\n')
}

/** Everything the running shell answers from its static module table. */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
]

/**
 * The client artifact: CommonJS output inside the lazy-CJS factory the dsh
 * client module system consumes. The wrapper declares `module`/`exports`, so
 * esbuild's CJS output assigns `exports.apply` / `exports.inject` directly and
 * the footer hands `module.exports` back to the loader. `require("<name>")`
 * calls for the externals resolve against the shell's static module table.
 * @param outfile - destination path.
 * @returns esbuild arguments.
 */
export function clientArgs(outfile) {
  return [
    join(root, 'src', 'client', 'index.ts'),
    '--format=cjs',
    '--platform=browser',
    '--target=chrome110',
    ...CLIENT_EXTERNALS.map(name => `--external:${name}`),
    `--banner:js=${clientBanner()}`,
    '--footer:js=return module.exports;}});',
    ...commonArgs(outfile),
  ]
}

/** Quote one argument for a POSIX-style command line. */
function quote(part) {
  return /[\s"']/.test(part) ? `"${part.replace(/"/g, '\\"')}"` : part
}

/**
 * Render one shell command line.
 * @param esbuild - the esbuild binary path.
 * @param args - esbuild arguments.
 * @returns the command line.
 */
export function renderCommand(esbuild, args) {
  return [esbuild, ...args].map(quote).join(' ')
}

const argvAt = process.argv.indexOf('--argv')
const jsonAt = process.argv.indexOf('--json')
const outAt = process.argv.indexOf('--out')
const outDir = outAt === -1 ? join(root, 'lib') : resolve(process.argv[outAt + 1])
const which = argvAt !== -1 ? process.argv[argvAt + 1] : jsonAt !== -1 ? process.argv[jsonAt + 1] : undefined

if (which !== undefined) {
  mkdirSync(outDir, { recursive: true })
  const args = which === 'client'
    ? clientArgs(join(outDir, 'client.js'))
    : hostArgs(join(outDir, 'index.js'))
  if (jsonAt !== -1) {
    // One JSON file per artifact: command-line transport would split the
    // multi-line banner into separate arguments.
    const file = join(outDir, `.esbuild-argv-${which}.json`)
    writeFileSync(file, JSON.stringify(args))
    process.stdout.write(`${file}\n`)
  } else {
    process.stdout.write(`${args.join('\n')}\n`)
  }
} else {
  const esbuild = findEsbuild()
  if (esbuild === undefined) {
    console.error('esbuild not found. Run: node scripts/fetch-esbuild.mjs')
    process.exitCode = 1
  } else {
    console.log(renderCommand(esbuild, hostArgs(join(outDir, 'index.js'))))
    console.log(renderCommand(esbuild, clientArgs(join(outDir, 'client.js'))))
  }
}
