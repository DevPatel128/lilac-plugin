# Server features: vendor facts (read 2026-11-22)

| Vendor | Verified from the page | Source |
|---|---|---|
| Resend | POST https://api.resend.com/emails; headers `Authorization: Bearer <key>`, `Content-Type: application/json`; required `from`, `to`, `subject`; optional `html`, `text`, `reply_to`; success `{ "id": ... }` | https://resend.com/docs/api-reference/emails/send-email |
| Stripe webhooks | `Stripe-Signature: t=<unix>,v1=<hex>`; signed string `<t>.<raw body>`; HMAC-SHA256 with the `whsec_` secret; use only `v1`; constant-time compare; default tolerance 5 minutes; track event ids to drop duplicates | https://docs.stripe.com/webhooks |
| Stripe Checkout | POST https://api.stripe.com/v1/checkout/sessions, form-encoded, secret key as basic-auth user; `mode`, `success_url`, `cancel_url`, `client_reference_id`; response has `id`, `url` | https://docs.stripe.com/api/checkout/sessions/create |

UNVERIFIED (not on the pages read, or never run against the real service):
- Stripe inline `line_items[i][price_data][...]` parameter names (the page showed `line_items[i][price]` only).
- Supabase raw REST insert (`POST <url>/rest/v1/<table>`, `apikey`, `Authorization`, `Prefer: return=minimal`): the docs page read shows only the JS client.
- Cloudflare KV minimum `expirationTtl` of 60 seconds; Vercel ignoring `api/_lilac/` as routes and accepting named `POST`/`OPTIONS` exports.
- Everything about real delivery, real sessions and real webhooks: tests use local fakes only.
- Free-tier limits and prices: UNKNOWN here; see the hosting skill's REFERENCE.md and the vendors' pricing pages.
