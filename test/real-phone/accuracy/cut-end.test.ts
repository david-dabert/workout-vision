// CUT_END=1 npx vitest run test/real-phone/accuracy/cut-end.test.ts
// A video that stops inside a rep (9 October 2026; David's convention of the same day: a last rep the video cuts
// counts). Bench for a confirm prompt, not a count change: where the core's count is followed by a rise left open at
// the end of the video (fitness-tests.js openRise, the test's detector, after the last counted rep), the result would
// ask "N or N + 1?". Per suite: sets where the prompt fires and N + 1 is the label (it offers the right number), fires
// and N is the label (a needless question), fires otherwise, and sets labelled N + 1 where it stays silent.
import { test } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { liftDefinition } from '../../../src/lib/counting/core';
import { openRise } from '../../../src/lib/fitness-tests';
import { ROOT, benchSets, labelledSets, publicSets, videoSets } from './sets';

const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(f)).toString());

test.skipIf(!process.env.CUT_END)('cut end: how often the prompt would fire, and when it is right', () => {
  const suites: Record<string, { name: string; lift: string; label: number; wl: any[]; ts: number[]; refused?: boolean }[]> = {
    'David stored': labelledSets().sets.map(s => { const d = gz(resolve(ROOT, s.name)); return { name: s.name, lift: s.lift, label: s.label, wl: d.worldLandmarks, ts: d.timestamps }; }),
    'David video': videoSets().sets.map(s => ({ name: s.name, lift: s.lift, label: s.label, wl: s.wl, ts: s.ts, refused: s.appRefused })),
    'public build (whole clips)': publicSets('build').sets.filter(s => !s.window).map(s => ({ name: s.name, lift: s.lift, label: s.label, wl: gz(resolve(ROOT, s.name)).worldLandmarks, ts: gz(resolve(ROOT, s.name)).timestamps })),
    'RepCount-A build': benchSets('repcount', 'build').sets.filter(s => s.lift && liftDefinition(s.lift)).map(s => ({ name: s.name, lift: s.lift, label: s.label, wl: s.wl, ts: s.ts })),
  };
  const L: string[] = [];
  for (const [suite, sets] of Object.entries(suites)) {
    let n = 0, right = 0, needless = 0, other = 0, silentCut = 0, exact = 0;
    const named: string[] = [];
    for (const s of sets) {
      if (s.refused) continue;
      const c: any = summarizeCount(s.wl, s.ts, s.lift);
      if (c.refused || !(c.count > 0)) continue;
      n++;
      if (c.count === s.label) exact++;
      const def = liftDefinition(s.lift)!;
      const after = c.reps.at(-1).endTime;
      const fires = !!openRise(c.smoothedAngles, s.ts, c.lowThreshold, c.highThreshold, def.rest, after);
      if (fires && s.label === c.count + 1) { right++; named.push(`+ ${s.name}`); }
      else if (fires && s.label === c.count) { needless++; named.push(`? ${s.name}`); }
      else if (fires) other++;
      else if (s.label === c.count + 1) silentCut++;
    }
    L.push(`${suite}: ${n} counted sets (${exact} exact); prompt fires ${right + needless + other}: offers the label ${right}, needless on an exact set ${needless}, other ${other}; labelled N + 1 and silent ${silentCut}`);
    if (named.length && named.length <= 12) L.push(`  ${named.join('; ')}`);
  }
  process.stdout.write(L.join('\n') + '\n');
}, 600_000);
