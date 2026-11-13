// Card 016 (cards/016-accuracy-on-the-shipping-gate.md): does the "right when sure" figure (sure.ts) count as sure the
// sets the result screen shows as sure? The screen's rule (Result.jsx: flagged, sensitive, openedMidRep) is applied to
// each set as the app builds it (coreAnalysis.js: summarizeCount, withProposal, withBodyCheck, withSensitivity), and
// compared with sure.ts's verdict on the same set. A difference is a set the figure scores as sure that the screen asks
// to confirm, or the reverse. SCOREBOARD=1 writes sure-parity.txt.
import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sensitivityAsks, summarizeCount, withBodyCheck, withProposal, withSensitivity } from '../../../src/lib/coreAnalysis';
import { countInWindow, decides, labelledSets, publicSets } from './sets';
import { sureRow } from './sure';

/** The result screen's decision (Result.jsx lines 200 to 216, production: no live set): true when shown as sure. */
export function screenSure(result: any): boolean {
  if (!result || result.refused || !(result.count > 0)) return false;
  const flagged = result.bodyCheck?.flagged === true;
  const sensitive = !flagged && result.sensitivity?.moved === true && sensitivityAsks(result.count, result.sensitivity?.counts);
  const openedMidRep = !flagged && result.headRefused === true;
  return !(flagged || sensitive || openedMidRep);
}

const appResult = (s: any) => {
  const c: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
  const r = withBodyCheck(withProposal({ ...c, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: s.il ?? null }, s.lift), s.lift);
  return withSensitivity(r, s.lift);
};

function compare(sets: any[], countOf: (s: any) => (r: any) => number) {
  let both = 0, onlyFigure = 0, onlyScreen = 0, neither = 0;
  const diffs: string[] = [];
  for (const s of sets.filter(x => decides(x.lift))) {
    const app = appResult(s);
    const screen = screenSure(app);
    const row = sureRow(app, s.lift, s.label, countOf(s));
    const figure = row.err !== null && !row.flagged && !row.moved;
    if (screen && figure) both++; else if (figure) { onlyFigure++; diffs.push(`figure only: ${s.name}`); }
    else if (screen) { onlyScreen++; diffs.push(`screen only: ${s.name}`); } else neither++;
  }
  return { both, onlyFigure, onlyScreen, neither, diffs };
}

describe('card 016: the figure counts as sure what the screen shows as sure', () => {
  const david = compare(labelledSets().sets as any[], () => (r: any) => r.count);
  const pub = compare(publicSets('build').sets as any[], s => (r: any) => countInWindow(r.reps, s.window));
  const lines = [
    '# Card 016: sure.ts against the result screen\'s rule, set by set (sure-parity.test.ts; SCOREBOARD=1 rewrites this file)',
    `David's labelled sets: sure for both ${david.both}, for neither ${david.neither}, figure only ${david.onlyFigure}, screen only ${david.onlyScreen}`,
    `Public build sets: sure for both ${pub.both}, for neither ${pub.neither}, figure only ${pub.onlyFigure}, screen only ${pub.onlyScreen}`,
    ...david.diffs, ...pub.diffs.slice(0, 40),
  ];
  it('records the comparison', () => {
    if (process.env.SCOREBOARD) writeFileSync(resolve(__dirname, 'sure-parity.txt'), lines.join('\n') + '\n');
    console.log(lines.slice(0, 3).join('\n'));
    expect(david.both + david.neither + david.onlyFigure + david.onlyScreen).toBeGreaterThan(0);
  });
  it('agrees with the screen on every set', () => {
    expect(david.onlyFigure + david.onlyScreen, david.diffs.join('\n')).toBe(0);
    expect(pub.onlyFigure + pub.onlyScreen, pub.diffs.slice(0, 20).join('\n')).toBe(0);
  });
});
