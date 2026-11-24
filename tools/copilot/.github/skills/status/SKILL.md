---
name: status
description: Show every Lilac gate as approved, stale or pending, plus the severity and the next step.
disable-model-invocation: true
---
# /lilac:status

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/approval-guard.mjs" status "${CLAUDE_PROJECT_DIR}"` and then `node "${CLAUDE_PLUGIN_ROOT}/scripts/build.mjs" status "${CLAUDE_PROJECT_DIR}"`. Report both in plain words.

- `approved`: unchanged since the human said yes.
- `stale`: the file changed after approval. Ask again with AskUserQuestion (Approve / Change something / Stop). Site code writes are blocked until then.
- `pending`: not asked yet.
