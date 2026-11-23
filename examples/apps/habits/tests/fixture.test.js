import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseImport } from '../site/io.js';
import { currentStreak, bestStreak } from '../site/stats.js';

const text = readFileSync(new URL('./fixtures/test-user.json', import.meta.url), 'utf8');
const day = JSON.parse(text).exportedAt.slice(0, 10);

test('test-user.json imports through the same validator as the Import screen', () => {
  const r = parseImport(text, { today: day });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.count, 6);
  assert.ok(r.state.habits.every((h) => h.done.length > 0 && h.done.length <= 30));
});
test('test-user.json: Walk has a broken streak, Guitar a live one', () => {
  const { state } = parseImport(text, { today: day });
  const walk = state.habits.find((h) => h.id === 'h_walk'), guitar = state.habits.find((h) => h.id === 'h_guitar');
  assert.equal(currentStreak(walk, day), 0);
  assert.equal(bestStreak(walk), 23);
  assert.equal(currentStreak(guitar, day), 10);
  assert.ok(bestStreak(guitar) >= 10);
});
