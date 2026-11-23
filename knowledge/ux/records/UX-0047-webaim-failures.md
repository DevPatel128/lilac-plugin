---
id: UX-0047
title: Most home pages fail basic checks
kind: principle
domain: accessibility
claim: Large-scale testing finds the same few failures on almost every home page.
guidance: Check first for low contrast, missing alt text, missing form labels, empty links and empty buttons.
evidence: WebAIM, The WebAIM Million (2026 report); https://webaim.org/projects/million/; read 2026-11-21; figure: 2026: 95.9% of home pages had failures; low contrast 83.9%; missing alt 53.1%; missing labels 51%; empty links 46.3%; empty buttons 30.6%; 56.1 errors per page
confidence: medium
applies_to: [website, webapp, mobile]
automated_check: qa:img-alt
edges: [UX-0046, UX-0056, UX-0057]
---
Checked against 1 source(s) on 2026-11-21.
