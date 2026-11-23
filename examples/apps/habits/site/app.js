// Controller: owns the state, wires events, routing, settings, support tools and the service worker.
import { todayKey, formatKey } from './dates.js';
import { currentStreak } from './stats.js';
import { emptyState, load, save, addHabit, updateHabit, deleteHabit, restoreHabit, setDone, updateSettings, sampleHabits, SCHEMA_VERSION, STORAGE_KEY } from './store.js';
import { exportState, parseImport, MAX_IMPORT_BYTES } from './io.js';
import { TOUR } from './content.js';
import { $, el, announce, openDialog, wireDialog, dismiss, toast, buildForm, renderHabits, forgetSeen, renderInsights, renderFaq, dayLabel } from './ui.js';

const APP_VERSION = '1.0.0';
const SUPPORT_EMAIL = 'support@example.test';
const ROUTES = { today: 'Today', insights: 'Insights', settings: 'Settings', help: 'Help', support: 'Support', about: 'About and privacy' };
let storage = null;
try { storage = window.localStorage; } catch { /* blocked: handled by load() */ }
const loaded = load(storage || { getItem() { throw new Error('no storage'); } }, { today: todayKey() });
let state = loaded.state;
let view = { q: '', filter: 'all', sort: 'manual' };
let undo = null;
let route = 'today';
let editingId = null;
const ws = () => state.settings.weekStart;
const today = () => todayKey();

function persist() {
  if (!storage) return false;
  const r = save(storage, state);
  if (!r.ok) toast(r.reason === 'quota' ? 'Could not save: browser storage is full. Export your data from Settings.' : 'Could not save: browser storage is blocked. Export your data from Settings.',
    { label: 'Open Settings', onAction: () => { location.hash = '#/settings'; }, timeout: 0 });
  return r.ok;
}

function applySettings() {
  const r = document.documentElement;
  if (state.settings.theme === 'system') delete r.dataset.theme; else r.dataset.theme = state.settings.theme;
  if (state.settings.motion === 'off') r.dataset.motion = 'off'; else delete r.dataset.motion;
  for (const [name, val] of Object.entries(state.settings)) { const i = $(`input[name="${name}"][value="${val}"]`); if (i) i.checked = true; }
}

