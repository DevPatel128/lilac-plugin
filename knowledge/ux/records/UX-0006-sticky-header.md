---
id: UX-0006
title: Keep sticky headers small
kind: pattern
domain: navigation
claim: A sticky header costs screen space and can cover content, so it must stay compact and opaque.
guidance: Use a sticky header only if people truly need it. Keep it short, opaque, high contrast and without animation; on phones let it reappear when scrolling up.
evidence: Nielsen Norman Group, Sticky Headers; https://www.nngroup.com/articles/sticky-headers/; read 2026-11-21; figure: tap targets at least 1 cm by 1 cm; text around 16 pt
confidence: low
applies_to: [website, webapp, mobile]
automated_check: qa-browser:focus-order
edges: [UX-0049, UX-0058]
conflicts_with: [UX-0049]
---
Note: single source; treat as a prompt to test, not a rule.
