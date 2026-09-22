/**
 * The read-only file viewer: one standalone page (`/files`) and the three GET
 * endpoints it reads, so a paired remote device can look at the files of the
 * project its session runs in — and do nothing else.
 *
 * Why a page of its own rather than a tab in the official UI: the remote side
 * is a phone on a tunnel origin, and this surface must work even when the
 * harness SPA cannot boot there (the plugin's own entry pages already do). It
 * also makes "view only" structural: the route family has no write verb, no
 * editor, and no path the client may name — the client sends a ROOT ID from
 * the list the host just computed and a path RELATIVE to it, never a path of
 * its own choosing.
 *
 * Confinement is enforced per request, in this order:
 * 1. the caller passes the same fence as the pairing pages (loopback, or a
 *    LAN/tunnel authority with a live paired-device cookie when
 *    `requirePairingForLan` is on);
 * 2. the requested root id is resolved against the host's own freshly computed
 *    root list (an unknown id falls back to the default root — a client can
 *    never widen the root);
 * 3. the relative path is normalized, any `..` segment is refused, and the
 *    result is `fs.realpath`ed and required to stay inside the realpath of the
 *    root, so neither `..` nor a symlink can leave the project directory.
 *
 * The roots follow the live session: the working directory of the most
 * recently active live session is the default root, the registered workspaces
 * are the alternatives, and `process.cwd()` is the fallback for a deployment
 * without the workspace/session services.
 * @module dsh-remote-link/file-viewer
 */

import { readdir, readFile, realpath, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { PairingService } from './pairing.ts'
import { isLoopbackClient } from './gate.ts'
import { writeJson } from './http.ts'
import { REMOTE_DEVICE_HEADER, REMOTE_DEVICE_STORAGE_KEY, REMOTE_VIEWER_PATH } from './remote-methods.ts'
import { pairedDeviceIdOf } from './remote-api.ts'

/** Route paths of the viewer (all GET; the page is a top-level navigation). */
export const VIEWER_PATHS = {
  /** The phone-facing page (self-contained; no SPA, no build step). */
  page: REMOTE_VIEWER_PATH,
  /** The roots this host serves (live session, workspaces, fallback). */
  roots: '/api/remote-files/roots',
  /** One directory listing, relative to a root. */
  list: '/api/remote-files/list',
  /** One file's content, relative to a root. */
  file: '/api/remote-files/file',
} as const

/** Largest file the viewer will hand to a browser (text or image). */
export const VIEWER_MAX_BYTES = 1024 * 1024

/** Largest directory listing rendered in one response. */
export const VIEWER_MAX_ENTRIES = 2000

/** Extensions rendered as an image (everything else is text or binary). */
const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'svg',
])

/** Media type per image extension (the data URL's prefix). */
const IMAGE_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  svg: 'image/svg+xml',
}

/** One directory the viewer may serve, as the host resolved it. */
export interface ViewerRoot {
  /** Stable id the client sends back (`session`, a workspace id, or `cwd`). */
  id: string
  /** Display title. */
  title: string
  /** Absolute, canonical directory path. */
  path: string
}

/** One entry of a listing. */
interface ViewerEntry {
  name: string
  /** Path relative to the root, POSIX-separated. */
  path: string
  dir: boolean
  size: number
  mtime: number
}

/** What a request for one file resolved to. */
type FileRead =
  | { kind: 'text'; size: number; mtime: number; text: string }
  | { kind: 'image'; size: number; mtime: number; mime: string; dataUrl: string }
  | { kind: 'binary' | 'too-large'; size: number; mtime: number }

/** Structural view of the harness session store (`ctx.sessions`). */
interface SessionLike {
  readonly seq: number
  readonly header?: { readonly cwd?: string; readonly createdAt?: number }
  eventAt?(seq: number): { readonly time?: number } | undefined
}

/** Structural view of the harness workspace registry (`ctx.workspaceRegistry`). */
interface WorkspaceLike {
  readonly id: string
  readonly title: string
  readonly path: string
}

/** The one thing the roots resolver needs from the host context. */
export interface ViewerContext {
  get(name: string): unknown
}

