import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  ALL_JOINTS,
  LEG_JOINTS,
  SAMPLE_HZ,
  align,
  buildReference,
  compareAttempt,
  compareCurves,
  dropJumps,
  fillGaps,
  jointAngles,
  mirrorLandmarks,
  rangeWeightedScore,
  referenceFromCurves,
  unwrapAround,
  weightedRangeShortfall,
} from '../compare.js';

// A staged raise like Olivier's video 4: shoulder 10 -> 90 -> hold -> 170 -> hold -> 10, elbow held straight.
function staged(speed = 1) {
  const keys = [[0, 10], [3, 90], [5, 90], [8, 170], [11, 170], [14, 10]];
  const n = Math.round((14 / speed) * SAMPLE_HZ) + 1;
  const shoulder = Array.from({ length: n }, (_, i) => {
    const t = (i / SAMPLE_HZ) * speed;
    const k = keys.findIndex(([kt]) => kt >= t);
    if (k <= 0) return keys[0][1];
    const [t0, v0] = keys[k - 1], [t1, v1] = keys[k];
    return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  });
  return { rightShoulder: shoulder, rightElbow: shoulder.map(() => 172) };
}

const pad = (c, before, after) => Object.fromEntries(Object.entries(c).map(([k, v]) =>
  [k, [...Array(before).fill(v[0]), ...v, ...Array(after).fill(v.at(-1))]]));

