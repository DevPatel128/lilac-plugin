# Server features: forms, test payments, sign-in

These are small pieces of server code your site can use so things really work: a contact form that reaches you, a test checkout, and sign-in by emailed link. They run on Cloudflare Pages Functions and on Vercel, with nothing to install.

**Honest status.** The code is tested against local stand-ins (fakes) only. No real email, payment or database was contacted. Real delivery is UNVERIFIED until you supply your own test credentials and run the smoke test below.

## What each one does

- **Contact form.** Checks the message hard (names, email, length, no line breaks that could forge email headers), refuses oversized or wrong-type requests, blocks bots with a hidden field and a minimum fill time, limits each visitor to 5 messages per 10 minutes, only accepts your own site as the sender, and needs a ticked consent box. Sends by email (Resend-style), into a Supabase table, or to a local file for development.
- **Payments (test mode only).** The server works out the price from your own price list. The browser can only say which item and how many; if it sends a price, the request is refused. A key that does not start with `sk_test_` is refused, and live keys are refused with a loud message. The webhook checks the signature, rejects old or repeated events, and marks an order paid once.
- **Sign-in.** A signed link by email, valid 15 minutes, usable once. No passwords are stored. Sessions use a safe cookie (HttpOnly, Secure, SameSite=Lax), change on refresh, and can be ended or deleted entirely. The login answer is the same for every address, so nobody can discover who has an account.

## Accounts and costs

You create each account yourself; Lilac never does and never sees your keys. Email (for example Resend) and database (for example Supabase) have free plans at the time of writing but limits change: check their pricing pages. Stripe test mode moves no real money. Going live with payments is outside this feature.

## Add one

```
node scripts/features.mjs list
node scripts/features.mjs add "<your site folder>" contact-form --host cloudflare
node scripts/features.mjs check "<your site folder>"
```

`add` never overwrites your files. It writes `.dev.vars.example` with variable names only. Copy it to `.dev.vars` and fill in your own test values; that file must never be committed (`add` ignores it in git). Adding the security header to `_headers` happens only if you say yes and re-run with `--yes`.

## Smoke test (you run this, with your own test credentials)

1. Put your own test values in `.dev.vars` (contact form: `CONTACT_ALLOWED_ORIGIN`, `CONTACT_TO`, `CONTACT_FROM`, `RESEND_API_KEY`).
2. Start the site locally, for example `npx wrangler pages dev <folder>`.
3. Send the form once. Confirm the email arrives in your own inbox. For payments, start a checkout with a Stripe test card from Stripe's docs and confirm the order is marked paid after the test webhook arrives.
4. If it works, tell us; only then is that one path verified for your account.

## Where state lives

Rate limits, orders and sessions live in a store. The memory store loses data when the server restarts and is per server instance. For real use bind a Cloudflare KV namespace (names in `.dev.vars.example`). KV is not exact under heavy parallel use; use a database table when counts or money must be exact.

## Known limits

- The form's `ts` field is not signed; it stops simple bots only.
- Vercel layout and the exact Stripe line-item and Supabase request shapes are UNVERIFIED (see the skill's REFERENCE.md).
- Passcode (code by email) sign-in is not included; the emailed link is.
