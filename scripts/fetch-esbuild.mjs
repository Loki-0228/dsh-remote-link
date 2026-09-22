/**
 * Workspace helper: fetch the esbuild platform binary without relying on the
 * package's postinstall script (this sandbox blocks `spawn` for the npm/pnpm
 * install scripts, but plain HTTPS and the esbuild CLI's own inherit-stdio
 * spawn both work).
 *
 * Downloads (and verifies) both halves esbuild needs:
 *   - @esbuild/win32-x64 — the `esbuild.exe` service binary;
 *   - esbuild          — the JS API wrapper used by scripts/build.mjs.
 *
 * Usage: node scripts/fetch-esbuild.mjs [--esbuild-version 0.28.2]
 * Installs into <workspace>/.tools/node_modules so scripts/build.mjs finds it.
 */

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
// esbuild 装在插件包内的 tools/ 下：工作区里那份（..\.tools）会被清理掉，包内这份
// 跟着包走，构建脚本能找到、也不污染 profile。--tools DIR 可指定别处。
const toolsAt = process.argv.indexOf('--tools')
const tools = toolsAt === -1 ? join(root, 'tools') : resolve(process.argv[toolsAt + 1])
const nodeModules = join(tools, 'node_modules')

const argAt = process.argv.indexOf('--esbuild-version')
const version = argAt === -1 ? '0.28.2' : (process.argv[argAt + 1] ?? '0.28.2')

/** One package to fetch: registry name, install folder, and integrity. */
const packages = [
  { spec: '@esbuild/win32-x64', folder: join(nodeModules, '@esbuild', 'win32-x64') },
  { spec: 'esbuild', folder: join(nodeModules, 'esbuild') },
]

/**
 * Fetch one registry document.
 * @param url - absolute URL.
 * @returns the parsed JSON body.
 */
async function getJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/vnd.npm.install-v1+json' } })
  if (!response.ok) throw new Error(`${url} → HTTP ${String(response.status)}`)
  return await response.json()
}

/**
 * Minimal tar reader for a registry tarball: 512-byte headers, `ustar`/GNU
 * names, regular files only, truncation is an error.
 * @param buffer - the decompressed tar bytes.
 * @returns one entry per regular file.
 */
function readTar(buffer) {
  const entries = []
  let offset = 0
  const readString = (start, length) => buffer.subarray(start, start + length).toString('utf8').replace(/\0.*$/, '')
  while (offset + 512 <= buffer.length) {
    const name = readString(offset, 100)
    if (name === '') break
    const sizeText = readString(offset + 124, 12).trim()
    const size = sizeText === '' ? 0 : Number.parseInt(sizeText, 8)
    const type = buffer[offset + 156]
    const prefix = readString(offset + 345, 155)
    const fullName = prefix === '' ? name : `${prefix}/${name}`
    const dataStart = offset + 512
    if (type === 0 || type === 48) {
      if (!Number.isFinite(size) || dataStart + size > buffer.length) {
        throw new Error(`tar: truncated entry ${fullName}`)
      }
      entries.push({ name: fullName.replace(/^\.\//, ''), data: buffer.subarray(dataStart, dataStart + size) })
    }
    offset = dataStart + Math.ceil(size / 512) * 512
  }
  return entries
}

/**
 * Write one tar entry under a destination root, refusing path escapes.
 * @param rootDir - the destination root.
 * @param entry - the tar entry.
 */
function writeEntry(rootDir, entry) {
  const target = resolve(rootDir, entry.name)
  if (!target.startsWith(resolve(rootDir))) throw new Error(`tar: ${entry.name} escapes the destination`)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, entry.data)
}

async function main() {
  mkdirSync(nodeModules, { recursive: true })
  for (const item of packages) {
    const meta = await getJson(`https://registry.npmmirror.com/${item.spec}`)
    const versioned = meta.versions?.[version]
    if (versioned === undefined) throw new Error(`${item.spec}@${version} is not published`)
    const tarball = versioned.dist.tarball
    const integrity = versioned.dist.integrity
    console.log(`fetching ${item.spec}@${version}`)
    const response = await fetch(tarball)
    if (!response.ok) throw new Error(`${tarball} → HTTP ${String(response.status)}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    const digest = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
    if (typeof integrity === 'string' && integrity !== digest) {
      throw new Error(`${item.spec}: integrity mismatch (expected ${integrity}, got ${digest})`)
    }
    rmSync(item.folder, { recursive: true, force: true })
    mkdirSync(item.folder, { recursive: true })
    // Registry tarballs nest everything under a single `package/` root; the
    // install folder IS that root, so the prefix is stripped here.
    for (const entry of readTar(gunzipSync(bytes))) {
      const relative = entry.name.replace(/^package\//, '')
      if (relative === entry.name || relative === '') {
        if (relative === '') continue
        throw new Error(`${item.spec}: unexpected tar entry ${entry.name}`)
      }
      writeEntry(item.folder, { name: relative, data: entry.data })
    }
    console.log(`  installed → ${item.folder}`)
  }
  const bin = join(nodeModules, '@esbuild', 'win32-x64', 'esbuild.exe')
  const probe = readFileSync(bin)
  if (probe.length < 1_000_000) throw new Error(`${bin} looks truncated (${String(probe.length)} bytes)`)
  console.log(`verified ${bin} (${String(probe.length)} bytes)`)
}

await main()
