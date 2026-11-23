# Brand kit

Brand kit of the fictional Corner Kiln demo cafe, written from the existing CSS and the brief. Approval is pending owner.

<!-- Fill every section, then run: node scripts/foundation.mjs tokens . and node scripts/foundation.mjs check . The Tokens block below is the single source: edit it, never the generated brand/ files. System font stacks, or licensed fonts held as local files (add a "licence:" note), only. -->

## Name check
Corner Kiln is a fictional sample name. No trademark search has been done. Before any real use, search your country's trademark register; this kit does not say the name is free.

## Voice
Warm, plain, short. Do: "Come in, the oven is on." Say "sample" wherever a fact is invented. Don't: claim reviews, awards, health, allergen safety or sourcing. Allergens: only "ask the team".

## Wordmark
Italic serif text "Corner Kiln" beside a small kiln-arch mark (two arches, kiln colour and background colour). The text name is the fallback. Keep at least the mark's own width clear around it. The favicon is the same arch on a rounded kiln-coloured square.

## Palette
Warm paper background and one hot kiln colour. Light: `bg` paper, `surface` cards, `text` dark brown ink, `muted` secondary text, `primary` and `link` deep kiln red, `accent` kiln orange for buttons and the current nav item, `accent-text` text on accent, `danger` form errors, `focus` the focus ring. Dark swaps every role to a lighter or darker value. `success` is defined but unused on the site today. Contrast numbers are on the generated brand sheet.

## Typography
Serif stack (Iowan Old Style, Palatino, Georgia) for display and body; system sans for UI, labels, prices and forms. Body 1.0625rem at line-height 1.65; headings use `clamp()` so they scale from 360 to 1440 px. System fonts only: no extra requests.

## Spacing
Spacing, radius and shadow tokens are the generated scale in the tokens block. The site itself uses `rem` and `clamp()` values and one signature irregular "hand-cut" corner radius (`--wob`) on cards, buttons and chips.

## Motion
Expressive but accessible. Only transform, opacity and stroke-dashoffset animate. Transitions use the duration tokens (150 to 500 ms). Three continuous ambient loops (steam 4 s, loaf 6 s, today badge ring 1.4 s once) are longer than the 600 ms token limit by design: they are decoration, can be stopped with the Pause motion button, and no loop flashes. Reduced-motion rule: when the visitor asks for reduced motion, all animation and transitions are removed, content shows in its final state and the pause button is hidden.

## Imagery
No photos. Inline SVG illustration only (cup with steam, proving loaf, kiln arch), drawn with flat shapes and the brand colours. Decorative SVGs are `aria-hidden`; no stock clichés.

## Iconography
No icon set. The only symbols are the decorative kiln-arch mark and steam art; every control has a visible text label.

## Accessibility
Commitments: WCAG 2.2 AA, text contrast 4.5:1 in light and dark, visible focus ring, reduced motion respected, touch targets 44 px or more, skip link, landmarks, content readable without JavaScript. Screen reader and real-device passes are UNVERIFIED.

## Tokens
Machine-readable. `node scripts/foundation.mjs tokens .` turns this into `brand/tokens.css`, `brand/tokens.json` and `brand/brand-sheet.html`.

## Found in the existing CSS
Light custom properties:
- `--bg: #f6ecdc`
- `--paper: #fbf5ea`
- `--ink: #2b1d16`
- `--muted: #5b4638`
- `--line: #c9b49a`
- `--kiln: #b4421f`
- `--kiln-ink: #fff8ee`
- `--kiln-deep: #7a2a12`
- `--flour: #e9d8bd`
- `--today: #f1d9b5`
- `--serif: "Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif`
- `--sans: system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`
- `--wob: 255px 18px 225px 18px/18px 225px 18px 255px`

Dark custom properties:
- `--bg: #1c1411`
- `--paper: #271b16`
- `--ink: #f3e6d2`
- `--muted: #cdb9a2`
- `--line: #5d473a`
- `--kiln: #e8845a`
- `--kiln-ink: #1c1411`
- `--kiln-deep: #f0a27f`
- `--flour: #3a2a22`
- `--today: #4a3226`

```json tokens
{
  "name": "Corner Kiln",
  "wordmark": {
    "text": "Corner Kiln",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 64 64\" role=\"img\" aria-label=\"Corner Kiln\"><path d=\"M8 56V34a24 24 0 0 1 48 0v22z\" fill=\"currentColor\"/><path d=\"M22 56V40a10 10 0 0 1 20 0v16z\" fill=\"#ffffff\"/></svg>"
  },
  "colors": {
    "light": {
      "bg": "#f6ecdc",
      "surface": "#fbf5ea",
      "text": "#2b1d16",
      "muted": "#5b4638",
      "primary": "#7a2a12",
      "accent": "#b4421f",
      "accent-text": "#fff8ee",
      "link": "#7a2a12",
      "danger": "#a31d16",
      "success": "#2e6b3a",
      "focus": "#b4421f"
    },
    "dark": {
      "bg": "#1c1411",
      "surface": "#271b16",
      "text": "#f3e6d2",
      "muted": "#cdb9a2",
      "primary": "#f0a27f",
      "accent": "#e8845a",
      "accent-text": "#1c1411",
      "link": "#f0a27f",
      "danger": "#ffb4ab",
      "success": "#8fd19e",
      "focus": "#e8845a"
    }
  },
  "fonts": {
    "sans": "system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif",
    "serif": "\"Iowan Old Style\",\"Palatino Linotype\",Palatino,\"Book Antiqua\",Georgia,serif",
    "mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  },
  "fontSizes": {
    "sm": "0.875rem",
    "base": "1rem",
    "lg": "1.25rem",
    "xl": "1.563rem",
    "2xl": "1.953rem",
    "3xl": "2.441rem"
  },
  "lineHeight": {
    "body": "1.6",
    "heading": "1.2"
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
    "sm": "4px",
    "md": "8px",
    "lg": "16px"
  },
  "shadow": {
    "sm": "0 1px 2px rgba(0,0,0,0.12)",
    "md": "0 4px 12px rgba(0,0,0,0.16)"
  },
  "duration": {
    "instant": "150ms",
    "fast": "200ms",
    "base": "250ms",
    "slow": "500ms"
  },
  "easing": {
    "standard": "cubic-bezier(0.2, 0, 0, 1)",
    "out": "cubic-bezier(0, 0, 0.2, 1)"
  }
}
```
