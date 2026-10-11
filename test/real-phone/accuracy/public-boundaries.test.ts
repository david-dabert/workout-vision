// ACCURACY=1 npx vitest run test/real-phone/accuracy/public-boundaries.test.ts
// Where the counter misses, rep by rep, on the build half of the public sets whose reps are marked by
// people: the first rep, the last rep, or one in the middle, and where it counts a rep that is not there
// (match-reps.ts). The edges are where David's own sets fail (diagnosis of 30 September); this measures
// them on hundreds of sets. Reads the build half only; changes no parameter.
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { countReps } from '../../../src/lib/counting/core';
import { matchReps } from './match-reps';
import { publicSets } from './sets';

test.skipIf(!process.env.ACCURACY)('public rep boundaries', () => {
  const groups = new Map<string, { sets: number; reps: number; found: number; first: number; last: number; middle: number; extra: number }>();
  const lines: string[] = [];
  for (const s of publicSets('build').sets) {
    if (!s.reps.length) continue;
    const r = countReps(s.wl, s.ts, s.lift);
    const m = matchReps(s.reps, r.reps.map(p => [p.startTime, p.endTime] as [number, number]));
    const key = `${s.dataset} ${s.lift}`, g = groups.get(key) ?? { sets: 0, reps: 0, found: 0, first: 0, last: 0, middle: 0, extra: 0 };
    g.sets++; g.reps += s.reps.length; g.found += m.found; g.first += +m.missedFirst; g.last += +m.missedLast; g.middle += m.missedMiddle; g.extra += m.extra;
    groups.set(key, g);
    if (m.found < s.reps.length || m.extra) lines.push(`${s.name}  ${s.reps.length} marked, ${m.found} found${m.missedFirst ? ', first missed' : ''}${m.missedLast ? ', last missed' : ''}${m.missedMiddle ? `, ${m.missedMiddle} in the middle missed` : ''}${m.extra ? `, ${m.extra} extra` : ''}`);
  }
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '-');
  const text = [
    `Public rep boundaries ${new Date().toISOString().slice(0, 10)}: build half only.`, '',
    '| Dataset, lift | Sets | Marked reps | Found | First rep missed | Last rep missed | Middle reps missed | Extra reps |', '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...[...groups].sort().map(([k, g]) => `| ${k} | ${g.sets} | ${g.reps} | ${pct(g.found, g.reps)} | ${pct(g.first, g.sets)} of sets | ${pct(g.last, g.sets)} of sets | ${pct(g.middle, g.reps)} of reps | ${g.extra} |`),
    '', ...lines,
  ].join('\n') + '\n';
  writeFileSync(resolve(__dirname, 'public-boundaries.txt'), text);
  process.stdout.write(text);
}, 1_800_000);
