---
name: owner-editing
description: Let the owner edit menu, dates and hours without an AI session, and wire spam-safe forms to email, Sheets or a CRM.
disable-model-invocation: true
---
# /lilac:owner-editing

Two parts. Owner guide: `docs/Owner-Editing.md`. No network, no dependencies.

## Owner editing (git-based, no server)
1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/owner-edit.mjs" init "${CLAUDE_PROJECT_DIR}"` scaffolds `content/`, `templates/index.html`, `admin/edit.html`.
2. Ask the owner for TRUE facts only (menu, tour dates, hours). Unknown stays empty and renders `UNKNOWN`. Never invent a date or price.
3. `validate` then `build-content` (same arguments). Validate fails on any date or price in a template that is not in `content/`.
4. Say the honest limit: `admin/edit.html` has no login. It only exports the changed file. Protect `/admin` at the host or do not publish it.

## Forms (email, Google Sheets, CRM)
Files: `features/server/forms/` (`forms.mjs`, `form.snippet.html`, `FORMS-SPEC.md`). Ask which target with AskUserQuestion (email, Sheets, CRM). Copy the files into the project. Keys and the Apps Script URL go in the host's environment, never the repo. Missing key gives an explicit 503, never a silent drop. Turnstile or hCaptcha secret absent means UNKNOWN. Real delivery is UNVERIFIED until the owner tests with their keys.

Before building, ask with AskUserQuestion: Approve / Change something / Stop.
