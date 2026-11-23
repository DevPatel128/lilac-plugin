<!-- Pocket Habits demo app: build log of the Lilac loop. FICTIONAL SAMPLE product. -->
# Build log

Followed: `product-types/Web App/README.md`, `Phase 1.md`, `product-types/skills/web-app-phase-1/SKILL.md`, `operations/plugin/site/AGENTS.md`, `operations/plugin/site/docs/PROMPTING.md`, and the brief, preview, hosting, qa and persona-test skills. One agent played every role in turn. `product-growth/media/demo-sites/cafe/site` was the house baseline (a11y, motion, no external requests). The brief-checker script was not run (see Tester). Phase 1's "server-side authorization" items do not apply: the app has no server and no accounts.

## 1. Planner

[BRIEF.md](BRIEF.md) first. Decisions:
- Main flow: add a habit, tick today, see streak and week count, export.
- Dates are calendar keys ("YYYY-MM-DD") and all arithmetic is UTC on the key, so DST and the device timezone cannot shift a day. The clock is a parameter (`todayKey(now, offsetMinutes)`).
- Streak rule: days in a row; today not yet done keeps yesterday's streak. Also "weeks on target".
- Colours are stored as palette ids, never CSS values.
- Imports are rebuilt field by field (`validateState`), never copied.
- Written tests first (36 tests, all failing with `ERR_MODULE_NOT_FOUND`), then modules.
- Coordinator added mid-build: Settings, Help FAQ, Support, About screens, a controls test list, a seeded test profile and an end-to-end user test. All done below.
- ASSUMED: base URL `/` (Cloudflare root); support address `support@example.test` (sample, never answered).

## 2. Builder

`site/`: `index.html`, `app.css`, `boot.js` (theme before paint), `app.js` (controller), `ui.js`, `charts.js`, `content.js` (FAQ, tour), pure modules `dates.js`, `stats.js`, `store.js`, `io.js` (no DOM), `sw.js`, `manifest.webmanifest`, `icon.svg`, `icon-maskable.svg`, `_headers`. No framework, no build step, no inline script or style, system fonts, no external requests.
`tests/`: four unit files, `sw.test.js` (service worker in a sandbox), `fixture.test.js`, `fixtures/test-user.json` and its generator, `controls.md`. Shared server: `product-growth/media/demo-apps/serve.mjs` (localhost only, `.webmanifest` MIME, applies `_headers`).

Motion (subtle): list item enter, tick pop, toast slide, dialog fade, bar grow (transform and opacity only). Off under `prefers-reduced-motion` and under Settings > Motion > Always off.

## 3. Reviewer

Checklist:

| Check | Finding | Fix |
|---|---|---|
| Invented claims | grep for health, productivity, best, review, rating, award: none; copy says "fictional sample" in footer, README, About, Support | none needed |
| Contrast (WCAG luminance from tokens) | Light: ink/bg 16.12, muted/bg 7.11, accent/surface 6.83, button 6.83, danger 6.54, heat cell text 4.67 to 12.92, palette vs surface 5.16 to 6.83. Dark: ink/bg 15.92, muted/bg 8.45, accent 8.01, button 8.80, danger 8.27, heat text 5.16 to 10.83, palette 7.89 to 9.75. All at or above 4.5 | none needed |
| Tap targets | Footer "Keyboard shortcuts" was 21 px high | `.link` min-height 44 px |
| Dialog focus | Closing a dialog moved focus to the heading and stole the new habit's focus (late `close` event) | Close and restore focus synchronously (`dismiss`); event kept for Esc |
| Skip link | `#main` hash was read by the router and reset the screen to Today | Router only handles `#/route` hashes |
| Shortcut handler | `event.target` can be `document`; `closest` threw | Fall back to `body`; `?` also accepted as shift+`/` |
| Tour close | Tour completion relied on the `close` event, which a background tab delays | Mark done directly on Done and Skip |
| Chart clipping | "100%" label and last bar touched the edge | Wider viewBox, left margin |
| Service worker | First draft refreshed cached files in the background, which can mix versions | Cache first only; files change only when a new `VERSION` installs |
| Static QA: 0 `<h1>` visible | Every view starts hidden, so no-JS showed no heading | One always-visible `<h1>` "Pocket Habits" in the header; view titles are `<h2>`, card headings `<h3>`, FAQ questions `<h4>` |
| Static QA: no-JS page | Said only "needs JavaScript" | `<noscript>` now says what to do: turn JavaScript on and reload; saved habits stay in the browser; export is impossible without JavaScript |
| Static QA: canonical, og, robots, sitemap, 404 | Missing | Added `canonical`, `og:*`, `robots.txt`, `sitemap.xml` (example.com ASSUMED), `404.html` (external CSS only, served with the `_headers` CSP; `not_found_handling: "404-page"` in wrangler.jsonc) |
| Contrast pairs the QA tool listed as UNVERIFIED (computed by hand, light / dark) | `.link` accent on page bg 6.48 / 8.80, on surface 6.83 / 8.01. `.day` ink on surface 16.98 / 14.49, on hover and today fill 14.63 / 12.73. `.toast .btn` page-bg text on the ink toast 16.12 / 15.92 | all at or above 4.5; no change needed |
| Not checked | Screen reader pass, real touch device, Safari, Firefox, installability prompt (icons are SVG only: some browsers want PNG) | UNVERIFIED |

