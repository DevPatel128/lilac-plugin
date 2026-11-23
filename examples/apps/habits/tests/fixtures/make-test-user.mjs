// Writes test-user.json: a SAMPLE first-month user (6 habits, 30 days of mixed history, "Walk" has a broken streak).
// Dates are relative to the day you run it, so streaks look current.  node tests/fixtures/make-test-user.mjs [YYYY-MM-DD]
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { todayKey, addDays } from '../../site/dates.js';

const today = process.argv[2] || todayKey();
const rules = [
  ['h_water', 'Drink water', 7, 'blue', (d) => d % 9 !== 5],
  ['h_stretch', 'Stretch', 5, 'teal', (d) => d % 7 < 5],
  ['h_read', 'Read', 3, 'amber', (d) => d % 2 === 0],
  ['h_walk', 'Walk', 4, 'green', (d) => d >= 7],
  ['h_journal', 'Journal', 2, 'rose', (d) => [1, 4, 8, 11, 15, 18, 22, 25, 29].includes(d)],
  ['h_guitar', 'Practise guitar', 3, 'violet', (d) => d < 10 || (d >= 14 && d <= 20)],
];
const habits = rules.map(([id, name, target, color, f]) => ({
  id, name, target, color, created: addDays(today, -29),
  done: Array.from({ length: 30 }, (_, d) => d).filter(f).map((d) => addDays(today, -d)).sort(),
}));
const out = { app: 'pocket-habits', version: 2, exportedAt: `${today}T08:00:00.000Z`, habits, settings: { tourDone: true, theme: 'system', weekStart: 'mon', motion: 'system' } };
writeFileSync(fileURLToPath(new URL('./test-user.json', import.meta.url)), JSON.stringify(out, null, 2) + '\n');
console.log(`wrote test-user.json for ${today}`);
