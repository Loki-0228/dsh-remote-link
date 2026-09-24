import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const [tag, target, directory = resolve(root, 'release')] = process.argv.slice(2).filter(arg => arg !== '--dry-run')
if (tag !== 'v' + manifest.version || !/^[a-f0-9]{40}$/i.test(target ?? '')) {
  throw new Error('Usage: node scripts/publish-release.mjs v' + manifest.version + ' <40-character commit SHA> [release-directory] [--dry-run]')
}
const repository = process.env.GH_REPO || 'Loki-0228/dsh-remote-link'
if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid GH_REPO')
const names = ['DSH-Remote.apk', 'DSH-Remote-iPad-unsigned.ipa', 'loki-0228-dsh-remote-link-' + manifest.version + '.tgz']
const assets = names.map(name => {
  const data = readFileSync(resolve(directory, name))
  if (data.length < 1000) throw new Error('Artifact appears incomplete: ' + name)
  return { name, data, digest: 'sha256:' + createHash('sha256').update(data).digest('hex') }
})
const checksums = assets.map(asset => asset.digest.slice(7) + '  ' + asset.name).join('\n') + '\n'
writeFileSync(resolve(directory, 'SHA256SUMS'), checksums)
assets.push({ name: 'SHA256SUMS', data: Buffer.from(checksums), digest: 'sha256:' + createHash('sha256').update(checksums).digest('hex') })
if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify({ repository, tag, target, assets: assets.map(({name,data,digest}) => ({name,bytes:data.length,digest})) }, null, 2))
  process.exit(0)
}
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
if (!token) throw new Error('Set GH_TOKEN or GITHUB_TOKEN before publishing')
const api = 'https://api.github.com/repos/' + repository
const headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
async function request(path, method = 'GET', body, missing = false) {
  const response = await fetch(api + '/' + path, { method, headers: { ...headers, 'Content-Type': 'application/json' },
    ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(60000) })
  if (missing && response.status === 404) return null
  if (!response.ok) throw new Error(method + ' ' + path + ': HTTP ' + response.status)
  return response.json()
}
const commit = await request('commits/' + target)
if (commit.sha !== target) throw new Error('Target commit mismatch')
const existingTag = await request('git/ref/tags/' + encodeURIComponent(tag), 'GET', undefined, true)
if (existingTag) {
  const resolvedTag = await request('commits/' + encodeURIComponent(tag))
  if (resolvedTag.sha !== target) throw new Error('Tag already points to a different commit')
}
const body = [
  'Android APK 与 iPad IPA 作为独立下载附件发布，插件安装包不含移动端源码或安装包。',
  '',
  '- DSH-Remote.apk：Android 0.2.0，开发签名，可覆盖同签名的本地版本。',
  '- DSH-Remote-iPad-unsigned.ipa：iPad 0.2.0，需要自行签名，最低 iPadOS 16。',
  '- loki-0228-dsh-remote-link-' + manifest.version + '.tgz：只含插件安装文件。',
  '- SHA256SUMS：下载文件的 SHA-256 校验值。',
  '',
  'iPad 后台推送需要电脑端 APNs 配置和包含推送权限的签名。声音、振动均由系统设置管理。',
  '',
  '安装说明：https://github.com/' + repository + '/tree/' + tag + '/apps',
].join('\n')
let release = await request('releases/tags/' + encodeURIComponent(tag), 'GET', undefined, true)
if (!release) release = await request('releases', 'POST', { tag_name: tag, target_commitish: target, name: 'DSH Remote ' + tag, body, draft: true, prerelease: false })
for (const asset of assets) {
  const existing = release.assets.find(item => item.name === asset.name)
  if (existing) {
    if (existing.state !== 'uploaded' || existing.size !== asset.data.length || existing.digest !== asset.digest) throw new Error('Existing asset differs; refusing overwrite: ' + asset.name)
    continue
  }
  if (!release.draft) throw new Error('Published release is missing an asset; refusing modification')
  const upload = new URL(release.upload_url.split('{')[0])
  if (upload.origin !== 'https://uploads.github.com') throw new Error('Unexpected GitHub upload origin')
  upload.searchParams.set('name', asset.name)
  const response = await fetch(upload, { method: 'POST', headers: {...headers, 'Content-Type':'application/octet-stream'},
    body: asset.data, signal: AbortSignal.timeout(120000) })
  if (!response.ok) throw new Error('Upload ' + asset.name + ': HTTP ' + response.status)
  const uploaded = await response.json()
  if (uploaded.size !== asset.data.length || uploaded.digest !== asset.digest) throw new Error('Uploaded checksum mismatch: ' + asset.name)
  console.log('Uploaded ' + asset.name)
}
if (release.draft) release = await request('releases/' + release.id, 'PATCH', {draft:false,body})
console.log(release.html_url)
