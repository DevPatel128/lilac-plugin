---
id: UX-0008
title: Skip link to main content
kind: pattern
domain: navigation
claim: Keyboard users need a way past repeated blocks such as the header and menu.
guidance: Put a visible-on-focus link as the first focusable item that jumps to the main landmark, and test that it really moves focus.
evidence: W3C WCAG 2.2, Understanding 2.4.1 Bypass Blocks; https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html; read 2026-11-21; figure: Level A; technique G1 link at top to main content
confidence: high
applies_to: [website, webapp]
automated_check: qa-browser:skip-link
edges: [UX-0048, UX-0050]
---
Checked against 1 source(s) on 2026-11-21.
