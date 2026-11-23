---
id: UX-0048
title: Keyboard focus is always visible
kind: principle
domain: accessibility
claim: Keyboard users must see where they are.
guidance: Keep a clear focus ring on every control, distinct from selected state; do not remove outlines without a stronger replacement.
evidence: W3C WAI-ARIA Authoring Practices, Keyboard Interface; https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/; read 2026-11-21; figure: focus indicator clearly visible, distinct from selection || W3C WCAG 2.2, Understanding 2.4.11 Focus Not Obscured (Minimum); https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html; read 2026-11-21; figure: focused items must not be fully hidden
confidence: high
applies_to: [website, webapp, mobile]
automated_check: qa-browser:focus-invisible
edges: [UX-0049, UX-0050]
---
Checked against 2 source(s) on 2026-11-21.
