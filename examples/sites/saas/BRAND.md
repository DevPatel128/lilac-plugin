# Brand kit

Tasklane is FICTIONAL. This kit styles a demo landing site. Values below were read from `site/assets/styles.css` and the brief's three moods (printed engineering drawing, transit map, field notebook).

## Name check
"Tasklane" is an invented name for a fictional product. It has not been searched anywhere, so do not assume it is free to use. Before using a name for a real product, run a trademark search in your country and a domain check. This kit does not say the name is available.

## Voice
Direct, short, plain. Says "sample" and "fictional" where relevant.
- Do: "Sample price. Nothing here is real."
- Don't: "Trusted by thousands of teams." (invented claim, never used)

## Wordmark
A square mark of three horizontal bars (orange, lime, teal) on near-black ink, with the plain text "Tasklane" beside it (also the text fallback). The same mark is `site/favicon.svg`. Keep one bar-height of clear space around it; do not recolour the bars.

## Palette
Roles, light then dark:
- bg: page background (`#f5f6f1` / `#0b1519`); surface: cards and panels (`#ffffff` / `#121f25`)
- text: body and headings (`#0d1b21` / `#eef4ef`); muted: secondary text (`#44545b` / `#a9b9bd`)
- accent and primary: the one signal colour, buttons and rules (`#c2410c` / `#ff8a5b`); accent-text sits on it (`#ffffff` / `#0b1519`)
- link: links are the text colour, underlined; danger: form error text (`#a8350a` / `#ff8a5b`); success: done state (teal `#0b6e69` / `#4fd1c5`)
- focus: 3 px outline (`#0b57d0` / `#7db0ff`)
- Extras: teal and lime lane colours, soft lane background, line for borders (dark line `#7a959e` so borders pass 3:1).
Contrast numbers are computed by `foundation.mjs check` and printed on `brand/brand-sheet.html`.

## Typography
System font stacks only (sans for text, mono for eyebrow labels and tags). Headings are heavy (800), tight line height 1.05, slightly negative tracking; body 1.0625rem at line height 1.6. Sizes use clamp() so they scale between 360 and 1440 px. Why: no remote font request, no licence question.

## Spacing
Rem-based scale from 0.25 to 3 rem. Square corners everywhere (radius none) to match the engineering-drawing mood. Elevation is one hard offset shadow (`4px 4px 0` in the text colour, accent colour in dark mode), never blurred.

## Motion
Expressive but accessible. Only transform and opacity animate. Durations: press 120 ms, fast 250 ms, base 300 ms, nav 380 ms, slow 600 ms (maximum), with one ease-out curve. Reduced motion: with `prefers-reduced-motion: reduce` all transitions are removed, reveal content is visible at once, the kanban loop does not start and its Pause button is hidden. The looping board has a Pause/Play control.

## Imagery
No photos and no stock images. The only pictures are inline SVG: the logo mark, the kanban mock built from HTML and CSS, and small line icons. No og:image exists (no source art).

## Iconography
Inline SVG, square line style, 2 to 3 px stroke, drawn in `currentColor`. Icons are decorative (`aria-hidden`) and always sit next to a text label.

## Accessibility
Commitments from the brief: WCAG AA, text contrast 4.5:1, border contrast 3:1, visible focus, skip link and landmarks, 48 px minimum height on buttons and form controls, reduced motion respected, content readable without JavaScript. Screen-reader testing has not been done: UNVERIFIED.

## Tokens
Machine-readable. `node scripts/foundation.mjs tokens .` turns this into `brand/tokens.css`, `brand/tokens.json` and `brand/brand-sheet.html`.

```json tokens
{
  "name": "Tasklane",
  "wordmark": {
    "text": "Tasklane",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 32 32\" role=\"img\" aria-label=\"Tasklane\"><rect width=\"32\" height=\"32\" fill=\"#0d1b21\"/><rect x=\"5\" y=\"6\" width=\"22\" height=\"5\" fill=\"#ff8a5b\"/><rect x=\"5\" y=\"14\" width=\"15\" height=\"5\" fill=\"#d5f25c\"/><rect x=\"5\" y=\"22\" width=\"9\" height=\"5\" fill=\"#4fd1c5\"/></svg>"
  },
  "colors": {
    "light": {
      "bg": "#f5f6f1",
      "surface": "#ffffff",
      "text": "#0d1b21",
      "muted": "#44545b",
      "primary": "#c2410c",
      "accent": "#c2410c",
      "accent-text": "#ffffff",
      "link": "#0d1b21",
      "danger": "#a8350a",
      "success": "#0b6e69",
      "focus": "#0b57d0",
      "teal": "#0b6e69",
      "lime": "#d5f25c",
      "soft": "#dfe4dc",
      "line": "#0d1b21"
    },
    "dark": {
      "bg": "#0b1519",
      "surface": "#121f25",
      "text": "#eef4ef",
      "muted": "#a9b9bd",
      "primary": "#ff8a5b",
      "accent": "#ff8a5b",
      "accent-text": "#0b1519",
      "link": "#eef4ef",
      "danger": "#ff8a5b",
      "success": "#4fd1c5",
      "focus": "#7db0ff",
      "teal": "#4fd1c5",
      "lime": "#d5f25c",
      "soft": "#1b2c33",
      "line": "#7a959e"
    }
  },
  "fonts": {
    "sans": "ui-sans-serif,system-ui,-apple-system,\"Segoe UI\",Roboto,\"Helvetica Neue\",Arial,sans-serif",
    "mono": "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
  },
  "fontSizes": {
    "sm": "0.8rem",
    "base": "1.0625rem",
    "lg": "1.3rem",
    "xl": "clamp(1.9rem,4.4vw,3.1rem)",
    "2xl": "clamp(2.5rem,7.2vw,5.25rem)"
  },
  "lineHeight": {
    "body": "1.6",
    "heading": "1.05"
  },
  "space": {
    "1": "0.25rem",
    "2": "0.5rem",
    "3": "0.75rem",
    "4": "1rem",
    "6": "1.5rem",
    "8": "2rem",
    "12": "3rem"
  },
  "radius": {
    "none": "0"
  },
  "shadow": {
    "hard": "4px 4px 0 var(--color-text)"
  },
  "duration": {
    "press": "120ms",
    "fast": "250ms",
    "base": "300ms",
    "nav": "380ms",
    "slow": "600ms"
  },
  "easing": {
    "standard": "cubic-bezier(.2,.8,.2,1)"
  }
}
```
