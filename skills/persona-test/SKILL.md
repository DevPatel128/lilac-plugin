---
name: persona-test
description: Run simulated visitors (mobile on slow 3G, skimmer, keyboard-only, screen-reader proxy, low-vision, reduced-motion, no-JavaScript, impatient, 320 px phone) against a site, fix the tasks they cannot complete, and report honestly what this does and does not show.
disable-model-invocation: false
---
# Lilac persona test

These are SIMULATED visitors, not real people. Scripted browser sessions check whether a visitor using a given method can complete a task. Say so every time you report the result.

1. Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/persona-test.mjs" "<project>"` (options: `--site <dir>`, `--visitors 100`, `--seed N`, `--json`, `--min-overall 90`, `--min-persona 70`). It serves the site on 127.0.0.1, drives the system Chrome with no installs, blocks every request to other hosts, and cleans up its Chrome and temp files. Without Chrome it prints `persona-test: SKIPPED(no browser)`: list the step as not done, never as passed.
2. Read the report: completion per persona and per task, median steps and time, and the 5 worst failures with persona, page, step, reason and a screenshot under `<project>/.lilac/personas/`. Same seed, same report.
3. Fix every failure in the Builder role (read-only roles hand the list over). Typical causes: nav built from clickable `<span>`s (keyboard and screen-reader fail), controls without an accessible name, content that needs JavaScript, content wider than 320 px, a contact or booking control that is missing or hidden, a form with no visible confirmation.
4. Re-run with the same seed until the last line shows no failure group(s) you can fix. Never edit the tool, lower `--min-*`, or change the seed to make it pass.
5. Report: the final `persona-test:` line verbatim, what was fixed, what remains and why.

Tasks (derived from the page): understand the offer (a visible h1), find a way to contact/buy/book, reach every top-nav page, complete the main form with valid sample data and see visible feedback, find opening hours or a price (only when the site has one). A task passes only when that persona's own method completes it inside its step budget.

Extra tasks: put `<project>/.lilac/personas.json` next to the site:
```json
{"tasks":[{"name":"book a class","startPage":"/classes.html","personas":["keyboard","mobile-3g"],
  "steps":[{"click":"Book now"},{"type":"Email","text":"sam@example.com"},{"click":"Confirm"},{"expectText":"Booked"}]}]}
```
`startPage` defaults to `/`; `personas` (optional) limits who runs it; `click` matches visible control text, `type` matches a field label, `expectText` waits up to 1.5 s for text on the page.

Limits (say these out loud)
- It measures whether tasks can be completed with each method. It does not measure taste, opinions, trust, copy quality or real demand, and it is not a user study.
- Form POST handlers cannot be verified offline: a form only passes when the page itself shows a confirmation.
- The screen-reader persona uses Chrome's accessibility tree, not a real screen reader; 200% zoom is approximated with CSS zoom; slow 3G is Chrome's emulation.
- A passing run is not proof the site is good. For real feedback, see `docs/PILOT.md`. For opinions from AI personas, use `persona-review`.
