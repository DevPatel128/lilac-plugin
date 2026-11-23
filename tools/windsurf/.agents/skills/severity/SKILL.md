---
name: severity
description: Set how strict every Lilac gate is, from 1 (sketch) to 10 (audit). Use when the user wants faster or stricter checks.
disable-model-invocation: true
---
# /lilac:severity <1-10>

One number sets which approvals and gates run. Show the table, then ask which level with AskUserQuestion (no default; the user always picks).

| Level | Name | Before the preview | After the preview (still needed before deploy) | Approvals |
|---|---|---|---|---|
| 1-2 | Sketch | static qa, secrets scan | none | brief |
| 3-4 | Draft | static qa | qa-browser | brief, preview |
| 5-6 | Standard | + foundation drift, funnel, ux graph | qa-browser, controls-test | + foundation, funnel |
| 7-8 | Strict | all gates incl. persona-test | none | all, deploy |
| 9-10 | Audit | all gates, any finding blocks | none | all, each with a written reason |

The floor never drops at any level: no invented facts (UNKNOWN or SAMPLE), secrets scan, no unlicensed assets, approval before deploy, no real-person imagery without consent.

Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/severity.mjs" set "${CLAUDE_PROJECT_DIR}" <n>`. Raising it makes skipped approvals and deferred gates required again. `show` prints what applies.