/**
 * Normalize a client-supplied relative path.
 *
 * Backslashes are taken as separators (a Windows-typed path must not smuggle a
 * segment past the `..` check), a leading slash is dropped (the path is always
 * relative), empty and `.` segments vanish, and ANY `..` segment refuses the
 * whole request — the viewer has no reason to accept one, so it does not try
 * to resolve them.
 * @param raw - the raw query parameter (or undefined).
 * @returns the normalized POSIX relative path, or undefined when it is not an acceptable one.
 */
export function normalizeViewerPath(raw: string | undefined): string | undefined {
  if (raw === undefined) return ''
  if (raw.includes('\0')) return undefined
  const parts: string[] = []
  for (const segment of raw.replace(/\\/g, '/').split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') return undefined
    parts.push(segment)
  }
  return parts.join('/')
}

/** Whether a resolved path is the root itself or lives under it. */
function insideRoot(rootReal: string, candidate: string): boolean {
  const left = process.platform === 'win32' ? rootReal.toLowerCase() : rootReal
  const right = process.platform === 'win32' ? candidate.toLowerCase() : candidate
  if (right === left) return true
  return right.startsWith(left.endsWith(sep) ? left : `${left}${sep}`)
}

/**
 * Resolve one root-relative path to a real path inside the root.
 *
 * The root and the candidate are both `fs.realpath`ed, so a symlink pointing
 * out of the project directory is refused exactly like `..` is.
 * @param root - the root's absolute path.
 * @param relativePath - a path already normalized by {@link normalizeViewerPath}.
 * @returns the canonical path, or undefined when it escapes the root or does not exist.
 */
export async function resolveInsideRoot(root: string, relativePath: string): Promise<string | undefined> {
  let rootReal: string
  try {
    rootReal = await realpath(root)
  } catch {
    return undefined
  }
  const candidate = relativePath === '' ? rootReal : resolve(rootReal, relativePath)
  if (!insideRoot(rootReal, candidate)) return undefined
  let candidateReal: string
  try {
    candidateReal = await realpath(candidate)
  } catch {
    return undefined
  }
  return insideRoot(rootReal, candidateReal) ? candidateReal : undefined
}

/** Whether a buffer looks like text (no NUL byte in its first 8 KiB). */
function looksLikeText(buffer: Buffer): boolean {
  const window = buffer.subarray(0, Math.min(buffer.length, 8192))
  return !window.includes(0)
}

/** The lower-case extension of a path, without the dot. */
function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf(sep) + 1)
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/**
 * Build the root list for one request: the live session's working directory
 * first (that is "the project this session runs in"), then every registered
 * workspace, then the process working directory as a last resort. Paths are
 * canonicalized and de-duplicated, and a directory that no longer exists is
 * dropped.
 * @param ctx - the host context (services are read structurally, so a
 *   deployment without them still gets the fallback root).
 * @returns the roots in display order; never empty.
 */
export async function viewerRoots(ctx: ViewerContext): Promise<ViewerRoot[]> {
  const candidates: { id: string; title: string; path: string }[] = []
  const sessions = ctx.get('sessions') as { list?: () => SessionLike[] } | undefined
  if (typeof sessions?.list === 'function') {
    const live = sessions.list()
    let newest: SessionLike | undefined
    let newestAt = -1
    for (const session of live) {
      const last = typeof session.eventAt === 'function' ? session.eventAt(session.seq - 1) : undefined
      const at = typeof last?.time === 'number' ? last.time : (session.header?.createdAt ?? 0)
      if (at >= newestAt) {
        newestAt = at
        newest = session
      }
    }
    const cwd = newest?.header?.cwd
    if (typeof cwd === 'string' && cwd !== '') candidates.push({ id: 'session', title: '当前会话', path: cwd })
  }
  const registry = ctx.get('workspaceRegistry') as { list?: () => WorkspaceLike[] } | undefined
  if (typeof registry?.list === 'function') {
    for (const workspace of registry.list()) {
      candidates.push({ id: workspace.id, title: workspace.title, path: workspace.path })
    }
  }
  candidates.push({ id: 'cwd', title: '启动目录', path: process.cwd() })

  const roots: ViewerRoot[] = []
  const seen = new Set<string>()
  for (const candidate of candidates) {
    let canonical: string
    try {
      canonical = await realpath(candidate.path)
      const info = await stat(canonical)
      if (!info.isDirectory()) continue
    } catch {
      continue
    }
    const key = process.platform === 'win32' ? canonical.toLowerCase() : canonical
    if (seen.has(key)) continue
    seen.add(key)
    roots.push({ id: candidate.id, title: candidate.title, path: canonical })
  }
  return roots
}

