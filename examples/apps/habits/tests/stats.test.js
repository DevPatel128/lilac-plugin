import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentStreak, bestStreak, weekCount, weeklyStreak, weeklyCompletion, heatmap } from '../site/stats.js';

const H = (done, o = {}) => ({ id: o.id || 'h', name: 'x', target: o.target ?? 7, color: 'violet', created: o.created || '2020-01-01', done });
const T = '2025-11-05'; // Wednesday

test('current streak: today done counts', () => {
  assert.equal(currentStreak(H(['2025-11-05', '2025-11-04', '2025-11-03']), T), 3);
});
test('current streak: today not yet done keeps the streak', () => {
  assert.equal(currentStreak(H(['2025-11-04', '2025-11-03']), T), 2);
});
test('current streak: a gap resets it', () => {
  assert.equal(currentStreak(H(['2025-11-05', '2025-11-03']), T), 1);
  assert.equal(currentStreak(H(['2025-11-03', '2025-11-02']), T), 0, 'yesterday and today both missing');
});
test('current streak: empty, future and duplicates', () => {
  assert.equal(currentStreak(H([]), T), 0);
  assert.equal(currentStreak(H(['2025-11-06']), T), 0, 'future day ignored');
  assert.equal(currentStreak(H(['2025-11-05', '2025-11-06']), T), 1);
  assert.equal(currentStreak(H(['2025-11-05', '2025-11-05', '2025-11-04']), T), 2);
});
test('current streak crosses month and leap day', () => {
  assert.equal(currentStreak(H(['2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02']), '2024-03-02'), 4);
});
test('best streak', () => {
  assert.equal(bestStreak(H([])), 0);
  assert.equal(bestStreak(H(['2025-01-01'])), 1);
  assert.equal(bestStreak(H(['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-05', '2025-01-06'])), 3);
  assert.equal(bestStreak(H(['2025-01-06', '2025-01-05', '2025-01-01', '2025-01-02', '2025-01-02'])), 2, 'unsorted and duplicated');
});
test('week count uses Monday to Sunday', () => {
  const h = H(['2025-11-02', '2025-11-03', '2025-11-04', '2025-11-05']);
  assert.equal(weekCount(h, '2025-11-05'), 3);
  assert.equal(weekCount(h, '2025-11-09'), 3, 'Sunday belongs to the same week');
  assert.equal(weekCount(h, '2025-11-02'), 1, 'Sunday 2 Nov is the previous week');
});
test('weekly streak honours the target', () => {
  const prev = ['2025-10-27', '2025-10-28', '2025-10-30', '2025-10-20', '2025-10-21', '2025-10-22', '2025-10-13', '2025-10-14'];
  assert.equal(weeklyStreak(H([...prev, '2025-11-03', '2025-11-04'], { target: 3 }), T), 2, 'current week in progress is ignored');
  assert.equal(weeklyStreak(H([...prev, '2025-11-03', '2025-11-04', '2025-11-05'], { target: 3 }), T), 3, 'current week met counts');
  assert.equal(weeklyStreak(H(prev, { target: 4 }), T), 0, 'target not met');
  assert.equal(weeklyStreak(H(['2025-10-27', '2025-10-28', '2025-10-29', '2025-10-30', '2025-10-31', '2025-11-01', '2025-11-02'], { target: 7 }), T), 1);
});
test('weekly completion caps at target and skips habits not yet created', () => {
  const A = H(['2025-10-28', '2025-10-30', '2025-11-03', '2025-11-04', '2025-11-05'], { id: 'a', target: 2 });
  const B = H(['2025-10-29'], { id: 'b', target: 4 });
  const r = weeklyCompletion([A, B], T, 2);
  assert.equal(r.length, 2);
  assert.equal(r[0].start, '2025-10-27');
  assert.deepEqual([r[0].done, r[0].goal, r[0].pct], [3, 6, 50]);
  assert.deepEqual([r[1].done, r[1].goal, r[1].pct], [2, 6, 33]);
  const C = H([], { id: 'c', target: 7, created: '2025-11-04' });
  const r2 = weeklyCompletion([C], T, 2);
  assert.deepEqual([r2[0].goal, r2[0].pct], [0, 0]);
  assert.equal(r2[1].goal, 7);
  assert.equal(weeklyCompletion([], T, 4).length, 4);
});
test('heatmap grid', () => {
  const h = H(['2025-11-03', '2025-11-05'], { created: '2025-11-03' });
  const g = heatmap([h], T, 2);
  assert.equal(g.weeks.length, 2);
  assert.equal(g.weeks[0].start, '2025-10-27');
  assert.equal(g.weeks[0].days.length, 7);
  assert.equal(g.weeks[0].days[0].total, 0, 'before created');
  const w = g.weeks[1].days;
  assert.deepEqual([w[0].done, w[0].total], [1, 1]);
  assert.deepEqual([w[1].done, w[1].total], [0, 1]);
  assert.equal(w[2].done, 1);
  assert.equal(w[3].future, true);
  assert.equal(w[2].future, false);
});

test('week start setting changes weekly numbers', () => {
  const h = H(['2025-11-02', '2025-11-03', '2025-11-04']);
  assert.equal(weekCount(h, '2025-11-05'), 2);
  assert.equal(weekCount(h, '2025-11-05', 'sun'), 3, 'Sunday 2 Nov starts the week');
  assert.equal(weeklyCompletion([H([], { target: 2 })], T, 1, 'sun')[0].start, '2025-11-02');
  assert.equal(heatmap([h], T, 1, 'sun').weeks[0].start, '2025-11-02');
  assert.equal(weeklyStreak(H(['2025-11-02', '2025-11-03', '2025-11-04'], { target: 3 }), T, 'sun'), 1);
});
