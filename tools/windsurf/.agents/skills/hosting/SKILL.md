---
name: hosting
description: Ask the user where the product should be hosted (Cloudflare, Vercel, optional Supabase), record the choice, scaffold the config, and print a deploy plan without running it.
disable-model-invocation: false
---
# Hosting

Code is always on GitHub. That is not a question, and the hosting choice never changes it.

**Step 0: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/hosting.mjs" show --project "<dir>"` and tell the human the current choice in plain words BEFORE asking anything.** If a choice exists, ask "Keep it or change it?" Changing needs `--change` on `choose`; it never deletes their files or the old host's config, it only adds missing ones and keeps a history. The first time, tell them: "You chose <host>. You can change it any time with /lilac:hosting."

**Ask first, before writing any hosting config.** Use the AskUserQuestion tool if you have it, otherwise ask a plain numbered question. Do not pick for the user.

1. **Cloudflare (recommended default).** Good for static sites and light apps close to users; static asset requests are free per its docs. Worker request limits and paid plans: see REFERENCE.md.
2. **Vercel.** Good for frameworks like Next.js with one-click previews. The free Hobby plan has usage limits; paid plans cost money.
3. **Cloudflare + Supabase database.** Cloudflare hosting plus a Postgres database with sign-in. Supabase free projects pause when idle (UNVERIFIED for today); paid is from $25/month.
4. **Vercel + Supabase.** Vercel hosting plus the same Supabase database and the same caveats.
5. **Something else.** Recorded as manual; Lilac scaffolds no host config.

Free-tier numbers are UNVERIFIED unless REFERENCE.md shows the vendor URL and date; any limit not listed there is UNKNOWN. Say so.

After the answer run (`<dir>` is the project folder):
`node "${CLAUDE_PLUGIN_ROOT}/scripts/hosting.mjs" choose --host cloudflare|vercel|manual --db none|d1|supabase --project "<dir>"`, then `check`. `deploy-plan` refuses until the human has previewed the site and approved it (skill `preview`, `/lilac:preview`).

`choose` also copies a GitHub Actions workflow to `.github/workflows/lilac-checks.yml` (never overwrites; no secrets, no deploy step). It has NOT yet been run on GitHub: UNVERIFIED until pushed and a run passes.

Never do these yourself: deploy, buy a domain, create an account, change DNS, spend money. Print the `deploy-plan` output and ask for the human's explicit approval for each action. Never put keys in files; the service-role key never goes to a browser.
