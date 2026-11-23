---
name: craft-review
description: Score a built site's craft (type, spacing, colour, motion, hierarchy) 0-100, fix what is weak, re-score. Use after the build.
disable-model-invocation: true
---
# /lilac:craft-review

Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/craft-review.mjs" score "<site dir>" --loop-hint` (add `--library <entry>` for a distance report against a reference entry, `--threshold N`, default 70).

1. Read the score and each failed check with its evidence. Say it in plain words.
2. Below threshold: fix the weakest dimension using the hint, re-run with `--dimension <name>`. Max 3 rounds. After round 3, report what is left. Do not loop further.
3. Run `craft-review.mjs signature "<site dir>"`. One `data-signature` element must exist. If it is missing, ask where the signature moment goes.
4. Ask with AskUserQuestion: Approve / Change something / Stop.

## Point-and-say edits

The user says "make this bolder", "tighter here", "calmer". Map it to one element:

1. Find the element (the user's pointer, or the class/id they name). Get its selector.
2. Pick the token the word moves: bolder = `font-weight` or heading step up one scale value; tighter = next smaller `--space-n`; calmer = fewer colours, longer `--dur-*`, lower accent use.
3. Change that selector's declaration to a token that already exists. Never add a one-off value.
4. Re-score only the dimension it touches (`--dimension type`, `spacing`, ...). If it drops, undo.

## Limits

Static scan of HTML and CSS, not a browser. The score says the work is consistent, not that it is beautiful. Until the blind designer test (docs `Craft.md`) is run and recorded, the gate ships off (`minSeverity` 7) and the score is advice. UNVERIFIED.
