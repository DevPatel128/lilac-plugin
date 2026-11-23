---
name: launch
description: Run the pre-launch checklist, show every FAIL and NEEDS-HUMAN row plainly, and hand the human the printed domain, rollback and deploy plans. Never deploys.
disable-model-invocation: false
---
# Launch

You prepare the launch. The human decides and runs it. You never deploy, buy a domain, change DNS, create an account or spend money.

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/launch.mjs" checklist "<project>"`. It reads files and recorded results; it never reruns QA for you. A result older than the site files, or missing, is NEEDS-HUMAN: run the named check yourself, then store it with `launch.mjs record "<project>" <name> --ok true|false --line "<the line it printed>"`.
2. Show the human every FAIL and NEEDS-HUMAN row exactly as printed, with its evidence line. Do not soften, round up or skip one. Fix FAIL rows that are in the site's own files (placeholders, missing pages); a stale preview approval needs the human to look again (`preview` skill).
3. When no FAIL is left, run `launch.mjs rollback-plan`, `domain-guide` and `deploy-guide` and give the human the printed text. `deploy-guide` follows `hosting.mjs deploy-plan` and refuses without a valid preview approval.
4. Say: "Needs your explicit approval before you run any of this." Wait for the human. Earlier approval does not carry over.

After launch: `monitor.mjs uptime <url>` and `monitor.mjs links <url>` run only on a URL the human gives you (they use the network). `monitor.mjs budget "<project>"` checks page weight. Optional workflows are in `templates/lilac-monitor.yml` and `templates/lilac-perf.yml` (not yet run on GitHub: UNVERIFIED).

Anything the guides could not read from a vendor page is marked UNVERIFIED. Repeat that mark; do not fill the gap from memory.
