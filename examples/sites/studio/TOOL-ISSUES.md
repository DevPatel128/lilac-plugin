# Tool issues found (Atelier Nord demo)

## 1. qa-browser [text-overlap] on a wrapped inline link (404.html)
Exact line: `warn  [text-overlap] @1280px overlapping text: a "Return to the home page" over a "browse the sample projec"` (also at 360 and 768 px).
Why this is a tool issue: both links sit in one sentence in `site/404.html` line 30 (`The page you asked for does not exist. <a>Return to the home page</a> or <a>browse the sample projects</a>.`). When the paragraph wraps, an inline link's bounding box spans two lines and intersects its neighbour's box. The screenshot `.lilac/qa/404-360.png` shows the text reading cleanly with no glyphs on top of each other. Site not changed to appease the tool; left as a warning. Re-run after the controls fix: still present (final qa-browser run).

## 2. Browser QA screenshots show load-time states
`.lilac/qa/index-768.png` shows the headline then empty paper: screenshots are taken at load, before the scroll reveals (`.rise`, `.dwg`) have run, and `404-360.png` shows the 0.9 s page-load wipe mid-way (dark band). Both are expected progressive states, not layout faults, so the screenshots cannot show the below-the-fold content. UNVERIFIED visually: below-the-fold drawings at 360/768/1280 (the tool's other checks passed).
