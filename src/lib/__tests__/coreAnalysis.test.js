import { describe, it, expect } from 'vitest';
import { APPROVED_LIFTS, analyzeCoreVideo, summarizeCount } from '../coreAnalysis';

function visibleFrame() {
  return Array.from({ length: 33 }, (_, i) => ({ x: i / 33, y: 0, z: 0, visibility: 1 }));
}
describe('Step 3 analysis boundary', () => {
  it('does not allow Automatic or either parked press', async () => {
    expect(APPROVED_LIFTS).toEqual(['bicep_curl', 'lateral_raise', 'lat_pulldown']);
    for (const lift of ['__auto__', 'bench_press', 'overhead_press']) {
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
