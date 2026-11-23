---
name: foundation
description: Before any site code, plan the architecture and stack, make the brand kit and get the human's approval, then keep the build honest to it.
disable-model-invocation: false
---
# Lilac foundation

Runs AFTER the approved brief and BEFORE any site code. Order of the whole build:

brief -> foundation (approve) -> build -> qa -> qa-browser -> controls-test -> persona-test -> ux-review -> security -> hosting -> preview (approve) -> deploy plan

Hard rule: do not write site code until `node "${CLAUDE_PLUGIN_ROOT}/scripts/foundation.mjs" status "${CLAUDE_PROJECT_DIR}"` prints VALID. Facts you cannot verify are written `UNKNOWN`, never guessed.

## Steps

1. Start: `node "${CLAUDE_PLUGIN_ROOT}/scripts/foundation.mjs" new "${CLAUDE_PROJECT_DIR}"` (never overwrites). For an EXISTING project run `adopt` instead: it writes DRAFT files from the current CSS and config files; review every line, then remove the DRAFT marker.
2. Architecture and stack, in `FOUNDATION.md`. Default to the simplest stack that meets the brief: static HTML, CSS and JS, unless the brief needs server state, sign-in, or many pages from data. Justify any framework. Use the `tech-decision` skill for any library. Record languages, tools (package manager, test runner, formatter and linter), folder structure, data and storage, hosting (follow `/lilac:hosting`; ask the human, do not assume), performance and accessibility budgets, and the security baseline (strict CSP and headers, no inline scripts, no third-party requests by default, analytics none by default). Each decision is a short entry: decision, options considered, why, trade-offs, revisit when.
3. Brand kit, in `BRAND.md`: name check (advise a trademark search, never claim the name is available), voice (3 adjectives, do and don't examples), wordmark as simple SVG with a text fallback, colour tokens for light AND dark (bg, surface, text, muted, primary, accent, accent-text, link, danger, success, focus), typography (system stacks or licensed local fonts only, size scale, line height), spacing, radius and shadow, motion (durations at most 600 ms, easing, a reduced-motion rule), imagery, iconography, accessibility commitments. The machine-readable `json tokens` block is the single source.
4. Generate and check: `foundation.mjs tokens "<dir>"` then `foundation.mjs check "<dir>"`. Fix every error and re-run until it prints `0 error(s)`.
5. Show the human `brand/brand-sheet.html` (one page: swatches with contrast ratios, type scale, spacing, motion demo, wordmark) and summarise the stack decisions in plain words. Ask: "Do you approve this foundation, or what should change?"
6. Only after an explicit yes in the human's own words, record it, passing their words exactly: `foundation.mjs approve "<dir>" --by "<their name>" --quote "<their words>"`. Never approve on your own, never write a quote for them, never reuse an earlier yes. An empty quote or a failing check is refused.

## While building

- Use `brand/tokens.css` (copy or link it into the site) and write `var(--token)`, not colour, font or duration literals.
- If a token changes later: edit the tokens block, re-run `tokens`, re-run `check`, and ask the human to approve again. Any edit to FOUNDATION.md, BRAND.md or the tokens makes the approval STALE.
- At the end of the build run `foundation.mjs drift "<dir>" [--site "<site folder>"]`. It lists colours, font-family values and durations that are not in the tokens (first 10 shown) and exits 1 only when a literal text colour fails contrast. Replace each with `var(--token)` or change the tokens properly, then re-run.

Human guide: `docs/FOUNDATION.md`.
