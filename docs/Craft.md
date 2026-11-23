# Craft review

A deterministic craft score (0 to 100) for a built site, plus a check that the site has one signature moment.

```bash
node scripts/craft-review.mjs score <dir> [--library <entry>] [--threshold 70] [--loop-hint] [--dimension d] [--json]
node scripts/craft-review.mjs signature <dir>
```

## What it measures

Five dimensions, 20 points each. Each check prints its evidence. A check it cannot measure is `UNVERIFIED` and left out of the score.

| Dimension | Checks |
|---|---|
| type | at most 3 font families, modular heading scale, body line length 45 to 80ch, line-height 1.4 to 1.7 |
| spacing | few off-scale values (4px steps to 16, 8px after), at most 12 distinct values |
| colour | palette of at most 10, text pairs at WCAG 4.5:1, accent used sparingly |
| motion | at most 4 durations, at most 3 easings, prefers-reduced-motion respected |
| hierarchy | one h1 per page, no skipped heading level, one primary CTA per page |

Exit 0 at or above the threshold (default 70), 1 below, 2 on bad usage. `--loop-hint` prints what to fix per dimension; the agent fixes, re-runs with `--dimension`, and stops after 3 rounds.

## Signature moment

`signature` passes when exactly one element carries `data-signature` and, if `BRIEF.md` names a signature moment, that element exists.

## Reference library

`--library <entry>` prints a token distance (fonts, accent, line-height, heading ratio) against an entry in `operations/plugin/library/`. It compares tokens only and never copies content. Entries need `owner_consent: true`. The plugin ships the mechanism and one invented example. Add your own entries under `~/.lilac/library/<name>/` or in your project; do not commit private sites to a public repo. See `library/README.md`.

## Gate status

The craft-review gate ships off by default (`minSeverity` 7, before the preview). The score is advice until the blind designer test below is run and recorded. Status: UNVERIFIED. A high score has not been shown to match a designer's judgement.

## Blind designer test (protocol, not yet run)

Goal: find out whether the score tracks a designer's judgement.

1. Collect 12 built sites: 4 that the score rates 85 or more, 4 between 50 and 70, 4 below 40. Hide the scores and the names.
2. Give 3 working designers the sites in random order. Each rates every site 1 to 10 for craft, alone, with no discussion.
3. Record the scores and each designer's ratings in `operations/plugin/DOGFOOD.md`.
4. Compute the rank correlation (Spearman) between the score and the mean designer rating.
5. Decision: 0.7 or higher, ship the gate at `minSeverity` 7 and tune thresholds on the misses. Below 0.5, treat the score as a lint, not a gate, and rework the checks that disagree. Between, keep it off and re-test after changes.

Until this is recorded, do not claim the score measures quality.

## Limits

Regex scan of HTML and CSS, not a browser: JS-set styles, computed values and cascade order are not seen. A site can score high and still be dull.
