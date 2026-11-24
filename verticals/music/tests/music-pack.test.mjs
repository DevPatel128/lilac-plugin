// Offline structural checks for the music blocks (no jsdom, no network). Usage: node music-pack.test.mjs
import { readFileSync, readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const B = join(dirname(fileURLToPath(import.meta.url)), '..', 'blocks'), rd = f => readFileSync(join(B, f), 'utf8');
const shell = rd('shell.html');
// 1 audio element, outside #swap
assert.equal((shell.match(/<audio\b/g) || []).length, 1, 'exactly one <audio>');
const m = shell.match(/<main id="swap"[^>]*>([\s\S]*?)<\/main>/); assert.ok(m, '#swap main exists');
assert.ok(!/<audio\b/.test(m[1]), 'audio is outside the swapped region');
// no autoplay attribute anywhere (YouTube facade carries autoplay=0 in a URL only)
for (const f of readdirSync(B).filter(f => !f.endsWith('.md'))) assert.ok(!/autoplay/i.test(rd(f).replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '').replace(/autoplay=0/g, '')), `no autoplay in ${f}`);
// tour block: UNKNOWN on empty
const { lilacRenderTour } = createRequire(import.meta.url)(join(B, 'tour.js'));
for (const d of [[], undefined, null]) { const el = { textContent: 'x' }; lilacRenderTour(el, d); assert.equal(el.textContent, 'UNKNOWN: no tour dates supplied'); }
// keyboard handler, history fallback, reduced motion
const js = rd('player.js'); assert.ok(/keydown/.test(js) && /key === ' '/.test(js) && /'k'/.test(js), 'Space/K handler');
assert.ok(/pushState/.test(js) && /location\.href = url/.test(js), 'history swap with navigation fallback');
assert.ok(/mediaSession/.test(js), 'Media Session wiring');
const css = rd('player.css'); assert.ok(/prefers-reduced-motion:\s*reduce/.test(css) && /:focus-visible/.test(css), 'reduced-motion + focus CSS');
assert.ok(/aria-label="Play"/.test(shell), 'aria label on play');
// merch + mailing list stay UNKNOWN
assert.ok(/UNKNOWN/.test(rd('merch.html')) && /action="UNKNOWN"/.test(rd('mailing-list.html')) && /double opt-in/.test(rd('mailing-list.html')));
console.log('music-pack: all checks passed');
