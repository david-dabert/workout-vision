import { describe, expect, it } from 'vitest';
import { fuseCounts, fusionOn, RHYTHM_FUSION } from '../fusion.js';

const rhythm = (count, confidence = 0.6, period = 2) => ({ count, confidence, period });

describe('fuseCounts: the rhythm never silently changes a confident skeleton count', () => {
  it('keeps the skeleton count, unmarked, when the two agree', () => {
    expect(fuseCounts({ count: 9, refused: false }, 0.98, rhythm(9))).toEqual({ count: 9, source: 'skeleton', toConfirm: false, reason: null });
  });
  it('keeps the skeleton count and marks the set to confirm when they disagree', () => {
    expect(fuseCounts({ count: 7, refused: false }, 0.98, rhythm(9))).toEqual({ count: 7, source: 'skeleton', toConfirm: true, reason: 'disagree' });
  });
  it('proposes the rhythm count, to confirm, when the skeleton refused', () => {
    expect(fuseCounts({ count: 0, refused: true }, 0.4, rhythm(6))).toEqual({ count: 6, source: 'rhythm', toConfirm: true, reason: 'refused' });
  });
  it('proposes the rhythm count, to confirm, when the pose covers under 80 % of the samples', () => {
    expect(fuseCounts({ count: 5, refused: false }, 0.64, rhythm(6))).toEqual({ count: 6, source: 'rhythm', toConfirm: true, reason: 'coverage' });
  });
  it('leaves the skeleton outcome when the rhythm found no period or no frames were kept', () => {
    expect(fuseCounts({ count: 7, refused: false }, 0.98, { count: 0, confidence: 0, period: null })).toEqual({ count: 7, source: 'skeleton', toConfirm: false, reason: null });
    expect(fuseCounts({ count: 7, refused: false }, 0.5, null)).toEqual({ count: 7, source: 'skeleton', toConfirm: false, reason: null });
    expect(fuseCounts({ count: 0, refused: true }, 0.2, null)).toEqual({ count: null, source: 'none', toConfirm: false, reason: null });
  });
  it('does not propose an unsure rhythm count on a weak set, but still marks a disagreement', () => {
    expect(fuseCounts({ count: 5, refused: false }, 0.6, rhythm(8, 0.1))).toEqual({ count: 5, source: 'skeleton', toConfirm: true, reason: 'disagree' });
  });
  it('is off in the app unless the bench hook turns it on', () => {
    expect(RHYTHM_FUSION).toBe(false);
    expect(fusionOn()).toBe(false);
    globalThis.__WV_BENCH_FUSION__ = true;
    try { expect(fusionOn()).toBe(true); } finally { delete globalThis.__WV_BENCH_FUSION__; }
  });
});
