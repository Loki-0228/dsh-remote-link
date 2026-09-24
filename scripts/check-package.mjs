import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const report = JSON.parse(readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''))
assert.equal(report.length, 1, 'Expected one plugin package')
const files = report[0].files.map(item => item.path.replaceAll('\\', '/'))
const allowed = /^(?:lib\/|bin\/|src\/|package\.json$|cordis\.patch\.yml$|README\.md$|LICENSE$)/
for (const file of files) {
  assert.ok(allowed.test(file), 'Non-runtime file in plugin package: ' + file)
  assert.ok(!/(^|\/)(?:apps|android|ios|release|build|dist|\.signing)(\/|$)|\.(?:apk|ipa|p8|p12|keystore|jks|mobileprovision)$/i.test(file),
    'Mobile artifact, build output or signing material in plugin package: ' + file)
}
for (const file of ['lib/index.js', 'lib/client.js', 'bin/frpc.exe', 'package.json', 'cordis.patch.yml', 'LICENSE']) {
  assert.ok(files.includes(file), 'Missing runtime file: ' + file)
}
console.log('Plugin package verified: ' + files.length + ' files; no mobile source, APK, IPA or signing keys.')
