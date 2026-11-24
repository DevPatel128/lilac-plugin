---
name: fidelity
description: Check the built site against the accepted requirements and write a traceability matrix. Use after the build or before deploy.
disable-model-invocation: true
---
# /lilac:fidelity

Does the site do what the requirements say? Output is a matrix, not a score.

1. Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/fidelity.mjs" run "${CLAUDE_PROJECT_DIR}"`. Needs `brief/requirements.yaml`. If missing, tell the user to run `/lilac:requirements` first.
2. Read `reports/FIDELITY.md`. Lead with the line `Must-have pass rate: X of Y (Z%)`. Never call it an average.
3. Items marked NEEDS-BROWSER (behavior, perf, a11y): run the browser gates (`qa-browser`, `controls-test`) and say what they cover. Do not mark them PASS yourself.
4. Items marked NEEDS-JUDGE (visual): act as a rubric-bound vision judge.
   - Screenshot the page (desktop and mobile). Judge one requirement at a time against its EARS text only, not general taste.
   - Answer `yes`, `no` or `partial`, and cite the `region` you looked at (for example `hero, top 600px`). No region, no verdict.
   - Write `[{"id":"R-007","verdict":"yes","region":"hero, top 600px"}]` to a file in `.lilac/`, then rerun with `--judge-file <file>`. Answers without a region are rejected.
5. MANUAL items: list them for the user. They check these themselves.
6. A FAIL on a must-have, or any N- item present, blocks deploy. Offer fixes with AskUserQuestion (Fix now / Change the requirement / Stop). Changing a requirement is the user's call.
