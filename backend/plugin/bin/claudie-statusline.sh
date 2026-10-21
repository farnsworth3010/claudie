#!/bin/sh
# The status line /claudie:limits sets up. Claude Code hands its status line the usage limits, and
# nothing else gets them, so this passes the input on to the daemon for the limit clocks, then runs
# the status line it took the place of (kept in statusline-inner next to it) and prints that.
# The SessionStart hook copies it into the plugin's data directory, whose path survives updates.
#   CLAUDIE_PORT  the daemon's port (47321)
here=$(cd "$(dirname "$0")" && pwd)
input=$(cat)
case $input in
  *'"rate_limits"'*)
    printf '%s' "$input" | curl -s -m 1 -o /dev/null -H 'content-type: application/json' \
      --data-binary @- "http://127.0.0.1:${CLAUDIE_PORT:-47321}/statusline"
    ;;
esac
inner=$(cat "$here/statusline-inner" 2> /dev/null)
[ -n "$inner" ] || exit 0
# Claude Code runs a status line with bash; so does this, where there is one.
if command -v bash > /dev/null; then
  printf '%s' "$input" | bash -c "$inner"
else
  printf '%s' "$input" | sh -c "$inner"
fi
