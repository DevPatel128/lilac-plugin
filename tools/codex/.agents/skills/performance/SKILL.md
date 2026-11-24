---
name: performance
description: Check a built site against performance budgets, audit images, and fingerprint Lilac blocks. Use before launch or after block edits.
disable-model-invocation: true
---
# /lilac:performance

Static, offline checks. Budgets are starting numbers, not measurements.

1. Budgets: `node "${CLAUDE_PLUGIN_ROOT}/scripts/perf-budget.mjs" check "<site dir>" [--profile mobile]`. Exit 1 means over budget; fix the listed items.
2. Images: `node "${CLAUDE_PLUGIN_ROOT}/scripts/images.mjs" audit "<site dir>"`, then `plan` for the conversion commands. The script converts nothing. Ask with AskUserQuestion (Approve / Change something / Stop) before running any command it prints.
3. Blocks (Lilac maintainers): `node "${CLAUDE_PLUGIN_ROOT}/scripts/visual-regression.mjs" check`. After a reviewed block change, ask with AskUserQuestion (Approve / Change something / Stop) before running `snapshot`. `--screenshots` saves PNG baselines when Chrome exists.

Never claim a site is fast from these checks alone: real load time is UNVERIFIED until measured.
