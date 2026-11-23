#!/usr/bin/env node
// Validates the UX knowledge records and (with --build) regenerates knowledge/ux/graph.json from them.
// Usage: node ux-graph-check.mjs [--build] [--dir <knowledge/ux folder>] [--json]
// Records are the source of truth; graph.json is generated and deterministic. No network calls, files only.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const build = args.includes('--build');
const di = args.indexOf('--dir');
const dir = resolve(di >= 0 ? args[di + 1] : join(here, '../knowledge/ux'));

export const DOMAINS = ['navigation', 'forms', 'content', 'accessibility', 'motion', 'mobile', 'performance', 'trust', 'conversion', 'support'];
export const KINDS = ['principle', 'pattern'];
export const APPLIES = ['website', 'webapp', 'mobile'];
export const CONFIDENCE = ['high', 'medium', 'low'];
// Known Lilac checks (script:id) and the skill that runs each. `manual` means no automated check exists.
export const CHECKS = {
  'qa:viewport': 'qa', 'qa:heading-order': 'qa', 'qa:img-alt': 'qa', 'qa:img-size': 'qa', 'qa:link-empty': 'qa',
  'qa:page-weight': 'qa', 'qa:form-label': 'qa', 'qa:button-text': 'qa', 'qa:skip-link': 'qa', 'qa:contrast': 'qa',
  'qa:nojs-content': 'qa', 'qa:hidden-at-load': 'qa', 'qa:reduced-motion': 'qa', 'qa:infinite-animation': 'qa',
  'qa:layout-animation': 'qa', 'qa:html-lang': 'qa', 'qa:title': 'qa', 'qa:h1': 'qa',
  'qa-browser:overflow': 'qa', 'qa-browser:tap-target': 'qa', 'qa-browser:focus-order': 'qa', 'qa-browser:focus-trap': 'qa',
  'qa-browser:focus-invisible': 'qa', 'qa-browser:skip-link': 'qa', 'qa-browser:text-overlap': 'qa',
  'qa-browser:reduced-motion': 'qa', 'qa-browser:dark-contrast': 'qa',
  'persona-test:keyboard': 'persona-test', 'persona-test:low-vision': 'persona-test', 'persona-test:mobile-3g': 'persona-test',
  'persona-test:no-js': 'persona-test', 'persona-test:reduced-motion': 'persona-test', 'persona-test:screen-reader': 'persona-test',
  'persona-test:skimmer': 'persona-test', 'persona-test:impatient': 'persona-test', 'persona-test:small-phone': 'persona-test',
  'persona-test:completion': 'persona-test', 'persona-test:steps': 'persona-test', 'persona-test:time': 'persona-test',
  'controls-test:dead-control': 'controls-test',
  manual: 'ux-review',
};
const REQUIRED = ['id', 'title', 'domain', 'claim', 'guidance', 'evidence', 'confidence', 'applies_to', 'automated_check', 'edges'];

function parse(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const f = {};
  for (const line of m[1].split('\n')) {
    const k = line.match(/^([a-z_]+):\s?(.*)$/);
    if (!k) continue;
    const v = k[2].trim();
    f[k[1]] = /^\[.*\]$/.test(v) ? v.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean) : v;
  }
  return { f, body: m[2] };
}

const problems = [];
const bad = (file, msg) => problems.push(`${file}: ${msg}`);
const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().startsWith(s);

