---
name: brief
description: Interview the user in up to 8 plain questions, write a checked BRIEF.md, and get their approval before any building starts.
disable-model-invocation: true
---
# Lilac brief

Ask ONE question at a time. Wait for the answer. Use plain words. Never invent an answer for the user. If they do not know, write `UNKNOWN` or, for facts, `Use placeholders marked SAMPLE`.

Questions, in order (at most 8; skip any the user already answered):

1. Who is it for?
2. What must a visitor be able to do? (the one main action)
3. What is TRUE about the business? Real facts only. If none yet, say "use placeholders marked SAMPLE".
4. What must the site NOT claim?
5. Tone: name 3 websites you like or dislike, and say why.
6. Which pages do you need?
7. Limits: languages, budget, deadline, accessibility needs, and motion level (none, subtle or expressive).
8. Where should it live? Follow the `hosting` skill (`/lilac:hosting`). Cloudflare is the default. Code is always on GitHub. Then ask: what does success look like, with a number you can measure?

Then:

1. Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/brief.mjs" new "${CLAUDE_PROJECT_DIR}"`. If `BRIEF.md` already exists, edit it; do not overwrite.
2. Fill every section of `BRIEF.md` from the answers, in the user's own words.
3. Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/brief.mjs" check "${CLAUDE_PROJECT_DIR}/BRIEF.md"`.
4. Tell the user the score and each fix in plain words. Fix what they can answer now. A missing required field (exit 1) blocks building.
5. Show the brief. Ask: "Do you approve this brief?" Do not start building until they say yes in this conversation. Changes later need a new yes.

Tips for the user: the guide `docs/PROMPTING.md`.
