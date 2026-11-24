# Weekly research refresh

What it does: once a week (and on demand) Lilac's own CI re-researches the 3 stalest knowledge records (earliest `expiry`) and 1 coverage gap (the vertical with the fewest claims), then opens a pull request. Small diffs, coverage grows every week.

What it does not do: push to main, merge, or accept a claim without `source_url`, a verbatim `quote` and a `retrieved` date. Unknown stays `UNKNOWN`.

Gate: knowledge validation, pack tests and the fidelity calibration set must pass. A drop in fidelity pass rate blocks the PR.

Run the selection locally (offline):

    node operations/scripts/research-weekly.mjs select operations/plugin/knowledge
    node operations/scripts/research-weekly.mjs pr-body selection.json

Workflow: `.github/workflows/knowledge-refresh.yml`. The research step is a placeholder that fails closed until `ANTHROPIC_API_KEY` is set as a repository secret and the agent step is wired. Never put the key in the repo.

Scheduled workflows in public repos are paused by GitHub after 60 days without activity. Re-enable: Actions tab, "knowledge-refresh", Enable workflow (or `gh workflow enable knowledge-refresh.yml`).
