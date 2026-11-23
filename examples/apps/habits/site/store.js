// Storage, schema version, migration, validation and pure reducers. No DOM access: the storage object is injected.
import { isValidKey, addDays } from './dates.js';

export const SCHEMA_VERSION = 2;
export const STORAGE_KEY = 'pocket-habits';
export const LIMITS = { maxHabits: 100, maxName: 60, maxDone: 4000 };
export const PALETTE = [
  { id: 'violet', label: 'Violet' }, { id: 'teal', label: 'Teal' }, { id: 'rose', label: 'Rose' }, { id: 'amber', label: 'Amber' },
  { id: 'green', label: 'Green' }, { id: 'blue', label: 'Blue' }, { id: 'slate', label: 'Slate' }, { id: 'orange', label: 'Orange' },
];
const COLORS = new Set(PALETTE.map((c) => c.id));
const ENUMS = { theme: ['system', 'light', 'dark'], weekStart: ['mon', 'sun'], motion: ['system', 'off'] };
const DEFAULTS = { tourDone: false, theme: 'system', weekStart: 'mon', motion: 'system' };
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const CTRL = /[\u0000-\u001f\u007f]/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export const emptyState = () => ({ version: SCHEMA_VERSION, habits: [], settings: { ...DEFAULTS } });

export function makeId(existing = new Set(), rng = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) {
  for (;;) {
    const id = 'h_' + Math.floor(rng() * 36 ** 8).toString(36).padStart(8, '0');
    if (!existing.has(id)) return id;
  }
}

export function checkFields({ name, target, color }) {
  const errors = {};
  if (typeof name !== 'string' || !name.trim()) errors.name = 'Enter a name.';
  else if (name.trim().length > LIMITS.maxName) errors.name = `Use ${LIMITS.maxName} characters or fewer.`;
  else if (CTRL.test(name)) errors.name = 'Remove control characters from the name.';
  if (!Number.isInteger(target) || target < 1 || target > 7) errors.target = 'Choose 1 to 7 days a week.';
  if (!COLORS.has(color)) errors.color = 'Choose a colour from the list.';
  return errors;
}

function checkSettings(raw) {
  if (raw === undefined) return { settings: { ...DEFAULTS } };
  if (!isObj(raw)) return { error: 'Settings are not an object.' };
  const s = { ...DEFAULTS };
  if (raw.tourDone !== undefined) { if (typeof raw.tourDone !== 'boolean') return { error: 'Setting "tourDone" must be true or false.' }; s.tourDone = raw.tourDone; }
  for (const [k, list] of Object.entries(ENUMS)) {
    if (raw[k] === undefined) continue;
    if (!list.includes(raw[k])) return { error: `Setting "${k}" has an unknown value.` };
    s[k] = raw[k];
  }
  return { settings: s };
}

// Strict: rebuilds the state from whitelisted fields only, so unknown keys never survive.
export function validateState(raw) {
  if (!isObj(raw) || raw.version !== SCHEMA_VERSION || !Array.isArray(raw.habits)) return { ok: false, error: 'Data is not a version 2 habit list.' };
  if (raw.habits.length > LIMITS.maxHabits) return { ok: false, error: `Too many habits (limit ${LIMITS.maxHabits}).` };
  const ids = new Set(), habits = [];
  for (const h of raw.habits) {
    if (!isObj(h)) return { ok: false, error: 'A habit entry is not an object.' };
    if (typeof h.id !== 'string' || !ID_RE.test(h.id)) return { ok: false, error: 'A habit has an invalid id.' };
    if (ids.has(h.id)) return { ok: false, error: `Duplicate habit id "${h.id}".` };
    ids.add(h.id);
    const errs = checkFields(h);
    if (Object.keys(errs).length) return { ok: false, error: `Habit "${String(h.id)}": ${Object.values(errs)[0]}` };
    if (!isValidKey(h.created)) return { ok: false, error: `Habit "${h.id}" has an invalid created date.` };
    if (!Array.isArray(h.done)) return { ok: false, error: `Habit "${h.id}" has an invalid done list.` };
    if (h.done.length > LIMITS.maxDone) return { ok: false, error: `Too many done days in habit "${h.id}" (limit ${LIMITS.maxDone}).` };
    if (!h.done.every(isValidKey)) return { ok: false, error: `Habit "${h.id}" has an invalid done date.` };
    habits.push({ id: h.id, name: h.name.trim(), target: h.target, color: h.color, created: h.created, done: [...new Set(h.done)].sort() });
  }
  const st = checkSettings(raw.settings);
  if (st.error) return { ok: false, error: st.error };
  return { ok: true, state: { version: SCHEMA_VERSION, habits, settings: st.settings } };
}

// v1 shape: { version: 1 | missing, habits: [{ id, name, color, doneDates }] } with free-form colours and no target.
function fromV1(raw, today) {
  const habits = raw.habits.slice(0, LIMITS.maxHabits).map((h) => {
    const done = (Array.isArray(h?.doneDates) ? h.doneDates : []).filter(isValidKey);
    return { id: h?.id, name: h?.name, target: 7, color: COLORS.has(h?.color) ? h.color : 'violet', created: [...done].sort()[0] || today, done };
  });
  return { version: SCHEMA_VERSION, habits, settings: { ...DEFAULTS } };
}

