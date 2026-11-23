# Funnel: from a first visit to a customer

A website exists so that someone does one thing: buys, books, asks for a demo, sends an enquiry or signs up. A **funnel** is the path a stranger takes to get there. It is called a funnel because fewer people reach each step than the one before.

Lilac asks you to design that path before it builds any page. You answer a few questions in a file called `FUNNEL.md`, and Lilac checks the finished site against your answers. Run it with `/lilac:funnel`.

## The six stages

1. **Aware.** A visitor lands on a page. Their question: "Is this for me?" Answer in one sentence and show one clear button.
2. **Interested.** They look around. Their question: "What exactly do you offer?" Show the offer plainly and keep the next step visible.
3. **Considering.** They compare and doubt. Their question: "Can I trust this, and what does it cost?" Show the price, or how to get one, and your policies.
4. **Ready.** They decide. Their question: "How do I do it, and is it easy?" Keep the form short, labelled and honest about what you ask for.
5. **Done.** They finished. Their question: "Did it work, and what now?" Tell them what happens next and when.
6. **Return.** They come back, or you reach them. Their question: "Who do I ask if something is wrong?" Keep a contact route on every page and say how you will follow up.

For each stage, `FUNNEL.md` records the page, the visitor's question, the content that answers it, the one next action, and the friction to remove.

### Example: a neighbourhood cafe (goal: book a table)

- Aware: the home page says what the cafe is and shows a "Book a table" button.
- Interested: the menu page is one click away and ends with the same button.
- Considering: the visit page has real opening hours, the address and a note on allergens.
- Ready: the booking form asks for name, email, day and number of guests. Four fields.
- Done: the page says "Thanks. We will email you within 1 day to confirm."
- Return: every page has an email link, and the 404 page links back to the home page.

### Example: a small SaaS product (goal: request a demo)

- Aware: the home page says who the product is for and has a "Request a demo" button.
- Interested: a features page shows what it does, in plain words.
- Considering: the pricing page shows the plans, or says "ask for a quote" and states the reply time you can keep.
- Ready: the demo form asks for name, work email and team size. A privacy note sits beside it.
- Done: the confirmation says who will write, and by when.
- Return: a help page and a contact link are in every footer.

## Why Lilac checks structure, not sales

Lilac cannot promise sales. Nobody can, from the files of a website. Whether people buy depends on your offer, your price, your audience and the real world. What Lilac can check is whether the site gets in the way:

- Is the main button visible without hunting, and does it say what it does?
- Is the goal within the click budget (usually 3 clicks or fewer)?
- Does every page have a next step, and a contact route?
- Is the form short, labelled and easy to fix when something is wrong?
- Is there a confirmation that says what happens next and when?
- Is every piece of proof true?

Run `node scripts/funnel.mjs check <project>`. It prints findings by stage, each with a fix and, where one applies, the research record behind it. It exits with an error only for the things that break a funnel: no path to the goal, no confirmation, a dead end, invented proof, or a missing goal control.

Lilac can also rehearse the path with simulated visitors (`funnel.mjs tasks`, then the persona test). They show where a path breaks for someone on a slow phone, using only a keyboard, or with a screen reader. They are not real customers, and Lilac never reports a conversion rate from them.

## What real measurement needs

To learn whether the funnel works you need real visitors:

- **Real traffic.** A handful of visits proves nothing. Wait until you have enough to see a pattern.
- **Privacy-friendly counts.** Count visits and button clicks with a method you host yourself, tell visitors, and keep no personal data you do not need. Measurement is off by default in Lilac. Third-party tracking scripts are flagged.
- **One change at a time.** Change one thing, wait, and compare. If you change five things, you will not know which one mattered.
- **Your own numbers.** The success metric in `FUNNEL.md` has a placeholder. You fill it from real data.

## Honest trust elements: a checklist

Use these, as far as they are true:

- [ ] Clear prices, or "ask for a quote" with a reply time you can keep.
- [ ] Policies you follow: refunds, cancellation, delivery.
- [ ] A real way to reach a person: email, phone or address.
- [ ] A privacy note beside every form that asks for personal details.
- [ ] Real, sourced proof only: who said it, when, and a link.

Never use these unless they are real and sourced:

- [ ] Invented reviews or testimonials.
- [ ] Star ratings you did not collect.
- [ ] "Trusted by" logos of companies that never agreed.
- [ ] Customer counts such as "10,000 happy customers" with no source.
- [ ] Awards you did not win.

A demo or sample site may show made-up examples if each one is marked SAMPLE. The check flags anything else.

## Where to go next

- [USER-GUIDE.md](USER-GUIDE.md) for the whole Lilac flow.
- [PROMPTING.md](PROMPTING.md) for how to ask for what you want.
- [FOUNDATION.md](FOUNDATION.md) for the step before the funnel.
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) if a check fails and you are stuck.
