---
id: UX-0044
title: Aim for 44 to 48 on touch, 24 is a floor
kind: principle
domain: mobile
claim: Platform guides recommend larger touch targets than the web floor.
guidance: Make primary touch targets at least 44 pt (iOS default) to 48 dp or px (Android and Chrome), larger for main calls to action.
evidence: Apple Human Interface Guidelines, Buttons; https://developer.apple.com/design/human-interface-guidelines/buttons; read 2026-11-21; figure: hit region at least 44 by 44 pt || Apple Human Interface Guidelines, Accessibility; https://developer.apple.com/design/human-interface-guidelines/accessibility; read 2026-11-21; figure: iOS default 44 pt, minimum 28 pt || Android Developers, Accessibility API Defaults in Compose; https://developer.android.com/develop/ui/compose/accessibility/api-defaults; read 2026-11-21; figure: minimum 48 dp || web.dev, Accessible Tap Targets; https://web.dev/articles/accessible-tap-targets; read 2026-11-21; figure: 48 by 48 px || Nielsen Norman Group, Touch Target Size; https://www.nngroup.com/articles/touch-target-size/; read 2026-11-21; figure: about 1 cm by 1 cm
confidence: high
applies_to: [website, webapp, mobile]
automated_check: qa-browser:tap-target
edges: [UX-0043, UX-0045, UX-0083]
---
Checked against 5 source(s) on 2026-11-21.
