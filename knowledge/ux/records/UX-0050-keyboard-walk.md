---
id: UX-0050
title: Everything works with the keyboard alone
kind: principle
domain: accessibility
claim: All functions must be reachable in a logical Tab order, matching the visual order.
guidance: Use real buttons and links, keep DOM order equal to reading order, avoid positive tabindex.
evidence: W3C WAI-ARIA Authoring Practices, Keyboard Interface; https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/; read 2026-11-21; figure: DOM order sets tab order; avoid positive tabindex
confidence: medium
applies_to: [website, webapp, mobile]
automated_check: persona-test:keyboard
edges: [UX-0008, UX-0048, UX-0051]
---
Checked against 1 source(s) on 2026-11-21.
