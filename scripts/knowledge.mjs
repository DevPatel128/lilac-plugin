#!/usr/bin/env node
// Lilac knowledge records: "no source and quote, no claim".
// Usage: node scripts/knowledge.mjs validate <dir>
//        node scripts/knowledge.mjs stale <dir> [--days 14]
//        node scripts/knowledge.mjs plan <dir> [--vertical <name>]       prints the consent screen, fetches nothing, writes nothing
//        node scripts/knowledge.mjs propose <dir> --from <json> [--project <dir>]   writes .lilac/research/proposal-<date>.json, never edits records
//        node scripts/knowledge.mjs log-network <url> [--project <dir>] [--note <text>]   appends to .lilac/network.log
// A record is one .json file: topic, claim, value, source_url, quote (>= 20 chars, verbatim), retrieved, expires, confidence (official|secondary|community),
// volatility (library-version 30 days | pricing 90 | browser-support 90 | design-trend 180), status, conflict_with. Files starting with "_" are ignored.
// Offline: this script makes NO network calls. The researcher agent fetches pages only after the user says yes, then calls log-network.
// shortcut: JSON records only (no YAML front matter), and the quote is not re-checked against the live page; upgrade when records are fetched by script.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { safeWriteFile } from '../lib/safe-fs.mjs';

export const WINDOW = { 'library-version': 30, pricing: 90, 'browser-support': 90, 'design-trend': 180 };
const CONF = ['official', 'secondary', 'community'];
const DAY = 86400000;
const today = () => process.env.LILAC_TODAY || new Date().toISOString().slice(0, 10);
const ms = (d) => Date.parse(d + 'T00:00:00Z');

function files(dir) {
  const out = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('_') || e.name.startsWith('.')) continue;
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.json')) out.push(p);
  } };
  if (existsSync(dir)) walk(dir);
  return out.sort();
}

/** Returns a list of problems for one record ([] = good). */
export function check(r) {
  const p = [];
  if (!r || typeof r !== 'object') return ['not an object'];
  if (!r.topic) p.push('missing topic');
  if (!r.claim) p.push('missing claim');
  if (!/^https?:\/\/\S+$/.test(r.source_url || '')) p.push('missing source_url (no source, no claim)');
  if (!r.quote || String(r.quote).trim().length < 20) p.push('missing or short quote (verbatim quote of 20+ characters required)');
  if (!CONF.includes(r.confidence)) p.push(`confidence must be one of ${CONF.join('|')}`);
  const win = WINDOW[r.volatility];
  if (!win) p.push(`volatility must be one of ${Object.keys(WINDOW).join('|')}`);
  if (isNaN(ms(r.retrieved))) p.push('retrieved must be YYYY-MM-DD');
  if (isNaN(ms(r.expires))) p.push('expires must be YYYY-MM-DD');
  if (win && !isNaN(ms(r.retrieved)) && !isNaN(ms(r.expires))) {
    const days = Math.round((ms(r.expires) - ms(r.retrieved)) / DAY);
    if (days > win) p.push(`expiry ${days} days after retrieval exceeds ${win} days allowed for ${r.volatility}`);
    if (days < 0) p.push('expires is before retrieved');
  }
  if (r.confidence === 'community' && r.status !== 'needs-verification') p.push('community confidence can only have status needs-verification');
  return p;
}

function load(dir) {
  return files(dir).map((f) => { try { return { f, r: JSON.parse(readFileSync(f, 'utf8')) }; } catch (e) { return { f, r: null, err: `invalid JSON (${e.message})` }; } });
}

/** Same topic with different values must each carry conflict_with; they stay side by side. */
export function conflicts(recs) {
  const by = {};
  for (const x of recs) if (x.r?.topic) (by[x.r.topic] ||= []).push(x);
  const bad = [];
  for (const [t, list] of Object.entries(by)) {
    if (new Set(list.map((x) => JSON.stringify(x.r.value))).size < 2) continue;
    for (const x of list) if (!String(x.r.conflict_with || '').trim()) bad.push(`${x.f}: topic "${t}" conflicts with another record, add a conflict_with note`);
  }
  return bad;
}

