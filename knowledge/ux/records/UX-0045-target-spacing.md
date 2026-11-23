---
id: UX-0045
title: Space between touch targets
kind: principle
domain: mobile
claim: Neighbouring targets need a gap so people do not tap the wrong one.
guidance: Keep at least 8 px (dp) between targets, about 2 mm physically; spacing does not make up for small size.
evidence: Android Accessibility Help, Touch Target Size; https://support.google.com/accessibility/android/answer/7101858; read 2026-11-21; figure: 8 dp or more apart || web.dev, Accessible Tap Targets; https://web.dev/articles/accessible-tap-targets; read 2026-11-21; figure: 8 px spacing || Nielsen Norman Group, Touch Target Size; https://www.nngroup.com/articles/touch-target-size/; read 2026-11-21; figure: about 2 mm between targets
confidence: high
applies_to: [website, webapp, mobile]
automated_check: qa-browser:tap-target
edges: [UX-0044]
---
Checked against 3 source(s) on 2026-11-21.
