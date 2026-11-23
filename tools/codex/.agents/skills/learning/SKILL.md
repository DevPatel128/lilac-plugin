---
name: learning
description: Show, turn on or turn off Lilac's optional learning hook. Off by default. Usage /lilac:learning status|on|off
disable-model-invocation: true
argument-hint: "status | on | off"
---
# Lilac learning switch

The argument must be exactly `status`, `on` or `off`. If it is anything else, or empty, use `status`.

Run: `node "${CLAUDE_PLUGIN_ROOT}/learning/config.mjs" $ARGUMENTS`

Then explain in one or two lines. When on: Lilac records only the task text (first 200 characters), the outcome, the failed check names and a rework count, with secrets and emails removed, in `~/.lilac/agents/<name>/learned/` on this computer. Nothing is sent anywhere. When off: nothing is recorded. Never turn it on unless the user typed `on`. Delete all data: `rm -r ~/.lilac`.

Approvals are self-attested. An approval file proves a human-looking approval exists, it cannot prove a human wrote it. The control is that the agent instructions forbid writing approvals and promotion needs the owner to run `learning/promote.mjs` themselves. Never write an approval file, and never run promote, for the user.
