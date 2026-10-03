/**
 * The edges of the video (accuracy work, 30 September 2026): what the core counts where the video starts
 * or ends inside a movement, pinned so that no future change moves it unmeasured. Status: convention.
 * - Every rep needs its whole path on video: leaving the rest, the working end, the return to rest.
 * - At the end, a last rep cut before 70 % of its return (CUT_RETURN_SHARE) is not counted: it cannot be told from what
 *   people do after a set (crossing the arms, reaching for the phone, sitting up, standing straight). One cut
 *   later on its way back counts, marked clipped (window-edges.test.ts, 3 October).
 * - At the start, a first press shorter than the shortest rep is not counted: it cannot be told from
 *   standing up before the set. David's leg press of 29 September began with such a press (the app
 *   counted 12 of his 13). Since 3 October such a first return counts when it lasts at least half the
 *   set's own returns (HEAD_RETURN_SHARE, head-return.test.ts; the leg press now reads 13); the quick
 *   returns pinned here (0.35 s against 1 s) stay uncounted.
 * Two rules that counted these reps were tried and withdrawn: six reviews showed each counting an
 * after-set or before-set movement as a rep. The filming screen asks for the whole set, from rest back
 * to rest, which is where these reps are won.
 */
import { describe, it, expect } from 'vitest';
import { countReps, type Lift } from '../core';
import { jointFrame, sample, timestamps, type Joint, type Segment } from './synthetic';

const frames = (joint: Joint, angles: number[]) => angles.map(a => jointFrame(joint, { left: a }));
const reps = (rest: number, work: number, n: number): Segment[] => {
  const p: Segment[] = [{ hold: rest, sec: 0.8 }];
  for (let r = 0; r < n; r++) p.push({ to: work, sec: 1 }, { to: rest, sec: 1 }, { hold: rest, sec: 0.8 });
  return p;
};
const run = (lift: Lift, joint: Joint, path: Segment[], start: number, sps: number) => {
  const a = sample(path, start, sps);
  return countReps(frames(joint, a), timestamps(a.length, sps), lift);
};

const CONCENTRIC_FIRST: { lift: Lift; joint: Joint; rest: number; work: number }[] = [
  { lift: 'bicep_curl', joint: 'elbow', rest: 170, work: 50 },
  { lift: 'lateral_raise', joint: 'shoulder', rest: 15, work: 100 },
  { lift: 'leg_curl', joint: 'knee', rest: 170, work: 70 },
];
const ECCENTRIC_FIRST: { lift: Lift; joint: Joint; rest: number; work: number }[] = [
  { lift: 'squat', joint: 'knee', rest: 175, work: 80 },
  { lift: 'leg_press', joint: 'knee', rest: 170, work: 80 },
  { lift: 'bench_press', joint: 'elbow', rest: 170, work: 80 },
];

