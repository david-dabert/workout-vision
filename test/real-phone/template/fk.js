// Forward kinematics of a motion spec (test/real-phone/synth/motions/README.md) to MediaPipe world landmarks (8 October
// 2026, bench only). The same rotations as synth.js applySpec, on a stick body of fixed proportions, so a spec's pose at
// progress u reads as the pose model's 33 landmarks would: x the person's left, y down, z away from a camera the body
// faces, metres from the mid-hip. Only the landmarks the counters read are placed (nose, shoulders, elbows, wrists, hips,
// knees, ankles, heels, foot tips); the others are null. Segment lengths: a 1.75 m adult, rounded (UNSOURCED,
// experimental); only the directions matter to the angles, and the lengths to the positions in torso lengths.
const D = Math.PI / 180;
const LEN = { hipHalf: 0.09, torso: 0.5, shoulderHalf: 0.18, upperArm: 0.29, forearm: 0.26, thigh: 0.42, shank: 0.42, foot: 0.17, heel: 0.06, neck: 0.17, noseFwd: 0.09 };
const NEUTRAL = { pitch: 0, roll: 0, yaw: 0, trunk: 0, trunkSide: 0, neck: 0, shoulderFlex: 0, shoulderAbd: 8, humRot: 0, elbow: 8, hipFlex: 0, hipAbd: 4, knee: 0, ankle: 0 };

// 3x3 rotation matrices as row-major arrays.
const rx = a => { const c = Math.cos(a * D), s = Math.sin(a * D); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const ry = a => { const c = Math.cos(a * D), s = Math.sin(a * D); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rz = a => { const c = Math.cos(a * D), s = Math.sin(a * D); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const mm = (A, B) => { const C = new Array(9).fill(0); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) C[3 * i + j] += A[3 * i + k] * B[3 * k + j]; return C; };
const mul = (...ms) => ms.reduce(mm);
const mv = (A, v) => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
const add = (a, b, k = 1) => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];
const unit = v => { const n = Math.hypot(...v); return [v[0] / n, v[1] / n, v[2] / n]; };

/** A pose key's value for a side, as synth.js reads it: the side's override, else the shared value, else neutral. */
export function specValue(pose, key, side) {
  if (side && pose?.[side]?.[key] !== undefined) return pose[side][key];
  return pose?.[key] !== undefined ? pose[key] : NEUTRAL[key];
}

/**
 * The spec's pose at progress uL (left side) and uR (right side; shared keys follow the larger), as 33 landmarks.
 * swap: the sides' poses exchanged (alternate "mirror" on the right's reps).
 * @returns {Array<{x:number,y:number,z:number,visibility:number}|null>}
 */
export function specLandmarks(spec, uL, uR = uL, swap = false) {
  const lerp = (key, side, u) => { const a = specValue(spec.start, key, side), b = specValue(spec.end, key, side); return a + (b - a) * u; };
  const uS = Math.max(uL, uR), g = k => lerp(k, null, uS);
  const root = mul(ry(g('yaw')), rx(g('pitch')), rz(g('roll')));
  const trunk = mul(root, rx(g('trunk')), rz(-g('trunkSide')));
  const P = new Array(33).fill(null);
  const hipC = [0, 0, 0];
  const shC = mv(trunk, [0, LEN.torso, 0]);
  const put = (i, p) => { P[i] = p; };
  for (const [side, sg] of [['left', 1], ['right', -1]]) {
    const u = side === 'left' ? uL : uR, from = swap ? (side === 'left' ? 'right' : 'left') : side, k = key => lerp(key, from, u);
    const I = side === 'left' ? { sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27, he: 29, ft: 31 } : { sh: 12, el: 14, wr: 16, hip: 24, kn: 26, an: 28, he: 30, ft: 32 };
    const sh = add(shC, mv(trunk, [sg * LEN.shoulderHalf, 0, 0]));
    const arm = mul(trunk, rx(-k('shoulderFlex')), rz(sg * k('shoulderAbd')));
    const el = add(sh, mv(arm, [0, -1, 0]), LEN.upperArm);
    const wr = add(el, mv(mul(arm, ry(sg * k('humRot')), rx(-k('elbow'))), [0, -1, 0]), LEN.forearm);
    const hip = add(hipC, mv(root, [sg * LEN.hipHalf, 0, 0]));
    const thigh = mul(root, rx(-k('hipFlex')), rz(sg * k('hipAbd')));
    const kn = add(hip, mv(thigh, [0, -1, 0]), LEN.thigh);
    const shank = mul(thigh, rx(k('knee')));
    const an = add(kn, mv(shank, [0, -1, 0]), LEN.shank);
    const foot = mul(shank, rx(k('ankle')));
    const ft = add(an, mv(foot, unit([0, -0.45, 1])), LEN.foot);
    const he = add(an, mv(foot, [0, -0.35, -1]), LEN.heel);
    put(I.sh, sh); put(I.el, el); put(I.wr, wr); put(I.hip, hip); put(I.kn, kn); put(I.an, an); put(I.he, he); put(I.ft, ft);
  }
  put(0, add(shC, mv(mul(trunk, rx(g('neck'))), [0, LEN.neck, LEN.noseFwd])));
  // Body frame (x left, y up, z towards the faced camera) to MediaPipe's (x left as seen, y down, z away from the camera).
  return P.map(p => (p ? { x: p[0], y: -p[1], z: -p[2], visibility: 1 } : null));
}
