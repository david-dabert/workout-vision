import { describe, expect, it } from 'vitest';
import { sureLine, sureRow } from './sure';

// The "right when sure" line (sure.ts, R16): what counts as shown as sure, and what as asking.
describe('right when sure', () => {
  it('shows no count for a refused set, a set counted none in, or a scored window holding no rep', () => {
    expect(sureRow({ refused: true, count: 5 }, 'squat', 5).err).toBeNull();
    expect(sureRow({ refused: false, count: 0 }, 'squat', 5).err).toBeNull();
    // A whole clip counted 4 whose labelled window holds none: nothing is shown for the window, so nothing is sure.
    expect(sureRow({ refused: false, count: 4, reps: [] }, 'squat', 3, () => 0).err).toBeNull();
  });

  it('reads the body check\'s flag as asking, and the sensitivity check\'s move only in its own reading', () => {
    const rows = [{ err: 0, flagged: false, moved: false }, { err: 3, flagged: true, moved: false }, { err: 1, flagged: false, moved: true }, { err: null, flagged: false, moved: false }];
    const line = sureLine(rows);
    expect(line).toContain('of 4 sets that decide, 3 counted');
    expect(line).toContain('As the app ships, shown as sure 2: 1 exact (50%), 1 off by 1 or 2, 0 off by 3+; asked to confirm 1: 0 exact (0%), 0 off by 1 or 2, 1 off by 3+');
    expect(line).toContain('shown as sure 1: 1 exact (100%), 0 off by 1 or 2, 0 off by 3+; asked to confirm 2: 0 exact (0%), 1 off by 1 or 2, 1 off by 3+');
  });
});
