// SQUAT_PROBE=1 npx vitest run test/real-phone/squat-probe/probe.test.ts (scratch, card 064 squat diagnosis)
import { test } from 'vitest';
import { writeFileSync } from 'node:fs';
import { summarizeCount, withBodyCheck, withProposal } from '../../../src/lib/coreAnalysis';
import { countInWindow, labelledSets, publicSets, videoSets } from '../accuracy/sets';
import { appOutcome } from '../accuracy/outcome.mjs';
import { sureRow } from '../accuracy/sure';
const appPath = (lift: string, wl: any[], ts: number[], il: any[] | null) => {
  const c: any = summarizeCount(wl, ts, lift, undefined, il ?? undefined);
  return withBodyCheck(withProposal({ ...c, worldLandmarks: wl, timestamps: ts, imageLandmarks: il }, lift), lift);
};
test.skipIf(!process.env.SQUAT_PROBE)('squat sets', () => {
  const out: string[] = [];
  const line = (src: string, name: string, label: number, now: any, s: any) => out.push(`${src}\t${name}\tlabel ${label}\tnow ${now}\terr ${now === 'refused' ? '-' : now - label}\tsure ${s && s.err !== null && !s.flagged && !s.moved ? 'yes' : 'no'}`);
  for (const s of labelledSets().sets.filter(s => s.lift === 'squat')) { const r: any = appPath(s.lift, s.wl, s.ts, s.il ?? null); line('David', s.name, s.label, r.refused ? 'refused' : r.count, sureRow(r, s.lift, s.label)); }
  for (const s of videoSets().sets.filter(s => s.lift === 'squat')) { const o: any = appOutcome(s); line('video', s.name, s.label, o.now, null); }
  for (const s of publicSets('build').sets.filter(s => s.dataset !== 'countix-whole' && s.lift === 'squat')) {
    const r: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
    const now = r.refused ? 'refused' : countInWindow(r.reps, s.window);
    const sure = r.refused ? null : sureRow(withBodyCheck({ ...r, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: s.il ?? null }, s.lift), s.lift, s.label, (x: any) => countInWindow(x.reps, s.window));
    line(s.dataset, s.name, s.label, now, sure);
  }
  writeFileSync(__dirname + '/out.txt', out.join('\n'));
}, 300000);
