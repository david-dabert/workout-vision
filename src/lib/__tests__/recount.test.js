import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { recountTo, summarizeCount, RECOUNT_GRID } from '../coreAnalysis';
import { savedSet } from '../../components/experience/saved-set';

// A corrected count read again for the person's number (recountTo; David, 18 October 2026): the reps a setting of the
// counter finds for that number, or none. David's lat pulldown of 11, which the app counts 10.
const file = resolve(__dirname, '../../../test/real-phone/sets-18oct-video/lat_pulldown_11_back.json.gz');
const set = JSON.parse(gunzipSync(readFileSync(file)).toString());
const result = { ...summarizeCount(set.worldLandmarks, set.timestamps, set.lift), worldLandmarks: set.worldLandmarks, timestamps: set.timestamps, metadata: { duration: 40 } };

describe('a corrected count read again', () => {
  it('finds the reps of the person\'s count under a setting near the app\'s, and changes nothing of the app\'s count', () => {
    expect(result.count).toBe(10);
    const rc = recountTo(result, set.lift, 11);
    expect(rc.reps).toHaveLength(11);
    expect(RECOUNT_GRID).toContainEqual(rc.tuning);
    expect(result.count).toBe(10);
  });

  it('finds nothing far from the app\'s count, for its own count, or on a refused set', () => {
    expect(recountTo(result, set.lift, 20)).toBeNull();
    expect(recountTo(result, set.lift, 10)).toBeNull();
    expect(recountTo({ ...result, refused: true }, set.lift, 11)).toBeNull();
  });

  it('saves the reps found, beside the app\'s own count', () => {
    const rc = recountTo(result, set.lift, 11);
    const saved = savedSet({ result: { ...result, reps: rc.reps, smoothedAngles: rc.smoothedAngles, recount: { n: 11, tuning: rc.tuning } }, lift: set.lift, n: 11, corrected: true });
    expect(saved.repDetails).toHaveLength(11);
    expect(saved.machineResult.reps).toBe(10);
    expect(saved.correctedResult).toEqual({ reps: 11 });
    expect(saved.recount.tuning).toEqual(rc.tuning);
  });
});
