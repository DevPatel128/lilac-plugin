# Privacy, analytics and payments

What Lilac does for consent, measurement and money. It checks and drafts; it is not legal advice, and a lawyer should read the policy before launch.

## Consent audit

`node scripts/consent.mjs audit <dir>` scans the pages for third-party scripts, iframes and stylesheets (analytics, YouTube, maps, chat, font CDNs, social) and requires each one in `privacy/cookies.md` (name, purpose, cookies set, duration, vendor, lawful basis). It fails on an undeclared service, on a row with an empty or UNKNOWN cell, and on a needed banner that is missing.

A banner is needed only when a found service sets non-essential cookies or trackers. A site with cookieless analytics (Plausible, Fathom, GoatCounter) and no embeds needs none. Fonts and cookieless maps are declared but do not force a banner.

`node scripts/consent.mjs init <dir> --law gdpr|dpdp|ccpa|lgpd` writes `privacy/cookies.md` (pre-filled with what it found, every unknown as UNKNOWN), `privacy/consent.html` and `privacy/privacy-policy-outline.md`. The banner has equal Accept and Reject buttons, nothing pre-ticked, rejecting takes one click, and the choice is stored only in the browser. It never overwrites existing files and never invents company details.

Not covered: scripts injected at runtime or by a tag manager, and whether a script really waits for consent in a live browser.

## Analytics tied to the brief

`node scripts/analytics.mjs plan <dir> [--provider plausible|posthog]` reads `BRIEF.md`, takes the Success line (for example "500 mailing-list signups in 90 days"), extracts metric, target and window, and writes `analytics/plan.md` and `analytics/snippet.html`. The snippet fires one named event on the brief's main action (mark the button or form with `data-lilac-action`). Cookieless by default; keys come from `PLAUSIBLE_DOMAIN` or `POSTHOG_KEY`, otherwise they stay UNKNOWN. If Success has no number it refuses: "success must be a number".

It does not install the snippet, read results back, or prove the target was reached.

## Payments

Stripe is the default (`features/server/checkout.mjs`). For India, `features/server/payments/razorpay.mjs` adds a Razorpay adapter with the same rules:

- The browser sends only item codes and quantities. The server recomputes the amount in paise from its own price list; a client price field is refused.
- INR only. Live keys (`rzp_live_`) are refused; test mode only.
- An `Idempotency-Key` header replays the first answer instead of creating a second order.
- The webhook checks `X-Razorpay-Signature` (HMAC-SHA256 of the raw body, `node:crypto`, constant time), ignores a repeated event id, and marks an order paid once, only when amount and currency match.

Status: tested against local fakes only. Razorpay's request and header details were written from memory of its public docs and are UNVERIFIED against the live service. Run the tests: `bash operations/scripts/test-plugin-privacy-analytics.sh`.
