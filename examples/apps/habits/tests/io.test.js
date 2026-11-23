import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_IMPORT_BYTES, exportState, parseImport } from '../site/io.js';
import { emptyState, addHabit, setDone } from '../site/store.js';

const TODAY = '2025-11-05';
const H = (o = {}) => ({ id: 'a', name: 'Read', target: 3, color: 'violet', created: '2025-01-01', done: ['2025-01-02'], ...o });
const file = (o) => JSON.stringify({ app: 'pocket-habits', version: 2, habits: [H()], settings: { tourDone: true }, ...o });

test('valid: export then import round-trips', () => {
  let s = addHabit(emptyState(), { name: 'Walk', target: 5, color: 'teal' }, { today: TODAY, id: 'w' }).state;
  s = setDone(s, 'w', TODAY, true, { today: TODAY }).state;
  const text = exportState(s, { now: new Date('2025-11-05T10:00:00Z') });
  const obj = JSON.parse(text);
  assert.equal(obj.app, 'pocket-habits');
  assert.equal(obj.exportedAt, '2025-11-05T10:00:00.000Z');
  const r = parseImport(text, { today: TODAY });
  assert.equal(r.ok, true);
  assert.deepEqual(r.state, s);
  assert.equal(r.count, 1);
});

test('valid: v1 export file is migrated', () => {
  const r = parseImport(JSON.stringify({ version: 1, habits: [{ id: 'x', name: 'Old', color: 'blue', doneDates: ['2025-02-01'] }] }), { today: TODAY });
  assert.equal(r.ok, true);
  assert.equal(r.migrated, true);
  assert.equal(r.state.habits[0].target, 7);
});

test('malformed input is rejected with a message', () => {
  for (const bad of ['not json', '', '[]', 'null', '"s"', '42', '{"version":2}', '{"habits":{}}']) {
    const r = parseImport(bad, { today: TODAY });
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.ok(typeof r.error === 'string' && r.error.length > 8, 'message for ' + bad);
  }
  assert.match(parseImport('{oops', { today: TODAY }).error, /not valid JSON/i);
  assert.match(parseImport(file({ app: 'other' }), { today: TODAY }).error, /not a Pocket Habits/i);
  assert.match(parseImport(file({ version: 9 }), { today: TODAY }).error, /newer/i);
});

test('oversized input is rejected', () => {
  assert.match(parseImport('x'.repeat(MAX_IMPORT_BYTES + 1), { today: TODAY }).error, /too large/i);
  assert.match(parseImport(file() + ' '.repeat(MAX_IMPORT_BYTES), { today: TODAY }).error, /too large/i);
  assert.match(parseImport('€'.repeat(Math.ceil(MAX_IMPORT_BYTES / 3) + 10), { today: TODAY }).error, /too large/i, 'counts bytes, not characters');
  const many = JSON.stringify({ version: 2, habits: Array.from({ length: 101 }, (_, i) => H({ id: 'h' + i })), settings: {} });
  assert.match(parseImport(many, { today: TODAY }).error, /too many/i);
  assert.match(parseImport(file({ habits: [H({ done: Array.from({ length: 4001 }, (_, i) => '2000-01-01') })] }), { today: TODAY }).error, /too many/i);
});

test('prototype pollution keys are rejected and nothing leaks', () => {
  const before = Object.keys(Object.prototype).length;
  const a = parseImport('{"app":"pocket-habits","version":2,"habits":[],"__proto__":{"polluted":true}}', { today: TODAY });
  assert.equal(a.ok, false);
  assert.match(a.error, /unsafe|forbidden/i);
  const b = parseImport('{"version":2,"habits":[{"id":"a","name":"x","target":3,"color":"violet","created":"2025-01-01","done":[],"constructor":{"prototype":{"polluted":1}}}]}', { today: TODAY });
  assert.equal(b.ok, false);
  const c = parseImport('{"version":2,"habits":[{"id":"a","name":"x","target":3,"color":"violet","created":"2025-01-01","done":[],"prototype":{"x":1}}]}', { today: TODAY });
  assert.equal(c.ok, false);
  assert.equal(parseImport('{"version":2,"habits":[],"settings":{"__proto__":{"tourDone":true}}}', { today: TODAY }).ok, false);
  assert.equal(({}).polluted, undefined);
  assert.equal(Object.keys(Object.prototype).length, before);
});

test('duplicate ids and invalid fields are rejected', () => {
  assert.match(parseImport(file({ habits: [H(), H()] }), { today: TODAY }).error, /duplicate/i);
  assert.equal(parseImport(file({ habits: [H({ id: 'bad id!' })] }), { today: TODAY }).ok, false);
  assert.equal(parseImport(file({ habits: [H({ target: 9 })] }), { today: TODAY }).ok, false);
  assert.equal(parseImport(file({ habits: [H({ color: 'red;}' })] }), { today: TODAY }).ok, false);
  assert.equal(parseImport(file({ habits: [H({ done: ['2025-02-30'] })] }), { today: TODAY }).ok, false);
  assert.equal(parseImport(file({ habits: [H({ name: 'a\u0000b' })] }), { today: TODAY }).ok, false);
  assert.equal(parseImport(file({ habits: [H({ name: 'x'.repeat(61) })] }), { today: TODAY }).ok, false);
  assert.equal(parseImport(file({ habits: [H({ created: 'yesterday' })] }), { today: TODAY }).ok, false);
});

test('HTML in names is kept as inert text; unknown keys are dropped', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const r = parseImport(file({ habits: [H({ name: evil, extra: 'drop me' })], evil: 'top' }), { today: TODAY });
  assert.equal(r.ok, true);
  assert.equal(r.state.habits[0].name, evil);
  assert.equal('extra' in r.state.habits[0], false);
  assert.deepEqual(Object.keys(r.state).sort(), ['habits', 'settings', 'version']);
  assert.equal(typeof r.state.habits[0].name, 'string');
});
