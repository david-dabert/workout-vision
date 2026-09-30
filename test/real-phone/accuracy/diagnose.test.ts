// npx vitest run test/real-phone/accuracy/diagnose.test.ts
// Accuracy work, 30 September: for every labelled set on disk, the core's count against the label, and
// what the angle trace shows where they differ. Reads saved landmarks only; changes no parameter.
// Per set: the thresholds, each counted cycle, how the trace begins (inside a rep or at rest), how it
// ends (at rest, or inside a rep that reached its working end: a terminal excursion), and excursions
// that left the rest but never reached the working threshold (shallow).
import { test } from 'vitest';

// Runs only when asked (ACCURACY=1), so a plain npm test rewrites no evidence file.
const asked = !!process.env.ACCURACY;
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { countReps, liftDefinition } from '../../../src/lib/counting/core';
import { labelledSets } from './sets';

// The same sets as the scoreboard reads (sets.ts); an unreadable file is listed at the top of the diagnosis.
const { sets, unreadable } = labelledSets();

test.skipIf(!asked)('diagnose every labelled set', () => {
  const out: string[] = [];
  for (const name of unreadable) out.push(`UNREADABLE ${name}`);
  for (const s of sets) {
    const def = liftDefinition(s.lift)!;
    const r = countReps(s.wl, s.ts, s.lift);
    const a = r.smoothedAngles, lo = r.lowThreshold, hi = r.highThreshold, restsLow = def.rest === 'low';
    const atRest = (x: number) => (restsLow ? x < lo : x > hi);
    const atWork = (x: number) => (restsLow ? x >= hi : x <= lo);
    const valid = a.map((x, i) => [x, i] as const).filter(([x]) => x !== null) as [number, number][];
    // Excursions: runs of samples away from the rest threshold.
    const exc: { from: number; to: number; work: boolean; open: 'start' | 'end' | null }[] = [];
    let cur: typeof exc[0] | null = null;
    for (const [x, i] of valid) {
      if (!atRest(x)) { if (!cur) cur = { from: i, to: i, work: false, open: exc.length === 0 && i === valid[0][1] ? 'start' : null }; cur.to = i; if (atWork(x)) cur.work = true; }
      else if (cur) { exc.push(cur); cur = null; }
    }
    if (cur) { cur.open = cur.open ?? 'end'; exc.push(cur); }
    const t = (i: number) => s.ts[i].toFixed(1);
    const counted = r.reps.map(p => `${p.startTime.toFixed(1)}-${p.endTime.toFixed(1)}`).join(' ');
    const terminal = exc.filter(e => e.open === 'end' && e.work);
    const opening = exc.filter(e => e.open === 'start' && e.work);
    const shallow = exc.filter(e => !e.work);
    const diff = r.count - s.label;
    out.push(`${diff === 0 ? 'EXACT' : `OFF ${diff > 0 ? '+' : ''}${diff}`}  ${s.name}  lift ${s.lift} (rest ${def.rest}, ${def.first} first)  label ${s.label}  count ${r.count}  arm ${r.arm}`);
    out.push(`   thresholds low ${lo.toFixed(1)} high ${hi.toFixed(1)}; ${s.ts.length} samples over ${s.ts.at(-1)!.toFixed(1)} s; excursions ${exc.length} (working ${exc.filter(e => e.work).length})`);
    out.push(`   counted: ${counted || 'none'}`);
    if (opening.length) out.push(`   STARTS INSIDE A REP: ${opening.map(e => `${t(e.from)}-${t(e.to)} s`).join(', ')}`);
    if (terminal.length) out.push(`   ENDS INSIDE A REP THAT REACHED ITS WORKING END: ${terminal.map(e => `${t(e.from)}-${t(e.to)} s`).join(', ')}`);
    if (shallow.length) out.push(`   SHALLOW (left rest, never reached working threshold): ${shallow.map(e => `${t(e.from)}-${t(e.to)} s`).join(', ')}`);
    const workingClosed = exc.filter(e => e.work && !e.open).length;
    if (workingClosed !== r.count) out.push(`   NOTE: ${workingClosed} closed working excursions vs ${r.count} counted (duration or ROM rule dropped some, or two reps merged)`);
  }
  const text = out.join('\n') + '\n';
  writeFileSync(resolve(__dirname, 'diagnosis.txt'), text);
  process.stdout.write(text);
});
