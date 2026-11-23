---
id: UX-0025
title: Declare what each personal field is for
kind: pattern
domain: forms
claim: The autocomplete attribute lets browsers fill details correctly and tells assistive tech the purpose.
guidance: Add the right autocomplete token (email, tel, postal-code and so on) to every field that collects personal data.
evidence: W3C WCAG 2.2, Understanding 1.3.5 Identify Input Purpose; https://www.w3.org/WAI/WCAG22/Understanding/identify-input-purpose.html; read 2026-11-21; figure: Level AA || GOV.UK Design System, Text Input; https://design-system.service.gov.uk/components/text-input/; read 2026-11-21; figure: autocomplete required where input purpose applies || MDN Web Docs, autocomplete attribute; https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete; read 2026-11-21; figure: tokens such as email, tel, postal-code
confidence: high
applies_to: [website, webapp, mobile]
automated_check: manual
edges: [UX-0024]
---
Checked against 3 source(s) on 2026-11-21.
