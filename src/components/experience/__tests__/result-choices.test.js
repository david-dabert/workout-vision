import { describe, expect, it } from 'vitest';
import { CHOICE_RULE, countChoices, inList } from '../result-choices';

// The list the result screen can offer (result-choices.js; pillar 2, 9 October 2026): the number shown and its two
// neighbours, and the screen state, from the counter's result alone.
describe('countChoices', () => {
  it('a counted set: the count, then one more, then one fewer, to confirm', () => {
    expect(countChoices({ count: 9, refused: false })).toEqual({ main: 9, alts: [10, 8], state: 'counted', rule: CHOICE_RULE });
  });
  it('never offers 0', () => {
    expect(countChoices({ count: 1, refused: false }).alts).toEqual([2]);
  });
  it('a refused set: the proposal to check, or nothing when there is none', () => {
    expect(countChoices({ count: 0, refused: true, proposal: { count: 6 } })).toMatchObject({ main: 6, alts: [7, 5], state: 'check' });
    expect(countChoices({ count: 0, refused: true, proposal: null })).toMatchObject({ main: null, alts: [], state: 'ask' });
  });
  it('a flagged count is one to check', () => {
    expect(countChoices({ count: 8, refused: false, bodyCheck: { flagged: true } }).state).toBe('check');
    expect(countChoices({ count: 8, refused: false, bodyCheck: { flagged: false } }).state).toBe('counted');
  });
  it('shows nothing where the screen shows nothing: counted none, not read, live count not found again', () => {
    expect(countChoices({ count: 0, refused: false }).main).toBe(null);
    expect(countChoices({ count: 0, refused: true, notRead: { kind: 'partial' }, proposal: { count: 4 } }).main).toBe(null);
    expect(countChoices({ count: 7, refused: false }, { liveShown: 6 })).toMatchObject({ main: null, state: 'ask' });
    expect(countChoices({ count: 7, refused: false }, { liveShown: 7 })).toMatchObject({ main: 7, state: 'counted' });
  });
});

describe('inList', () => {
  const ch = countChoices({ count: 9, refused: false });
  it('reads the list cut to its size', () => {
    expect([9, 10, 8].map(n => inList(ch, n, 3))).toEqual([true, true, true]);
    expect([9, 10, 8].map(n => inList(ch, n, 2))).toEqual([true, true, false]);
    expect(inList(ch, 9, 1)).toBe(true);
    expect(inList(ch, 7, 3)).toBe(false);
  });
  it('holds nothing when nothing is shown', () => {
    expect(inList(countChoices({ count: 0, refused: false }), 0)).toBe(false);
  });
});
