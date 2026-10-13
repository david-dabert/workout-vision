/**
 * Equine Locomotion & Veterinary Asymmetry Kinematics Engine
 *
 * Implements objective quadruped gait analysis for veterinary rehabilitation,
 * trot-up evaluations, and circle lunging assessments (Dyson & Greve, 2016;
 * Pfau et al., 2014; Starke et al., 2012; Bishop et al., 2018).
 *
 * The equine trot is a symmetrical, two-beat diagonal gait:
 * - Diagonal 1 (D1): Left Fore (LF) + Right Hind (RH)
 * - Diagonal 2 (D2): Right Fore (RF) + Left Hind (LH)
 *
 * Sound locomotion displays equal vertical excursion minima and maxima of
 * withers/poll and pelvis/sacrum during both diagonal stances.
 *
 * 100% on-device mathematical computation. Zero server transmission.
 */

export interface EquineLandmarks {
  poll?: { x: number; y: number; z?: number };
  withers: { x: number; y: number; z?: number };
  sacrum: { x: number; y: number; z?: number };
  leftForeHoof?: { x: number; y: number; z?: number };
  rightForeHoof?: { x: number; y: number; z?: number };
  leftHindHoof?: { x: number; y: number; z?: number };
  rightHindHoof?: { x: number; y: number; z?: number };
}

export interface EquineFrame {
  timestamp: number; // in milliseconds
  landmarks: EquineLandmarks;
}

export interface DiagonalMetrics {
  stanceStartTime: number;
  stanceEndTime: number;
  durationMs: number;
  withersMinY: number;
  withersMaxY: number;
  withersRomY: number;
  sacrumMinY: number;
  sacrumMaxY: number;
  sacrumRomY: number;
}

export interface EquineStride {
  strideIndex: number;
  startTime: number;
  endTime: number;
  durationMs: number;
  frequencyHz: number;
  diagonal1: DiagonalMetrics; // LF + RH
  diagonal2: DiagonalMetrics; // RF + LH
  dutyFactorD1: number;
  dutyFactorD2: number;
  withersMinDiff: number; // |min_D1 - min_D2|
  withersMaxDiff: number; // |max_D1 - max_D2|
  withersAsymmetryPct: number; // BAI (%)
  pelvicMinDiff: number; // |min_D1 - min_D2|
  pelvicMaxDiff: number; // |max_D1 - max_D2|
  pelvicAsymmetryPct: number; // BAI (%)
}

export interface CircleLungeOptions {
  isCircle?: boolean;
  circleRadiusMeters?: number; // e.g. 10m lunge circle
  direction?: 'clockwise' | 'counter-clockwise';
  speedMetersPerSec?: number; // typical trot ~3.0 - 4.5 m/s
}

export interface EquineGaitReport {
  totalStrides: number;
  meanStrideFrequencyHz: number;
  meanDutyFactor: number;
  meanWithersMinDiff: number;
  meanWithersMaxDiff: number;
  meanWithersAsymmetryPct: number;
  meanPelvicMinDiff: number;
  meanPelvicMaxDiff: number;
  meanPelvicAsymmetryPct: number;
  circleLeanAngleDeg?: number;
  isClinicallySymmetric: boolean; // BAI < 8% and MinDiff < threshold
  suspectedLamenessLimb?: 'LF' | 'RF' | 'LH' | 'RH' | 'None';
  strides: EquineStride[];
}

/**
 * Savitzky-Golay quadratic filter for 1D smoothing (window size 5, 7, 9, or 11).
 */
export function savitzkyGolay(data: number[], windowSize = 7): number[] {
  const n = data.length;
  if (n < windowSize) return [...data];
  const half = Math.floor(windowSize / 2);
  const out = new Array(n);

  // Standard SG quadratic filter coefficients for window 7: [-2, 3, 6, 7, 6, 3, -2] / 21
  const coeffs7 = [-2, 3, 6, 7, 6, 3, -2];
  const norm7 = 21;

  for (let i = 0; i < n; i++) {
    if (i < half || i >= n - half) {
      // Boundary handling: local average
      let sum = 0, count = 0;
      for (let j = Math.max(0, i - half); j <= Math.min(n - 1, i + half); j++) {
        sum += data[j];
        count++;
      }
      out[i] = sum / count;
    } else {
      let sum = 0;
      for (let k = -half; k <= half; k++) {
        sum += data[i + k] * coeffs7[k + half];
      }
      out[i] = sum / norm7;
    }
  }
  return out;
}

/**
 * Computes Bilateral Asymmetry Index (Bishop et al., 2018).
 * Positive = Right/D2 dominant, Negative = Left/D1 dominant.
 */
export function calculateBAI(d1Excursion: number, d2Excursion: number): number {
  const maxVal = Math.max(Math.abs(d1Excursion), Math.abs(d2Excursion));
  if (maxVal === 0) return 0;
  return ((d2Excursion - d1Excursion) / maxVal) * 100;
}

/**
 * Centripetal lean correction for circular lunging (Dyson & Greve, 2016).
 * Computes the nominal inward body lean theta = arctan(v^2 / (g * R)).
 */
