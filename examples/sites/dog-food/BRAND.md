# Brand kit

Biscuit & Bowl is a FICTIONAL sample brand for the Lilac demo. This kit describes the look the site already has.

## Name check
"Biscuit & Bowl" is an invented demo name. No trademark search was done and the name is NOT claimed to be free. Before any real use, search trademark registers in the target country.

## Voice
Plain, warm, short. Do: "Pick what looks good and see a sample total." Don't: claim reviews, health or vet benefits, or "complete and balanced". Every page says the brand is fictional.

## Wordmark
The mark is a paw icon (inline SVG) followed by the text "Biscuit & Bowl" in the serif stack, with the ampersand in the accent colour. The text name is the fallback. Keep one icon width of clear space around it.

## Palette
Roles, light and dark (hex values in the tokens block):
- bg: page background, kraft paper. surface: cards, header, footer. text (the site calls it ink): body text, borders, offset shadows. muted: secondary text.
- primary and accent: terracotta for buttons, links, the stamp badge and the nav bar. accent-text: text on accent.
- link: same colour as accent. danger: form errors use the accent colour (the site has no separate red). focus: the ink colour, with a honey halo drawn in CSS.
- success: not used on the site; reserved, chosen to pass contrast on bg.
- honey / on-honey: the one loud band and selected states. line, line-strong: dividers and input borders. shadow: hard offset shadow colour.
Recorded contrast (BUILD-LOG, computed from the tokens): light ink/bg 14.78, muted/bg 7.47, accent/bg 5.87; dark ink/bg 15.16, muted/bg 9.40, accent/bg 8.13.

## Typography
Serif stack for headings (Iowan Old Style, Palatino, Georgia), rounded system sans for body. System fonts only, no downloads. Body 17 px with 1.6 line height; headings 1.15 line height; heading sizes use clamp so they scale from 360 to 1440 px.

## Spacing
Rem-based scale from 0.25 to 4 rem; the page gap is clamp(1rem, 3vw, 2rem). Radius: 14 px for cards and buttons, 999 px for pills, 4 px for tags. Shadow: hard offset, no blur (4 px right, 4 px down), the kraft-label look.

## Motion
Expressive but accessible. Only transform and opacity animate. Durations stay at or under 600 ms for interactions and entrances; two decorative loops (kibble bounce, paw prints) run longer than that and have a visible pause button. Easing is ease-out or a soft cubic curve. Reduced-motion rule: when the visitor asks for less motion, all animation and transition are switched off, scroll reveal is skipped, content shows at once and the pause buttons are hidden.

## Imagery
Inline SVG illustrations only (a bowl of round biscuits, paw prints). No photographs, no stock images, no gradients. Illustrations carry a title or are hidden from assistive tech when decorative.

## Iconography
One paw icon, filled with the accent colour, next to the text name; it is decorative (aria-hidden) because the text is always present. Every control has a text label.

## Accessibility
WCAG 2.2 AA goal. Text contrast 4.5:1, borders and focus 3:1, focus always visible, reduced motion respected, touch targets at least 44 px, content readable with JavaScript off, light and dark modes. Screen reader testing was not done (UNVERIFIED).

## Tokens
Machine-readable. `node operations/plugin/scripts/foundation.mjs tokens .` turns this into `brand/tokens.css`, `brand/tokens.json` and `brand/brand-sheet.html`. Duration tokens mirror the times the site uses.

```json tokens
{
  "name": "Biscuit & Bowl",
  "wordmark": {
    "text": "Biscuit & Bowl",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 260 48\" role=\"img\" aria-label=\"Biscuit and Bowl\"><text x=\"0\" y=\"34\" font-family=\"Georgia, serif\" font-size=\"30\" font-weight=\"700\" fill=\"currentColor\">Biscuit &amp; Bowl</text></svg>"
  },
  "colors": {
    "light": {
      "bg": "#FBF3E4",
      "surface": "#FFFBF2",
      "text": "#2B1D14",
      "muted": "#5E4B3C",
      "primary": "#A63A1A",
      "accent": "#A63A1A",
      "accent-text": "#FFF8EC",
      "link": "#A63A1A",
      "danger": "#A63A1A",
      "success": "#2F6B3A",
      "focus": "#2B1D14",
      "honey": "#E9B440",
      "on-honey": "#2B1D14",
      "line": "#D9C3A0",
      "line-strong": "#8A6F52",
      "shadow": "#2B1D14"
    },
    "dark": {
      "bg": "#1D1611",
      "surface": "#2A2019",
      "text": "#F6EBDA",
      "muted": "#CDB9A0",
      "primary": "#F2987A",
      "accent": "#F2987A",
      "accent-text": "#1D1611",
      "link": "#F2987A",
      "danger": "#F2987A",
      "success": "#7FC48C",
      "focus": "#F6EBDA",
      "honey": "#E9B440",
      "on-honey": "#2B1D14",
      "line": "#4A3A2D",
      "line-strong": "#A58A6C",
      "shadow": "#000000"
    }
  },
  "fonts": {
    "sans": "ui-rounded,\"Avenir Next\",\"Segoe UI\",system-ui,sans-serif",
    "serif": "\"Iowan Old Style\",\"Palatino Linotype\",Palatino,Georgia,serif",
    "mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  },
  "fontSizes": {
    "sm": "0.9rem",
    "base": "1.0625rem",
    "lg": "1.25rem",
    "xl": "1.4rem",
    "2xl": "2rem",
    "3xl": "3.6rem"
  },
  "lineHeight": {
    "body": "1.6",
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
    "sm": "4px",
    "md": "14px",
    "lg": "999px"
  },
  "shadow": {
    "sm": "3px 3px 0 #2B1D14",
    "md": "4px 4px 0 #2B1D14"
  },
  "duration": {
    "fast": "120ms",
    "quick": "200ms",
    "base": "300ms",
    "enter": "500ms",
    "slow": "600ms"
  },
  "easing": {
    "standard": "cubic-bezier(0.2, 0.7, 0.2, 1)",
    "out": "ease-out"
  }
}
```