Threat model:

| Threat | Vector | Control | Check |
|---|---|---|---|
| XSS via names | Habit name `<img onerror>` in the form, an import or localStorage | Every user string goes in with `textContent`/attributes via `el()`; no `innerHTML`; CSP `script-src 'self'` blocks inline code even if one slipped in | io test "HTML in names kept as inert text"; browser: name `Drink water <b>x</b>` rendered as text (`innerHTML` was `&lt;b&gt;`) |
| Import abuse | Huge file, deep JSON, prototype pollution, duplicate ids, bad dates, 10 000 habits | 256 KB cap checked on file size and bytes; forbidden keys `__proto__`, `constructor`, `prototype` rejected; whitelist rebuild; limits 100 habits, 60-char names, 4000 days, 7-level depth walk; ids regex; confirm before replace | io tests (malformed, oversized, pollution, duplicate); browser: 5 bad files rejected, storage unchanged |
| localStorage tampering | Another script or the owner edits `pocket-habits` | Same strict validation on load; invalid content moves to `pocket-habits:backup` and the app starts empty with a visible message; colours are ids, never CSS | store tests "corrupted JSON recovery", "invalid content treated like corruption" |
| Service-worker cache poisoning | Cross-origin or unknown requests answered from cache; stale mixed versions | Only same-origin GET for precached paths are intercepted; cache written only at install; old caches deleted on activate; foreign caches untouched; `sw.js` served `no-cache` | sw.test.js (sandboxed) |
| Clickjacking / framing | Page embedded in another site | `frame-ancestors 'none'` and `X-Frame-Options: DENY` in `_headers` | `curl -sI` shows both (see Tester) |
| Data exfiltration | A script posting data out | `connect-src 'self'`, `default-src 'none'`, `form-action 'none'`, `base-uri 'none'`; no third-party code | Browser resource list: one origin only |
| Other people using the same browser | Anyone with the profile reads habits | Not mitigated; stated on About and in README | documented |

## 4. Tester

Unit tests (`cd product-growth/media/demo-apps/habits && node --test`, Node v24.22.0):

```
ℹ tests 42
ℹ suites 0
ℹ pass 42
ℹ fail 0
```
Red run first (before any site module existed): `node --test` printed `✖ tests/dates.test.js`, `✖ tests/io.test.js`, `✖ tests/stats.test.js`, `✖ tests/store.test.js` ("test failed"). Test files: dates 8, stats 11, store 9, io 7, sw 4, fixture 2, plus tests added for Sunday week start and settings. About 229 assert call sites (many inside loops).
Timezone independence: `TZ=Pacific/Kiritimati`, `America/New_York`, `Pacific/Pago_Pago`, `Europe/London node --test` each printed `ℹ pass 42` and `ℹ fail 0`.
Server: `node product-growth/media/demo-apps/serve.mjs habits 4180`. `curl -sI http://127.0.0.1:4180/` returned 200 with `content-security-policy: default-src 'none'; script-src 'self'; style-src 'self'; ... frame-ancestors 'none'`, `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy: no-referrer`. `/manifest.webmanifest` returned `content-type: application/manifest+json`.
Static QA (`node operations/plugin/scripts/qa.mjs product-growth/media/demo-apps/habits`) before fixes: `index.html: 1 error(s), 2 warning(s)`, site 3 warnings. After fixes: `qa: 0 error(s), 0 warning(s), 4 unverified` (the 4 are the hash routes, which need the controls test above, and three transparent or `none` backgrounds computed by hand in the Reviewer table). Tests re-run: `ℹ tests 42`, `ℹ pass 42`, `ℹ fail 0`. `curl` on `/nope` returns 404 with the CSP header; `/robots.txt` and `/sitemap.xml` return 200. Browser re-check after the heading change: one `h1`, route focus lands on each view's `h2`, FAQ opens, dialog opens and closes.
Not run: `brief.mjs check`, browser QA (`qa-browser.mjs`), `persona-test.mjs` (the owner runs the tools).

