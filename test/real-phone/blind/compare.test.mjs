// The blind scoreboard's comparator (compare.mjs; Phase 6 of David's order of 6 November 2026): set by set against
// the label and the base branch's baseline.
import { describe, expect, it } from 'vitest';
import { compareBlind, gateFailures, verdict } from './compare.mjs';

const decides = lift => lift !== 'bench_press' && lift !== 'overhead_press';
const run = (rows, before) => {
  const sets = rows.map(([name, lift, label]) => ({ name, lift, label }));
  const now = Object.fromEntries(rows.map(([name, , , c]) => [name, c]));
  return compareBlind(sets, before, now, decides);
};

describe('the blind comparator', () => {
  it('names each outcome as the scoreboard does', () => {
    expect(verdict('refused', 5)).toBe('refused');
    expect(verdict(5, 5)).toBe('exact');
    expect(verdict(8, 5)).toBe('catastrophic');
    expect(verdict(2, 5)).toBe('catastrophic');
    expect(verdict(6, 5)).toBe('off +1');
    expect(verdict(3, 5)).toBe('off -2');
  });

  it('passes a set that holds, comes closer, keeps its error on the other side, or counts where it refused', () => {
    const r = run([
      ['a', 'squat', 8, 8],
      ['b', 'squat', 10, 9],
      ['c', 'lateral_raise', 6, 5],
      ['d', 'bicep_curl', 7, 'refused'],
      ['e', 'bicep_curl', 7, 8],
    ], { a: 8, b: 8, c: 7, d: 'refused', e: 'refused' });
    expect(gateFailures(r)).toEqual([]);
    expect([r.decide, r.exact, r.catastrophic, r.refused, r.refusalRate]).toEqual([5, 1, 0, 1, 0.2]);
  });

  it('fails one set that moves away from its label even when another comes to it, which the exact total alone lets through', () => {
    const r = run([['a', 'squat', 8, 9], ['b', 'squat', 10, 10]], { a: 8, b: 9 });
    expect(r.exact).toBe(1);
    expect(gateFailures(r)).toEqual(['REGRESSED a']);
  });

  it('fails a set that gave a count and is now refused', () => {
    const r = run([['a', 'squat', 8, 'refused']], { a: 8 });
    expect(gateFailures(r)).toEqual(['REGRESSED a']);
    expect(r.rows[0].newlyCatastrophic).toBe(false);
  });

  it('fails a set that becomes off by 3 or more, even from refused; one already off by 3 or more fails only as its error grows', () => {
    const r = run([
      ['a', 'squat', 8, 11],
      ['b', 'squat', 8, 4],
      ['c', 'squat', 8, 4],
      ['d', 'squat', 8, 2],
    ], { a: 7, b: 'refused', c: 3, d: 3 });
    expect(gateFailures(r)).toEqual(['REGRESSED a', 'REGRESSED d', 'NEWLY CATASTROPHIC a', 'NEWLY CATASTROPHIC b']);
    expect(r.catastrophic).toBe(4);
  });

  it('shows a set added since the baseline without gating it, and fails a set of the baseline no longer on disk', () => {
    const r = run([['x', 'squat', 5, 9]], { gone: 4 });
    expect(r.added).toEqual(['x']);
    expect(r.catastrophic).toBe(1);
    expect(gateFailures(r)).toEqual(['MISSING gone (in the baseline, not on disk)']);
  });

  it('measures press sets and lets them decide nothing', () => {
    const r = run([['p', 'bench_press', 7, 'refused'], ['q', 'overhead_press', 10, 2]], { p: 7, q: 10 });
    expect(gateFailures(r)).toEqual([]);
    expect([r.n, r.decide, r.refused, r.refusalRate]).toEqual([2, 0, 0, null]);
    expect(r.rows.map(x => x.verdict)).toEqual(['refused', 'catastrophic']);
  });

  it('will not score a set it has no outcome for', () => {
    let message = '';
    try { compareBlind([{ name: 'q', lift: 'squat', label: 3 }], {}, {}, decides); } catch (e) { message = e.message; }
    expect(message).toContain('no outcome for q');
  });
});