describe('reference comparison', () => {
  const ref = referenceFromCurves(staged());

  it('reads the moving and held joints of the reference', () => {
    expect(ref.joints.map(j => [j.name, j.kind])).toEqual([['rightShoulder', 'moving'], ['rightElbow', 'held']]);
  });

  it('matches the same movement, slower, with footage before and after', () => {
    const r = compareCurves(ref, pad(staged(0.7), 30, 40));
    expect(r.verdict).toBe('match');
    expect(r.start).toBeCloseTo(3, 0);
    expect(r.tempo).toBeGreaterThan(1.3);
  });

  it('asks to revise a raise that stops short, and names the joint', () => {
    const short = staged();
    short.rightShoulder = short.rightShoulder.map(v => Math.min(v, 130));
    const r = compareCurves(ref, short);
    expect(r.verdict).toBe('revise');
    expect(r.reasons).toContain('range:rightShoulder');
    expect(r.reasons.some(x => x.endsWith('Elbow'))).toBe(false);
    const worst = r.joints.find(j => j.name === 'rightShoulder').worst;
    expect(worst.reference - worst.attempt).toBeGreaterThan(30);
  });

  it('asks to revise a bent elbow the reference keeps straight', () => {
    const bent = staged();
    bent.rightElbow = bent.rightElbow.map(v => v - 35);
    const r = compareCurves(ref, bent);
    expect(r.verdict).toBe('revise');
    expect(r.reasons).toEqual(['off:rightElbow']);
  });

  it('names as the largest gap one held for about a second, not a single misread sample', () => {
    const odd = staged();
    // The elbow, held straight by the reference: one sample 70 degrees off (a wrist misread) at 1.5 s, and two seconds
    // 25 degrees bent from 8.5 s.
    odd.rightElbow = odd.rightElbow.map((v, i) => (i === 15 ? v - 70 : i >= 85 && i < 105 ? v - 25 : v));
    const el = compareCurves(ref, odd).joints.find(j => j.name === 'rightElbow');
    expect(el.worst.atSec).toBeGreaterThan(8);
    expect(el.worst.reference - el.worst.attempt).toBeGreaterThan(15);
  });

  it('gives no verdict when the attempt does not show a joint (R8)', () => {
    const hidden = staged();
    hidden.rightElbow = hidden.rightElbow.map((v, i) => (i % 5 < 3 ? null : v));
    expect(compareCurves(ref, hidden)).toMatchObject({ verdict: 'refused', reasons: ['unseen:rightElbow'] });
  });

  it('judges only the moments the attempt shows, and none of its filled line (R8, filmed on the floor)', () => {
    // Lost 0.8 s in every 2 s, as an arm lying on the other one is: what the attempt shows is the reference's movement.
    const lost = staged();
    for (const name of Object.keys(lost)) lost[name] = lost[name].map((v, i) => (i % 20 >= 12 ? null : v));
    const r = compareCurves(ref, lost);
    expect(r.verdict).toBe('match');
    const sh = r.joints.find(j => j.name === 'rightShoulder');
    expect(sh.within).toBeGreaterThan(0.95);
    expect(sh.shown).toBeLessThan(0.75);
    expect(sh.rangeShare).toBeGreaterThan(0.95);
  });

  it('still asks to revise a short raise filmed with the same losses', () => {
    const lost = staged();
    lost.rightShoulder = lost.rightShoulder.map(v => Math.min(v, 130));
    for (const name of Object.keys(lost)) lost[name] = lost[name].map((v, i) => (i % 20 >= 12 ? null : v));
    expect(compareCurves(ref, lost).reasons).toContain('range:rightShoulder');
  });

  it('never accepts an attempt lost after the first fifth of its movement', () => {
    // Seen on over half the samples, most of them still footage before the movement: refused or asked to revise,
    // never matched on the line filled across what it does not show.
    const lost = pad(staged(), 100, 0);
    const cut = 100 + Math.round(staged().rightShoulder.length * 0.2);
    for (const name of Object.keys(lost)) lost[name] = lost[name].map((v, i) => (i >= cut ? null : v));
    expect(compareCurves(ref, lost).verdict).not.toBe('match');
  });

  it('gives no verdict when the attempt shows the measure on under half of its samples', () => {
    const lost = staged();
    for (const name of Object.keys(lost)) lost[name] = lost[name].map((v, i) => (i % 20 >= 9 ? null : v));
    expect(compareCurves(ref, lost)).toMatchObject({ verdict: 'refused', reasons: ['unseen:rightShoulder', 'unseen:rightElbow'] });
  });

  it('does not judge a hold the attempt does not show', () => {
    const lost = staged();
    // Lost from the middle of the top hold (170 degrees, 8 to 11 s) to the end.
    for (const name of Object.keys(lost)) lost[name] = lost[name].map((v, i) => (i >= 95 ? null : v));
    const r = compareCurves(ref, lost);
    expect(r.holds.some(h => h.refAngle > 160)).toBe(false);
  });

  it('leaves out a reference joint seen on under 80 % of the video', () => {
    const c = staged();
    c.leftShoulder = c.rightShoulder.map((v, i) => (i % 3 ? v : null));
    expect(referenceFromCurves(c).unused.map(u => u.name)).toEqual(['leftShoulder']);
  });

  it('lists the positions the reference holds, with the attempt\'s angle and time at each', () => {
    const r = compareCurves(ref, staged(0.5));
    const held = r.holds.filter(h => h.refAngle > 50).map(h => [Math.round(h.refAngle), Math.round(h.attAngle)]);
    expect(held).toEqual([[90, 90], [170, 170]]);
    const top = r.holds.find(h => h.refAngle > 160);
    expect(top.attSec / top.refSec).toBeGreaterThan(1.6);
  });

  it('aligns a stretch of the attempt to the whole reference', () => {
    const path = align([[0, 10, 20, 10, 0]], [[5, 5, 0, 10, 20, 10, 0, 5]]);
    expect(path[0]).toEqual([0, 2]);
    expect(path.at(-1)).toEqual([4, 6]);
  });

  it('fills unseen samples between seen ones', () => {
    expect(fillGaps([null, 2, null, null, 8, null])).toEqual([2, 2, 4, 6, 8, 8]);
  });
});

// A person lying with the shoulders stacked (left above right), the left arm swinging from straight up to pointing
// right, as in Olivier's video 3 filmed from the head end. Image landmarks, picture 1 wide by 1 high.
function swing(seconds = 10, hz = 15, { tilt = 0, mirror = false, otherArmSeen = 0.99 } = {}) {
  const ts = [], lms = [];
  const rot = (x, y) => {
    const c = Math.cos(tilt), s = Math.sin(tilt), dx = x - 0.5, dy = y - 0.5;
    return [0.5 + dx * c - dy * s, 0.5 + dx * s + dy * c];
  };
  for (let i = 0; i <= seconds * hz; i++) {
    const t = i / hz, a = (Math.PI / 2) * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / seconds)); // 0 up, pi/2 right
    const pts = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
    const set = (k, x, y) => { const [u, v] = rot(x, y); pts[k] = { x: mirror ? 1 - u : u, y: v, visibility: 0.99 }; };
    set(11, 0.4, 0.45); set(12, 0.4, 0.6);
    set(13, 0.4 + 0.12 * Math.sin(a), 0.45 - 0.12 * Math.cos(a));
    set(15, 0.4 + 0.24 * Math.sin(a), 0.45 - 0.24 * Math.cos(a));
    set(14, 0.55, 0.62); set(16, 0.7, 0.64);
    pts[14].visibility = pts[16].visibility = otherArmSeen;
    if (mirror) { // the model names the mirrored person's arms the other way round
      for (const [l, r] of [[11, 12], [13, 14], [15, 16]]) [pts[l], pts[r]] = [pts[r], pts[l]];
    }
    ts.push(t); lms.push(pts);
  }
  return { ts, lms };
}

