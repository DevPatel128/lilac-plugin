---
id: UX-0003
title: Tab bar moves between sections, not actions
kind: pattern
domain: navigation
claim: A tab bar is for moving between top-level sections; actions belong in a toolbar.
guidance: Use bottom tabs only for destinations the user visits often. Keep the bar visible while moving through the app and never disable or hide a tab; explain an empty section instead.
evidence: Apple Human Interface Guidelines, Tab Bars; https://developer.apple.com/design/human-interface-guidelines/tab-bars; read 2026-11-21; figure: tab bars are for navigation not actions; do not hide or disable tabs
confidence: low
applies_to: [mobile]
automated_check: manual
edges: [UX-0002]
---
Note: single source; treat as a prompt to test, not a rule.
