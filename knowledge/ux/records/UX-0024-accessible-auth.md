---
id: UX-0024
title: Let people paste and use password managers
kind: principle
domain: forms
claim: Blocking paste or autofill on login forces memory tests that exclude some people.
guidance: Allow paste in password and code fields, support autofill, and offer a non-memory route such as email link or passkey.
evidence: W3C WCAG 2.2, Understanding 3.3.8 Accessible Authentication (Minimum); https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html; read 2026-11-21; figure: Level AA; do not block paste or autofill || MDN Web Docs, autocomplete attribute; https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete; read 2026-11-21; figure: autocomplete tokens current-password, new-password, one-time-code
confidence: high
applies_to: [website, webapp, mobile]
automated_check: manual
edges: [UX-0025]
---
Checked against 2 source(s) on 2026-11-21.
