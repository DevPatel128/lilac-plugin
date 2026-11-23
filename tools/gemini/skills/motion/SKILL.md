---
name: motion
description: Pick a motion tier (none, subtle, expressive, immersive 3D), then check the motion budget and asset licences.
disable-model-invocation: true
---
# /lilac:motion

Pick the tier, record it as `Motion: <tier>` under Constraints in BRIEF.md, then check.

| Tier | What | Tools | Budget (gzip) |
|---|---|---|---|
| none | focus and hover only | CSS | no motion JS |
| subtle | fades, scroll reveals, same-page view transitions | CSS scroll-driven animation, View Transitions | under 30 KB |
| expressive | scroll storytelling, Lottie or Rive accents | GSAP + ScrollTrigger, Rive, Lottie | under 80 KB, lazy |
| immersive | real-time 3D | Three.js (WebGPU, falls back to WebGL2), model-viewer, Spark | after LCP, poster always |

1. Ask the tier with AskUserQuestion (none / subtle / expressive / immersive). Immersive only when the user picks it.
2. Build with that tier only. Every 3D scene needs: a static poster with alt text, a "Skip 3D" control, keyboard camera controls, autoplay off under `prefers-reduced-motion: reduce`, and a WebGPU, then WebGL2, then poster check. Never make a canvas or model-viewer the first big thing in `<main>`.
3. Every image, model, video and font goes in `assets/LICENSES.md` (file, source, licence, commercial-use yes/no/UNKNOWN, ai-generated yes/no). Record `consent: <reference>` for any AI image of a real person.
4. Run `node scripts/motion-budget.mjs check <dir>` and `node scripts/assets-check.mjs check <dir>`. Fix every FAIL.
5. Ask with AskUserQuestion: Approve / Change something / Stop.
