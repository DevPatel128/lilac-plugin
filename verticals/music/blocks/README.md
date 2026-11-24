# Music blocks

Plain HTML, CSS and vanilla JS. No build step, no network at load, no autoplay.

| file | what |
|---|---|
| `shell.html` | page frame: ONE `<audio>` outside `<main id="swap">`, player bar, scripts |
| `player.js` | play/pause (Space/K), fetch-and-swap of `<main>` with history API, falls back to normal navigation, Media Session |
| `player.css` | focus ring, reduced-motion |
| `waveform.js` | canvas waveform from `peaks.json` (`{"peaks":[0..1,...]}`). Optional upgrade: wavesurfer.js v7 `peaks` option |
| `tour.js` | renders `tour.json`; empty data renders `UNKNOWN: no tour dates supplied` |
| `merch.html` | Shopify placeholder, UNKNOWN until a handle is supplied |
| `youtube-facade.html` | click-to-load, no YouTube request until clicked |
| `mailing-list.html` | double-opt-in notice, action UNKNOWN until supplied |
