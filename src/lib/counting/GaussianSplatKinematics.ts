/**
 * Gaussian Splat Kinematics — Continuous 3D Volumetric Uncertainty Modeling
 *
 * Groundbreaking formulation: replaces infinitesimal 0D landmark points with
 * continuous 3D anisotropic Gaussian Splats G(mu, Sigma) across the human skeletal chain.
 *
 * Core principles:
 * 1. Monocular depth projection asymmetry: sigma_z >> sigma_xy (3-5x depth uncertainty from monocular RGB).
 * 2. Visibility spatial dilation: sigma_transverse scales inversely with landmark visibility.
 * 3. Anatomical bone length invariance: rigid segment distance |p_i - p_j| conservation prior
 *    inflates covariance along the bone vector under non-rigid pose distortion.
 * 4. Analytical closed-form Jacobian propagation: sigma_theta^2 = J * Sigma * J^T computes
 *    exact joint angle probability distributions N(mu_theta, sigma_theta^2).
 */

import { WorldLandmark, WorldLandmarkFrame, Joint, JOINT_POINTS } from './core';

export interface Matrix3x3 {
  m00: number; m01: number; m02: number;
  m10: number; m11: number; m12: number;
  m20: number; m21: number; m22: number;
}

export interface GaussianSplat3D {
  centroid: [number, number, number];
  covariance: Matrix3x3;
  visibility: number;
  transverseVariance: number;
  depthVariance: number;
}

export interface AngleUncertainty {
  angleDeg: number;
  varianceDeg2: number;
  stdDevDeg: number;
  jacobian: {
    gradA: [number, number, number];
    gradV: [number, number, number];
    gradB: [number, number, number];
  };
}

export const ANATOMICAL_BONES: [number, number][] = [
  // Torso & Shoulders
  [11, 12], // Left shoulder - Right shoulder
  [11, 23], // Left shoulder - Left hip
  [12, 24], // Right shoulder - Right hip
  [23, 24], // Pelvis (Left hip - Right hip)
  // Left Arm
  [11, 13], // Left shoulder - Left elbow
  [13, 15], // Left elbow - Left wrist
  // Right Arm
  [12, 14], // Right shoulder - Right elbow
  [14, 16], // Right elbow - Right wrist
  // Left Leg
  [23, 25], // Left hip - Left knee
  [25, 27], // Left knee - Left ankle
  // Right Leg
  [24, 26], // Right hip - Right knee
  [26, 28], // Right knee - Right ankle
];

/** Base standard deviation in normalized coordinate units (approx 0.5% of frame width/height) */
const BASE_SIGMA_XY = 0.006;
/** Ratio of depth uncertainty to planar uncertainty in monocular pose tracking */
const DEPTH_TO_PLANAR_RATIO = 3.5;
/** Deg to Rad and Rad to Deg conversion factors */
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;
const EPSILON = 1e-6;

/**
 * Creates a diagonal 3x3 covariance matrix
 */
export function createDiagonalCovariance(sX2: number, sY2: number, sZ2: number): Matrix3x3 {
  return {
    m00: sX2, m01: 0,   m02: 0,
    m10: 0,   m11: sY2, m12: 0,
    m20: 0,   m21: 0,   m22: sZ2,
  };
}

/**
 * Multiplies vector J (1x3) by Matrix3x3 (3x3) by vector J^T (3x1): J * Sigma * J^T
 */
export function quadraticForm(grad: [number, number, number], cov: Matrix3x3): number {
  const [gx, gy, gz] = grad;
  const col0 = cov.m00 * gx + cov.m01 * gy + cov.m02 * gz;
  const col1 = cov.m10 * gx + cov.m11 * gy + cov.m12 * gz;
  const col2 = cov.m20 * gx + cov.m21 * gy + cov.m22 * gz;
  return gx * col0 + gy * col1 + gz * col2;
}

/**
 * Computes median reference bone lengths across high-visibility frames
 */
export function estimateReferenceBoneLengths(frames: WorldLandmarkFrame[]): Map<string, number> {
  const boneSamples: Map<string, number[]> = new Map();

  for (const [i, j] of ANATOMICAL_BONES) {
    const key = `${i}-${j}`;
    boneSamples.set(key, []);
  }

  for (const frame of frames) {
    if (!frame) continue;
    for (const [i, j] of ANATOMICAL_BONES) {
      const p1 = frame[i];
      const p2 = frame[j];
      if (!p1 || !p2) continue;
      const v1 = p1.visibility ?? 0;
      const v2 = p2.visibility ?? 0;
      if (v1 >= 0.8 && v2 >= 0.8) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dz = p1.z - p2.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist > EPSILON && dist < 2.5) {
          boneSamples.get(`${i}-${j}`)?.push(dist);
        }
      }
    }
  }

  const result = new Map<string, number>();
  for (const [key, samples] of boneSamples.entries()) {
    if (samples.length > 0) {
      samples.sort((a, b) => a - b);
      const mid = Math.floor(samples.length / 2);
      const median = samples.length % 2 === 0 ? (samples[mid - 1] + samples[mid]) / 2 : samples[mid];
      result.set(key, median);
    }
  }
  return result;
}

