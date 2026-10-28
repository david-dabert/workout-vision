/**
 * Kinematic Rigid-Body Ghost Joint Solver
 * 
 * Reconstructs occluded limb joints (e.g. knee occluded by weight plates on hack squats;
 * elbow occluded by dumbbells on preacher curls) using exact geometric trilateration
 * from proximal and distal anatomical anchors.
 * 
 * In wild gym settings, visual landmarks frequently drop out when weights cross the line of sight.
 * By enforcing rigid link-length conservation (femur + tibia for leg, humerus + radius for arm),
 * this solver computes the mathematically exact, physically plausible joint coordinates
 * instead of allowing tracking dropouts or trajectory teleportation.
 * 
 * Strict Invariants:
 * - 100% Client-side purity (zero server latency or dependency).
 * - Deterministic geometric trigonometry.
 */

export interface AnchorPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface ReconstructedJoint {
  x: number;
  y: number;
  z?: number;
  visibility: number;
  isReconstructed: boolean;
  confidence: number; // 0 to 1
}

export type JointType = 'knee' | 'elbow';
export type FlexionDirection = 'forward' | 'backward'; // Relative to proximal-distal line

export interface SegmentLengths {
  proximalLength: number; // e.g. femur or humerus length
  distalLength: number; // e.g. tibia or forearm length
}

/**
 * Reconstructs an occluded intermediate joint between two visible anatomical anchors.
 * 
 * @param proximal Anchor joint (e.g. Hip for knee, Shoulder for elbow)
 * @param distal Anchor joint (e.g. Ankle for knee, Wrist for elbow)
 * @param currentJoint Measured joint landmark from computer vision (may be occluded)
 * @param lengths Calibrated anatomical link lengths (or default proportional estimates)
 * @param jointType 'knee' or 'elbow'
 * @param minConfidenceThreshold Minimum visibility below which reconstruction triggers (default: 0.35)
 */
export function reconstructGhostJoint(
  proximal: AnchorPoint,
  distal: AnchorPoint,
  currentJoint: AnchorPoint | null | undefined,
  lengths?: SegmentLengths,
  jointType: JointType = 'knee',
  minConfidenceThreshold = 0.35
): ReconstructedJoint {
  const currentVis = currentJoint?.visibility ?? 0;

  // If the joint is clearly visible and not occluded, preserve original
  if (currentJoint && currentVis >= minConfidenceThreshold) {
    return {
      x: currentJoint.x,
      y: currentJoint.y,
      z: currentJoint.z,
      visibility: currentVis,
      isReconstructed: false,
      confidence: currentVis,
    };
  }

  // Proximal and distal anchors must be present to reconstruct
  const proxVis = proximal.visibility ?? 1.0;
  const distVis = distal.visibility ?? 1.0;
  if (proxVis < 0.2 || distVis < 0.2) {
    // Cannot reliably reconstruct without both anchors
    return {
      x: currentJoint?.x ?? (proximal.x + distal.x) / 2,
      y: currentJoint?.y ?? (proximal.y + distal.y) / 2,
      z: currentJoint?.z,
      visibility: currentVis,
      isReconstructed: false,
      confidence: 0,
    };
  }

  const dx = distal.x - proximal.x;
  const dy = distal.y - proximal.y;
  const D = Math.hypot(dx, dy);

  // If anchors are too close (collapsed frame)
  if (D < 1e-4) {
    return {
      x: proximal.x,
      y: proximal.y,
      z: proximal.z,
      visibility: 0.5,
      isReconstructed: true,
      confidence: 0.3,
    };
  }

  // Derive anatomical segment lengths if not explicitly calibrated
  // Default human anthropometric ratios (Winter, Biomechanics and Motor Control of Human Movement):
  // Femur ~ 0.53 of leg, Tibia ~ 0.47 of leg
  // Humerus ~ 0.52 of arm, Forearm ~ 0.48 of arm
  const L1 = lengths?.proximalLength ?? (jointType === 'knee' ? D * 0.54 : D * 0.52);
  const L2 = lengths?.distalLength ?? (jointType === 'knee' ? D * 0.48 : D * 0.48);

  // Check physical limits (triangle inequality)
  let a: number;
  let h: number;

  if (D >= L1 + L2) {
    // Full extension or optical stretch beyond link sum: joint lies on line segment
    a = L1;
    h = 0;
  } else if (D <= Math.abs(L1 - L2)) {
    // Hyper-compressed beyond link difference
    a = Math.max(0, L1 - L2);
    h = 0;
  } else {
    // Law of cosines: calculate projection point a and perpendicular height h
    a = (L1 * L1 - L2 * L2 + D * D) / (2 * D);
    const hSquared = L1 * L1 - a * a;
    h = hSquared > 0 ? Math.sqrt(hSquared) : 0;
  }

  // Base point on the line segment between proximal and distal
  const p0x = proximal.x + (a / D) * dx;
  const p0y = proximal.y + (a / D) * dy;

  // Normal vector perpendicular to the proximal-distal line
  // [-dy / D, dx / D] and [dy / D, -dx / D]
  const nx = -dy / D;
  const ny = dx / D;

  // Determine physical anatomical bend orientation:
  // For knee: in side-view squats (facing left or right), the knee bends forward relative to hip-ankle.
  // In screen coordinates (y pointing down):
  // If moving down (dy > 0), knee projection direction depends on facing orientation.
  const cand1 = { x: p0x + h * nx, y: p0y + h * ny };
  const cand2 = { x: p0x - h * nx, y: p0y - h * ny };

  let chosen = cand1;
  if (currentJoint) {
    // If a low-confidence measurement exists, pick the candidate closest to it
    const dist1 = Math.hypot(cand1.x - currentJoint.x, cand1.y - currentJoint.y);
    const dist2 = Math.hypot(cand2.x - currentJoint.x, cand2.y - currentJoint.y);
    chosen = dist1 <= dist2 ? cand1 : cand2;
  } else {
    // Default anatomical convention:
    // For knee: knee generally extends anteriorly (opposite sign of hip hinge)
    chosen = cand1;
  }

  // Synthesize reconstructed depth z if available
  let reconstructedZ: number | undefined;
  if (proximal.z !== undefined && distal.z !== undefined) {
    reconstructedZ = proximal.z + (a / D) * (distal.z - proximal.z);
  }

  const confidence = Math.min(proxVis, distVis) * 0.85;

  return {
    x: chosen.x,
    y: chosen.y,
    z: reconstructedZ,
    visibility: confidence,
    isReconstructed: true,
    confidence,
  };
}
