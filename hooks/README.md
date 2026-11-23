# Learning hook

One optional `Stop` hook runs `learning/capture.mjs`. It does nothing until you turn learning on. The hook has no network access.

## Turn on and off

- On: `node learning/config.mjs on`
- Off: `node learning/config.mjs off`
- Check: `node learning/config.mjs status` (default is `off`)

## Exactly what is recorded (only while on)

One small file per run under `~/.lilac/agents/<agent>/learned/runs/` (mode 0600), after secrets are redacted:

- task text (first 200 characters)
- outcome (`pass` or `fail`)
- failed check names
- rework count
- timestamp

Never recorded: file contents, tool output, prompts, or anything else in the hook payload.

## What happens next

`learning/reflect.mjs <agent>` drafts lessons from that agent's own runs. A draft only becomes a rule through `learning/promote.mjs`, which needs your written approval bound to the lesson's sha256 and an eval score at or above the baseline. Nothing is promoted automatically.

Promote usage: `node learning/promote.mjs <agent> <lesson> --approval <file> --baseline <file> --eval-cmd <program> [arg ...]`. The eval command is an argument list run without a shell.

## Approvals are self-attested

An approval file proves a human-looking approval exists, it cannot prove a human wrote it. The control is that the agent instructions forbid writing approvals and promotion needs the owner to run the command. The same holds for the `--by` and `--quote` of foundation, build and preview approvals. Treat all of them as a record and a convention, not as authentication.

## Redaction limits

Before anything is stored, text is scrubbed (then cut to 200 characters): API keys, tokens, JWTs, private key blocks, AWS key ids, passwords written as `password is X`, `pwd=X`, card numbers that pass the Luhn check, US SSNs, phone numbers, emails, and passwords in URLs. Names, street addresses and other free-form personal facts are not detected.

## Delete everything

`rm -r ~/.lilac` (or `$LILAC_HOME` if you set it).
