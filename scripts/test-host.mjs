/**
 * Behavioral tests for the pieces of the host half that can be exercised
 * without a live dsh host: the SakuraFrp log parser, the frpc executable
 * resolver, the token splitter, the pairing state machine, and the
 * remote-channel path rewrite rules.
 *
 * Run: node scripts/test-host.mjs
 */

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

/**
 * The frpc-tunnel helpers are not re-exported from the plugin entry (a cordis
 * plugin exports its face, not its internals), so they are imported from
 * source: Node 24 strips the type annotations natively, and the module has no
 * runtime dependency outside `node:*`.
 * @returns the internal helpers.
 */
async function loadInternals() {
  return await import(pathToFileURL(join(root, 'src', 'frpc-tunnel.ts')).href)
}

const {
  splitToken,
  parseTunnelAddress,
  normalizeHostPort,
  isTunnelReadyLine,
  isFatalLine,
  resolveFrpc,
  FrpcTunnel,
} = await loadInternals()

const lib = await import(pathToFileURL(join(root, 'lib', 'index.js')).href)
const { tunnelBaseUrl, isHttpUrl, pairingConfigOf, defaultDevicesFile } = lib

let failures = 0
let passes = 0

/**
 * Run one named case (a returned promise is awaited before the summary).
 * @param name - case name.
 * @param fn - the assertions.
 * @returns a promise settling when the case finished.
 */
async function test(name, fn) {
  try {
    await fn()
    passes += 1
    console.log(`  ok   ${name}`)
  } catch (error) {
    failures += 1
    console.log(`  FAIL ${name}\n       ${String(error.message).split('\n').join('\n       ')}`)
  }
}

console.log('frpc log parsing')
await test('parses the SakuraFrp TCP connect address', () => {
  assert.equal(parseTunnelAddress('使用 >>frp-cup.com:34437<< 连接你的隧道'), 'frp-cup.com:34437')
})
await test('ignores the "not recommended" node-IP variant', () => {
  assert.equal(parseTunnelAddress('或使用节点 IP 连接 (不推荐) >>45.95.212.18:34437<<'), undefined)
})
await test('ignores the tunnel-start notice that embeds a domain', () => {
  assert.equal(parseTunnelAddress('[74/2531292/6151] [q5s**twm.dsh] 隧道启动成功'), undefined)
})
await test('parses an HTTP tunnel domain line', () => {
  assert.equal(
    parseTunnelAddress('start proxy success, domain: dsh.example.com, local_port: 3080'),
    'dsh.example.com:3080',
  )
})
await test('detects the tunnel-ready notice', () => {
  assert.equal(isTunnelReadyLine('TCP 隧道启动成功'), true)
  assert.equal(isTunnelReadyLine('使用 >>frp-cup.com:34437<< 连接你的隧道'), false)
})
await test('detects fatal token failures', () => {
  assert.equal(isFatalLine('访问密钥无效'), true)
  assert.equal(isFatalLine('隧道不存在'), true)
  assert.equal(isFatalLine('正在重试连接节点...'), false)
})
await test('normalizes address tokens', () => {
  assert.equal(normalizeHostPort('https://a.example.com:8443/path'), 'a.example.com:8443')
  assert.equal(normalizeHostPort('45.95.212.18:34437'), undefined)
  assert.equal(normalizeHostPort(''), undefined)
})

console.log('token + executable resolution')
await test('splits the combined token form', () => {
  assert.deepEqual(splitToken('example0000000000000000000000000:12345678'), {
    token: 'example0000000000000000000000000',
    tunnelIds: '12345678',
  })
})
await test('leaves a bare token alone', () => {
  assert.deepEqual(splitToken('  abcdef  '), { token: 'abcdef', tunnelIds: '' })
})
await test('resolves an absolute frpc path', () => {
  const resolved = resolveFrpc('D:\\dsh-web-exe\\frpc.exe', { exists: () => true, pathEntries: () => [] })
  assert.equal(resolved, 'D:\\dsh-web-exe\\frpc.exe')
})
await test('returns undefined for a missing absolute path', () => {
  assert.equal(resolveFrpc('C:\\nope\\frpc.exe', { exists: () => false, pathEntries: () => [] }), undefined)
})
await test('resolves a bare name from PATH', () => {
  const resolved = resolveFrpc('frpc', { exists: (p) => p.endsWith('frpc.exe'), pathEntries: () => ['C:\\bin'] })
  assert.equal(resolved, join('C:\\bin', 'frpc.exe'))
})

