/**
 * Front raise, 3 October: each shoulder is counted and their reps joined, always (`together` with no correlation
 * gate, DETECTION in core.ts), rather than the shoulder with more reps. A raise both arms make counts once;
 * alternating raises count one each. The 30 September either-side rule mixed the two arms' angles sample by
 * sample, and a 0.3 s dropout of the working arm at the top handed the angle to the resting arm: 8 alternating
 * raises read 16 (test/real-phone/either-side/README.md). Each arm is now counted on its own, so a dropout bridges.
 * Angles are illustrative (UNSOURCED): arm down 15° to 20°, raised 110°.
 */
import { describe, expect, it } from 'vitest';
import { countReps, liftDefinition } from '../core';
import { summarizeCount } from '../../coreAnalysis';
import { cycles, jointFrame, sample, timestamps } from './synthetic';

const SPS = 30;

describe('a front raise counted on both shoulders, joined', () => {
  it('is a together lift with no correlation gate; cable and plate front raises are unchanged', () => {
    expect(liftDefinition('front_raise')).toMatchObject({ together: true, eitherSide: false, togetherMinCorrelation: -Infinity });
    expect(liftDefinition('cable_front_raise')?.together).toBeFalsy();
    expect(liftDefinition('plate_front_raise')?.together).toBeFalsy();
  });

  it('counts 6 when both arms raise together', () => {
    const a = sample([{ hold: 20, sec: 1 }, ...cycles({ rest: 20, work: 110, reps: 6, firstSec: 0.9, secondSec: 0.9, restSec: 0.5 }), { hold: 20, sec: 1 }], 20, SPS);
    const ts = timestamps(a.length, SPS);
    expect(countReps(ts.map((_, i) => jointFrame('shoulder', { left: a[i], right: a[i] })), ts, 'front_raise').count).toBe(6);
  });

  // 8 alternating raises (left, right, left…), each 0.8 s up and 0.8 s down, 0.4 s at rest; the working arm hidden
  // for `gap` seconds around the top of each raise while the resting arm stays in sight at 15°.
  const alternating = (gap: number) => {
    const per = Math.round(2 * SPS), up = Math.round(0.8 * SPS);
    const raise = sample([{ to: 110, sec: 0.8 }, { to: 15, sec: 0.8 }, { hold: 15, sec: 0.4 }], 15, SPS).slice(0, per);
    const n = SPS + 8 * per + SPS;
    const ts = timestamps(n, SPS);
    const wl = ts.map((_, i) => {
      const k = i - SPS, rep = Math.floor(k / per), j = k - rep * per;
      if (k < 0 || rep >= 8) return jointFrame('shoulder', { left: 15, right: 15 });
      const working = rep % 2 === 0 ? 'left' : 'right', other = working === 'left' ? 'right' : 'left';
      const hidden = Math.abs(j - up) * 2 < gap * SPS;
      return jointFrame('shoulder', { [other]: 15, ...(hidden ? {} : { [working]: raise[j] }) });
    });
    return { wl, ts };
  };

  for (const gap of [0, 0.1, 0.2, 0.3, 0.4]) {
    it(`counts 8 alternating raises one each, with a ${gap} s dropout of the working arm at the top`, () => {
      const { wl, ts } = alternating(gap);
      expect(countReps(wl, ts, 'front_raise').count).toBe(8);
      const r = summarizeCount(wl, ts, 'front_raise');
      expect(r.refused).toBe(false);
      expect(r.count).toBe(8);
    });
  }
});
