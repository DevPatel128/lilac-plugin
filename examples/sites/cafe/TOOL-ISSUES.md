# Tool issues found (not site problems)

Both come from the native `<input type="date">` on `site/contact.html` line 34 (`<input id="date" name="date" type="date" ...>`). The site was not changed to appease the tool.

1. `qa-browser.mjs`, line: `ERROR [focus-trap] keyboard focus is trapped on input#date "" (same element 5 times in a row)`. A Chrome date input has several keyboard stops inside one element (day, month, year, picker button); the walk sees the same element repeatedly and calls it a trap. Not verified by a manual Tab walk. Tab does leave the field in a normal browser (UNVERIFIED by hand).
2. `persona-test.mjs` task "complete the main form" 0% (0/22): the tool types every field with `Input.insertText` (`operations/plugin/scripts/persona-test.mjs`, `async fill`), which cannot fill the segmented date control, so the Day field stays empty and the demo form correctly shows "Please pick a day." The keyboard persona line `"Guests (1 to 12)" not reached with Tab within 40 presses` is the same date field eating Tab presses. Evidence the form itself works: in the in-app browser on a local server, setting the fields and submitting with day 2020-01-01 showed "Please pick today or a later day." and no confirmation; with day 2030-01-15 the confirmation `Demo: nothing was sent.` appeared (class `ok show`).

Not re-run after 5 minutes: the coordinator reported the tool fix had already landed before the final run.

## 2026-11-23 update

After the no-JavaScript form change, `qa-browser.mjs` printed `qa-browser: 0 error(s), 0 warning(s), 3 unverified` and `persona-test.mjs` (seed 7, 30 visitors) completed `complete the main form` 100% (22/22). Issues 1 and 2 above did not reproduce on this run (tool fixes had landed).
