# Brand kit

Still Water is a FICTIONAL SAMPLE studio. This kit was written from the existing CSS and BRIEF.md; the tokens block mirrors the values the site actually uses. The site keeps its own short custom-property names in `site/assets/styles.css` (for example `--bg`, `--blue`); the table under Palette maps them to the token roles. `brand/` sits outside `site/` on purpose: it is not deployed.

## Name check
"Still Water" is a made-up name for a made-up studio. Nobody has checked whether it is free to use. If this were a real business, search trademarks in your own country before using it. This kit does not claim the name is available.

## Voice
Plain, warm, short sentences. Do: "Take the class at your own pace." Don't: "Transform your body and mind." No health, medical, wellness-outcome or weight-loss claims; no reviews, ratings, awards or member counts (BRIEF.md "Must not claim").

## Wordmark
The text "Still Water" next to a 40 px circle mark with two wavy lines (inline SVG in each page header, drawn with the soft and ring colours). The text name is always present, so the mark may fail without losing the name. Keep at least 12 px clear space around the pair.

## Palette
Muted earthy blue on warm sand; deliberately not lavender. Light and dark are separate token sets (dark mode swaps tokens only).

| Token role | Site property | Use |
|---|---|---|
| bg | `--bg` | page background |
| surface | `--surface` | cards, inputs, table |
| text | `--ink` | body text, focus ring |
| muted | `--muted` | secondary text |
| primary, link | `--blue` | buttons, links, current nav item |
| accent | `--sand` | highlight band, dividers |
| accent-text | `--ink` | text on the sand band |
| focus | `--ink` | 3 px focus outline |
| danger, success | `--ink` | not separate colours: errors and confirmations are shown with text ("Fix: ...", "Demo: nothing was sent") and a dashed border, never colour alone |
| extras | `--line --soft --h1 --w1 --w2 --w3 --orb1 --orb2 --ring` | field borders, tints, hero gradient, wave layers, breathing circle |

Contrast is computed by `foundation.mjs check` for text, muted, link, focus and accent-text.

## Typography
One system rounded stack, no web fonts, no remote font requests: `ui-rounded, "SF Pro Rounded", "Nunito", "Segoe UI", system-ui, -apple-system, sans-serif`. Body 1.125rem at 1.65 line height; h1 fluid 2.5 to 4.6rem; headings 1.15 line height. Large friendly type is the brief. "Nunito" is used only if the visitor already has it installed.

## Spacing
Cards use a 22 px radius (`--r`), inputs 14 px, small chips and focus rings 8 px. Pill buttons use 999 px. Section padding is fluid (48 to 96 px). One soft shadow (`--shadow`) lifts cards. Layout width is 1120 px max with a 16 px gutter each side.

## Motion
Expressive but accessible. Only `transform` and `opacity` animate. Short UI motion 150 ms (button press), 450 ms (timetable row slide), 600 ms (reveal and press ripple, the upper limit). The breathing circle (10 s loop) and logo ripple rings (1.6 s loop) are ambient loops kept as site-level properties (`--loop-breathe`, `--loop-ring`) because they are above the 600 ms UI limit; the 10 s loop has a Pause/Play button. Reduced-motion rule: under `prefers-reduced-motion: reduce` all animations and transitions are removed, smooth scrolling is off, the reveal shows content at once and the circle is a static shape. No flashing.

## Imagery
No photographs. Art is inline SVG: layered wave shapes in the blue tints, one circle, and flat round avatars for the sample teachers. No stock people, no raster images, no `og:image` (none exists).

## Iconography
No icon set. The only symbols are the wordmark circle and decorative wave SVGs, all marked `aria-hidden`; every control carries a text label.

## Accessibility
WCAG 2.2 AA is the target. Text contrast 4.5:1 or better in light and dark; skip link; landmarks; visible 3 px focus outline; nav works without JavaScript; content visible without JavaScript; reduced motion respected; a pause control for the one loop longer than 5 s; touch targets of at least 44 px are UNVERIFIED (chips and small buttons are about 40 px tall).

## Tokens
Machine-readable. `node operations/plugin/scripts/foundation.mjs tokens <folder>` turns this into `brand/tokens.css`, `brand/tokens.json` and `brand/brand-sheet.html`.

```json tokens
{
  "name": "Still Water",
  "wordmark": {
    "text": "Still Water",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 40 40\" role=\"img\" aria-label=\"Still Water\"><circle cx=\"20\" cy=\"20\" r=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M8 18c4-4 8 4 12 0s8 4 12 0M8 25c4-4 8 4 12 0s8 4 12 0\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>"
  },
  "colors": {
    "light": {
      "bg": "#f3ead8",
      "surface": "#faf5e9",
      "text": "#1c2a35",
      "muted": "#41535f",
      "primary": "#2b5775",
      "accent": "#e6d8ba",
      "accent-text": "#1c2a35",
      "link": "#2b5775",
      "danger": "#1c2a35",
      "success": "#1c2a35",
      "focus": "#1c2a35",
      "line": "#6c7c84",
      "soft": "#cddde5",
      "hero": "#d6e4e8",
      "wave1": "#bfd3dc",
      "wave2": "#9fbccb",
      "wave3": "#7fa3b8",
      "orb1": "#e9f1f3",
      "orb2": "#8fb2c6"
    },
    "dark": {
      "bg": "#101a22",
      "surface": "#17242e",
      "text": "#f0e9d8",
      "muted": "#b9c4cb",
      "primary": "#8dbad6",
      "accent": "#2a3946",
      "accent-text": "#f0e9d8",
      "link": "#8dbad6",
      "danger": "#f0e9d8",
      "success": "#f0e9d8",
      "focus": "#f0e9d8",
      "line": "#7f929c",
      "soft": "#1f3342",
      "hero": "#173040",
      "wave1": "#1d3647",
      "wave2": "#244458",
      "wave3": "#2d556c",
      "orb1": "#cfe3ee",
      "orb2": "#3d6d88"
    }
  },
  "fonts": {
    "sans": "ui-rounded, \"SF Pro Rounded\", \"Nunito\", \"Segoe UI\", system-ui, -apple-system, sans-serif",
    "serif": "Georgia, \"Iowan Old Style\", serif",
    "mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  },
  "fontSizes": {
    "sm": "0.95rem",
    "base": "1.125rem",
    "lg": "1.3rem",
    "xl": "1.8rem",
    "2xl": "2.5rem",
    "3xl": "4.6rem"
  },
  "lineHeight": {
    "body": "1.65",
    "heading": "1.15"
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
    "sm": "8px",
    "md": "14px",
    "lg": "22px"
  },
  "shadow": {
    "sm": "0 1px 2px rgba(28,42,53,0.12)",
    "md": "0 10px 30px -14px rgba(28,42,53,0.35)"
  },
  "duration": {
    "fast": "150ms",
    "base": "450ms",
    "slow": "600ms"
  },
  "easing": {
    "standard": "ease",
    "out": "ease-out"
  }
}
```
