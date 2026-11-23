#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo 'ERROR: Xcode is required on a Mac. Install Xcode and Xcode command line tools first.'
  exit 1
fi
if [[ -n "${COOKIE_CLICKER_STEAM:-}" ]]; then
  echo 'Refreshing local Steam game files and mods for this IPA build...'
  python3 tools/prepare_game.py "$COOKIE_CLICKER_STEAM"
  python3 tools/sync_steam_mods.py "$COOKIE_CLICKER_STEAM"
fi
if [[ ! -f CookiePortIOS/Resources/Website/game/index.html ]]; then
  echo 'ERROR: The original game files are missing.'
  echo 'Run PREPARE-ON-WINDOWS.bat and transfer the PRIVATE prepared ZIP to your Mac,'
  echo 'or set COOKIE_CLICKER_STEAM to your Mac Steam Cookie Clicker folder.'
  exit 1
fi
mkdir -p output
if [[ -n "${APPLE_TEAM_ID:-}" ]]; then
  echo 'Building signed archive for team:' "$APPLE_TEAM_ID"
  xcodebuild -project CookiePortIOS.xcodeproj -scheme CookiePortIOS -configuration Release \
    -destination 'generic/platform=iOS' -archivePath "$PWD/output/CookiePortIOS.xcarchive" \
    CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
    -allowProvisioningUpdates archive
  cat > output/ExportOptions.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>debugging</string>
<key>signingStyle</key><string>automatic</string>
<key>stripSwiftSymbols</key><true/>
</dict></plist>
PLIST
  xcodebuild -exportArchive -archivePath "$PWD/output/CookiePortIOS.xcarchive" \
    -exportOptionsPlist output/ExportOptions.plist -exportPath "$PWD/output" -allowProvisioningUpdates
  echo 'Signed IPA should be in output/ (requires valid Apple provisioning for your device).'
else
  echo 'Building an UNSIGNED IPA. It cannot be installed on a stock iPhone without signing.'
  xcodebuild -project CookiePortIOS.xcodeproj -scheme CookiePortIOS -configuration Release \
    -destination 'generic/platform=iOS' -derivedDataPath "$PWD/.build" \
    CODE_SIGNING_ALLOWED=NO build
  APP="$PWD/.build/Build/Products/Release-iphoneos/CookiePortIOS.app"
  [[ -d "$APP" ]] || { echo 'ERROR: Xcode did not produce CookiePortIOS.app'; exit 1; }
  mkdir -p output/unsigned/Payload
  rm -rf output/unsigned/Payload/CookiePortIOS.app
  cp -R "$APP" output/unsigned/Payload/CookiePortIOS.app
  (cd output/unsigned && zip -qr '../cookie-clicker-ios-UNSIGNED.ipa' Payload)
  echo 'Created: output/cookie-clicker-ios-UNSIGNED.ipa (NOT installable without signing).'
fi
