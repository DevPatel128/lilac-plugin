# Performance

Three offline, dependency-free checks. None of them measures a real page load.

| Tool | What it does | Exit |
|---|---|---|
| `scripts/perf-budget.mjs check <dir> [--profile mobile]` | JS/CSS gzip totals, HTML size, requests seen in markup, render-blocking scripts, images without width/height or lazy-loading rules, fonts without `font-display`, third-party scripts | 1 over budget |
| `scripts/images.mjs audit <dir>` / `plan <dir>` | Flags non-AVIF/WebP images, missing `srcset`/`sizes`/`alt`; `plan` prints commands you may run (sharp-cli, squoosh-cli). Converts nothing | audit 1 on findings |
| `scripts/visual-regression.mjs snapshot` / `check` | Hash of each block's normalised DOM outline and CSS, plus custom properties used, in `blocks/.fingerprints.json`. `--screenshots` saves 375/768/1280 PNGs to `.lilac/visual/` when Chrome exists | 1 on drift |

The budget numbers sit in the `budgets` object at the top of `perf-budget.mjs`. They are starting values: replace them with numbers measured on the real site.

Not covered: real network and CDN behaviour, response headers, Core Web Vitals, CSS background images, pixel diffs.
