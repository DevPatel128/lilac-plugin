---
name: phase-1-build
description: "Phase 1 of 3 (internal company testing, baseline security): choose the architecture, make the design palette, and build one main feature at a time, each secure by default on the day it is built. Use when a product starts, when a new main feature begins, or when TASK.md says phase: 1."
---
# Phase 1: Build

Rule 0: nothing from Phase 2 or 3 starts until the exit gate is green. One main feature in flight at a time. Internal testers only; no real customer data (seed and synthetic data).
Run `lilac-check` first; set `phase: 1` in `TASK.md`. Skills and their use: [MAP.md](MAP.md) (generated from ../PHASES.md (not in this pack)). Free tech only: Google sign-in, Resend free, Cloudflare free; Apple sign-in and other paid items wait in Paid Tech (not in this pack).
1. **Architecture once:** `research`, `tech-decision`, `enterprise-web-architect`, `atam-tradeoff-analysis`, `ddd-bounded-contexts`; frontend and backend designed together; each choice an ADR (`faang-adr-documentation`).
2. **Repo and CI locked first:** `github-repo-management` (protected main, CODEOWNERS, signed commits), `github-actions-security` (SHA-pinned, least privilege), `guard` limits, `mistakes-root-cause-logger` from the first mistake.
3. **Palette and design system before feature UI:** fill `DESIGN.md`, tokens in `app/src/styles.css`, then email tokens (`email` skill). `design`, `apple-design`, `claude-artifact-design`, the Phase 1 motion skills. `design-check` green; seen at 375 / 768 / 1280 px.
4. **Pick the next main feature** (smallest slice a user can finish), write `TASK.md`; `rfc-design-proposals` if big or risky.
5. **Build it test-first** (`superpowers-mcp`, `e2e-testing-pyramid`) with `api`, `auth`, `adapter`, `admin`, `dashboard`, `ai` or `mobile`, on the free data layer (`cloudflare-d1-hyperdrive`, `drizzle-orm-edge-migrations`, `cloudflare-kv-durable-objects`, `r2-s3-edge-cdn-storage`, `workers-best-practices`, `wrangler`).
6. **Baseline security, per feature:** a `docs/THREAT-MODEL.md` row; validation at every boundary (`data-quality-zod-typebox`); authorization tests (other user, other org); rate limit and Turnstile on auth and forms (`cloudflare-rate-limiting-turnstile`); secret scan and dependency audit green; `review` then `verify`; `security-audit` quick profile, fix findings with `security-fix` on the spot.
7. **Customer touchpoints:** each email is a template in `src/email/` (preview checked); every state has loading, empty and error; flags and kill switch (`edge-feature-flags-ab`).
8. **Ship** through `ship`; record evidence in `TASK.md`; one ledger row in `PHASES.md` per skill used; `learn` on every mistake. Repeat from 4.

Exit gate: scope built; each feature has threat row, tests and ledger rows; palette and design-check green; internal test period done and its findings fixed; `security-audit` quick has no open High; `node operations/scripts/phase-check.mjs 1` passes.
Report: features done, skills used, open findings, UNKNOWN items, the Phase 2 start decision for the owner.
