import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  GHOST_DECAY_START,
  REP_PERIOD_BOUNDS,
  VISIBILITY_THRESHOLD,
  getRepPeriodBounds,
} from '../analysisConfig';

const here = dirname(fileURLToPath(import.meta.url));

describe('Card 052: one analysis configuration checked by the type checker', () => {
  it('removes the duplicate analysisConfig.js so Vite and tsc read the same file', () => {
    expect(existsSync(resolve(here, '../analysisConfig.js'))).toBe(false);
    expect(existsSync(resolve(here, '../analysisConfig.ts'))).toBe(true);
  });

  it('keeps the runtime values the app ran before (GHOST_DECAY_START = 2)', () => {
    expect(GHOST_DECAY_START).toBe(2);
    expect(VISIBILITY_THRESHOLD).toBe(0.55);
    expect(getRepPeriodBounds('bicep_curl')).toEqual({ min: 1.0, max: 4.0 });
    expect(getRepPeriodBounds('unknown_exercise')).toEqual(REP_PERIOD_BOUNDS._default);
  });
});