if (!existsSync(join(dir, 'records'))) { console.log(`ux-graph: no records folder at ${dir}`); process.exit(1); }
const files = readdirSync(join(dir, 'records')).filter((n) => n.endsWith('.md')).sort();
const records = [];
const seen = new Set();
for (const name of files) {
  const text = readFileSync(join(dir, 'records', name), 'utf8');
  const p = parse(text);
  if (!p) { bad(name, 'no front matter'); continue; }
  const { f, body } = p;
  for (const k of REQUIRED) if (f[k] === undefined || f[k] === '' ) bad(name, `missing field ${k}`);
  if (f.id) {
    if (!/^UX-\d{4}$/.test(f.id)) bad(name, `bad id ${f.id}`);
    if (!name.startsWith(f.id + '-')) bad(name, 'file name must start with the id');
    if (seen.has(f.id)) bad(name, `duplicate id ${f.id}`);
    seen.add(f.id);
  }
  if (f.domain && !DOMAINS.includes(f.domain)) bad(name, `unknown domain ${f.domain}`);
  if (f.kind && !KINDS.includes(f.kind)) bad(name, `unknown kind ${f.kind}`);
  if (f.confidence && !CONFIDENCE.includes(f.confidence)) bad(name, `unknown confidence ${f.confidence}`);
  if (Array.isArray(f.applies_to)) {
    if (!f.applies_to.length) bad(name, 'applies_to is empty');
    for (const a of f.applies_to) if (!APPLIES.includes(a)) bad(name, `unknown applies_to ${a}`);
  } else if (f.applies_to !== undefined) bad(name, 'applies_to must be a list');
  if (f.automated_check && !(f.automated_check in CHECKS)) bad(name, `unknown automated_check ${f.automated_check}`);
  if (f.evidence) {
    for (const part of f.evidence.split(' || ')) {
      const u = part.match(/;\s*(https:\/\/[^\s;]+)\s*;/);
      const d = part.match(/;\s*read (\d{4}-\d{2}-\d{2})\s*;/);
      if (!u || !/^https:\/\/[^/\s]+\.[^/\s]+/.test(u[1])) bad(name, `evidence needs an https URL: ${part.slice(0, 60)}`);
      if (!d || !validDate(d[1])) bad(name, `evidence needs a read date YYYY-MM-DD: ${part.slice(0, 60)}`);
      if (!/;\s*figure:\s*\S/.test(part)) bad(name, 'evidence needs a figure: field (or none)');
      if (/\bUNVERIFIED\b/.test(part) && /\d/.test((part.match(/figure:(.*)$/) || [, ''])[1])) bad(name, 'UNVERIFIED figure must not state a number');
    }
  }
  const quotes = [...text.matchAll(/"([^"]*)"|“([^”]*)”/g)].map((q) => q[1] ?? q[2]);
  if (quotes.length > 1) bad(name, 'more than one quote');
  for (const q of quotes) if (q.trim().split(/\s+/).length > 15) bad(name, `quote over 15 words (${q.trim().split(/\s+/).length})`);
  if (f.confidence === 'low' && !/single source/i.test(text)) bad(name, "confidence low needs the words 'single source'");
  if (f.claim && f.claim.split(/\s+/).length > 45) bad(name, 'claim should be one short sentence');
  records.push({ name, f, body });
}
const ids = new Set(records.map((r) => r.f.id));
for (const r of records) {
  for (const field of ['edges', 'conflicts_with']) {
    const list = r.f[field];
    if (list === undefined) continue;
    if (!Array.isArray(list)) { bad(r.name, `${field} must be a list`); continue; }
    for (const e of list) {
      if (!ids.has(e)) bad(r.name, `dangling ${field} ${e}`);
      if (e === r.f.id) bad(r.name, `${field} points at itself`);
    }
  }
}

export function makeGraph(recs) {
  const nodes = new Map();
  const edges = new Map();
  const node = (id, type, label, extra = {}) => nodes.set(id, { id, type, label, ...extra });
  const edge = (from, to, type) => edges.set(`${from}|${to}|${type}`, { from, to, type });
  for (const r of recs) node(r.f.id, r.f.kind || 'principle', r.f.title, { domain: r.f.domain, confidence: r.f.confidence });
  for (const r of recs) {
    for (const e of r.f.edges || []) edge(r.f.id, e, 'supports');
    for (const e of r.f.conflicts_with || []) edge(r.f.id, e, 'conflicts_with');
    const c = r.f.automated_check;
    const skill = CHECKS[c];
    node(`skill:${skill}`, 'skill', skill);
    if (c === 'manual') { edge(r.f.id, 'skill:ux-review', 'implemented_by'); continue; }
    node(`check:${c}`, 'check', c);
    edge(r.f.id, `check:${c}`, 'measured_by');
    edge(`check:${c}`, `skill:${skill}`, 'implemented_by');
  }
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return {
    nodes: [...nodes.values()].sort((a, b) => cmp(a.id, b.id)),
    edges: [...edges.values()].sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to) || cmp(a.type, b.type)),
  };
}

if (!problems.length) {
  const graphPath = join(dir, 'graph.json');
  const want = JSON.stringify(makeGraph(records), null, 2) + '\n';
  if (build) writeFileSync(graphPath, want);
  else if (!existsSync(graphPath)) bad('graph.json', 'missing; run with --build');
  else if (readFileSync(graphPath, 'utf8') !== want) bad('graph.json', 'is out of date; run with --build');
}
if (records.length < 60 || records.length > 90) bad('records', `count ${records.length} outside 60..90`);

const by = {};
for (const r of records) by[r.f.domain] = (by[r.f.domain] || 0) + 1;
console.log(`ux-graph: ${records.length} records (${Object.entries(by).sort().map(([k, v]) => `${k} ${v}`).join(', ')}), ${problems.length} problem(s)`);
for (const p of problems) console.log(`  ${p}`);
process.exit(problems.length ? 1 : 0);
