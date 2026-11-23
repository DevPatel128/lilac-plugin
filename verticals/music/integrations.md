# Music integrations

| integration | account | key | cost | licence | fallback |
|---|---|---|---|---|---|
| Owner-supplied audio, custom player (owner must hold master and composition rights) | none | none | hosting only | owner's own rights | UNKNOWN: no audio supplied, track list renders without Play |
| wavesurfer.js v7 with pre-computed peaks (optional upgrade) | none | none | free | BSD-3 | built-in canvas waveform from `peaks.json` |
| Media Session API | none | none | free | browser feature | player works without lock-screen controls |
| Spotify / Apple Music / SoundCloud / Bandcamp embeds (secondary only) | artist profile on each | none for embeds | free | each platform's terms | plain link to the profile. Spotify API preview URLs are gone for new apps: use embeds only |
| Bandsintown tour dates, cached at build | artist account | app_id (needs written consent from Bandsintown) | free | Bandsintown terms | `UNKNOWN: no tour dates supplied`, or owner types dates into `tour.json` |
| Shopify Buy Button (merch) | Shopify store | storefront token (owner supplies) | Shopify plan | Shopify terms | `UNKNOWN: no Shopify handle` |
| Owner's email provider, double opt-in (GDPR/DPDP consent text) | provider account | form action URL | provider plan | provider terms | form disabled, action UNKNOWN |
| YouTube click-to-load facade | none | none | free | YouTube terms | plain link |
