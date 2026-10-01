// ACCURACY=1 npx vitest run test/real-phone/agreement/counts.test.ts
// The core's and the period counter's counts on every Countix whole clip of the build half, as SPEC.md fixes
// them, written to counts.json for agreement.py. Diagnostic only; no counting change.
import { expect, test } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { periodCount } from '../../../src/lib/repCounter/periodCounter';
import { countInWindow, publicSets, ROOT } from '../accuracy/sets';

function filled(xs: (number | null)[]): number[] | null {
  const idx = xs.map((x, i) => (x === null ? -1 : i)).filter(i => i >= 0);
  if (!idx.length) return null;
  return xs.map((x, i) => {
    if (x !== null) return x;
    const after = idx.find(j => j > i), before = [...idx].reverse().find(j => j < i);
    if (before === undefined) return xs[after!] as number;
    if (after === undefined) return xs[before] as number;
    const a = xs[before] as number, b = xs[after] as number;
    return a + ((b - a) * (i - before)) / (after - before);
  });
}

test.skipIf(!process.env.ACCURACY)('core and period counts on countix-whole build', () => {
  const { sets } = publicSets('build');
  const whole = sets.filter(s => s.dataset === 'countix-whole');
  expect(whole.length).toBe(447);
  const base = JSON.parse(readFileSync(resolve(ROOT, 'accuracy', 'public-baseline.json'), 'utf8')).counts;
  const out: Record<string, any> = {};
  for (const s of whole) {
    const r = summarizeCount(s.wl, s.ts, s.lift);
    const core = r.refused ? 'refused' : countInWindow(r.reps, s.window);
    expect(core).toBe(base[s.name]);
    const [w0, w1] = s.window!;
    const inside = s.ts.map((t, i) => (t >= w0 && t <= w1 ? i : -1)).filter(i => i >= 0);
    const sig = r.smoothedAngles?.length ? filled(inside.map(i => r.smoothedAngles[i] ?? null)) : null;
    let period: number | 'refused' = 'refused';
    if (sig && inside.length > 2) {
      const span = s.ts[inside[inside.length - 1]] - s.ts[inside[0]];
      const fps = span > 0 ? (inside.length - 1) / span : 0;
      const p = fps > 0 ? periodCount(sig, fps, s.lift) : null;
      if (p) period = p.reps;
    }
    out[s.name] = { lift: s.lift, label: s.label, core, period };
  }
  writeFileSync(resolve(ROOT, 'agreement', 'counts.json'), JSON.stringify(out, null, 1) + '\n');
}, 600_000);
