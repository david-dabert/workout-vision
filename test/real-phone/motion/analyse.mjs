#!/usr/bin/env node
// Motion rhythm bench, step 2 of 2 (7 October; TRIED.md). Reads the files capture.mjs wrote and prints, per set: the
// label, the skeleton's count, the motion count (src/lib/counting/motionRhythm.js), its period and confidence,
// agree or disagree; then how well disagreement flags the sets the skeleton gets wrong, and the fused count against
// the skeleton alone. Writes nothing.
//
//   node test/real-phone/motion/analyse.mjs <capture.json>...      MOTION_OPTS='{"grid":16}' to try other settings
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { motionCount, crossCheck } from '../../../src/lib/counting/motionRhythm.js';

const opts = JSON.parse(process.env.MOTION_OPTS || '{}');
const files = process.argv.slice(2);
const rows = [];
for (const f of files) {
  const d = JSON.parse(readFileSync(f, 'utf8'));
  const frames = d.frames.map(b => Buffer.from(b, 'base64'));
  const m = motionCount({ frames, w: d.w, h: d.h, timestamps: d.timestamps, boxes: opts.wholeFrame ? [] : d.boxes }, opts);
  const coverage = d.seen / d.n;
  const x = crossCheck(d.skeleton, m, coverage, opts);
  rows.push({ set: basename(f, '.json'), label: d.label, skeleton: d.skeleton, coverage, motion: m.count, period: m.period, confidence: m.confidence, comp: m.component, ...x });
}
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('set', 16)}${pad('label', 6)}${pad('skel', 8)}${pad('pose', 6)}${pad('motion', 7)}${pad('period', 8)}${pad('conf', 6)}${pad('pc', 4)}${pad('check', 10)}fused`);
for (const r of rows) console.log(`${pad(r.set, 16)}${pad(r.label, 6)}${pad(r.skeleton ?? 'refused', 8)}${pad(Math.round(100 * r.coverage) + '%', 6)}${pad(r.motion, 7)}${pad(r.period ?? '-', 8)}${pad(r.confidence, 6)}${pad(r.comp, 4)}${pad(r.agree ? 'agree' : 'DISAGREE', 10)}${r.fused ?? 'refused'}`);
const groups = { all: rows };
for (const r of rows) (groups[r.set[0]] ??= []).push(r);
for (const [g, rs] of Object.entries(groups)) {
  const wrong = rs.filter(r => r.skeleton !== r.label), right = rs.filter(r => r.skeleton === r.label);
  const tp = wrong.filter(r => r.flag).length, fp = right.filter(r => r.flag).length, flags = rs.filter(r => r.flag).length;
  const ex = k => rs.filter(r => r[k] === r.label).length, off3 = k => rs.filter(r => r[k] === null || Math.abs(r[k] - r.label) >= 3).length;
  console.log(`[${g}] ${rs.length} sets. motion exact ${ex('motion')}, off by 3+ ${off3('motion')}; skeleton exact ${ex('skeleton')}, off by 3+ or refused ${off3('skeleton')}; fused exact ${ex('fused')}, off by 3+ or refused ${off3('fused')}. ` +
    `flags ${flags}: true ${tp} of ${wrong.length} skeleton misses (recall ${wrong.length ? Math.round((100 * tp) / wrong.length) : '-'}%), false alarms ${fp} of ${right.length} skeleton exact (precision ${flags ? Math.round((100 * tp) / flags) : '-'}%); agree and both right ${rs.filter(r => r.agree && r.skeleton === r.label).length}, agree and both wrong ${rs.filter(r => r.agree && r.skeleton !== r.label).length}`);
}
