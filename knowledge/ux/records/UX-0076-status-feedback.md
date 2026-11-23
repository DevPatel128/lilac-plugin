---
id: UX-0076
title: Always show system status
kind: principle
domain: performance
claim: People need to know the system is working.
guidance: Show immediate feedback; use a spinner at 2 to 10 s, percent-done beyond 10 s; skeletons under 10 s.
evidence: Nielsen Norman Group, 10 Usability Heuristics; https://www.nngroup.com/articles/ten-usability-heuristics/; read 2026-11-21; figure: visibility of system status || Nielsen Norman Group, Progress Indicators; https://www.nngroup.com/articles/progress-indicators/; read 2026-11-21; figure: spinner 2-10 s, percent-done 10 s+ || Nielsen Norman Group, Skeleton Screens; https://www.nngroup.com/articles/skeleton-screens/; read 2026-11-21; figure: skeletons under 10 s || Apple Human Interface Guidelines, Loading; https://developer.apple.com/design/human-interface-guidelines/loading; read 2026-11-21; figure: show something right away
confidence: high
applies_to: [website, webapp, mobile]
automated_check: persona-test:impatient
edges: [UX-0039, UX-0075]
---
Checked against 4 source(s) on 2026-11-21.
