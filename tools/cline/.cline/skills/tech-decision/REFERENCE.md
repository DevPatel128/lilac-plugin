# Technology decision: reference

## Flow
`QUESTION → RESEARCH → EVIDENCE → INTERPRETATION → TRADE-OFFS → RECOMMENDATION → DECISION`

## Criteria and rubric
Score each option 0–3 per criterion. **0 is a blocker** and removes the option. Weights reflect Lilac's priorities (one founder, free tier first, security first); change a weight only with a written reason.

| # | Criterion | Weight | 3 | 1 | 0 (blocker) |
|---|---|---|---|---|---|
| 1 | Solves the actual problem | 3 | covers every required capability | covers most, gaps have workarounds | misses a required capability |
| 2 | Already available (repo, kit, platform, installed) | 3 | yes, no new code or package | partly | — |
| 3 | Maturity and maintenance | 2 | stable release, active commits and releases in the last 3 months, responsive to security issues | slow or single maintainer | abandoned, or pre-1.0 for a core path without a reason |
| 4 | Documentation and community | 1 | official docs current for this version | thin or outdated docs | none |
| 5 | Compatibility with the stack | 3 | runs on Workers/D1 (or the product's stack) within limits | needs an adapter or workaround | cannot run there (Node-only API, CPU or size limit) |
| 6 | Security, privacy, compliance | 3 | no open high advisories, least data shared, clear data location | needs mitigations | open critical advisory, unacceptable data flow, licence conflict |
| 7 | Performance and scale | 2 | fits budgets at 10× expected load | fits today only | breaks current budgets |
| 8 | Developer experience and operations | 1 | little new to learn or run | new tool to operate | needs ops the team cannot run |
| 9 | Total cost (usage + migration + upkeep) | 2 | free tier covers expected use | paid but bounded | unbounded or unaffordable |
| 10 | Lock-in and exit | 2 | standard formats, easy exit | exit costly but possible | no exit |
| 11 | Migration and rollback risk | 2 | none or reversible in a day | reversible with effort | irreversible, data at risk |
| 12 | Evidence quality and freshness | 1 | primary sources, < 3 months | secondary or older | none |

Licence check (part of 6): permissive (MIT, Apache-2.0, BSD) is fine. Copyleft or ShareAlike (GPL, AGPL, CC BY-SA) needs a written reason, because Lilac and the products are under the project's own licence. Unknown licence = blocker.

## Outcomes
| Outcome | When | Must include |
|---|---|---|
| KEEP | current stack meets the need, or no alternative beats it after migration cost | what was checked |
| ADOPT | clear winner, no blocker, founder approves | migration plan, rollback |
| TRIAL | promising, unproven here | bounded spike, flag, exit date, success metric |
| DEFER | not needed yet | the trigger that reopens it (a number or event) |
| REJECT | blocker or clearly worse | the blocker |

## Decision record (append to `DECISIONS.md`; Lilac itself: `ROADMAP.md`)
The table columns are `Date | Decision | Why | Options rejected | Trade-off | Files | Review`. Fill them from the seven recommendation fields:
- **Decision:** outcome + option ("ADOPT Zod 4 for request validation").
- **Why:** problem fit + the deciding evidence (with URL and date).
- **Options rejected:** each alternative and its losing reason, including KEEP CURRENT if not chosen.
- **Trade-off:** the cost accepted, the security notes, the migration and exit.
- **Files:** affected files or "none yet (PROPOSAL)".
- **Review:** the date or trigger that reopens it (from "what would change it").
Status stays PROPOSAL until the founder approves.

## Worked example (shape, not advice)
Question: "Do we need a queue library for the email outbox?" Existing: `src/jobs.ts` + `outbox` table + cron in the kit. Options: KEEP (kit outbox), Cloudflare Queues, a third-party queue. Scores: KEEP wins on 2, 5, 9, 10, 11; Queues wins on 7 only above the expected volume. Recommendation: KEEP; DEFER Queues until the outbox exceeds the cron's per-run budget (trigger: more than 1,000 sends a day). Migration: none.
