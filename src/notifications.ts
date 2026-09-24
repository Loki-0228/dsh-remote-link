import type { IncomingMessage, ServerResponse } from 'node:http'
import type { PairingService } from './pairing.ts'
import { readCookie } from './gate.ts'
import { isNonCrossSite } from './routes.ts'
import { readBoundedJson, writeJson } from './http.ts'
import { ApnsBridge, deviceHash } from './apns.mjs'

function credential(service: PairingService, req: IncomingMessage): string | undefined {
  const header = req.headers['x-dsh-remote-device']
  return typeof header === 'string' ? header : readCookie(req.headers.cookie, service.config.cookieName)
}
export function notificationDeviceAuthorized(service: PairingService, req: IncomingMessage): boolean {
  if (!isNonCrossSite(req)) return false
  const device = credential(service, req)
  return !!device && service.touchDevice(device)
}
export function notificationRoutes(ctx: any, service: PairingService, enabled: () => boolean) {
  const authorized = (req: IncomingMessage) => enabled() && notificationDeviceAuthorized(service, req)
  const apns = new ApnsBridge({
    directory: process.env.DSH_APNS_DIR,
    getHub: () => ctx.get('nativeNotifications'),
    isLive: (key: string) => service.snapshot().devices.some(device => deviceHash(device.id) === key && service.hasDevice(device.id)),
    enabled,
  })
  ctx.effect(() => { apns.start(); return () => apns.dispose() }, 'dsh-remote-link: APNs notifications')
  return [{ kind: 'prefix' as const, path: '/api/remote-notifications', handler: async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('cache-control', 'no-store')
    if (!authorized(req)) return writeJson(res, 403, { error: '设备未配对或已撤销' })
    const path = new URL(req.url || '/', 'http://localhost').pathname
    const key = deviceHash(credential(service, req)!)
    if (path === '/api/remote-notifications/push/status' && req.method === 'GET') return writeJson(res, 200, apns.status(key))
    if (path === '/api/remote-notifications/push/unregister' && req.method === 'POST') return writeJson(res, 200, apns.unregister(key))
    if (path === '/api/remote-notifications/push/register' && req.method === 'POST') {
      try {
        const input = await readBoundedJson(req, 4096)
        if (!authorized(req)) return writeJson(res, 403, { error: '设备已撤销' })
        return writeJson(res, 200, apns.register(key, input))
      } catch (error) { return writeJson(res, 400, { error: error instanceof Error ? error.message : '推送配置无效' }) }
    }
    const notifications = ctx.get('nativeNotifications')
    if (!notifications) return writeJson(res, 503, { error: '请用支持原生通知的 DSH-Web.exe 启动服务' })
    await notifications.handle(req, res, '/api/remote-notifications', authorized)
  } }]
}