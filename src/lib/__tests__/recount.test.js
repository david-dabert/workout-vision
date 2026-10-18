import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { recountTo, summarizeCount, RECOUNT_GRID } from '../coreAnalysis';
import { savedSet } from '../../components/experience/saved-set';

// A corrected count read again for the person's number (recountTo; David, 18 October 2026): the reps a setting of the
// counter finds for that number, or none. David's back extension of 13, which the app counts 12.
const file = resolve(__dirname, '../../../test/real-phone/sets-06oct/set01_machine_seated_back_extension_13_side_c6f69462.json.gz');
const set = JSON.parse(gunzipSync(readFileSync(file)).toString());
const result = { ...summarizeCount(set.worldLandmarks, set.timestamps, set.lift), worldLandmarks: set.worldLandmarks, timestamps: set.timestamps, metadata: { duration: 40 } };

describe('a corrected count read again', () => {
  it('finds the reps of the person\'s count under a setting near the app\'s, and changes nothing of the app\'s count', () => {
    expect(result.count).toBe(12);
    const rc = recountTo(result, set.lift, 13);
    expect(rc.reps).toHaveLength(13);
    expect(RECOUNT_GRID).toContainEqual(rc.tuning);
    expect(result.count).toBe(12);
  });

  it('finds nothing far from the app\'s count, for its own count, or on a refused set', () => {
    expect(recountTo(result, set.lift, 20)).toBeNull();
    expect(recountTo(result, set.lift, 12)).toBeNull();
    expect(recountTo({ ...result, refused: true }, set.lift, 13)).toBeNull();
  });

  it('saves the reps found, beside the app\'s own count', () => {
    const rc = recountTo(result, set.lift, 13);
    const saved = savedSet({ result: { ...result, reps: rc.reps, smoothedAngles: rc.smoothedAngles, recount: { n: 13, tuning: rc.tuning } }, lift: set.lift, n: 13, corrected: true });
    expect(saved.repDetails).toHaveLength(13);
    expect(saved.machineResult.reps).toBe(12);
    expect(saved.correctedResult).toEqual({ reps: 13 });
    expect(saved.recount.tuning).toEqual(rc.tuning);
  });
});
