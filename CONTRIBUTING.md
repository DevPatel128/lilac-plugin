<!-- How to contribute a skill or fix to the Lilac plugin. -->
# Contributing

> **Plain-language starting point, not legal advice; have a qualified lawyer review it before relying on it.**

## Propose a skill
1. Open an issue that says what the skill does and when it should run.
2. Add the skill as a folder with a `SKILL.md`. Keep it short and specific.
3. Open a pull request that links the issue.

## Run the checks
Before you open the pull request, run:

```
node operations/scripts/structure-check.mjs
node operations/scripts/docs-check.mjs
node operations/scripts/guides-check.mjs
```

## No secrets or customer data
Do not put secrets, tokens, customer data or private paths in a contribution, including examples and test fixtures.

## Review
Every skill is scanned before merge. A skill that fetches code, runs hidden commands or overrides the agent's rules is rejected.

## Licence
Contributions are accepted under the repository licence (MIT, in `LICENSE`).

## Sign-off (required)
Every commit needs a sign-off line, in the style of the Developer Certificate of Origin. Add it with `git commit -s`:

```
Signed-off-by: Your Name <you@example.com>
```

By signing off you confirm that you wrote the work, or you have the right to submit it under the licence.

## Do not submit
- secrets, tokens or personal data
- copyrighted third-party text or code you have no right to share
- code under a licence that is not compatible with MIT

## Vendored skills
Vendored skills (a folder with `VENDOR.md`) are never edited in place. Propose changes upstream.

See also: `DISCLAIMER.md`, `TRADEMARKS.md`.
