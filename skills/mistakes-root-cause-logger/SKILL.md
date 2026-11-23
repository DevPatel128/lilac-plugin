---
name: mistakes-root-cause-logger
description: "Mistake Log & Root Cause Analysis Engine: Systematically recording bugs, regressions, and false assumptions in `docs/mistakes/log.md`. Skill 100 of 100 in enterprise-web-architect, Tower 10 (Digital Experience, Growth Marketing, Pricing & Governance). Use when a task involves Mistake Log & Root Cause Analysis Engine."
---
# 100. Mistake Log & Root Cause Analysis Engine

Tower 10: Digital Experience, Growth Marketing, Pricing & Governance. Part of the `enterprise-web-architect` master skill, which holds the execution protocol, the living documents and the model routing matrix.

## What it covers
Systematically recording bugs, regressions, and false assumptions in `docs/mistakes/log.md`.

## How to apply in Lilac
1. Read `AGENTS.md` and run `lilac-check` first. The autonomy table in `GOVERN.md` decides what needs the founder: merge, deploy, migration, new dependency or provider, spending money.
2. Start from first principles: the user goal, then the memory, compute, network and disk limits that actually bind.
3. A new library, provider or service goes through the `tech-decision` skill before anything is installed.
4. Record the decision as an ADR in `docs/adr/` (template `docs/adr/0000-template.md`), with numeric targets.
5. Prove the result with a test or a measured before and after (`verify` skill). Never claim an unmeasured gain.
6. Log any misstep with its 5 Whys in `docs/mistakes/log.md`, and end it with a check that was seen to fail.

**Lilac note:** Lilac also keeps `MISTAKES.md` and the `learn` skill (a mistake ends as a check seen to fail); log in `docs/mistakes/log.md` and keep that rule.
