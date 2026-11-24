---
name: brief
description: Read a pasted BRIEF block or interview the user in at most two screens, write a checked BRIEF.md, and get approval before building.
disable-model-invocation: true
---
# Lilac brief

Fast path first. If the user pasted a BRIEF block (lines starting B, R, I, E, F; template in `docs/PROMPT-TEMPLATE.md`), save it to a temp file and run `node "${CLAUDE_PLUGIN_ROOT}/scripts/brief.mjs" block <file>`. It scores each part filled, vague or missing and prints the questions still needed. A complete block means ZERO questions: run it again with `--write "${CLAUDE_PROJECT_DIR}"` (writes `BRIEF.md` and the severity) and go to the checks below.

Interview only for what is empty or vague. Never invent an answer for the user. If they do not know, write `UNKNOWN` or, for facts, `Use placeholders marked SAMPLE`. Use plain words.

- Ask with the AskUserQuestion tool, up to 4 questions per call (the `batches` from `brief.mjs block --json`). Eight questions are at most two screens, not eight turns.
- Always ask severity (1 to 10, see `/lilac:severity`) with no default. Severity 1 to 3: skip the optional questions and write `UNKNOWN`.
- Questions, skipping any already answered:

1. Who is it for?
2. What is the one action a visitor must be able to do, and what number means success?
3. What is TRUE about the business? Real facts only, or "use placeholders marked SAMPLE".
4. What must the site NOT claim?
5. Tone: name 3 websites you like or dislike and what to take from each.
6. Which pages, and what is the one signature moment? Dials 1 to 10: variance, motion, density.
7. Limits: languages, budget, deadline, accessibility needs. Motion level (none, subtle or expressive).
8. Where should it live? Follow the `hosting` skill (`/lilac:hosting`). Cloudflare is the default. Code is always on GitHub.

Then:

1. Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/brief.mjs" new "${CLAUDE_PROJECT_DIR}"`. If `BRIEF.md` already exists, edit it; do not overwrite.
2. Fill every section of `BRIEF.md` from the answers, in the user's own words.
3. Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/brief.mjs" check "${CLAUDE_PROJECT_DIR}/BRIEF.md"`.
4. Tell the user the score and each fix in plain words. Fix what they can answer now. A missing required field (exit 1) blocks building.
5. Show the brief. Ask with AskUserQuestion, options Approve, Change something, Stop (never type the question as text). Do not start building until they pick Approve in this conversation. Changes later need a new yes; the approval hook blocks site code while the brief is stale.

Tips for the user: the guide `docs/PROMPTING.md`.