describe('segment directions', () => {
  const options = { joints: {}, directions: { leftArm: { from: 11, to: 15, apartFrom: 16 } }, aspect: 1 };
  const plain = swing();
  const ref = buildReference(plain.lms, plain.ts, options);

  it('reads where the arm points against the body line, through a 90 degree swing', () => {
    expect(ref.joints).toHaveLength(1);
    expect(ref.joints[0]).toMatchObject({ name: 'leftArm', kind: 'moving', direction: true });
    expect(ref.joints[0].range).toBeGreaterThan(80);
  });

  it('reads the same with the phone propped 12 degrees askew', () => {
    const tilted = swing(10, 15, { tilt: (12 * Math.PI) / 180 });
    const r = compareAttempt(ref, tilted.lms, tilted.ts, options);
    expect(r.verdict).toBe('match');
    expect(r.joints[0].gapP90).toBeLessThan(2);
  });

  it('reads a patient lying the other way round as in a mirror, and names the patient\'s side', () => {
    // The arm under the body is not seen: the plain reading gives no verdict, the mirrored one does.
    const m = swing(13, 15, { mirror: true, otherArmSeen: 0.1 });
    const r = compareAttempt(ref, m.lms, m.ts, options);
    expect(r).toMatchObject({ verdict: 'match', mirrored: true });
    expect(r.joints[0]).toMatchObject({ name: 'rightArm', measure: 'leftArm' });
  });

  it('reads only as in a mirror when the physiotherapist set the other side', () => {
    // Both arms seen: without the side, the plain reading would judge the arm that does not move.
    const m = swing(13, 15, { mirror: true });
    expect(compareAttempt(ref, m.lms, m.ts, options).mirrored).toBe(false);
    expect(compareAttempt(ref, m.lms, m.ts, { ...options, mirror: true })).toMatchObject({ verdict: 'match', mirrored: true });
  });

  it('asks to revise a swing that stops at two thirds', () => {
    const short = swing();
    short.lms.forEach(lm => {
      const s = lm[11], w = lm[15], dx = w.x - s.x, dy = w.y - s.y;
      const a = Math.min(Math.atan2(dx, -dy), Math.PI / 3), len = Math.hypot(dx, dy);
      lm[15] = { ...w, x: s.x + len * Math.sin(a), y: s.y - len * Math.cos(a) };
    });
    expect(compareAttempt(ref, short.lms, short.ts, options).verdict).toBe('revise');
  });

  it('drops the samples where the wrist is put beside its own shoulder (the pose model losing it, filmed on the floor)', () => {
    const lms = plain.lms.slice(0, 20).map(lm => lm.map(p => ({ ...p })));
    // Every fifth sample: the wrist a fifth of the arm's length from the shoulder, still seen.
    lms.forEach((lm, i) => { if (i % 5 === 0) lm[15] = { ...lm[15], x: lm[11].x + (lm[15].x - lm[11].x) * 0.2, y: lm[11].y + (lm[15].y - lm[11].y) * 0.2 }; });
    const read = jointAngles(lms, options).leftArm;
    read.forEach((v, i) => expect(v == null).toBe(i % 5 === 0));
  });

  it('drops the samples where the wrist lies on the other one', () => {
    const lm = plain.lms[0].map(p => ({ ...p }));
    lm[15] = { ...lm[16] };
    expect(jointAngles([lm], options).leftArm).toEqual([null]);
  });

  it('keeps a direction on one side of the circle, and drops a one-sample jump', () => {
    expect(unwrapAround([170, -175, 178], 175)).toEqual([170, 185, 178]);
    expect(dropJumps([10, 11, 12, 80, 13, 14, 15])).toEqual([10, 11, 12, null, 13, 14, 15]);
  });

  it('keeps a steady move that runs into a gap or an end', () => {
    expect(dropJumps([0, 9, 18, 27, 36, 45, 54, null, null])).toEqual([0, 9, 18, 27, 36, 45, 54, null, null]);
  });

  it('mirrors landmarks: x turned over, left and right exchanged', () => {
    const lm = Array.from({ length: 33 }, (_, i) => ({ x: i / 100, y: 0, visibility: 1 }));
    const m = mirrorLandmarks([lm])[0];
    expect(m[11].x).toBeCloseTo(1 - 0.12);
    expect(m[0].x).toBeCloseTo(1);
  });
});

