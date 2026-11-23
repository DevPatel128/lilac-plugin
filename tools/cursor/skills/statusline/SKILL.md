---
name: statusline
description: Turn the Lilac progress bar in the Claude Code status line on or off, after asking.
disable-model-invocation: true
---
# /lilac:statusline on|off

Plugins cannot set the status line themselves, so ask first with AskUserQuestion (Yes / No), because this edits the user's own settings.

- `on`: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/statusline.mjs" --install`, show the JSON, and only after a yes add its `statusLine` key to `~/.claude/settings.json`. Keep every other key.
- `off`: after a yes, remove that `statusLine` key.

It prints, for example: `Lilac  Build 4/9  ▓▓▓▓░░░░░░  44%  qa-browser  sev 5`, read from `.lilac/progress.json`. The same file holds the time each step took.
