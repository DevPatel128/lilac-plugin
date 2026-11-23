# API reference

Numbers and rules the `api` skill points at. If a rule here and `BUILD.md` disagree, `BUILD.md` wins; fix this file.

## Contract
- `openapi.yaml` (OpenAPI 3.1) is the source of truth, edited before the code. Lint: Spectral with `.spectral.yaml` (CI step) and `operations/scripts/api-check.mjs` (text scan of the code).
- Hono + Chanfana is Cloudflare's OpenAPI layer for Workers (D1 + Zod template); use it if you want the spec generated from the code. The kit's `route()` is framework-neutral and works either way. Do not run both.

## Errors
- One shape everywhere: `{ type, title, status, detail, error: { code, message, requestId, details? } }` with `content-type: application/problem+json` (RFC 9457 fields on top, our `error` object for existing clients). `x-request-id` on every response.
- Codes and statuses are fixed in `src/errors.ts`: 400 bad_request · 401 unauthenticated · 403 forbidden · 404 not_found · 409 conflict · 413 too_large · 422 validation_error · 429 rate_limited · 500 internal · 503 unavailable. Messages are fixed sentences; detail goes to the server log only.
- A caller who may not know a resource exists gets 404, not 403.

## Lists, filters, sorting
- Cursor paging by default (stable while rows are added). Offset paging only for a small admin list that never grows past a few thousand rows. `limit` default 50, hard cap 100; `after` is an opaque cursor.
- Sort and filter columns are allowlisted in `db.ts` (`ORG_SORT`, `ORG_FILTER`). A client never names a column the server did not list.
- D1 limits that shape queries: 100 bound parameters per statement, a single-threaded database per instance, free plan 5 million rows read per day and 500 MB. `rows_read` counts rows scanned, so an unindexed filter costs the whole table. Index what you filter and sort on, then check the plan.
- Full-text search: D1 supports FTS5 with restrictions; there is no official page, so UNVERIFIED. Test your exact query on real D1 before promising search.

## Idempotency
`Idempotency-Key` is an IETF draft, not a standard, but it is what Stripe and others do. Required on POSTs with side effects (money, orders, email, jobs). Same key and body returns the stored answer (24 h); same key with another body is 422; a request still running is 409; a 5xx releases the key. Keys are scoped to the actor.

## Limits and abuse
- Rate limit by actor and by IP for anonymous routes; fail open but log loudly (an in-memory counter is useless on Workers, use the platform binding or D1; the free-plan binding is UNVERIFIED, see `STACK.md`).
- Body cap 100 KB unless the route needs more. Upload size, query cost and concurrency are limits too: write them next to the route.
- OWASP API Top 10 (2023), each answered in the PR: object-level authz, broken auth, property-level authz, resource consumption, function-level authz, sensitive business flows, SSRF, misconfiguration, improper inventory, unsafe consumption of other APIs.

## Sheet: Frontend · Backend · Architecture · Infra · AI/ML · Security · Tests
- **Frontend:** the API has no UI of its own; a docs page rendered from `openapi.yaml` is optional and must not expose internal routes.
- **Backend:** handler order is auth, rate limit, size, JSON, schema, ownership, idempotency, write, audit. Business rules live in plain functions the handler calls.
- **Architecture:** routes → services → `db.ts`. No SQL outside `db.ts`; no vendor SDK types leaving an adapter. Version by additive change; a breaking change gets a new path version and a removal date.
- **Infra:** Workers + D1; `wrangler` config in git; secrets in Worker secrets. Cron and Queues only when a route cannot finish in the request.
- **AI/ML:** an endpoint that calls a model goes through `askAI` and has its own budget and eval set (`ai` skill).
- **Security:** authz at function, object and tenant level on every route; fixed error messages; no stack traces; request IDs for tracing; secrets never in logs.
- **Tests:** `test/service.test.ts` pattern on the `node:sqlite` fake D1; every route has an unauthenticated, a foreign-tenant, an invalid-body and a repeat-request test.