In-app browser, 375 px: `scrollWidth` 375 on all six screens (no horizontal scroll). Every visible control checked was at least 44 x 44 after the footer fix (re-check after fix: UNVERIFIED by measurement; the CSS change is `min-height: 44px`). Browser resource list shows one origin (`http://127.0.0.1:4180`). Console errors: only the in-app browser's refusal to register a service worker (see below).

## End-to-end user test

Setup: in-app browser, `http://127.0.0.1:4180/`, `localStorage.clear()` first. No accounts exist, so there is no sign-in; the "user" is the file `tests/fixtures/test-user.json` imported through Settings. Real key presses (n, Return, space, shift+/, u, j, k, /) and real clicks were used where marked K; other rows used scripted clicks in the page (S) with state read back. In S rows the tab was sometimes in the background.

| Screen | Control | Expected | Observed | Result |
|---|---|---|---|---|
| Today (first run) | Page load, empty storage | Empty state, tour banner, nav | Empty state and banner shown, Today current | pass |
| Today | Take the tour (S) | Dialog opens at step 1, Back hidden | "Step 1 of 5", focus on Next, Back hidden | pass |
| Tour | Next, Back, Done (S) | Steps move; Done closes and remembers | Step 2 "Add a habit", back to "Welcome", last step shows Done, closed, `tourDone` true | pass |
| Tour | Skip tour (S) | Closes, remembers, focus on heading | Closed, `tourDone` true, focus on `h-settings` | pass (after fix: first run relied on a delayed `close` event) |
| Today | Not now (S) | Banner hides, remembered | Hidden, saved, announced "Tour hidden..." | pass |
| Today | n (K) | New habit dialog | Opened, name focused | pass |
| Habit dialog | Return with empty name (K) | Error, focus stays on name | "Enter a name.", focus `f-name` | pass |
| Habit dialog | Type name with HTML, Return (K) | Habit added, name as text | List shows `Drink water <b>x</b>`, `innerHTML` escaped | pass |
| Today | space on focused habit (K) | Tick today | Ticked, "1 of 2 done today", streak 1 | pass (after fix: focus was stolen) |
| Today | Day button, past day (S) | Toggle that day, announce | Wed 18 Nov ticked, "Wed, Nov 18: done", focus kept on the button | pass |
| Today | Day button again (S) | Untick | `aria-pressed` false, "not done" | pass |
| Today | Search (S) | Filter | "stre" shows Stretch only | pass |
| Today | Search with no match, Clear search and filter (S) | Message, then reset and focus search | `no-match` shown, 0 habits; cleared shows 2, focus `q` | pass |
| Today | Show: done / not done (S) | Filter | Done: Stretch; Not done: Drink water | pass |
| Today | Sort name / streak (S) | Reorder | Name: A to Z; streak: Stretch first | pass |
| Today | Edit, Save changes (S) | Dialog filled, saves | Name, target 5, violet prefilled; saved as "Stretch more", 1/6, rose | pass |
| Today | Delete (K on button), toast | Habit removed, Undo toast | Removed, toast with Undo, focus moved | pass |
| Today | Undo button (S) | Habit back in place | Restored in order, focus on it, toast gone | pass |
| Today | u (K) | Undo last delete | After the shortcut fix the key reached the handler; an early run threw `t.closest` (synthetic event on `document`) | pass (after fix) |
| Today | Tab to the Undo toast | Reachable by keyboard | Undo was the last tab stop in the page (S check); a real Tab walk timed out because the toast expired after 10 s | pass (structure), keyboard walk UNVERIFIED |
| Shortcuts | ? (K, shift+/) | Dialog opens, Close focused | Opened, focus on Close; Close button closes it | pass (after fix) |
| Today | j, k (K) | Move, announce | Moved to second then first; live text "Drink water, 1 of 3. Press space to tick today." | pass |
| Today | / (K) | Focus search | Focus on `q` | pass |
| Today | Add 3 sample habits (S) | Three habits with history | Drink water 3 days, Stretch 3 days, Read 1 day, focus on first | pass |
| Today | Add your first habit / New habit (S) | Dialog | Opens | pass |
| Insights | Nav (S) | Two charts, text alternatives, table | 2 `svg role=img` with title and desc, 2 "Show as table" tables, 6 habit rows | pass |
| Insights | Charts (screenshot, K) | Readable | Bars 88/96/100/75 %, heatmap with numbers; label clipping found and fixed | pass (after fix) |
| Settings | Theme light / dark / system (S) | Applies live, saved | `data-theme` light then dark, body colours changed, system removes it, saved | pass |
| Settings | Week starts Sunday / Monday (S) | Numbers change live | Week counts 6/7 5/5 4/3 0/4 2/2 7/3 (Sun) vs 5/7 5/5 3/3 0/4 2/2 6/3 (Mon) | pass |
| Settings | Motion always off / system (S) | `data-motion` | Set to off, removed on system | pass |
| Settings | Show onboarding again (S) | Tour opens | Opens, `tourDone` false until closed | pass |
| Settings | Export JSON (S) | File made, message | Blob `application/json`, 218 bytes, "Exported 0 habits to pocket-habits-2026-11-21.json." (a real download file was not inspected) | pass, file UNVERIFIED |
| Settings | Import JSON button (S) | File picker opens | `input.click()` called once (picker itself not driven) | pass |
| Settings | Import: `{oops`, `[1,2,3]`, `__proto__`, 300 KB, duplicate ids (S) | Clear error, nothing changes | "not valid JSON", "not a Pocket Habits export", "forbidden key", "too large (limit 256 KB)", "Duplicate habit id"; storage unchanged; error also toasted | pass |
| Settings | Import test profile, Cancel (S) | Confirm, Cancel keeps data | Confirm text names 6 habits; Cancel kept 0 | pass |
| Settings | Import test profile, Replace (S) | 6 habits shown | "Imported 6 habits."; Today lists Drink water 5-day streak best 8, Walk streak 0 best 23, Practise guitar 10 days, "4 of 6 done today" | pass |
| Toast | OK (S) | Dismiss | Gone | pass |
| Settings | Reset all data, Erase everything (S) | Confirm, then empty | Dialog focus on Cancel; after confirm 0 habits, "All data erased.", empty state and tour banner back | pass |
| Help | 12 FAQ buttons (S) | Toggle, `aria-expanded` | 12 present; open/close verified on #1; all 12 opened and closed | pass (Enter/Space on a real button is native) |
| Help | Keyboard shortcuts, Take the tour (S) | Dialogs open | Both open | pass |
| Support | mailto link (S) | Subject and body | `mailto:support@example.test?subject=Pocket Habits support&body=App: Pocket Habits 1.0.0 / Browser: Chrome / What happened:` (link not opened) | pass |
| Support | Copy support email (K click) | Copied message | First scripted attempt while the tab was in the background: "Copy failed..." (honest fallback). With the tab fronted and a real click: "Copied support@example.test to the clipboard." | pass |
| Support | Copy diagnostics (K click) | Copied message | "Copied diagnostics to the clipboard."; text shown is version, schema 2, habits count only | pass |
| About | Settings link, brand, footer link, skip link (S) | Navigate or open | `#/settings`, `#/today`, dialog open; skip link first reset the screen to Today, fixed to focus `main` | pass (after fix) |
| 375 px | All screens (S) | No horizontal scroll | `scrollWidth` 375 on six screens | pass |
| All | Update bar "Reload to update" | Offers update | Cannot run: the in-app browser refuses service workers ("An unknown error occurred when fetching the script", also without `_headers`) | UNVERIFIED |
| All | Offline reload via service worker | Works with no network | Not possible in the in-app browser; logic covered by `tests/sw.test.js` in a sandbox only | UNVERIFIED |

