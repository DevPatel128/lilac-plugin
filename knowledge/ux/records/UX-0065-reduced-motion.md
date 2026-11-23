---
id: UX-0065
title: Honour the reduce-motion setting
kind: principle
domain: motion
claim: Large movement can cause dizziness or nausea.
guidance: Add prefers-reduced-motion override; swap zoom and slide for fades; skip auto-play.
evidence: MDN Web Docs, prefers-reduced-motion; https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion; read 2026-11-21; figure: vestibular concern || Apple Human Interface Guidelines, Accessibility; https://developer.apple.com/design/human-interface-guidelines/accessibility; read 2026-11-21; figure: reduce zoom, scale and peripheral motion || W3C WCAG 2.2, Understanding 2.3.3 Animation from Interactions; https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html; read 2026-11-21; figure: Level AAA: allow turning off
confidence: high
applies_to: [website, webapp, mobile]
automated_check: qa-browser:reduced-motion
edges: [UX-0066, UX-0067]
---
Checked against 3 source(s) on 2026-11-21.
