---
name: project-handoff
description: Write HANDOFF.md, a PDF and a short slide deck that tell the next person what was built, how to run it, the risks and the next steps.
disable-model-invocation: true
---
# Lilac project handoff

Run: `node "${CLAUDE_PLUGIN_ROOT}/handoff/handoff.mjs" "${CLAUDE_PROJECT_DIR}"`

Files go to `.lilac/handoff/` in the project. Tell the user where they are and read the Open risks and UNKNOWN lines aloud in plain words: every `UNKNOWN` is something the project did not say. The PDF needs Google Chrome (or Chromium/Edge); if it printed that Chrome was not found, say HANDOFF.md and the slide deck were still written. Do not invent facts to fill an UNKNOWN.
