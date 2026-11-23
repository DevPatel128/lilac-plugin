// Pure date-key helpers. A key is a calendar day "YYYY-MM-DD". All arithmetic runs in UTC on the key,
// so DST and the viewer's timezone never shift a day. No DOM access.
const RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n, w = 2) => String(n).padStart(w, '0');
export const toKey = (y, m, d) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
export function parseKey(k) {
  const g = typeof k === 'string' ? RE.exec(k) : null;
  if (!g) return null;
  const [y, m, d] = [+g[1], +g[2], +g[3]];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? { y, m, d } : null;
}
export const isValidKey = (k) => parseKey(k) !== null;
export const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const ms = (k) => { const p = parseKey(k); return Date.UTC(p.y, p.m - 1, p.d); };
const fromMs = (t) => { const d = new Date(t); return toKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); };
export const addDays = (k, n) => fromMs(ms(k) + n * 86400000);
export const daysBetween = (a, b) => Math.round((ms(b) - ms(a)) / 86400000);
// 0 = first day of the week. start: 'mon' (default) or 'sun'.
export const weekdayIndex = (k, start = 'mon') => {
  const sun0 = new Date(ms(k)).getUTCDay();
  return start === 'sun' ? sun0 : (sun0 + 6) % 7;
};
export const weekStart = (k, start = 'mon') => addDays(k, -weekdayIndex(k, start));
export const weekKeys = (k, start = 'mon') => { const s = weekStart(k, start); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); };
export const lastNDays = (end, n) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
// now: the clock (injectable). offsetMinutes: minutes east of UTC; omitted means the device's local calendar.
export function todayKey(now = new Date(), offsetMinutes) {
  if (typeof offsetMinutes === 'number') {
    const d = new Date(now.getTime() + offsetMinutes * 60000);
    return toKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return toKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
export const formatKey = (k, locale, opts) => new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(new Date(ms(k)));
