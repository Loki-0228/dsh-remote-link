/**
 * End-to-end test of the host half against a fake cordis context.
 *
 * The real harness is not started: this drives `apply()` with a context that
 * records the routes, upgrades, and event listeners the plugin registers, then
 * exercises those handlers over real HTTP (the plugin's loopback proxy talks to
 * a real inner server, exactly as it does in production).
 *
 * Covered: the QR link shape, the accept → device-cookie round trip, the
 * heartbeat/status surface, the loopback-only fence on the control endpoints,
 * the gated /remote channel (unpaired 403 vs paired proxy), and the
 * local-only prefixes.
 *
 * Run: node scripts/test-plugin-boot.mjs
 */

import assert from 'node:assert/strict'
import { createServer, request as httpRequest } from 'node:http'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { PassThrough, Writable } from 'node:stream'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
// The vendored cordis is the same instance the built host bundle imports, so
// the service system (Service registration, ctx.effect, ctx.on) is the real
// one rather than a hand-rolled stub.
const cordis = await import(pathToFileURL(join(root, 'vendor', 'node_modules', '@deepseek-ai', 'cordis', 'lib', 'index.js')).href)
const plugin = await import(pathToFileURL(join(root, 'lib', 'index.js')).href)

let failures = 0
let passes = 0

/**
 * Run one named case.
 * @param name - case name.
 * @param fn - the assertions.
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

/**
 * A real cordis context carrying a recording web server.
 *
 * `webServer`, `typertGateway`, and `connection` are plain data properties:
 * cordis's own service registry only governs services registered through
 * `reflect`, and the plugin reads these three as injected values. The
 * `webserver/index-inject` taps are recorded by wrapping `ctx.on`, so the
 * index-injection contract can be asserted without a real renderer.
 * @returns the shell.
 */
function makeShell() {
  const routes = []
  const upgrades = []
  const taps = []
  const ctx = new cordis.Context()
  const webServer = {
    host: '0.0.0.0',
    port: 0,
    register(route) {
      assert.equal(routes.some(r => r.kind === route.kind && r.path === route.path), false, `duplicate route ${route.path}`)
      routes.push(route)
      return () => { routes.splice(routes.indexOf(route), 1) }
    },
    registerUpgrade(route) {
      upgrades.push(route)
      return () => { upgrades.splice(upgrades.indexOf(route), 1) }
    },
  }
  Object.defineProperty(ctx, 'webServer', { value: webServer, writable: true, configurable: true })
  Object.defineProperty(ctx, 'typertGateway', { value: {}, writable: true, configurable: true })
  Object.defineProperty(ctx, 'connection', { value: {}, writable: true, configurable: true })
  const originalOn = ctx.on.bind(ctx)
  ctx.on = (name, handler) => {
    if (name === 'webserver/index-inject') taps.push(handler)
    return originalOn(name, handler)
  }
  return { ctx, routes, upgrades, taps }
}

/**
 * Drive one handler with a real HTTP-ish request/response pair.
 * @param handler - the route handler.
 * @param options - request options.
 * @returns the captured response.
 */
function callRoute(handler, options = {}) {
  const {
    method = 'GET',
    url = '/',
    headers = {},
    remoteAddress = '127.0.0.1',
    host = '127.0.0.1:3080',
    body,
  } = options
  const request = new PassThrough()
  const headerMap = { host, ...headers }
  if (body !== undefined) {
    // The proxy forwards content-length verbatim; without it the inner server
    // waits for a body it never sees and answers 408.
    headerMap['content-length'] = String(Buffer.byteLength(body, 'utf8'))
  }
  Object.assign(request, {
    method,
    url,
    headers: headerMap,
    socket: { remoteAddress },
    resume() {},
    destroy() { request.end() },
    async *[Symbol.asyncIterator]() {
      if (body !== undefined) yield Buffer.from(body, 'utf8')
    },
  })
  // The body must not be written before the handler attaches its pipe: a
  // stream that already ended makes Node answer 408 Request Timeout.
  setImmediate(() => {
    request.end(body === undefined ? undefined : Buffer.from(body, 'utf8'))
  })
  return new Promise((resolvePromise) => {
    const chunks = []
    let settled = false
    // A real Writable: the plugin's proxy pipes the upstream response into it,
    // and a plain object would fail on `.once`/`.pipe`.
    const response = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk))
        callback()
      },
      final(callback) { callback() },
    })
    Object.assign(response, {
      statusCode: 0,
      headers: {},
      writeHead(status, headers = {}) { response.statusCode = status; response.headers = headers; return response },
      setHeader(name, value) { response.headers[name] = value },
    })
    const settle = () => {
      if (settled) return
      settled = true
      resolvePromise({
        status: response.statusCode,
        headers: response.headers,
        text: Buffer.concat(chunks).toString('utf8'),
      })
    }
    response.on('finish', settle)
    response.end = ((original) => function end(chunk, encoding, callback) {
      const result = original.call(response, chunk, encoding, callback)
      settle()
      return result
    })(response.end.bind(response))
    response.on('error', settle)
    const result = handler(request, response)
    if (result !== undefined && typeof result.then === 'function') result.catch(() => {})
  })
}

