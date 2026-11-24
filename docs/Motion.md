# Motion and 3D

Lilac sets motion by tier. Put `Motion: none | subtle | expressive | immersive` under Constraints in BRIEF.md.

| Tier | Allowed | Motion JS budget (gzip) |
|---|---|---|
| none | focus and hover, CSS only | 0 |
| subtle | fades, scroll reveals, view transitions (CSS) | 30 KB |
| expressive | GSAP + ScrollTrigger, Lottie, Rive | 80 KB |
| immersive | Three.js, model-viewer, Spark, loaded after LCP | 600 KB (Lilac default, adjustable in `motion-budget.mjs`) |

Run: `node scripts/motion-budget.mjs check <dir> [--tier ...]` and `node scripts/assets-check.mjs check <dir>`. Exit 1 means fix before preview.

**motion-budget** sums gzip size of local motion libraries it recognises by name or import. It fails over budget, on any motion JS at tier none, and, whenever 3D is present, on a missing poster with alt, "Skip 3D" control, keyboard camera controls, reduced-motion handling, WebGPU to WebGL2 to poster check, or a canvas/model-viewer as the first big element in `<main>`.

**assets-check** needs `assets/LICENSES.md` with a table `file | source | licence | commercial-use | ai-generated | notes` covering every media, model and font file. It fails on unlisted files, UNKNOWN licences at commercial sites (the default; write `Commercial: no` in the brief to change it), AI assets from a free Tripo tier, and AI images of real people without `consent: <reference>`.

Not covered: CDN libraries (size UNKNOWN, reported as a note), real frame rate, and whether a licence text is actually true.
