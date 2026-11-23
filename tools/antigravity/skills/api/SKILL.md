---
name: api
description: "Design and build an HTTP API or endpoint: contract first, one error format, pagination, idempotency, auth and tests. Use for any new or changed route, OpenAPI file, public or internal API, or \"add an endpoint\"."
---
# API

Rule 0: blunt. An endpoint with no failing test for its worst input is not done. Say what you did not test.
Read `AGENTS.md`, then `REFERENCE.md` in this folder (the rules, numbers and the per-domain sheet). Run `lilac-check` first.

## 1. Contract first
1. Write the operation in `openapi.yaml` before code: purpose, auth, request and response schema, every error, pagination, idempotency. A breaking change needs the compatibility decision from `BUILD.md` (affected clients, deprecation, rollback).
2. Fill the SYSTEM.md endpoints table and the roles matrix for the new route. WHO can do WHAT to WHICH resource in WHICH state, in words.

## 2. Build with the kit
- Wrap every handler in `route({ auth, limit, body })` from `src/http.ts`. Never read `req.json()` yourself, never build an error `Response` by hand: throw `AppError(code)`.
- Lists: `parseList(url)` + `forOrg/forUser(...).list` (cursor, capped, allowlisted sort and filter). Writes that can be retried: `idempotent(db, actor.id, req, run)`.
- `src/api/items.ts` + `test/flow.test.ts` are the worked example (org-scoped list, retry-safe create, versioned update, bulk): copy them, do not reinvent. Zod (or any `safeParse`) schema per body. Strings have max lengths. Return only the fields the client needs.
- All SQL stays in `src/db.ts`. New table: migration + `USER_TABLES` or `ORG_TABLES` + isolation coverage.

## 3. Prove it
1. `npm run check` (db scope, types, `api-check`, evals, tests) and `npx @stoplight/spectral-cli lint openapi.yaml --ruleset .spectral.yaml`.
2. Tests for: 401 with no session, another tenant's id gives 404, invalid body gives 422, oversized body gives 413, a repeated idempotent POST runs once, the limit is capped.
3. Abuse review from `BUILD.md` (signup, search/enumeration, exports, AI jobs) and the OWASP API Top 10 list: say which risk each test covers.

## 4. Report
`Contract:` the openapi diff · `Authz:` the matrix row · `Tests:` names and results · `Compatibility:` additive or breaking · `Not tested:` what could still break (load, real provider, real D1).
