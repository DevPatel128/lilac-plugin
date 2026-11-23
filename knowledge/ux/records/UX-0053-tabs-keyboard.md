---
id: UX-0053
title: Tabs use arrow keys inside, Tab to leave
kind: pattern
domain: accessibility
claim: A tab list is one stop in the Tab order; arrows move between tabs.
guidance: Use roving tabindex: active tab 0, others -1; arrow keys move; Tab enters the panel.
evidence: W3C WAI-ARIA Authoring Practices, Tabs Pattern; https://www.w3.org/WAI/ARIA/apg/patterns/tabs/; read 2026-11-21; figure: arrow keys move between tabs; Tab moves to panel || W3C WAI-ARIA Authoring Practices, Keyboard Interface; https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/; read 2026-11-21; figure: one item of a composite widget in the tab sequence
confidence: high
applies_to: [website, webapp]
automated_check: persona-test:keyboard
edges: [UX-0050]
---
Checked against 2 source(s) on 2026-11-21.
