import { describe, it, expect } from 'vitest';
import { withProposal } from '../coreAnalysis';

// 8 October 2026: an alternating lift (bothSides) gets no PSC proposal, since PSC proposed 7 of the 14 occlusion
// alternating curls at half their count. A refused alternating set stays refused, as before the proposal existed.
describe('withProposal and alternating lifts', () => {
  const refused = { count: 0, refused: true, reps: [], timestamps: [0, 0.1, 0.2], worldLandmarks: [], imageLandmarks: [] };
  it('returns a refused alternating curl unchanged, with no proposal', () => {
    const out = withProposal(refused, 'bicep_curl_alternating');
    expect(out).toBe(refused);
    expect(out.proposal).toBeUndefined();
  });
  it('still leaves a counted set unchanged', () => {
    const counted = { ...refused, refused: false, count: 8 };
    expect(withProposal(counted, 'bicep_curl')).toBe(counted);
  });
});
