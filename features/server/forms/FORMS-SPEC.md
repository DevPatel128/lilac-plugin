# Forms handler spec

`forms.mjs` exports `createForm(options)`: a Web-standard handler `(Request) -> Response`. It wraps `createContactForm` (same fields: `name`, `email`, `message`, `consent`, `ts`, honeypot `website`).

| Target | Settings (host environment, never the repo) | Sends |
|---|---|---|
| `email` | `RESEND_API_KEY`, `CONTACT_FROM`, `CONTACT_TO` | one email through your provider |
| `sheets` | `SHEETS_WEBHOOK_URL` (your Apps Script web-app URL, `https://`) | JSON `{name,email,message,receivedAt}` |
| `crm` | `CRM_WEBHOOK_URL` (`https://`), optional `CRM_WEBHOOK_TOKEN` | JSON `{name,email,message,source}` |

Spam protection, in order: origin lock, per-IP rate limit (default 5 per 10 minutes, in memory, per instance), body size cap (8192 bytes), honeypot (looks like success, sends nothing), minimum fill time (3 s), length caps (name 100, email 254, message 5000), optional Turnstile or hCaptcha token check (`captcha: 'turnstile'|'hcaptcha'`; `TURNSTILE_SECRET`/`HCAPTCHA_SECRET`). All output is HTML-escaped.

Missing setting: HTTP 503 `provider_not_configured` naming the setting. A captcha without its secret is `UNKNOWN`: 503 `captcha_unknown` when `captchaRequired`, otherwise skipped.

Not verified: real delivery to any provider (tests use a fake fetch). Not done: signed `ts`, shared rate-limit store (pass a KV store).
