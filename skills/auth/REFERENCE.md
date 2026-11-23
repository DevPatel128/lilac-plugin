# Auth reference

## Choices and numbers
- **Library:** Better Auth 1.7 on D1 (its D1 dialect is built in; no ORM). Bundle cost measured on 2026-10-12: about 330 KiB gzipped for a Worker with email+password and Google, about 11% of the 3 MiB free Worker limit. Telemetry is switched off.
- **Passwords:** PBKDF2-SHA256 with 100,000 iterations through WebCrypto. That is the Workers maximum; OWASP asks for 600,000 for PBKDF2-SHA256, so the gap is covered by a 10-character minimum, rate limits and the option of a breached-password check (Better Auth `haveIBeenPwned` plugin, one outbound call per sign-up). Better Auth's default scrypt runs in JavaScript and exceeds the free plan's 10 ms CPU limit, so it is not used. Stored hashes carry their iteration count; verification refuses counts above the maximum (no CPU bomb from a tampered row).
- **Sessions:** 7 days, refreshed daily, checked against the database on every request (no cookie cache), so sign-out and reset revoke at once. Cookies are HttpOnly, Secure and SameSite=Lax in production.
- **Rate limits (database-backed):** sign-in and sign-up 5 a minute per IP, reset requests 3 per 5 minutes, two-factor codes 5 a minute. IP comes from `cf-connecting-ip` only; `x-forwarded-for` is spoofable.
- **Enumeration:** a wrong password and an unknown email get the same answer; a sign-up with an existing email returns a normal-looking 200 and creates nothing; a reset request for an unknown email returns the same 200 and sends nothing.
- **CSRF:** Better Auth checks the Origin header against `AUTH_URL` and `TRUSTED_ORIGINS`.
- **Mobile:** the `bearer` plugin returns `set-auth-token` on sign-in; the app stores it in the platform's secure storage (`mobile` skill) and sends `Authorization: Bearer`. Add `capacitor://localhost` (iOS) and `https://localhost` (Android) to `TRUSTED_ORIGINS`.
- **Two-factor:** TOTP with backup codes (`twoFactor` plugin), failed codes rate-limited. `requireMfa` blocks admin actions without it.
- **Passkeys:** `@better-auth/passkey` (WebAuthn). The relying-party id is the app's domain; passkeys do not move between domains.
- **Crypto wallets:** Better Auth ships Sign-In With Ethereum (`siwe` plugin). Not enabled; see the crypto decision slot in `ROADMAP.md` before using it.

## Sheet: Frontend · Backend · Architecture · Infra · AI/ML · Security · Tests
- **Frontend:** forms with labelled fields, visible password rules, one error message for wrong credentials, "check your email" screens, resend with a cooldown, passkey button only when the browser supports it, no account hints in errors.
- **Backend:** `auth.handler` on `/api/auth/*`; everything else uses `sessionActor`. Verified email is required before any session.
- **Architecture:** Better Auth tables (`user`, `session`, `account`, `verification`, `twoFactor`, `passkey`, `rateLimit`) are touched only by Better Auth. App data keys off `user.id` through `forUser`/`forOrg`.
- **Infra:** secrets via `wrangler secret put`; Resend needs a verified sending domain; Google needs the OAuth redirect `https://<app>/api/auth/callback/google`.
- **AI/ML:** none. Never send passwords, tokens or session data to a model.
- **Security:** OWASP ASVS chapters V2 (authentication) and V3 (sessions) are the checklist; this file records each choice and its gap.
- **Tests:** `test/auth.test.ts` on the fake D1; real Google and passkey flows are checked by hand in a browser before launch.
