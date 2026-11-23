import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toKey, parseKey, isValidKey, isLeapYear, daysInMonth, addDays, weekdayIndex, weekStart, weekKeys, daysBetween, lastNDays, todayKey, formatKey } from '../site/dates.js';

test('keys: format and strict parsing', () => {
  assert.equal(toKey(2024, 2, 29), '2024-02-29');
  assert.equal(toKey(2025, 1, 5), '2025-01-05');
  assert.deepEqual(parseKey('2024-02-29'), { y: 2024, m: 2, d: 29 });
  assert.equal(parseKey('2024-02-30'), null);
  assert.equal(parseKey('2023-02-29'), null);
  assert.equal(parseKey('2024-2-9'), null);
  assert.equal(parseKey('2024-02-29 '), null);
  assert.equal(parseKey(20240229), null);
  assert.equal(isValidKey('2025-13-01'), false);
  assert.equal(isValidKey('2025-12-31'), true);
});

test('leap years and month length', () => {
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(1900), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(2100), false);
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2025, 2), 28);
});

test('addDays: leap day, year end, DST weekends', () => {
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2024-02-29', 1), '2024-03-01');
  assert.equal(addDays('2023-02-28', 1), '2023-03-01');
  assert.equal(addDays('2024-12-31', 1), '2025-01-01');
  assert.equal(addDays('2025-01-01', -1), '2024-12-31');
  assert.equal(addDays('2025-03-08', 2), '2025-03-10', 'US spring forward 2025-03-09');
  assert.equal(addDays('2025-03-29', 2), '2025-03-31', 'EU spring forward 2025-03-30');
  assert.equal(addDays('2025-11-01', 2), '2025-11-03', 'US fall back 2025-11-02');
  assert.equal(addDays(addDays('2024-02-29', 400), -400), '2024-02-29');
});

test('week starts Monday', () => {
  assert.equal(weekdayIndex('2025-11-03'), 0);
  assert.equal(weekdayIndex('2025-11-09'), 6);
  assert.equal(weekdayIndex('2024-02-29'), 3);
  assert.equal(weekStart('2025-11-03'), '2025-11-03');
  assert.equal(weekStart('2025-11-09'), '2025-11-03');
  assert.equal(weekStart('2025-01-01'), '2024-12-30');
  assert.equal(weekStart('2024-03-01'), '2024-02-26');
  assert.deepEqual(weekKeys('2024-02-29'), ['2024-02-26', '2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01', '2024-03-02', '2024-03-03']);
});

test('daysBetween and lastNDays', () => {
  assert.equal(daysBetween('2024-02-28', '2024-03-01'), 2);
  assert.equal(daysBetween('2023-12-31', '2025-01-01'), 367);
  assert.equal(daysBetween('2025-03-01', '2025-02-01'), -28);
  assert.deepEqual(lastNDays('2024-03-01', 3), ['2024-02-28', '2024-02-29', '2024-03-01']);
  assert.equal(lastNDays('2025-11-05', 7).length, 7);
});

test('todayKey: clock and offset parameter', () => {
  const late = new Date('2025-11-03T23:30:00Z');
  assert.equal(todayKey(late, 0), '2025-11-03');
  assert.equal(todayKey(late, 60), '2025-11-04');
  assert.equal(todayKey(late, -300), '2025-11-03');
  assert.equal(todayKey(late, 840), '2025-11-04', 'UTC+14');
  const early = new Date('2025-11-03T00:30:00Z');
  assert.equal(todayKey(early, 0), '2025-11-03');
  assert.equal(todayKey(early, -60), '2025-11-02');
  assert.equal(todayKey(early, -720), '2025-11-02', 'UTC-12');
  assert.equal(todayKey(new Date('2024-02-29T23:59:00Z'), 60), '2024-03-01');
  const instant = new Date('2025-03-09T04:30:00Z');
  assert.equal(todayKey(instant, -300), '2025-03-08', 'EST before spring forward');
  assert.equal(todayKey(instant, -240), '2025-03-09', 'same instant, EDT offset');
  assert.equal(todayKey(new Date(2025, 10, 3, 23, 30)), '2025-11-03', 'local fields without offset');
  assert.equal(todayKey(new Date(2024, 1, 29, 0, 5)), '2024-02-29');
});

test('formatKey is timezone independent', () => {
  assert.equal(formatKey('2024-02-29', 'en-US', { weekday: 'short', month: 'short', day: 'numeric' }), 'Thu, Feb 29');
});

test('week can start on Sunday', () => {
  assert.equal(weekdayIndex('2025-11-09', 'sun'), 0);
  assert.equal(weekdayIndex('2025-11-03', 'sun'), 1);
  assert.equal(weekStart('2025-11-09', 'sun'), '2025-11-09');
  assert.equal(weekStart('2025-11-08', 'sun'), '2025-11-02');
  assert.deepEqual(weekKeys('2024-03-01', 'sun')[0], '2024-02-25');
  assert.equal(weekStart('2025-11-09'), '2025-11-03', 'default is Monday');
});
