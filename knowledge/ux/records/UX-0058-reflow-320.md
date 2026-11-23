---
id: UX-0058
title: Content reflows at 320 px wide
kind: principle
domain: accessibility
claim: At 400% zoom no horizontal scrolling should be needed.
guidance: Use fluid layouts; test at 320 CSS px; avoid fixed widths.
evidence: W3C WCAG 2.2, Understanding 1.4.10 Reflow; https://www.w3.org/WAI/WCAG22/Understanding/reflow.html; read 2026-11-21; figure: Level AA: 320 CSS px equals 1280 px at 400%
confidence: high
applies_to: [website, webapp, mobile]
automated_check: qa-browser:overflow
edges: [UX-0006, UX-0059]
---
Checked against 1 source(s) on 2026-11-21.
