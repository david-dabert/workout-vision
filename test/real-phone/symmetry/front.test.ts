// ACCURACY=1 npx vitest run test/real-phone/symmetry/front.test.ts
// The front-view left/right comparison (src/lib/counting/symmetry.ts) on every public clip and on David's
// labelled sets. Public clips carry no measured asymmetry, so they cannot show that a real asymmetry is
// found; they show how often the measure reports one in lifters assumed roughly symmetric (its false-alarm
// rate) and whether it leans to one side (a camera or model artefact). David's sets show which of his
// views the gate admits: none filmed from the side may be measured.
import { expect, test } from 'vitest';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { countReps } from '../../../src/lib/counting/core';
import { compareSides, facing } from '../../../src/lib/counting/symmetry';
import { labelledSets, PUBLIC } from '../accuracy/sets';

const fmt = (x: number) => (x >= 0 ? '+' : '') + x.toFixed(0);
// The literature's band for a meaningful inter-limb gap (Bishop, Turner & Read 2018), used here only to
// describe the public clips.
const GAP_SI = 15;

test.skipIf(!process.env.ACCURACY)('front-view left/right comparison', () => {
  const out: string[] = [];
  const rows: { lift: string; si: number }[] = [];
  const why: Record<string, number> = {};
  let seen = 0;
  // Both halves of Countix. No parameter was set on them.
  for (const split of ['build', 'holdout']) {
    const dir = resolve(PUBLIC, 'countix', split);
    for (const f of readdirSync(dir).filter(f => f.endsWith('.json.gz')).sort()) {
      const d = JSON.parse(gunzipSync(readFileSync(resolve(dir, f))).toString());
      if (!d.admitted || !Array.isArray(d.worldLandmarks)) continue;
      seen++;
      const reps = countReps(d.worldLandmarks, d.timestamps, d.lift).reps;
      const r = compareSides(d.worldLandmarks, d.timestamps, d.lift, reps);
      if (r.status !== 'measured') { why[r.status] = (why[r.status] ?? 0) + 1; continue; }
      rows.push({ lift: d.lift, si: r.comparison.si });
      out.push(`  ${d.id.padEnd(28)} ${d.lift.padEnd(17)} reps ${String(r.comparison.reps).padStart(2)}  L ${r.comparison.left.toFixed(0).padStart(3)}  R ${r.comparison.right.toFixed(0).padStart(3)}  SI ${fmt(r.comparison.si).padStart(4)} %${Math.abs(r.comparison.si) >= GAP_SI ? '  FLAGGED' : ''}`);
    }
  }
  const head: string[] = [];
  const sum = (xs: { si: number }[], name: string) => {
    if (!xs.length) return;
    const si = xs.map(x => x.si).sort((a, b) => a - b), n = si.length;
    const flagged = si.filter(x => Math.abs(x) >= GAP_SI).length;
    const leftMore = si.filter(x => x < 0).length;
    const mean = si.reduce((a, b) => a + b, 0) / n;
    head.push(`${name.padEnd(17)} n ${String(n).padStart(3)}  flagged |SI| >= ${GAP_SI} %: ${String(flagged).padStart(3)} (${((100 * flagged) / n).toFixed(0)} %)  left larger: ${leftMore} of ${n}  mean SI ${fmt(mean)} %  median ${fmt(si[n >> 1])} %  middle 80 %: ${fmt(si[Math.floor(n * 0.1)])} to ${fmt(si[Math.floor(n * 0.9)])} %`);
  };
  sum(rows, 'all');
  // Since 2 October only lateral raises filmed square on are compared (synth.txt); Countix holds none, so its
  // rows are expected to be few or none.
  for (const lift of [...new Set(rows.map(r => r.lift))].sort()) sum(rows.filter(r => r.lift === lift), lift);

  const david: string[] = [];
  for (const s of labelledSets().sets) {
    const f = facing(s.wl), reps = countReps(s.wl, s.ts, s.lift).reps;
    const r = compareSides(s.wl, s.ts, s.lift, reps);
    const view = s.name.match(/_(front|side|angle)_/)?.[1] ?? '?';
    david.push(`  ${s.name.padEnd(56)} filmed ${view.padEnd(5)} shoulders ${f.shoulderDeg.toFixed(0).padStart(2)} deg hips ${f.hipDeg.toFixed(0).padStart(2)} deg  ${r.status === 'measured' ? `SI ${fmt(r.comparison.si)} % over ${r.comparison.reps} reps (L ${r.comparison.left.toFixed(0)}, R ${r.comparison.right.toFixed(0)})${Math.abs(r.comparison.si) >= GAP_SI ? ' FLAGGED' : ''}` : r.status}`);
    // The gate this measure exists for: no set David filmed from the side is measured.
    if (view === 'side') expect(r.status).not.toBe('measured');
    // Only lateral raises are compared (symmetry.ts, SIDES_LIFTS).
    if (r.status === 'measured') expect(s.lift).toBe('lateral_raise');
  }

  writeFileSync(resolve(__dirname, 'front.txt'), [
    'Front-view left/right comparison (src/lib/counting/symmetry.ts), run over the stored landmarks.',
    `Per set: each side's median range over the counted reps, SI = (R - L) / mean(R, L) x 100 of those medians; "flagged" when |SI| >= ${GAP_SI} %.`,
    '',
    `Countix, both halves: ${seen} admitted clips; measured ${rows.length}; not measured: ${Object.entries(why).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    ...(rows.length ? [] : ['None is compared: since 2 October only lateral raises filmed square on are, and Countix holds none (synth.txt).']),
    'These clips carry no measured asymmetry: "flagged" is the share of lifters not known to be asymmetric whose gap',
    `passes the threshold. It is not a false-alarm rate: some may be asymmetric, and with ${rows.length} clips its 95 % interval is about +/-${Math.round(196 * Math.sqrt(0.25 / Math.max(1, rows.length)))} points.`,
    ...head, '',
    "David's labelled sets:", ...david, '',
    'Each measured Countix clip:', ...out,
  ].join('\n') + '\n');
}, 600_000);
