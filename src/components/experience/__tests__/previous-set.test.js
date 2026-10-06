import { describe, expect, it } from 'vitest';
import { previousSet } from '../sets';

// Critic's finding, 30 September: the report compared the set with itself (the newest saved set of the
// lift is the one just saved), and a set opened from the history with a later one. The previous set is
// the last of the same lift strictly before this one, never this one.
const d = h => new Date(Date.UTC(2026, 8, 30, h)).getTime();
const w = (id, h, extra = {}) => ({ id, exercise: 'bicep_curl', reps: 8, createdAt: d(h), repDetails: [{}], repDetailsVersion: 2, ...extra });
const all = [w('now', 12), w('later', 14), w('before', 10), w('older', 8), w('squat', 11, { exercise: 'squat' })];

describe('the set a report compares with', () => {
  it('skips the set itself, just saved', () => {
    expect(previousSet(all, 'bicep_curl', { id: 'now', at: d(12) }).id).toBe('before');
  });
  it('never takes a later set, for a set opened from the history', () => {
    expect(previousSet(all, 'bicep_curl', { id: 'before', at: d(10) }).id).toBe('older');
  });
  it('has none before the first set of a lift', () => {
    expect(previousSet(all, 'bicep_curl', { id: 'older', at: d(8) })).toBeNull();
  });
});

// Audit of 6 October, action 9: a set of the left arm is not compared with a set of the right arm.
describe('the previous set follows the same arm or side', () => {
  const sides = [w('right', 12, { arm: 'right' }), w('left', 11, { arm: 'left' }), w('right-before', 9, { arm: 'right' })];
  it('a right-arm set is compared with the last right-arm set, not the left-arm set in between', () => {
    expect(previousSet(sides, 'bicep_curl', { id: 'right', at: d(12), arm: 'right' }).id).toBe('right-before');
  });
  it('a left-arm set with no left-arm set before it has none to compare with', () => {
    expect(previousSet(sides, 'bicep_curl', { id: 'left', at: d(11), arm: 'left' })).toBeNull();
  });
  it('a set of both sides (filmed from the front) is compared with another of both sides only', () => {
    const front = [w('both-now', 12, { arm: 'both' }), w('right', 11, { arm: 'right' }), w('both-before', 10, { arm: 'both' })];
    expect(previousSet(front, 'bicep_curl', { id: 'both-now', at: d(12), arm: 'both' }).id).toBe('both-before');
  });
});
