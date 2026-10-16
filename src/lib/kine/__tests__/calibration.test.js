import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_HZ, compareCurves, referenceFromCurves } from '../../reference/compare.js';
import { agreement, bestTolerance, trialFromResult, verdictAt } from '../calibration.js';

// A staged raise (as compare.test.js): shoulder 10 -> 90 -> hold -> 170 -> hold -> 10, elbow straight.
function staged({ top = 170, elbow = 172 } = {}) {
  const keys = [[0, 10], [3, 90], [5, 90], [8, top], [11, top], [14, 10]];
  const n = 14 * SAMPLE_HZ + 1;
  const shoulder = Array.from({ length: n }, (_, i) => {
    const t = i / SAMPLE_HZ, k = keys.findIndex(([kt]) => kt >= t);
    if (k <= 0) return keys[0][1];
    const [t0, v0] = keys[k - 1], [t1, v1] = keys[k];
    return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  });
  return { rightShoulder: shoulder, rightElbow: shoulder.map(() => elbow) };
}
const ref = referenceFromCurves(staged());
const trial = (curves, label) => trialFromResult(compareCurves(ref, curves), { exercise: 'elevation-paliers', label });

describe('calibration trials', () => {
  it('keep figures only, and give the engine\'s own verdict back at the provisional tolerance', () => {
    for (const c of [staged(), staged({ top: 150 }), staged({ top: 125 }), staged({ elbow: 150 })]) {
      const r = compareCurves(ref, c);
      const t = trialFromResult(r, { exercise: 'elevation-paliers', label: 'match' });
      expect(verdictAt(t)).toBe(r.verdict);
      expect(Object.keys(t).sort()).toEqual(['app', 'date', 'exercise', 'fault', 'joints', 'label', 'side', 'v']);
    }
  });

  it('give no verdict to a trial the app refused', () => {
    const t = trialFromResult({ verdict: 'refused', reasons: ['unseen:rightElbow'], joints: [] }, { exercise: 'x', label: 'revise' });
    expect(verdictAt(t)).toBeNull();
  });

  it('count agreement, faults caught and correct attempts wrongly flagged', () => {
    const ts = [trial(staged(), 'match'), trial(staged({ top: 125 }), 'revise'), trial(staged({ top: 160 }), 'match')];
    expect(agreement(ts)).toMatchObject({ n: 3, revise: 1, caught: 1, match: 2 });
  });

  it('find the tolerance that follows a physiotherapist stricter than the provisional one', () => {
    // He passes raises to 166 degrees and over, flags those to 160 and under.
    const ts = [
      ...[170, 168, 166].map(top => trial(staged({ top }), 'match')),
      ...[160, 156, 150, 140, 130].map(top => trial(staged({ top }), 'revise')),
    ];
    const best = bestTolerance(ts);
    expect(best.balanced).toBe(1);
    expect(agreement(ts, best)).toMatchObject({ agree: 8, n: 8 });
    // The provisional tolerance does not follow him on these.
    expect(agreement(ts).agree).toBeLessThan(8);
  });

  it('propose nothing from too few trials or one kind of judgment', () => {
    expect(bestTolerance([trial(staged(), 'match')])).toBeNull();
    expect(bestTolerance(Array.from({ length: 8 }, () => trial(staged(), 'match')))).toBeNull();
  });
});

describe('the trials kept on the phone', () => {
  let store;
  beforeEach(() => { store = {}; vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }); });
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('add, read, export and clear', async () => {
    const { addTrial, readTrials, exportTrials, clearTrials } = await import('../calibration.js');
    expect(addTrial(trial(staged(), 'match'))).toBe(true);
    expect(readTrials()).toHaveLength(1);
    expect(JSON.parse(exportTrials())).toMatchObject({ kind: 'workout-vision kine calibration', trials: [{ exercise: 'elevation-paliers', label: 'match' }] });
    clearTrials();
    expect(readTrials()).toEqual([]);
  });

  it('say so when the storage refuses', async () => {
    localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    const { addTrial } = await import('../calibration.js');
    expect(addTrial(trial(staged(), 'match'))).toBe(false);
  });
});
