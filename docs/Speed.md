# Speed

What makes a Lilac build faster, and what is still slow. Numbers are measured, not promised.

## Measured (gates only)

Measured on one Mac, 3 pages, gates only; generation and human time not included (2026-11-23).

| Tool | Time |
|---|---|
| static gates (qa, funnel, foundation drift, ux graph) | under 0.1 s each |
| qa-browser | about 15.2 s |
| controls-test | about 19.9 s |
| persona-test, 30 visitors | about 33.2 s |

UNVERIFIED: whole-site time includes model generation, which is not measured. The numbers live in `scripts/timings.json`.

## What you can use

- `build.mjs plan <dir>`: dry run. Stages, gates before and after the preview, approvals, and a gate-time estimate for the chosen severity. Changes nothing.
- `build.mjs init <dir> --idea "..." --fast`: severity 4 and `fast:true` in state (`/lilac:build --fast`). Fewer approvals, Chrome gates after the preview.
- Gate cache: a gate whose input hash (every file in the site folder, plus tool and arguments) equals its last PASS is skipped and marked `(cached)`. Failures and UNVERIFIED are never cached. `build.mjs gates <dir> --no-cache` reruns everything. Known limit: ux-graph-check ignores the site, so it reruns whenever the site changes.
- `.lilac/approvals.json`: one receipt per approval `{stage, hash, severity, at, by}`, redacted, so an audit can sign a report. Plain JSON, not tamper-proof.
- `timing.mjs report <dir>`: per-step ms from `.lilac/progress.json`, slowest first.
- `timing.mjs budget <dir>`: compares with `.lilac/budget.json`; exit 1 when over, so CI can use it as a regression guard. Default: pre-preview gates 10 s at severity 6 or lower (sum of per-gate ms), first preview 180 s from init (includes human think time). No data yet prints `n/a`, never a pass.

```json
{ "preGatesMs": 10000, "maxSeverity": 6, "firstPreviewMs": 180000 }
```

## Next big saving: one warm browser

qa-browser, controls-test and persona-test each launch their own Chrome, so about 3 cold starts per run. Sharing one browser session across them is the next big saving. Not done: those tools belong to their own features and are unchanged.
