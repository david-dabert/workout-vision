/**
 * The revised NIOSH lifting equation (Ergonomics.jsx, Calculateur NIOSH): the recommended weight limit (RWL) of a
 * two-handed lift and its lifting index (LI), from values the person types.
 *
 * Source: Waters TR, Putz-Anderson V, Garg A, Fine LJ. Revised NIOSH equation for the design and evaluation of manual
 * lifting tasks. Ergonomics 1993;36(7):749-776; and the NIOSH Applications Manual (Waters et al. 1994, DHHS (NIOSH)
 * Publication No. 94-110). Status: literature. The metric multipliers below are the published ones. The frequency and
 * coupling tables (FM_TABLE, couplingMultiplier) were written down from those publications from memory, not copied
 * from a fetched page on 14 October 2026: check them against Table 5 and Table 7 before relying on a value.
 *
 * Honesty pass of 14 October 2026 (ERG-1, ERG-3, ERG-4): the L5/S1 "compression" (1000 + load × 9.81 × H/5 + A × 15,
 * credited to Chaffin & Andersson 1991, whose book holds no such formula) and its verdict against 3 400 N are gone;
 * so is the "REBA" score, which had none of REBA's tables. The frequency multiplier was fixed at 1; frequency, duration
 * and coupling are now inputs. A factor outside the equation's domain (H over 63 cm, V over 175 cm, D over 175 cm, A
 * over 135°, or a frequency the table gives 0) makes the RWL 0 and the lift "outside the equation", as NIOSH sets it,
 * rather than clamping H to 63 cm. A future reading of H, V and A from a side video (extractNioshParametersFromLandmarks)
 * is experimental and used by no screen.
 */

export type Duration = 'short' | 'moderate' | 'long'; // ≤ 1 h, 1 to 2 h, 2 to 8 h of lifting
export type Coupling = 'good' | 'fair' | 'poor';

export interface NioshInput {
  loadWeightKg: number;
  /** H: horizontal distance of the hands from the midpoint between the ankles, cm. */
  horizontalDistanceCm: number;
  /** V: height of the hands above the floor at the origin, cm. */
  verticalOriginCm: number;
  /** D: vertical travel distance between origin and destination, cm. */
  verticalTravelDistanceCm: number;
  /** A: asymmetry angle, degrees. */
  asymmetryAngleDeg: number;
  /** F: lifts per minute (a row of FM_TABLE; 0.2 means one lift every five minutes or less often). */
  frequencyLiftsPerMin?: number;
  duration?: Duration;
  couplingQuality?: Coupling;
}

export type Factor = 'HM' | 'VM' | 'DM' | 'AM' | 'FM' | 'CM';

export interface NioshResult {
  loadConstantKg: number;
  horizontalMultiplierHM: number;
  verticalMultiplierVM: number;
  distanceMultiplierDM: number;
  asymmetricMultiplierAM: number;
  frequencyMultiplierFM: number;
  couplingMultiplierCM: number;
  recommendedWeightLimitKg: number; // RWL
  /** LI = load / RWL; null when the lift is outside the equation (RWL 0). */
  liftingIndexLI: number | null;
  /** NIOSH's reading of the LI (Applications Manual): 'nominal' at most 1, 'increased' above 1, 'high' above 3. */
  riskCategory: 'nominal' | 'increased' | 'high' | 'outside';
  /** The factors that put the lift outside the equation's domain. */
  outside: Factor[];
  /** The lowest multiplier: the one that reduces the limit most. */
  lowest: Factor;
}

