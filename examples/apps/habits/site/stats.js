// Pure streak and completion maths over habit objects. No DOM access.
// A habit: { id, name, target 1..7, color, created: key, done: [keys] }. `ws` is the week start: 'mon' or 'sun'.
import { addDays, weekStart, weekKeys, daysBetween, lastNDays } from './dates.js';

const cache = new WeakMap();
const setOf = (h) => { let s = cache.get(h.done); if (!s) { s = new Set(h.done); cache.set(h.done, s); } return s; };
export const isDone = (h, k) => setOf(h).has(k);

// Consecutive done days ending today; if today is not done yet the streak ending yesterday still counts.
export function currentStreak(h, today) {
  const s = setOf(h);
  let k = s.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (s.has(k)) { n++; k = addDays(k, -1); }
  return n;
}
export function bestStreak(h) {
  const keys = [...setOf(h)].sort();
  let best = 0, run = 0, prev = null;
  for (const k of keys) { run = prev && daysBetween(prev, k) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = k; }
  return best;
}
export const weekCount = (h, key, ws = 'mon') => weekKeys(key, ws).filter((k) => isDone(h, k)).length;
// Consecutive weeks that reached the target. The week in progress counts only once it is met.
export function weeklyStreak(h, today, ws = 'mon') {
  const first = weekStart(h.created, ws);
  let w = weekStart(today, ws), n = 0;
  if (weekCount(h, w, ws) >= h.target) n++;
  for (w = addDays(w, -7); daysBetween(first, w) >= 0; w = addDays(w, -7)) {
    if (weekCount(h, w, ws) >= h.target) n++; else break;
  }
  return n;
}
// Oldest first. Each habit contributes min(done, target) over target, from the week it was created.
export function weeklyCompletion(habits, today, weeks = 4, ws = 'mon') {
  const cur = weekStart(today, ws);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(cur, (i - weeks + 1) * 7), end = addDays(start, 6);
    let done = 0, goal = 0;
    for (const h of habits) {
      if (h.created > end) continue;
      goal += h.target; done += Math.min(weekCount(h, start, ws), h.target);
    }
    return { start, end, done, goal, pct: goal ? Math.round((done / goal) * 100) : 0 };
  });
}
export function heatmap(habits, today, weeks = 8, ws = 'mon') {
  const cur = weekStart(today, ws);
  return {
    weeks: Array.from({ length: weeks }, (_, i) => {
      const start = addDays(cur, (i - weeks + 1) * 7);
      return { start, days: weekKeys(start, ws).map((key) => {
        const live = habits.filter((h) => h.created <= key);
        return { key, total: live.length, done: live.filter((h) => isDone(h, key)).length, future: key > today };
      }) };
    }),
  };
}
export { lastNDays };
