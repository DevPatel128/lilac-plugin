<!-- Pocket Habits demo app: project brief, written before any code. FICTIONAL SAMPLE product. -->
# Brief: Pocket Habits (fictional sample habit tracker)

## Audience
A curious reader of the Lilac demo, acting as a person who wants a small, private habit tracker that works on a phone or laptop without signing up.

## Main action
Add a habit, tick today as done, and see the streak and weekly progress update. Export the data as a file they own.

## Facts (all SAMPLE)
- Pocket Habits is a FICTIONAL sample product built as a Lilac web-app-track example. It is not a real service and has no company behind it.
- All data stays in the browser (localStorage). No accounts, no backend, no external requests, no tracking.
- Starter habits ("Drink water", "Stretch", "Read") are invented sample text, added only when the visitor asks.
- Week starts Monday. A habit has a weekly target of 1 to 7 days and one colour from an eight-colour palette.

## Must not claim
No health, wellbeing, fitness or productivity-outcome claims ("build better habits", "lose weight", "be more productive"). No user counts, reviews, ratings, awards, press or statistics. No claim of cloud sync, backup or encryption. No claim that data is safe from other people using the same browser.

## Tone and references (moods only)
1. A paper pocket notebook with tick marks: quiet, plain, a little warm.
2. A lilac-tinted desk lamp at night: soft light, one accent colour, nothing shouting.
3. A well-made kitchen timer: obvious controls, big targets, one clear job.
Voice: short, friendly, plain; says "sample" where text is invented.

## Pages / Screens
Today (habit list with last-7-days strip), Insights (4-week completion bars, heatmap, per-habit table), dialogs: add/edit habit, guided tour, keyboard shortcuts, confirm reset, confirm import. First-run empty state. `<noscript>` message.

## Constraints
Plain HTML, CSS and ES modules in `site/`; no framework, no build step, no CDN, no external requests, system fonts, inline SVG only. Pure logic modules (dates, stats, store, io) have no DOM access and are tested with `node --test`. Light and dark, WCAG AA, 44 px targets, responsive 360 to 1440 px, keyboard-only use, aria-live announcements, strict CSP with no inline scripts or styles. Installable PWA with offline service worker and a visible update prompt. Languages: English. Budget and deadline: none (demo).
Motion: subtle. Transform and opacity only; off under `prefers-reduced-motion: reduce`; no flashing.

## Hosting
cloudflare (static assets, `_headers` file for CSP and security headers, same shape as the demo sites). Code on GitHub. Not deployed by the builder.

## Success
A visitor can add, edit, delete (with undo), tick and untick a habit for today and the past 7 days; streaks and weekly numbers are correct in any timezone; export then import round-trips; a malformed or oversized file is rejected with a clear message and changes nothing; the app reloads and works offline; `node --test` passes with 40 or more assertions; zero requests leave localhost.
