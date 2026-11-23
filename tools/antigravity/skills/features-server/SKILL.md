---
name: features-server
description: Add working contact form, test-mode payments or sign-in to a site; ask the human first, test mode only, real delivery stays UNVERIFIED.
disable-model-invocation: false
---
# Server features (forms, test payments, sign-in)

Handlers are small and dependency-free. Tell the human in plain words what each one does and what it needs. Read REFERENCE.md for vendor facts and what is UNVERIFIED.

1. **Ask first.** Which features: contact form, payments (test mode only), sign-in by email link? Which host (Cloudflare default or Vercel; follow skill `hosting` if not chosen yet)? Which provider for delivery (email, or Supabase database, or local outbox for development)? Do not pick for them.
2. **Say honestly what it costs.** Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/features.mjs" list` and repeat the cost lines. Each vendor needs the owner's own account. Free-tier limits are UNKNOWN unless REFERENCE.md of skill `hosting` shows them.
3. **Never create accounts, never enter or paste credentials, never print key values.** The owner creates the accounts and puts their own TEST keys into `.dev.vars` (or `.env`). You only add variable NAMES via `.dev.vars.example`.
4. Add: `node "${CLAUDE_PLUGIN_ROOT}/scripts/features.mjs" add "<project>" <feature> --host cloudflare|vercel`. It never overwrites. Editing `_headers` needs the owner's yes in this conversation, then re-run with `--yes`.
5. The form HTML needs a visible label per field, a hidden honeypot field `website`, a hidden `ts` field (epoch ms at page load), a consent checkbox named `consent`, and a privacy note (UX-0013, UX-0041, UX-0088). Confirm success or failure on the page; do not disable the button forever (UX-0030).
6. Check: `node "${CLAUDE_PLUGIN_ROOT}/scripts/features.mjs" check "<project>"`; fix every FAIL. In the Lilac repo, `bash operations/scripts/test-plugin-features-server.sh` runs the fake-backed tests.
7. **Test mode first.** Payments refuse any key that is not `sk_test_...`. Going live is the owner's decision outside this skill. If the owner asks for live keys, stop and say so.
7b. **Durable store.** Payments need `ORDERS_KV` and sign-in needs `AUTH_KV` bound in production, or the routes answer 503 `store_not_configured` (a payment must never be lost in per-instance memory). Memory stores run only when `LILAC_ENV` is `test` or `development` (set it in `.dev.vars` for local work, never in production). Without `RATE_KV` the rate limit is per instance and production logs a warning. Set `RATE_SALT` too.
8. **Report: real delivery is UNVERIFIED** until the owner supplies their own test credentials and runs the smoke test in `docs/FEATURES-SERVER.md`. The tests used local fakes only. Say this every time.

Outward actions (deploy, creating a vendor account, sending a real email, registering a webhook URL) need the human's explicit yes each time. Guard rules apply (skill `guard`).
