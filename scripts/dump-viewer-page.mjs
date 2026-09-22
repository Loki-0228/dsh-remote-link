/**
 * Dump the viewer page the built host half serves, for eyeballing the markup
 * (no browser in this sandbox). Usage: node scripts/dump-viewer-page.mjs [out.html]
 */

import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PassThrough, Writable } from 'node:stream'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const cordis = await import(pathToFileURL(join(root, 'vendor', 'node_modules', '@deepseek-ai', 'cordis', 'lib', 'index.js')).href)
const plugin = await import(pathToFileURL(join(root, 'lib', 'index.js')).href)

const routes = []
const ctx = new cordis.Context()
Object.defineProperty(ctx, 'webServer', {
  value: { host: '127.0.0.1', port: 0, register: (route) => { routes.push(route); return () => {} }, registerUpgrade: () => () => {} },
  writable: true,
  configurable: true,
})
Object.defineProperty(ctx, 'typertGateway', { value: {}, writable: true, configurable: true })
Object.defineProperty(ctx, 'connection', { value: {}, writable: true, configurable: true })
plugin.apply(ctx, { devicesFile: join(process.env.TEMP ?? '/tmp', `dump-viewer-${String(process.pid)}.json`) })

const route = routes.find(candidate => candidate.path === '/files')
const request = new PassThrough()
Object.assign(request, {
  method: 'GET',
  url: '/files',
  headers: { host: '127.0.0.1:3080' },
  socket: { remoteAddress: '127.0.0.1' },
  resume() {},
  destroy() { request.end() },
  async *[Symbol.asyncIterator]() {},
})
const chunks = []
const response = new Writable({ write(chunk, _enc, done) { chunks.push(Buffer.from(chunk)); done() } })
Object.assign(response, {
  statusCode: 0,
  headers: {},
  writeHead(status, headers = {}) { response.statusCode = status; response.headers = headers; return response },
  setHeader(name, value) { response.headers[name] = value },
})
route.handler(request, response)
await new Promise(resolvePromise => { response.on('finish', resolvePromise); response.end = ((original) => function end(...args) { const out = original.call(response, ...args); resolvePromise(); return out })(response.end.bind(response)) })

const html = Buffer.concat(chunks).toString('utf8')
const out = process.argv[2] ?? join(process.env.TEMP ?? '/tmp', 'dsh-remote-link-viewer.html')
writeFileSync(out, html)
console.log(`status=${String(response.statusCode)} bytes=${String(Buffer.byteLength(html))}`)
console.log(`written: ${out}`)
console.log('--- head ---')
console.log(html.slice(0, 420))
console.log('--- body ---')
console.log(html.slice(html.indexOf('<header>'), html.indexOf('<script>')))
