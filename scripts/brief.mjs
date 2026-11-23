#!/usr/bin/env node
// Lilac brief: checks a website BRIEF.md before anything is built, and copies the blank template.
// Usage: node scripts/brief.mjs check <BRIEF.md> [--json]   (exit 1 when a required field is missing)
//        node scripts/brief.mjs new <dir>                   (copies the template to <dir>/BRIEF.md, never overwrites)
//        node scripts/brief.mjs block <file|-> [--json] [--write <dir>]   reads a pasted BRIEF block (B R I E F lines, see docs/PROMPT-TEMPLATE.md), scores each part
//          filled, vague or missing, lists the questions still needed (in batches of 4), and with --write fills <dir>/BRIEF.md and .lilac/config.json (severity).
//          A complete block means zero questions. Facts never invented: an empty slot stays empty; the word SAMPLE is kept.
// Offline and dependency-free: no network, no child processes.
// shortcut: heuristics are plain regexes, so they can miss odd wording; extend the lists below when a real brief slips through.
import { existsSync, readFileSync } from 'node:fs';
import { scoped } from '../lib/safe-fs.mjs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'BRIEF.template.md');
const FIELDS = [
  ['audience', 'Audience', 'who the site is for'],
  ['action', 'Main action', 'the one thing a visitor must be able to do'],
  ['facts', 'Facts', 'real facts about the business, or say: use placeholders marked SAMPLE'],
  ['mustnot', 'Must not claim', 'what the site must never say'],
  ['tone', 'Tone', 'tone, with websites you like or dislike and why'],
  ['pages', 'Pages', 'the pages you need'],
  ['constraints', 'Constraints', 'languages, budget, deadline, accessibility, motion level'],
  ['hosting', 'Hosting', 'where it lives online (Cloudflare is the default; code is always on GitHub)'],
  ['success', 'Success', 'what success looks like'],
];
const VAGUE = ['modern', 'clean', 'nice', 'professional', 'beautiful', 'user-friendly', 'best', 'world-class', 'innovative', 'stunning', 'something like', 'etc'];
const NUMBER_CLAIM = /\d[\d,.]*\+?\s*(years?|yrs?|customers?|clients?|users?|projects?|reviews?|stars?|%|awards?|members?|stores?|locations?|orders?)\b|\b(since|founded in|est\.?)\s*\d{4}|award|testimonial|"[^"]{8,}"/i;
const SOURCED = /SAMPLE|source:|https?:\/\//i;