describe('the mirror reading', () => {
  // Side-on, as video 4: the near (right) arm is the reference's; the far arm is the pose model's guess.
  function sideOn(top, farTop, farSeen) {
    const ts = [], lms = [];
    for (let i = 0; i <= 150; i++) {
      const t = i / 15, a = (Math.PI / 180) * (10 + (top - 10) * Math.sin((Math.PI * t) / 10));
      const b = (Math.PI / 180) * (10 + (farTop - 10) * Math.sin((Math.PI * t) / 10));
      const pts = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.1 }));
      const arm = (s, e, w, h, ang, vis) => {
        pts[h] = { x: 0.3, y: 0.5, z: 0, visibility: vis }; pts[s] = { x: 0.6, y: 0.5, z: 0, visibility: vis };
        pts[e] = { x: 0.6 - 0.12 * Math.cos(ang), y: 0.5 - 0.12 * Math.sin(ang), z: 0, visibility: vis };
        pts[w] = { x: 0.6 - 0.24 * Math.cos(ang), y: 0.5 - 0.24 * Math.sin(ang), z: 0, visibility: vis };
      };
      arm(12, 14, 16, 24, a, 0.99); arm(11, 13, 15, 23, b, farSeen);
      ts.push(t); lms.push(pts);
    }
    return { ts, lms };
  }

  it('does not judge the far arm when the near one is seen (R8)', () => {
    const r0 = sideOn(170, 170, 0.3);
    const ref = buildReference(r0.lms, r0.ts, { aspect: 1 });
    expect(ref.joints.map(j => j.name)).toEqual(['rightShoulder', 'rightElbow']);
    const att = sideOn(90, 170, 0.9);
    expect(compareAttempt(ref, att.lms, att.ts, { aspect: 1 })).toMatchObject({ verdict: 'revise', mirrored: false });
  });
});

describe('moments the reference does not show', () => {
  it('judges an attempt only where the reference was seen (R8)', () => {
    const c = staged();
    // The reference's pose lost over its top hold: those moments are filled, not Olivier's movement.
    const lost = { ...c, rightShoulder: c.rightShoulder.map((v, i) => (i >= 82 && i < 106 ? null : v)) };
    const r = referenceFromCurves(lost);
    const att = staged();
    att.rightShoulder = att.rightShoulder.map((v, i) => (i >= 82 && i < 106 ? 120 : v));
    const out = compareCurves(r, att);
    expect(out.verdict).toBe('match');
    expect(out.joints[0].shown).toBeLessThan(0.85);
    expect(out.holds.some(h => h.refAngle > 160)).toBe(false);
    expect(out.seen[0].slice(82, 106).every(x => !x)).toBe(true);
  });
});

