/**
 * SubFrameInflection: Sub-Frame Quadratic Vertex Interpolation & Multi-Angle Foreshortening Invariance.
 *
 * Problem:
 * 1. At 30 FPS (33.3ms per frame), the true turnaround point (apex of stretch / lockout) of an athletic
 *    rep usually falls between two discrete camera frames. Discrete sampling introduces a +/- 2° to 4°
 *    quantization error in measured depth, causing false refusals or off-by-one rep errors.
 * 2. In real gym environments, phones are rarely placed at a pure 90° profile; athletes lean their phones
 *    against water bottles at 45°-60° oblique angles, causing 2D foreshortening of sagittal joint angles.
 *
 * Solution:
 * 1. Fits a local quadratic parabola y(t) = a*t^2 + b*t + c through turnaround triplets (t-1, t0, t+1).
 *    Analytically computes the continuous vertex t_peak = -b / (2a) and y_peak = c - b^2 / (4a).
 * 2. Derives 3D camera azimuth angle phi from the shoulder/hip coronal vector (MediaPipe world Z),
 *    applying trigonometric projection compensation to restore true physical joint range of motion.
 */

export interface TimePoint {
  t: number; // Milliseconds
  y: number; // Joint angle in degrees or displacement in meters
}

export interface SubFrameVertex {
  tPeak: number; // Sub-frame continuous timestamp (ms)
  yPeak: number; // Sub-frame peak value (degrees or meters)
  isPeak: boolean; // True if convex peak (lockout); false if concave valley (inflection/stretch)
  curvature: number; // Second derivative (2a), measuring turnaround sharpness
  frameOffsetMs: number; // Offset from central discrete frame t0 (ms)
}

export interface Landmark3D {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/**
 * Fits a continuous quadratic parabola through three successive trajectory points and
 * computes the exact sub-frame mathematical apex.
 */
export function interpolateSubFrameInflection(
  pPrev: TimePoint,
  pCurr: TimePoint,
  pNext: TimePoint
): SubFrameVertex | null {
  const dt1 = pCurr.t - pPrev.t;
  const dt2 = pNext.t - pCurr.t;

  if (dt1 <= 0 || dt2 <= 0) {
    return null;
  }

  // Check if pCurr is a local extremum
  const isConvexPeak = pCurr.y >= pPrev.y && pCurr.y >= pNext.y;
  const isConcaveValley = pCurr.y <= pPrev.y && pCurr.y <= pNext.y;

  if (!isConvexPeak && !isConcaveValley) {
    return null;
  }

  // In local time coordinates tau where tau = 0 at pCurr:
  // pPrev is at tau = -dt1, pCurr is at tau = 0, pNext is at tau = dt2
  const y0 = pCurr.y;
  const yMinus = pPrev.y;
  const yPlus = pNext.y;

  // Solving:
  // a * (-dt1)^2 + b * (-dt1) + c = yMinus
  // c = y0
  // a * (dt2)^2 + b * (dt2) + c = yPlus
  const denom = dt1 * dt2 * (dt1 + dt2);
  if (Math.abs(denom) < 1e-9) {
    return null;
  }

  const dyMinus = yMinus - y0;
  const dyPlus = yPlus - y0;

  const a = (dt1 * dyPlus + dt2 * dyMinus) / denom;
  const b = (dt1 * dt1 * dyPlus - dt2 * dt2 * dyMinus) / denom;
  const c = y0;

  // If a is near zero, trajectory is collinear (no curved peak)
  if (Math.abs(a) < 1e-7) {
    return {
      tPeak: pCurr.t,
      yPeak: pCurr.y,
      isPeak: isConvexPeak,
      curvature: 0,
      frameOffsetMs: 0,
    };
  }

  // Analytical vertex in local coordinates: tau_star = -b / (2a)
  let tauStar = -b / (2 * a);

  // Clamp vertex within the window [-dt1, dt2] to prevent non-physical extrapolation
  tauStar = Math.max(-dt1, Math.min(dt2, tauStar));

  const yStar = a * tauStar * tauStar + b * tauStar + c;

  return {
    tPeak: pCurr.t + tauStar,
    yPeak: yStar,
    isPeak: a < 0, // Negative second derivative means concave down (peak)
    curvature: 2 * a,
    frameOffsetMs: tauStar,
  };
}

/**
 * Estimates the 3D horizontal camera azimuth angle (phi) relative to the athlete's coronal plane.
 * phi = 0 rad means camera is directly facing the athlete (frontal).
 * phi = pi/2 rad (~1.57 rad) means camera is directly at the athlete's side (sagittal profile).
 */
export function estimateCameraAzimuthAngle(landmarks: Landmark3D[]): number {
  if (!landmarks || landmarks.length < 25) {
    return 0.0;
  }

  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  // Shoulder coronal vector in 3D
  const sDx = rightShoulder.x - leftShoulder.x;
  const sDz = (rightShoulder.z ?? 0) - (leftShoulder.z ?? 0);

  // Hip coronal vector in 3D
  const hDx = rightHip.x - leftHip.x;
  const hDz = (rightHip.z ?? 0) - (leftHip.z ?? 0);

  const avgDx = (sDx + hDx) / 2;
  const avgDz = (sDz + hDz) / 2;

  // Azimuth angle from X-Z plane
  const azimuthRad = Math.atan2(Math.abs(avgDz), Math.abs(avgDx));
  return azimuthRad;
}

/**
 * Compensates for 2D perspective foreshortening on sagittal plane joint angles
 * (e.g., knee flexion during squat, elbow flexion during bench press) when the camera
 * is placed at an oblique angle (e.g. 45°).
 */
export function correctObliqueForeshortening(
  observedAngleDeg: number,
  cameraAzimuthRad: number
): number {
  // If camera is close to pure sagittal profile (azimuth > 75 deg = 1.3 rad), foreshortening is negligible
  const profileAngle = Math.PI / 2;
  const deltaAngle = Math.abs(profileAngle - cameraAzimuthRad);

  if (deltaAngle < 0.15) {
    return observedAngleDeg; // Already orthogonal
  }

  // Trigonometric foreshortening correction factor
  const cosFactor = Math.cos(deltaAngle);
  if (cosFactor < 0.35) {
    // Too oblique to recover safely without 3D depth hallucination; preserve raw angle
    return observedAngleDeg;
  }

  // Convert to radians, adjust projection tangent, convert back
  const obsRad = (observedAngleDeg * Math.PI) / 180;
  const correctedRad = 2 * Math.atan(Math.tan(obsRad / 2) / cosFactor);
  const correctedDeg = (correctedRad * 180) / Math.PI;

  // Clamp within human anatomical bounds [0, 180]
  return Math.max(0, Math.min(180, correctedDeg));
}

/**
 * Validates whether a detected movement phase duration conforms to human biological neuromuscular limits.
 * Concentric reversals faster than 180ms are non-biological camera noise or landmark flickers.
 */
export function validatePhysiologicalPhaseDuration(
  durationMs: number,
  phaseType: 'CONCENTRIC' | 'ECCENTRIC'
): boolean {
  if (phaseType === 'CONCENTRIC') {
    return durationMs >= 180 && durationMs <= 10000;
  }
  return durationMs >= 250 && durationMs <= 15000;
}
