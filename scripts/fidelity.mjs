#!/usr/bin/env node
// Lilac fidelity: does the built site meet the accepted requirements? A traceability matrix, not a score.
// Usage: node scripts/fidelity.mjs run <dir> [--judge-file <json>]     <dir> holds brief/requirements.yaml and the site HTML.
// Deterministic checks first, offline, no browser: dom/content items need a data-req="R-xxx" carrier (or the quoted phrase) in the HTML;
// behavior/perf/a11y -> NEEDS-BROWSER, visual -> NEEDS-JUDGE, manual -> MANUAL. Nothing is PASS without evidence.
// N-xxx anti-requirements: the forbidden phrase (quoted strings in `source`, else the source minus a leading "no/never/without") must be ABSENT from all page text.
// --judge-file: [{id, verdict: yes|no|partial, region}] from the vision judge; a verdict with no cited region is rejected. Accepted answers persist in reports/fidelity-judge.json.
// --json: print {"verdicts":{id:PASS|MISS|PARTIAL|UNKNOWN}} instead of the summary (used by evals/fidelity/run.mjs). FIDELITY.md ends with a json block {misses:[{id,verdict,gate}]} that converge.mjs reads.
// Writes reports/FIDELITY.md through safe-fs. Exit 1: any accepted must FAIL, or any N- item present. Exit 2: bad input or a rejected judge answer.
// shortcut: tiny YAML reader for the flat requirements.yaml shape only (list of `key: value` items); text match is plain substring, no stemming; upgrade if the schema grows nested.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { safeWriteFile } from '../lib/safe-fs.mjs';

const SKIP = new Set(['brief', 'reports', 'node_modules', '.git', '.lilac']);
const die = (m, c = 2) => { console.error(`fidelity: ${m}`); process.exit(c); };
const unq = (v) => { v = v.trim(); const m = v.match(/^(["'])(.*)\1$/s); return m ? m[2] : v.replace(/\s+#.*$/, ''); };

export function parseRequirements(text) {
  const items = []; let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const m = raw.match(/^(\s*)(- )?([A-Za-z_]+):\s*(.*)$/);
    if (!m) continue;
    if (m[2]) { cur = {}; items.push(cur); }
    if (cur && m[3] !== 'requirements') cur[m[3]] = unq(m[4]);
  }
  return items.filter((i) => i.id);
}

function htmlFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(join(d, e.name)); } else if (/\.html?$/i.test(e.name)) out.push(join(d, e.name));
    }
  })(dir);
  return out;
}
const textOf = (h) => h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;|&#34;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').toLowerCase();
const quoted = (s = '') => [...s.matchAll(/"([^"]+)"|“([^”]+)”/g)].map((m) => (m[1] || m[2]).trim().toLowerCase()).filter(Boolean);

