# Owner editing and forms

For the site owner. No coding needed.

## Change your menu, tour dates or hours

1. Open `admin/edit.html` in your browser (double-click it). It works offline.
2. Press "Open a file" and pick a file from the `content` folder (`menu.json`, `tour-dates.json`, `hours.json` or `about.md`).
3. Change the boxes, press "Download", and put the downloaded file back in `content`.
4. Commit it (or ask Lilac to run `build-content`). The page is rebuilt as plain HTML: it shows without JavaScript.

If a file is empty the page shows `UNKNOWN`. Lilac refuses to build when a page names a date or price that is not in `content`, so nothing is invented.

**Honest limit:** there is no login. `admin/edit.html` can only export a file, it cannot change your live site. Protect the `/admin` folder at your host (password or access rule), or do not publish it.

Commands: `node scripts/owner-edit.mjs init|validate|build-content <project>`. Placeholder in a template: `{{content.menu}}`.

## Contact forms to email, Google Sheets or a CRM

Copy `features/server/forms/` into your project. Choose one target:
- email: `RESEND_API_KEY`, `CONTACT_FROM`, `CONTACT_TO`
- Google Sheets: `SHEETS_WEBHOOK_URL` is the address of a Google Apps Script web app you create and own (`https://script.google.com/...`, placeholder until you add yours)
- CRM: `CRM_WEBHOOK_URL`, optional `CRM_WEBHOOK_TOKEN`

Set these at your host, never in the repo. If one is missing the form answers with a clear error naming it; messages are never silently lost. Spam protection: a hidden field, a minimum fill time, a limit of 5 messages per 10 minutes per visitor (kept in memory, resets on restart), length limits, escaped output, and an optional Turnstile or hCaptcha check (UNKNOWN until you add its secret).

Not verified: real delivery to any provider. Test with your own keys before launch.
