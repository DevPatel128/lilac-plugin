---
name: skillspector
description: "Scan an agent skill, MCP server or plugin with NVIDIA SkillSpector before it is installed, synced or promoted. Use whenever a skill is added, changed, vendored, or fetched from a repo, URL or zip, and before `lilac skill promote`."
---
# SkillSpector gate

Rule 0: a skill is code that runs with the agent's permissions. No new or changed skill is installed, vendored or promoted until a scan result is recorded. A clean scan is evidence of "no known bad pattern", not proof of safety (SkillSpector says it is defense in depth, not a sandbox).
Run `lilac-check` first. Third-party agent tools stay in the quarantine rules of `security/supply-chain/README.md`.

## Install (once per machine)
`uv tool install git+https://github.com/NVIDIA/skillspector.git` (Python 3.12+, Apache-2.0). MCP form: `skillspector[mcp]`, then `skillspector mcp` exposes `scan_skill`.

## Scan
1. **Static first, local only:** `skillspector scan <dir|SKILL.md|git-url|zip> --no-llm` (add `--fail-on-findings` for a skill you are adding: it must scan clean; existing skills gate on the score). It never executes the skill. It checks 71 patterns in 17 categories (prompt injection, exfiltration, curl-to-bash, unpinned or vulnerable dependencies, obfuscation, dangerous AST calls, MCP tool poisoning).
2. **Data note:** the dependency check (SC4) sends package names and versions to api.osv.dev even with `--no-llm`. The optional LLM pass (drop `--no-llm`) sends file contents to the configured provider: never for a skill that holds secrets or customer data.
3. **Read the score:** 0-20 LOW (safe), 21-50 MEDIUM (caution: read every finding), 51-80 HIGH and 81-100 CRITICAL (do not install). Exit codes: 0 completed and score 50 or less, 1 score over 50 or a strict gate fired, 2 error. Add `--fail-on-incomplete --min-coverage <n>` in CI so a half-scan cannot pass.
4. **Triage each finding:** fix it, or record a reason. Accepted false positives go in a baseline: `skillspector baseline <dir> -o baseline.yaml`, then `scan --baseline baseline.yaml` reports only new findings. Never baseline a finding you have not read.
5. **Vendored skills:** scan the upstream copy, record the score in its `VENDOR.md`, and rescan whenever `UPSTREAM.sha256` changes.

## Record and gate
- Put the command, score, band and finding count in the PR and, for a promotion, in the `lilac skill promote` note. Use `--format sarif` for CI and code scanning.
- Over 50, or any unread finding: stop and ask a human (`GOVERN.md`: new dependency or third-party code).
- A scan does not replace the eval a skill needs to move from `draft` to `approved` with basis `gate`.

## Report
`Scanned:` path or URL, SkillSpector version · `Score/band:` · `Findings:` fixed / accepted (why) / open · `LLM pass:` on or off · `UNKNOWN:` anything not scanned (binaries, remote fetches at runtime).