/** Find one registered route by path. */
function routeOf(routes, path) {
  const route = routes.find(candidate => candidate.path === path)
  assert.ok(route !== undefined, `route ${path} is registered`)
  return route
}

/**
 * Mount the plugin against a fresh shell.
 * @param config - plugin config overrides.
 * @param innerPort - the port the plugin's proxy should target.
 * @returns the shell and the recorded registrations.
 */
function mount(config = {}, innerPort = 0) {
  const made = makeShell()
  made.ctx.webServer.port = innerPort
  plugin.apply(made.ctx, {
    requirePairingForLan: true,
    // Keep the device store inside the OS temp dir: the test must not touch
    // the real $DSH_HOME.
    devicesFile: join(process.env.TEMP ?? '/tmp', `dsh-remote-link-test-${String(process.pid)}.json`),
    ...config,
  })
  return made
}

const tmpStore = join(process.env.TEMP ?? '/tmp', `dsh-remote-link-test-${String(process.pid)}.json`)

console.log('plugin mounting')
await test('registers the pairing route family', () => {
  const { routes } = mount()
  for (const path of [
    '/api/pair/issue',
    '/api/pair/accept',
    '/api/pair/stop',
    '/api/pair/revoke',
    '/api/pair/heartbeat',
    '/api/pair/status',
    '/api/pair/events',
    '/api/pair/lan-bind',
    '/pair-accept',
    '/pair-app',
    '/pair-app.sw.js',
    // The root seat: the shell for an already-paired device (its reload path).
    '/',
  ]) routeOf(routes, path)
})
await test('registers the gated channel and its upgrade paths', () => {
  const { routes, upgrades } = mount()
  routeOf(routes, '/remote')
  assert.deepEqual(upgrades.map(u => u.path).sort(), [
    '/remote/api/dsh-ssh/terminal',
    '/remote/api/remote.mux',
    '/remote/sidebar/ws/agent-terminals',
    '/remote/sidebar/ws/terminal',
  ])
})
await test('injects the boot patch and the uuid polyfill into the index', () => {
  const { taps } = mount()
  assert.equal(taps.length, 2)
  const table = []
  for (const tap of taps) tap(table)
  assert.equal(table.length, 2)
  assert.ok(table[0].text.includes('randomUUID'))
  assert.ok(table[1].text.includes('__DSH_REMOTE_LINK_BOOT__'))
})
await test('registers the pairing-access service under the upstream lookup key', () => {
  const made = mount({}, 0)
  assert.ok(made.ctx.remoteWebUiPairing !== undefined, 'remoteWebUiPairing service is registered')
  assert.equal(typeof made.ctx.remoteWebUiPairing.isPairedDevice, 'function')
})

console.log('pairing round trip (LAN origin)')
const lanShell = mount()
const lanAccept = routeOf(lanShell.routes, '/api/pair/accept')
const lanIssue = routeOf(lanShell.routes, '/api/pair/issue')
const lanStatus = routeOf(lanShell.routes, '/api/pair/status')
const lanAcceptPage = routeOf(lanShell.routes, '/pair-accept')
const lanHeartbeat = routeOf(lanShell.routes, '/api/pair/heartbeat')
const lanBind = routeOf(lanShell.routes, '/api/pair/lan-bind')

let issuedUrl = ''
let deviceCookie = ''