export function migrate(raw, { today } = {}) {
  if (!isObj(raw)) return { ok: false, error: 'Data is not an object.' };
  if (typeof raw.version === 'number' && raw.version > SCHEMA_VERSION) return { ok: false, error: `This data comes from a newer version (${raw.version}) of the app.` };
  if (!Array.isArray(raw.habits)) return { ok: false, error: 'Data has no habit list.' };
  if (raw.version === undefined || raw.version === 1) {
    const v = validateState(fromV1(raw, today || '1970-01-01'));
    return v.ok ? { ok: true, state: v.state, migrated: true } : v;
  }
  const v = validateState(raw);
  return v.ok ? { ok: true, state: v.state, migrated: false } : v;
}

// status: empty | ok | migrated | recovered | unavailable
export function load(storage, { today } = {}) {
  let raw;
  try { raw = storage.getItem(STORAGE_KEY); } catch { return { state: emptyState(), status: 'unavailable' }; }
  if (raw === null || raw === undefined) return { state: emptyState(), status: 'empty' };
  let parsed, err = '';
  try { parsed = JSON.parse(raw); } catch (e) { err = 'invalid JSON'; }
  const m = err ? { ok: false, error: err } : migrate(parsed, { today });
  if (m.ok) return { state: m.state, status: m.migrated ? 'migrated' : 'ok' };
  try { storage.setItem(STORAGE_KEY + ':backup', raw); storage.removeItem(STORAGE_KEY); } catch { /* backup is best effort */ }
  return { state: emptyState(), status: 'recovered', error: m.error };
}

export function save(storage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return { ok: true }; } catch (e) {
    const quota = e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
    return { ok: false, reason: quota ? 'quota' : 'unavailable' };
  }
}

const withHabits = (s, habits) => ({ ...s, habits });
export function addHabit(state, fields, { today, id } = {}) {
  const errors = checkFields(fields);
  if (state.habits.length >= LIMITS.maxHabits) errors.limit = `You can track up to ${LIMITS.maxHabits} habits.`;
  if (Object.keys(errors).length) return { ok: false, errors };
  const habit = { id: id || makeId(new Set(state.habits.map((h) => h.id))), name: fields.name.trim(), target: fields.target, color: fields.color, created: today, done: [] };
  return { ok: true, habit, state: withHabits(state, [...state.habits, habit]) };
}
export function updateHabit(state, id, fields) {
  const cur = state.habits.find((h) => h.id === id);
  if (!cur) return { ok: false, errors: { id: 'Habit not found.' } };
  const next = { ...cur, ...fields };
  const errors = checkFields(next);
  if (Object.keys(errors).length) return { ok: false, errors };
  next.name = next.name.trim();
  return { ok: true, state: withHabits(state, state.habits.map((h) => (h.id === id ? next : h))) };
}
export function deleteHabit(state, id) {
  const index = state.habits.findIndex((h) => h.id === id);
  if (index < 0) return { state, removed: null, index: -1 };
  return { state: withHabits(state, state.habits.filter((h) => h.id !== id)), removed: state.habits[index], index };
}
export function restoreHabit(state, habit, index) {
  const at = Math.max(0, Math.min(index, state.habits.length));
  return withHabits(state, [...state.habits.slice(0, at), habit, ...state.habits.slice(at)]);
}
export function setDone(state, id, key, done, { today } = {}) {
  const cur = state.habits.find((h) => h.id === id);
  if (!cur) return { ok: false, error: 'Habit not found.' };
  if (!isValidKey(key)) return { ok: false, error: 'Invalid day.' };
  if (today && key > today) return { ok: false, error: 'You cannot mark a future day.' };
  const set = new Set(cur.done);
  if (done) set.add(key); else set.delete(key);
  return { ok: true, state: withHabits(state, state.habits.map((h) => (h.id === id ? { ...h, done: [...set].sort() } : h))) };
}
export const updateSettings = (state, patch) => {
  const v = checkSettings({ ...state.settings, ...patch });
  return v.error ? { ok: false, error: v.error } : { ok: true, state: { ...state, settings: v.settings } };
};
// Invented starter habits (SAMPLE), with a few past days ticked so streaks show straight away.
export function sampleHabits(state, today) {
  const rows = [['Drink water', 7, 'blue', [0, 1, 2, 4]], ['Stretch', 5, 'teal', [1, 2, 3]], ['Read', 3, 'amber', [0, 2]]];
  let s = state;
  for (const [name, target, color, back] of rows) {
    const r = addHabit(s, { name, target, color }, { today: addDays(today, -6) });
    if (!r.ok) break;
    s = withHabits(r.state, r.state.habits.map((h) => (h.id === r.habit.id ? { ...h, done: back.map((n) => addDays(today, -n)).sort() } : h)));
  }
  return s;
}
