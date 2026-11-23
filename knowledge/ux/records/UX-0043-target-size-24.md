---
id: UX-0043
title: Targets at least 24 by 24 CSS pixels
kind: principle
domain: accessibility
claim: Small pointer targets are hard to hit for people with limited dexterity.
guidance: Make every pointer target at least 24 by 24 CSS pixels, or leave a 24 px gap around smaller ones; inline links in text are exempt.
evidence: W3C WCAG 2.2, Understanding 2.5.8 Target Size (Minimum); https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html; read 2026-11-21; figure: Level AA: 24 by 24 CSS px; spacing, equivalent, inline, user-agent and essential exceptions
confidence: high
applies_to: [website, webapp, mobile]
automated_check: qa-browser:tap-target
edges: [UX-0044, UX-0045]
---
Checked against 1 source(s) on 2026-11-21.
