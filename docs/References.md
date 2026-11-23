# References: borrow a look, not the words

`/lilac:references` reads colours, font names, spacing, corner radius and heading sizes from sites you like and writes them to `design/DESIGN.md` and `design/tokens.json`.

**It does:** ask you to approve each URL; make one request per URL (http/https, public hosts only, 10 s, 1 MB cap, user agent `lilac-references`); log each URL and time to `.lilac/network.log`; read inline CSS only; write a take / do not take note per site.

**It does not:** copy text, images, logos, icons or code. A check refuses to write output if a sentence of the page body appears in it. It does not load linked stylesheets, so a site with all CSS in external files gives few tokens (it says UNKNOWN). Colour roles are guesses from frequency.

Run by hand: `references.mjs plan|fetch|extract|load <dir>`. `fetch` refuses without `--consent`. Check the site's terms; tokens are a starting point, not permission to imitate a brand.
