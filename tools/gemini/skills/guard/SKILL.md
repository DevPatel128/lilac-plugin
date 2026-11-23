---
name: guard
description: "Guardrails and governance for the agents that build the product and for the product's own AI: what agents may do alone, what needs a person, cost and token limits, supply chain, incidents, capacity claims, environments, and product boundaries. Use when setting up a repo, before giving an agent more autonomy, after an incident, or when asked about governance, approvals or compliance."
---
# Guard

Rule 0: blunt. A guardrail that is only written down is a wish. Prefer a hook, a check or a test that fails; say plainly which rules are only advice. Never describe a hook or check as active unless you saw it installed in this project.
Read `AGENTS.md`, `GOVERN.md` (autonomy table), then `REFERENCE.md` in this folder.

## 1. What is enforced and what is only instructions
Be exact with the user about which is which.
- **Enforced by Claude Code itself (tool lists in `agents/*.md`):** Planner has `Read, Grep, Glob` only, so it cannot edit or run anything. Docs has `Edit, Write` but no Bash. Reviewer, Tester, Security and Release have no Edit or Write tool but DO have `Bash`, and Bash can write files, delete files and reach the network. For those four, "read-only" and "Release never deploys" rest on instruction text only.
- **Shipped with this plugin:** one optional `Stop` hook (`hooks/hooks.json`) that records learning data only when the user turned learning on, and scripts that refuse to write through symlinks. Nothing else runs by itself.
- **Not shipped in the plugin:** `guard.sh`, `lilac-precommit.sh`, `pr-gate`, `docs-impact`, `repo-check`, `api-check`, `loadtest.sh`, `lilac-sync`, `lilac-stats`. They exist in the Lilac repo and its `kit/` starter. They run in a project only if that project installed the kit and registered them in `.claude/settings.json` and the git hooks path. Check that before claiming them; if absent, say "advice only".
- **Instruction text only (a prompt-injected agent can ignore it):** the autonomy table, "ask before outward actions", cost and token limits, approvals and `--by`/`--quote` records. Approval files are self-attested: they show an approval exists, not that a human wrote it.
- Protected areas (auth, data, money, admin, integrations, security, mobile) stop before merge for a person only where the kit's PR checks are installed.

## 2. Set up or review a repo
1. If the kit is used, run `lilac-sync`, then confirm `.claude/settings.json` registers the guard hook and the git hooks path is set. If it is not, say the guard is advice only.
2. Fill `GOVERN.md`'s autonomy table for this product: what the agent may merge alone (low risk only), what needs a person.
3. Route models (`kit/AGENTS.md`): Opus plans, Sonnet builds and ships, Haiku runs checks. Put `AI tokens: <total> (opus n, sonnet n, haiku n)` in every PR; `lilac-stats` flags a PR above twice the median.
4. Environments: dev (local `wrangler dev`), preview (`--env preview`, its own D1, R2 and KV), production. Tests and load tests never touch production.

## 3. Before a claim or a launch
- Capacity: write the expected load (concurrency, requests a second, data volume) in `SYSTEM.md`, then `bash operations/scripts/loadtest.sh <preview-url>` (k6; refuses production). No number, no claim.
- Security: `security-audit` (quick profile at least), fix with `security-fix`.
- AI features: the NIST AI RMF checklist in `REFERENCE.md`; evals green.
- Legal: `LEGAL.md` human-approved; DPDP duties dated there.

## 4. When something goes wrong
Follow the incident path in `REFERENCE.md`: contain, preserve evidence, tell the owner, fix with a failing test, notify people the law requires (DPDP: the Data Protection Board and affected people for a personal-data breach), then a `MISTAKES.md` row with its enforcing check.

## 5. Report
`Enforced:` (hooks and checks that would fail) · `Advice only:` (what still relies on people) · `Gaps:` with the cheapest enforcing check for each.
