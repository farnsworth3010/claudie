#!/bin/sh
# Shows off the mascots with made-up sessions sent to a running daemon: tools in hand, a permission
# and a question waiting, a crew of subagents, a fever from a full context, plan mode, a commit and
# a failed test run now and then. Ctrl+C ends the sessions.
#   tools/demo.sh
set -eu
url="http://127.0.0.1:${CLAUDIE_PORT:-47321}/hook"
dir="$(mktemp -d)"
names="tools wait ask crew fever plan ship"

post() { # name event [extra json fields]
  curl -sf -m 2 -o /dev/null -H 'content-type: application/json' --data-binary \
    "{\"session_id\":\"demo-$1-$$\",\"cwd\":\"/demo/$1\",\"hook_event_name\":\"$2\"${3:-}}" "$url" ||
    { echo "no daemon at $url" >&2; exit 1; }
}
tool() { # name event tool [command]
  post "$1" "$2" ",\"tool_name\":\"$3\",\"tool_input\":{\"command\":\"${4:-}\"}"
}
agent() { # name event agent_type [tool]
  post "$1" "$2" ",\"agent_id\":\"$3-$$\",\"agent_type\":\"$3\",\"tool_name\":\"${4:-Read}\""
}
# The context size only comes from the transcript, so the feverish one gets a transcript of its own.
transcript() { # name tokens
  printf '{"type":"assistant","timestamp":"%s","message":{"model":"demo","usage":{"input_tokens":%s}}}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" "$2" >> "$dir/$1.jsonl"
}

stop() {
  for n in $names; do post "$n" SessionEnd || true; done
  rm -rf "$dir"
}
trap 'stop; exit 0' INT TERM

for n in $names; do post "$n" SessionStart; sleep 0.3; done
sleep 2
transcript fever 850000
post fever UserPromptSubmit ",\"transcript_path\":\"$dir/fever.jsonl\""
post plan UserPromptSubmit ',"permission_mode":"plan"'
post plan Stop ',"permission_mode":"plan"'
post wait UserPromptSubmit
tool wait PreToolUse Bash 'rm -rf build'
tool wait PermissionRequest Bash 'rm -rf build'
post ask UserPromptSubmit
tool ask PermissionRequest AskUserQuestion
post crew UserPromptSubmit
for t in Explore oh-my-claudecode:code-reviewer Plan oh-my-claudecode:test-engineer; do
  agent crew SubagentStart "$t"
  sleep 0.4
done
post crew Stop

echo "demo running; Ctrl+C to end it"
extra="oh-my-claudecode:designer oh-my-claudecode:debugger doc-writer oh-my-claudecode:executor"
tick=0
while :; do
  set -- Edit Bash Read WebFetch TodoWrite
  shift $((tick % 5))
  post tools UserPromptSubmit
  tool tools PreToolUse "$1"
  # Every 8 s a crew member finishes or a new one joins; the rest keep busy.
  set -- $extra
  shift $(((tick + 1) / 2 % 4))
  if [ $((tick % 2)) -eq 0 ]; then agent crew SubagentStart "$1"; else agent crew SubagentStop "$1"; fi
  for t in Explore oh-my-claudecode:code-reviewer Plan oh-my-claudecode:test-engineer; do
    agent crew PreToolUse "$t" Grep
  done
  case $((tick % 4)) in
    0) post ship UserPromptSubmit; tool ship PreToolUse Bash 'git commit -m demo'; tool ship PostToolUse Bash 'git commit -m demo'; post ship Stop ;;
    2) post ship UserPromptSubmit; tool ship PreToolUse Bash 'pnpm test'; tool ship PostToolUseFailure Bash 'pnpm test'; post ship StopFailure ;;
  esac
  transcript fever 850000
  tick=$((tick + 1))
  sleep 8
done
