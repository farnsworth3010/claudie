#!/bin/sh
# SessionStart hook. Http hooks can't run on SessionStart, and this is the one event that tells the
# daemon which process the session lives in: Claude Code spawns `sh` with this script directly (exec
# form, no shell in between), so the parent process is the session's claude.
#
# First it makes sure the daemon of the plugin's version runs: it downloads the binary for this
# platform from the plugin's GitHub release once, and `claudie-daemon start` starts it in the
# background or replaces an older one. So installing or updating the plugin is all the setup there
# is. It never fails the session: no daemon only means no mascot and a warning. It also keeps the
# status line wrapper of /claudie:limits up to date in the data directory.
#   CLAUDIE_PORT          the daemon's port (47321)
#   CLAUDIE_DAEMON        a daemon binary to use instead of the released one
#   CLAUDIE_RELEASE_URL   where to download the binaries from instead of the plugin's release
set -u
port=${CLAUDIE_PORT:-47321}
here=$(cd "$(dirname "$0")" && pwd)
manifest="$here/../.claude-plugin/plugin.json"
data=${CLAUDE_PLUGIN_DATA:-${XDG_DATA_HOME:-$HOME/.local/share}/claudie}
event=$(cat)

send() {
  printf '%s' "$event" | curl -s -m 1 -o /dev/null -H 'content-type: application/json' -H "X-Claudie-Pid: $PPID" \
    --data-binary @- "http://127.0.0.1:$port/hook"
}

# A plain "key": "value" field of the plugin manifest; no jq on purpose.
manifest_field() {
  sed -n "s/.*\"$1\": *\"\\([^\"]*\\)\".*/\\1/p" "$manifest" | head -n 1
}

platform() {
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  case $(uname -m) in
    x86_64 | amd64) arch=amd64 ;;
    arm64 | aarch64) arch=arm64 ;;
    *) return 1 ;;
  esac
  case $os in linux | darwin) echo "$os-$arch" ;; *) return 1 ;; esac
}

sha256() {
  if command -v sha256sum > /dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d ' ' -f 1
}

# The daemon binary for this plugin version, downloaded once and checked against the release's
# SHA256SUMS. Kept in the plugin's data directory, which survives plugin updates.
daemon() {
  if [ -n "${CLAUDIE_DAEMON:-}" ]; then echo "$CLAUDIE_DAEMON"; return; fi
  version=$(manifest_field version)
  name="claudie-daemon-$(platform)" || return 1
  dir="$data/bin"
  path="$dir/$name-$version"
  if [ ! -x "$path" ]; then
    url=${CLAUDIE_RELEASE_URL:-"$(manifest_field repository)/releases/download/v$version"}
    mkdir -p "$dir" || return 1
    tmp="$path.download"
    curl -fsSL -m 50 -o "$tmp" "$url/$name" || { rm -f "$tmp"; return 1; }
    want=$(curl -fsSL -m 5 "$url/SHA256SUMS" | grep " $name\$" | cut -d ' ' -f 1)
    if [ -z "$want" ] || [ "$(sha256 "$tmp")" != "$want" ]; then rm -f "$tmp"; return 1; fi
    chmod +x "$tmp" && mv "$tmp" "$path" || return 1
    # Binaries of earlier versions are of no more use.
    for old in "$dir/$name"-*; do [ "$old" = "$path" ] || rm -f "$old"; done
  fi
  echo "$path"
}

# Shown to the user: plain stdout would go to Claude's context, stderr nowhere.
warn() {
  printf '{"systemMessage":"%s"}\n' "$1"
}

# Copied whole, then renamed, so a status line running meanwhile never reads half of it.
statusline() {
  mkdir -p "$data" && cp "$here/claudie-statusline.sh" "$data/claudie-statusline.sh.new" &&
    mv "$data/claudie-statusline.sh.new" "$data/claudie-statusline.sh"
}

# statusline-inner is there once /claudie:limits set the wrapper up; something may have replaced it since.
replaced() {
  [ -e "$data/statusline-inner" ] &&
    ! grep -q claudie-statusline "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json" 2> /dev/null
}

# `start` does nothing when this version already runs, and replaces a daemon of another one.
if bin=$(daemon); then
  CLAUDIE_PORT=$port "$bin" start > /dev/null 2>&1
  statusline
  if replaced; then
    warn "Claudie: the status line no longer passes the usage limits on, so the limit clocks stand still. Run /claudie:limits to set it up again."
  fi
else
  warn "Claudie: could not download the daemon $(manifest_field version) for this machine, so no mascots. See $(manifest_field repository)#installing-without-a-release"
fi
send
exit 0
