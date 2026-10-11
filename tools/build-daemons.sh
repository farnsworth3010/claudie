#!/bin/sh
# Builds the daemon for every platform the plugin supports into backend/daemon/bin/release/, with
# SHA256SUMS: the files a GitHub release carries and the plugin's hook downloads.
#   tools/build-daemons.sh
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
out="$root/backend/daemon/bin/release"
# The plugin's version: the hook replaces a running daemon that reports another one.
version=$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$root/backend/plugin/.claude-plugin/plugin.json")
rm -rf "$out"
mkdir -p "$out"
cd "$root/backend/daemon"
for target in linux/amd64 linux/arm64 darwin/amd64 darwin/arm64; do
  os=${target%/*}
  arch=${target#*/}
  CGO_ENABLED=0 GOOS=$os GOARCH=$arch go build -trimpath -ldflags="-s -w -X claudie/daemon/internal/version.Version=$version" -o "$out/claudie-daemon-$os-$arch" ./src
done
cd "$out"
if command -v sha256sum > /dev/null; then sha256sum claudie-daemon-* > SHA256SUMS; else shasum -a 256 claudie-daemon-* > SHA256SUMS; fi
cat SHA256SUMS
