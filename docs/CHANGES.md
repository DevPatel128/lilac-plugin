# Changing your site without breaking it

When you ask for an edit ("make the hero bolder", "move the pricing section up"), the agent should not just edit and say "done". Lilac's change tool makes the edit visible and checkable.

## What happens

1. **Before the edit.** The agent runs `change.mjs begin`. Lilac saves a copy of your site, takes a screenshot of every page at phone, tablet and desktop width, and runs the quality checks once so it knows which problems already existed.
2. **The edit.** The agent changes as little as possible.
3. **After the edit.** The agent runs `change.mjs finish`. Lilac works out:
   - which files changed;
   - which pages that touches (a page you edited, every page that uses a changed stylesheet, script or image, and every page if `brand/tokens.css` changed);
   - how much each page looks different, with a picture that paints the changed pixels red;
   - whether a page that should not have changed did change;
   - whether the checks now report errors that were not there before.
4. **The verdict**, written to `.lilac/changes/<n>/CHANGE.md`:
   - **SAFE**: no new errors and no surprise change on other pages.
   - **REVIEW**: a page changed that did not need to, or there are new warnings. Look at the pictures.
   - **BROKEN**: a check found a new error (for example a link that now goes nowhere).
5. **Your decision.** Open `.lilac/changes/<n>/compare.html` in your browser. It shows before, after and the difference side by side. The agent asks: keep or undo?

## Undo

`change.mjs undo <project> <n>` puts back only the files that the change touched and tells you which. If you or someone else edited the site after the check finished, undo refuses so it cannot wipe that work. `--force` overrides this for the files of that change.

## Good to know

- No Chrome on the machine: you get the text checks and the file list, but no pictures. The report says `SKIPPED(no browser)`.
- Everything runs on your computer. A temporary local server (127.0.0.1 only) lets Chrome load your pages; nothing is sent anywhere.
- Pages are shot with animations switched off so that two shots of the same page match.
- A SAFE verdict means the automatic checks found nothing. It does not judge taste, wording or real phones.
- `change.mjs list <project>` shows every change and its verdict. Keep a line per kept change in `CHANGELOG.md`.