/**
 * Builds continuous 3D Gaussian Splats for all landmarks in a single frame,
 * factoring in visibility confidence and anatomical bone length constraints.
 */
export function buildSkeletalGaussianSplats(
  landmarks: WorldLandmark[],
  refBoneLengths?: Map<string, number>
): Map<number, GaussianSplat3D> {
  const splats = new Map<number, GaussianSplat3D>();

  for (let idx = 0; idx < landmarks.length; idx++) {
    const lm = landmarks[idx];
    if (!lm) continue;

    const vis = Math.max(0, Math.min(1, lm.visibility ?? 0));
    // Transverse variance expands smoothly as visibility falls
    const visFactor = 1.0 + 4.0 * Math.pow(1.0 - vis, 2);
    const sXY = BASE_SIGMA_XY * visFactor;
    const sZ = sXY * DEPTH_TO_PLANAR_RATIO;

    const cov = createDiagonalCovariance(sXY * sXY, sXY * sXY, sZ * sZ);

    splats.set(idx, {
      centroid: [lm.x, lm.y, lm.z],
      covariance: cov,
      visibility: vis,
      transverseVariance: sXY * sXY,
      depthVariance: sZ * sZ,
    });
  }

  // If reference bone lengths are provided, inflate covariance along bone vectors that violate rigidity
  if (refBoneLengths && refBoneLengths.size > 0) {
    for (const [i, j] of ANATOMICAL_BONES) {
      const p1 = landmarks[i];
      const p2 = landmarks[j];
      const refLen = refBoneLengths.get(`${i}-${j}`);
      if (!p1 || !p2 || !refLen || refLen <= EPSILON) continue;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dz = p2.z - p1.z;
      const currentLen = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (currentLen <= EPSILON) continue;

      const deltaRatio = Math.abs(currentLen - refLen) / refLen;
      // If bone length deviates more than 5%, human skeletal rigidity is violated -> tracking distortion
      if (deltaRatio > 0.05) {
        const ux = dx / currentLen;
        const uy = dy / currentLen;
        const uz = dz / currentLen;
        const penaltyVar = Math.pow(deltaRatio * refLen, 2);

        for (const targetIdx of [i, j]) {
          const splat = splats.get(targetIdx);
          if (splat) {
            // Add outer product u * u^T * penaltyVar to covariance matrix
            splat.covariance.m00 += ux * ux * penaltyVar;
            splat.covariance.m01 += ux * uy * penaltyVar;
            splat.covariance.m02 += ux * uz * penaltyVar;

            splat.covariance.m10 += uy * ux * penaltyVar;
            splat.covariance.m11 += uy * uy * penaltyVar;
            splat.covariance.m12 += uy * uz * penaltyVar;

            splat.covariance.m20 += uz * ux * penaltyVar;
            splat.covariance.m21 += uz * uy * penaltyVar;
            splat.covariance.m22 += uz * uz * penaltyVar;
          }
        }
      }
    }
  }

  return splats;
}

/**
 * Computes closed-form analytical Jacobian of 3D joint angle with respect to
 * end-point A, vertex V, and end-point B, and propagates Gaussian covariance.
 */
