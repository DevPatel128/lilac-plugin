---
name: lilac
description: Run the full Lilac loop. "/lilac idea <idea>" tests a new product idea; "/lilac <requirement>" takes a change from requirement to production. Use when the user states a new idea, feature or requirement.
---
# Lilac autopilot

Rule 0: be blunt. Real risks, real numbers, no sugarcoating. Kill weak ideas with evidence.
First check the repo variable `AUTOPILOT`. If it is `off`, plan only, change nothing.
Read `AGENTS.md`. Respect the autonomy table in `Lilac/GOVERN.md`. Leave a trace for every step: a PR comment or a doc line.

## Idea mode: `/lilac idea <idea>`
1. **Interview.** Ask at most 7 questions in one message: user, problem in their words, evidence it exists, what they do today, constraints, outcome, what would prove us wrong. Never invent the answers.
2. **Research** (`research` skill): market, competitors, demand signals (Reddit/X threads, search, what LLMs answer today), pain language. One page.
3. **Verdict:** GO, TEST or KILL, with the reason in one line each. Be honest about the odds.
4. **Test (if TEST):** the cheapest proof. A Vite landing page + D1 waitlist + Turnstile + PostHog, plus `post` drafts. Write the go/pivot/kill thresholds into `PRODUCT.md` BEFORE launch.
5. **Decide:** GO fills the `PRODUCT.md` brief. PIVOT or KILL goes in `DECISIONS.md`.

## Tasks and roles
When the founder runs it through the task engine (`Lilac/core/lilac task new`, the runner or the console), the engine routes the work to one of the four roles (`Lilac/roles/`): Lilac researches, Coder builds, Donna verifies independently, Devisity turns failures into proposed lessons. The engine enforces the autonomy table; a protected action waits for the founder's recorded approval.

## Change mode: `/lilac <requirement>`
00. **Phase:** read `phase:` in `TASK.md` (default 1) and the matching skill: `phase-1-build`, `phase-2-secure` or `phase-3-launch`. Do not start later-phase work early; record skills used in the product `PHASES.md` ledger (`operations/scripts/phase-check.mjs`).
0. **Check against Lilac first:** `bash operations/scripts/lilac-check.sh "<requirement>" [paths]`. Read the rules, Lilac files and past mistakes it prints. If the requirement conflicts with them, say which rule and stop. Re-run it when the scope grows to new areas.
1. **Research** only if facts are unknown. Keep only facts that change a decision. A new dependency, provider, major upgrade or migration goes through `tech-decision` first.
2. **Plan:** add acceptance criteria with IDs to `PRODUCT.md` and write a `TASK.md` card. Bundle enough IDs to meet the VU floor (`operations/scripts/lilac-stats.sh`). Ask only when blocked.
3. **Build** with the coding rules in `AGENTS.md` (least code; `db.ts` scoping; file caps). UI work goes through the `design` skill: `DESIGN.md` first, then seen in a real browser at 375/768/1280. Endpoints, integrations, dashboards, admin or team features and model calls go through the `api`, `adapter`, `dashboard`, `admin` and `ai` skills (contract first, kit helpers, tests named in the skill).
4. **Review:** run `review`, fix the Must/Should findings, then `verify` the main claim. Before a launch or after a large auth, data or payments change, run `security-audit` (full mode, `quick` profile first) and fix its confirmed findings with `security-fix`.
5. **Docs:** update every touched doc in the same branch, `DESIGN.md` for tokens and components (`operations/scripts/docs-impact.sh` must pass).
6. **Ship:** run `ship` (local gate, PR with `Delivers:` + `AI tokens:`, CI, merge per autonomy, deploy watch).
7. **Measure:** run `operations/scripts/lilac-stats.sh` and `operations/scripts/lilac-cost.sh` and post the deltas as a PR comment.
8. **Learn:** for any mistake, or any metric more than 20% worse than its 5-PR median, run `learn`.
9. **Grow** (user-facing changes): `post` drafts, a `GROWTH.md` page log line, and `pitch` if the deck gate is met.

## Stop and ask when
Requirements conflict · data or money could be lost · a new provider or dependency is needed · 3 CI fixes failed · token cost passes 2× the median · confidence is low.
Auth, payments, `db.ts` and migration changes: build and test them, then stop **before merge** and ask.

## Report (end of every run)
Delivered IDs · evidence · metrics delta · what was not checked · what could fail.