console.log('public base derivation')
await test('prefers the running tunnel address', () => {
  assert.equal(
    tunnelBaseUrl({ phase: 'running', url: 'http://frp-cup.com:34437' }, 'http://manual.example.com'),
    'http://frp-cup.com:34437',
  )
})
await test('falls back to the configured override', () => {
  assert.equal(tunnelBaseUrl({ phase: 'failed', error: 'x' }, 'https://manual.example.com/'), 'https://manual.example.com')
})
await test('strips a trailing slash', () => {
  assert.equal(tunnelBaseUrl({ phase: 'running', url: 'http://a.example.com:1234/' }, undefined), 'http://a.example.com:1234')
})
await test('ignores a non-http override', () => {
  assert.equal(tunnelBaseUrl({ phase: 'idle' }, 'ftp://nope'), undefined)
})
await test('validates http(s) urls', () => {
  assert.equal(isHttpUrl('https://a.example.com'), true)
  assert.equal(isHttpUrl('a.example.com'), false)
})

console.log('config mapping')
await test('maps the resolved config onto the pairing service', () => {
  const mapped = pairingConfigOf({
    tokenTtlMs: 1,
    offlineAfterMs: 2,
    maxDevices: 3,
    idleExpireMs: 4,
    cookieName: 'c',
    devicesFile: 'f',
  })
  assert.deepEqual(mapped, {
    tokenTtlMs: 1,
    offlineAfterMs: 2,
    maxDevices: 3,
    idleExpireMs: 4,
    cookieName: 'c',
    devicesFile: 'f',
  })
})
await test('defaults the device store under DSH_HOME', () => {
  assert.equal(defaultDevicesFile('C:\\home\\x'), join('C:\\home\\x', 'dsh-remote-link-devices.json'))
})

console.log('tunnel lifecycle (fake frpc)')

/** A fake frpc child: the manager's seams are the only thing under test. */
function fakeChild() {
  const stdoutHandlers = []
  const exitHandlers = []
  const child = {
    pid: 4242,
    killed: false,
    stdout: { on: (event, handler) => { if (event === 'data') stdoutHandlers.push(handler) } },
    stderr: { on: () => {} },
    on: (event, handler) => { if (event === 'exit') exitHandlers.push(handler) },
    kill: () => { child.killed = true; return true },
    emit: (text) => { for (const handler of stdoutHandlers) handler(Buffer.from(text, 'utf8')) },
    exit: (code) => { for (const handler of exitHandlers) handler(code) },
  }
  return child
}