/**
 * Read one file for the viewer, within the preview cap.
 * @param absolute - the canonical path (already confined by {@link resolveInsideRoot}).
 * @param maxBytes - the preview cap.
 * @returns the decoded content or the reason it is not previewable.
 */
async function readViewerFile(absolute: string, maxBytes: number): Promise<FileRead> {
  const info = await stat(absolute)
  const size = info.size
  const mtime = Math.floor(info.mtimeMs)
  if (size > maxBytes) return { kind: 'too-large', size, mtime }
  const buffer = await readFile(absolute)
  const extension = extensionOf(absolute)
  const mime = IMAGE_TYPES[extension]
  if (mime !== undefined) {
    return { kind: 'image', size, mtime, mime, dataUrl: `data:${mime};base64,${buffer.toString('base64')}` }
  }
  if (!looksLikeText(buffer)) return { kind: 'binary', size, mtime }
  return { kind: 'text', size, mtime, text: buffer.toString('utf8') }
}

/** One entry as the client renders it (size and mtime rounded for JSON). */
function toEntry(root: string, absolute: string, name: string, dir: boolean, size: number, mtimeMs: number): ViewerEntry {
  const rel = relative(root, absolute).split(sep).join('/')
  return { name, path: rel, dir, size, mtime: Math.floor(mtimeMs) }
}

/**
 * List one directory, directories first, capped. Entry paths are relative to
 * the ROOT (not to the directory), because that is the path the client sends
 * back for the next request.
 * @param root - the root's canonical path.
 * @param absolute - the canonical directory to list (already confined).
 * @returns sorted entries and whether the cap cut the list.
 */
async function listDirectory(root: string, absolute: string): Promise<{ entries: ViewerEntry[]; truncated: boolean }> {
  const dirents = await readdir(absolute, { withFileTypes: true })
  const entries: ViewerEntry[] = []
  let truncated = false
  for (const dirent of dirents) {
    if (entries.length >= VIEWER_MAX_ENTRIES) {
      truncated = true
      break
    }
    const child = join(absolute, dirent.name)
    let info
    try {
      info = await stat(child)
    } catch {
      continue
    }
    entries.push(toEntry(root, child, dirent.name, info.isDirectory(), info.size, info.mtimeMs))
  }
  entries.sort((left, right) => {
    if (left.dir !== right.dir) return left.dir ? -1 : 1
    return left.name.localeCompare(right.name)
  })
  return { entries, truncated }
}

/**
 * One 500 for a handler that threw before writing anything — a filesystem
 * error (permissions, a file removed mid-listing) is not the caller's fault,
 * and an unhandled rejection would leave the response open.
 * @param res - the response to settle.
 * @param error - the thrown value.
 */
function fail(res: ServerResponse, error: unknown): void {
  if (res.headersSent) {
    res.end()
    return
  }
  writeJson(res, 500, {
    ok: false,
    code: 'read-failed',
    message: error instanceof Error ? error.message : String(error),
  })
}

/** Dependencies of the viewer route family. */
export interface ViewerDeps {  /** The pairing service (device table + cookie name). */
  service: PairingService
  /** The family's LAN/tunnel fence (shared with the pairing pages). */
  lanFence(request: IncomingMessage, navigation?: boolean): boolean
  /**
   * Live policy: when true (default), a non-loopback caller must present a live
   * paired-device credential. When false the LAN is already trusted by the
   * host's own configuration, matching the rest of the family.
   */
  requirePairingForLan?: boolean | (() => boolean)
  /** The roots to serve; defaults to {@link viewerRoots} over the host context. */
  roots(ctx: ViewerContext): Promise<ViewerRoot[]> | ViewerRoot[]
  /** The host context the default roots resolver reads. */
  ctx: ViewerContext
}

