/**
 * Third audit, C52, and the review of its fix (3 October 2026): the set collectors list every exercise the app
 * offers except the two fitness tests, left out until David says which count a test set is labelled with.
 * Third audit, C21 (3 October 2026): and the four floor exercises withdrawn from the app (offer.js, WITHDRAWN), whose
 * collected sets are what would bring them back; and the barbell jump squat, not yet counted (offer.js, NOT_YET_COUNTED).
 */
import { describe, expect, it } from 'vitest';
import { COLLECTOR_LIFTS } from '../collectorLifts';
import { NOT_YET_COUNTED, OFFERED, WITHDRAWN } from '../offer';
import { isTest } from '../fitness-tests';

describe('the collectors’ exercise list', () => {
  it('holds every offered exercise but the fitness tests, the withdrawn ones and the one not yet counted, once', () => {
    expect(COLLECTOR_LIFTS.map(l => l.key).sort()).toEqual([...OFFERED.filter(k => !isTest(k)), ...Object.keys(WITHDRAWN), ...Object.keys(NOT_YET_COUNTED)].sort());
  });
  it('leaves the fitness tests out', () => {
    expect(COLLECTOR_LIFTS.some(l => l.key === 'chair_stand_test' || l.key === 'arm_curl_test')).toBe(false);
  });
});
