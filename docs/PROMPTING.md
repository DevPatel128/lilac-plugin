# How to write the prompt that gets the best website

For anyone using Lilac. No coding knowledge needed. Short version: type `/lilac:brief` and answer 8 questions. This page explains why that works and how to do it by hand.

## Why prompts fail

- **Too short.** "Make me a café website" leaves out who it is for, so the AI guesses.
- **Vague words.** "Modern and clean" means something different to everyone.
- **No facts.** The AI fills the gap with made-up opening hours, awards and reviews.
- **No limits.** Nothing says what not to do, so it does too much.
- **Everything at once.** Ten changes in one message, and none is done well.

## The 8 ingredients

1. **Who it is for.** One group, described like a person.
2. **The one main action.** What must a visitor be able to do?
3. **What is true.** Real facts. Or say: "use placeholders marked SAMPLE".
4. **What not to claim.** No awards, no health claims, no prices you have not set.
5. **Tone, with 3 websites.** Say what you like or dislike in each.
6. **Pages needed.** Name them.
7. **Limits.** Languages, budget, deadline, accessibility needs, and motion: none, subtle or expressive.
8. **Hosting and success.** Where it lives (Cloudflare is the default; code is always on GitHub) and how you will know it worked.

## Before and after, five industries

| Industry | Before | After |
|---|---|---|
| Neighbourhood café | "Make a modern café website." | "Site for locals within a 10 minute walk. One action: see the menu and opening hours, then walk in. Facts: Corner Cup, 12 Mill Lane, open 7am to 3pm Mon to Sat. Do not claim 'best coffee'. Tone like [site A] (big photos) not [site B] (pop-ups). Pages: Home, Menu, Visit. Motion: subtle." |
| SaaS landing page | "Landing page for my app, professional." | "For small-shop owners who track stock in spreadsheets. One action: start the free trial. Use SAMPLE for customer counts and quotes. Do not claim savings numbers. Tone like [site A] (plain headline, one screenshot). Pages: Home, Pricing. Motion: none." |
| Architecture studio portfolio | "Portfolio site, stunning." | "For families planning a home build. One action: send an enquiry. Facts: 4 projects with photos I will supply. Do not name clients without consent. Tone like [site A] (large images, little text). Pages: Home, Projects, Studio, Contact. Motion: expressive on images only, with a reduced-motion option." |
| Yoga studio | "Calm yoga website, nice." | "For beginners within 5 km. One action: book a first class. Facts: class times and prices from my list. Do not claim health or medical benefits. Tone like [site A] (soft colours, short lines). Pages: Home, Classes, Teachers, Book. Large text and keyboard use required. Motion: subtle." |
| Dog-food shop | "Online shop for dog food, best quality." | "For owners of dogs with allergies. One action: find a food for my dog and buy it. Facts: 12 products, ingredients and weights from the labels. Do not claim 'vet approved' or 'cures allergies'. Tone like [site A] (clear filters). Pages: Home, Shop, Product, About. Motion: none." |

## Tactics

1. **Give real content, or ask for SAMPLE placeholders.** Lilac marks invented text `SAMPLE` so nothing fake goes live by mistake.
2. **Name the one action.** A page with one clear job beats a page with five.
3. **Give 3 references and say what you like in each.** "I like the big photos on this one" beats "make it modern".
4. **Set limits.** Budget, deadline, languages, number of pages.
5. **Say what not to claim.** Awards, years in business, reviews and numbers need a source.
6. **Choose motion and accessibility.** Motion is none, subtle or expressive. Say if you need large text, keyboard use or screen-reader support.
7. **Ask for a plan first, and approve it.** Nothing is built until you say yes.
8. **Build one page at a time, then change it.** Home first. Then the next page. Small changes land better.
9. **Ask for the reports.** "Show me the simulated-visitor report and the QA report."
10. **Keep a changelog.** Ask Lilac to note every change and why, so you can undo one.

## Copy-and-paste template prompt

```text
/lilac:lilac Build a website.
Audience: <who it is for>
Main action: <the one thing a visitor must do>
Facts (real only, or "use placeholders marked SAMPLE"): <list>
Must not claim: <list>
Tone: <words>. I like <site 1> because <why>. I like <site 2> because <why>. I dislike <site 3> because <why>.
Pages: <list>
Limits: languages <...>, budget <...>, deadline <...>, accessibility <...>, motion <none|subtle|expressive>
Hosting: <Cloudflare is the default>. Code on GitHub.
Success: <a number I can measure>
First show me a plan. Wait for my yes. Then build one page at a time. Show the simulated-visitor and QA reports. Keep a changelog.
```

## Prompts that fail, and why

| Prompt | Why it fails | Fix |
|---|---|---|
| "Make it modern and clean." | No one can check "modern". | Name a site and what you like in it. |
| "Make the best website." | No goal, no limit. | Name the one action and a number. |
| "Add 15 years in business and awards." | Facts you did not give a source for. | Give the real fact, or mark it SAMPLE. |
| "Something like Apple." | Apple has hundreds of pages. | Name one page and what you like. |
| "Build everything now." | Too much to check. | Plan first, then one page at a time. |
| "Use whatever hosting." | A choice about money and accounts is yours. | Say Cloudflare (default) or another host. |

## What Lilac does for you automatically

- Runs the brief interview (`/lilac:brief`) and checks it.
- Asks where to host (`/lilac:hosting`). It never deploys without your yes.
- Shows a preview before anything is published.
- Runs QA and a real-browser pass (`/lilac:qa`).
- Runs simulated visitors who try your main action.
- Runs security checks.

More: [USER-GUIDE.md](USER-GUIDE.md) and [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
