---
name: blocks
description: Build sites faster from pre-tested accessible blocks and one of three art directions; fill slots with the brief's true content and re-run the gates.
disable-model-invocation: false
---
# Lilac blocks

Use after `foundation` is VALID. Blocks are tested HTML/CSS/JS pieces; directions are token sets plus layout CSS. They save time and keep pages consistent. They do not replace the brief.

1. Read `BRIEF.md` and the approved foundation. List the pages and what each must do. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/blocks.mjs" list`.
2. Pick a direction that fits the brief's audience and tone, and say why in one line: `warm-editorial` (serif, paper tones, rules: writing, food, craft, culture), `crisp-product` (geometric sans, high contrast, grid: software, tools), `calm-soft` (rounded, muted: care, wellbeing, community). If the human already approved brand tokens, keep them and use only the direction's layout CSS; never overwrite approved tokens.
3. Pick only the blocks the pages need. Add each: `node "${CLAUDE_PLUGIN_ROOT}/scripts/blocks.mjs" add "<project>" <block> --direction <name>` (never overwrites; prints the include lines). To preview a whole look: `blocks.mjs assemble <dir> --pages <spec.json> --direction <name>`.
4. Fill every `{{slot}}` with TRUE content from the brief. Anything the brief does not state is written `UNKNOWN` or marked SAMPLE. Never invent prices, hours, addresses, policies, awards or quotes. `testimonial-placeholder` stays a SAMPLE slot: delete it unless the human supplies a real quote they may use.
5. Do not change a block's accessibility behaviour (labels, focus handling, aria, no-JS fallback, reduced-motion rule) without re-running the gates: `blocks.mjs check`, then `qa.mjs`, `qa-browser.mjs`, `controls-test.mjs` on the site. Use `var(--token)` only; no literal colours, inline handlers, inline styles or external URLs.
6. Record in BUILD-LOG: direction chosen and why, each block used (name and page), every slot left SAMPLE or UNKNOWN, and the gate output lines.

`consent` is off by default and is a plain notice for a site with no tracking, not a consent manager. Say so if the human asks for analytics.
