import { createHash, createPrivateKey, sign } from 'node:crypto'
import { connect } from 'node:http2'
import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'

export const pushKinds = ['task-started', 'task-completed', 'task-failed', 'approval', 'question', 'info']
export const deviceHash = id => createHash('sha256').update(id).digest('hex')
const bound = (value, limit) => Array.from(String(value ?? '')).slice(0, limit).join('')
export function validateSubscription(input) {
  if (!input || typeof input !== 'object' || !/^[a-f0-9]{32,256}$/i.test(input.token ?? '')) throw new Error('APNs token 无效')
  if (!['production', 'development'].includes(input.environment)) throw new Error('APNs 环境无效')
  if (typeof input.topic !== 'string' || !/^[A-Za-z0-9.-]{3,200}$/.test(input.topic)) throw new Error('Bundle ID 无效')
  if (!Array.isArray(input.disabled) || input.disabled.length > 6 || input.disabled.some(kind => !pushKinds.includes(kind))) throw new Error('通知类型无效')
  return { token: input.token.toLowerCase(), environment: input.environment, topic: input.topic,
    disabled: [...new Set(input.disabled)], brief: input.brief !== false, previewContent: input.previewContent !== false }
}
export function pushPayload(event, subscription) {
  const labels = { 'task-started': '任务开始', 'task-completed': '本轮结束', 'task-failed': '任务失败', approval: '等待审批', question: '等待回答', info: '插件消息' }
  const title = event.taskTitle ? (labels[event.kind] || 'DSH') + ' · ' + event.taskTitle : event.title || 'DSH 有新消息'
  const excerpt = subscription.brief ? event.summary || event.body : event.body || event.summary
  const preview = subscription.previewContent
  const payload = {
    aps: { alert: { title: preview ? bound(title, 72) : 'DSH 有新消息',
      body: preview ? bound(excerpt || '打开应用查看详情。', subscription.brief ? 160 : 500) : '打开应用查看任务或待处理请求。' },
      sound: 'default', 'thread-id': deviceHash(event.sessionId || event.source || 'dsh').slice(0, 32) },
    dsh: { id: event.id, kind: event.kind, time: event.time, requestId: event.requestId || '',
      sessionId: preview ? bound(event.sessionId,180) : '',
      ...(preview ? { title: bound(title,72), taskTitle: bound(event.taskTitle,64), summary: bound(excerpt,160) } : {}) },
  }
  if (Buffer.byteLength(JSON.stringify(payload)) > 4096) throw new Error('APNs payload too large')
  return payload
}
export class ApnsProvider {
  constructor(config) {
    for (const name of ['teamId', 'keyId']) if (!/^[A-Z0-9]{10}$/.test(config[name] ?? '')) throw new Error('APNs 标识无效')
    if (!/^[A-Za-z0-9.-]{3,200}$/.test(config.topic ?? '')) throw new Error('APNs Bundle ID 无效')
    this.topic = config.topic; this.teamId = config.teamId; this.keyId = config.keyId
    this.key = createPrivateKey(config.key)
    if (this.key.asymmetricKeyType !== 'ec' || this.key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new Error('APNs 密钥必须为 P-256')
    this.clients = new Map()
  }
  authorization(now = Date.now()) {
    if (this.jwt && now - this.issued < 40 * 60_000 && now >= this.issued) return this.jwt
    const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: this.keyId })).toString('base64url')
    const claims = Buffer.from(JSON.stringify({ iss: this.teamId, iat: Math.floor(now / 1000) })).toString('base64url')
    const input = header + '.' + claims
    this.jwt = input + '.' + sign('sha256', Buffer.from(input), { key: this.key, dsaEncoding: 'ieee-p1363' }).toString('base64url')
    this.issued = now
    return this.jwt
  }
  async send(subscription, event) {
    const host = subscription.environment === 'development' ? 'https://api.sandbox.push.apple.com' : 'https://api.push.apple.com'
    let client = this.clients.get(host)
    if (!client || client.closed || client.destroyed) {
      client = connect(host)
      client.on('error', () => { if (this.clients.get(host) === client) this.clients.delete(host); client.destroy() })
      client.on('goaway', () => { if (this.clients.get(host) === client) this.clients.delete(host); client.close() })
      this.clients.set(host, client)
    }
    return await new Promise((resolveResult, reject) => {
      const request = client.request({ ':method': 'POST', ':path': '/3/device/' + subscription.token,
        authorization: 'bearer ' + this.authorization(), 'apns-topic': this.topic, 'apns-push-type': 'alert',
        'apns-priority': '10', 'apns-expiration': String(Math.floor(Date.now() / 1000) + 300),
        'apns-collapse-id': deviceHash(event.id).slice(0, 64) })
      let status = 0, body = ''
      request.setTimeout(10000, () => request.destroy(new Error('APNs timeout')))
      request.on('response', headers => { status = Number(headers[':status']) })
      request.on('data', chunk => { if (body.length < 4096) body += chunk })
      request.on('error', reject)
      request.on('end', () => {
        let reason = ''
        try { reason = JSON.parse(body).reason ?? '' } catch {}
        resolveResult({ status, reason })
      })
      request.end(JSON.stringify(pushPayload(event, subscription)))
    })
  }
  dispose() { for (const client of this.clients.values()) client.destroy(); this.clients.clear() }
}
export class ApnsBridge {
  constructor({ getHub, isLive, enabled, directory, sender, provider } = {}) {
    this.getHub = getHub; this.isLive = isLive; this.enabled = enabled
    this.directory = directory || join(homedir(), '.dsh', 'apns')
    this.file = join(this.directory, 'devices.json')
    this.devices = new Map(); this.queues = new Map(); this.stopped = false
    this.provider = provider
    if (!this.provider) {
      const file = process.env.DSH_APNS_CONFIG || join(this.directory, 'config.json')
      try {
        if (existsSync(file)) {
          const config = JSON.parse(readFileSync(file, 'utf8'))
          if (config.enabled !== false) this.provider = new ApnsProvider({ ...config,
            key: readFileSync(resolve(dirname(file), config.privateKeyFile), 'utf8') })
        }
      } catch { this.configurationError = 'APNs 配置或私钥无效，请检查电脑端配置后重启' }
    }
    this.sender = sender || ((subscription, event) => this.provider.send(subscription, event))
    try {
      const saved = JSON.parse(readFileSync(this.file, 'utf8'))
      for (const [key, value] of Object.entries(saved).slice(0, 200)) {
        if (/^[a-f0-9]{64}$/.test(key)) this.devices.set(key, validateSubscription(value))
      }
    } catch {}
  }
  persist() {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 })
    writeFileSync(this.file + '.tmp', JSON.stringify(Object.fromEntries(this.devices)), { mode: 0o600 })
    renameSync(this.file + '.tmp', this.file)
  }
  status(key) {
    return { configured: !!this.provider, registered: this.devices.has(key), topic: this.provider?.topic,
      ...(this.configurationError ? { error: this.configurationError } : {}) }
  }
  register(key, input) {
    const subscription = validateSubscription(input)
    if (this.provider && subscription.topic !== this.provider.topic) throw new Error('Bundle ID 与电脑 APNs 配置不一致')
    if (!this.devices.has(key) && this.devices.size >= 200) throw new Error('推送设备数量已达上限')
    for (const [other, value] of this.devices) if (other !== key && value.token === subscription.token && value.topic === subscription.topic) this.devices.delete(other)
    this.devices.set(key, subscription); this.persist()
    return this.status(key)
  }
  unregister(key) { this.devices.delete(key); this.persist(); return { ok: true } }
  start() {
    const attach = () => {
      const hub = this.getHub()
      if (!hub || hub === this.hub) return
      this.off?.(); this.hub = hub
      const snapshot = hub.snapshot()
      this.epoch = snapshot.epoch; this.cursor = snapshot.cursor
      this.off = hub.subscribe(() => this.changed())
    }
    attach()
    this.timer = setInterval(attach, 2000); this.timer.unref?.()
  }
  changed() {
    const snapshot = this.hub.snapshot(this.epoch, this.cursor)
    this.epoch = snapshot.epoch; this.cursor = snapshot.cursor
    if (!this.enabled() || !this.provider || snapshot.reset) return
    const pending = new Set(snapshot.pending.map(item => item.id))
    for (const event of snapshot.events) {
      if (event.requestId && !pending.has(event.requestId)) continue
      for (const [key, subscription] of this.devices) {
        if (!this.isLive(key)) { this.unregister(key); continue }
        if (subscription.disabled.includes(event.kind) || subscription.topic !== this.provider.topic) continue
        const queue = this.queues.get(key) || Promise.resolve()
        const job = queue.then(async () => {
          const current = this.devices.get(key)
          if (this.stopped || !this.enabled() || !this.isLive(key) || current !== subscription || current.disabled.includes(event.kind)) return
          if (event.requestId && !this.hub.snapshot().pending.some(item => item.id === event.requestId)) return
          for (let attempt = 0; attempt < 2; attempt++) {
            if (this.stopped || !this.enabled() || !this.isLive(key) || this.devices.get(key) !== subscription) return
            try {
              const result = await this.sender(subscription, event)
              if (result.status === 200) return
              if (result.status === 410 || ['BadDeviceToken', 'DeviceTokenNotForTopic', 'Unregistered'].includes(result.reason)) {
                if (this.devices.get(key) === subscription) this.unregister(key)
                return
              }
              if (![429, 500, 503].includes(result.status)) return
            } catch { if (attempt === 1) return }
            await new Promise(r => setTimeout(r, 1000))
          }
        }).catch(() => {})
        this.queues.set(key, job)
        void job.finally(() => { if (this.queues.get(key) === job) this.queues.delete(key) })
      }
    }
  }
  dispose() { this.stopped = true; clearInterval(this.timer); this.off?.(); this.provider?.dispose?.() }
}