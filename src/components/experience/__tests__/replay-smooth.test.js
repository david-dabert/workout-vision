import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { steadyFrames, trailAt } from '../replay-smooth';

const T = i => i / 15;
const track = (xs, vis = 1) => ({ frames: xs.map(x => [{ x, y: 0.5, visibility: vis }]), times: xs.map((_, i) => T(i)) });

describe('the skeleton steadied for the eye', () => {
  it('undoes a leap of one sample', () => {
    const { frames, times } = track([0.4, 0.4, 0.4, 0.9, 0.4, 0.4, 0.4]);
    const out = steadyFrames(frames, times);
    expect(out[3][0].x).toBeCloseTo(0.4, 6);
  });
  it('keeps a steady movement where it is: centred, it does not lag', () => {
    const xs = Array.from({ length: 20 }, (_, i) => 0.2 + 0.01 * i);
    const { frames, times } = track(xs);
    const out = steadyFrames(frames, times);
    for (let i = 2; i < 18; i++) expect(out[i][0].x).toBeCloseTo(xs[i], 9);
  });
  it('calms a trembling point', () => {
    const xs = Array.from({ length: 40 }, (_, i) => 0.5 + (i % 2 ? 0.01 : -0.01));
    const out = steadyFrames(track(xs).frames, track(xs).times);
    for (let i = 3; i < 37; i++) expect(Math.abs(out[i][0].x - 0.5)).toBeLessThan(0.002);
  });
  it('weighs an unsure sample least', () => {
    const frames = [0.5, 0.5, 0.8, 0.5, 0.5].map((x, i) => [{ x: i === 2 ? x : x, y: 0.5, visibility: i === 2 ? 0.05 : 1 }]);
    const times = frames.map((_, i) => T(i));
    // The leap is two samples wide here, so the median keeps it; the weights pull it back all the same.
    frames[3][0].x = 0.8; frames[3][0].visibility = 0.05;
    const out = steadyFrames(frames, times);
    expect(out[2][0].x).toBeLessThan(0.56);
  });
  it('averages the sureness, so a point fades rather than blinks', () => {
    const vis = [1, 1, 1, 0.2, 1, 1, 1];
    const frames = vis.map(v => [{ x: 0.5, y: 0.5, visibility: v }]);
    const out = steadyFrames(frames, vis.map((_, i) => T(i)));
    expect(out[3][0].visibility).toBeGreaterThan(0.5);
    expect(out[3][0].visibility).toBeLessThan(1);
  });
  it('never averages across a gap in the samples, nor over a sample with no body', () => {
    const frames = [[{ x: 0.1, y: 0.5, visibility: 1 }], [{ x: 0.1, y: 0.5, visibility: 1 }], [{ x: 0.1, y: 0.5, visibility: 1 }],
      [{ x: 0.9, y: 0.5, visibility: 1 }], [{ x: 0.9, y: 0.5, visibility: 1 }], [{ x: 0.9, y: 0.5, visibility: 1 }], null];
    const times = [0, 1, 2, 3, 4, 5, 6].map(i => (i < 3 ? T(i) : 2 + T(i)));
    const out = steadyFrames(frames, times);
    expect(out[2][0].x).toBe(0.1);
    expect(out[3][0].x).toBe(0.9);
    expect(out[6]).toBeNull();
  });
  it('leaves the frames it is given untouched', () => {
    const { frames, times } = track([0.4, 0.4, 0.9, 0.4, 0.4]);
    steadyFrames(frames, times);
    expect(frames[2][0].x).toBe(0.9);
  });
});

describe('the trail of the lit limb', () => {
  it('runs from the oldest sample in its span to the point drawn now', () => {
    const { frames, times } = track(Array.from({ length: 30 }, (_, i) => i / 30));
    const now = { x: 0.7, y: 0.5, visibility: 1 };
    const tr = trailAt(frames, times, T(20) + 0.01, 0, now, { span: 0.6 });
    expect(tr.at(-1)).toEqual({ x: 0.7, y: 0.5, age: 0 });
    expect(tr.length).toBe(9 + 1); // samples 12 to 20 lie within 0.6 s of t, then the point drawn now
    expect(tr[0].age).toBeLessThanOrEqual(1);
    for (let j = 1; j < tr.length; j++) expect(tr[j].age).toBeLessThanOrEqual(tr[j - 1].age);
  });
  it('stops where the model was unsure', () => {
    const { frames, times } = track(Array.from({ length: 10 }, () => 0.5));
    frames[6][0].visibility = 0.1;
    expect(trailAt(frames, times, T(9), 0, null).length).toBe(3);
  });
});

// On David's bench press of 29 September, the drawn wrist moves less from sample to sample once steadied: the
// sample-to-sample change of its velocity (what the eye reads as shaking) is measured before and after.
describe('on a real set', () => {
  it('the wrist of David\'s bench press shakes less, and stays on the arm\'s path', () => {
    const d = JSON.parse(gunzipSync(readFileSync(resolve(__dirname, '../../../../test/real-phone/sets-29sep/bench_press_7_side_24cc4f0b.json.gz'))).toString());
    const raw = d.imageLandmarks, times = d.timestamps, out = steadyFrames(raw, times);
    const shake = fr => {
      let s = 0, n = 0;
      for (let i = 1; i < fr.length - 1; i++) {
        const a = fr[i - 1]?.[15], b = fr[i]?.[15], c = fr[i + 1]?.[15];
        if (!a || !b || !c) continue;
        s += Math.hypot(a.x - 2 * b.x + c.x, a.y - 2 * b.y + c.y); n++;
      }
      return s / n;
    };
    expect(shake(out)).toBeLessThan(0.6 * shake(raw));
    // The steadied wrist stays within a small distance of the model's on average (no drift).
    let off = 0, n = 0;
    raw.forEach((f, i) => { if (f?.[15] && out[i]?.[15]) { off += Math.hypot(f[15].x - out[i][15].x, f[15].y - out[i][15].y); n++; } });
    expect(off / n).toBeLessThan(0.02);
  });
});

describe('the trail, with the point drawn now unseen', () => {
  it('is not drawn', () => {
    const { frames, times } = track(Array.from({ length: 10 }, () => 0.5));
    expect(trailAt(frames, times, T(9), 0, { x: 0.5, y: 0.5, visibility: 0.2 })).toEqual([]);
  });
});