export function parse(text) {
  const clean = text.replace(/<!--[\s\S]*?-->/g, '');
  const sections = {}; let cur = null;
  for (const line of clean.split('\n')) {
    const h = line.match(/^##\s+(.*?)\s*$/);
    if (h) { cur = h[1].toLowerCase(); sections[cur] = []; } else if (cur) sections[cur].push(line);
  }
  const get = (name) => Object.entries(sections).find(([k]) => k.startsWith(name.toLowerCase()))?.[1].join('\n').trim() ?? '';
  return { get, clean };
}

export function check(text) {
  const { get, clean } = parse(text);
  const missing = [], fixes = [], reasons = []; let score = 10;
  for (const [, name, what] of FIELDS) {
    if (!get(name)) { missing.push(name); score -= 1.5; fixes.push(`Add "${name}": ${what}.`); }
  }
  if (!missing.includes('Constraints') && !/motion\s*:?\s*\W*(none|subtle|expressive)\b/i.test(get('Constraints'))) {
    missing.push('Constraints: motion level'); score -= 1.5; fixes.push('Add a line "Motion: none", "Motion: subtle" or "Motion: expressive" under Constraints.');
  }
  const tone = get('Tone');
  if (tone && (tone.match(/https?:\/\/\S+/g) || []).length < 3) { score -= 0.5; reasons.push('Tone has fewer than 3 reference websites.'); fixes.push('List 3 websites you like or dislike and say what you notice in each.'); }
  let vague = 0;
  for (const p of VAGUE) {
    if (new RegExp(`(^|[^\\w-])${p.replace(/-/g, '[- ]?')}\\b`, 'i').test(clean.replace(/https?:\/\/\S+/g, ''))) {
      vague++; reasons.push(`Vague word: "${p}".`); fixes.push(`Replace "${p}" with a concrete example, such as a website or a sentence you would write.`);
    }
  }
  score -= Math.min(2, vague * 0.5);
  let risky = 0;
  for (const line of get('Facts').split('\n')) {
    if (NUMBER_CLAIM.test(line) && !SOURCED.test(line)) {
      risky++; reasons.push(`Invented-fact risk: "${line.replace(/^[-*\s]+/, '').trim()}" has no source.`);
      fixes.push('Add "(source: ...)" to that line, mark it "(SAMPLE)", or remove it.');
    }
  }
  score -= Math.min(3, risky);
  score = Math.max(0, Math.round(score * 10) / 10);
  return { score, missing, reasons, fixes, ok: missing.length === 0 };
}

// ---- BRIEF block: B Business | R Result | I Inspiration | E Experience | F Fences -------------------------------------------------------------
const PARTS = { B: 'Business', R: 'Result', I: 'Inspiration', E: 'Experience', F: 'Fences' };
const PLACEHOLDER = /^<[^>]*>$|^_+$|^\.\.\.$|^tbd$|^\?$/i;
export function parseBlock(text) {
  const parts = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([BRIEF])\b[^:\n]{0,20}:\s*(.*)$/);
    if (!m || parts[m[1]]) continue;
    parts[m[1]] = m[2].split('|').map((x) => x.trim().replace(/<[^>]*>/g, (t) => (PLACEHOLDER.test(t) ? '' : t))).map((x) => (PLACEHOLDER.test(x) ? '' : x));
  }
  return parts;
}
const dial = (t, name) => { const m = t.match(new RegExp(`${name}\\s*[:=]?\\s*(\\d{1,2})\\b`, 'i')); return m && +m[1] >= 1 && +m[1] <= 10 ? +m[1] : null; };
export function scoreBlock(parts) {
  const slots = (k) => parts[k] ?? [];
  const status = {}, questions = [];
  const ask = (part, q) => questions.push({ part, question: q });
  const judge = (k, ok, vagueIf, qs) => {
    const empty = slots(k).every((x) => !x);
    const vague = VAGUE.some((v) => new RegExp(`(^|[^\\w-])${v}\\b`, 'i').test(slots(k).join(' ').replace(/https?:\/\/\S+/g, '')));
    status[k] = empty ? 'missing' : !ok || vague || vagueIf ? 'vague' : 'filled';
    if (status[k] !== 'filled') for (const q of qs) ask(PARTS[k], q);
  };
  const B = slots('B'), R = slots('R'), I = slots('I'), E = slots('E'), F = slots('F'), Et = E.join(' '), Ft = F.join(' ');
  judge('B', !!B[0] && !!B[1], false, [!B[0] ? 'Who is it for?' : '', !B[1] ? 'What is TRUE about the business (name, prices, links, hours)? Write SAMPLE for facts you do not have.' : ''].filter(Boolean));
  judge('R', !!R[0] && !!R[1], R[0]?.split(/\band\b|,/).length > 2, [!R[0] ? 'What is the ONE action a visitor must take?' : 'Pick one main action.', !R[1] ? 'What number means success?' : ''].filter(Boolean));
  judge('I', I.filter(Boolean).length >= 3, false, ['Name 3 sites and what to take from each.']);
  const dials = ['variance', 'motion', 'density'].map((d) => dial(Et, d));
  judge('E', !!E[0] && !!E[1] && dials.every((x) => x), false, [!E[0] ? 'Which pages?' : '', !E[1] ? 'What is the one signature moment?' : '', dials.some((x) => !x) ? 'Design dials 1 to 10: variance, motion, density?' : ''].filter(Boolean));
  const sevN = dial(Ft, 'severity');
  judge('F', !!F[0] && !!F[1] && !!sevN && !!F[3], false, [!F[0] ? 'What must the site never claim?' : '', !F[1] ? 'Languages, budget, deadline?' : '', !sevN ? 'Severity 1 to 10?' : '', !F[3] ? 'Where should it be hosted?' : ''].filter(Boolean));
  const asks = questions.map((q) => q.question), batches = []; for (let i = 0; i < asks.length; i += 4) batches.push(asks.slice(i, i + 4));
  const w = { filled: 1, vague: 0.5, missing: 0 }, score = Math.round((Object.keys(PARTS).reduce((a, k) => a + w[status[k]], 0) / 5) * 100) / 10;
  return { status, score, severity: sevN, questions: asks, batches, complete: Object.values(status).every((x) => x === 'filled'), parts };
}
export function blockToBrief(parts) {
  const B = parts.B ?? [], R = parts.R ?? [], I = parts.I ?? [], E = parts.E ?? [], F = parts.F ?? [], Et = E.join(' ');
  const m = dial(Et, 'motion'), motion = m == null ? '' : m <= 2 ? 'none' : m <= 6 ? 'subtle' : 'expressive';
  const dials = ['variance', 'motion', 'density'].map((d) => (dial(Et, d) ? `${d} ${dial(Et, d)}` : '')).filter(Boolean).join(', ');
  const bullets = (a) => a.filter(Boolean).map((x) => `- ${x}`).join('\n');
  const cons = [E[1] && `Signature moment: ${E[1]}`, dials && `Design dials: ${dials}`, motion && `Motion: ${motion}`, F[1] && `Limits: ${F[1]}`].filter(Boolean).map((x) => `- ${x}`).join('\n');
  return `# Website brief\n\n## Audience\n${B[0] ?? ''}\n\n## Main action\n${R[0] ?? ''}\n\n## Facts\n${B.slice(1).filter(Boolean).join('\n').split(/\s*;\s*|\n/).filter(Boolean).map((x) => `- ${x}`).join('\n')}\n\n## Must not claim\n${F[0] ?? ''}\n\n## Tone\n${bullets(I)}\n\n## Pages\n${E[0] ?? ''}\n\n## Constraints\n${cons}\n\n## Hosting\n${F[3] ?? ''}\n\n## Success\n${R[1] ?? ''}\n`;
}