## 5. Motion

Level: subtle. Enter fade-slide (opacity, transform), tick pop (transform), toast slide, dialog fade, bar grow (`scaleY`). Reduced motion: media query sets `animation: none` and `transition: none`; Settings > Motion > Always off does the same via `data-motion="off"`. Rule written, not emulated in a browser: UNVERIFIED. Content is never hidden by animation when animation is off.

## QA

Run 2026-11-22 on the current files.
- `node operations/plugin/scripts/qa.mjs product-growth/media/demo-apps/habits` -> `qa: 0 error(s), 0 warning(s), 4 unverified`
- `node operations/plugin/scripts/qa-browser.mjs product-growth/media/demo-apps/habits` -> `qa-browser: 0 error(s), 1 warning(s), 3 unverified`. The one warning: `[text-overlap] @360px overlapping text: p "Pocket Habits is a ficti" over span "Ready to use offline."`. The first-visit toast is fixed to the viewport and covers footer text at scroll top for 10 s or until OK. Accepted, see RESULTS.md. Extra CSS added so a toast never covers the footer once scrolled (`body:has(.toast) footer.site`, `html { scroll-padding-bottom }`).
- Screenshots read: `.lilac/qa/index-*.png`, `404-*.png` (tool) and `views-{today,insights,settings}-{360,768,1280}.png` (own helper `tests/qa-screens.mjs`, seeded test user). No horizontal scroll at any size (`scrollWidth` equals width in all nine). No visual problem found; six nav links wrap to two rows at 360 px (UX-REVIEW.md finding 4).
- Unit tests, `node --test tests/*.test.js`, `ℹ tests 42 / ℹ pass 42 / ℹ fail 0` under TZ=UTC, Asia/Kolkata, America/Los_Angeles, Pacific/Auckland.
- Offline (service worker), headless Chrome via `tests/qa-screens.mjs`: `sw state: activated caches: pocket-habits-v2`, server stopped, reload: `offline h1: Pocket Habits habits rendered: 6`, `exceptions: none`. The update bar ("Reload to update") is UNVERIFIED.
- `controls-test.mjs` run 3 (fixed tool): `controls-test: 81 controls, 0 dead, 0 broken, 0 placeholder, 5 unreachable (94% operable)`; the 5 are proved in RESULTS.md (State-conditional controls, `node tests/state-checks.mjs` -> `state-checks: 0 failure(s)`). Earlier runs 1 and 2 (old tool, 5 or more minutes apart): `controls-test: 98 controls, 0 dead, 0 broken, 0 placeholder, 77 unreachable (21% operable)`. Both runs exit 1. All 77 are tool limits (TOOL-ISSUES.md 1 and 2), not dead controls. Full output `.lilac/controls-run1.txt`, `controls-run2.txt`.
- `techdocs` -> `techdocs: 3 parts, 3 languages, 0 problem(s)`

