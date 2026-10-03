/**
 * Third audit, C52 (3 October 2026): the set collectors list every exercise the app offers, the two fitness tests
 * included, which have no guide entry and were dropped from both dropdowns.
 */
import { describe, expect, it } from 'vitest';
import { COLLECTOR_LIFTS } from '../collectorLifts';
import { OFFERED } from '../offer';

describe('the collectors’ exercise list', () => {
  it('holds every offered exercise, once', () => {
    expect(COLLECTOR_LIFTS.map(l => l.key).sort()).toEqual([...OFFERED].sort());
  });
  it('names the fitness tests in French and English', () => {
    expect(COLLECTOR_LIFTS.find(l => l.key === 'chair_stand_test')?.label).toBe('Lever de chaise, 30 secondes / 30-second chair stand');
    expect(COLLECTOR_LIFTS.find(l => l.key === 'arm_curl_test')?.label).toBe('Flexions de bras, 30 secondes / 30-second arm curl');
  });
});
