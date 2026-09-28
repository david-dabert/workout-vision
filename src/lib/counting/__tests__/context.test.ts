/**
 * A phone clip holds more than the set (28 September 2026). The filming screen asks for "one set,
 * then stop recording", so the clip also holds walking in, picking the weights up and putting them
 * down. MM-Fit's own 3D poses, replayed with the seconds around each labelled set, showed the
 * counter losing reps to it (test/real-phone/mmfit-context/).
 * - The first test is fixed in this step and fails on c3681b8.
 * - The three it.fails tests are the overhead press's known failures: the elbow angle alone cannot
 *   tell a lockout from arms hanging. They wait for the overhead press step, which must make them
 *   pass without breaking the guards below.
 * - The guards pass on c3681b8. The two press guards come from the review of 28 September: a rule
 *   that reads the arm's posture broke them.
 */
import { describe, it, expect } from 'vitest';
import { countReps, type WorldLandmark, type WorldLandmarkFrame } from '../core';
import { jointFrame, pressFrame, sample, timestamps, type Segment } from './synthetic';

const SPS = 15;
/** The left arm hanging: the upper arm down, the forearm swinging from level (90°) to down (180°). */
const hangFrame = (elbow: number): WorldLandmarkFrame => jointFrame('elbow', { left: elbow });

function build(parts: { path: Segment[]; start: number; frame: (a: number) => WorldLandmarkFrame }[]) {
  const frames: WorldLandmarkFrame[] = [];
  for (const p of parts) for (const a of sample(p.path, p.start, SPS)) frames.push(p.frame(a));
  return { frames, ts: timestamps(frames.length, SPS) };
}

/** Ten presses from the shoulders (90°) to lockout (`lockout`), each held 0.5 s at the top. */
function presses(lockout: number, n = 10): Segment[] {
  const path: Segment[] = [];
  for (let r = 0; r < n; r++) path.push({ to: lockout, sec: 1 }, { hold: lockout, sec: 0.5 }, ...(r < n - 1 ? [{ to: 90, sec: 1 } as Segment, { hold: 90, sec: 0.3 } as Segment] : []));
  return path;
}

/**
 * A left arm pressing from a deep bottom: at 90° the upper arm points 45° below level and the
 * forearm 45° above it, so the wrist is level with the shoulder; the upper arm rises to upright as
 * the elbow straightens, the forearm always pointing up.
 */
function deepPressFrame(angle: number): WorldLandmarkFrame {
  const theta = Math.min(180, Math.max(90, angle));
  const rad = (d: number) => (d * Math.PI) / 180;
  const phi = -45 + (theta - 90) * 1.5; // the upper arm's rise above level, in degrees
  const fore = phi + 180 - theta; // the forearm's direction above level, in degrees
  const s = { x: -0.2, y: -0.3, z: 0 };
  const e = { x: s.x - 0.3 * Math.cos(rad(phi)), y: s.y - 0.3 * Math.sin(rad(phi)), z: 0 };
  const w = { x: e.x - 0.3 * Math.cos(rad(fore)), y: e.y - 0.3 * Math.sin(rad(fore)), z: 0 };
  const frame: WorldLandmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.1 }));
  frame[11] = { ...s, visibility: 0.99 };
  frame[13] = { ...e, visibility: 0.99 };
  frame[15] = { ...w, visibility: 0.99 };
  return frame;
}