function visibleHabits() {
  const t = today(), q = view.q.trim().toLowerCase();
  let list = state.habits.filter((h) => (!q || h.name.toLowerCase().includes(q)) && (view.filter === 'all' || (view.filter === 'done') === h.done.includes(t)));
  if (view.sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  if (view.sort === 'streak') list = [...list].sort((a, b) => currentStreak(b, t) - currentStreak(a, t));
  if (view.sort === 'target') list = [...list].sort((a, b) => b.target - a.target);
  return list;
}

function renderToday() {
  const t = today(), has = state.habits.length > 0, list = visibleHabits();
  $('#today-label').textContent = formatKey(t, 'en', { weekday: 'long', day: 'numeric', month: 'long' });
  $('#empty').hidden = has;
  $('#tools').hidden = !has;
  $('#tour-banner').hidden = state.settings.tourDone;
  $('#empty-tour').hidden = !state.settings.tourDone; // one tour offer at a time (UX-0028)
  $('#no-match').hidden = !has || list.length > 0;
  const doneToday = state.habits.filter((h) => h.done.includes(t)).length;
  $('#summary').hidden = !has;
  $('#summary').textContent = `${doneToday} of ${state.habits.length} done today`;
  renderHabits($('#habit-list'), list, t, ws());
}
function render() {
  if (route === 'today') renderToday();
  if (route === 'insights') renderInsights(state.habits, today(), ws());
  if (route === 'support') renderSupport();
}
function rerenderKeepingFocus() {
  const a = document.activeElement, id = a?.closest?.('.habit')?.dataset.id, day = a?.dataset?.day, act = a?.dataset?.act;
  render();
  if (!id) return;
  const li = $(`.habit[data-id="${id}"]`);
  (day ? $(`[data-day="${day}"]`, li) : act ? $(`[data-act="${act}"]`, li) : li)?.focus();
}

// ---- routing
function show(name, initial) {
  route = ROUTES[name] ? name : 'today';
  for (const s of document.querySelectorAll('[data-view]')) s.hidden = s.dataset.view !== route;
  for (const a of document.querySelectorAll('nav a')) { if (a.dataset.route === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  document.title = `${ROUTES[route]} - Pocket Habits`;
  render();
  if (!initial) { $(`#h-${route}`).focus(); announce(`${ROUTES[route]} screen`); window.scrollTo(0, 0); }
}
// Only '#/route' hashes navigate; '#main' (skip link) is left to the browser so it focuses the content.
window.addEventListener('hashchange', () => { if (!location.hash || location.hash.startsWith('#/')) show(location.hash.replace(/^#\/?/, '')); });

// ---- habit dialog
const dlgHabit = $('#dlg-habit'), form = $('#habit-form');
function openHabitDialog(h) {
  editingId = h ? h.id : null;
  form.reset();
  for (const e of form.querySelectorAll('.err')) e.textContent = '';
  for (const e of form.querySelectorAll('[aria-invalid]')) e.removeAttribute('aria-invalid');
  $('#dlg-habit-title').textContent = h ? 'Edit habit' : 'New habit';
  $('#f-save').textContent = h ? 'Save changes' : 'Add habit';
  form.elements.name.value = h ? h.name : '';
  form.elements.target.value = String(h ? h.target : 5);
  form.elements.color.value = h ? h.color : 'violet';
  openDialog(dlgHabit, '#f-name');
}
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const fields = { name: form.elements.name.value, target: Number(form.elements.target.value), color: form.elements.color.value };
  const r = editingId ? updateHabit(state, editingId, fields) : addHabit(state, fields, { today: today() });
  const errs = r.errors || {};
  $('#f-name-err').textContent = errs.name || errs.limit || '';
  $('#f-target-err').textContent = errs.target || '';
  $('#f-color-err').textContent = errs.color || '';
  form.elements.name.toggleAttribute('aria-invalid', Boolean(errs.name || errs.limit));
  if (!r.ok) { (errs.name || errs.limit ? form.elements.name : errs.target ? form.elements.target : form.querySelector('input[name="color"]')).focus(); return; }
  state = r.state;
  persist();
  const id = editingId || r.habit.id, name = fields.name.trim();
  dismiss(dlgHabit);
  if (route !== 'today') location.hash = '#/today'; else render();
  $(`.habit[data-id="${id}"]`)?.focus();
  announce(editingId ? `Saved ${name}.` : `Added ${name}.`);
});
wireDialog(dlgHabit);

// ---- confirm dialog (one at a time)
const dlgConfirm = $('#dlg-confirm');
let onConfirm = null;
wireDialog(dlgConfirm);
function confirmThen(title, text, label, fn) {
  $('#dlg-confirm-title').textContent = title;
  $('#dlg-confirm-text').textContent = text;
  $('#confirm-ok').textContent = label;
  onConfirm = fn;
  openDialog(dlgConfirm, '[data-close]');
}
$('#confirm-ok').addEventListener('click', () => { const fn = onConfirm; onConfirm = null; dismiss(dlgConfirm); if (fn) fn(); });

// ---- toggle, delete, undo
function toggle(id, key) {
  const h = state.habits.find((x) => x.id === id);
  if (!h) return;
  const on = !h.done.includes(key);
  const r = setDone(state, id, key, on, { today: today() });
  if (!r.ok) return announce(r.error);
  state = r.state; persist(); rerenderKeepingFocus();
  const n = currentStreak(state.habits.find((x) => x.id === id), today());
  announce(`${h.name}, ${dayLabel(key)}: ${on ? 'done' : 'not done'}. Streak ${n} ${n === 1 ? 'day' : 'days'}.`);
}
function remove(id) {
  const r = deleteHabit(state, id);
  if (!r.removed) return;
  state = r.state; persist();
  undo = { habit: r.removed, index: r.index };
  render();
  const next = $$li()[Math.min(r.index, $$li().length - 1)];
  if (next) next.focus(); else $('#h-today').focus();
  toast(`Deleted "${r.removed.name}".`, { label: 'Undo', onAction: doUndo, timeout: 10000 });
}
const $$li = () => [...document.querySelectorAll('.habit')];
function doUndo() {
  if (!undo) return;
  const { habit, index } = undo; undo = null;
  state = restoreHabit(state, habit, index); persist();
  forgetSeen(); render();
  $(`.habit[data-id="${habit.id}"]`)?.focus();
  announce(`Restored ${habit.name}.`);
}

// ---- tour
const dlgTour = $('#dlg-tour');
let step = 0;
wireDialog(dlgTour);
function tourStep() {
  const [title, text] = TOUR[step];
  $('#tour-step').textContent = `Step ${step + 1} of ${TOUR.length}`;
  $('#tour-title').textContent = title; $('#tour-text').textContent = text;
  $('#tour-back').hidden = step === 0;
  $('#tour-next').textContent = step === TOUR.length - 1 ? 'Done' : 'Next';
}
function openTour() { step = 0; tourStep(); openDialog(dlgTour, '#tour-next'); }
const finishTour = () => { if (!state.settings.tourDone) { state = updateSettings(state, { tourDone: true }).state; persist(); if (route === 'today') renderToday(); } };
dlgTour.addEventListener('close', finishTour);
const endTour = () => { finishTour(); dismiss(dlgTour); };
$('#tour-next').addEventListener('click', () => { if (step < TOUR.length - 1) { step++; tourStep(); $('#tour-next').focus(); } else endTour(); });
$('#tour-back').addEventListener('click', () => { step--; tourStep(); $('#tour-next').focus(); });
$('#tour-skip').addEventListener('click', endTour);
$('#tour-start').addEventListener('click', openTour);
$('#tour-dismiss').addEventListener('click', () => { state = updateSettings(state, { tourDone: true }).state; persist(); renderToday(); $('#h-today').focus(); announce('Tour hidden. Find it again in Help.'); });
wireDialog($('#dlg-shortcuts'));

// ---- global clicks
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act, id = b.closest('.habit')?.dataset.id;
  if (act === 'new') openHabitDialog();
  if (act === 'tour') openTour();
  if (act === 'shortcuts') openDialog($('#dlg-shortcuts'), '[data-close]');
  if (act === 'edit') openHabitDialog(state.habits.find((h) => h.id === id));
  if (act === 'delete') remove(id);
});
$('#habit-list').addEventListener('click', (e) => { const d = e.target.closest('[data-day]'); if (d) toggle(d.closest('.habit').dataset.id, d.dataset.day); });
$('#add-samples').addEventListener('click', () => { state = sampleHabits(state, today()); persist(); forgetSeen(); renderToday(); $('#habit-list .habit')?.focus(); announce('Added 3 sample habits.'); });
$('#q').addEventListener('input', (e) => { view.q = e.target.value; renderToday(); });
$('#filter').addEventListener('change', (e) => { view.filter = e.target.value; renderToday(); });
$('#sort').addEventListener('change', (e) => { view.sort = e.target.value; renderToday(); });
$('#clear-filters').addEventListener('click', () => { view = { q: '', filter: 'all', sort: view.sort }; $('#q').value = ''; $('#filter').value = 'all'; renderToday(); $('#q').focus(); announce('Filters cleared.'); });

// ---- settings and data
for (const r of document.querySelectorAll('#view-settings input[type="radio"]')) r.addEventListener('change', () => {
  const u = updateSettings(state, { [r.name]: r.value });
  if (!u.ok) return;
  state = u.state; persist(); applySettings();
  announce(`${{ theme: 'Theme', weekStart: 'Week start', motion: 'Motion' }[r.name]} set to ${r.parentElement.textContent.trim()}.`);
});
const msg = (t) => { $('#data-err').textContent = ''; $('#data-msg').textContent = t; announce(t); };
const err = (t) => { $('#data-msg').textContent = ''; $('#data-err').textContent = t; toast(t); };
$('#export').addEventListener('click', () => {
  const name = `pocket-habits-${today()}.json`;
  const url = URL.createObjectURL(new Blob([exportState(state)], { type: 'application/json' }));
  const a = el('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  msg(`Exported ${state.habits.length} ${state.habits.length === 1 ? 'habit' : 'habits'} to ${name}.`);
});
const file = $('#import-file');
$('#import').addEventListener('click', () => file.click());
file.addEventListener('change', async () => {
  const f = file.files[0];
  file.value = '';
  if (!f) return;
  if (f.size > MAX_IMPORT_BYTES) return err(`The file is too large (limit ${MAX_IMPORT_BYTES / 1024} KB). Nothing was imported.`);
  let text;
  try { text = await f.text(); } catch { return err('The file could not be read. Nothing was imported.'); }
  const r = parseImport(text, { today: today() });
  if (!r.ok) return err(r.error);
  confirmThen('Replace your habits?', `Your ${state.habits.length} current ${state.habits.length === 1 ? 'habit' : 'habits'} and settings will be replaced by ${r.count} from ${f.name}. Export first if you want to keep them.`, 'Replace', () => {
    state = r.state; persist(); applySettings(); forgetSeen(); render();
    msg(`Imported ${r.count} ${r.count === 1 ? 'habit' : 'habits'}.`);
  });
});
$('#onboarding').addEventListener('click', () => { state = updateSettings(state, { tourDone: false }).state; persist(); openTour(); });
$('#reset').addEventListener('click', () => confirmThen('Erase everything?', 'All habits and settings in this browser will be deleted. This cannot be undone. Export first if you may want them back.', 'Erase everything', () => {
  state = emptyState(); undo = null;
  try { storage?.removeItem(STORAGE_KEY + ':backup'); } catch { /* ignore */ }
  persist(); applySettings(); forgetSeen(); render();
  msg('All data erased.');
}));

// ---- support and about
function browserName() {
  const u = navigator.userAgent;
  return /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'Unknown';
}
const diagText = () => `Pocket Habits diagnostics\nApp version: ${APP_VERSION}\nSchema version: ${SCHEMA_VERSION}\nHabits: ${state.habits.length}`;
function renderSupport() {
  $('#diag').textContent = diagText();
  const body = `App: Pocket Habits ${APP_VERSION}\nBrowser: ${browserName()}\n\nWhat happened:\n`;
  $('#mailto').href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Pocket Habits support')}&body=${encodeURIComponent(body)}`;
}
async function copy(text, out, okText, select) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch {
    const t = el('textarea', { 'aria-hidden': 'true', readonly: true }); t.value = text; document.body.append(t); t.select();
    try { ok = document.execCommand('copy'); } catch { /* fall through */ }
    t.remove();
  }
  if (!ok && select) { const r = document.createRange(); r.selectNodeContents(select); getSelection().removeAllRanges(); getSelection().addRange(r); }
  out.textContent = ok ? okText : 'Copy failed. Select the text and copy it yourself.';
  announce(out.textContent);
}
$('#copy-email').addEventListener('click', () => copy(SUPPORT_EMAIL, $('#copy-email-msg'), `Copied ${SUPPORT_EMAIL} to the clipboard.`));
$('#copy-diag').addEventListener('click', () => copy(diagText(), $('#copy-diag-msg'), 'Copied diagnostics to the clipboard.', $('#diag')));
$('#about-version').textContent = APP_VERSION;
$('#about-schema').textContent = String(SCHEMA_VERSION);

// ---- keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
  const t = e.target.closest ? e.target : document.body;
  if (t.closest('input, select, textarea, [contenteditable]') || document.querySelector('dialog[open]')) return;
  const onItem = t.classList?.contains('habit');
  const k = e.key;
  if (k === 'n') { e.preventDefault(); openHabitDialog(); }
  else if (k === '?' || (k === '/' && e.shiftKey)) { e.preventDefault(); openDialog($('#dlg-shortcuts'), '[data-close]'); }
  else if (k === 'u' && undo) { e.preventDefault(); doUndo(); }
  else if (route === 'today' && k === '/') { const q = $('#q'); if (!$('#tools').hidden) { e.preventDefault(); q.focus(); } }
  else if (route === 'today' && (k === 'j' || k === 'k')) {
    const items = $$li();
    if (!items.length) return;
    const cur = items.findIndex((i) => i.classList.contains('current'));
    const i = cur < 0 ? 0 : Math.max(0, Math.min(items.length - 1, cur + (k === 'j' ? 1 : -1)));
    items.forEach((x) => x.classList.remove('current'));
    items[i].classList.add('current'); items[i].focus(); items[i].scrollIntoView({ block: 'nearest' });
    announce(`${items[i].querySelector('h3').textContent}, ${i + 1} of ${items.length}. Press space to tick today.`);
  } else if (route === 'today' && k === ' ') {
    const li = onItem ? t : (t === document.body || t.id === 'main' ? $('.habit.current') : null);
    if (li) { e.preventDefault(); toggle(li.dataset.id, today()); }
  }
});
document.addEventListener('focusin', (e) => { if (!e.target.classList?.contains('habit')) for (const i of $$li()) i.classList.remove('current'); else { for (const i of $$li()) i.classList.toggle('current', i === e.target); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

// ---- service worker and update prompt
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  const offer = (w) => { $('#update').hidden = false; $('#update-btn').onclick = () => w.postMessage({ type: 'SKIP_WAITING' }); };
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    if (reg.waiting && hadController) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w.addEventListener('statechange', () => { if (w.state === 'installed') { if (navigator.serviceWorker.controller) offer(w); else toast('Ready to use offline.'); } });
    });
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloading) { reloading = true; location.reload(); } });
}

// ---- start
buildForm(); renderFaq(); applySettings();
show(location.hash.replace(/^#\/?/, ''), true);
if (loaded.status === 'recovered') toast('Your saved data could not be read, so the app started empty. A copy of the old text is kept in this browser.', { timeout: 0 });
if (loaded.status === 'unavailable') toast('Browser storage is blocked, so changes will not be saved. Export your data from Settings to keep it.', { timeout: 0 });
