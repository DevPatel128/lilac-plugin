// Accessible inline-SVG charts built with createElementNS (text always via textContent). Data comes from stats.js.
import { formatKey } from './dates.js';

const NS = 'http://www.w3.org/2000/svg';
let n = 0;
function s(tag, attrs = {}, text) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}
function svgRoot(w, h, title, desc) {
  const id = 'ch' + ++n;
  const svg = s('svg', { viewBox: `0 0 ${w} ${h}`, class: 'chart', role: 'img', 'aria-labelledby': `${id}t ${id}d` });
  svg.append(s('title', { id: id + 't' }, title), s('desc', { id: id + 'd' }, desc));
  return svg;
}
const dayLabel = (k) => formatKey(k, 'en', { weekday: 'short', day: 'numeric', month: 'short' });

export function barChart(weeks) {
  const W = 340, H = 170, x0 = 50, base = 130, top = 20, bw = 44, gap = (W - x0 - 8 - bw * weeks.length) / Math.max(1, weeks.length - 1);
  const desc = weeks.map((w) => `Week of ${dayLabel(w.start)}: ${w.pct} percent${w.goal ? `, ${w.done} of ${w.goal} planned days` : ', no habits yet'}.`).join(' ');
  const svg = svgRoot(W, H, 'Weekly completion, last 4 weeks', desc);
  for (const v of [0, 50, 100]) {
    const y = base - ((base - top) * v) / 100;
    svg.append(s('line', { class: 'axis', x1: 44, x2: W - 4, y1: y, y2: y }), s('text', { x: 40, y: y + 4, 'text-anchor': 'end' }, v + '%'));
  }
  weeks.forEach((w, i) => {
    const x = x0 + i * (bw + gap), h = Math.max(w.pct ? 2 : 0, ((base - top) * w.pct) / 100);
    svg.append(s('rect', { class: 'bar', x, y: base - h, width: bw, height: h, rx: 4 }),
      s('text', { x: x + bw / 2, y: base - h - 5, 'text-anchor': 'middle' }, w.pct + '%'),
      s('text', { x: x + bw / 2, y: base + 16, 'text-anchor': 'middle' }, formatKey(w.start, 'en', { day: 'numeric', month: 'short' })));
  });
  return svg;
}

export function heatmapChart(grid, ws) {
  const cell = 30, gap = 4, left = 34, weeks = grid.weeks.length;
  const W = left + weeks * (cell + gap), H = 7 * (cell + gap) + 22;
  const rows = ws === 'sun' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const desc = grid.weeks.map((w) => `Week of ${dayLabel(w.start)}: ${w.days.filter((d) => !d.future).map((d) => d.done).join(', ')} habits ticked per day.`).join(' ');
  const svg = svgRoot(W, H, 'Daily activity, last 8 weeks', desc);
  rows.forEach((r, i) => svg.append(s('text', { x: 0, y: 22 + i * (cell + gap) + cell / 2 - 4 + 4 }, r)));
  grid.weeks.forEach((w, c) => {
    const x = left + c * (cell + gap);
    svg.append(s('text', { x, y: 12 }, formatKey(w.start, 'en', { day: 'numeric', month: 'numeric' })));
    w.days.forEach((d, r) => {
      const y = 18 + r * (cell + gap);
      const level = d.future ? 'f' : !d.total ? 0 : d.done === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((d.done / d.total) * 4)));
      const g = s('g');
      g.append(s('title', {}, d.future ? `${dayLabel(d.key)}: in the future` : `${dayLabel(d.key)}: ${d.done} of ${d.total} habits ticked`),
        s('rect', { class: `cell l${level}`, x, y, width: cell, height: cell, rx: 6 }));
      if (!d.future && d.done) g.append(s('text', { class: `t${level}`, x: x + cell / 2, y: y + cell / 2 + 4, 'text-anchor': 'middle' }, String(d.done)));
      svg.append(g);
    });
  });
  return svg;
}
