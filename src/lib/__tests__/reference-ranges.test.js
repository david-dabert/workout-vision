import { describe, expect, it } from 'vitest';
import { REFERENCE_BAND_SHOWN, REFERENCE_RANGES, referenceBand } from '../reference-ranges';
import { TIERS } from '../liftTiers';
import { liftDefinition } from '../counting/core';
import { waveGeometry } from '../../components/experience/wave';

describe('reference ranges (BACKLOG, 6 October, step 2)', () => {
  it('is off until the measured range is honest enough (synth.txt, TRIED.md)', () => {
    expect(REFERENCE_BAND_SHOWN).toBe(false);
    expect(referenceBand('squat')).toBeNull();
  });
  it('holds only Beta lifts, on the joint the count tracks, each end with a source and a status (R9)', () => {
    for (const [lift, r] of Object.entries(REFERENCE_RANGES)) {
      expect(TIERS[lift], lift).toBe('beta');
      expect(liftDefinition(lift)?.joint, lift).toBe(r.joint);
      for (const end of [r.work, r.rest]) {
        expect(end.source.length, lift).toBeGreaterThan(10);
        expect(['validated', 'literature', 'convention', 'experimental']).toContain(end.status);
        expect(end.deg).toBeGreaterThan(0);
        expect(end.deg).toBeLessThanOrEqual(180);
      }
    }
  });
  it('draws nothing for a lift that is not Beta, has no range, or is tracked on another joint', () => {
    expect(referenceBand('squat', { shown: true })).toEqual({ lo: 90, hi: 180 });
    expect(referenceBand('squat', { shown: true, tier: 'experimental' })).toBeNull();
    expect(referenceBand('lat_pulldown', { shown: true })).toBeNull();
    expect(referenceBand('leg_press', { shown: true })).toBeNull();
    expect(referenceBand('squat', { shown: true, joint: 'hip' })).toBeNull();
  });
  it('widens the wave scale to hold the band, and leaves it as it was without one', () => {
    const angles = [170, 120, 100, 120, 170], timestamps = [0, 1, 2, 3, 4];
    const plain = waveGeometry({ angles, timestamps, rest: 'high' }), none = waveGeometry({ angles, timestamps, rest: 'high', include: null });
    expect(none.y(100)).toBe(plain.y(100));
    const wide = waveGeometry({ angles, timestamps, rest: 'high', include: [90, 180] });
    expect(wide.y(90)).toBeCloseTo(4);
    expect(wide.y(180)).toBeCloseTo(68);
  });
});
