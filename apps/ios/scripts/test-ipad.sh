#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
DEVICE="$(xcrun simctl list devices available -j | python3 -c 'import sys,json; d=json.load(sys.stdin); print(next(x["udid"] for group in d["devices"].values() for x in group if "iPad" in x["name"]))')"
xcrun simctl boot "$DEVICE" || true
xcrun simctl bootstatus "$DEVICE" -b
test_status=0
xcodebuild -project DSHRemote.xcodeproj -scheme DSHRemote -configuration Debug \
  -destination "platform=iOS Simulator,id=$DEVICE" -resultBundlePath build/iPad-tests.xcresult \
  -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO test >build/ipad-test.log 2>&1 || test_status=$?
mkdir -p build/screenshots
if [ -d build/iPad-tests.xcresult ]; then
  xcrun xcresulttool export attachments --path build/iPad-tests.xcresult --output-path build/screenshots || true
fi
if [ "$test_status" -ne 0 ]; then tail -100 build/ipad-test.log; exit "$test_status"; fi
xcrun simctl ui "$DEVICE" appearance dark
xcrun simctl launch "$DEVICE" com.dsh.remote --ui-testing
sleep 3
xcrun simctl io "$DEVICE" screenshot build/screenshots/ipad-dark.png
xcrun simctl ui "$DEVICE" appearance light
