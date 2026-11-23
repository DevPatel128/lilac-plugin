# Brand kit

<!-- Fill every section, then run: node scripts/foundation.mjs tokens . and node scripts/foundation.mjs check . The Tokens block below is the single source: edit it, never the generated brand/ files. System font stacks, or licensed fonts held as local files (add a "licence:" note), only. -->

## Name check
Atelier Nord is a FICTIONAL sample name. No trademark or company-name search has been done (UNVERIFIED). If this were a real studio, run a trademark search in the owner's country before use; nobody here can say the name is free.

## Voice
Plain, short, dry. No superlatives. Do: "Six sample projects, all invented." Don't: "Award-winning spaces that transform lives." Every name and figure is marked SAMPLE or fictional.

## Wordmark
A square-cut "N" glyph (inline SVG path) next to the plain text "Atelier Nord", set in the sans stack at weight 600. The text is the fallback and the accessible name. The glyph inherits `currentColor`. Clear space: at least the glyph width on each side. `favicon.svg` is the same glyph reversed on a ink or paper square.

## Palette
Near-monochrome paper and ink with one red "correction pencil" accent. Light: bg paper `#f3f1ec`, surface `#eae7e0` (drawing frames), text and primary and link `#151515`, muted `#58554e`, accent `#b83a14` (focus ring, errors, underline, buttons), accent-text white on accent. Dark: bg `#121211`, surface `#1b1b19`, text `#ecebe6`, muted `#a9a69e`, accent `#ff8057`, accent-text `#121211`. The site CSS names these `--bg --tint --ink --muted --accent --accent-ink`. Danger uses the accent; the site has no separate success colour, so `success` is mapped to text colour and unused. The page-load wipe colours (`--wipe`) are site-only and not brand tokens. Contrast is checked by `foundation.mjs check`.

## Typography
Serif stack (Iowan Old Style, Palatino, Georgia) for display headings at weight 400 with tight tracking; system sans for body at 1.0625rem and line height 1.6; mono for sheet labels, uppercase at 0.8125rem with 0.08em tracking. Why: a printed monograph with drawing-office labels. Headline sizes are fluid with `clamp()` in the CSS and are not tokens.

## Spacing
A 12-column grid with fluid gap `clamp(12px,2vw,24px)` and fluid vertical rhythm with `clamp()`. Fixed steps: 8, 16, 24, 32 px for padding and margins. Radius is 0 (square corners, as on a drawing sheet) and there are no shadows; lines are 1 px ink borders.

## Motion
Expressive but accessible. Only transform, opacity, clip-path and stroke-dashoffset animate. Hover and link transitions use the fast to slow tokens (300 to 600 ms). The one-time drawing draw-on (up to 1.6 s with stagger), reveal and page-load wipe (0.9 s) are longer than 600 ms and stay as literals in the CSS; they run once, never loop. Easing: `cubic-bezier(.7,0,.2,1)`. Reduced-motion rule: under `prefers-reduced-motion: reduce` every transition and animation is off, drawings are fully drawn, reveals are visible, parallax is not attached and the wipe is not rendered. No flashing, no continuous animation.

## Imagery
No photographs. Every project is an inline SVG architectural drawing (plan, elevation or section) with hatched walls, thin ink lines and one accent line. Drawings are decorative or described by the surrounding caption; project names and areas are SAMPLE text. No stock images, no people, no real buildings.

## Iconography
No icon set. The only symbol is the "N" glyph in the wordmark (labelled by the adjacent text). Controls carry text labels.

## Accessibility
WCAG AA text contrast (4.5:1, computed in `foundation.mjs check`), skip link, landmarks, visible 3 px focus ring in the accent colour, nav and all reading work without JavaScript, content visible without JavaScript, reduced motion respected, layout works from 360 to 1440 px. Touch target size 44 px: UNVERIFIED for the filter chips and nav links.

## Tokens
Machine-readable. `node scripts/foundation.mjs tokens .` turns this into `brand/tokens.css`, `brand/tokens.json` and `brand/brand-sheet.html`. The site CSS keeps its own `--bg --ink` names and mirrors the duration and easing values as `--duration-*` and `--ease`; these must be kept equal by hand (no automatic sync).

```json tokens
{
  "name": "Atelier Nord (fictional sample)",
  "wordmark": {
    "text": "Atelier Nord",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" role=\"img\" aria-label=\"Atelier Nord\"><path d=\"M3 21V3h4l10 14V3h4v18h-4L7 7v14z\" fill=\"currentColor\"/></svg>"
  },
  "colors": {
    "light": {
      "bg": "#f3f1ec",
      "surface": "#eae7e0",
      "text": "#151515",
      "muted": "#58554e",
      "primary": "#151515",
      "accent": "#b83a14",
      "accent-text": "#ffffff",
      "link": "#151515",
      "danger": "#b83a14",
      "success": "#151515",
      "focus": "#b83a14"
    },
    "dark": {
      "bg": "#121211",
      "surface": "#1b1b19",
      "text": "#ecebe6",
      "muted": "#a9a69e",
      "primary": "#ecebe6",
      "accent": "#ff8057",
      "accent-text": "#121211",
      "link": "#ecebe6",
      "danger": "#ff8057",
      "success": "#ecebe6",
      "focus": "#ff8057"
    }
  },
  "fonts": {
    "sans": "system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif",
    "serif": "\"Iowan Old Style\",\"Palatino Linotype\",Palatino,\"Book Antiqua\",Georgia,serif",
    "mono": "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
  },
  "fontSizes": {
    "sm": "0.8125rem",
    "base": "1.0625rem",
    "lg": "1.3rem"
  },
  "lineHeight": {
    "body": "1.6",
    "heading": "1.05"
  },
  "space": {
    "2": "8px",
    "4": "16px",
    "6": "24px",
    "8": "32px"
  },
  "radius": {
    "none": "0"
  },
  "shadow": {
    "none": "none"
  },
  "duration": {
    "fast": "300ms",
    "base": "450ms",
    "slow": "600ms"
  },
  "easing": {
    "standard": "cubic-bezier(.7,0,.2,1)"
  }
}
```
