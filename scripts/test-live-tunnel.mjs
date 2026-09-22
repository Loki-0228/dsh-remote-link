/**
 * Live end-to-end check of the bundled SakuraFrp client, run without Node's
 * `child_process` (this environment blocks it): the process manager itself is
 * covered by scripts/test-host.mjs with injected seams, so what is left to
 * prove here is that the BINARY the package ships really does emit an address
 * line the parser recognizes, for the configured token/tunnel.
 *
 * PowerShell runs the binary and pipes its output here on stdin.
 *
 * Usage:
 *   bin\frpc.exe -f "<token>:<tunnelId>" --no_check_update 2>&1 | node scripts/test-live-tunnel.mjs
 */

const { parseTunnelAddress, isTunnelReadyLine, isFatalLine } = await import(
  new URL('../src/frpc-tunnel.ts', import.meta.url).href
)

/** Collect stdin, then report what the parser made of it. */
const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)
const text = Buffer.concat(chunks).toString('utf8')

const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '')
console.log(`lines: ${String(lines.length)}`)

const addresses = []
let ready = false
const fatal = []
for (const line of lines) {
  const address = parseTunnelAddress(line)
  if (address !== undefined) addresses.push(address)
  if (isTunnelReadyLine(line)) ready = true
  if (isFatalLine(line)) fatal.push(line)
}

console.log(`ready line seen: ${String(ready)}`)
console.log(`parsed addresses: ${JSON.stringify([...new Set(addresses)])}`)
console.log(`fatal lines: ${JSON.stringify(fatal)}`)

if (fatal.length > 0) {
  console.log('RESULT: FAIL (the client reported a non-retryable error)')
  process.exitCode = 1
} else if (addresses.length === 0) {
  console.log('RESULT: FAIL (no tunnel address parsed from the client output)')
  process.exitCode = 1
} else {
  console.log('RESULT: OK (the bundled client produced a parseable public address)')
}