await test('reports running with the parsed public URL', () => {
  const child = fakeChild()
  const frames = []
  const tunnel = new FrpcTunnel(info => { frames.push(info) }, { startTimeoutMs: 5_000, restartDelayMs: 5 }, {
    spawn: () => child,
    exists: () => true,
    now: () => 0,
    pathEntries: () => [],
  })
  tunnel.start({ token: 't', tunnelIds: '1', frpcPath: 'frpc.exe', localPort: 3080 })
  child.emit('2026/09/12 22:55:16 [I] 隧道启动中: [dsh, tcp]\r\nTCP 隧道启动成功\r\n使用 >>frp-cup.com:34437<< 连接你的隧道\r\n')
  assert.equal(tunnel.info.phase, 'running')
  assert.equal(tunnel.info.url, 'http://frp-cup.com:34437')
  assert.equal(frames[0].phase, 'starting')
  assert.equal(frames.at(-1).url, 'http://frp-cup.com:34437')
  tunnel.dispose()
  assert.equal(child.killed, true)
  assert.equal(tunnel.info.phase, 'idle')
})
await test('reports failure when the executable is missing', () => {
  const tunnel = new FrpcTunnel(() => {}, undefined, {
    spawn: () => { throw new Error('should not spawn') },
    exists: () => false,
    now: () => 0,
    pathEntries: () => [],
  })
  const started = tunnel.start({ token: 't', tunnelIds: '', frpcPath: 'C:\\nope\\frpc.exe', localPort: 3080 })
  assert.equal(started, undefined)
  assert.equal(tunnel.info.phase, 'failed')
  assert.match(tunnel.info.error, /not found/)
})
await test('fails on a fatal token error', () => {
  const child = fakeChild()
  const tunnel = new FrpcTunnel(() => {}, { startTimeoutMs: 5_000, restartDelayMs: 5 }, {
    spawn: () => child,
    exists: () => true,
    now: () => 0,
    pathEntries: () => [],
  })
  tunnel.start({ token: 'bad', tunnelIds: '', frpcPath: 'frpc.exe', localPort: 3080 })
  child.emit('访问密钥无效, 请检查\n')
  assert.equal(tunnel.info.phase, 'failed')
  assert.match(tunnel.info.error, /密钥无效/)
  tunnel.dispose()
})
await test('restarts after an unexpected exit', () => {
  let spawned = 0
  const children = []
  const tunnel = new FrpcTunnel(() => {}, { startTimeoutMs: 5_000, restartDelayMs: 1 }, {
    spawn: () => { spawned += 1; const child = fakeChild(); children.push(child); return child },
    exists: () => true,
    now: () => 0,
    pathEntries: () => [],
  })
  tunnel.start({ token: 't', tunnelIds: '', frpcPath: 'frpc.exe', localPort: 3080 })
  assert.equal(spawned, 1)
  children[0].exit(1)
  assert.equal(tunnel.info.phase, 'failed')
  return new Promise((resolvePromise) => {
    setTimeout(() => {
      assert.equal(spawned, 2)
      tunnel.dispose()
      resolvePromise()
    }, 30)
  })
})


console.log('LAN address ranking')
const { rankLanCandidates, lanIPv4Addresses } = await import(pathToFileURL(join(root, 'src', 'lan.ts')).href)

