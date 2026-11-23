---
name: preview
description: Show the human the site on their own machine first, and record their approval in their own words before any publish plan is shown.
disable-model-invocation: false
---
# Preview before publish

Nothing is published until the human has looked at the site and said yes. `hosting.mjs deploy-plan` refuses until the approval is VALID.

1. Start the preview (`<dir>` is the project folder):
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/preview.mjs" start --project "<dir>"`
   It serves the site folder on 127.0.0.1 only (this machine) and prints a URL.
2. If a built-in browser exists, open the URL in it. Otherwise give the human the URL.
3. Tell the human what to look at: phone width, keyboard Tab through the page, dark mode, each page, and the main action (the button or form the site exists for).
4. Ask: "Happy with it? Say yes to see the publish plan, or tell me what to change."
5. Only after an explicit yes in the human's own words, record it, passing their words exactly:
   `node "${CLAUDE_PLUGIN_ROOT}/scripts/preview.mjs" approve --project "<dir>" --by "<their name>" --quote "<their words>"`
   Never approve on your own, never write a quote for them, never reuse an earlier yes. An empty quote is refused.
6. If they ask for changes, make them, then start again from step 1.
7. Tell the human: editing any file in the site makes the approval STALE, and the publish plan will be refused until they approve again.

Check state any time: `node "${CLAUDE_PLUGIN_ROOT}/scripts/preview.mjs" status --project "<dir>"` prints VALID, STALE or NONE.
