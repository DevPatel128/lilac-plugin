---
id: UX-0051
title: Focus never gets stuck
kind: principle
domain: accessibility
claim: If focus can enter a component, it can leave by keyboard.
guidance: Test every widget with Tab and Escape.
evidence: W3C WCAG 2.2, Understanding 2.1.2 No Keyboard Trap; https://www.w3.org/WAI/WCAG22/Understanding/no-keyboard-trap.html; read 2026-11-21; figure: Level A
confidence: high
applies_to: [website, webapp, mobile]
automated_check: qa-browser:focus-trap
edges: [UX-0052]
---
Checked against 1 source(s) on 2026-11-21.
