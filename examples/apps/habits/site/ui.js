// DOM helpers and renderers. All user text goes in through textContent, never innerHTML.
import { lastNDays, formatKey } from './dates.js';
import { currentStreak, bestStreak, weekCount, weeklyStreak, isDone, weeklyCompletion, heatmap } from './stats.js';
import { PALETTE } from './store.js';
import { barChart, heatmapChart } from './charts.js';
import { FAQ } from './content.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v === false || v == null) continue; e.setAttribute(k, v === true ? '' : v); }
  e.append(...kids.filter((k) => k != null));
  return e;
}
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const dayLabel = (k) => formatKey(k, 'en', { weekday: 'short', day: 'numeric', month: 'short' });

let liveTimer;
export function announce(msg) {
  const live = $('#live');
  live.textContent = '';
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => { live.textContent = msg; }, 30); // a short gap makes repeated messages re-announce
}

export function openDialog(dlg, focusSel) {
  dlg._opener = document.activeElement;
  dlg.showModal();
  if (focusSel) $(focusSel, dlg)?.focus();
}
function restoreFocus(dlg) {
  const a = document.activeElement;
  if (a && a !== document.body && !dlg.contains(a)) return; // focus already moved on purpose
  const o = dlg._opener;
  if (o && o.isConnected && o.offsetParent !== null) o.focus(); else $('[data-view]:not([hidden]) h2')?.focus();
}
// Close and restore focus at once (the 'close' event can be delayed in background tabs); the event covers Esc.
export function dismiss(dlg) { if (dlg.open) { dlg.close(); restoreFocus(dlg); } }
export function wireDialog(dlg) {
  dlg.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) dismiss(dlg); });
  dlg.addEventListener('close', () => restoreFocus(dlg));
}

let toastTimer;
export function toast(msg, { label, onAction, timeout = 10000 } = {}) {
  const box = $('#toasts');
  box.replaceChildren();
  clearTimeout(toastTimer);
  const t = el('div', { class: 'toast' }, el('span', {}, msg));
  const done = () => { clearTimeout(toastTimer); t.remove(); };
  if (label) t.append(el('button', { type: 'button', class: 'btn' }, label));
  else t.append(el('button', { type: 'button', class: 'btn', 'aria-label': 'Dismiss message' }, 'OK'));
  t.querySelector('button').addEventListener('click', () => { done(); if (label) onAction(); });
  t.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(); });
  const arm = () => { clearTimeout(toastTimer); if (timeout) toastTimer = setTimeout(done, timeout); };
  for (const ev of ['mouseenter', 'focusin']) t.addEventListener(ev, () => clearTimeout(toastTimer));
  for (const ev of ['mouseleave', 'focusout']) t.addEventListener(ev, arm);
  box.append(t); arm();
  announce(msg + (label ? ` ${label} is available.` : ''));
  return done;
}

export function buildForm() {
  const sel = $('#f-target');
  for (let i = 1; i <= 7; i++) sel.append(el('option', { value: i }, `${plural(i, 'day')} a week`));
  const box = $('#f-colors');
  for (const c of PALETTE) box.append(el('label', { class: 'c-' + c.id }, el('input', { type: 'radio', name: 'color', value: c.id }), el('span', { class: 'chip' }), el('span', {}, c.label)));
}

let seen = new Set();
export function renderHabits(list, habits, today, ws) {
  const next = new Set();
  list.replaceChildren(...habits.map((h, i) => {
    next.add(h.id);
    const streak = currentStreak(h, today);
    const li = el('li', { class: `habit c-${h.color}${seen.has(h.id) ? '' : ' fresh'}`, 'data-id': h.id, tabindex: '-1', style: null });
    li.style.setProperty('--i', String(Math.min(i, 8)));
    if (seen.has(h.id)) li.style.animation = 'none';
    const week = el('div', { class: 'week', role: 'group', 'aria-label': `Last 7 days for ${h.name}` },
      ...lastNDays(today, 7).map((k) => el('button', { type: 'button', class: 'day' + (k === today ? ' today' : ''), 'data-day': k, 'aria-pressed': String(isDone(h, k)), 'aria-label': `${h.name}, ${k === today ? 'today, ' : ''}${dayLabel(k)}` },
        el('span', {}, formatKey(k, 'en', { weekday: 'short' })), el('span', { class: 'box', 'aria-hidden': 'true' }, '✓'))));
    li.append(
      el('div', { class: 'top' },
        el('span', { class: 'swatch', 'aria-hidden': 'true' }),
        el('div', { class: 'info' }, el('h3', {}, h.name),
          el('p', { class: 'meta' }, `Streak ${plural(streak, 'day')} · This week ${weekCount(h, today, ws)}/${h.target} · Best ${plural(bestStreak(h), 'day')}`)),
        el('div', { class: 'acts' },
          el('button', { type: 'button', class: 'btn icon', 'data-act': 'edit', 'aria-label': `Edit ${h.name}` }, 'Edit'),
          el('button', { type: 'button', class: 'btn icon', 'data-act': 'delete', 'aria-label': `Delete ${h.name}` }, 'Delete'))),
      week);
    return li;
  }));
  seen = next;
}
export const forgetSeen = () => { seen = new Set(); };

function table(headers, rows) {
  return el('table', {}, el('thead', {}, el('tr', {}, ...headers.map((h) => el('th', { scope: 'col' }, h)))),
    el('tbody', {}, ...rows.map((r) => el('tr', {}, ...r.map((c, i) => el(i === 0 ? 'th' : 'td', i === 0 ? { scope: 'row' } : {}, String(c)))))));
}
export function renderInsights(habits, today, ws) {
  $('#insights-empty').hidden = habits.length > 0;
  $('#insights-body').hidden = habits.length === 0;
  if (!habits.length) return;
  const weeks = weeklyCompletion(habits, today, 4, ws);
  $('#bars').replaceChildren(barChart(weeks), el('details', {}, el('summary', {}, 'Show as table'),
    table(['Week starting', 'Ticked', 'Planned', 'Completion'], weeks.map((w) => [dayLabel(w.start), w.done, w.goal, w.pct + '%']))));
  const grid = heatmap(habits, today, 8, ws);
  $('#heat').replaceChildren(heatmapChart(grid, ws), el('details', {}, el('summary', {}, 'Show as table'),
    table(['Week starting', ...(ws === 'sun' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])],
      grid.weeks.map((w) => [dayLabel(w.start), ...w.days.map((d) => (d.future ? '-' : d.done))]))));
  $('#per-habit tbody').replaceChildren(...habits.map((h) => el('tr', {}, el('th', { scope: 'row' }, h.name),
    el('td', {}, plural(currentStreak(h, today), 'day')), el('td', {}, plural(bestStreak(h), 'day')),
    el('td', {}, `${weekCount(h, today, ws)}/${h.target}`), el('td', {}, String(weeklyStreak(h, today, ws))))));
}

export function renderFaq() {
  const box = $('#faq');
  FAQ.forEach(([q, a], i) => {
    const btn = el('button', { type: 'button', class: 'q', id: `q${i}`, 'aria-expanded': 'false', 'aria-controls': `a${i}` }, q);
    const panel = el('div', { class: 'a', id: `a${i}`, role: 'region', 'aria-labelledby': `q${i}`, hidden: true }, el('p', {}, a));
    btn.addEventListener('click', () => { const open = btn.getAttribute('aria-expanded') === 'true'; btn.setAttribute('aria-expanded', String(!open)); panel.hidden = open; });
    box.append(el('h4', {}, btn), panel);
  });
}
