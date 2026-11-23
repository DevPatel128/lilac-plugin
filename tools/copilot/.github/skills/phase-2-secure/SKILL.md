---
name: phase-2-secure
description: "Phase 2 of 3 (given to customers, high security): harden everything from Phase 1 until it is secure, fast, observable, accessible and resilient, with no errors and no loose ends, before any real customer data enters. Use when Phase 1 is signed off or TASK.md says phase: 2."
---
# Phase 2: Customer-ready

Rule 0: no customer gets access until every finding is closed and every Phase 2 skill has run. Hardening only; no new features. The bar is higher than Phase 1 because real people's data now exists.
Run `lilac-check` first; set `phase: 2`. Skills and their use: [MAP.md](MAP.md) (from ../PHASES.md (not in this pack)). Paid items are deferred, not skipped: write the readiness note and use `paid: <slug>` (Paid Tech (not in this pack)).
1. **Independent audit:** `audit`, `repo` (secrets in full history), `security-audit` full profile (fresh run, not the Phase 1 one), `strix-pentest-assistant`, `cloudflare-security-audit`, `wcag-a11y-audit`, `pact-contract-schema-testing`. One findings list; zero open High or Medium to proceed.
2. **Fix one at a time:** `security-fix` (failing test, smallest fix, MISTAKES row), `fix` for errors, `review` each diff, `learn` after each.
3. **Identity and data protection:** passkeys and 2FA offered to everyone and required for admins (`zero-trust-webauthn-passkeys`), Google sign-in (free); `field-level-pii-encryption`, `zero-knowledge-privacy-crypto`, consent per DPDP, admin behind Cloudflare Access (`ztna-casb-access-control`), `zero-downtime-db-migrations`, upload bounds (`zero-copy-arraybuffers`).
4. **Supply chain and policy:** `cyclonedx-spdx-sbom`, `policy-as-code-opa` in CI, `soc2-iso27001-compliance` evidence collection starts, `agent-tool-calling-sandbox` for any agent tool the product exposes.
5. **See it break before customers do:** `sentry-opentelemetry` live, `synthetic-e2e-probes`, `dr-bcp-resilience` restore drill (record RPO and RTO).
6. **Prove performance:** `empirical-benchmarking`, `load-stress-performance-testing` (k6), `web-perf`, `workers-profiling`, and the Phase 2 low-level skills only where a measurement shows a problem.
7. **Prove journeys:** `playwright-mcp` end to end on desktop and phone; native tests (`xcuitest`, `swift-testing`) on the Simulator.
8. **Email that arrives:** `email-deliverability-dns-auth` (SPF, DKIM, DMARC pass, real inbox test), `inbound-email-parsing-webhooks`, `webpush-vapid-notifications`.
9. **Loose-ends sweep:** `grep -rniE 'TODO|FIXME|XXX|UNKNOWN'` empty or each hit owner-approved; `CHECKLIST.md` release gate ticked; every route has an error state.
10. **Ledger:** a proof row per Phase 2 skill, a `DECISIONS.md` waiver, or `paid: <slug>`.

Exit gate: no open Medium or High; CI green; restore, load, accessibility and deliverability proof attached; `node operations/scripts/phase-check.mjs 2` passes. First customers are a limited cohort; opening access is an owner decision (`GOVERN.md`).
Report: findings found / fixed / open, proofs attached, skills without proof, UNKNOWN items.