function validate(dir) {
  const recs = load(dir); const errs = [];
  for (const x of recs) { for (const m of x.err ? [x.err] : check(x.r)) errs.push(`${x.f}: ${m}`); }
  errs.push(...conflicts(recs.filter((x) => x.r)));
  if (errs.length) { console.error(errs.join('\n')); console.error(`${errs.length} problem(s) in ${recs.length} record(s)`); process.exit(1); }
  console.log(`${recs.length} record(s) valid`);
}

function staleList(dir, days) {
  const now = ms(today());
  return load(dir).filter((x) => x.r && !isNaN(ms(x.r.expires)) && ms(x.r.expires) - now <= days * DAY)
    .map((x) => ({ f: x.f, r: x.r, expired: ms(x.r.expires) < now }));
}

const args = process.argv.slice(2);
const [cmd, a] = args;
const opt = (n) => { const i = args.indexOf(n); return i > 0 ? args[i + 1] : undefined; };
const fail = (m) => { console.error(`knowledge: ${m}`); process.exit(2); };
if (!cmd || !a) fail('usage: validate|stale|plan <dir> | propose <dir> --from <json> | log-network <url>');

if (cmd === 'validate') validate(resolve(a));
else if (cmd === 'stale' || cmd === 'plan') {
  let s = staleList(resolve(a), Number(opt('--days') ?? 14));
  const v = opt('--vertical');
  if (cmd === 'plan' && v) s = s.filter((x) => x.r.vertical === v || x.f.split(/[\\/]/).includes(v));
  if (cmd === 'stale') {
    for (const x of s) console.log(`${x.expired ? 'EXPIRED' : 'near-expiry'}  expires ${x.r.expires}  retrieved ${x.r.retrieved}  ${x.f}`);
    console.log(`${s.length} stale or near-expiry file(s)`);
  } else {
    const urls = [...new Set(s.map((x) => x.r.source_url))];
    console.log(`${s.length} files are stale. Fetch these URLs now?`);
    for (const u of urls) console.log(`  ${u}`);
    console.log('Nothing has been fetched. Fetching starts only after the user answers yes.');
  }
} else if (cmd === 'propose') {
  const from = opt('--from'); if (!from) fail('propose needs --from <json>');
  let inp; try { inp = JSON.parse(readFileSync(resolve(from), 'utf8')); } catch (e) { fail(`cannot read ${from}: ${e.message}`); }
  const list = Array.isArray(inp) ? inp : inp.records;
  if (!Array.isArray(list)) fail('--from must hold an array or {"records": [...]}');
  const have = load(resolve(a)).filter((x) => x.r);
  const changes = []; const rejected = [];
  list.forEach((r, i) => {
    const p = check(r);
    if (p.length) return rejected.push({ index: i, problems: p });
    const old = have.find((x) => x.r.topic === r.topic && x.r.source_url === r.source_url);
    changes.push({ action: old ? 'replace' : 'add', file: old?.f ?? null, before: old?.r ?? null, after: r });
  });
  const proj = resolve(opt('--project') ?? process.cwd());
  const name = `.lilac/research/proposal-${today()}-${Date.now()}.json`;
  safeWriteFile(proj, name, JSON.stringify({ proposed: today(), applied: false, changes, rejected }, null, 2) + '\n');
  console.log(`${changes.length} change(s) proposed, ${rejected.length} rejected: ${name}. Records were not edited; apply after the user approves.`);
} else if (cmd === 'log-network') {
  const proj = resolve(opt('--project') ?? process.cwd());
  const url = a.replace(/[?#].*$/, '').replace(/[\r\n]/g, ''); // query strings can carry secrets
  const log = join(proj, '.lilac/network.log');
  const prev = existsSync(log) ? readFileSync(log, 'utf8') : '';
  const note = (opt('--note') ?? '').replace(/[\r\n]/g, ' ');
  safeWriteFile(proj, '.lilac/network.log', `${prev}${new Date().toISOString()}\t${url}\t${note}\n`, { overwrite: true });
  console.log('logged');
} else fail(`unknown command ${cmd}`);
