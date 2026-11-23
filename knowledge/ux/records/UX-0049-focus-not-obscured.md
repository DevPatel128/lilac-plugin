---
id: UX-0049
title: Sticky bars must not hide the focused item
kind: principle
domain: accessibility
claim: A sticky header or banner can cover the element that has focus.
guidance: Add scroll padding for sticky bars and test the Tab walk-through.
evidence: W3C WCAG 2.2, Understanding 2.4.11 Focus Not Obscured (Minimum); https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html; read 2026-11-21; figure: Level AA 2.4.11
confidence: high
applies_to: [website, webapp, mobile]
automated_check: persona-test:keyboard
edges: [UX-0006, UX-0048]
---
Checked against 1 source(s) on 2026-11-21.
