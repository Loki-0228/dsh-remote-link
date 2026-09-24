param(
    [string]$Sdk = 'D:\SDK',
    [string]$Java = 'D:\Java\jdk-17',
    [string]$BuildTools = '35.0.1',
    [string]$KeyStore = (Join-Path $PSScriptRoot '.signing\debug.keystore'),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\..\release')
)
$ErrorActionPreference = 'Stop'
$env:JAVA_HOME = $Java
$env:PATH = (Join-Path $Java 'bin') + ';' + $env:PATH
$tools = Join-Path $Sdk ('build-tools\' + $BuildTools)
$android = Join-Path $Sdk 'platforms\android-35\android.jar'
$out = Join-Path $PSScriptRoot 'build'
$dist = [IO.Path]::GetFullPath($OutputDirectory)
foreach ($dir in @($out, $dist, "$out\res", "$out\generated", "$out\classes", "$out\dex", (Split-Path -Parent $KeyStore))) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
function Check([string]$Step) { if ($LASTEXITCODE -ne 0) { throw "$Step failed ($LASTEXITCODE)" } }
& "$tools\aapt2.exe" compile --dir "$PSScriptRoot\res" -o "$out\resources.zip"
Check 'Resource compilation'
& "$tools\aapt2.exe" link -o "$out\unsigned.apk" -I $android --manifest "$PSScriptRoot\AndroidManifest.xml" --java "$out\generated" --min-sdk-version 26 --target-sdk-version 35 "$out\resources.zip"
Check 'Resource linking'
$sources = @(Get-ChildItem "$PSScriptRoot\src","$out\generated" -Filter '*.java' -Recurse | ForEach-Object FullName)
& "$Java\bin\javac.exe" -encoding UTF-8 -source 8 -target 8 -classpath $android -d "$out\classes" @sources
Check 'Java compilation'
& "$Java\bin\jar.exe" cf "$out\classes.jar" -C "$out\classes" .
Check 'Class archive'
& "$tools\d8.bat" --lib $android --min-api 26 --output "$out\dex" "$out\classes.jar"
Check 'DEX compilation'
& "$Java\bin\jar.exe" uf "$out\unsigned.apk" -C "$out\dex" classes.dex
Check 'DEX packaging'
& "$tools\zipalign.exe" -f -p 4 "$out\unsigned.apk" "$out\aligned.apk"
Check 'APK alignment'
if (-not (Test-Path -LiteralPath $KeyStore)) {
    & "$Java\bin\keytool.exe" -genkeypair -keystore $KeyStore -storepass android -keypass android -alias androiddebugkey -dname 'CN=DSH Remote Development' -keyalg RSA -keysize 2048 -validity 10000
    Check 'Development signing key'
}
& "$tools\apksigner.bat" sign --ks $KeyStore --ks-pass pass:android --ks-key-alias androiddebugkey --key-pass pass:android --out "$dist\DSH-Remote.apk" "$out\aligned.apk"
Check 'APK signing'
& "$tools\apksigner.bat" verify --verbose "$dist\DSH-Remote.apk"
Check 'Signature verification'
Write-Host "$dist\DSH-Remote.apk"
