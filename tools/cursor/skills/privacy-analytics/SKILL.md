---
name: privacy-analytics
description: Audit third-party embeds, add a fair consent banner only if needed, and wire analytics to the brief's success number.
disable-model-invocation: true
---
# /lilac:privacy-analytics

Three steps. Never invent company details: unknown stays UNKNOWN.

1. **Consent audit.** Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/consent.mjs" audit "${CLAUDE_PROJECT_DIR}"`. Every third-party script, embed or font must have a row in `privacy/cookies.md`. A banner is needed only when something sets non-essential cookies or trackers; cookieless analytics and no embeds need none.
2. **If rows are missing:** ask the law with AskUserQuestion (GDPR / DPDP / CCPA / LGPD), then run `consent.mjs init "${CLAUDE_PROJECT_DIR}" --law <law>`. It writes the cookie table, an equal Accept/Reject banner snippet and a policy outline. Ask the owner for each UNKNOWN (purpose, duration, vendor, lawful basis, company name, contact). Do not guess. Paste the banner into every page only when the audit says it is needed.
3. **Analytics.** Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/analytics.mjs" plan "${CLAUDE_PROJECT_DIR}"` (add `--provider posthog` if asked). It reads the brief's Success number and wires the main action to one event, cookieless. If it says "success must be a number", go back to the brief and ask for one.

Payments: Stripe is the default. For India, use Razorpay (`features/server/payments/razorpay.mjs`): prices are set on the server, webhooks are signature-checked, test keys only.

Then ask with AskUserQuestion: Approve / Change something / Stop. Show the audit result and the files written. Not legal advice: say so and suggest a lawyer reviews the policy.
