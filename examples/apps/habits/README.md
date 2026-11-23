<!-- Pocket Habits demo app: README. FICTIONAL SAMPLE product. Built by following Lilac's web-app track. -->
# Pocket Habits: demo habit tracker

A showcase of what Lilac's Web App track can produce. **Pocket Habits is a fictional sample, not a real product.** The support address `support@example.test` does not exist and no one will reply. It makes no health, wellbeing or productivity claims.

## What it does

All data stays in the browser (localStorage). No backend, no accounts, no tracking, no external requests.

- Habits: add, edit, delete with Undo; name, weekly target (1 to 7), colour from an 8-colour palette; tick today and the past 7 days.
- Streaks and weekly progress (week starts Monday or Sunday), timezone and DST safe.
- Insights: 4-week completion bars, 8-week heatmap, per-habit table; each chart has a text alternative and a table.
- Search, filter, sort; keyboard shortcuts (n, j, k, space, /, u, ?).
- Settings: theme, week start, motion, export, import (validated, 256 KB limit), reset all, show onboarding again.
- Help (12-question FAQ), Support (mailto link, copy email, copy diagnostics), About and privacy.
- Installable PWA with an offline service worker, versioned cache and an "update available" bar.
- Strict CSP in `site/_headers` (no inline scripts or styles), light and dark, 360 to 1440 px.

## Run it

```sh
node product-growth/media/demo-apps/serve.mjs habits 4180
# open http://127.0.0.1:4180/
```

Tests (no installs):

```sh
cd product-growth/media/demo-apps/habits && node --test
```

## Test user

There are no accounts. For end-to-end testing, open Settings, press Import JSON and choose `tests/fixtures/test-user.json` (6 habits, 30 days of history, one broken streak). Regenerate it for today's date with `node tests/fixtures/make-test-user.mjs`. The control checklist is `tests/controls.md`.

## Layout

`site/` app files (`store.js`, `dates.js`, `stats.js`, `io.js` have no DOM access and are tested by Node), `tests/`, `BRIEF.md`, `BUILD-LOG.md`, `.lilac/personas.json`, `wrangler.jsonc` (Cloudflare static assets, not deployed).

## Limits

Anyone using the same browser profile can see the data. Clearing browser data without exporting loses it. Offline mode and the update bar were not verified in a real browser (the in-app browser refuses service workers). Icons are SVG only. QA, simulated visitors and hosting are pending: the owner runs those tools.
