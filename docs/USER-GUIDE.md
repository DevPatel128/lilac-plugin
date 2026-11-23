# Lilac user guide

For anyone using Lilac. No coding knowledge needed to follow it. (AI agents: read [AGENTS.md](../AGENTS.md) instead.)

## What Lilac is, in two lines

Lilac adds a team of AI helpers (agents) and a set of instructions (skills) to your AI coding tool. Together they help you build a website or web app, and they check that it really works before you ship it.

## Install in two steps (Claude Code)

```text
/plugin marketplace add DevPatel128/lilac-plugin
/plugin install lilac@lilac
```

Then type `/lilac:doctor`. It checks your computer and says "Lilac is ready" or tells you exactly what to fix. Other tools: [INSTALL.md](INSTALL.md).

## Your first ten minutes

| You want to | Type | What happens |
|---|---|---|
| Start something new | `/lilac:lilac idea <your idea>` | Lilac tests the idea, then plans it |
| Change something that exists | `/lilac:lilac <what you want changed>` | Lilac plans, builds, checks and documents the change |
| Understand your own project | `/lilac:docs` | Writes a page listing the languages and services you use, how each works (with diagrams), questions an interviewer may ask, and drafts for social media |
| Say what you want, the right way | `/lilac:brief` | Lilac interviews you (8 short questions, one at a time), writes a checked `BRIEF.md` and waits for your yes before building. Tips: [PROMPTING.md](PROMPTING.md) |
| Choose where it lives online | `/lilac:hosting` | Lilac asks where you want to host (Cloudflare is the default; Vercel and Supabase are options), saves your choice and sets up the files. Your code is always on GitHub. Lilac never deploys, buys a domain or spends money without your yes |
| Look at it before it goes live | `/lilac:preview` | Runs your site on your own computer. You look, then say yes or what to change. Nothing is published without that yes, and any later edit makes the yes stale |
| Find errors before your users do | `/lilac:qa` | Automatic checks for broken links, accessibility, speed, security and search basics, then a real-browser pass at phone, tablet and desktop sizes with keyboard-only and no-JavaScript tests |
| See how different visitors cope | `/lilac:persona-test` | About 100 simulated visitors (slow phone, keyboard only, screen-reader proxy, low vision, no JavaScript and more) try the main tasks. They are simulated, not real people |
| Get opinions | `/lilac:persona-review` | Several AI reviewers with different viewpoints say what confuses them. These are AI opinions, not real user feedback |
| Hand the project to someone | `/lilac:project-handoff` | Writes `HANDOFF.md`, a PDF and a short slide deck |
| See what Lilac can do | `/lilac:help` | Shows this list |
| Check that Lilac works | `/lilac:doctor` | A health check with plain fixes |
| Turn learning on or off | `/lilac:learning on` or `off` | See "Your data" below |

You can also just describe what you want in normal words; Lilac's skills load when they fit.

## Where your product is hosted

Your code always lives on GitHub. **You** choose where the product runs online, and Lilac asks before it sets anything up:

1. **Cloudflare** (the default). Good for fast sites and apps, with a free starting plan.
2. **Vercel.** Good if you use Next.js.
3. **Cloudflare + Supabase database**, or 4. **Vercel + Supabase database**, if you want a ready-made database and sign-in.
5. **Something else.** Lilac records it and you set it up yourself.

Free-plan limits change; Lilac shows the vendor page and the date it checked. Going live, buying a domain and any spending always need your explicit yes.

## The three phases

1. **Build:** make it work for you and your team. No real customer data yet.
2. **Secure:** make it safe, fast and watched, so real customers can use it.
3. **Launch:** the strongest safety proof, then pricing, marketing and the business plan.

A phase only counts as done when there is **evidence**: the command that was run and what it showed. "It should work" is not evidence.

## Who does what

| Helper | What it does for you |
|---|---|
| Planner | Finds out what is true and makes the plan |
| Builder | Writes the code, tests and notes |
| Reviewer | Checks the work with fresh eyes |
| Tester | Runs the checks |
| Security | Looks for risk and says "no" or "not yet" |
| Docs | Writes the explanations and the handoff |
| Release | Gets things ready to ship, then **asks you** before anything goes live, is emailed or is posted |

Nothing is deployed, emailed or posted without your say-so.

## Your data

- Lilac has no server and no account. Your code and notes are not sent to Lilac or anyone else by Lilac.
- Your AI tool still talks to its own provider, as it always does.
- The optional **learning** switch is **off** by default. When you turn it on, Lilac saves a tiny note after each task on **your computer only**: what you asked (first 200 characters), whether it passed, which checks failed and how many times work was redone. Passwords and email addresses are removed first.
- Delete everything Lilac saved: `rm -r ~/.lilac`

## Start with the basics

Before any building, Lilac works out the foundations with you and asks for your yes: the architecture, the languages and tools (the simplest set that meets your brief), and a **brand kit** (colours that are readable in light and dark, type, spacing, motion rules). This is why the finished site is consistent and why errors are not baked in from the start. Change the brand later and Lilac asks you to approve again. More: [FOUNDATION.md](FOUNDATION.md).

## What runs before you publish

Lilac runs these for you, in this order, so you do not have to hunt for errors:

0. Foundations: architecture, tools and brand kit are decided and approved.
1. Your brief is checked (vague words, missing facts, missing "must not claim").
2. The site is built, then checked by script (links, accessibility, speed, security, search basics, motion safety).
3. A real Chrome pass tests phone, tablet and desktop sizes, the page with JavaScript off, keyboard-only use and reduced motion.
4. About 100 simulated visitors try the main tasks. This shows where people with different needs get stuck. They are **simulated**; they are not a substitute for real people.
5. The Security agent looks for risk and says "no" or "not yet".
6. You preview the site locally and say yes.
7. Lilac prints the hosting plan. You run it, or tell Lilac to.

Automated checks cannot judge taste, copy or whether anyone wants the product. For that, ask real people: see [PILOT.md](PILOT.md).

## Posting about your project

`/lilac:docs` creates `product-growth/SHOWCASE.md` with draft posts. Fill in every `[YOUR ...]` with a number you actually measured, or delete the line. Never post a number you did not measure. Check screenshots for customer names, keys and admin screens. If a client owns the project, ask them first.

## Updating and removing

Update: `/plugin marketplace update lilac`, then reinstall if asked. Remove: `/plugin uninstall lilac@lilac`. Remove saved data: `rm -r ~/.lilac`.

## Words used here

| Word | Meaning |
|---|---|
| Skill | A set of instructions for one kind of job (for example, "build a sign-in") |
| Agent | An AI helper with a specific job and limits on what it may do |
| Phase | One of three stages: build, secure, launch |
| Gate | A check that must pass before moving on |
| Evidence | The command that was run and its result |
| Handoff | A summary so the next person (or AI) can continue the work |
| UNKNOWN | Lilac looked and the project does not say. It never guesses |

## If something goes wrong

Run `/lilac:doctor`, then read [TROUBLESHOOTING.md](TROUBLESHOOTING.md). Still stuck: open an issue (the template asks for exactly what we need) or see [SUPPORT.md](../SUPPORT.md). Security problems: [SECURITY.md](../SECURITY.md), never a public issue.