await test('issues a LAN QR link from the loopback control endpoint', async () => {
  const response = await callRoute(lanIssue.handler, { method: 'POST', url: '/api/pair/issue', host: '127.0.0.1:3080' })
  assert.equal(response.status, 200)
  const body = JSON.parse(response.text)
  assert.equal(body.ok, true)
  assert.match(body.url, /^http:\/\/[\d.]+:0\/pair-accept\?pair=[0-9a-f]{32}$/)
  assert.equal(typeof body.expiresAt, 'number')
  issuedUrl = body.url
})
await test('refuses the control endpoint from a LAN origin', async () => {
  const response = await callRoute(lanIssue.handler, {
    method: 'POST',
    url: '/api/pair/issue',
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
  })
  assert.equal(response.status, 403)
})
await test('the QR entry page accepts the token and redirects with a device cookie', async () => {
  const token = new URL(issuedUrl).searchParams.get('pair')
  const response = await callRoute(lanAcceptPage.handler, {
    method: 'GET',
    url: `/pair-accept?pair=${String(token)}`,
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
    headers: { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document', 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/120' },
  })
  assert.equal(response.status, 303)
  assert.match(response.headers.location, /^http:\/\/192\.168\.1\.50:3080\/pair-app\?device=[0-9a-f]{32}$/)
  const cookies = [].concat(response.headers['set-cookie'] ?? [])
  assert.ok(cookies.some(value => value.startsWith('dsh_remote_link=')), 'device cookie is set')
  deviceCookie = cookies.find(value => value.startsWith('dsh_remote_link=')).split(';')[0]
})
await test('a paired device reports paired=true', async () => {
  const response = await callRoute(lanStatus.handler, {
    method: 'GET',
    url: '/api/pair/status',
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
    headers: { cookie: deviceCookie },
  })
  assert.equal(response.status, 200)
  const body = JSON.parse(response.text)
  assert.equal(body.paired, true)
  assert.equal(body.requirePairingForLan, true)
  assert.equal(body.phase, 'connected')
  assert.equal(body.devices, undefined, 'the roster never rides the phone-facing status')
})
await test('an unpaired device gets only the public pairing fields', async () => {
  const response = await callRoute(lanStatus.handler, {
    method: 'GET',
    url: '/api/pair/status',
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
  })
  const body = JSON.parse(response.text)
  assert.equal(body.paired, false)
  assert.equal(body.tokenId, undefined)
  assert.equal(body.tokenExpiresAt, undefined)
})
await test('heartbeat refreshes a paired device and refuses an unpaired one', async () => {
  const paired = await callRoute(lanHeartbeat.handler, {
    method: 'POST',
    url: '/api/pair/heartbeat',
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
    headers: { cookie: deviceCookie },
  })
  assert.equal(paired.status, 200)
  const unpaired = await callRoute(lanHeartbeat.handler, {
    method: 'POST',
    url: '/api/pair/heartbeat',
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
  })
  assert.equal(unpaired.status, 401)
})
await test('an expired token yields the bilingual failure page', async () => {
  const response = await callRoute(lanAcceptPage.handler, {
    method: 'GET',
    url: '/pair-accept?pair=00000000000000000000000000000000',
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
    headers: { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' },
  })
  assert.equal(response.status, 200)
  assert.ok(response.text.includes('配对已失效'), 'Chinese explanation present')
  assert.ok(response.text.includes('This pairing has expired'), 'English explanation present')
})
await test('the LAN-bind status endpoint is loopback-only', async () => {
  const local = await callRoute(lanBind.handler, { method: 'GET', url: '/api/pair/lan-bind', host: '127.0.0.1:3080' })
  assert.equal(local.status, 200)
  assert.equal(JSON.parse(local.text).bindHost, '0.0.0.0')
  const lan = await callRoute(lanBind.handler, {
    method: 'GET',
    url: '/api/pair/lan-bind',
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
  })
  assert.equal(lan.status, 403)
})

console.log('gated remote channel (proxy to loopback)')
await test('unpaired channel requests are refused with the SDK envelope', async () => {
  const response = await callRoute(routeOf(lanShell.routes, '/remote').handler, {
    method: 'POST',
    url: '/remote/api/session.list',
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
    body: '{}',
  })
  assert.equal(response.status, 403)
  const body = JSON.parse(response.text)
  assert.equal(body.result.error.code, 'unpaired')
})
await test('local-only prefixes stay unreachable even for a paired device', async () => {
  const response = await callRoute(routeOf(lanShell.routes, '/remote').handler, {
    method: 'POST',
    url: '/remote/api/plugin-manager/install',
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
    headers: { cookie: deviceCookie },
    body: '{}',
  })
  assert.equal(response.status, 403)
  assert.match(JSON.parse(response.text).result.error.message, /stays physically local/)
})

// A paired request must reach the inner loopback server, so the test runs a
// real one and points the plugin's proxy at its port.
const inner = createServer((req, res) => {
  if (req.url === '/launch?token=test') {
    res.writeHead(303, { 'set-cookie': 'dsh-auth-abc=xyz; Path=/; HttpOnly' })
    res.end()
    return
  }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ inner: req.url, host: req.headers.host, cookie: req.headers.cookie ?? null }))
})
await new Promise(resolvePromise => { inner.listen(0, '127.0.0.1', resolvePromise) })
const innerPort = inner.address().port

const proxiedShell = makeShell()
proxiedShell.ctx.webServer.port = innerPort
proxiedShell.ctx.connection = { authenticatedUrl: () => `http://127.0.0.1:${String(innerPort)}/launch?token=test` }
const proxiedStore = join(process.env.TEMP ?? '/tmp', `dsh-remote-link-test-proxy-${String(process.pid)}.json`)
plugin.apply(proxiedShell.ctx, { requirePairingForLan: true, devicesFile: proxiedStore })