// Olivier's landmarks are a third party's and stay out of this public repository: these run where they are present
// (REFERENCE_LANDMARKS, the folder of test/real-phone/reference/README.md).
const local = process.env.REFERENCE_LANDMARKS;
const read = name => JSON.parse(gunzipSync(fs.readFileSync(`${local}/${name}.json.gz`)));
const opts = v => ({ aspect: v.metadata.extractedWidth / v.metadata.extractedHeight });
describe.skipIf(!local || !fs.existsSync(`${local}/olivier-4-supine-staged-raise.json.gz`))('Olivier video 4 (local landmarks)', () => {
  let v, ref;
  beforeAll(() => {
    v = read('olivier-4-supine-staged-raise');
    ref = buildReference(v.imageLandmarks, v.timestamps, opts(v));
  });

  it('uses the arm nearest the camera', () => {
    expect(ref.joints.map(j => j.name)).toEqual(['rightShoulder', 'rightElbow']);
  });

  it('matches the reference replayed 1.3 times slower', () => {
    const r = compareAttempt(ref, v.imageLandmarks, v.timestamps.map(t => t * 1.3), opts(v));
    expect(r.verdict).toBe('match');
  });

  it('does not match another exercise (video 1)', () => {
    const other = read('olivier-1-supine-clasped');
    expect(compareAttempt(ref, other.imageLandmarks, other.timestamps, opts(other)).verdict).toBe('revise');
  });
});

// Synthesizes a 3D standing limb repetition across arms, torso/hips, and knees for Card 063 Track A & C checks.
function plantedPoseSet({
  shoulderMaxDeg = 120,
  leftDelaySec = 0,
  kneeMaxDeg = 0,
  trunkLeanDeg = 0,
  pauseMidSec = 0,
  speed = 1,
  hideLegs = false,
} = {}) {
  const hz = 15, baseDur = 4, totalDur = baseDur / speed + pauseMidSec;
  const ts = [], lms = [];
  const rad = d => (d * Math.PI) / 180;
  for (let i = 0; i <= Math.round(totalDur * hz); i++) {
    const t = i / hz;
    const effT = pauseMidSec > 0 && t > (baseDur / 2) / speed
      ? Math.max((baseDur / 2) / speed, t - pauseMidSec)
      : t;
    const progress = s => {
      const u = Math.max(0, Math.min(1, ((effT - s) * speed) / baseDur));
      return 0.5 - 0.5 * Math.cos(2 * Math.PI * u);
    };
    const pR = progress(0), pL = progress(leftDelaySec);
    const lean = rad(trunkLeanDeg * Math.sin(Math.PI * Math.min(1, effT * speed / baseDur)));
    const sR = rad(15 + (shoulderMaxDeg - 15) * pR);
    const sL = rad(15 + (shoulderMaxDeg - 15) * pL);
    const kR = rad(kneeMaxDeg * pR);
    const hipY = 0.55, hipX = 0.5;
    const shY = hipY - 0.3 * Math.cos(lean), shX = hipX + 0.3 * Math.sin(lean);
    const pts = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }));
    const setUpper = (s, e, w, zOff, ang) => {
      pts[s] = { x: shX, y: shY, z: zOff, visibility: 0.95 };
      // Upper arm vector relative to trunk vector (hip -> shoulder: [sin(lean), -cos(lean)] -> down-trunk is [-sin(lean), cos(lean)])
      const armAng = ang + lean;
      pts[e] = { x: shX + 0.14 * Math.sin(armAng), y: shY + 0.14 * Math.cos(armAng), z: zOff, visibility: 0.95 };
      pts[w] = { x: shX + 0.28 * Math.sin(armAng), y: shY + 0.28 * Math.cos(armAng), z: zOff, visibility: 0.95 };
    };
    pts[24] = { x: hipX, y: hipY, z: 0.08, visibility: 0.95 };
    pts[23] = { x: hipX, y: hipY, z: -0.08, visibility: 0.95 };
    setUpper(12, 14, 16, 0.1, sR);
    setUpper(11, 13, 15, -0.1, sL);
    const legVis = hideLegs ? 0.1 : 0.95;
    const kneeY = hipY + 0.22, kneeX = hipX;
    pts[26] = { x: kneeX, y: kneeY, z: 0.08, visibility: legVis };
    pts[25] = { x: kneeX, y: kneeY, z: -0.08, visibility: legVis };
    pts[28] = { x: kneeX - 0.22 * Math.sin(kR), y: kneeY + 0.22 * Math.cos(kR), z: 0.08, visibility: legVis };
    pts[27] = { x: kneeX, y: kneeY + 0.22, z: -0.08, visibility: legVis };
    ts.push(t);
    lms.push(pts);
  }
  return { ts, lms };
}

