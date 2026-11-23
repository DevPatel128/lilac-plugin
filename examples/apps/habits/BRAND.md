# Brand kit

<!-- Tokens block below is the single source: edit it, never the generated brand/ files. Values are copied from site/app.css (:root and the dark blocks). -->
Pocket Habits is a FICTIONAL SAMPLE product built as a Lilac web-app example. Status: approval pending owner.

## Name check
"Pocket Habits" is a sample name only. No trademark search has been done: UNVERIFIED. Before any real use, search the trademark registers in your country. This kit never claims the name is free to use.

## Voice
Quiet, plain, a little warm. Do: "Add your first habit." "Saved in this browser only." Do say "sample" where text is invented. Don't: "Build better habits!" or any health, wellbeing, productivity or user-count claim (see BRIEF.md "Must not claim").

## Wordmark
A 32 by 32 rounded square in the accent colour with a white tick (inline SVG in `site/index.html`), followed by the text "Pocket Habits". The text name is the fallback and is always present. Keep at least 8 px clear space. Icons for install are `site/icon.svg` and `site/icon-maskable.svg`.

## Palette
Light and dark sets live in the tokens block. Roles: primary and link are the same value as accent (the app has one accent colour); success is the green habit colour (the app shows no separate success state). bg (page), surface (cards, dialogs), surface2 (callouts, hover), text (ink), muted (secondary text), line (borders), accent (primary buttons, links, active nav), accent-text (text on accent), danger, focus (3 px focus ring). Eight habit colours (violet, teal, rose, amber, green, blue, slate, orange) are palette ids stored in data, never CSS values. Heat-map steps h1 to h4 plus h-future shade the 8-week grid. Contrast figures per pair are in BUILD-LOG.md (Reviewer table).

## Typography
System font stacks only, no web fonts and no external font requests: that keeps the strict CSP (`font-src 'self'`), costs zero bytes and loads instantly. Body 1rem with 1.5 line height, small text 0.875rem, h2 1.5rem on phones. Monospace only for keyboard-key hints.

## Spacing
Base unit about 0.25rem; common steps 0.5, 0.75, 1 and 1.5rem; page side gutter 16 px. Radius 12 px for cards (var --radius), 10 px for buttons and inputs, 16 px for dialogs. Minimum touch target 44 px (var --tap). One toast shadow only; cards use borders, not shadows.

## Motion
Subtle. Transform and opacity only: list item enter, tick pop, toast slide, dialog fade, bar grow, FAQ plus rotation. Durations 150 to 500 ms (tokens below), ease-out. Reduced-motion rule: under `prefers-reduced-motion: reduce` and under Settings > Motion > Always off, all animation and transition are switched off. No flashing.

## Imagery
No photographs and no stock images. The only graphics are inline SVG: the logo, the habit tick marks and the charts. Every chart has a text alternative and a data table.

## Iconography
No icon font and no icon set. The few symbols (tick, plus sign, check in a colour chip) are text characters or inline SVG, always next to a text label or with an accessible name.

## Accessibility
WCAG 2.2 AA target: text contrast at least 4.5:1 in light and dark, focus always visible (3 px ring), touch targets at least 44 px, full keyboard use, aria-live announcements, reduced motion respected, colour is never the only signal (ticks carry a check mark). Not yet checked with a screen reader: UNVERIFIED.

## Tokens
Machine-readable. `node operations/plugin/scripts/foundation.mjs tokens <folder>` turns this into `brand/tokens.css`, `brand/tokens.json` and `brand/brand-sheet.html`. The app itself reads the same values from its own custom properties in `site/app.css` (the CSP and the `site/` upload folder keep `brand/` out of the app).

```json tokens
{
  "name": "Pocket Habits",
  "wordmark": {
    "text": "Pocket Habits",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 220 48\" role=\"img\" aria-label=\"Pocket Habits\"><text x=\"0\" y=\"34\" font-family=\"system-ui, sans-serif\" font-size=\"32\" font-weight=\"700\" fill=\"currentColor\">Pocket Habits</text></svg>"
  },
  "colors": {
    "light": {
      "bg": "#faf8ff", "surface": "#ffffff", "surface2": "#f0ecfb", "text": "#1d1b26", "muted": "#55526b", "line": "#cfc9e6",
      "primary": "#5b3fd1", "link": "#5b3fd1", "success": "#2c7a31", "accent": "#5b3fd1", "accent-text": "#ffffff", "danger": "#b3261e", "focus": "#1c4fd8",
      "c-violet": "#5b3fd1", "c-teal": "#0e7a78", "c-rose": "#c2255c", "c-amber": "#9a5200", "c-green": "#2c7a31", "c-blue": "#1c64c4", "c-slate": "#55607a", "c-orange": "#bf3d0c",
      "h1": "#e4dcff", "h2": "#bba8ff", "h3": "#7a5ce6", "h4": "#4b30b8", "h-future": "#f0ecfb"
    },
    "dark": {
      "bg": "#14121b", "surface": "#1e1b29", "surface2": "#292538", "text": "#efecf8", "muted": "#b0acc6", "line": "#46405c",
      "primary": "#b9a6ff", "link": "#b9a6ff", "success": "#7bd88f", "accent": "#b9a6ff", "accent-text": "#14121b", "danger": "#ff9a92", "focus": "#9bbcff",
      "c-violet": "#b9a6ff", "c-teal": "#4fd1c5", "c-rose": "#ff8fb1", "c-amber": "#ffb74d", "c-green": "#7bd88f", "c-blue": "#7db7ff", "c-slate": "#a9b4cf", "c-orange": "#ff9b6b",
      "h1": "#3a3158", "h2": "#5a479a", "h3": "#8d75e8", "h4": "#cbbdff", "h-future": "#23202f"
    }
  },
  "fonts": {
    "sans": "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
    "mono": "ui-monospace, Menlo, monospace"
  },
  "fontSizes": { "xs": "0.75rem", "sm": "0.875rem", "base": "1rem", "lg": "1.25rem", "xl": "1.5rem" },
  "lineHeight": { "body": "1.5", "heading": "1.2" },
  "space": { "1": "0.25rem", "2": "0.5rem", "3": "0.75rem", "4": "1rem", "6": "1.5rem", "8": "2rem" },
  "radius": { "sm": "8px", "md": "10px", "lg": "12px", "xl": "16px" },
  "shadow": { "toast": "0 6px 20px rgba(0,0,0,0.3)" },
  "duration": { "fast": "150ms", "dialog": "200ms", "base": "250ms", "enter": "300ms", "slow": "500ms" },
  "easing": { "out": "ease-out" }
}
```