const proxiedChannel = routeOf(proxiedShell.routes, '/remote').handler
const issueRoute = routeOf(proxiedShell.routes, '/api/pair/issue')
const acceptRoute = routeOf(proxiedShell.routes, '/api/pair/accept')

await test('a paired channel request is proxied to loopback with the inner credential', async () => {
  // The channel handler is gated (it answers every /remote path), so the
  // pairing control endpoints are driven through their own mounted server —
  // exactly the split the real web server makes.
  const controlServer = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0]
    const route = proxiedShell.routes.find(candidate => candidate.path === path)
    if (route === undefined) { res.writeHead(404).end(); return }
    void route.handler(req, res)
  })
  const channelServer = createServer((req, res) => { void proxiedChannel(req, res) })
  await new Promise(resolvePromise => { controlServer.listen(0, '127.0.0.1', resolvePromise) })
  await new Promise(resolvePromise => { channelServer.listen(0, '127.0.0.1', resolvePromise) })
  const controlPort = controlServer.address().port
  const channelPort = channelServer.address().port

  const send = async (port, path, options = {}) => {
    const payload = options.body ?? ''
    return await new Promise((resolvePromise, rejectPromise) => {
      const request = httpRequest({
        host: '127.0.0.1',
        port,
        path,
        method: options.method ?? 'POST',
        headers: {
          host: options.host ?? '192.168.1.50:3080',
          'content-type': 'application/json',
          'content-length': String(Buffer.byteLength(payload, 'utf8')),
          ...(options.cookie !== undefined ? { cookie: options.cookie } : {}),
        },
      }, response => {
        const chunks = []
        response.on('data', chunk => chunks.push(chunk))
        response.on('end', () => resolvePromise({
          status: response.statusCode,
          headers: response.headers,
          text: Buffer.concat(chunks).toString('utf8'),
        }))
      })
      request.on('error', rejectPromise)
      request.end(payload)
    })
  }

  try {
    const issueResponse = await send(controlPort, '/api/pair/issue', { host: '127.0.0.1:3080' })
    assert.equal(issueResponse.status, 200, `issue failed: ${issueResponse.text.slice(0, 200)}`)
    const issued = JSON.parse(issueResponse.text)
    assert.equal(typeof issued.url, 'string', `no url in issue response: ${issueResponse.text.slice(0, 200)}`)
    const token = new URL(issued.url).searchParams.get('pair')
    const accepted = await send(controlPort, '/api/pair/accept', { body: JSON.stringify({ token }) })
    assert.equal(accepted.status, 200, `accept failed: ${accepted.text.slice(0, 200)}`)
    const cookie = [].concat(accepted.headers['set-cookie'] ?? []).find(v => v.startsWith('dsh_remote_link=')).split(';')[0]
    const response = await send(channelPort, '/remote/api/session.list', { body: '{}', cookie })
    assert.equal(response.status, 200, `expected the proxy response; got ${String(response.status)} body=${response.text.slice(0, 300)}`)
    const body = JSON.parse(response.text)
    assert.equal(body.inner, '/api/session.list', 'the inner path keeps its shape')
    assert.equal(body.host, `127.0.0.1:${String(innerPort)}`, 'the inner Host is rewritten to loopback')
    assert.equal(body.cookie, 'dsh-auth-abc=xyz', 'the inner browser credential is attached')
  } finally {
    controlServer.close()
    channelServer.close()
  }
})
/**
 * Mount a plugin instance whose official shell comes from a real loopback
 * server, exactly as production resolves it (the plugin redeems the launch
 * token and fetches `/` with the inner browser credential).
 * @returns the mounted shell, the device id minted by the pairing round trip,
 *   and a cleanup for the shell server.
 */
