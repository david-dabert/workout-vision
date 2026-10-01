import { describe, expect, it } from 'vitest';
import { isCorrected, markLabel, marksLabel, provenance, overlayLines } from '../replay-labels';

describe('the saved count and the detected marks stay distinct (review of 1 October)', () => {
  it('a correction is a saved count other than the detected one', () => {
    expect(isCorrected(8, 7)).toBe(true);
    expect(isCorrected(7, 7)).toBe(false);
    expect(isCorrected(null, 7)).toBe(false);
  });
  it('names a mark as a rep unless the count was corrected', () => {
    expect(markLabel({ index: 3, total: 7, fr: true, corrected: false })).toBe('Répétition 3 sur 7');
    expect(markLabel({ index: 3, total: 7, fr: true, corrected: true })).toBe('Repère détecté 3 sur 7');
    expect(markLabel({ index: 3, total: 7, fr: false, corrected: true })).toBe('Detected mark 3 of 7');
    expect(marksLabel({ fr: true, corrected: true })).toBe('Repères détectés par l’app');
    expect(marksLabel({ fr: false, corrected: false })).toBe('Reps, one per mark');
  });
  it('states both counts after a correction, and nothing otherwise', () => {
    expect(provenance({ detected: 7, saved: 8, fr: true })).toBe('L’app a détecté 7 répétitions. Vous avez enregistré 8.');
    expect(provenance({ detected: 1, saved: 0, fr: false })).toBe('The app detected 1 rep. You saved 0.');
    expect(provenance({ detected: 7, saved: 7, fr: true })).toBe('');
    expect(provenance({ detected: 7, saved: null, fr: true })).toBe('');
  });
  it('the video overlay explains itself after a correction', () => {
    expect(overlayLines({ begun: 3, total: 7, detected: 7, saved: 7, fr: true })).toEqual(['3 / 7']);
    expect(overlayLines({ begun: 3, total: 7, detected: 7, saved: 8, fr: true })).toEqual(['3 / 7', 'L’app a détecté 7 répétitions. Vous avez enregistré 8.']);
  });
});
