import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount, withProposal, withBodyCheck, withSensitivity, SENSITIVITY_GRID } from '../coreAnalysis';
import { countReps } from '../counting/core';

// The sensitivity check (coreAnalysis.js withSensitivity; stability study of 10 October 2026) on David's real videos as
// the app read them (test/real-phone/sets-07oct-video/): it adds a field and changes nothing else.
const read = name => JSON.parse(gunzipSync(readFileSync(resolve(__dirname, '../../../test/real-phone/sets-07oct-video', `${name}.json.gz`))).toString());
const app = d => withBodyCheck(withProposal({ ...summarizeCount(d.worldLandmarks, d.timestamps, d.lift), exercise: d.lift, imageLandmarks: d.imageLandmarks, worldLandmarks: d.worldLandmarks, timestamps: d.timestamps }, d.lift), d.lift);

describe('the counter with nearby settings', () => {
  it('counts exactly as before when no tuning is given', () => {
    const d = read('lying_biceps_curl_11');
    expect(countReps(d.worldLandmarks, d.timestamps, d.lift, {})).toEqual(countReps(d.worldLandmarks, d.timestamps, d.lift));
  });
  it('recounts with the six settings of the grid: margin x0.9, x1, x1.1, each with the outlier window 7 and 9', () => {
    expect(SENSITIVITY_GRID).toEqual([0.9, 1, 1.1].flatMap(m => [7, 9].map(w => ({ marginScale: m, outlierWindow: w }))));
  });
});

describe('withSensitivity', () => {
  it('marks a count that moves with nearby settings (barbell squat a: it swings 6 to 10 between encodings)', () => {
    const r = withSensitivity(app(read('barbell_squat_9_a')), 'squat');
    expect(r.sensitivity.moved).toBe(true);
    expect(r.sensitivity.counts).toHaveLength(6);
    expect(r.sensitivity.counts.some(c => c !== r.count)).toBe(true);
  });
  it('leaves a count that holds unmarked (seated dumbbell curl: 10 on all six encodings)', () => {
    const d = read('seated_dumbbell_curl_10');
    const r = withSensitivity(app(d), d.lift);
    expect(r.sensitivity.moved).toBe(false);
    expect(r.sensitivity.counts).toEqual(Array(6).fill(r.count));
  });
  it('changes nothing but its own field: the count, the reps, the refusal, the proposal, the body check', () => {
    for (const name of ['barbell_squat_9_a', 'seated_dumbbell_curl_10', 'standing_barbell_curl_8']) {
      const d = read(name);
      const before = app(d), after = withSensitivity(before, d.lift);
      const { sensitivity, ...rest } = after;
      expect(rest).toEqual(before);
      void sensitivity;
    }
  });
  it('runs on no refused set, no set counted none in, and no fitness test', () => {
    const refused = app(read('standing_barbell_curl_8'));
    expect(refused.refused).toBe(true);
    expect(withSensitivity(refused, 'barbell_curl')).toBe(refused);
    const none = { refused: false, count: 0, timestamps: [0] };
    expect(withSensitivity(none, 'squat')).toBe(none);
  });
});
