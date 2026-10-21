---
description: Feed Claudie's usage limit clocks from the status line (or "off" to undo)
argument-hint: "[off]"
---

Claude Code hands the 5-hour and weekly usage limits only to the status line command. Claudie's wrapper `${CLAUDE_PLUGIN_DATA}/claudie-statusline.sh` passes them on to the Claudie daemon and then runs the status line it replaced, which it reads from `${CLAUDE_PLUGIN_DATA}/statusline-inner`. Set it up or undo it in the user's settings file, `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json`, as below. The argument is: "$ARGUMENTS".

Do only this, and before writing anything show the user the exact change to `settings.json` and wait for their yes. Keep every other key of `settings.json` as it is.

If `${CLAUDE_PLUGIN_DATA}/claudie-statusline.sh` doesn't exist, stop and tell the user to start a new Claude Code session first: the plugin's SessionStart hook puts it there.

## Without "off": set it up

1. Read `statusLine` in `settings.json`.
2. If its `command` already mentions `claudie-statusline`, say it is set up already and stop.
3. Write the current `statusLine.command` (or an empty file when there is no status line) to `${CLAUDE_PLUGIN_DATA}/statusline-inner`, exactly as it is, with no trailing newline.
4. Set `statusLine.command` to `sh "${CLAUDE_PLUGIN_DATA}/claudie-statusline.sh"` with the path written out in full. Keep `type` as `command` and any other fields, such as `padding` or `refreshInterval`. With no `statusLine` before, add `{"type": "command", "command": …}`.
   The old command lives in a file and not in this line on purpose: tools that own a status line, such as oh-my-claudecode's updater, take back any status line whose command names them.
5. Tell the user that the change applies at once. The clocks show once **Usage limits** is on in Claudie's settings (right-click a Clawd), and only Pro and Max plans get limits.

## With "off": undo it

1. Read `${CLAUDE_PLUGIN_DATA}/statusline-inner`. If it doesn't exist, say there is nothing to undo and stop.
2. If it holds a command, set `statusLine.command` back to it; if it is empty, remove `statusLine`. Do this only when the current `statusLine.command` mentions `claudie-statusline`; otherwise leave `settings.json` alone.
3. Delete `${CLAUDE_PLUGIN_DATA}/statusline-inner`.
