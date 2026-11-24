---
name: converge
description: Fix what the fidelity judge missed, rerun only the needed gates, at most 3 rounds. Use after /lilac:fidelity reports misses.
disable-model-invocation: true
---
# /lilac:converge

Needs `reports/FIDELITY.md` with its trailing json block (see `scripts/converge.mjs` header).

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/converge.mjs" plan "${CLAUDE_PROJECT_DIR}"`. Show the misses and the gates to rerun.
2. AskUserQuestion: Approve fixing these / Change something / Stop.
3. Fix only the listed requirements. Touch nothing else.
4. Rerun only the gates the plan named, then fidelity. Then record: `converge.mjs record "${CLAUDE_PROJECT_DIR}" --round <n> --fixed R-004,R-007`.
5. Misses left and round < 3: back to step 1. Round 3 done or `record` refuses: stop and ask the human with AskUserQuestion (Accept as is / Change the brief / Stop). Never loop a fourth time.

`converge.mjs status` shows rounds used. Misses marked UNKNOWN stay UNKNOWN; do not invent a fix.
