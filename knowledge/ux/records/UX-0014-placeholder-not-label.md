---
id: UX-0014
title: Placeholder text is not a label
kind: principle
domain: forms
claim: Hint text that disappears when typing, and often fails contrast, cannot replace a label.
guidance: Put examples and format hints in visible hint text under the label, not in the placeholder.
evidence: GOV.UK Design System, Text Input; https://design-system.service.gov.uk/components/text-input/; read 2026-11-21; figure: placeholders disappear, are skipped by some screen readers, and often fail contrast || Nielsen Norman Group, Web Form Design Guidelines; https://www.nngroup.com/articles/web-form-design/; read 2026-11-21; figure: skip placeholder text || Apple Human Interface Guidelines, Text Fields; https://developer.apple.com/design/human-interface-guidelines/text-fields; read 2026-11-21; figure: placeholder text disappears once people type
confidence: high
applies_to: [website, webapp, mobile]
automated_check: qa:form-label
edges: [UX-0013]
---
Checked against 3 source(s) on 2026-11-21.
