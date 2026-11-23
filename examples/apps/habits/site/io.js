// Export and import of the habit list as JSON. Pure: no DOM, no network. Imported text is only ever parsed
// as data and rebuilt through validateState, never evaluated.
import { SCHEMA_VERSION, migrate } from './store.js';

export const MAX_IMPORT_BYTES = 256 * 1024;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function exportState(state, { now = new Date() } = {}) {
  return JSON.stringify({ app: 'pocket-habits', version: SCHEMA_VERSION, exportedAt: now.toISOString(), habits: state.habits, settings: state.settings }, null, 2);
}

function badKey(v, depth = 0) {
  if (depth > 6 || v === null || typeof v !== 'object') return null;
  for (const k of Object.keys(v)) {
    if (BAD_KEYS.has(k)) return k;
    const inner = badKey(v[k], depth + 1);
    if (inner) return inner;
  }
  return null;
}

export function parseImport(text, { today } = {}) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'The file is empty.' };
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) return { ok: false, error: `The file is too large (limit ${MAX_IMPORT_BYTES / 1024} KB).` };
  let raw;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: 'This is not valid JSON. Nothing was imported.' }; }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'This is not a Pocket Habits export.' };
  const bad = badKey(raw);
  if (bad) return { ok: false, error: `The file contains the forbidden key "${bad}". Nothing was imported.` };
  if (raw.app !== undefined && raw.app !== 'pocket-habits') return { ok: false, error: 'This is not a Pocket Habits export.' };
  const m = migrate(raw, { today });
  if (!m.ok) return { ok: false, error: /habit list/.test(m.error) ? 'This is not a Pocket Habits export (no habit list).' : m.error };
  return { ok: true, state: m.state, count: m.state.habits.length, migrated: m.migrated };
}
