import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { countReps } from '../core';
import { jointFrame, sample, timestamps, type Segment } from './synthetic';

describe('deep return split and post-set exit guard', () => {
  it('splits an overlong rep with deep return (>= 85%) even when set has varied cadence with quick reps', () => {
    const REST = 170, WORK = 50;
    const rep = (sec = 1): Segment[] => [{ to: WORK, sec }, { to: REST, sec }, { hold: REST, sec: 0.5 }];
    const doubled = (returnTo: number): Segment[] => [
      { to: WORK, sec: 1 }, { to: returnTo, sec: 0.9 }, { to: WORK, sec: 0.9 }, { to: REST, sec: 1 }, { hold: REST, sec: 0.5 },
    ];
    // Short rep: 0.55s each way -> 1.1s cycle duration
    // Regular rep: 1.2s each way -> 2.4s cycle duration
    // durations[0] (1.1s) < 0.6 * md (1.44s), so isRegular is false.
    // But 1.1s >= 0.45 * md, so isDeepRegular allows unequivocal return (bestShare >= 0.85) to split.
    const path: Segment[] = [
      ...rep(0.55),
      ...rep(1.2),
      ...rep(1.2),
      ...doubled(140),
      ...rep(1.2),
    ];
    const sps = 30;
    const a = sample(path, REST, sps);
    const res = countReps(a.map(x => jointFrame('elbow', { left: x })), timestamps(a.length, sps), 'bicep_curl');
    expect(res.count).toBe(6);
  });

  it('correctly counts David\'s seated back extension set c6f69462 as 13 exact (not 12 merged, not 14 post-set cut)', () => {
    const file = resolve(__dirname, '../../../../test/real-phone/sets-06oct/set01_machine_seated_back_extension_13_side_c6f69462.json.gz');
    const raw = JSON.parse(gunzipSync(readFileSync(file)).toString());
    const res = countReps(raw.worldLandmarks, raw.timestamps, raw.lift);
    expect(res.count).toBe(13);
  });
});
