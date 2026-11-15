/**
 * A rise left open at the end of the video, which reached the working threshold and which the count left out
 * (coreAnalysis.js summarizeCount `tailOpen`, 15 November 2026): the count stays as it is, and the set is marked so the
 * result screen asks instead of showing it as sure (R8, R16). On the public build sets the app showed as sure, a set so
 * marked was exact 13 times in 86, against 368 in 522 for the others (TRIED.md, 15 November 2026).
 */
import { describe, expect, it } from 'vitest';
import { summarizeCount } from '../../coreAnalysis';
import { cycles, jointFrame, sample, timestamps } from './synthetic';

const SPS = 15, REST = 170, WORK = 70;
const read = (angles: number[]) => summarizeCount(angles.map(a => jointFrame('elbow', { left: a })), timestamps(angles.length, SPS), 'dumbbell_row') as any;

describe('a rise left open at the end of the video', () => {
  it('six rows, then a pull held at the working end until the video stops: six, marked', () => {
    // Held 2 s, beyond TAIL_HOLD_MAX_SEC (core.ts), so the tail rule does not count it.
    const angles = sample([...cycles({ rest: REST, work: WORK, reps: 6 }), { to: WORK, sec: 1 }, { hold: WORK, sec: 2 }], REST, SPS);
    const r = read(angles);
    expect(r.count).toBe(6);
    expect(r.tailOpen).toBe(true);
  });

  it('six rows ending at rest: six, not marked', () => {
    const r = read(sample(cycles({ rest: REST, work: WORK, reps: 6 }), REST, SPS));
    expect(r.count).toBe(6);
    expect(r.tailOpen).toBeUndefined();
  });

  it('six rows, then a slow full row and 4 s at rest: six, not marked (reviewer, 15 November 2026)', () => {
    const r = read(sample([...cycles({ rest: REST, work: WORK, reps: 6 }), { hold: REST, sec: 1 }, { to: WORK, sec: 8 }, { to: REST, sec: 8 }, { hold: REST, sec: 4 }], REST, SPS));
    expect(r.count).toBe(6);
    expect(r.tailOpen).toBeUndefined();
  });

  it('lateral lunges in turn, six left and five right, the sixth right held down at the end: eleven, marked (reviewer)', () => {
    // Each side's own reps and thresholds are read: the side cut mid-rep has one rep fewer, so it is never the primary.
    const L: number[] = [], R: number[] = [];
    const push = (side: 'L' | 'R', path: { to?: number; hold?: number; sec: number }[]) => {
      const a = sample(path as any, 175, SPS);
      for (const x of a) { (side === 'L' ? L : R).push(x); (side === 'L' ? R : L).push(175); }
    };
    push('L', [{ hold: 175, sec: 0.8 }]);
    for (let k = 0; k < 11; k++) push(k % 2 ? 'R' : 'L', [{ to: 90, sec: 1 }, { to: 175, sec: 1 }, { hold: 175, sec: 0.8 }]);
    push('R', [{ to: 90, sec: 1 }, { hold: 90, sec: 2.5 }]);
    const r = summarizeCount(L.map((a, i) => jointFrame('knee', { left: a, right: R[i] })), timestamps(L.length, SPS), 'lateral_lunge') as any;
    expect(r.count).toBe(11);
    expect(r.tailOpen).toBe(true);
  });

  it('six rows, then a rise that stops halfway: six, not marked', () => {
    const angles = sample([...cycles({ rest: REST, work: WORK, reps: 6 }), { to: (REST + WORK) / 2, sec: 0.6 }, { hold: (REST + WORK) / 2, sec: 1 }], REST, SPS);
    const r = read(angles);
    expect(r.count).toBe(6);
    expect(r.tailOpen).toBeUndefined();
  });
});