/** The self-contained page (no external asset, no build step). */
function viewerPage(): string {
  const deviceKey = JSON.stringify(REMOTE_DEVICE_STORAGE_KEY)
  const deviceHeader = JSON.stringify(REMOTE_DEVICE_HEADER)
  const paths = JSON.stringify(VIEWER_PATHS)
  const style = [
    ':root{color-scheme:light dark}',
    '*{box-sizing:border-box}',
    'body{margin:0;font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:Canvas;color:CanvasText}',
    'header{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 12px;border-bottom:1px solid #8884;position:sticky;top:0;background:Canvas;z-index:2}',
    'h1{margin:0;font-size:15px;font-weight:600}',
    '.tag{font-size:11px;padding:1px 6px;border:1px solid #8886;border-radius:999px;opacity:.8}',
    'select{font:inherit;font-size:13px;padding:3px 6px;border-radius:6px;border:1px solid #8886;background:Canvas;color:inherit;max-width:60vw}',
    'nav{display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:8px 12px;font-size:12px;border-bottom:1px solid #8883;word-break:break-all}',
    'nav button{font:inherit;font-size:12px;border:0;background:none;color:inherit;text-decoration:underline;cursor:pointer;padding:0}',
    'nav span{opacity:.6}',
    'main{display:grid;grid-template-columns:minmax(0,1fr);gap:0}',
    '@media(min-width:760px){main{grid-template-columns:minmax(0,340px) minmax(0,1fr)}#list{border-right:1px solid #8884;height:calc(100vh - 96px);overflow:auto}#preview{height:calc(100vh - 96px);overflow:auto}}',
    'ul{list-style:none;margin:0;padding:0}',
    'li{display:flex;gap:8px;align-items:baseline;padding:7px 12px;border-bottom:1px solid #8882}',
    'li button{flex:1;text-align:left;font:inherit;border:0;background:none;color:inherit;cursor:pointer;padding:0;min-width:0;overflow-wrap:anywhere}',
    'li.dir button::before{content:"📁 "}',
    'li.file button::before{content:"📄 "}',
    'li small{opacity:.6;font-size:11px;flex:none}',
    '#preview{padding:12px;min-width:0}',
    '#preview h2{margin:0 0 6px;font-size:13px;font-weight:600;overflow-wrap:anywhere}',
    '#preview pre{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace}',
    '#preview img{max-width:100%;height:auto;background:#fff;border-radius:6px}',
    '.note{opacity:.7;padding:0 12px 12px}',
    '.err{color:#d9534f;font-weight:600}',
  ].join('')
  const script = [
    '(function(){',
    'var P=' + paths + ',KEY=' + deviceKey + ',HDR=' + deviceHeader + ';',
    'var state={roots:[],root:"",path:""};',
    'function dv(){try{return sessionStorage.getItem(KEY)}catch(e){return null}}',
    'function api(url){',
    'var headers={};var id=dv();if(id)headers[HDR]=id;',
    'return fetch(url,{credentials:"same-origin",cache:"no-store",headers:headers}).then(function(res){',
    'return res.json().catch(function(){return {ok:false,code:"bad-response"}}).then(function(body){',
    'if(!res.ok||body.ok!==true)throw new Error(body.message||body.code||("HTTP "+res.status));return body})})}',
    'function el(id){return document.getElementById(id)}',
    'function text(node,value){node.textContent=value}',
    'function error(message){var box=el("preview");box.innerHTML="";var p=document.createElement("p");p.className="err";text(p,message);box.appendChild(p)}',
    'function renderRoots(){var select=el("root");select.innerHTML="";state.roots.forEach(function(root){',
    'var option=document.createElement("option");option.value=root.id;text(option,root.title+" — "+root.path);',
    'if(root.id===state.root)option.selected=true;select.appendChild(option)})}',
    'function renderCrumbs(body){var nav=el("crumbs");nav.innerHTML="";',
    'var home=document.createElement("button");text(home,state.roots.length>1?"根目录":"项目根");home.onclick=function(){state.path="";load()};nav.appendChild(home);',
    'var parts=state.path===""?[]:state.path.split("/");var walked="";',
    'parts.forEach(function(part){walked=walked===""?part:walked+"/"+part;var here=walked;',
    'nav.appendChild(document.createTextNode(" / "));var b=document.createElement("button");text(b,part);',
    'b.onclick=function(){state.path=here;load()};nav.appendChild(b)});',
    'var count=document.createElement("span");text(count,"  ("+body.entries.length+(body.truncated?"+":"")+" 项)");nav.appendChild(count)}',
    'function renderList(body){var list=el("list");list.innerHTML="";var ul=document.createElement("ul");',
    'if(state.path!==""){var up=document.createElement("li");up.className="dir";var ub=document.createElement("button");',
    'text(ub,"..");ub.onclick=function(){state.path=state.path.split("/").slice(0,-1).join("/");load()};up.appendChild(ub);ul.appendChild(up)}',
    'body.entries.forEach(function(entry){var li=document.createElement("li");li.className=entry.dir?"dir":"file";',
    'var b=document.createElement("button");text(b,entry.name);',
    'b.onclick=function(){if(entry.dir){state.path=entry.path;load()}else{openFile(entry)}};li.appendChild(b);',
    'var meta=document.createElement("small");text(meta,entry.dir?"":size(entry.size));li.appendChild(meta);ul.appendChild(li)});',
    'list.appendChild(ul)}',
    'function size(bytes){if(bytes<1024)return bytes+" B";if(bytes<1048576)return (bytes/1024).toFixed(1)+" KB";return (bytes/1048576).toFixed(1)+" MB"}',
    'function load(){var box=el("preview");box.innerHTML="";var note=el("status");text(note,"…");',
    'api(P.list+"?root="+encodeURIComponent(state.root)+"&path="+encodeURIComponent(state.path)).then(function(body){',
    'text(note,"");renderCrumbs(body);renderList(body)}).catch(function(error_){text(note,"");error(String(error_.message||error_))})}',
    'function openFile(entry){var note=el("status");text(note,"…");',
    'api(P.file+"?root="+encodeURIComponent(state.root)+"&path="+encodeURIComponent(entry.path)).then(function(body){',
    'text(note,"");var box=el("preview");box.innerHTML="";',
    'var title=document.createElement("h2");text(title,entry.path+"  ·  "+size(body.size));box.appendChild(title);',
    'if(body.kind==="text"){var pre=document.createElement("pre");text(pre,body.text);box.appendChild(pre)}',
    'else if(body.kind==="image"){var img=document.createElement("img");img.alt=entry.name;img.src=body.dataUrl;box.appendChild(img)}',
    'else{var p=document.createElement("p");p.className="note";text(p,body.kind==="too-large"?"文件过大，不在页面里预览（上限 1 MB）。":"二进制文件，不预览内容。");box.appendChild(p)}',
    'if(window.innerWidth<760)box.scrollIntoView({behavior:"smooth"})',
    '}).catch(function(error_){text(note,"");error(String(error_.message||error_))})}',
    'api(P.roots).then(function(body){state.roots=body.roots||[];state.root=body.root||(state.roots[0]&&state.roots[0].id)||"";',
    'renderRoots();el("root").onchange=function(event){state.root=event.target.value;state.path="";load()};load()})',
    '.catch(function(error_){error("无法读取目录列表："+String(error_.message||error_))});',
    '})();',
  ].join('')
  return [
    '<!doctype html><html lang="zh"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="referrer" content="no-referrer">',
    '<title>文件查看器（只读）</title>',
    '<style>' + style + '</style></head><body>',
    '<header><h1>文件查看器</h1><span class="tag">只读</span>',
    '<select id="root" aria-label="项目根目录"></select></header>',
    '<nav id="crumbs"></nav>',
    '<main><section id="list"></section><section id="preview"></section></main>',
    '<p class="note" id="status"></p>',
    '<script>' + script + '<' + '/script>',
    '</body></html>',
  ].join('')
}

