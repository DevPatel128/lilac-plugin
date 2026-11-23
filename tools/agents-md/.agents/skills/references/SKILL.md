---
name: references
description: Take colours, fonts and spacing from sites you like, with your approval of each URL. Tokens only, never their words or images.
disable-model-invocation: true
---
# /lilac:references

Takes design tokens (colours, fonts, spacing, radius, heading sizes) from sites the user likes. It never copies text, images, logos or code.

1. Ask the user for 1 to 3 reference URLs (http/https). Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/references.mjs" plan "${CLAUDE_PROJECT_DIR}" --urls <u1,u2,u3>` to print the list.
2. Consent: show every URL and ask with AskUserQuestion: Approve / Change something / Stop. Say it makes one web request per URL and logs it to `.lilac/network.log`. No approval, no fetch.
3. On Approve only: `node "${CLAUDE_PLUGIN_ROOT}/scripts/references.mjs" fetch "${CLAUDE_PROJECT_DIR}" --urls <u1,u2,u3> --consent`.
4. `node "${CLAUDE_PLUGIN_ROOT}/scripts/references.mjs" extract "${CLAUDE_PROJECT_DIR}"` (offline). It writes `design/DESIGN.md`, `design/tokens.json` and `design/NOTES.md` (take / do not take per site).
5. Show the tokens. Roles (background, accent) are guesses from frequency; ask the user to confirm or change them with AskUserQuestion before building with them.
6. Pattern library: `references.mjs load "${CLAUDE_PROJECT_DIR}" <pattern-name>` reads `library/<name>.md` if present, else prints "no library entry".

Do not paste anything from the reference pages into the site.
