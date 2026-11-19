// Diagnosis of the 11 public build sets shown as sure and off by 3 or more (card 064's next change). Bench only.
import { test } from 'vitest';
import { summarizeCount, withBodyCheck, SENSITIVITY_GRID } from '../../../src/lib/coreAnalysis';
import { countInWindow, publicSets } from '../accuracy/sets';
import { sureRow } from '../accuracy/sure';

const NAMES = (process.env.DIAG ?? '').split(',').filter(Boolean);
test.skipIf(!NAMES.length)('diag', () => {
  const pub = publicSets('build').sets.filter(s => s.dataset !== 'countix-whole' && NAMES.some(n => s.name.includes(n)));
  for (const s of pub) {
    const r: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
    const b: any = withBodyCheck({ ...r, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: s.il ?? null }, s.lift);
    const rec = SENSITIVITY_GRID.map(t => { const x: any = summarizeCount(s.wl, s.ts, s.lift, t, s.il ?? undefined); return x.refused ? null : x.count; });
    const row = sureRow(b, s.lift, s.label, x => countInWindow(x.reps, s.window));
    const dur = (s.ts.at(-1) - s.ts[0]) / 1000;
    
    console.log(JSON.stringify({ name: s.name, lift: s.lift, label: s.label, count: r.count, inWin: countInWindow(r.reps, s.window), window: s.window, dur: +dur.toFixed(1), n: s.ts.length,
      recounts: rec, body: b.bodyCheck && { agreement: b.bodyCheck.agreement, flagged: b.bodyCheck.flagged, second: b.bodyCheck.second?.count }, doubt: r.doubt, headRefused: r.headRefused, tailOpen: r.tailOpen,
      conf: r.confidence, row }));
  }
});
