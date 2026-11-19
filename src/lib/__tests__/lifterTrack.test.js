/**
 * The lifter chosen over the whole set by motion (lifterTrack.js, card B, 19 November 2026). Synthetic skeletons only:
 * these tests fix the module's behaviour; they prove nothing about real gym video (TRIED.md, 19 November 2026).
 */
import { describe, expect, it } from 'vitest';
import { chooseLifter, framesFromPoseFile, groupPeople, linkTracklets, periodicity, torso } from '../lifterTrack';
import { summarizeCount } from '../coreAnalysis';

const FPS = 15;
const LIFT = 'bicep_curl';

// A body seen from the side whose elbows bend to `deg` degrees (180 straight), torso centred at (cx, cy) in the picture.
// World points in metres (y down), picture points normalised; both carry the same shape.
function body(deg, cx, cy) {
  const pts = Array.from({ length: 33 }, () => ({ x: 0, y: -0.2, z: 0 }));
  const a = (180 - deg) * Math.PI / 180;
  for (const [sh, el, wr, hip, knee, ankle, dz] of [[11, 13, 15, 23, 25, 27, -0.15], [12, 14, 16, 24, 26, 28, 0.15]]) {
    pts[sh] = { x: 0, y: -0.25, z: dz };
    pts[el] = { x: 0, y: 0.03, z: dz };
    pts[wr] = { x: 0.26 * Math.sin(a), y: 0.03 + 0.26 * Math.cos(a), z: dz };
    pts[hip] = { x: 0, y: 0.25, z: dz };
    pts[knee] = { x: 0.05, y: 0.7, z: dz };
    pts[ankle] = { x: 0, y: 1.1, z: dz };
  }
  const world = pts.map(p => ({ ...p, visibility: 0.95 }));
  const image = pts.map(p => ({ x: cx + p.x * 0.2, y: cy + p.y * 0.2, z: 0, visibility: 0.95 }));
  return { image, world };
}

// One rep every 2.8 s at the default pace: 0.8 s at rest (165 degrees), 1 s up to 45 degrees, 1 s back. The counter
// needs the rest between reps (a rep without a return to rest is merged with the next: STATE.md, card 003).
const curl = (t, period = 2.8) => {
  const u = (t % period) / period * 2.8, rest = 165, work = 45;
  if (u < 0.8) return rest;
  const k = u < 1.8 ? u - 0.8 : 2.8 - u;
  return rest - (rest - work) * (0.5 - 0.5 * Math.cos(Math.PI * k));
};
const times = seconds => Array.from({ length: Math.round(seconds * FPS) }, (_, i) => i / FPS);
const firstPose = frames => ({ world: frames.map(f => f.poses[0]?.world ?? null), image: frames.map(f => f.poses[0]?.image ?? null) });
const count = (world, ts, image) => summarizeCount(world, ts, LIFT, undefined, image);

describe('lifterTrack.js', () => {
  it('the torso centre is the mean of shoulders and hips, its length shoulder to hip midpoints', () => {
    const c = torso(body(165, 0.5, 0.5).image);
    expect(c.x).toBeCloseTo(0.5);
    expect(c.y).toBeCloseTo(0.5);
    expect(c.length).toBeCloseTo(0.1);
    expect(torso([])).toBeNull();
  });

  it('periodicity is near 1 for a steady rhythm and near 0 for noise', () => {
    const ts = times(20);
    expect(periodicity(ts.map(t => curl(t)), ts)).toBeGreaterThan(0.9);
    let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    expect(periodicity(ts.map(() => rnd() * 100), ts)).toBeLessThan(0.3);
  });

  it('keeps the curling lifter when a still bystander swaps places with him in the model\'s answer', () => {
    const ts = times(8 * 2.8 + 0.8); // 8 reps
    const frames = ts.map(t => {
      const lifter = body(curl(t), 0.55, 0.5), bystander = body(170, 0.15, 0.55);
      // The model lists the bystander first for one second in four (a run, as a real model's order changes).
      return { t, poses: Math.floor(t) % 4 === 1 ? [bystander, lifter] : [lifter, bystander] };
    });
    const r = chooseLifter(frames, LIFT);
    expect(r.people).toHaveLength(2);
    expect(r.world.every((w, i) => w === frames[i].poses.find(p => p.world === w)?.world)).toBe(true);
    expect(r.image.every(im => torso(im).x > 0.5)).toBe(true);
    expect(count(r.world, ts, r.image).count).toBe(8);
    const first = firstPose(frames);
    expect(count(first.world, ts, first.image).count).not.toBe(8);
  });

  it('drops the samples where the only pose found is another person doing reps elsewhere (the seated row of 19 November)', () => {
    const ts = times(10 * 2.8 + 0.8); // 10 reps; from 12.1 to 14.5 s the model returns a man at the left instead
    const frames = ts.map(t => {
      const s = t;
      const away = s > 12.1 && s < 14.5;
      return { t, poses: [away ? body(curl(s, 1.4), 0.15, 0.4) : body(curl(s), 0.55, 0.5)] };
    });
    const r = chooseLifter(frames, LIFT);
    expect(r.people.length).toBeGreaterThanOrEqual(2);
    r.image.forEach((im, i) => {
      const s = ts[i];
      if (s > 12.1 && s < 14.5) expect(im).toBeNull(); else expect(torso(im).x).toBeCloseTo(0.55);
    });
  });

  it('a lifter whose skeleton jumps away for a few samples keeps those samples: a fragment is not another person', () => {
    const ts = times(10);
    const frames = ts.map((t, i) => ({ t, poses: [body(curl(t), i >= 40 && i < 43 ? 0.9 : 0.5, 0.5)] }));
    const { tracklets, unit } = linkTracklets(frames);
    // The jump starts a tracklet of its own; the lifter's tracklet, idle under LINK_GAP_SEC, takes the pose back.
    expect(tracklets).toHaveLength(2);
    const people = groupPeople(tracklets, unit);
    expect(people).toHaveLength(2);
    const r = chooseLifter(frames, LIFT);
    expect(r.fromFragments).toBe(3);
    r.world.forEach((w, i) => expect(w).toBe(frames[i].poses[0].world));
  });

  it('a set with one person found on every sample comes back unchanged', () => {
    const ts = times(10);
    const frames = ts.map(t => ({ t, poses: [body(curl(t), 0.5, 0.5)] }));
    const r = chooseLifter(frames, LIFT);
    expect(r.people).toHaveLength(1);
    r.world.forEach((w, i) => expect(w).toBe(frames[i].poses[0].world));
  });

  it('no pose anywhere gives null on every sample', () => {
    const r = chooseLifter(times(2).map(t => ({ t, poses: [] })), LIFT);
    expect(r.chosen).toBe(-1);
    expect(r.world.every(w => w === null)).toBe(true);
  });

  it('reads a ?poses=1 file: world points take the picture points\' visibility', () => {
    const fr = framesFromPoseFile({ frames: [{ t: 0, poses: [{ image: [[0.1, 0.2, 0.7]], world: [[1, 2, 3]] }] }] });
    expect(fr[0].poses[0].image[0]).toEqual({ x: 0.1, y: 0.2, z: 0, visibility: 0.7 });
    expect(fr[0].poses[0].world[0]).toEqual({ x: 1, y: 2, z: 3, visibility: 0.7 });
  });
});
