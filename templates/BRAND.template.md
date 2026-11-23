# Brand kit

<!-- Fill every section, then run: node scripts/foundation.mjs tokens . and node scripts/foundation.mjs check . The Tokens block below is the single source: edit it, never the generated brand/ files. System font stacks, or licensed fonts held as local files (add a "licence:" note), only. -->

## Name check
<!-- Hint: is the name free to use? Advise a trademark search in your country. Never claim the name is available. -->

## Voice
<!-- Hint: three adjectives, then Do and Don't examples. Example: Warm, plain, local. Do: "Come in, the oven is on." Don't: "Experience artisanal excellence." -->

## Wordmark
<!-- Hint: the logo mark is simple SVG in the tokens block, with the plain text name as fallback. Say how it is used and its clear space. -->

## Palette
<!-- Hint: what each colour is for, light and dark. Roles: bg, surface, text, muted, primary, accent, accent-text, link, danger, success, focus. -->

## Typography
<!-- Hint: font stacks, size scale, line height, and why. -->

## Spacing
<!-- Hint: the spacing scale, radius and shadow tokens and where each is used. -->

## Motion
<!-- Hint: principles, durations at most 600 ms, easing, and the reduced-motion rule (what happens when the visitor asks for less motion). -->

## Imagery
<!-- Hint: photo and illustration rules: subjects, treatment, alt text, no stock clichés. -->

## Iconography
<!-- Hint: icon style, size, stroke, and that every icon has a text label or accessible name. -->

## Accessibility
<!-- Hint: commitments. Example: WCAG 2.2 AA, text contrast 4.5:1, focus always visible, reduced motion respected, touch targets 44 px. -->

## Tokens
Machine-readable. `node scripts/foundation.mjs tokens .` turns this into `brand/tokens.css`, `brand/tokens.json` and `brand/brand-sheet.html`.

```json tokens
{
  "name": "Your Name",
  "wordmark": {
    "text": "Your Name",
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 220 48\" role=\"img\" aria-label=\"Your Name\"><text x=\"0\" y=\"34\" font-family=\"system-ui, sans-serif\" font-size=\"32\" font-weight=\"700\" fill=\"currentColor\">Your Name</text></svg>"
  },
  "colors": {
    "light": {
      "bg": "#ffffff", "surface": "#f5f3fa", "text": "#1a1a1a", "muted": "#595959",
      "primary": "#5b3fa0", "accent": "#5b3fa0", "accent-text": "#ffffff", "link": "#4a2f8f",
      "danger": "#b00020", "success": "#1a7f37", "focus": "#5b3fa0"
    },
    "dark": {
      "bg": "#14121a", "surface": "#1e1b27", "text": "#f2f0f7", "muted": "#b8b3c7",
      "primary": "#b49cff", "accent": "#b49cff", "accent-text": "#14121a", "link": "#c4b0ff",
      "danger": "#ff6b81", "success": "#4cc56a", "focus": "#b49cff"
    }
  },
  "fonts": {
    "sans": "system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
    "serif": "Georgia, \"Iowan Old Style\", serif",
    "mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  },
  "fontSizes": { "sm": "0.875rem", "base": "1rem", "lg": "1.25rem", "xl": "1.563rem", "2xl": "1.953rem", "3xl": "2.441rem" },
  "lineHeight": { "body": "1.6", "heading": "1.2" },
  "space": { "1": "0.25rem", "2": "0.5rem", "3": "0.75rem", "4": "1rem", "6": "1.5rem", "8": "2rem", "12": "3rem" },
  "radius": { "sm": "4px", "md": "8px", "lg": "16px" },
  "shadow": { "sm": "0 1px 2px rgba(0,0,0,0.12)", "md": "0 4px 12px rgba(0,0,0,0.16)" },
  "duration": { "fast": "150ms", "base": "250ms", "slow": "500ms" },
  "easing": { "standard": "cubic-bezier(0.2, 0, 0, 1)", "out": "cubic-bezier(0, 0, 0.2, 1)" }
}
```
