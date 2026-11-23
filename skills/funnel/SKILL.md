---
name: funnel
description: After the brief and foundation are approved and before any page is built, define the visitor's path to the one business goal in FUNNEL.md and .lilac/funnel.json, then check the built site against it.
disable-model-invocation: false
---
# Lilac funnel (user command `/lilac:funnel`)

A funnel is the path from a stranger's first visit to the one thing the owner wants them to do. Lilac cannot promise sales. It checks what can be checked honestly: is there a short path, is the next step clear, does the form make sense, is there a confirmation, is every claim true.

Order: brief (approved) -> foundation (approved) -> **funnel** -> build pages -> qa -> persona-test. Do not build pages until `FUNNEL.md` is filled and the human has read it.

## Steps

1. Start: `node "${CLAUDE_PLUGIN_ROOT}/scripts/funnel.mjs" new "<project>"`. It copies the template to `FUNNEL.md` and a skeleton `.lilac/funnel.json`, and never overwrites.
2. Read `BRIEF.md` and `FOUNDATION.md`. Ask the human only what they left out, one question at a time. Facts you do not have are `UNKNOWN`.
3. Fill `FUNNEL.md`:
   - The ONE business goal (buy, book, request a demo, enquire, sign up) and the ideal customer in one sentence.
   - The six stages (aware, interested, considering, ready, done, return). For each: the page or screen, the visitor's question, the content that answers it, the one next action, the friction to remove.
   - The main path as a numbered list with a maximum click budget (3 or fewer is the default). Secondary paths below it.
   - The confirmation (what the visitor sees, what happens next and when) and the follow-up (how they hear back: email with consent, a reminder, an account).
   - Trust elements that are TRUE: clear prices or "ask for a quote" with a reply time you can keep, policies, a real contact route, a privacy note. NEVER invent reviews, ratings, logos, customer counts or awards. On a sample site every made-up example says SAMPLE.
   - Measurement: what to count at each stage, privacy-friendly, off by default. The success metric with a placeholder the owner fills from real data. The experiments to run later with real visitors, one change at a time.
4. Write `.lilac/funnel.json` (the same funnel, for the checker): `goal`, `customer`, `entryPages`, `maxClicks`, `goalPage`, `goalControl` (`selector` and/or `text` of the form or button), `steps` (each: `stage`, `page`, `control` with `selector` or `text`), `confirmation` (`page` and the `text` the visitor sees), `successMetric`.
5. Build the pages (Builder role) to match. After building, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/funnel.mjs" check "<project>"` and fix every error with its `fix:` hint. Errors are: no path to the goal inside the click budget, no confirmation step, a page with no next step, invented social proof not marked SAMPLE or sourced, a missing goal control. Warnings are advice; fix them or say why not. Each finding names the UX record that backs it (for example UX-0029); read that record before arguing with the finding.
6. Rehearse: `node "${CLAUDE_PLUGIN_ROOT}/scripts/funnel.mjs" tasks "<project>"` adds a "funnel:" task to `.lilac/personas.json` (your own tasks stay). Then run the persona-test command it prints. Simulated visitors show where the path breaks; they are not real customers.
7. Summarise: `node "${CLAUDE_PLUGIN_ROOT}/scripts/funnel.mjs" report "<project>"` writes `FUNNEL-REPORT.md`.

## Rules

- No invented facts. A review, rating, logo, count or award is shown only if it is real and sourced (name, date, link), or marked SAMPLE on a demo site. When unsure, leave it out.
- Say the limit every time: this checks structure, not sales. Never report or estimate a conversion rate. Real conversion needs real traffic, privacy-friendly counts and one change at a time.
- Measurement is off until the human says on. Do not add third-party analytics scripts; the check flags them.
- Sending email, creating accounts and anything outward-facing needs the human's explicit yes, for that action.
- Read-only roles report; only the Builder edits files.

## What the check does not judge

Copy quality, whether the offer is wanted, trust as a person feels it, real-device behaviour, the real tap size (run `qa-browser.mjs`), and anything that happens after the form is sent (the server side is not in the built pages).
