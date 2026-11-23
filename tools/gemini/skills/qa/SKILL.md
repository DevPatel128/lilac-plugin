---
name: qa
description: Run an automatic QA pass on a site (static checks, then a real headless-Chrome pass: no-JS, keyboard, widths, reduced motion, dark mode), fix every error, look at the screenshots, and report the rest in plain words.
disable-model-invocation: false
---
# Lilac QA

The human should not have to hunt for errors. Run the checks, fix what fails, show the output.

1. Run the static pass: `node "${CLAUDE_PLUGIN_ROOT}/scripts/qa.mjs" "<project>"` (add `--site <dir>` if the site folder is not `site`, `public`, `dist`, `out` or `build`; `--budget <KB>` changes the 500 KB page budget; `--json` for machine output). It reads files only and uses no network. It also checks the no-JavaScript render, content hidden at load, and motion safety (reduced-motion override, infinite animations, animated layout properties).
2. Run the browser pass: `node "${CLAUDE_PLUGIN_ROOT}/scripts/qa-browser.mjs" "<project>"` (same `--site`, `--json`; `--widths 360,768,1280` to change widths). It starts its own local server and headless Chrome, and checks overflow, console errors, failed requests, tap targets, no-JavaScript text, the Tab key walk-through (visible focus, traps, skip link, unreachable controls), reduced motion and dark-scheme contrast. If it prints `qa-browser: SKIPPED(no browser)`, no Chrome was found: say the browser pass was not done (set `CHROME=/path/to/chrome` to fix it).
3. If either reports errors, fix every one in the Builder role, using the `fix:` hint printed under each. If you are a read-only agent (Tester, Reviewer, Security), do not edit: hand the list to the Builder.
4. Re-run both until each last line says `0 error(s)`. Never skip an error, loosen a check, or edit the checker to make it pass.
5. Look at the saved screenshots: Read each PNG in `<project>/.lilac/qa/` (one per page and width). Look for what the scripts cannot see: broken or ugly layout, clipped or crowded text, weak hierarchy, images that look wrong, anything off at 360 px. Fix what you find, then re-run.
6. Report to the human in plain words: what was fixed, the warnings (what each means and whether to act), every UNVERIFIED item with its reason, and what you saw in the screenshots. Include both final lines (`qa:` and `qa-browser:`) verbatim.

Rules
- Say "QA passed" only with the command output in the same message. Without it, say what you did and what is unverified.
- Warnings do not fail the run but still go in the report. UNVERIFIED means the tool could not decide: say so, never turn it into a pass.
- Do not paste secrets the tool found. Name the file, tell the human to rotate the key.

Automated QA cannot judge (say so in the report): copy quality and tone, brand fit and visual taste, whether the page does its job for a real visitor, real-device behaviour (touch, slow networks, old browsers, screen readers), and color contrast on images or gradients. Say these remain for a human.
