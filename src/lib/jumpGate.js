/**
 * Continuity gate on the pose (7 October 2026, David's field report): during his machine seated back extension a
 * person walked behind him and the skeleton jumped to that person (a seated bystander in the background), then came
 * back; he believes it cost a rep (app 17, him 18). The model is asked for one pose per frame (numPoses 1) and keeps
 * whichever person its detector ranks first, frame by frame. The earlier fix, the lifter lock (lifterLock.js: two poses
 * asked, the largest box on frame 1), failed on his real videos and is off.
 *
 * This gate is cheaper and asks the model nothing new: a pose whose torso centre lies farther than JUMP_TORSO torso
 * lengths from the last accepted pose's, within JUMP_WINDOW_MS of it, is not accepted. The frame is treated as lost,
 * so the existing crop retry (poseCrop.js) looks again around the last accepted pose, the lifter's. A jump is accepted
 * only when it holds for more than JUMP_PERSIST_MS with no pose near the lifter found in between (the lifter moved or
 * the phone was re-framed). A frame whose pose stays near the last one is untouched.
 *
 * Pure logic here; the detection itself is in poseAnalysis.js (detectPoseImage).
 */
import { torsoOf } from './lifterLock';

// Off (7 October; TRIED.md, "Pose detection"): see the measurements there. Test benches turn it on
// (globalThis.__WV_BENCH_GATE__) or off (globalThis.__WV_BENCH_NO_GATE__). Source: UNSOURCED (David's field report of
// 7 October). Status: experimental.
export const JUMP_GATE = false;
// A torso centre farther than this many torso lengths (torsoScale) from the last accepted one is a jump.
// Source: UNSOURCED (a torso centre moves well under one torso length between two samples at 15 per second). Status:
// experimental.
export const JUMP_TORSO = 1;
// The torso length the jump is measured in: the median over the last JUMP_SCALE_POSES accepted poses, not the last
// pose's alone. A first version used the last pose's own length and held back 164 of 436 samples of David's squat (b):
// a skeleton half collapsed under the plate measures a torso of 10 to 30 px against a median of 97, so the next
// sound pose looked like a jump of several torso lengths. Source: UNSOURCED (1 s at 15 samples per second). Status:
// experimental.
export const JUMP_SCALE_POSES = 15;
// Only a pose this soon after the last accepted one is checked: after a longer gap the person may be anywhere.
// Source: UNSOURCED. Status: experimental.
export const JUMP_WINDOW_MS = 500;
// A jump that holds this long (every pose found far from the lifter, none near) is accepted as the lifter's new place.
// Source: UNSOURCED. Status: experimental.
export const JUMP_PERSIST_MS = 1000;

/** A fresh gate: no reference, no jump under way. */
export const newGate = () => ({ ref: null, since: null, lens: [] });

/**
 * Whether a pose found at `now` (normalised image landmarks of a frame width x height) is a jump the gate holds back.
 * A pose without a measurable torso, the first pose, a pose from another pass or frame size, or one after a gap longer
 * than JUMP_WINDOW_MS with no jump under way is never held back; nor is a jump that has held more than JUMP_PERSIST_MS.
 */
export function holdsBack(gate, landmarks, width, height, now) {
  const ref = gate.ref;
  if (!ref || ref.width !== width || ref.height !== height || now < ref.t) return false;
  const t = torsoOf(landmarks, width, height);
  if (!t) return false;
  if (gate.since === null && now - ref.t > JUMP_WINDOW_MS) return false;
  if (Math.hypot(t.x - ref.x, t.y - ref.y) <= JUMP_TORSO * torsoScale(gate)) return false;
  return !(gate.since !== null && now - gate.since > JUMP_PERSIST_MS);
}

/** The torso length jumps are measured in: the median of the recent accepted poses' (JUMP_SCALE_POSES). */
export function torsoScale(gate) {
  const lens = [...gate.lens].sort((a, b) => a - b);
  if (!lens.length) return gate.ref?.len ?? 0;
  const m = lens.length >> 1;
  return lens.length % 2 ? lens[m] : (lens[m - 1] + lens[m]) / 2;
}

/** The gate after a pose was accepted at `now`: it becomes the reference and any jump under way ends. */
export function accept(gate, landmarks, width, height, now) {
  const t = torsoOf(landmarks, width, height);
  if (!t) return { ...gate, since: null };
  // Lengths from another pass or frame size are forgotten.
  const same = gate.ref && gate.ref.width === width && gate.ref.height === height && now >= gate.ref.t;
  return { ref: { ...t, t: now, width, height }, since: null, lens: [...(same ? gate.lens : []), t.len].slice(-JUMP_SCALE_POSES) };
}

/** The gate after a jump was held back at `now`: the jump under way starts here if none was. */
export const heldBack = (gate, now) => ({ ...gate, since: gate.since ?? now });
