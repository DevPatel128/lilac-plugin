---
name: change
description: Make a requested edit safe and visible: record a baseline, edit minimally, diff screenshots and gates, show the human before/after, then keep or undo.
disable-model-invocation: false
---
# Lilac change

For requests like "make the hero bolder". The edit is yours; `change.mjs` makes it safe and visible.

1. Before you touch any file: `node "${CLAUDE_PLUGIN_ROOT}/scripts/change.mjs" begin "<project>" --note "<the request in the human's words>"`. It saves a copy of the site, screenshots every page at 360, 768 and 1280 px, and runs the checks as a baseline. If it prints `SKIPPED(no browser)`, say so: there will be no pictures.
2. Edit as little as you can. Change only what the request needs. No cleanups on the side.
3. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/change.mjs" finish "<project>"`. It lists the changed files, the pages they touch, a pixel diff, any page that changed that should not have, and the checks again.
4. Read `<project>/.lilac/changes/<n>/CHANGE.md`. The verdict line is the only thing that may be called safe:
   - `SAFE`: no new check errors, no surprise visual change.
   - `REVIEW`: look at the pictures and the new warnings, then tell the human what you saw.
   - `BROKEN`: a check error that was not there before. Fix it (run `finish` again after another `begin`, or `undo`), do not argue with it.
5. Show the human `compare.html` (before | after | diff) from the same folder. Then ask exactly: "Keep or undo?" Do not decide for them.
6. If they say undo: `node "${CLAUDE_PLUGIN_ROOT}/scripts/change.mjs" undo "<project>" <n>` and say which files were reverted. If the tool refuses because the site changed after `finish`, tell the human; use `--force` only with their yes.
7. If they say keep: add one line to `CHANGELOG.md` in the project: date, the request, files changed, the verdict.

Rules
- Never call a change safe without a `CHANGE.md` verdict from this run. No verdict: say what you did and that it is unchecked.
- Never edit the tool, the baseline or `.lilac/changes/` to get a better verdict.
- `change.mjs list "<project>"` shows every recorded change.
- A change that needs a human eye (copy, taste, real devices) stays with the human: say so.