const [cmd, arg, flag] = process.argv.slice(2);
if (cmd === 'check' && arg) {
  if (!existsSync(arg)) { console.error(`brief: file not found: ${arg}`); process.exit(2); }
  const r = check(readFileSync(arg, 'utf8'));
  if (flag === '--json') console.log(JSON.stringify(r, null, 2));
  else {
    console.log(`Brief score: ${r.score} out of 10`);
    if (r.missing.length) console.log(`Missing (the plugin cannot build without these): ${r.missing.join('; ')}`);
    for (const x of r.reasons) console.log(`- ${x}`);
    if (r.fixes.length) { console.log('What to fix:'); for (const f of r.fixes) console.log(`- ${f}`); }
    if (r.ok && r.score >= 8) console.log('Good. Ready for your approval.');
  }
  process.exit(r.ok ? 0 : 1);
} else if (cmd === 'block' && arg) {
  const args = process.argv.slice(2), text = arg === '-' ? readFileSync(0, 'utf8') : existsSync(arg) ? readFileSync(arg, 'utf8') : (console.error(`brief: file not found: ${arg}`), process.exit(2));
  const r = scoreBlock(parseBlock(text));
  const w = args.indexOf('--write'), outDir = w > 0 ? resolve(args[w + 1] ?? '') : null;
  if (outDir) {
    scoped(outDir).write('BRIEF.md', blockToBrief(r.parts), { overwrite: false });
    if (r.severity) scoped(outDir).write('.lilac/config.json', JSON.stringify({ severity: r.severity }, null, 2) + '\n');
  }
  if (args.includes('--json')) console.log(JSON.stringify({ ...r, parts: undefined }, null, 2));
  else {
    console.log(`BRIEF block score: ${r.score} out of 10`);
    for (const [k, n] of Object.entries(PARTS)) console.log(`${k}  ${n.padEnd(12)} ${r.status[k]}`);
    if (r.complete) console.log('Complete: zero questions. Go straight to the requirements check.');
    else r.batches.forEach((b, i) => console.log(`Ask (batch ${i + 1}, one AskUserQuestion call):\n${b.map((q) => `- ${q}`).join('\n')}`));
    if (outDir) console.log(`brief: wrote ${join(outDir, 'BRIEF.md')}${r.severity ? ' and severity ' + r.severity : ''}`);
  }
  process.exit(0);
} else if (cmd === 'new' && arg) {
  const dest = join(resolve(arg), 'BRIEF.md');
  if (existsSync(dest)) { console.error(`brief: ${dest} already exists, left unchanged`); process.exit(1); }
  scoped(resolve(arg)).write('BRIEF.md', readFileSync(TEMPLATE, 'utf8'), { overwrite: false });
  console.log(`brief: wrote ${dest}`);
} else { console.error('Usage: brief.mjs check <BRIEF.md> [--json] | new <dir> | block <file|-> [--json] [--write <dir>]'); process.exit(2); }