describe('reps cut by the edges of the video', () => {
  for (const sps of [15, 30]) {
    for (const { lift, joint, rest, work } of CONCENTRIC_FIRST) {
      it(`${lift} at ${sps} sps: a last rep cut half way back is not guessed at`, () => {
        const mid = (rest + work) / 2;
        const r = run(lift, joint, [...reps(rest, work, 5), { to: work, sec: 1 }, { hold: work, sec: 0.2 }, { to: mid, sec: 0.5 }], rest, sps);
        expect(r.count).toBe(5);
      });
      it(`${lift} at ${sps} sps: a last rep cut before it reaches its working end does not count`, () => {
        const mid = (rest + work) / 2;
        const r = run(lift, joint, [...reps(rest, work, 5), { to: mid, sec: 0.5 }], rest, sps);
        expect(r.count).toBe(5);
      });
    }
    for (const { lift, joint, rest, work } of ECCENTRIC_FIRST) {
      it(`${lift} at ${sps} sps: a last rep cut at the bottom has not done its lift, and does not count`, () => {
        const r = run(lift, joint, [...reps(rest, work, 5), { to: work, sec: 1 }, { hold: work, sec: 0.3 }], rest, sps);
        expect(r.count).toBe(5);
      });
      it(`${lift} at ${sps} sps: a first press under the shortest rep, at the start, is not counted`, () => {
        const r = run(lift, joint, [{ hold: work, sec: 0.1 }, { to: rest, sec: 0.35 }, ...reps(rest, work, 5)], work, sps);
        expect(r.count).toBe(5);
      });
    }
  }
  it('in the middle of a set, an excursion shorter than the shortest rep is still not a rep', () => {
    const rest = 170, work = 50, sps = 30;
    const r = run('bicep_curl', 'elbow', [...reps(rest, work, 3), { to: work, sec: 0.15 }, { to: rest, sec: 0.15 }, { hold: rest, sec: 0.8 }, ...reps(rest, work, 2)], rest, sps);
    expect(r.count).toBe(5);
  });
  // Review, 30 September. Where the working end is the body's upright posture (the hips, knees or elbows
  // straight), standing or letting the arms hang after the set is not a last rep: the end rule applies
  // only to lifts whose rest end is that posture.
  const POST_SET: { lift: Lift; joint: Joint; rest: number; work: number; after: number }[] = [
    { lift: 'triceps_pushdown', joint: 'elbow', rest: 70, work: 165, after: 172 },
    { lift: 'hip_thrust', joint: 'hip', rest: 100, work: 175, after: 178 },
    { lift: 'leg_extension', joint: 'knee', rest: 90, work: 170, after: 176 },
  ];
  for (const { lift, joint, rest, work, after } of POST_SET) {
    for (const sps of [15, 30]) {
      it(`${lift} at ${sps} sps: standing straight after the set, until the video stops, is not a rep`, () => {
        const r = run(lift, joint, [...reps(rest, work, 8), { to: after, sec: 1 }, { hold: after, sec: 3 }], rest, sps);
        expect(r.count).toBe(8);
      });
    }
  }
  // Review, 30 September: a lift that lifts first, filmed from its working end, shows only its return;
  // its lift was never on video, so it is not counted, at any sample rate.
  for (const sps of [15, 30]) {
    it(`bicep_curl at ${sps} sps: filmed from the top, only the return on video, is not counted`, () => {
      const r = run('bicep_curl', 'elbow', [{ hold: 50, sec: 0.1 }, { to: 170, sec: 0.35 }, ...reps(170, 50, 5)], 50, sps);
      expect(r.count).toBe(5);
    });
  }
  // Sixth review, 30 September: standing up quickly before the set is not a rep.
  for (const sps of [15, 30]) {
    it(`a stand-up from a crouch before a squat set, at ${sps} sps, is not a rep`, () => {
      const a = sample([{ hold: 85, sec: 0.1 }, { to: 175, sec: 0.3 }, { hold: 175, sec: 2 }, ...reps(175, 80, 5)], 85, sps);
      expect(countReps(frames('knee', a), timestamps(a.length, sps), 'squat').count).toBe(5);
    });
  }
  // Second review, 30 September: what people do after a set, until the video stops, is never a rep.
  const AFTER: [string, Lift, Joint, Segment[], number][] = [
    ['curl, then the arms crossed', 'bicep_curl', 'elbow', [...reps(170, 50, 8), { hold: 170, sec: 2 }, { to: 45, sec: 1 }, { hold: 45, sec: 3 }], 8],
    ['curl, then reaching for the phone', 'bicep_curl', 'elbow', [...reps(170, 50, 8), { hold: 170, sec: 1 }, { to: 70, sec: 1 }], 8],
    ['lateral raise, then the arm up to the phone', 'lateral_raise', 'shoulder', [...reps(15, 100, 8), { hold: 15, sec: 1 }, { to: 80, sec: 1 }], 8],
    ['lat pulldown, then the hands on the thighs', 'lat_pulldown', 'elbow', [...reps(170, 60, 10), { to: 85, sec: 1 }, { hold: 85, sec: 3 }], 10],
    ['leg curl, then sitting with the knees bent', 'leg_curl', 'knee', [...reps(170, 70, 10), { to: 90, sec: 1 }, { hold: 90, sec: 3 }], 10],
  ];
  for (const [what, lift, joint, path, n] of AFTER) {
    for (const sps of [15, 30]) {
      it(`${what}, at ${sps} sps, counts ${n}`, () => {
        expect(run(lift, joint, path, (path[0] as { hold: number }).hold, sps).count).toBe(n);
      });
    }
  }
  // Third review, 30 September: a quick movement at the very start, before the set, is not a rep. The
  // start exemption holds only where a rep is really cut: an eccentric-first lift filmed from its working
  // end, whose lift is on video.
  for (const sps of [15, 30]) {
    it(`a quick curl-like twitch at the start, at ${sps} sps, is not a rep`, () => {
      const a = sample([{ to: 55, sec: 0.15 }, { to: 170, sec: 0.25 }, ...reps(170, 50, 5)], 110, sps);
      expect(countReps(frames('elbow', a), timestamps(a.length, sps), 'bicep_curl').count).toBe(5);
    });
    it(`a quick dip from half-standing at the start of a squat, at ${sps} sps, is not a rep`, () => {
      const a = sample([{ to: 85, sec: 0.2 }, { to: 175, sec: 0.25 }, ...reps(175, 80, 5)], 140, sps);
      expect(countReps(frames('knee', a), timestamps(a.length, sps), 'squat').count).toBe(5);
    });
  }
  // Fourth review, 30 September: a curl video that starts with the elbow bent, lowered only part way,
  // then a full rep: that first real rep is counted (a withdrawn start rule had dropped it).
  for (const sps of [15, 30]) {
    it(`a curl started bent, part lowered, then a full rep, at ${sps} sps, counts that rep`, () => {
      const a = sample([{ hold: 50, sec: 0.3 }, { to: 140, sec: 0.8 }, { to: 50, sec: 1 }, { to: 170, sec: 1 }, ...reps(170, 50, 5)], 50, sps);
      expect(countReps(frames('elbow', a), timestamps(a.length, sps), 'bicep_curl').count).toBe(6);
    });
  }
  // Fifth review, 30 September: the start exemption is for the start of the video, not for the first
  // sample with a pose. Seconds with nobody in frame, then a quick push from the bottom: not a rep.
  for (const sps of [15, 30]) {
    it(`nobody in frame for 3 s, then a quick push from the bottom, at ${sps} sps, is not a rep`, () => {
      const a = sample([{ hold: 80, sec: 0.1 }, { to: 170, sec: 0.35 }, ...reps(170, 80, 5)], 80, sps);
      const fr = [...Array(3 * sps).fill(null), ...frames('knee', a)];
      expect(countReps(fr, timestamps(fr.length, sps), 'leg_press').count).toBe(5);
    });
  }
});
