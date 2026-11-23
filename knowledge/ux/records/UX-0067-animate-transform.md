---
id: UX-0067
title: Animate transform and opacity
kind: pattern
domain: motion
claim: Animating layout properties causes shifts and jank.
guidance: Animate transform and opacity only.
evidence: web.dev, Cumulative Layout Shift; https://web.dev/articles/cls; read 2026-11-21; figure: use transform instead of top or left
confidence: medium
applies_to: [website, webapp, mobile]
automated_check: qa:layout-animation
edges: [UX-0074]
---
Checked against 1 source(s) on 2026-11-21.