## Simulated visitors

SIMULATED visitors, not real people. `node operations/plugin/scripts/persona-test.mjs product-growth/media/demo-apps/habits --visitors 30 --seed 7`, run 5 (same result as run 4): `persona-test: 30 simulated visitors, 48% tasks completed, 32 failure group(s)`; `FAIL: overall 48% is below 90%; mobile-3g 57% is below 70%; skimmer 33% is below 70%; keyboard 43% is below 70%; screen-reader 50% is below 70%; low-vision 57% is below 70%; reduced-motion 57% is below 70%; no-js 33% is below 70%; impatient 50% is below 70%; small-phone 57% is below 70%`. Exit 1. Task results: understand the offer 100% (28/28), find a way to contact 27% (8/30), reach every top-nav page 0% (0/28), custom add a habit 22% (4/18), custom mark it done 0% (0/18), custom export 100% (18/18), custom find help 100% (18/18). The gate is NOT met. Each failure group is classed in TOOL-ISSUES.md; none was shown to be a real app defect. Earlier runs (runs 1 to 4) are in `.lilac/persona-run*.txt`; run 1 used the original personas file (kept as `.lilac/personas.before.json`): `persona-test: 30 simulated visitors, 20% tasks completed, 51 failure group(s)`.

## Hosting

`node operations/plugin/scripts/hosting.mjs choose --host cloudflare --db none --project product-growth/media/demo-apps/habits` wrote `.lilac/hosting.json`; `hosting.mjs check --project ...` -> `hosting: 0 problem(s)`. `wrangler.jsonc` and `site/_headers` untouched. Not deployed; `deploy-plan` not run.

## Foundation

`foundation.mjs adopt` drafted FOUNDATION.md and BRAND.md; completed from the code. `check` -> `foundation: 0 error(s), 0 warning(s)`; `drift` -> `foundation drift: 0 error(s), 0 warning(s)` (two off-token values, `rgba(10, 8, 20, .55)` and `rgba(0,0,0,.3)`, moved to `--scrim` and `--shadow-toast`); `status` -> `NONE: no approval yet. Run /lilac:foundation.` Approval pending owner. Tokens `primary`, `link` and `success` are aliases of existing colours (the check requires them).

## End-to-end

Re-run after the changes: unit tests 42/42 in four time zones, headless Chrome offline check (above), `qa-screens.mjs` shots of Today, Insights, Settings at three widths with the seeded user: 6 habits rendered, no exceptions. Changes since the first end-to-end table: empty-state tour link only after the banner is gone (`#empty-tour`), toast footer padding and `scroll-padding-bottom`, service-worker cache `pocket-habits-v2`. The earlier E2E table above is dated evidence from the first build.
