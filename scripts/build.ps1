<#
.SYNOPSIS
  Build the two artifacts of @loki-0228/dsh-remote-link.

.DESCRIPTION
  Runs the esbuild binary twice: once for the host half (lib/index.js, Node
  ESM) and once for the browser half (lib/client.js, the lazy-CJS factory the
  dsh client module system consumes). The argument lists come from
  scripts/build.mjs, which owns the aliases and the wrapper text.

  The build runs from PowerShell rather than from Node because this environment
  blocks child_process.spawn for Node processes (esbuild's JS API needs it),
  while running the binary directly works.

.PARAMETER Out
  Destination folder. Defaults to <package>/lib.

.PARAMETER Check
  Build into a temporary folder and compare against the committed artifacts.

.EXAMPLE
  pwsh -File scripts/build.ps1
#>
[CmdletBinding()]
param(
  [string]$Out,
  [switch]$Check
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

if ($Check) {
  $Out = Join-Path ([System.IO.Path]::GetTempPath()) ("dsh-remote-link-build-" + [System.Guid]::NewGuid().ToString('N'))
}
if (-not $Out) { $Out = Join-Path $root 'lib' }
New-Item -ItemType Directory -Force -Path $Out | Out-Null

$esbuild = Join-Path $root 'tools\node_modules\@esbuild\win32-x64\esbuild.exe'
if (-not (Test-Path $esbuild)) {
  $esbuild = Get-ChildItem -Path (Join-Path $root '..\.tools\node_modules\@esbuild') -Filter 'esbuild.exe' -Recurse -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty FullName
}
if (-not $esbuild) {
  $esbuild = Join-Path $root 'node_modules\@esbuild\win32-x64\esbuild.exe'
}
if (-not (Test-Path $esbuild)) {
  throw "esbuild binary not found. Run: node scripts/fetch-esbuild.mjs"
}

function Invoke-Esbuild([string]$Entry) {
  $argvFile = (& node (Join-Path $PSScriptRoot 'build.mjs') --json $Entry --out $Out | Select-Object -Last 1)
  if ($LASTEXITCODE -ne 0) { throw "build.mjs --json $Entry failed" }
  $arguments = @((Get-Content -Raw $argvFile | ConvertFrom-Json))
  Remove-Item -Force $argvFile -ErrorAction SilentlyContinue
  & $esbuild @arguments
  if ($LASTEXITCODE -ne 0) { throw "esbuild failed for $Entry" }
}

Invoke-Esbuild 'host'
Invoke-Esbuild 'client'

$hostFile = Join-Path $Out 'index.js'
$clientFile = Join-Path $Out 'client.js'
Write-Host ("host   {0}  ({1} bytes)" -f $hostFile, (Get-Item $hostFile).Length)
Write-Host ("client {0}  ({1} bytes)" -f $clientFile, (Get-Item $clientFile).Length)

if ($Check) {
  $committed = Join-Path $root 'lib'
  $same = $true
  foreach ($name in @('index.js', 'client.js')) {
    $a = Join-Path $committed $name
    $b = Join-Path $Out $name
    if (-not (Test-Path $a)) { $same = $false; Write-Host "missing committed $name"; continue }
    if ((Get-FileHash $a).Hash -ne (Get-FileHash $b).Hash) { $same = $false; Write-Host "STALE $name" }
  }
  Remove-Item -Recurse -Force $Out
  if (-not $same) {
    Write-Host 'build artifacts are STALE - run scripts/build.ps1'
    exit 1
  }
  Write-Host 'build artifacts are up to date'
}
