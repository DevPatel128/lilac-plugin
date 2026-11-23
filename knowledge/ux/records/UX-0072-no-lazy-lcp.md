---
id: UX-0072
title: Do not lazy-load the main image
kind: pattern
domain: performance
claim: Lazy loading the hero delays the main content.
guidance: Use eager loading and fetchpriority high for the single hero image only.
evidence: web.dev, Optimize Largest Contentful Paint; https://web.dev/articles/optimize-lcp; read 2026-11-21; figure: never lazy-load LCP image
confidence: medium
applies_to: [website, webapp]
automated_check: manual
edges: [UX-0071]
---
Checked against 1 source(s) on 2026-11-21.
