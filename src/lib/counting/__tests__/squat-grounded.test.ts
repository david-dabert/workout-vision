import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { countReps, liftDefinition } from '../core';

const ROOT = resolve(__dirname, '../../../../test/real-phone');
const gz = (f: string) => JSON.parse(gunzipSync(readFileSync(resolve(ROOT, f))).toString());

describe('fixedFeet on grounded platform squats (hack squat, pendulum squat)', () => {
  it('hack_squat has fixedFeet enabled in its lift definition', () => {
    const def = liftDefinition('hack_squat');
    expect(def).not.toBeNull();
    expect(def?.joint).toBe('knee');
    expect(def?.fixedFeet).toBe(true);
  });

  it('eliminates false extension spikes and rep doubling on pendulum_squat_7 (label 7)', () => {
    const d = gz('sets-07oct-video/pendulum_squat_7.json.gz');
    const ts = d.timestamps || d.frames?.map((f: any) => f.timestamp || f.t);
    const wl = d.worldLandmarks || d.frames?.map((f: any) => f.worldLandmarks);

    // With fixedFeet (default for hack_squat), counts exactly 7 reps matching David's label:
    const res = countReps(wl, ts, 'hack_squat');
    expect(res.count).toBe(7);
    expect(res.reps.length).toBe(7);

    // Reps are contiguous and evenly paced (cadence ~3.5 to 5.5 s per rep):
    for (const r of res.reps) {
      const dur = r.endTime - r.startTime;
      expect(dur).toBeGreaterThan(2.5);
      expect(dur).toBeLessThan(7.0);
    }
  });
});
