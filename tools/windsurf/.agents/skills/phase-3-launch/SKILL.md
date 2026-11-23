---
name: phase-3-launch
description: "Phase 3 of 3 (launch, maximum security): the strongest security proof, then go-to-market, pricing, business plan, investor decks, SEO, growth loops and monitoring. Use when Phase 2 is signed off or TASK.md says phase: 3. Blocks launch until every skill in the framework has been used, waived or deferred until funded."
---
# Phase 3: Launch

Rule 0: launch only when `node operations/scripts/phase-check.mjs all` passes and the maximum-security checks below are green. A single open finding of any severity blocks launch.
Run `lilac-check` first; set `phase: 3`. Skills and their use: [MAP.md](MAP.md) (from ../PHASES.md (not in this pack)). Paid items wait until the owner funds them (Paid Tech (not in this pack)).
1. **Maximum security, on the frozen build:**
   - A second independent `security-audit` (different profile and model from Phase 2) and `strix-pentest-assistant`; zero open findings of any severity. A paid human penetration test is the owner's call (Paid Tech).
   - `tla-plus-formal-methods` models for money, auth and sync; `faang-zero-trust-spiffe` workload identity; `pqc-quantum-security` crypto-agility plan.
   - `chaos-engineering` drills passed; `dr-bcp-resilience` failover rehearsed within the recorded RPO and RTO; rollback rehearsed.
   - `soc2-iso27001-compliance` evidence complete; `SECURITY.md` disclosure path live; kill switches tested (`edge-feature-flags-ab`).
2. **Launch-scale hardening:** the Phase 3 low-level and data skills (`crdt-eventual-consistency`, `lockfree-disruptor-ring-buffer`, `simd-json-vectorized-parsing`, `cdc-database-streaming`, and the rest in MAP) where load tests show need.
3. **Business:** `unit-economics-ltv-cac`, `value-pricing-packaging`, `research`; write `sell/BUSINESS-PLAN.md` (sourced numbers or `UNKNOWN`).
4. **Sell material:** `pitch` (`sell/USER.md`, `INVESTOR.md`, `INTERVIEW.md`, three decks from live data), `gtm-pitch-brochure-architect`, `ad`.
5. **Demand:** `programmatic-seo-opengraph-edge`, `post`, `harvey-outbound-gtm`, `email-broadcast-segmentation`, `inbound-lead-enrichment`, `plg-viral-loops`, `pls-b2b-expansion`; follow `GROW.md`. Launch-site motion and 3D skills inside the page-weight budget; `edge-i18n-localization`.
6. **Observe:** `opentelemetry-distributed-tracing`, `user-heatmap-behavior`, `user-session-replay-dem` and `email-telemetry-tracking-pixel` (privacy-safe, consent), `faang-blameless-postmortems` ready.
7. **Paid readiness:** Stripe, Apple sign-in, App Store and similar: write what would be built (`stripe-best-practices`, `storekit`, `apple-aso`) and set `paid: <slug>`; when the owner funds one, build it and replace the row with evidence.
8. **Ledger:** `node operations/scripts/phase-check.mjs all`. Then `ship`; deploy is an owner action (`GOVERN.md`); `evolve` after launch.

Exit gate: ledger complete for all phases (deferred items listed), business plan and decks reviewed by the owner, monitoring live, rollback rehearsed, zero open findings.
Report: skills used / waived / deferred, launch assets, numbers that are `UNKNOWN`, go / no-go for the owner.
