/**
 * Lock onto the lifter (7 October 2026). The occlusion benchmark (test/real-phone/occlusion/README.md) found the pose
 * model following a bystander instead of the lifter on 4 of 12 sets with a second person half in frame: MediaPipe
 * returns at most `numPoses` poses, and with one it keeps whichever person its detector ranks first, frame by frame.
 * With two, both people come back and the app keeps, per frame, the one whose torso is nearest the lifter's last
 * accepted torso.
 *
 * Pure geometry here; the detection itself is in poseAnalysis.js (detectPoseImage).
 *
 * Choices (Source: UNSOURCED; Status: experimental, measured on the occlusion bench and David's videos, TRIED.md
 * 7 October; not shipped, LIFTER_LOCK below):
 * - Torso centre = the mean of both shoulders and both hips in frame pixels: the four points that move least within a
 *   rep, unlike the box of all landmarks, whose centre jumped 0.4 to 0.7 box sides between two samples of one person
 *   on clean side views (the hands and feet enter and leave the visible box).
 * - First lifter (no reference yet): the existing subject rule (poseGeometry.ts selectSubjectPose: the largest visible
 *   box, then the most central). The phone is set up to film the lifter, so the lifter is usually the nearest and
 *   most central person; "the person who moves most" needs frames ahead, which the live path does not have.
 * - A frame with a single pose is returned as the model gave it (byte-identical to numPoses 1 when the model's first
 *   pose is unchanged). It moves the reference only when it lies near it (LOCK_FOLLOW_TORSO torso lengths) or when
 *   the reference is older than LOCK_STALE_MS, so a bystander found alone while the lifter is missed does not become
 *   the lifter.
 */
import { selectSubjectPose } from './poseGeometry';

// Off (7 October; TRIED.md, "Pose detection"): it fails R2 on David's real videos (barbell squat b 9 -> 6 for 9, an
// exact count lost and newly off by 3; chin-up 6 -> 8 for 5, newly off by 3): with two poses asked, 45 to 77 samples
// per gym video change to another pose (median joint shift 0.4 to 0.9 m), and the first-frame rule (largest box)
// picks the bystander on two side-view synthetic sets (michelle curl and press: bystander samples 167 -> 291 and
// 114 -> 307), where it fixes one (michelle squat 160 -> 30). Two poses also change 15 samples of a clean one-person
// set (soldier press, side): single-pose frames are not always byte-identical. Detection +5 to +43 % per minute of
// real video. Kept behind this flag with the bench hook. Source: UNSOURCED. Status: experimental, not shipped.
export const LIFTER_LOCK = false;
// Poses asked of the model when the lock is on. Source: UNSOURCED (two people is the case measured). Status: experimental.
export const LIFTER_POSES = 2;
// A single pose farther than this many torso lengths from the reference does not move it. Source: UNSOURCED (a torso
// centre moves well under one torso length between two samples at 15 per second). Status: experimental.
export const LOCK_FOLLOW_TORSO = 1;
// A reference not moved for this long is replaced by the next pose found, wherever it is. Source: UNSOURCED. Status:
// experimental.
export const LOCK_STALE_MS = 2000;

const L_SH = 11, R_SH = 12, L_HIP = 23, R_HIP = 24;

/** { x, y, len } in frame pixels: the torso's centre and its length (shoulders' middle to hips' middle), or null. */
export function torsoOf(landmarks, width, height) {
  const p = [L_SH, R_SH, L_HIP, R_HIP].map(i => landmarks?.[i]);
  if (p.some(q => !q || !Number.isFinite(q.x) || !Number.isFinite(q.y))) return null;
  const sx = ((p[0].x + p[1].x) / 2) * width, sy = ((p[0].y + p[1].y) / 2) * height;
  const hx = ((p[2].x + p[3].x) / 2) * width, hy = ((p[2].y + p[3].y) / 2) * height;
  return { x: (sx + hx) / 2, y: (sy + hy) / 2, len: Math.max(Math.hypot(sx - hx, sy - hy), 1) };
}

/** Index of the lifter among several poses: nearest the reference's torso, else the subject rule. */
export function pickLifter(poses, ref, width, height) {
  if (!poses?.length) return -1;
  if (poses.length === 1) return 0;
  if (ref) {
    let best = -1, bestD = Infinity;
    poses.forEach((lm, i) => {
      const t = torsoOf(lm, width, height);
      if (!t) return;
      const d = Math.hypot(t.x - ref.x, t.y - ref.y);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0) return best;
  }
  const chosen = selectSubjectPose(poses);
  return Math.max(0, poses.indexOf(chosen));
}

/**
 * The reference after a pose was accepted at `now`: moved to it when there was none, when it is stale or from another
 * pass (`now` before it), when the pose was chosen among several (`chosen`), or when it lies near it.
 */
export function nextReference(ref, landmarks, width, height, now, chosen = false) {
  const t = torsoOf(landmarks, width, height);
  if (!t) return ref;
  const fresh = { ...t, t: now, width, height };
  if (!ref || chosen || ref.width !== width || ref.height !== height || now < ref.t || now - ref.t > LOCK_STALE_MS) return fresh;
  return Math.hypot(t.x - ref.x, t.y - ref.y) <= LOCK_FOLLOW_TORSO * ref.len ? fresh : ref;
}