async function plantedShell() {
  const shellServer = createServer((req, res) => {
    if (req.url === '/launch?token=test-2') {
      res.writeHead(303, { 'set-cookie': 'dsh-auth-def=uvw; Path=/' })
      res.end()
      return
    }
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end('<!doctype html><html><head><title>shell</title></head><body>app</body></html>')
  })
  await new Promise(resolvePromise => { shellServer.listen(0, '127.0.0.1', resolvePromise) })
  const shellPort = shellServer.address().port
  const made = makeShell()
  made.ctx.webServer.port = shellPort
  made.ctx.connection = { authenticatedUrl: () => `http://127.0.0.1:${String(shellPort)}/launch?token=test-2` }
  plugin.apply(made.ctx, {
    requirePairingForLan: true,
    devicesFile: join(process.env.TEMP ?? '/tmp', `dsh-remote-link-test-shell-${String(process.pid)}.json`),
  })
  const issued = JSON.parse((await callRoute(routeOf(made.routes, '/api/pair/issue').handler, { method: 'POST', url: '/api/pair/issue' })).text)
  const token = new URL(issued.url).searchParams.get('pair')
  const page = await callRoute(routeOf(made.routes, '/pair-accept').handler, {
    method: 'GET',
    url: `/pair-accept?pair=${String(token)}`,
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
    headers: { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' },
  })
  const device = new URL(page.headers.location).searchParams.get('device')
  // Leave the fixture as it was found: the live probe further down mounts its
  // own instance and must not inherit this port or a cached fixture shell.
  return {
    made,
    shellPort,
    device,
    close: () => {
      shellServer.close()
      made.ctx.webServer.port = 0
    },
  }
}

const planted = await plantedShell()

await test('the /pair-app landing serves the shell with the device capture script', async () => {
  const app = await callRoute(routeOf(planted.made.routes, '/pair-app').handler, {
    method: 'GET',
    url: `/pair-app?device=${String(planted.device)}`,
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
    headers: { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' },
  })
  assert.equal(app.status, 200)
  assert.ok(app.text.includes('dsh-remote-device'), 'capture script injected')
})

// The reload path: the capture script rewrites the address bar to `/`, so a
// refresh, a bookmark or a tab restore asks for the root document — where the
// harness index fallback would answer its browser-auth 401, a status a paired
// phone can never clear (the cookieless flow holds no browser-auth cookie).
// The plugin's root seat must serve the shell instead, and leave every request
// it does not own to the fallback.
await test('the root document serves the shell to a paired device (the reload path)', async () => {
  const root = routeOf(planted.made.routes, '/')
  const response = await callRoute(root.handler, {
    method: 'GET',
    url: '/',
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
    headers: {
      'sec-fetch-mode': 'navigate',
      'sec-fetch-dest': 'document',
      'sec-fetch-site': 'same-origin',
      cookie: `dsh_remote_link=${String(planted.device)}`,
    },
  })
  assert.equal(response.status, 200)
  assert.match(String(response.headers['content-type']), /text\/html/)
  assert.equal(response.headers['cache-control'], 'no-store', 'the shell is never cached on the device')
  assert.ok(response.text.includes('dsh-remote-device'), 'a device that lost its storage re-captures the credential')
  assert.ok(response.text.includes(String(planted.device)), 'the capture script carries the device credential')
  const cookies = [].concat(response.headers['set-cookie'] ?? [])
  assert.ok(cookies.some(value => value.startsWith(`dsh_remote_link=${String(planted.device)}`)), 'the device cookie is re-armed')
})

await test('the root document answers an unpaired visitor exactly as the harness 401 does', async () => {
  const root = routeOf(planted.made.routes, '/')
  const response = await callRoute(root.handler, {
    method: 'GET',
    url: '/',
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
    headers: { cookie: 'dsh_remote_link=00000000000000000000000000000000' },
  })
  assert.equal(response.status, 401)
  assert.match(String(response.headers['content-type']), /text\/plain/)
  assert.match(response.text, /dsh web authentication required/)
})

await test('the root seat invokes the official auth owner for launch tokens', async () => {
  let called = false
  planted.made.ctx.connection.authorizeIndex = (req, res) => {
    called = true
    assert.equal(req.url, '/?token=deadbeef')
    res.writeHead(401).end('invalid launch token')
    return false
  }
  const root = routeOf(planted.made.routes, '/')
  const response = await callRoute(root.handler, {
    method: 'GET',
    url: '/?token=deadbeef',
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
    headers: { cookie: `dsh_remote_link=${String(planted.device)}` },
  })
  assert.equal(called, true)
  assert.equal(response.status, 401, 'invalid tokens are refused by the auth owner, not swallowed as 404')
  assert.equal(response.text.includes('dsh-remote-device'), false)
})

await test('desktop login redirects, then serves a clean shell without remote pairing', async () => {
  planted.made.ctx.connection.authorizeIndex = (req, res) => {
    if (req.url === '/?token=valid') {
      res.writeHead(303, { location: '/', 'set-cookie': 'desktop=valid; Path=/; HttpOnly' }).end()
      return false
    }
    if (req.headers.cookie === 'desktop=valid') return true
    res.writeHead(401).end('authentication required')
    return false
  }
  const handler = routeOf(planted.made.routes, '/').handler
  const login = await callRoute(handler, { url: '/?token=valid' })
  assert.equal(login.status, 303)
  assert.equal(login.headers.location, '/')
  const authenticated = await callRoute(handler, { headers: { cookie: 'desktop=valid' } })
  assert.equal(authenticated.status, 200)
  assert.ok(authenticated.text.includes('<title>shell</title>'))
  assert.equal(authenticated.text.includes('dsh-remote-device'), false)
  assert.equal(authenticated.headers['set-cookie'], undefined)
  const anonymous = await callRoute(handler)
  assert.equal(anonymous.status, 401)
  const head = await callRoute(handler, { method: 'HEAD', headers: { cookie: 'desktop=valid' } })
  assert.equal(head.status, 200)
  assert.equal(head.text, '')
})

await test('the root document is reachable only over GET/HEAD', async () => {
  const root = routeOf(planted.made.routes, '/')
  const response = await callRoute(root.handler, {
    method: 'POST',
    url: '/',
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
    headers: { cookie: `dsh_remote_link=${String(planted.device)}` },
  })
  assert.equal(response.status, 405)
})

planted.close()

// ── the shell fetch behind the landing (cache + credential retry) ───────────
// /pair-app and the root seat both serve `indexDocument`'s bytes, so its cache
// and its two-attempt fetch are the last hop a phone depends on. The loopback
// fetch cannot present the ORIGIN the device browsed (the process credential
// belongs to 127.0.0.1), so each requester authority gets its own cached
// document instead of one global entry: sharing one would hand a device on one
// origin a shell rendered for another.
{
  let fetches = 0
  let hostless = 0
  const shellServer = createServer((req, res) => {
    fetches += 1
    if (req.headers.cookie === undefined) hostless += 1
    res.writeHead(hostless === 1 && req.headers.cookie === undefined ? 401 : 200, { 'content-type': 'text/html' })
    res.end('<!doctype html><html><head><title>live-shell</title></head><body>app</body></html>')
  })
  await new Promise(resolvePromise => { shellServer.listen(0, '127.0.0.1', resolvePromise) })
  const shellPort = shellServer.address().port
  const cached = makeShell()
  cached.ctx.webServer.port = shellPort
  cached.ctx.connection = { authenticatedUrl: () => `http://127.0.0.1:${String(shellPort)}/launch?token=cache` }
  plugin.apply(cached.ctx, {
    requirePairingForLan: true,
    devicesFile: join(process.env.TEMP ?? '/tmp', `dsh-remote-link-test-cache-${String(process.pid)}.json`),
  })
  const cacheIssued = JSON.parse((await callRoute(routeOf(cached.routes, '/api/pair/issue').handler, { method: 'POST', url: '/api/pair/issue' })).text)
  const cacheToken = new URL(cacheIssued.url).searchParams.get('pair')
  const cachePage = await callRoute(routeOf(cached.routes, '/pair-accept').handler, {
    method: 'GET',
    url: `/pair-accept?pair=${String(cacheToken)}`,
    host: '192.168.1.50:3080',
    remoteAddress: '192.168.1.50',
    headers: { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' },
  })
  const cacheDevice = new URL(cachePage.headers.location).searchParams.get('device')
  /** Ask the root seat for the shell as one device on one authority. */
  const askRoot = (authority) => callRoute(routeOf(cached.routes, '/').handler, {
    method: 'GET',
    url: '/',
    host: authority,
    remoteAddress: authority.split(':')[0],
    headers: { cookie: `dsh_remote_link=${String(cacheDevice)}` },
  })

  console.log('shell fetch (landing credential + per-authority cache)')
  await test('serves the shell when the process credential is refused for the origin it was asked for', async () => {
    const first = await askRoot('192.168.1.50:3080')
    assert.equal(first.status, 200)
    assert.ok(first.text.includes('live-shell'), 'the fetched document is the one served')
    assert.equal(fetches, 2, 'the credential attempt is retried once for the device authority')
  })
  await test('reuses the cached document for the same authority', async () => {
    const before = fetches
    const again = await askRoot('192.168.1.50:3080')
    assert.equal(again.status, 200)
    assert.equal(fetches, before, 'a second reload does not re-fetch')
  })
  await test('never hands one authority the document fetched for another', async () => {
    const before = fetches
    const other = await askRoot('10.0.0.7:3080')
    assert.ok(
      fetches > before,
      `another authority fetches its own document (status ${String(other.status)}, fetches ${String(before)} -> ${String(fetches)})`,
    )
    const settled = fetches
    const again = await askRoot('10.0.0.7:3080')
    assert.equal(again.status, 200)
    assert.equal(fetches, settled, 'and then caches its own copy')
  })
  await test('answers 502 when no seat serves the shell at all', async () => {
    const wasPort = cached.ctx.webServer.port
    await new Promise(resolvePromise => { shellServer.close(resolvePromise) })
    cached.ctx.webServer.port = 9 // closed port: the fetch cannot connect
    const dead = await askRoot('192.168.3.9:3080')
    assert.equal(dead.status, 502)
    cached.ctx.webServer.port = wasPort
  })
}

inner.close()

// ── the read-only file viewer ───────────────────────────────────────────────
// A temp "project directory" whose files the viewer may serve, plus a sibling
// directory it must never reach.
const viewerRoot = mkdtempSync(join(tmpdir(), 'dsh-remote-link-viewer-'))
const viewerOutside = mkdtempSync(join(tmpdir(), 'dsh-remote-link-outside-'))
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
mkdirSync(join(viewerRoot, 'src'))
writeFileSync(join(viewerRoot, 'README.md'), '# hello viewer\n')
writeFileSync(join(viewerRoot, 'src', 'index.ts'), 'export const answer = 42\n')
writeFileSync(join(viewerRoot, 'dot.png'), PNG_1PX)
writeFileSync(join(viewerRoot, 'blob.bin'), Buffer.from([0x00, 0x01, 0x02, 0x03, 0xff]))
writeFileSync(join(viewerRoot, 'big.txt'), 'x'.repeat(1024 * 1024 + 64))
writeFileSync(join(viewerOutside, 'secret.txt'), 'TOP SECRET\n')

/**
 * A shell whose live-session list names one known root, so the viewer settles
 * on a directory this test controls.
 * @returns the mounted shell.
 */
function viewerShell() {
  const made = mount({}, 0)
  made.ctx.provide('sessions', {
    list: () => [{
      seq: 1,
      header: { cwd: viewerRoot, createdAt: Date.now() },
      eventAt: () => ({ time: Date.now() }),
    }],
  })
  return made
}

const viewer = viewerShell()
const viewerPage = routeOf(viewer.routes, '/files')
const viewerRoots = routeOf(viewer.routes, '/api/remote-files/roots')
const viewerList = routeOf(viewer.routes, '/api/remote-files/list')
const viewerFile = routeOf(viewer.routes, '/api/remote-files/file')

/** Read one viewer JSON endpoint. */
async function viewerJson(route, query) {
  const response = await callRoute(route.handler, { method: 'GET', url: `${route.path}${query}` })
  return { status: response.status, body: JSON.parse(response.text), text: response.text }
}

console.log('read-only file viewer')

await test('serves a self-contained page with no editing surface', async () => {
  const response = await callRoute(viewerPage.handler, { method: 'GET', url: '/files' })
  assert.equal(response.status, 200)
  assert.match(String(response.headers['content-type']), /text\/html/)
  assert.ok(response.text.includes('文件查看器'), 'the page names itself')
  assert.ok(response.text.includes('/api/remote-files/list'), 'the page points at its own endpoints')
  assert.equal(response.text.includes('<form'), false, 'no form to submit')
  assert.equal(response.text.includes('contenteditable'), false, 'no editable surface')
})

await test('the page script parses and carries the device credential plumbing', async () => {
  const response = await callRoute(viewerPage.handler, { method: 'GET', url: '/files' })
  const match = /<script>([\s\S]*)<\/script>/.exec(response.text)
  assert.ok(match !== null, 'the page carries one inline script')
  // Compile-only: a syntax error in the served script would be a runtime 404
  // for the user, and this environment has no browser to catch it.
  new Function(match[1])
  assert.ok(match[1].includes('x-dsh-remote-device'), 'the cookieless credential rides the device header')
  assert.ok(match[1].includes('dsh-remote-device'), 'the sessionStorage key matches the capture script')
  assert.equal(response.text.split('</script>').length, 2, 'exactly one closing script tag')
})

await test('the live session working directory is the default root', async () => {
  const { status, body } = await viewerJson(viewerRoots, '')
  assert.equal(status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.root, body.roots[0].id)
  assert.equal(body.roots[0].id, 'session')
  assert.equal(body.roots[0].path.toLowerCase(), viewerRoot.toLowerCase())
  const paths = body.roots.map(root => root.path.toLowerCase())
  assert.equal(new Set(paths).size, paths.length, 'roots are de-duplicated')
})

await test('lists a directory, directories first and nested paths on request', async () => {
  const top = await viewerJson(viewerList, '?root=session')
  assert.equal(top.status, 200)
  const names = top.body.entries.map(entry => entry.name)
  assert.equal(top.body.entries[0].dir, true, 'directories sort first')
  assert.equal(top.body.entries[0].name, 'src')
  assert.ok(names.includes('README.md') && names.includes('dot.png'))
  const nested = await viewerJson(viewerList, '?root=session&path=src')
  assert.equal(nested.status, 200)
  assert.deepEqual(nested.body.entries.map(entry => entry.name), ['index.ts'])
  assert.equal(nested.body.entries[0].path, 'src/index.ts')
})

await test('previews text and images, and reports what it will not preview', async () => {
  const text = await viewerJson(viewerFile, '?root=session&path=README.md')
  assert.equal(text.status, 200)
  assert.equal(text.body.kind, 'text')
  assert.equal(text.body.text, '# hello viewer\n')
  const code = await viewerJson(viewerFile, '?root=session&path=src/index.ts')
  assert.equal(code.body.kind, 'text')
  assert.ok(code.body.text.includes('answer = 42'))
  const image = await viewerJson(viewerFile, '?root=session&path=dot.png')
  assert.equal(image.body.kind, 'image')
  assert.ok(String(image.body.dataUrl).startsWith('data:image/png;base64,'))
  const binary = await viewerJson(viewerFile, '?root=session&path=blob.bin')
  assert.equal(binary.body.kind, 'binary')
  const large = await viewerJson(viewerFile, '?root=session&path=big.txt')
  assert.equal(large.body.kind, 'too-large')
  assert.equal(large.body.size, 1024 * 1024 + 64)
})

await test('refuses traversal, out-of-root files, and unknown roots never widen the root', async () => {
  const traversal = await viewerJson(viewerFile, '?root=session&path=..%2Fsecret.txt')
  assert.equal(traversal.status, 400)
  assert.equal(traversal.body.code, 'bad-path')
  const nestedTraversal = await viewerJson(viewerFile, '?root=session&path=..%2F..%2Fetc%2Fpasswd')
  assert.equal(nestedTraversal.status, 400)
  const backslashTraversal = await viewerJson(viewerFile, '?root=session&path=..%5Csecret.txt')
  assert.equal(backslashTraversal.status, 400)
  const absolute = await viewerJson(viewerFile, '?root=session&path=C%3A%5CWindows%5Cwin.ini')
  assert.equal(absolute.status, 404, 'an absolute path never resolves')
  const sibling = await viewerJson(viewerFile, '?root=session&path=secret.txt')
  assert.equal(sibling.status, 404, 'a file outside the root is not reachable by name')
  const unknownRoot = await viewerJson(viewerFile, '?root=not-a-root&path=README.md')
  assert.equal(unknownRoot.status, 200, 'an unknown root id falls back to the computed root')
  assert.equal(unknownRoot.body.root.id, 'session')
})

await test('a symlink out of the project directory is refused', async () => {
  const link = join(viewerRoot, 'outside-link')
  try {
    symlinkSync(viewerOutside, link, 'junction')
  } catch {
    console.log('       (this platform refused the symlink; escape check skipped)')
    return
  }
  const escaped = await viewerJson(viewerFile, '?root=session&path=outside-link%2Fsecret.txt')
  assert.equal(escaped.status, 404)
  assert.equal(escaped.text.includes('TOP SECRET'), false)
})

await test('the viewer accepts GET only', async () => {
  const list = await callRoute(viewerList.handler, { method: 'POST', url: '/api/remote-files/list' })
  assert.equal(list.status, 405)
  const file = await callRoute(viewerFile.handler, { method: 'DELETE', url: '/api/remote-files/file?path=README.md' })
  assert.equal(file.status, 405)
  const page = await callRoute(viewerPage.handler, { method: 'POST', url: '/files' })
  assert.equal(page.status, 405)
})

await test('the viewer is fenced like the pairing pages (paired device required off loopback)', async () => {
  const lan = { host: '192.168.1.50:3080', remoteAddress: '192.168.1.50' }
  const navigation = { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' }
  const refusedPage = await callRoute(routeOf(lanShell.routes, '/files').handler, {
    method: 'GET',
    url: '/files',
    ...lan,
    headers: navigation,
  })
  assert.equal(refusedPage.status, 403, 'an unpaired LAN device gets no viewer')
  const refusedList = await callRoute(routeOf(lanShell.routes, '/api/remote-files/list').handler, {
    method: 'GET',
    url: '/api/remote-files/list?path=',
    ...lan,
  })
  assert.equal(refusedList.status, 403)
  assert.ok(deviceCookie.startsWith('dsh_remote_link='), 'the pairing round trip produced a device cookie')
  const pairedPage = await callRoute(routeOf(lanShell.routes, '/files').handler, {
    method: 'GET',
    url: '/files',
    ...lan,
    headers: { ...navigation, cookie: deviceCookie },
  })
  assert.equal(pairedPage.status, 200, 'a paired device opens the viewer')
  const deviceId = deviceCookie.slice(deviceCookie.indexOf('=') + 1)
  const headerPage = await callRoute(routeOf(lanShell.routes, '/files').handler, {
    method: 'GET',
    url: '/files',
    ...lan,
    headers: { ...navigation, 'x-dsh-remote-device': deviceId },
  })
  assert.equal(headerPage.status, 200, 'the cookieless device header is accepted too')
})

for (const dir of [viewerRoot, viewerOutside]) rmSync(dir, { recursive: true, force: true })

// The device stores are test-local; remove them.
for (const file of [tmpStore, proxiedStore, join(process.env.TEMP ?? '/tmp', `dsh-remote-link-test-shell-${String(process.pid)}.json`)]) {
  rmSync(file, { force: true })
}

console.log('')
console.log(`${String(passes)} passed, ${String(failures)} failed`)
if (failures > 0) process.exitCode = 1
