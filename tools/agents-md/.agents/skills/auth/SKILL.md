---
name: auth
description: Add or change sign-up, sign-in, sessions, password reset, email verification, Google sign-in, passkeys, two-factor, mobile tokens or anything about who the user is. Use for any login, account or session work.
---
# Auth

Rule 0: blunt. Auth bugs are the ones that end companies. Never write your own auth protocol or crypto; configure the established library and prove each attack fails.
Read `AGENTS.md`, then `REFERENCE.md` in this folder. Run `lilac-check` first. Auth changes always stop before merge for a human.

## 1. Plan
1. Say which methods the product needs (email+password is the default; Google, passkeys, two-factor and bearer tokens are already wired). Remove what nobody needs.
2. Say what happens on sign-up (profile row, personal org, audit), on deletion, and which roles need two-factor.

## 2. Build with the kit
- `createAuth(env)` in `src/auth.ts` (Better Auth on D1, telemetry off, PBKDF2 passwords, verification required, rate limits, `cf-connecting-ip` only). Mount `auth.handler` on `/api/auth/*`; give `route()` its actor with `sessionActor(auth)`.
- User ids come only from the session (hard rule 3). Admin and owner actions call `requireMfa(actor)` after `can()`.
- Changed plugins or Better Auth version: `node scripts/auth-schema.ts`, review `migrations/0003_auth.sql`, commit both.
- Secrets in Worker secrets: `AUTH_SECRET` (32+ random bytes), `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`. The mobile app's origin goes in `TRUSTED_ORIGINS`.

## 3. Prove it
`node --test test/auth.test.ts` covers: no session before verification, a fresh token per sign-in, instant revocation, the same answer for a wrong password and an unknown email, the same answer for a reused sign-up email, reset links that work once and revoke sessions, CSRF from another origin, the 6th sign-in attempt refused, bearer tokens, two-factor for admin. Add a test for anything you add. Then sign up, verify, sign in, reset and sign out once in a real browser.

## 4. Report
`Methods:` · `Tests:` names and results · `Secrets added:` names only · `Not tested:` Google and passkeys need real accounts and a real browser; email delivery needs a verified domain.
