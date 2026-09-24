param([string]$Serial='emulator-5554')
$ErrorActionPreference='Stop'
if($Serial -notmatch '^emulator-\d+$'){throw 'Tests require a disposable Android emulator, never a real phone.'}
$root=Split-Path $PSScriptRoot -Parent
$out=Join-Path $root 'build\tests'
$java='D:\Java\jdk-17'
$sdk='D:\SDK'
$tools="$sdk\build-tools\35.0.1"
$env:JAVA_HOME=$java
$env:PATH="$java\bin;"+$env:PATH
foreach($path in @($out,"$out\classes","$out\dex")){New-Item -ItemType Directory -Force -Path $path|Out-Null}
function Check($step){if($LASTEXITCODE -ne 0){throw "$step failed ($LASTEXITCODE)"}}
& "$tools\aapt2.exe" link -o "$out\test.apk" -I "$sdk\platforms\android-35\android.jar" --manifest "$PSScriptRoot\AndroidManifest.xml"
Check 'test resource linking'
& "$java\bin\javac.exe" -encoding UTF-8 -source 8 -target 8 -classpath "$sdk\platforms\android-35\android.jar;$root\build\classes" -d "$out\classes" "$PSScriptRoot\RegressionInstrumentation.java"
Check 'test compilation'
& "$java\bin\jar.exe" cf "$out\tests.jar" -C "$out\classes" .
Check 'test jar'
& "$tools\d8.bat" --lib "$sdk\platforms\android-35\android.jar" --classpath "$root\build\classes.jar" --min-api 26 --output "$out\dex" "$out\tests.jar"
Check 'test dex'
& "$java\bin\jar.exe" uf "$out\test.apk" -C "$out\dex" classes.dex
Check 'test packaging'
& "$tools\zipalign.exe" -f 4 "$out\test.apk" "$out\aligned.apk"
Check 'test align'
& "$tools\apksigner.bat" sign --ks "$root\.signing\debug.keystore" --ks-pass pass:android --key-pass pass:android --out "$out\signed.apk" "$out\aligned.apk"
Check 'test signing'
& "$sdk\platform-tools\adb.exe" -s $Serial install -r "$out\signed.apk"
Check 'test install'
& "$sdk\platform-tools\adb.exe" -s $Serial shell pm grant com.dsh.remote android.permission.POST_NOTIFICATIONS
Check 'notification permission'
& "$sdk\platform-tools\adb.exe" -s $Serial reverse tcp:48775 tcp:48775
Check 'fixture port'
$result = & "$sdk\platform-tools\adb.exe" -s $Serial shell am instrument -w com.dsh.remote.tests/com.dsh.remote.RegressionInstrumentation
Check 'instrumentation'
$result | Write-Output
if (($result -join "\n") -notmatch '14 Android integration checks passed') { throw 'Android regression failed' }