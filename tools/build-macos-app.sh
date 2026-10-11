#!/bin/sh
# Builds the Mac app into frontends/macos/.build/app/ as Claudie.app and Claudie-macos.zip, the file
# a GitHub release carries. Needs a Mac with Xcode Command Line Tools and `pnpm build` done first.
#   tools/build-macos-app.sh
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root/frontends/macos"
test -f src/Resources/scene.js || { echo "scene.js is missing; run pnpm build" >&2; exit 1; }
version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$root/backend/plugin/.claude-plugin/plugin.json")
out=.build/app
app="$out/Claudie.app"

swift build -c release --arch arm64 --arch x86_64
bin=$(swift build -c release --arch arm64 --arch x86_64 --show-bin-path)

rm -rf "$out"
mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
cp "$bin/Claudie" "$app/Contents/MacOS/Claudie"
# The identifier is the defaults domain, the same name `swift run` saves the position under.
# SwiftPM's Bundle.module finds its resources bundle in the app's Resources.
cp -R "$bin/Claudie_Claudie.bundle" "$app/Contents/Resources/"
cat > "$app/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>Claudie</string>
  <key>CFBundleIdentifier</key><string>Claudie</string>
  <key>CFBundleName</key><string>Claudie</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$version</string>
  <key>CFBundleVersion</key><string>$version</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
EOF
# Not notarized: an ad-hoc signature is what lets the app start on Apple silicon at all.
codesign --force --deep --sign - "$app"
(cd "$out" && ditto -c -k --keepParent Claudie.app Claudie-macos.zip)
echo "$out/Claudie-macos.zip"