/**
 * Build the viewer's routes.
 * @param deps - the pairing service, the shared LAN fence, and the roots source.
 * @returns the routes to register on webServer.
 */
export function makeViewerRoutes(deps: ViewerDeps): WebRoute[] {
  const pairingRequired = (): boolean => typeof deps.requirePairingForLan === 'function'
    ? deps.requirePairingForLan()
    : deps.requirePairingForLan !== false

  /**
   * The viewer's fence: the desktop (loopback) always passes, and any other
   * caller needs the family fence plus — while pairing is required — a live
   * paired-device credential (cookie or the cookieless header).
   */
  const allowed = (req: IncomingMessage, navigation: boolean): boolean => {
    if (isLoopbackClient(req)) return true
    if (!deps.lanFence(req, navigation)) return false
    if (!pairingRequired()) return true
    return pairedDeviceIdOf(req, deps.service) !== undefined
  }

  /** Resolve one request's root + confined path, or write the refusal. */
  const resolveTarget = async (
    req: IncomingMessage,
    res: ServerResponse,
    want: 'dir' | 'file',
  ): Promise<{ root: ViewerRoot; absolute: string; relativePath: string } | undefined> => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const requestedPath = normalizeViewerPath(url.searchParams.get('path') ?? undefined)
    if (requestedPath === undefined) {
      writeJson(res, 400, { ok: false, code: 'bad-path', message: 'path must stay inside the root' })
      return undefined
    }
    const roots = await deps.roots(deps.ctx)
    if (roots.length === 0) {
      writeJson(res, 404, { ok: false, code: 'no-root', message: 'no readable project directory' })
      return undefined
    }
    const requestedRoot = url.searchParams.get('root')
    const root = roots.find(candidate => candidate.id === requestedRoot) ?? roots[0]
    const absolute = await resolveInsideRoot(root.path, requestedPath)
    if (absolute === undefined) {
      writeJson(res, 404, { ok: false, code: 'not-found', message: 'no such file inside the project directory' })
      return undefined
    }
    let info
    try {
      info = await stat(absolute)
    } catch {
      writeJson(res, 404, { ok: false, code: 'not-found', message: 'no such file inside the project directory' })
      return undefined
    }
    if (want === 'dir' && !info.isDirectory()) {
      writeJson(res, 400, { ok: false, code: 'not-a-directory', message: 'that path is not a directory' })
      return undefined
    }
    if (want === 'file' && !info.isFile()) {
      writeJson(res, 400, { ok: false, code: 'not-a-file', message: 'that path is not a regular file' })
      return undefined
    }
    return { root, absolute, relativePath: requestedPath }
  }

  const handlePage = (req: IncomingMessage, res: ServerResponse): void => {
    if (req.method !== 'GET') {
      res.writeHead(405).end()
      return
    }
    if (!allowed(req, true)) {
      res.writeHead(403, { 'content-type': 'text/html; charset=utf-8' })
      res.end('<!doctype html><meta charset="utf-8"><p>403 — 这个设备没有配对，无法打开文件查看器。')
      return
    }
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
    })
    res.end(viewerPage())
  }

  const handleRoots = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') {
      res.writeHead(405).end()
      return
    }
    if (!allowed(req, false)) {
      writeJson(res, 403, { ok: false, code: 'forbidden', message: 'this device is not paired' })
      return
    }
    try {
      const roots = await deps.roots(deps.ctx)
      writeJson(res, 200, { ok: true, roots, root: roots[0]?.id })
    } catch (error) {
      fail(res, error)
    }
  }

  const handleList = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') {
      res.writeHead(405).end()
      return
    }
    if (!allowed(req, false)) {
      writeJson(res, 403, { ok: false, code: 'forbidden', message: 'this device is not paired' })
      return
    }
    try {
      const target = await resolveTarget(req, res, 'dir')
      if (target === undefined) return
      const { entries, truncated } = await listDirectory(target.root.path, target.absolute)
      writeJson(res, 200, {
        ok: true,
        root: target.root,
        path: target.relativePath,
        entries,
        truncated,
      })
    } catch (error) {
      fail(res, error)
    }
  }

  const handleFile = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') {
      res.writeHead(405).end()
      return
    }
    if (!allowed(req, false)) {
      writeJson(res, 403, { ok: false, code: 'forbidden', message: 'this device is not paired' })
      return
    }
    try {
      const target = await resolveTarget(req, res, 'file')
      if (target === undefined) return
      const read = await readViewerFile(target.absolute, VIEWER_MAX_BYTES)
      writeJson(res, 200, { ok: true, root: target.root, path: target.relativePath, ...read })
    } catch (error) {
      fail(res, error)
    }
  }

  return [
    { kind: 'exact', path: VIEWER_PATHS.page, handler: handlePage },
    { kind: 'exact', path: VIEWER_PATHS.roots, handler: (req, res) => { void handleRoots(req, res) } },
    { kind: 'exact', path: VIEWER_PATHS.list, handler: (req, res) => { void handleList(req, res) } },
    { kind: 'exact', path: VIEWER_PATHS.file, handler: (req, res) => { void handleFile(req, res) } },
  ]
}
