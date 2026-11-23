---
id: UX-0009
title: Gestures never the only route
kind: principle
domain: mobile
claim: Swipes and custom gestures must be backed by a visible control.
guidance: Offer a visible button (Back, Close, Delete) for every gesture action, and teach any custom gesture in the interface.
evidence: Apple Human Interface Guidelines, Gestures; https://developer.apple.com/design/human-interface-guidelines/gestures; read 2026-11-21; figure: shortcut gestures should supplement visible controls || W3C WCAG 2.2, Understanding 2.5.7 Dragging Movements; https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html; read 2026-11-21; figure: Level AA: dragging needs a single-pointer alternative
confidence: high
applies_to: [webapp, mobile]
automated_check: controls-test:dead-control
edges: [UX-0063]
---
Checked against 2 source(s) on 2026-11-21.
