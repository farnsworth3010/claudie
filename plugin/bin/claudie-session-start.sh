#!/bin/sh
# SessionStart hook. Http hooks can't run on SessionStart, and this is the one event that tells the
# daemon which process the session lives in. Claude Code spawns this script directly (exec form, no
# shell in between), so the parent process is the session's claude.
curl -s -m 1 -o /dev/null -H 'content-type: application/json' -H "X-Claudie-Pid: $PPID" \
  --data-binary @- "http://127.0.0.1:${CLAUDIE_PORT:-47321}/hook"
# Never fail the session start: a missing daemon only means no mascot.
exit 0
