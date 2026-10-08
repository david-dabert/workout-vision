// fk.js, the motion specs' kinematics (8 October 2026): the keys added for the motion library's authors (README.md in
// test/real-phone/synth/motions) move the stick body as their definitions say. synth.js renders the same rotations;
// fk-parity.mjs compares the two on rendered stills.
import { describe, expect, test } from 'vitest';
import { specAt, specLandmarks, specUses } from './fk.js';

type Lm = { x: number; y: number; z: number } | null;
const pose = (start: object, end: object, extra: object = {}) => ({ key: 't', start, end, ...extra });
// MediaPipe's frame: x the person's left, y down, z away from the camera the body faces.
const at = (spec: object, uL = 1, uR = uL, swap = false) => specLandmarks(spec, uL, uR, swap) as Lm[];
const LR: Array<[number, number]> = [[11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32]];

describe('fk.js spec keys', () => {
  test('mid: start -> mid -> end, piecewise linear; a key mid leaves out moves as without it', () => {
    const spec = pose({ knee: 0, elbow: 0 }, { knee: 0, elbow: 100 }, { mid: { knee: 120 } });
    expect(specAt(spec, 'knee', null, 0.25)).toBeCloseTo(60);
    expect(specAt(spec, 'knee', null, 0.5)).toBeCloseTo(120);
    expect(specAt(spec, 'knee', null, 0.75)).toBeCloseTo(60);
    expect(specAt(spec, 'elbow', 'left', 0.5)).toBeCloseTo(50);
    expect(specAt(spec, 'knee', null, 1.1)).toBeCloseTo(-24); // a rep past its working end continues the last segment
    expect(specAt(pose({ elbow: 0 }, { elbow: 100 }), 'elbow', null, 0.3)).toBeCloseTo(30);
    expect(specUses(spec, 'knee') && !specUses(spec, 'wrist')).toBe(true);
  });

  test('trunkTwist +: the chest turns towards the left (left shoulder back, right shoulder forward)', () => {
    const P = at(pose({}, { trunkTwist: 40 }));
    expect(P[11]!.z).toBeGreaterThan(0.05);
    expect(P[12]!.z).toBeLessThan(-0.05);
    expect(P[23]!.z).toBeCloseTo(0); // the pelvis stays
  });

  test('shrug raises that side\'s shoulder only', () => {
    const rest = at(pose({}, {}), 0), P = at(pose({}, { left: { shrug: 35 } }));
    expect(rest[11]!.y - P[11]!.y).toBeGreaterThan(0.05);
    expect(P[12]!.y).toBeCloseTo(rest[12]!.y);
  });

  test('hipRot + (external): standing the toes turn out; seated with the knee bent the foot moves in', () => {
    const stand0 = at(pose({}, {}), 0), stand = at(pose({}, { hipRot: 40 }));
    expect(stand[31]!.x - stand[27]!.x).toBeGreaterThan(stand0[31]!.x - stand0[27]!.x + 0.05);
    const seat = { hipFlex: 90, knee: 90 }, s0 = at(pose(seat, seat), 0), s1 = at(pose(seat, { ...seat, hipRot: 40 }));
    expect(s1[27]!.x).toBeLessThan(s0[27]!.x - 0.1);
    expect(s1[25]!.x).toBeCloseTo(s0[25]!.x); // about the thigh's own axis: the knee stays
  });

  test('wrist + bends the hand towards the palm; pronation sets the palm\'s side', () => {
    // Arm hanging, supinated (palm forward): flexion brings the fingers forward (towards the camera, z down).
    const sup = at(pose({ pronation: -90 }, { pronation: -90, wrist: 70 })), sup0 = at(pose({ pronation: -90 }, { pronation: -90 }), 0);
    expect(sup[19]!.z).toBeLessThan(sup0[19]!.z - 0.04);
    // Pronated (palm back): the same flexion brings them backward.
    const pro = at(pose({ pronation: 90 }, { pronation: 90, wrist: 70 }));
    expect(pro[19]!.z).toBeGreaterThan(sup0[19]!.z + 0.04);
    // Neutral, hanging: the thumb is forward of the pinky.
    const neu = at(pose({}, {}), 0);
    expect(neu[21]!.z).toBeLessThan(neu[17]!.z);
  });

  test('alternate "mirror": the swapped pose is the unswapped one mirrored, whole-body keys included', () => {
    const spec = pose({}, { roll: 20, yaw: 15, trunkSide: 25, trunkTwist: 30, pitch: 10, left: { shoulderAbd: 90, shrug: 20, hipRot: 20, pronation: -60, wrist: 30 }, right: { hipAbd: 25, humRot: 40, elbow: 70 } }, { alternate: 'mirror' });
    const P = at(spec, 0.8, 0.8, false), Q = at(spec, 0.8, 0.8, true);
    for (const [l, r] of [...LR, [0, 0]]) {
      for (const [a, b] of [[l, r], [r, l]]) {
        expect(Q[b]!.x).toBeCloseTo(-P[a]!.x, 9);
        expect(Q[b]!.y).toBeCloseTo(P[a]!.y, 9);
        expect(Q[b]!.z).toBeCloseTo(P[a]!.z, 9);
      }
    }
  });

  test('new keys left out change nothing', () => {
    const spec = pose({ pitch: 30, elbow: 40 }, { pitch: 60, knee: 80, trunkSide: 10 });
    const same = pose({ pitch: 30, elbow: 40, trunkTwist: 0, shrug: 0, hipRot: 0 }, { pitch: 60, knee: 80, trunkSide: 10, trunkTwist: 0, shrug: 0, hipRot: 0 });
    expect(at(same, 0.6)).toEqual(at(spec, 0.6));
  });
});
