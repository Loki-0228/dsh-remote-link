#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
python3 scripts/generate-project.py
sips -z 1024 1024 app-icon-source.png --out DSHRemote/Assets.xcassets/AppIcon.appiconset/AppIcon.png >/dev/null
mkdir -p build
xcodebuild -project DSHRemote.xcodeproj -scheme DSHRemote -configuration Release \
  -sdk iphoneos -destination 'generic/platform=iOS' -archivePath build/DSHRemote.xcarchive \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO archive >build/archive.log 2>&1 || { tail -100 build/archive.log; exit 1; }
mkdir -p build/package/Payload
ditto build/DSHRemote.xcarchive/Products/Applications/DSHRemote.app build/package/Payload/DSHRemote.app
/usr/bin/ditto -c -k --keepParent build/package/Payload build/DSH-Remote-iPad-unsigned.ipa
echo "Unsigned IPA: $ROOT/build/DSH-Remote-iPad-unsigned.ipa"