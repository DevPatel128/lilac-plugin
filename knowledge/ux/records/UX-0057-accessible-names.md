---
id: UX-0057
title: Every control has a name
kind: principle
domain: accessibility
claim: Icon buttons and links with no text are unusable by screen reader or voice users.
guidance: Give every button, link and icon control visible text or an accessible name; label decorative items as such.
evidence: W3C WCAG 2.2, Understanding 1.1.1 Non-text Content; https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html; read 2026-11-21; figure: controls need a name || Android Developers, Principles for Improving App Accessibility; https://developer.android.com/guide/topics/ui/accessibility/principles; read 2026-11-21; figure: label interactive elements || WebAIM, The WebAIM Million (2026 report); https://webaim.org/projects/million/; read 2026-11-21; figure: 46.3% empty links; 30.6% empty buttons
confidence: high
applies_to: [website, webapp, mobile]
automated_check: qa:link-empty
edges: [UX-0031, UX-0056]
---
Checked against 3 source(s) on 2026-11-21.
