# The BRIEF prompt

Paste this once. Fill what you know. Lilac asks only for what is empty or vague, and a complete block means zero questions.

```text
B  Business:     <who it's for> | <true facts: name, prices, links, hours>
R  Result:       <the one main action> | <the number that means success>
I  Inspiration:  <site 1: what to take> | <site 2: what to take> | <site 3: what to take>
E  Experience:   <pages> | <signature moment> | variance _ motion _ density _
F  Fences:       <never claim> | <languages, budget, deadline> | severity _ | <host>
```

| Part | Answer this | Weak | Strong |
|---|---|---|---|
| **B** Business | Who it is for, and the true facts | "A site for my band" | "Indie folk duo from Pune, fans 18 to 30, 4 released singles, merch on Shopify" |
| **R** Result | The one action a visitor must take, and the number that means success | "Get more fans" | "Play a song in one click; 500 mailing-list signups in 90 days" |
| **I** Inspiration | 3 sites, and what to take from each | "Make it modern" | "Stripe's pricing table, Bandcamp's track list, Linear's changelog" |
| **E** Experience | Pages, the signature moment, and the dials (1 to 10) | "Cool animations" | "Home, Music, Tour, Merch. Opens on the latest track with a live waveform. variance 6 motion 7 density 3" |
| **F** Fences | What never to claim, limits, severity (1 to 10), host | (left blank) | "No fake tour dates. English and Marathi. severity 6. Cloudflare" |

Four rules

1. Facts you don't have yet: write `SAMPLE`. Lilac never invents them.
2. Name sites, not adjectives. "Like Stripe" beats "clean and modern".
3. One main action. Two main actions means neither wins.
4. Say what not to do. Fences prevent more rework than any other line.

Check a block yourself: `node scripts/brief.mjs block my-brief.txt`. It shows each part as filled, vague or missing, with the questions that remain (up to 4 per screen). `--write <project>` creates `BRIEF.md` and stores the severity. Severity: [`/lilac:severity`](../skills/severity/SKILL.md).
