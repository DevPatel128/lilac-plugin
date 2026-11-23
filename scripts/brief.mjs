#!/usr/bin/env node
// Lilac brief: checks a website BRIEF.md before anything is built, and copies the blank template.
// Usage: node scripts/brief.mjs check <BRIEF.md> [--json]   (exit 1 when a required field is missing)
//        node scripts/brief.mjs new <dir>                   (copies the template to <dir>/BRIEF.md, never overwrites)
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
} else if (cmd === 'new' && arg) {
  const dest = join(resolve(arg), 'BRIEF.md');
  if (existsSync(dest)) { console.error(`brief: ${dest} already exists, left unchanged`); process.exit(1); }
  scoped(resolve(arg)).write('BRIEF.md', readFileSync(TEMPLATE, 'utf8'), { overwrite: false });
  console.log(`brief: wrote ${dest}`);
} else { console.error('Usage: brief.mjs check <BRIEF.md> [--json] | new <dir>'); process.exit(2); }
