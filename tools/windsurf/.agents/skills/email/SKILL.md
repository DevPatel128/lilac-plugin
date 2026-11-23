---
name: email
description: "Build or change any email the product sends to customers (verify, reset, welcome, invite, receipt, security alert) so it is beautiful, accessible and matches the design palette. Use for a new template, a copy change, deliverability setup, or a customer-reported email problem."
---
# Customer email

Rule 0: every email is a template in `kit/email/` built from the design tokens, with a plain-text twin, and passes `node operations/scripts/email-check.mjs`.
Run `lilac-check` first. Tokens: `DESIGN.md` and `app/src/styles.css` (email colours are the same palette, compiled to hex).
1. **Gather:** what the reader must do in one sentence (one primary action per email), who it is from, what happens if they ignore it. Auth mail goes straight out (a user is waiting); other mail goes through the outbox (`db.ts`, `jobs.ts`).
2. **Do:** add the template in `email/templates.ts` using `layout.ts` (600 px, system font stack, bulletproof button, hidden preheader, light and dark via `prefers-color-scheme`). Escape every variable with `esc()`; never put a secret, token or personal data in a subject or preview line. Links are https only.
3. **Look:** `node operations/scripts/email-preview.mjs`, open `email/out/` in a browser at 375 and 600 px, light and dark. Use `apple-design` type and spacing rules (optical size, tracking, restraint).
4. **Prove:** `npm test` (escaping, injection in name and url, text twin present); `node operations/scripts/email-check.mjs` (contrast 4.5:1 from tokens, alt text, widths, no remote fonts).
5. **Deliverability (Phase 2):** `email-deliverability-dns-auth` (SPF, DKIM, DMARC), `resend-email-infrastructure`, `ses-postmark-failover-engine`; send to a real Gmail and Outlook inbox and read the headers. Unsubscribe and address in the footer for non-transactional mail (`kit/LEGAL.md`).
6. **Hand off:** `ship`. Anything that sends to real customers at volume is an owner action (`GOVERN.md`).
Related skills: `react-email-jsx-templates`, `interactive-amp-email-templates`, `email-broadcast-segmentation`, `email-telemetry-tracking-pixel`, `inbound-email-parsing-webhooks`.
Report: templates changed, checks run, inbox tests done, UNKNOWN (real-client rendering is not tested locally).
