---
name: doctor
description: Check that Lilac works on this computer (Node, TypeScript loading, Chrome for PDFs, learning switch, plugin files) and explain any fix.
disable-model-invocation: true
---
# Lilac doctor

Run: `node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"`

Then tell the user the result in plain words: what passed, what failed, and the one-line fix printed next to each failure. If everything passed, say "Lilac is ready." Do not change any setting yourself.
