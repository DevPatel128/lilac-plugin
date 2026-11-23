---
id: UX-0059
title: Text can grow to 200 percent and more
kind: principle
domain: accessibility
claim: People enlarge text; layouts must survive it and survive spacing overrides.
guidance: Use relative units, never block zoom, and test 200% and the WCAG spacing values.
evidence: W3C WCAG 2.2, Understanding 1.4.4 Resize Text; https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html; read 2026-11-21; figure: Level AA 200% || W3C WCAG 2.2, Understanding 1.4.12 Text Spacing; https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html; read 2026-11-21; figure: line 1.5, paragraph 2, letter 0.12, word 0.16 || Apple Human Interface Guidelines, Accessibility; https://developer.apple.com/design/human-interface-guidelines/accessibility; read 2026-11-21; figure: at least 200 percent
confidence: high
applies_to: [website, webapp, mobile]
automated_check: persona-test:low-vision
edges: [UX-0058]
---
Checked against 3 source(s) on 2026-11-21.
