import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA_VERSION, STORAGE_KEY, emptyState, migrate, validateState, load, save, addHabit, updateHabit, deleteHabit, restoreHabit, setDone, makeId } from '../site/store.js';

class Mem {
  constructor(init = {}) { this.m = new Map(Object.entries(init)); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { if (this.fail) throw this.fail; this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
}
const V1 = { version: 1, habits: [{ id: 'a1', name: 'Read', color: '#ff0000', doneDates: ['2025-11-01', '2025-11-03', 'bogus'] }] };
const TODAY = '2025-11-05';

test('empty state and schema version', () => {
  assert.equal(SCHEMA_VERSION, 2);
  assert.deepEqual(emptyState(), { version: 2, habits: [], settings: { tourDone: false, theme: 'system', weekStart: 'mon', motion: 'system' } });
});

test('migration v1 to v2', () => {
  const r = migrate(V1, { today: TODAY });
  assert.equal(r.ok, true);
  assert.equal(r.migrated, true);
  assert.equal(r.state.version, 2);
  const h = r.state.habits[0];
  assert.equal(h.target, 7);
  assert.equal(h.color, 'violet', 'unknown colour falls back');
  assert.deepEqual(h.done, ['2025-11-01', '2025-11-03']);
  assert.equal(h.created, '2025-11-01');
  assert.equal(r.state.settings.tourDone, false);
  assert.equal(r.state.settings.weekStart, 'mon');
  assert.equal(migrate({ version: 1, habits: [{ id: 'z', name: 'Z', color: 'teal', doneDates: [] }] }, { today: TODAY }).state.habits[0].created, TODAY);
  assert.equal(migrate({ version: 1, habits: [{ id: 'z', name: 'Z', color: 'teal', doneDates: [] }] }, { today: TODAY }).state.habits[0].color, 'teal');
  assert.equal(migrate({ habits: V1.habits }, { today: TODAY }).ok, true, 'missing version is treated as v1');
});

test('migration rejects bad shapes and newer versions', () => {
  assert.match(migrate({ version: 3, habits: [] }).error, /newer/i);
  assert.equal(migrate(null).ok, false);
  assert.equal(migrate('x').ok, false);
  assert.equal(migrate({ version: 2, habits: 'no' }).ok, false);
  const v2 = { version: 2, habits: [{ id: 'a', name: 'A', target: 3, color: 'rose', created: '2025-01-01', done: ['2025-01-02'] }], settings: { tourDone: true, theme: 'dark', weekStart: 'sun', motion: 'off' } };
  const r = migrate(v2);
  assert.equal(r.ok, true);
  assert.equal(r.migrated, false);
  assert.deepEqual(r.state, v2);
});

test('load: empty, migrated, corrupted, unavailable', () => {
  assert.equal(load(new Mem(), { today: TODAY }).status, 'empty');
  const s1 = new Mem({ [STORAGE_KEY]: JSON.stringify(V1) });
  const l1 = load(s1, { today: TODAY });
  assert.equal(l1.status, 'migrated');
  assert.equal(l1.state.version, 2);
  const s2 = new Mem({ [STORAGE_KEY]: '{not json' });
  const l2 = load(s2, { today: TODAY });
  assert.equal(l2.status, 'recovered');
  assert.deepEqual(l2.state, emptyState());
  assert.equal(s2.getItem(STORAGE_KEY + ':backup'), '{not json', 'raw text kept for manual recovery');
  assert.equal(load(s2, { today: TODAY }).status, 'empty', 'corrupt key cleared after recovery');
  const s3 = new Mem({ [STORAGE_KEY]: JSON.stringify({ version: 2, habits: [{ id: 'a', name: '', target: 3, color: 'rose', created: '2025-01-01', done: [] }] }) });
  assert.equal(load(s3, { today: TODAY }).status, 'recovered', 'invalid content is treated like corruption');
  const bad = { getItem() { throw new Error('blocked'); } };
  const l4 = load(bad, { today: TODAY });
  assert.equal(l4.status, 'unavailable');
  assert.deepEqual(l4.state, emptyState());
  assert.equal(load(null, { today: TODAY }).status, 'unavailable');
});

test('save: round trip and quota handling', () => {
  const s = new Mem();
  const st = addHabit(emptyState(), { name: 'Walk', target: 5, color: 'teal' }, { today: TODAY }).state;
  assert.deepEqual(save(s, st), { ok: true });
  assert.deepEqual(load(s, { today: TODAY }).state, st);
  s.fail = Object.assign(new Error('full'), { name: 'QuotaExceededError' });
  const q = save(s, st);
  assert.equal(q.ok, false);
  assert.equal(q.reason, 'quota');
  s.fail = Object.assign(new Error('x'), { code: 22 });
  assert.equal(save(s, st).reason, 'quota');
  s.fail = new Error('denied');
  assert.equal(save(s, st).reason, 'unavailable');
  assert.deepEqual(load(new Mem({ [STORAGE_KEY]: s.getItem(STORAGE_KEY) }), { today: TODAY }).state, st, 'previous data intact after failed write');
});

test('addHabit validates and trims', () => {
  const ok = addHabit(emptyState(), { name: '  Drink water  ', target: 4, color: 'blue' }, { today: TODAY, id: 'h_1' });
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.habit, { id: 'h_1', name: 'Drink water', target: 4, color: 'blue', created: TODAY, done: [] });
  assert.equal(addHabit(emptyState(), { name: '   ', target: 3, color: 'blue' }, { today: TODAY }).errors.name.length > 0, true);
  assert.ok(addHabit(emptyState(), { name: 'x'.repeat(61), target: 3, color: 'blue' }, { today: TODAY }).errors.name);
  for (const t of [0, 8, 2.5, '3', NaN]) assert.ok(addHabit(emptyState(), { name: 'a', target: t, color: 'blue' }, { today: TODAY }).errors.target, 'target ' + t);
  assert.ok(addHabit(emptyState(), { name: 'a', target: 3, color: 'hotpink' }, { today: TODAY }).errors.color);
  assert.ok(addHabit(emptyState(), { name: 'a\u0007b', target: 3, color: 'blue' }, { today: TODAY }).errors.name, 'control characters');
  assert.equal(addHabit(emptyState(), { name: '<b>x</b>', target: 3, color: 'blue' }, { today: TODAY }).habit.name, '<b>x</b>', 'HTML kept as text');
  let full = emptyState();
  for (let i = 0; i < 100; i++) full = addHabit(full, { name: 'h' + i, target: 1, color: 'blue' }, { today: TODAY }).state;
  assert.ok(addHabit(full, { name: 'one more', target: 1, color: 'blue' }, { today: TODAY }).errors.limit);
});

test('reducers do not mutate their input', () => {
  const s0 = emptyState();
  const s1 = addHabit(s0, { name: 'A', target: 3, color: 'rose' }, { today: TODAY, id: 'a' }).state;
  assert.equal(s0.habits.length, 0);
  const s2 = setDone(s1, 'a', TODAY, true, { today: TODAY }).state;
  assert.equal(s1.habits[0].done.length, 0);
  assert.equal(s2.habits[0].done.length, 1);
});

test('update, delete and restore', () => {
  let s = emptyState();
  for (const id of ['a', 'b', 'c']) s = addHabit(s, { name: id.toUpperCase(), target: 3, color: 'rose' }, { today: TODAY, id }).state;
  const u = updateHabit(s, 'b', { name: 'Bee', target: 6, color: 'green' });
  assert.equal(u.ok, true);
  assert.deepEqual([u.state.habits[1].name, u.state.habits[1].target, u.state.habits[1].color], ['Bee', 6, 'green']);
  assert.ok(updateHabit(s, 'b', { name: '' }).errors.name);
  assert.equal(updateHabit(s, 'nope', { name: 'x' }).ok, false);
  const d = deleteHabit(s, 'b');
  assert.equal(d.removed.id, 'b');
  assert.equal(d.index, 1);
  assert.deepEqual(d.state.habits.map((h) => h.id), ['a', 'c']);
  assert.deepEqual(restoreHabit(d.state, d.removed, d.index).habits.map((h) => h.id), ['a', 'b', 'c']);
  assert.deepEqual(restoreHabit(d.state, d.removed, 99).habits.map((h) => h.id), ['a', 'c', 'b'], 'index clamped');
  assert.equal(deleteHabit(s, 'zzz').removed, null);
});

test('setDone: sorted, unique, validated', () => {
  const s = addHabit(emptyState(), { name: 'A', target: 3, color: 'rose' }, { today: TODAY, id: 'a' }).state;
  let r = setDone(s, 'a', '2025-11-04', true, { today: TODAY });
  r = setDone(r.state, 'a', '2025-11-02', true, { today: TODAY });
  r = setDone(r.state, 'a', '2025-11-02', true, { today: TODAY });
  assert.deepEqual(r.state.habits[0].done, ['2025-11-02', '2025-11-04']);
  r = setDone(r.state, 'a', '2025-11-02', false, { today: TODAY });
  assert.deepEqual(r.state.habits[0].done, ['2025-11-04']);
  assert.equal(setDone(s, 'a', '2025-11-06', true, { today: TODAY }).ok, false, 'future day');
  assert.equal(setDone(s, 'a', 'nope', true, { today: TODAY }).ok, false);
  assert.equal(setDone(s, 'zz', TODAY, true, { today: TODAY }).ok, false);
});

test('ids and validateState', () => {
  assert.match(makeId(new Set()), /^h_[a-z0-9]{6,}$/);
  assert.notEqual(makeId(new Set()), makeId(new Set()));
  assert.equal(validateState({ version: 2, habits: [], settings: {} }).ok, true);
  assert.equal(validateState({ version: 2, habits: [], settings: { tourDone: 'yes' } }).ok, false);
  assert.equal(validateState({ version: 2, habits: [], settings: { theme: 'neon' } }).ok, false);
  assert.equal(validateState({ version: 2, habits: [], settings: { weekStart: 'tue' } }).ok, false);
  assert.equal(validateState({ version: 2, habits: [], settings: { motion: 'wild' } }).ok, false);
  assert.deepEqual(validateState({ version: 2, habits: [] }).state.settings, { tourDone: false, theme: 'system', weekStart: 'mon', motion: 'system' }, 'defaults filled');
});