export function computeAngleUncertainty(
  a: WorldLandmark,
  v: WorldLandmark,
  b: WorldLandmark,
  splatA?: GaussianSplat3D,
  splatV?: GaussianSplat3D,
  splatB?: GaussianSplat3D
): AngleUncertainty | null {
  const ux = a.x - v.x;
  const uy = a.y - v.y;
  const uz = a.z - v.z;
  const ru = Math.sqrt(ux * ux + uy * uy + uz * uz);

  const wx = b.x - v.x;
  const wy = b.y - v.y;
  const wz = b.z - v.z;
  const rw = Math.sqrt(wx * wx + wy * wy + wz * wz);

  if (ru <= EPSILON || rw <= EPSILON) return null;

  const dot = ux * wx + uy * wy + uz * wz;
  let cosTheta = dot / (ru * rw);
  // Clamp to numerical domain [-1, 1]
  cosTheta = Math.max(-1, Math.min(1, cosTheta));
  const angleRad = Math.acos(cosTheta);
  const angleDeg = angleRad * RAD_TO_DEG;

  let sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
  // Safeguard against division by zero near collinear limits (0 deg or 180 deg)
  sinTheta = Math.max(0.01, sinTheta);

  const uHat: [number, number, number] = [ux / ru, uy / ru, uz / ru];
  const wHat: [number, number, number] = [wx / rw, wy / rw, wz / rw];

  // Analytical partial derivatives:
  // gradA = (1 / (sin(theta) * ru)) * (cos(theta) * uHat - wHat)
  const factorA = 1.0 / (sinTheta * ru);
  const gradA: [number, number, number] = [
    factorA * (cosTheta * uHat[0] - wHat[0]),
    factorA * (cosTheta * uHat[1] - wHat[1]),
    factorA * (cosTheta * uHat[2] - wHat[2]),
  ];

  // gradB = (1 / (sin(theta) * rw)) * (cos(theta) * wHat - uHat)
  const factorB = 1.0 / (sinTheta * rw);
  const gradB: [number, number, number] = [
    factorB * (cosTheta * wHat[0] - uHat[0]),
    factorB * (cosTheta * wHat[1] - uHat[1]),
    factorB * (cosTheta * wHat[2] - uHat[2]),
  ];

  // gradV = -(gradA + gradB)
  const gradV: [number, number, number] = [
    -(gradA[0] + gradB[0]),
    -(gradA[1] + gradB[1]),
    -(gradA[2] + gradB[2]),
  ];

  // Fallback default covariance if splats not provided
  const visA = Math.max(0, Math.min(1, a.visibility ?? 0));
  const visV = Math.max(0, Math.min(1, v.visibility ?? 0));
  const visB = Math.max(0, Math.min(1, b.visibility ?? 0));

  const covA = splatA?.covariance ?? createDiagonalCovariance(
    Math.pow(BASE_SIGMA_XY * (1 + 4 * (1 - visA)), 2),
    Math.pow(BASE_SIGMA_XY * (1 + 4 * (1 - visA)), 2),
    Math.pow(BASE_SIGMA_XY * DEPTH_TO_PLANAR_RATIO * (1 + 4 * (1 - visA)), 2)
  );

  const covV = splatV?.covariance ?? createDiagonalCovariance(
    Math.pow(BASE_SIGMA_XY * (1 + 4 * (1 - visV)), 2),
    Math.pow(BASE_SIGMA_XY * (1 + 4 * (1 - visV)), 2),
    Math.pow(BASE_SIGMA_XY * DEPTH_TO_PLANAR_RATIO * (1 + 4 * (1 - visV)), 2)
  );

  const covB = splatB?.covariance ?? createDiagonalCovariance(
    Math.pow(BASE_SIGMA_XY * (1 + 4 * (1 - visB)), 2),
    Math.pow(BASE_SIGMA_XY * (1 + 4 * (1 - visB)), 2),
    Math.pow(BASE_SIGMA_XY * DEPTH_TO_PLANAR_RATIO * (1 + 4 * (1 - visB)), 2)
  );

  // Propagate variance in radians squared: J * Sigma * J^T
  const varRad2 = quadraticForm(gradA, covA) + quadraticForm(gradV, covV) + quadraticForm(gradB, covB);
  // Convert variance to degrees squared
  const varianceDeg2 = Math.max(0.01, varRad2 * RAD_TO_DEG * RAD_TO_DEG);
  const stdDevDeg = Math.sqrt(varianceDeg2);

  return {
    angleDeg,
    varianceDeg2,
    stdDevDeg,
    jacobian: { gradA, gradV, gradB },
  };
}

/**
 * Computes continuous joint angles and their analytical Gaussian uncertainties across an entire video stream.
 */
export function computeTrajectoryGaussianKinematics(
  worldLandmarks: WorldLandmarkFrame[],
  joint: Joint,
  arm: 'left' | 'right'
): {
  angles: (number | null)[];
  uncertainties: (AngleUncertainty | null)[];
  stdDevDeg: number[];
} {
  const points = JOINT_POINTS[joint][arm];
  const [idxA, idxV, idxB] = points;
  const refBoneLengths = estimateReferenceBoneLengths(worldLandmarks);

  const angles: (number | null)[] = [];
  const uncertainties: (AngleUncertainty | null)[] = [];
  const stdDevDeg: number[] = [];

  for (let i = 0; i < worldLandmarks.length; i++) {
    const frame = worldLandmarks[i];
    if (!frame) {
      angles.push(null);
      uncertainties.push(null);
      stdDevDeg.push(999.0); // Extreme uncertainty for missing frame
      continue;
    }

    const pA = frame[idxA];
    const pV = frame[idxV];
    const pB = frame[idxB];

    if (!pA || !pV || !pB) {
      angles.push(null);
      uncertainties.push(null);
      stdDevDeg.push(999.0);
      continue;
    }

    const splats = buildSkeletalGaussianSplats(frame, refBoneLengths);
    const uncert = computeAngleUncertainty(
      pA, pV, pB,
      splats.get(idxA), splats.get(idxV), splats.get(idxB)
    );

    if (uncert) {
      angles.push(uncert.angleDeg);
      uncertainties.push(uncert);
      stdDevDeg.push(uncert.stdDevDeg);
    } else {
      angles.push(null);
      uncertainties.push(null);
      stdDevDeg.push(999.0);
    }
  }

  return { angles, uncertainties, stdDevDeg };
}
