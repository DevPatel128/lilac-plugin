---
name: controls-test
description: Click, toggle, fill and key-press every button, link, menu item and setting of a site or app in real Chrome and prove each one has an observable effect; fix every DEAD, BROKEN-LINK, DISABLED-FOREVER, PLACEHOLDER and UNREACHABLE control until none is left.
disable-model-invocation: false
---
# Lilac controls test

The owner wants no stale or inoperable button, link, menu item or setting in any site or app. This skill proves it, control by control.

## Run

`node "${CLAUDE_PLUGIN_ROOT}/scripts/controls-test.mjs" "<project>"` (add `--site <dir>`, `--json`). It starts its own local server and headless Chrome, sweeps every page and every screen reachable by clicking (tabs, accordions, dialogs, menus), and prints a table per page (control, kind, verdict, detail), totals, an UNVERIFIED list and a last line `controls-test: N controls, D dead, B broken, P placeholder, U unreachable (X% operable)`. If it prints `controls-test: SKIPPED(no browser)`, no Chrome was found: say the sweep was not done (set `CHROME=/path/to/chrome`).

Apps behind a sign-in: write a test-only file, e.g. `.lilac/controls-login.json`: `{"loginPath":"/login.html","fields":{"email":"test@example.com","password":"<test value>"},"submit":"button[type=submit]"}` and pass `--credentials <file>`. Test values only, never a real password; the file is used only against the local server and is refused if it names any other host. Values are redacted from every report. Never commit that file.

## Verdicts and the fix for each (Builder role)

| Verdict | Meaning | Fix |
|---|---|---|
| OK | An effect was observed within 1.5 s | none |
| DEAD | Click, toggle, typing or key press changed nothing observable | Wire the handler, or delete the control. A control that does nothing must not ship |
| DISABLED-FOREVER | `disabled` and filling the form with valid sample values never enabled it | Make the enabling condition reachable, or remove it; show why it is disabled if it is legitimately off |
| BROKEN-LINK | 404, `href="#"` or empty, `javascript:` URL, missing anchor target, mailto/tel malformed or missing an expected subject, non-https `window.open`, `target=_blank` without `rel="noopener"` | Point it at a real target; add `?subject=` to mailto links named quote, order, support and similar |
| PLACEHOLDER | TODO/lorem text, or a link to example.com not documented as a SAMPLE | Replace with real content, or mark it `data-sample` and say SAMPLE next to it |
| UNREACHABLE | Covered by another element, cannot be scrolled into view, or never visible in any reachable screen | Fix the overlay or z-index, or delete the dead markup |
| TOO-SMALL | Works but is under 24 px (not a failure) | Give it at least 24x24 px, aim for 44 |

Exit code 1 means at least one DEAD, BROKEN-LINK, DISABLED-FOREVER, PLACEHOLDER or UNREACHABLE. The `dead` count in the last line includes DISABLED-FOREVER.

## Loop

1. Run it. 2. Fix every failing row in the Builder role, using the detail text (failure screenshots are in `<project>/.lilac/controls/`). Read-only roles (Tester, Reviewer, Security) hand the list to the Builder and do not edit. 3. Re-run until the last line shows `0 dead, 0 broken, 0 placeholder, 0 unreachable`. Never loosen the tool, add a fake handler or hide a control to get a pass.

## How it decides

Per control the page is reloaded first, so a destructive control (delete, reset) cannot hide later ones. A native `confirm()` is cancelled first (the dialog must appear), then confirmed once on a throwaway reload. Clipboard, `window.open`, mailto/tel and `target=_blank` are intercepted and validated, never executed. Keyboard shortcuts written in the page text ("press n", `<kbd>`, ctrl+k) are pressed. Say "works" for a control only when a row shows an observed effect.

## Limits (report these as UNVERIFIED, never as a pass)

File inputs and native pickers, canvas-only controls, controls inside iframes or shadow roots, hover-only, long-press and drag-only controls, external link destinations (not fetched), and mobile-only menus (swept at 1280 px). An effect proves a control is wired, not that it does the right thing; a page whose DOM changes by itself (clock, carousel) only gets URL, focus, dialog, storage, copy and download effects trusted. A human still judges whether each control does what its label says.