function forbidden(it) {
  const src = it.source || it.ears || '';
  const q = quoted(src);
  if (q.length) return q;
  const p = src.toLowerCase().replace(/^\s*(no|never|without|do not|don't)\s+/, '').replace(/[.!]+$/, '').replace(/\s+/g, ' ').trim();
  return p ? [p] : [];
}

export function check(dir, items, pages, judge = {}) {
  const lineOf = (re) => { for (const p of pages) { const i = p.raw.split('\n').findIndex((l) => re(l.toLowerCase())); if (i >= 0) return `${p.rel}:${i + 1}`; } return ''; };
  const all = pages.map((p) => p.text).join(' ');
  const rows = [];
  for (const it of items) {
    if (it.status === 'proposed') continue;
    const anti = /^N-/i.test(it.id), must = it.priority === 'must';
    const row = { id: it.id, priority: it.priority || 'could', verify: anti ? 'absent' : it.verify || 'manual', anti, must: must && !anti, verdict: '', evidence: '' };
    if (anti) {
      const hits = forbidden(it).filter((f) => all.includes(f));
      const bad = forbidden(it).length === 0;
      row.verdict = bad ? 'NEEDS-JUDGE' : hits.length ? 'FAIL' : 'PASS';
      row.evidence = bad ? 'no forbidden phrase derivable from source' : hits.length ? `present: "${hits[0]}" at ${lineOf((l) => l.includes(hits[0]))}` : 'absent from all page text';
    } else if (row.verify === 'dom' || row.verify === 'content') {
      const idRe = new RegExp(`data-req\\s*=\\s*["'][^"']*\\b${it.id.toLowerCase()}\\b`);
      const carrier = lineOf((l) => idRe.test(l));
      const q = row.verify === 'content' ? quoted(it.ears + ' ' + (it.source || '')) : [];
      const found = q.filter((x) => all.includes(x));
      if (q.length) { row.verdict = found.length === q.length ? 'PASS' : found.length ? 'PARTIAL' : 'FAIL'; row.evidence = found.length ? `"${found[0]}" at ${lineOf((l) => l.includes(found[0]))}${found.length < q.length ? `; missing "${q.find((x) => !found.includes(x))}"` : ''}` : `phrase not on any page: "${q[0]}"`; }
      else { row.verdict = carrier ? 'PASS' : 'FAIL'; row.evidence = carrier ? `data-req at ${carrier}` : `no data-req="${it.id}" carrier in the site HTML`; }
    } else if (['behavior', 'perf', 'a11y'].includes(row.verify)) { row.verdict = 'NEEDS-BROWSER'; row.evidence = 'needs a browser run; not checked offline';
    } else if (row.verify === 'visual') { row.verdict = 'NEEDS-JUDGE'; row.evidence = 'needs the vision judge';
    } else { row.verdict = 'MANUAL'; row.evidence = 'a person checks this'; }
    const j = judge[it.id];
    if (j && row.verdict === 'NEEDS-JUDGE') { row.verdict = { yes: 'PASS', no: 'FAIL', partial: 'PARTIAL' }[j.verdict]; row.evidence = `judge: ${j.verdict}, region ${j.region}`; }
    rows.push(row);
  }
  return rows;
}

export function mergeJudge(answers, items, known) {
  const ok = {}, rejected = [];
  for (const a of Array.isArray(answers) ? answers : answers?.answers || []) {
    const it = items.find((i) => i.id === a?.id);
    const region = typeof a?.region === 'string' ? a.region.trim() : a?.region && typeof a.region === 'object' ? JSON.stringify(a.region) : '';
    const why = !it ? 'unknown id' : it.verify !== 'visual' && !/^N-/i.test(it.id) ? 'not a judge item' : !['yes', 'no', 'partial'].includes(a.verdict) ? 'verdict must be yes, no or partial' : !region ? 'no cited region' : '';
    if (why) rejected.push(`${a?.id ?? '?'}: ${why}`); else ok[a.id] = { verdict: a.verdict, region };
  }
  return { judge: { ...known, ...ok }, rejected };
}

export function render(rows, nProposed, rejected) {
  const musts = rows.filter((r) => r.must), passed = musts.filter((r) => r.verdict === 'PASS').length;
  const pct = musts.length ? Math.round((passed / musts.length) * 100) : null;
  const antiBad = rows.filter((r) => r.anti && r.verdict === 'FAIL');
  const fail = musts.filter((r) => r.verdict === 'FAIL').length > 0 || antiBad.length > 0;
  const md = ['# Fidelity', '', `Must-have pass rate: ${passed} of ${musts.length} (${pct == null ? 'n/a' : pct + '%'})`, '',
    `Accepted items: ${rows.length}. Proposed (not checked): ${nProposed}. NEEDS-* counts as not passed. Anti-requirements present: ${antiBad.length}.`, '',
    '| id | priority | verify | verdict | evidence |', '|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.id} | ${r.priority} | ${r.verify} | ${r.verdict} | ${r.evidence.replace(/\|/g, '\\|')} |`)];
  if (rejected.length) md.push('', '## Rejected judge answers', ...rejected.map((x) => `- ${x}`));
  // Machine block for converge.mjs: the misses to fix, each with the verify method that tells it which gates to rerun.
  const misses = rows.filter((r) => ['FAIL', 'PARTIAL'].includes(r.verdict)).map((r) => ({ id: r.id, verdict: r.verdict, gate: r.verify }));
  md.push('', '```json', JSON.stringify({ misses }), '```');
  return { md: md.join('\n') + '\n', passed, total: musts.length, pct, fail };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('fidelity.mjs')) {
  const a = process.argv.slice(2), asJson = a.includes('--json'); if (asJson) a.splice(a.indexOf('--json'), 1);
  const jf = a.indexOf('--judge-file');
  const jpath = jf >= 0 ? a.splice(jf, 2)[1] : null;
  const [cmd, d] = a;
  if (cmd !== 'run' || !d) die('usage: run <dir> [--judge-file <json>]');
  const dir = resolve(d), req = join(dir, 'brief', 'requirements.yaml');
  if (!existsSync(req)) die(`no ${relative(process.cwd(), req) || req}; run /lilac:requirements first`);
  const items = parseRequirements(readFileSync(req, 'utf8'));
  if (!items.length) die('requirements.yaml has no items');
  const pages = htmlFiles(dir).map((f) => { const raw = readFileSync(f, 'utf8'); return { rel: relative(dir, f), raw, text: textOf(raw) }; });
  const store = join(dir, 'reports', 'fidelity-judge.json');
  let known = {}; try { known = JSON.parse(readFileSync(store, 'utf8')); } catch { /* none yet */ }
  let rejected = [], judge = known;
  if (jpath) {
    let ans; try { ans = JSON.parse(readFileSync(resolve(jpath), 'utf8')); } catch (e) { die(`cannot read judge file: ${e.message}`); }
    ({ judge, rejected } = mergeJudge(ans, items, known));
    safeWriteFile(dir, 'reports/fidelity-judge.json', JSON.stringify(judge, null, 2) + '\n', { overwrite: true });
  }
  const rows = check(dir, items, pages, judge);
  const r = render(rows, items.filter((i) => i.status === 'proposed').length, rejected);
  safeWriteFile(dir, 'reports/FIDELITY.md', r.md, { overwrite: true });
  if (asJson) { // eval contract (evals/fidelity/run.mjs): FAIL is reported as MISS, anything not decided as UNKNOWN
    const map = { PASS: 'PASS', FAIL: 'MISS', PARTIAL: 'PARTIAL' };
    console.log(JSON.stringify({ verdicts: Object.fromEntries(rows.map((x) => [x.id, map[x.verdict] ?? 'UNKNOWN'])) }));
    process.exit(rejected.length ? 2 : r.fail ? 1 : 0);
  }
  console.log(`Must-have pass rate: ${r.passed} of ${r.total} (${r.pct == null ? 'n/a' : r.pct + '%'})`);
  for (const x of rows.filter((x) => x.verdict === 'FAIL')) console.log(`FAIL ${x.id} (${x.priority}): ${x.evidence}`);
  for (const x of rejected) console.error(`rejected judge answer ${x}`);
  console.log('Report: reports/FIDELITY.md');
  process.exit(rejected.length ? 2 : r.fail ? 1 : 0);
}