describe('leg joints flag and range-weighted DTW scoring (Card 063 Tracks A & C)', () => {
  it('keeps leg joints opt-in so waist-up videos remain unrefused by default', () => {
    expect(Object.keys(LEG_JOINTS)).toEqual(['leftHip', 'rightHip', 'leftKnee', 'rightKnee']);
    expect(Object.keys(ALL_JOINTS)).toHaveLength(8);
    const refCut = plantedPoseSet({ hideLegs: true });
    const refDefault = buildReference(refCut.lms, refCut.ts);
    const refLegs = buildReference(refCut.lms, refCut.ts, { includeLegs: true });
    expect(refDefault.joints.map(j => j.name)).toEqual(['leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow']);
    expect(refLegs.unused.map(u => u.name)).toEqual(['leftHip', 'rightHip', 'leftKnee', 'rightKnee']);
    expect(compareAttempt(refDefault, refCut.lms, refCut.ts).verdict).toBe('match');
  });

  it('captures knee flexion movements when includeLegs is enabled', () => {
    const refLeg = plantedPoseSet({ shoulderMaxDeg: 20, kneeMaxDeg: 90 });
    const attGood = plantedPoseSet({ shoulderMaxDeg: 20, kneeMaxDeg: 90, speed: 1.25 });
    const attShallow = plantedPoseSet({ shoulderMaxDeg: 20, kneeMaxDeg: 45 });
    const ref = buildReference(refLeg.lms, refLeg.ts, { includeLegs: true });
    expect(ref.joints.find(j => j.name === 'rightKnee')?.kind).toBe('moving');
    const good = compareAttempt(ref, attGood.lms, attGood.ts, { includeLegs: true, rangeWeighted: true });
    const shallow = compareAttempt(ref, attShallow.lms, attShallow.ts, { includeLegs: true, rangeWeighted: true });
    expect(weightedRangeShortfall(ref, good)).toBeLessThan(0.05);
    expect(weightedRangeShortfall(ref, shallow)).toBeGreaterThan(0.45);
    expect(rangeWeightedScore(ref, shallow)).toBeGreaterThan(rangeWeightedScore(ref, good) + 8);
  });

  it('weights DTW alignment by joint ROM and separates planted faults with low false alarms (Track C)', () => {
    const base = plantedPoseSet({ shoulderMaxDeg: 120, kneeMaxDeg: 0 });
    const ref = buildReference(base.lms, base.ts, { includeLegs: true });

    // Clean paced variants -> no false alarms (< 5% across valid variations).
    const cleanVariants = [0.8, 1.0, 1.25].map(speed => {
      const att = plantedPoseSet({ shoulderMaxDeg: 120, kneeMaxDeg: 0, speed });
      const res = compareAttempt(ref, att.lms, att.ts, { includeLegs: true, rangeWeighted: true });
      return rangeWeightedScore(ref, res);
    });
    const maxClean = Math.max(...cleanVariants);
    expect(maxClean).toBeLessThan(5);

    // Fault 1: range stopped at 70% (shortfall ~0.30).
    const attShort = plantedPoseSet({ shoulderMaxDeg: 84 });
    const rShort = compareAttempt(ref, attShort.lms, attShort.ts, { includeLegs: true, rangeWeighted: true });
    expect(weightedRangeShortfall(ref, rShort)).toBeCloseTo(0.32, 1);
    expect(rangeWeightedScore(ref, rShort)).toBeGreaterThan(maxClean + 8);

    // Fault 2: one side late by 0.8 s.
    const attLate = plantedPoseSet({ shoulderMaxDeg: 120, leftDelaySec: 0.8 });
    const rLate = compareAttempt(ref, attLate.lms, attLate.ts, { includeLegs: true, rangeWeighted: true });
    expect(rangeWeightedScore(ref, rLate)).toBeGreaterThan(maxClean + 4);

    // Fault 3: trunk lean compensation (30 deg).
    const attLean = plantedPoseSet({ shoulderMaxDeg: 120, trunkLeanDeg: 30 });
    const rLean = compareAttempt(ref, attLean.lms, attLean.ts, { includeLegs: true, rangeWeighted: true });
    expect(rangeWeightedScore(ref, rLean)).toBeGreaterThan(maxClean + 2);

    // Fault 4: shortened hold / early return against a staged top hold (caught by holds() + weighted cost).
    const holdRef = referenceFromCurves(staged());
    const fastHold = staged();
    fastHold.rightShoulder = [...fastHold.rightShoulder.slice(0, 75), ...fastHold.rightShoulder.slice(105)];
    fastHold.rightElbow = fastHold.rightShoulder.map(() => 172);
    const holdCmp = compareCurves(holdRef, fastHold, { rangeWeighted: true });
    expect(holdCmp.holds.some(h => h.refAngle > 160 && h.status === 'short')).toBe(true);
    // Also verify a paused repetition alters alignment under pauseMidSec.
    const pausedAtt = plantedPoseSet({ shoulderMaxDeg: 120, pauseMidSec: 2 });
    const rPaused = compareAttempt(ref, pausedAtt.lms, pausedAtt.ts, { includeLegs: true, rangeWeighted: true });
    expect(rPaused.tempo).toBeGreaterThan(1.3);

    // align() must follow non-uniform weights (replaces weight ordering if joint 0 vs joint 1 disagree on offset).
    const pJ0 = align(
      [[0, 50, 100], [100, 100, 0]],
      [[80, 0, 50, 100, 0, 0, 0], [0, 0, 0, 0, 100, 100, 0]],
      [100, 0],
    );
    const pJ1 = align(
      [[0, 50, 100], [100, 100, 0]],
      [[80, 0, 50, 100, 0, 0, 0], [0, 0, 0, 0, 100, 100, 0]],
      [0, 100],
    );
    expect(pJ0[0]).toEqual([0, 1]);
    expect(pJ1[0]).toEqual([0, 4]);
    // Partial, non-finite, or negative weights must fall back safely without NaN paths.
    const pPartial = align([[0, 10, 20], [0, 0, 0]], [[5, 0, 10, 20, 5], [0, 0, 0, 0, 0]], [20]);
    expect(pPartial[0]).toEqual([0, 1]);
    const pNeg = align([[0, 10, 20], [0, 0, 0]], [[5, 0, 10, 20, 5], [0, 0, 0, 0, 0]], [-10, NaN]);
    expect(pNeg[0]).toEqual([0, 1]);
  });

  it('handles weightedRangeShortfall & rangeWeightedScore edge cases (null refs, refused, mirrored, held-only)', () => {
    // Held-only reference (< 10 deg) -> null instead of 0.
    const heldRef = referenceFromCurves({ rightShoulder: Array(20).fill(90), rightElbow: Array(20).fill(170) });
    const heldRes = compareCurves(heldRef, { rightShoulder: Array(20).fill(90), rightElbow: Array(20).fill(170) });
    expect(weightedRangeShortfall(heldRef, heldRes)).toBeNull();
    expect(rangeWeightedScore(heldRef, heldRes)).toBeNull();

    // Refused comparison -> null.
    const activeRef = referenceFromCurves(staged());
    const refusedRes = { verdict: 'refused', reasons: ['unseen:rightShoulder'], joints: [] };
    expect(weightedRangeShortfall(activeRef, refusedRes)).toBeNull();
    expect(rangeWeightedScore(activeRef, refusedRes)).toBeNull();

    // All-unseen matched samples -> null.
    expect(weightedRangeShortfall(activeRef, {
      verdict: 'match',
      cost: 1,
      matched: [[null, null], [null, null]],
      seen: [[false, false], [false, false]],
    })).toBeNull();

    // Mirrored comparison preserves active joint index alignment and evaluates shortfall correctly.
    const refR = plantedPoseSet({ shoulderMaxDeg: 120 });
    const refOneSide = buildReference(refR.lms, refR.ts, { joints: { rightShoulder: [24, 12, 14] } });
    const mirShort = plantedPoseSet({ shoulderMaxDeg: 70 });
    // Flip right <-> left landmarks cleanly so mirror: true measures the patient's left side against ref right.
    mirShort.lms.forEach(lm => { [lm[11], lm[12]] = [lm[12], lm[11]]; [lm[13], lm[14]] = [lm[14], lm[13]]; [lm[23], lm[24]] = [lm[24], lm[23]]; });
    const mirRes = compareAttempt(refOneSide, mirShort.lms, mirShort.ts, { mirror: true, rangeWeighted: true });
    expect(mirRes.mirrored).toBe(true);
    expect(weightedRangeShortfall(refOneSide, mirRes)).toBeGreaterThan(0.4);
  });
});