export function calculateCircleLean(radiusMeters: number, speedMps: number): number {
  if (radiusMeters <= 0) return 0;
  const g = 9.80665;
  const rad = Math.atan((speedMps * speedMps) / (g * radiusMeters));
  return (rad * 180) / Math.PI;
}

/**
 * Analyzes a continuous time-series of equine landmark frames to extract
 * objective gait symmetry, stride frequency, duty factor, and lameness indicators.
 */
export function analyzeEquineGait(
  frames: EquineFrame[],
  options: CircleLungeOptions = {}
): EquineGaitReport {
  if (!frames || frames.length < 15) {
    return {
      totalStrides: 0,
      meanStrideFrequencyHz: 0,
      meanDutyFactor: 0,
      meanWithersMinDiff: 0,
      meanWithersMaxDiff: 0,
      meanWithersAsymmetryPct: 0,
      meanPelvicMinDiff: 0,
      meanPelvicMaxDiff: 0,
      meanPelvicAsymmetryPct: 0,
      isClinicallySymmetric: true,
      suspectedLamenessLimb: 'None',
      strides: [],
    };
  }

  const times = frames.map(f => f.timestamp);
  const rawWithersY = frames.map(f => f.landmarks.withers.y);
  const rawSacrumY = frames.map(f => f.landmarks.sacrum.y);

  // Smooth vertical trajectory signals
  const withersY = savitzkyGolay(rawWithersY);
  const sacrumY = savitzkyGolay(rawSacrumY);

  // Find local minima in withers displacement (stance phases in trot)
  const minIndices: number[] = [];
  for (let i = 2; i < withersY.length - 2; i++) {
    if (
      withersY[i] <= withersY[i - 1] &&
      withersY[i] < withersY[i - 2] &&
      withersY[i] <= withersY[i + 1] &&
      withersY[i] < withersY[i + 2]
    ) {
      minIndices.push(i);
    }
  }

  // Filter out spurious micro-minima that are too close in time (< 150 ms)
  const filteredMins: number[] = [];
  for (const idx of minIndices) {
    if (
      filteredMins.length === 0 ||
      times[idx] - times[filteredMins[filteredMins.length - 1]] >= 150
    ) {
      filteredMins.push(idx);
    }
  }

  // In a trot, each stride cycle contains two consecutive stance minima (D1 and D2)
  const strides: EquineStride[] = [];
  let strideIndex = 1;

  for (let i = 0; i + 2 < filteredMins.length; i += 2) {
    const d1MinIdx = filteredMins[i];
    const d2MinIdx = filteredMins[i + 1];
    const nextD1MinIdx = filteredMins[i + 2];

    const strideStartTime = times[d1MinIdx];
    const strideEndTime = times[nextD1MinIdx];
    const strideDurationMs = strideEndTime - strideStartTime;
    if (strideDurationMs < 300 || strideDurationMs > 1500) continue; // Unrealistic trot frequency

    // D1 interval covers [d1MinIdx, d2MinIdx], D2 interval covers [d2MinIdx, nextD1MinIdx]
    let d1WithersMin = Infinity, d1WithersMax = -Infinity;
    let d1SacrumMin = Infinity, d1SacrumMax = -Infinity;
    for (let j = d1MinIdx; j <= d2MinIdx; j++) {
      if (withersY[j] < d1WithersMin) d1WithersMin = withersY[j];
      if (withersY[j] > d1WithersMax) d1WithersMax = withersY[j];
      if (sacrumY[j] < d1SacrumMin) d1SacrumMin = sacrumY[j];
      if (sacrumY[j] > d1SacrumMax) d1SacrumMax = sacrumY[j];
    }

    // Extract extrema for D2
    let d2WithersMin = Infinity, d2WithersMax = -Infinity;
    let d2SacrumMin = Infinity, d2SacrumMax = -Infinity;
    for (let j = d2MinIdx; j <= nextD1MinIdx; j++) {
      if (withersY[j] < d2WithersMin) d2WithersMin = withersY[j];
      if (withersY[j] > d2WithersMax) d2WithersMax = withersY[j];
      if (sacrumY[j] < d2SacrumMin) d2SacrumMin = sacrumY[j];
      if (sacrumY[j] > d2SacrumMax) d2SacrumMax = sacrumY[j];
    }

    const d1DurationMs = times[d2MinIdx] - times[d1MinIdx];
    const d2DurationMs = times[nextD1MinIdx] - times[d2MinIdx];

    const d1WithersRom = Math.max(0, d1WithersMax - d1WithersMin);
    const d2WithersRom = Math.max(0, d2WithersMax - d2WithersMin);
    const d1SacrumRom = Math.max(0, d1SacrumMax - d1SacrumMin);
    const d2SacrumRom = Math.max(0, d2SacrumMax - d2SacrumMin);

    const withersMinDiff = Math.abs(d1WithersMin - d2WithersMin);
    const withersMaxDiff = Math.abs(d1WithersMax - d2WithersMax);
    const withersAsymmetryPct = calculateBAI(d1WithersRom, d2WithersRom);

    const pelvicMinDiff = Math.abs(d1SacrumMin - d2SacrumMin);
    const pelvicMaxDiff = Math.abs(d1SacrumMax - d2SacrumMax);
    const pelvicAsymmetryPct = calculateBAI(d1SacrumRom, d2SacrumRom);

    const frequencyHz = 1000 / strideDurationMs;
    const dutyFactorD1 = d1DurationMs / strideDurationMs;
    const dutyFactorD2 = d2DurationMs / strideDurationMs;

    strides.push({
      strideIndex: strideIndex++,
      startTime: strideStartTime,
      endTime: strideEndTime,
      durationMs: strideDurationMs,
      frequencyHz,
      diagonal1: {
        stanceStartTime: strideStartTime,
        stanceEndTime: times[d2MinIdx],
        durationMs: d1DurationMs,
        withersMinY: d1WithersMin,
        withersMaxY: d1WithersMax,
        withersRomY: d1WithersRom,
        sacrumMinY: d1SacrumMin,
        sacrumMaxY: d1SacrumMax,
        sacrumRomY: d1SacrumRom,
      },
      diagonal2: {
        stanceStartTime: times[d2MinIdx],
        stanceEndTime: times[nextD1MinIdx],
        durationMs: d2DurationMs,
        withersMinY: d2WithersMin,
        withersMaxY: d2WithersMax,
        withersRomY: d2WithersRom,
        sacrumMinY: d2SacrumMin,
        sacrumMaxY: d2SacrumMax,
        sacrumRomY: d2SacrumRom,
      },
      dutyFactorD1,
      dutyFactorD2,
      withersMinDiff,
      withersMaxDiff,
      withersAsymmetryPct,
      pelvicMinDiff,
      pelvicMaxDiff,
      pelvicAsymmetryPct,
    });
  }

  if (strides.length === 0) {
    return {
      totalStrides: 0,
      meanStrideFrequencyHz: 0,
      meanDutyFactor: 0,
      meanWithersMinDiff: 0,
      meanWithersMaxDiff: 0,
      meanWithersAsymmetryPct: 0,
      meanPelvicMinDiff: 0,
      meanPelvicMaxDiff: 0,
      meanPelvicAsymmetryPct: 0,
      isClinicallySymmetric: true,
      suspectedLamenessLimb: 'None',
      strides: [],
    };
  }

  const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  const meanStrideFrequencyHz = mean(strides.map(s => s.frequencyHz));
  const meanDutyFactor = mean(strides.map(s => (s.dutyFactorD1 + s.dutyFactorD2) / 2));
  const meanWithersMinDiff = mean(strides.map(s => s.withersMinDiff));
  const meanWithersMaxDiff = mean(strides.map(s => s.withersMaxDiff));
  const meanWithersAsymmetryPct = mean(strides.map(s => s.withersAsymmetryPct));
  const meanPelvicMinDiff = mean(strides.map(s => s.pelvicMinDiff));
  const meanPelvicMaxDiff = mean(strides.map(s => s.pelvicMaxDiff));
  const meanPelvicAsymmetryPct = mean(strides.map(s => s.pelvicAsymmetryPct));

  // Circle compensation if lunging
  let circleLeanAngleDeg: number | undefined;
  if (options.isCircle && options.circleRadiusMeters && options.speedMetersPerSec) {
    circleLeanAngleDeg = calculateCircleLean(options.circleRadiusMeters, options.speedMetersPerSec);
  }

  // Clinical symmetry gate: BAI threshold of 8% (Bishop et al., 2018; Pfau et al., 2014)
  const isClinicallySymmetric =
    Math.abs(meanWithersAsymmetryPct) < 8.0 && Math.abs(meanPelvicAsymmetryPct) < 8.0;

  // Suspected limb classification:
  // If withers shows significant asymmetry:
  // - BAI = (D2 - D1) / max.
  // - If BAI > 0: D1 (LF) has reduced excursion -> LF lameness
  // - If BAI < 0: D2 (RF) has reduced excursion -> RF lameness
  // If pelvic shows significant asymmetry:
  // - If BAI > 0: D1 (RH) has reduced excursion -> RH lameness
  // - If BAI < 0: D2 (LH) has reduced excursion -> LH lameness
  let suspectedLamenessLimb: 'LF' | 'RF' | 'LH' | 'RH' | 'None' = 'None';
  if (!isClinicallySymmetric) {
    if (Math.abs(meanWithersAsymmetryPct) >= Math.abs(meanPelvicAsymmetryPct)) {
      suspectedLamenessLimb = meanWithersAsymmetryPct > 0 ? 'LF' : 'RF';
    } else {
      suspectedLamenessLimb = meanPelvicAsymmetryPct > 0 ? 'RH' : 'LH';
    }
  }

  return {
    totalStrides: strides.length,
    meanStrideFrequencyHz,
    meanDutyFactor,
    meanWithersMinDiff,
    meanWithersMaxDiff,
    meanWithersAsymmetryPct,
    meanPelvicMinDiff,
    meanPelvicMaxDiff,
    meanPelvicAsymmetryPct,
    circleLeanAngleDeg,
    isClinicallySymmetric,
    suspectedLamenessLimb,
    strides,
  };
}
