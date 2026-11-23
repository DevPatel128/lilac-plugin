---
id: UX-0052
title: Dialogs move, hold and return focus
kind: pattern
domain: accessibility
claim: A modal moves focus inside, keeps it there, closes on Escape and returns focus.
guidance: Use role dialog with an accessible name; focus first control on open; trap Tab; Escape closes; return focus to the opener.
evidence: W3C WAI-ARIA Authoring Practices, Modal Dialog Pattern; https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/; read 2026-11-21; figure: Tab wraps inside; Escape closes; focus returns to opener
confidence: medium
applies_to: [website, webapp]
automated_check: persona-test:keyboard
edges: [UX-0010, UX-0051]
---
Checked against 1 source(s) on 2026-11-21.
