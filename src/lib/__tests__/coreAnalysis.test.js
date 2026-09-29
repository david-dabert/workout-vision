import { describe, it, expect } from 'vitest';
import { APPROVED_LIFTS, analyzeCoreVideo, summarizeCount } from '../coreAnalysis';

function visibleFrame() {
  return Array.from({ length: 33 }, (_, i) => ({ x: i / 33, y: 0, z: 0, visibility: 1 }));
}
describe('Step 3 analysis boundary', () => {
  // 28 September: David moved bench press, then overhead press, to Experimental. See PLAN.md, "Lift tiers".
  // Step 2 (David's decision, 29 September 2026): the 182 countable exercises of the guide are offered,
  // the nine lifts of LIFT TIERS among them; Automatic, an exercise without a joint and a core-only
  // lift still are not.
  it('does not allow Automatic, an exercise the guide cannot count, or a lift the guide does not hold', async () => {
    expect(APPROVED_LIFTS).toHaveLength(182);
    for (const lift of ['bench_press', 'bicep_curl', 'hip_thrust', 'lat_pulldown', 'lateral_raise', 'leg_press', 'overhead_press', 'romanian_deadlift', 'squat']) expect(APPROVED_LIFTS, lift).toContain(lift);
    for (const lift of ['__auto__', 'triceps_pushdown', 'pec_deck', 'bicep_curl_alternating']) {
      await expect(analyzeCoreVideo(null, lift)).rejects.toThrow('Choose an approved lift');
    }
  });
  it('refuses when joints are hidden for a strict majority, not exactly half', () => {
    expect(summarizeCount([null, null, visibleFrame()], [0, 1, 2], 'bicep_curl').refused).toBe(true);
    expect(summarizeCount([null, visibleFrame()], [0, 1], 'bicep_curl').refused).toBe(false);
  });
  it('shows zero rather than refusing a visible motionless set', () => {
    const frames = Array.from({ length: 30 }, visibleFrame);
    const result = summarizeCount(frames, frames.map((_, i) => i / 15), 'bicep_curl');
    expect(result.count).toBe(0);
    expect(result.confidence).toBe(0);
    expect(result.refused).toBe(false);
  });
});