describe('A phone clip holds more than the set', () => {
  it('a small move long before the first rep does not cost the first rep', () => {
    // Standing at rest, a 30° bend of the elbow 9 s before the set (settling the dumbbell), then ten curls.
    const path: Segment[] = [{ hold: 165, sec: 1 }, { to: 135, sec: 0.5 }, { to: 165, sec: 0.5 }, { hold: 165, sec: 9 }];
    for (let r = 0; r < 10; r++) path.push({ to: 60, sec: 1 }, { to: 165, sec: 1 }, { hold: 165, sec: 0.8 });
    const { frames, ts } = build([{ path, start: 165, frame: hangFrame }]);
    expect(countReps(frames, ts, 'bicep_curl').count).toBe(10);
  });

  it.fails('arms hanging before and after an overhead press do not move its thresholds', () => {
    // 8 s with the arms hanging straight, the weights brought to the shoulders, ten presses to a
    // 150° lockout, the weights lowered to the shoulders and the arms hanging again for 8 s.
    const { frames, ts } = build([
      { path: [{ hold: 172, sec: 8 }, { to: 90, sec: 1.2 }], start: 172, frame: hangFrame },
      { path: [{ hold: 90, sec: 0.5 }, ...presses(150), { to: 90, sec: 1 }], start: 90, frame: pressFrame },
      { path: [{ to: 172, sec: 1.2 }, { hold: 172, sec: 8 }], start: 90, frame: hangFrame },
    ]);
    expect(countReps(frames, ts, 'overhead_press').count).toBe(10);
  });

  it.fails('lowering the weights to the sides after an overhead press is not a rep', () => {
    // A short hold each side, so the thresholds stand where the set puts them; the only question
    // is whether the lowering to the sides, which straightens the elbow, counts.
    const { frames, ts } = build([
      { path: [{ hold: 172, sec: 1 }, { to: 90, sec: 1.2 }], start: 172, frame: hangFrame },
      { path: [{ hold: 90, sec: 0.5 }, ...presses(160), { to: 90, sec: 1 }], start: 90, frame: pressFrame },
      { path: [{ to: 172, sec: 1.2 }, { hold: 172, sec: 1 }], start: 90, frame: hangFrame },
    ]);
    expect(countReps(frames, ts, 'overhead_press').count).toBe(10);
  });

  it.fails('arms hanging after an overhead press, then another move before the clip ends, do not move its thresholds', () => {
    // The reviewer's finding on the first version (28 September): after the set the arms hang for
    // 8 s, then the lifter moves again, bringing a weight halfway up, before the clip stops.
    const { frames, ts } = build([
      { path: [{ hold: 172, sec: 1 }, { to: 90, sec: 1.2 }], start: 172, frame: hangFrame },
      { path: [{ hold: 90, sec: 0.5 }, ...presses(150), { to: 90, sec: 1 }], start: 90, frame: pressFrame },
      { path: [{ to: 172, sec: 1.2 }, { hold: 172, sec: 8 }, { to: 110, sec: 1 }, { to: 172, sec: 1 }, { hold: 172, sec: 1 }], start: 90, frame: hangFrame },
    ]);
    expect(countReps(frames, ts, 'overhead_press').count).toBe(10);
  });

  // Guards: they pass on c3681b8 and must keep passing.
  it('a press whose wrist sits level with the shoulder at the bottom counts every rep', () => {
    const lockouts = [150, 154, 148, 156, 151, 149, 155, 150, 153, 148];
    const path: Segment[] = [{ hold: 90, sec: 0.5 }];
    lockouts.forEach((top, r) => {
      path.push({ to: top, sec: 1 }, { hold: top, sec: 0.5 });
      if (r < lockouts.length - 1) path.push({ to: 90, sec: 1 }, { hold: 90, sec: 0.3 });
    });
    const { frames, ts } = build([{ path, start: 90, frame: deepPressFrame }]);
    expect(countReps(frames, ts, 'overhead_press').count).toBe(10);
  });

  it('one glitched wrist sample, anywhere around a lockout, does not drop the press', () => {
    const path: Segment[] = [{ hold: 90, sec: 0.5 }, ...presses(155)];
    const { frames, ts } = build([{ path, start: 90, frame: pressFrame }]);
    // The fifth press: from its start to the end of its hold at the top.
    const from = Math.round((0.5 + 4 * 2.8) * SPS), to = Math.round((0.5 + 4 * 2.8 + 1.5) * SPS);
    const miscounts: number[] = [];
    for (let k = from; k <= to; k++) {
      const glitched = frames.map((f, i) => {
        if (i !== k || !f) return f;
        const g = f.map(p => ({ ...p }));
        g[15] = { ...g[15], x: g[11].x, y: g[11].y + 0.3 }; // the wrist seen hanging below the shoulder
        return g;
      });
      const count = countReps(glitched, ts, 'overhead_press').count;
      if (count !== 10) miscounts.push(k);
    }
    expect(miscounts).toEqual([]);
  });

  it('holding the weight with the elbow bent between sets does not move a curl’s thresholds', () => {
    // 8 s holding the dumbbell at the hip with the elbow at 100° before and after ten curls.
    const path: Segment[] = [{ hold: 100, sec: 8 }, { to: 165, sec: 1 }, { hold: 165, sec: 0.8 }];
    for (let r = 0; r < 10; r++) path.push({ to: 70, sec: 1 }, { to: 165, sec: 1 }, { hold: 165, sec: 0.8 });
    path.push({ to: 100, sec: 1 }, { hold: 100, sec: 8 });
    const { frames, ts } = build([{ path, start: 100, frame: hangFrame }]);
    expect(countReps(frames, ts, 'bicep_curl').count).toBe(10);
  });

  it('a 30° wobble at the bottom of each press is not a second rep', () => {
    // Ten presses from the shoulders; on the way down, each comes back up 30° before the bottom.
    const path: Segment[] = [{ hold: 90, sec: 0.5 }];
    for (let r = 0; r < 10; r++) {
      path.push({ to: 155, sec: 1 }, { hold: 155, sec: 0.5 });
      if (r < 9) path.push({ to: 95, sec: 0.8 }, { to: 125, sec: 0.3 }, { to: 90, sec: 0.3 });
    }
    const { frames, ts } = build([{ path, start: 90, frame: pressFrame }]);
    expect(countReps(frames, ts, 'overhead_press').count).toBe(10);
  });

  it('reps that grow shallower at the end of a set still count', () => {
    const path: Segment[] = [{ hold: 165, sec: 0.8 }];
    for (let r = 0; r < 10; r++) path.push({ to: r < 7 ? 60 : 85, sec: 1 }, { to: 165, sec: 1 }, { hold: 165, sec: 0.8 });
    const { frames, ts } = build([{ path, start: 165, frame: hangFrame }]);
    expect(countReps(frames, ts, 'bicep_curl').count).toBe(10);
  });
});
