---
id: UX-0030
title: Protect against double submission
kind: pattern
domain: forms
claim: Slow connections lead to double clicks and duplicate submissions.
guidance: Show feedback after submit, disable or ignore repeated clicks, and make the server idempotent.
evidence: GOV.UK Design System, Button; https://design-system.service.gov.uk/components/button/; read 2026-11-21; figure: server-side protection plus loading feedback
confidence: low
applies_to: [website, webapp]
automated_check: manual
edges: [UX-0076]
---
Note: single source; treat as a prompt to test, not a rule.