/** The frequency rows of the table (lifts per minute). */
export const FREQUENCIES = [0.2, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

/**
 * FM by frequency row: [≤ 1 h, V < 75 cm], [≤ 1 h, V ≥ 75], [≤ 2 h, V < 75], [≤ 2 h, V ≥ 75], [≤ 8 h, V < 75],
 * [≤ 8 h, V ≥ 75]. Above 15 lifts a minute FM is 0. Waters et al. 1993, Table 5 (written from memory; see the header).
 */
export const FM_TABLE: Record<number, [number, number, number, number, number, number]> = {
  0.2: [1.00, 1.00, 0.95, 0.95, 0.85, 0.85],
  0.5: [0.97, 0.97, 0.92, 0.92, 0.81, 0.81],
  1: [0.94, 0.94, 0.88, 0.88, 0.75, 0.75],
  2: [0.91, 0.91, 0.84, 0.84, 0.65, 0.65],
  3: [0.88, 0.88, 0.79, 0.79, 0.55, 0.55],
  4: [0.84, 0.84, 0.72, 0.72, 0.45, 0.45],
  5: [0.80, 0.80, 0.60, 0.60, 0.35, 0.35],
  6: [0.75, 0.75, 0.50, 0.50, 0.27, 0.27],
  7: [0.70, 0.70, 0.42, 0.42, 0.22, 0.22],
  8: [0.60, 0.60, 0.35, 0.35, 0.18, 0.18],
  9: [0.52, 0.52, 0.30, 0.30, 0.00, 0.15],
  10: [0.45, 0.45, 0.26, 0.26, 0.00, 0.13],
  11: [0.41, 0.41, 0.00, 0.23, 0.00, 0.00],
  12: [0.37, 0.37, 0.00, 0.21, 0.00, 0.00],
  13: [0.00, 0.34, 0.00, 0.00, 0.00, 0.00],
  14: [0.00, 0.31, 0.00, 0.00, 0.00, 0.00],
  15: [0.00, 0.28, 0.00, 0.00, 0.00, 0.00],
};

/** FM for a frequency (the table row at or above it), a duration and V. */
export function frequencyMultiplier(liftsPerMin: number, duration: Duration, verticalCm: number): number {
  const f = Number.isFinite(liftsPerMin) ? liftsPerMin : 0.2;
  if (f > 15) return 0;
  const row = FREQUENCIES.find(x => f <= x + 1e-9) ?? 15;
  const col = (duration === 'long' ? 4 : duration === 'moderate' ? 2 : 0) + (verticalCm >= 75 ? 1 : 0);
  return FM_TABLE[row][col];
}

/** CM: good 1.00; fair 0.95 below 75 cm and 1.00 from 75 cm; poor 0.90. Waters et al. 1993, Table 7 (from memory). */
export function couplingMultiplier(coupling: Coupling, verticalCm: number): number {
  if (coupling === 'poor') return 0.9;
  if (coupling === 'fair') return verticalCm < 75 ? 0.95 : 1.0;
  return 1.0;
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** The revised NIOSH lifting equation: RWL = LC × HM × VM × DM × AM × FM × CM, LC = 23 kg. */
export function calculateNioshLifting(input: NioshInput): NioshResult {
  const LC = 23;
  const H = input.horizontalDistanceCm, V = input.verticalOriginCm, D = input.verticalTravelDistanceCm, A = input.asymmetryAngleDeg;
  const outside: Factor[] = [];
  // HM = 25 / H, 1 below 25 cm, 0 beyond 63 cm.
  const HM = H > 63 ? 0 : H <= 25 ? 1 : 25 / H;
  if (HM === 0) outside.push('HM');
  // VM = 1 − 0.003 × |V − 75|, 0 above 175 cm.
  const VM = V < 0 || V > 175 ? 0 : 1 - 0.003 * Math.abs(V - 75);
  if (VM === 0) outside.push('VM');
  // DM = 0.82 + 4.5 / D, 1 below 25 cm, 0 beyond 175 cm.
  const DM = D > 175 ? 0 : D <= 25 ? 1 : 0.82 + 4.5 / D;
  if (DM === 0) outside.push('DM');
  // AM = 1 − 0.0032 × A, 0 beyond 135°.
  const AM = A > 135 || A < 0 ? 0 : 1 - 0.0032 * A;
  if (AM === 0) outside.push('AM');
  const FM = frequencyMultiplier(input.frequencyLiftsPerMin ?? 0.2, input.duration ?? 'short', V);
  if (FM === 0) outside.push('FM');
  const CM = couplingMultiplier(input.couplingQuality ?? 'good', V);
  const RWL = LC * HM * VM * DM * AM * FM * CM;
  const LI = RWL > 0 ? input.loadWeightKg / RWL : null;
  const riskCategory = LI === null ? 'outside' : LI > 3 ? 'high' : LI > 1 ? 'increased' : 'nominal';
  const factors: [Factor, number][] = [['HM', HM], ['VM', VM], ['DM', DM], ['AM', AM], ['FM', FM], ['CM', CM]];
  const lowest = factors.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
  return {
    loadConstantKg: LC,
    horizontalMultiplierHM: r3(HM),
    verticalMultiplierVM: r3(VM),
    distanceMultiplierDM: r3(DM),
    asymmetricMultiplierAM: r3(AM),
    frequencyMultiplierFM: FM,
    couplingMultiplierCM: CM,
    recommendedWeightLimitKg: Math.round(RWL * 10) / 10,
    liftingIndexLI: LI === null ? null : Math.round(LI * 100) / 100,
    riskCategory,
    outside,
    lowest,
  };
}

export interface SkeletalLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

/**
 * Experimental, used by no screen: H, V and A read from a 33-point MediaPipe pose, scaled by the person's height. Not
 * validated (no tape-measured lift compared yet); the 0.78 shoulder-to-ankle ratio and the 20 cm reach offset are
 * UNSOURCED. Returns null when the pose is missing, rather than fixed values (it returned 35, 75 and 0).
 */
export function extractNioshParametersFromLandmarks(
  landmarks: SkeletalLandmark[],
  userHeightCm = 175
): {
  horizontalDistanceCm: number;
  verticalOriginCm: number;
  asymmetryAngleDeg: number;
} | null {
  if (!landmarks || landmarks.length < 29) return null;

  // 11/12 = Shoulders, 15/16 = Wrists, 23/24 = Hips, 27/28 = Ankles
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  const midShoulder = {
    x: (leftShoulder.x + rightShoulder.x) / 2,
    y: (leftShoulder.y + rightShoulder.y) / 2,
  };
  const midWrist = {
    x: (leftWrist.x + rightWrist.x) / 2,
    y: (leftWrist.y + rightWrist.y) / 2,
    z: ((leftWrist.z || 0) + (rightWrist.z || 0)) / 2,
  };
  const midHip = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
    z: ((leftHip.z || 0) + (rightHip.z || 0)) / 2,
  };
  const midAnkle = {
    x: (leftAnkle.x + rightAnkle.x) / 2,
    y: (leftAnkle.y + rightAnkle.y) / 2,
    z: ((leftAnkle.z || 0) + (rightAnkle.z || 0)) / 2,
  };

  // Shoulder to ankle span in normalized image coordinate space (typically ~78% of stature)
  const verticalBodySpan = Math.abs(midAnkle.y - midShoulder.y);
  const pxToCm = (userHeightCm * 0.78) / Math.max(0.2, verticalBodySpan);

  // Vertical Origin (V): height of hands (midWrist) from the ankle floor line
  const rawVerticalCm = (midAnkle.y - midWrist.y) * pxToCm;
  const verticalOriginCm = Math.round(Math.max(10, Math.min(160, rawVerticalCm)));

  // Horizontal Reach (H): distance between midWrist and midAnkle in the horizontal ground/depth plane
  const dx = Math.abs(midWrist.x - midAnkle.x) * pxToCm;
  const dz = Math.abs((midWrist.z || 0) - (midAnkle.z || 0)) * pxToCm * 0.8;
  const rawHorizontalCm = Math.sqrt(dx * dx + dz * dz) + 20; // 20cm base offset from ankle center to neutral hand reach
  const horizontalDistanceCm = Math.round(Math.max(25, Math.min(63, rawHorizontalCm)));

  // Asymmetry Angle (A): rotational twist between hips and shoulders in the transverse plane
  const hipVectorX = rightHip.x - leftHip.x;
  const hipVectorZ = (rightHip.z || 0) - (leftHip.z || 0);
  const shoulderVectorX = rightShoulder.x - leftShoulder.x;
  const shoulderVectorZ = (rightShoulder.z || 0) - (leftShoulder.z || 0);

  const hipAngle = Math.atan2(hipVectorZ, hipVectorX);
  const shoulderAngle = Math.atan2(shoulderVectorZ, shoulderVectorX);
  let twistDeg = Math.round(Math.abs(shoulderAngle - hipAngle) * (180 / Math.PI));
  if (twistDeg > 90) twistDeg = 180 - twistDeg;
  const asymmetryAngleDeg = Math.max(0, Math.min(90, twistDeg));

  return {
    horizontalDistanceCm,
    verticalOriginCm,
    asymmetryAngleDeg,
  };
}

