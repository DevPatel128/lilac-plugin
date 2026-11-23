# Hosting facts

Read on 2026-11-21 from the vendors' pages. Re-read before quoting; limits change.

| Vendor | Fact | Source |
|---|---|---|
| Cloudflare Workers | Free: 100,000 requests per day, 10 ms CPU per invocation. Static asset requests are free and unlimited. Paid plan minimum $5/month. | https://developers.cloudflare.com/workers/platform/pricing/ |
| Vercel Hobby | Free. Included: 1,000,000 CDN requests, 100 GB Fast Data Transfer, 1,000,000 function invocations, 100 deployments/day. Over the limit you wait 30 days. Pro adds paid seats ($20/user/month). | https://vercel.com/docs/plans/hobby |
| Supabase Free | 500 MB database per project, 2 active projects, paused after 1 week of inactivity. Pro from $25/month. | https://supabase.com/pricing |

UNKNOWN: Vercel Hobby commercial-use terms (page read did not state them; check https://vercel.com/legal/terms). Bandwidth limits for Cloudflare Workers egress and Supabase egress were not read.

Config formats: wrangler.jsonc assets-only Worker (https://developers.cloudflare.com/workers/static-assets/, shape confirmed against the workers-sdk fixture via context7); vercel.json `$schema` https://openapi.vercel.sh/vercel.json (not re-read today, minimal on purpose); Supabase `supabase/migrations/` with `supabase init` creating `config.toml` (https://supabase.com/docs/guides/local-development/cli/getting-started, not re-read today).