/** The build machine's real shape: a virtual switch enumerated BEFORE the WLAN. */
const machineShape = {
  'vEthernet (Default Switch)': [{ address: '172.19.240.1', family: 'IPv4', internal: false }],
  WLAN: [{ address: '192.168.68.161', family: 'IPv4', internal: false }],
  'Loopback Pseudo-Interface 1': [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
}

await test('ranks the physical adapter above a virtual switch', () => {
  const ranked = rankLanCandidates(machineShape, undefined)
  assert.equal(ranked[0].address, '192.168.68.161', 'the WLAN address comes first')
  assert.equal(ranked[1].address, '172.19.240.1', 'the Hyper-V switch sorts last')
  assert.equal(ranked[1].virtual, true, 'the virtual switch is flagged')
})
await test('never drops an address, even a virtual one', () => {
  const ranked = rankLanCandidates(machineShape, undefined)
  assert.deepEqual(ranked.map(c => c.address).sort(), ['172.19.240.1', '192.168.68.161'])
})
await test('a VPN default route does not outrank a physical LAN address', () => {
  const ranked = rankLanCandidates({
    'vEthernet (WSL)': [{ address: '172.30.0.1', family: 'IPv4', internal: false }],
    Ethernet: [{ address: '10.0.0.7', family: 'IPv4', internal: false }],
  }, '172.30.0.1')
  assert.equal(ranked[0].address, '10.0.0.7', 'phones need the physical LAN, not the VPN default route')
})
await test('a TUN proxy benchmark address never becomes the default QR address', () => {
  const ranked = rankLanCandidates({
    'ninja-tun': [{ address: '198.18.0.1', family: 'IPv4', internal: false }],
    WLAN: [{ address: '192.168.68.161', family: 'IPv4', internal: false }],
  }, '198.18.0.1')
  assert.equal(ranked[0].address, '192.168.68.161')
  assert.equal(ranked[1].virtual, true)
})
await test('deprioritizes APIPA and skips loopback', () => {
  const ranked = rankLanCandidates({
    Ethernet: [{ address: '169.254.10.20', family: 'IPv4', internal: false }],
    WLAN: [{ address: '192.168.1.20', family: 'IPv4', internal: false }],
    Loopback: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
  }, undefined)
  assert.deepEqual(ranked.map(c => c.address), ['192.168.1.20', '169.254.10.20'])
  assert.equal(ranked.some(c => c.address === '127.0.0.1'), false, 'loopback is never a candidate')
})
await test('ignores IPv6 entries', () => {
  const ranked = rankLanCandidates({
    Ethernet: [{ address: 'fe80::1', family: 'IPv6', internal: false }, { address: '192.168.1.5', family: 'IPv4', internal: false }],
  }, undefined)
  assert.deepEqual(ranked.map(c => c.address), ['192.168.1.5'])
})
await test('on this machine the reachable address is preferred', () => {
  const ranked = lanIPv4Addresses()
  console.log(`       (this machine: ${ranked.join(' , ') || 'none'})`)
  if (ranked.length > 1) {
    assert.equal(ranked[0], '192.168.68.161', 'the WLAN address outranks the Hyper-V switch')
  }
})

console.log('LAN bind block (Web GUI 的局域网开关)')
const { managedBlock, managedBindOf, stripManagedBlock, writeLanBind, lanBindState, profilePatchFile } =
  await import(pathToFileURL(join(root, 'src', 'lan-bind.ts')).href)

await test('the managed block pins only the host and keeps the port expression', () => {
  const block = managedBlock('0.0.0.0')
  assert.match(block, /host: '0\.0\.0\.0'/, 'host is materialized')
  assert.match(block, /port: !!js ctx\.webStartup\.port \?\? 3080/, 'port keeps the composition expression')
  assert.equal(/^\s*port:\s*\d+\s*$/m.test(block), false, 'no literal port is pinned')
  assert.match(managedBlock('127.0.0.1'), /host: '127\.0\.0\.1'/)
})
await test('parsing the block reports the host and leaves the port undefined', () => {
  const state = managedBindOf(managedBlock('0.0.0.0'))
  assert.equal(state?.host, '0.0.0.0')
  assert.equal(state?.port, undefined, 'a non-literal port reports as undefined')
  assert.equal(managedBindOf('[]'), undefined, 'no block → undefined')
})
await test('a legacy block with a literal port is still parsed', () => {
  const legacy = [
    '# --- dsh-remote-link lan-bind block (managed - do not edit) ---',
    '- id: webserver',
    "  name: '@deepseek-ai/dsh-host-webserver'",
    '  config:',
    "    host: '0.0.0.0'",
    '    port: 3401',
    '# --- end dsh-remote-link lan-bind block ---',
  ].join('\n')
  const state = managedBindOf(legacy)
  assert.equal(state?.host, '0.0.0.0')
  assert.equal(state?.port, 3401)
})
await test('writing the block keeps the rest of the patch file and never stacks rows', () => {
  const home = mkdtempSync(join(tmpdir(), 'dsh-remote-link-lanbind-'))
  try {
    mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
    const file = profilePatchFile('web', home)
    writeFileSync(file, '# my own override\n[]\n')
    writeLanBind('0.0.0.0', undefined, 'web', home)
    const content = readFileSync(file, 'utf8')
    assert.match(content, /# my own override/, 'the user note survives')
    assert.match(content, /host: '0\.0\.0\.0'/, 'the block is written')
    assert.equal(/^\s*\[\s*\]\s*$/m.test(content), false, 'the empty-list placeholder is gone')
    assert.deepEqual(lanBindState('web', home), { blockPresent: true, host: '0.0.0.0', port: undefined })
    writeLanBind('127.0.0.1', undefined, 'web', home)
    const flipped = readFileSync(file, 'utf8')
    assert.equal((flipped.match(/id: webserver/g) ?? []).length, 1, 'exactly one webserver row')
    assert.match(flipped, /host: '127\.0\.0\.1'/)
    assert.equal(stripManagedBlock(flipped).includes('lan-bind block'), false, 'stripping removes the markers')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

console.log('read-only file viewer (confinement)')

const viewerRootA = mkdtempSync(join(tmpdir(), 'dsh-remote-link-root-a-'))
const viewerRootB = mkdtempSync(join(tmpdir(), 'dsh-remote-link-root-b-'))
const viewerRootC = mkdtempSync(join(tmpdir(), 'dsh-remote-link-root-c-'))
writeFileSync(join(viewerRootA, 'a.txt'), 'A')
writeFileSync(join(viewerRootB, 'b.txt'), 'B')
writeFileSync(join(viewerRootC, 'c.txt'), 'C')

await test('normalizes a root-relative path and refuses every .. segment', () => {
  assert.equal(lib.normalizeViewerPath(undefined), '')
  assert.equal(lib.normalizeViewerPath('src/index.ts'), 'src/index.ts')
  assert.equal(lib.normalizeViewerPath('./src//index.ts'), 'src/index.ts')
  assert.equal(lib.normalizeViewerPath('src\\index.ts'), 'src/index.ts')
  assert.equal(lib.normalizeViewerPath('/etc/passwd'), 'etc/passwd')
  assert.equal(lib.normalizeViewerPath('..'), undefined)
  assert.equal(lib.normalizeViewerPath('src/../../etc'), undefined)
  assert.equal(lib.normalizeViewerPath('src\\..\\..\\etc'), undefined)
  assert.equal(lib.normalizeViewerPath('a\0b'), undefined)
})

await test('resolves only inside the root, through symlinks too', async () => {
  const inside = await lib.resolveInsideRoot(viewerRootA, 'a.txt')
  assert.ok(inside !== undefined, 'a file inside the root resolves')
  assert.ok(inside.toLowerCase().endsWith('a.txt'))
  assert.equal(await lib.resolveInsideRoot(viewerRootA, `../${basename(viewerRootB)}/b.txt`), undefined,
    'a sibling directory is out of bounds')
  assert.equal(await lib.resolveInsideRoot(viewerRootA, 'nope.txt'), undefined, 'a missing file resolves to nothing')
  const link = join(viewerRootA, 'escape')
  try {
    symlinkSync(viewerRootB, link, 'junction')
  } catch {
    console.log('       (this platform refused the symlink; the link case was skipped)')
    return
  }
  assert.equal(await lib.resolveInsideRoot(viewerRootA, 'escape/b.txt'), undefined, 'a symlink out is refused')
})

await test('roots follow the most recently active session, then the workspaces', async () => {
  const ctx = {
    get: (name) => name === 'sessions'
      ? {
          list: () => [
            { seq: 2, header: { cwd: viewerRootA }, eventAt: (seq) => ({ time: seq === 0 ? 1000 : 2000 }) },
            { seq: 2, header: { cwd: viewerRootB }, eventAt: () => ({ time: 9000 }) },
          ],
        }
      : name === 'workspaceRegistry'
        ? {
            list: () => [
              { id: 'w-b', title: 'B 项目', path: viewerRootB },
              { id: 'w-c', title: 'C 项目', path: viewerRootC },
            ],
          }
        : undefined,
  }
  const roots = await lib.viewerRoots(ctx)
  assert.equal(roots[0].id, 'session', 'the live session is the default root')
  assert.equal(roots[0].path.toLowerCase(), viewerRootB.toLowerCase(), 'the newest session wins')
  assert.deepEqual(roots.slice(1).map(entry => entry.id), ['w-c', 'cwd'],
    'the workspace list follows, the duplicate drops, and the cwd fallback stays last')
})

await test('a session working directory that disappeared is dropped', async () => {
  const ctx = {
    get: (name) => name === 'sessions'
      ? { list: () => [{ seq: 1, header: { cwd: join(viewerRootA, 'gone') }, eventAt: () => ({ time: 5 }) }] }
      : undefined,
  }
  const roots = await lib.viewerRoots(ctx)
  assert.equal(roots.some(entry => entry.id === 'session'), false)
  assert.equal(roots.some(entry => entry.id === 'cwd'), true)
})

await test('without the harness services the viewer still has one root', async () => {
  const roots = await lib.viewerRoots({ get: () => undefined })
  assert.equal(roots.length, 1)
  assert.equal(roots[0].id, 'cwd')
  assert.equal(roots[0].path.toLowerCase(), process.cwd().toLowerCase())
})

for (const dir of [viewerRootA, viewerRootB, viewerRootC]) rmSync(dir, { recursive: true, force: true })

console.log('')
console.log(`${String(passes)} passed, ${String(failures)} failed`)
if (failures > 0) process.exitCode = 1
