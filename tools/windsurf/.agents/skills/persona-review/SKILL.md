---
name: persona-review
description: Get opinions on a page from several AI persona reviewers (first-time visitor, skeptical buyer, busy owner, accessibility user, domain expert), merge and rank them, and label them honestly as AI opinions, not user feedback.
disable-model-invocation: false
---
# Lilac persona review

The owner wants many different users to say what they think. Real people cannot be automated here. This skill gives AI persona opinions, clearly labeled. It never claims user feedback.

1. Collect evidence: run `qa-browser` and `persona-test` first if available (screenshots land in `<project>/.lilac/`, e.g. `.lilac/personas/`). Get the page text (headings, copy, button labels) of the home page and the main pages.
2. Spawn N reviewer subagents (default 5, maximum 10, never more) in parallel, one persona each: first-time visitor, skeptical buyer, busy owner, accessibility user, domain expert for the site's field. For N above 5 add distinct personas (for example price-sensitive, mobile-only, returning customer, competitor); never repeat a persona. Give each: its persona, the page text, and the screenshot paths. Tell each it is an AI playing a role and must not invent facts about the business. Ask for: specific problems (quote the exact text or element), what confused them, and what they would do next.
3. Merge: remove duplicates, rank by severity (blocks the main task, hurts trust, minor), keep who raised each item.
4. Report, every item labeled `AI persona opinion, not real user feedback`. Never write "N users said": say "N AI persona reviewers". Do not average, score or turn opinions into statistics.
5. End by saying real feedback needs real people: ask 5 to 8 real visitors, see `docs/PILOT.md`.

Rules
- Reviewers only read; they never edit files or contact anyone.
- Pass facts only from the page and screenshots. Anything a persona claims beyond them is a guess: mark it so.
- Do not present findings as validation of demand, pricing or product-market fit.
