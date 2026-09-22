/**
 * Which address does the QR link actually use?
 *
 * Mounts the host half on a real cordis context with an all-interfaces bind,
 * then invokes the `/api/pair/issue` handler directly and prints the URL — the
 * same string the panel renders as a QR.
 *
 * Usage: node scripts/test-lan-qr.mjs
 */

import { dirname, join, resolve } from 'node:path'
import { PassThrough, Writable } from 'node:stream'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const dshModules = 'D:/nodejs/node_modules/@deepseek-ai/dsh/node_modules'

const { Context } = await import(pathToFileURL(join(dshModules, '@deepseek-ai/cordis', 'lib', 'index.js')).href)
const plugin = await import(pathToFileURL(join(root, 'lib', 'index.js')).href)

const routes = []
const ctx = new Context()
Object.defineProperty(ctx, 'webServer', {
  value: {
    host: '0.0.0.0',
    port: 3080,
    register: (route) => { routes.push(route); return () => {} },
    registerUpgrade: () => () => {},
  },
  writable: true,
  configurable: true,
})
Object.defineProperty(ctx, 'typertGateway', { value: {}, writable: true, configurable: true })
Object.defineProperty(ctx, 'connection', { value: {}, writable: true, configurable: true })
plugin.apply(ctx, { devicesFile: join(process.env.TEMP ?? '/tmp', `dsh-remote-link-lan-${String(process.pid)}.json`) })

/** Drive one exact route with a loopback request. */
async function call(path, options = {}) {
  const handler = routes.find(route => route.path === path)?.handler
  if (handler === undefined) throw new Error(`route ${path} not registered`)
  const body = options.body ?? ''
  const request = new PassThrough()
  Object.assign(request, {
    method: options.method ?? 'POST',
    url: path,
    headers: {
      host: options.host ?? '127.0.0.1:3080',
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(body, 'utf8')),
    },
    socket: { remoteAddress: options.remoteAddress ?? '127.0.0.1' },
    resume() {},
    destroy() { request.end() },
  })
  setImmediate(() => { request.end(Buffer.from(body, 'utf8')) })
  return await new Promise((resolvePromise) => {
    const chunks = []
    const response = new Writable({ write(chunk, _e, cb) { chunks.push(Buffer.from(chunk)); cb() } })
    Object.assign(response, {
      statusCode: 0,
      headers: {},
      writeHead(status, headers = {}) { response.statusCode = status; response.headers = headers; return response },
      setHeader(name, value) { response.headers[name] = value },
    })
    response.on('finish', () => resolvePromise({
      status: response.statusCode,
      headers: response.headers,
      text: Buffer.concat(chunks).toString('utf8'),
    }))
    const result = handler(request, response)
    if (result !== undefined && typeof result.then === 'function') result.catch(() => {})
  })
}

// The LAN bases settle after the route probe resolves; the plugin re-publishes
// them, and the issue response reads the published list.
await new Promise(resolvePromise => setTimeout(resolvePromise, 300))

const issued = await call('/api/pair/issue')
const body = JSON.parse(issued.text)
console.log(`issue status: ${String(issued.status)}`)
console.log(`lanAddresses: ${JSON.stringify(body.lanAddresses)}`)
console.log(`virtual:      ${JSON.stringify(body.lanVirtualAddresses ?? [])}`)
console.log(`qr url:       ${String(body.url)}`)

const first = body.lanAddresses?.[0]
const ok = typeof body.url === 'string'
  && first !== undefined
  && body.url.startsWith(`http://${first}:`)
  && first !== '172.19.240.1'
  && Array.isArray(body.lanVirtualAddresses)
console.log(ok
  ? 'RESULT: OK (the QR link uses the first, reachable LAN address)'
  : 'RESULT: FAIL (the QR link does not use the preferred LAN address)')
await ctx.fiber.dispose()
if (!ok) process.exitCode = 1
