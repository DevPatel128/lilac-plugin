# Foundation: start with the basics

Before Lilac writes any page, it plans the building and makes the brand kit. This guide says why, what you get, and how your approval works.

## Why start here

Mistakes made at the start get copied into every page. A colour that is hard to read, a font loaded from another company's server, a tool nobody chose: each one is cheap to fix on day one and expensive on day thirty. So Lilac decides the basics first, shows them to you, and only then builds.

## The two files

**FOUNDATION.md** is the plan. It says which languages and tools the site uses and why, where the files go, where content and data live, where it is hosted, the speed and accessibility limits, and the security basics. It defaults to the simplest thing that works: plain HTML, CSS and JavaScript, unless your brief truly needs a server, sign-in, or many pages built from data. Every choice is a short entry with the options considered, the reason, what you give up, and what would make you revisit it.

**BRAND.md** is the brand kit. It holds the name check (Lilac advises a trademark search and never says a name is free), the voice, the logo, colours for light and dark, fonts, spacing, motion, image rules, icons and accessibility promises. A small block of settings at the end becomes `brand/tokens.css`, which the site uses, plus a one-page `brand/brand-sheet.html` for you to look at.

## Example: a cafe

For a four-page cafe site the foundation says: plain HTML and CSS, no build step, hosted on Cloudflare with the code on GitHub, no analytics, pages under 150 KB. The brand kit says: warm, plain, local; paper-coloured background and kiln orange for buttons; system fonts; every animation under half a second and switched off for visitors who ask for less motion. The brand sheet shows each colour with its contrast number so you can see the text is readable.

## Approval and "stale"

You look at the brand sheet and the plan, then say yes in your own words. Lilac records your words and a fingerprint of the four files. If anyone edits any of them afterwards, the status turns STALE: the fingerprint no longer matches what you approved. Lilac then checks again and asks you again. Nothing is built until the status is VALID.

## What drift means

After the site is built, Lilac scans the CSS for colours, fonts and animation times that are typed in directly instead of coming from the brand kit. That is "drift": the site slowly stops matching the kit. Lilac lists the first ten examples. They are warnings, except when a typed text colour is too faint to read, which is an error.

## More help

- [USER-GUIDE.md](USER-GUIDE.md)
- [PROMPTING.md](PROMPTING.md)
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
