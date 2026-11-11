/**
 * shoulderDyskinesis.ts: Clinical shoulder and scapular dyskinesis evaluation engine.
 *
 * Implements optical kinematic deduction of scapulothoracic rhythm alterations,
 * McClure Scapular Dyskinesis Test (SDT 2009), bilateral asymmetry analysis (Bishop 2018),
 * and compensatory trunk adaptations.
 *
 * Clinical literature:
 *   - Inman VT, Saunders JB, Abbott LC. 1944. (Scapulohumeral rhythm 2:1 ratio)
 *   - McClure P, Tate AR et al. 2009. (Scapular Dyskinesis Test protocol, eccentric phase reliability)
 *   - Kibler WB, Sciascia A, Wilkes T. 2012. (Classification of scapular dyskinesis types I-IV)
 *   - Cools AM et al. 2014. (Rehabilitation of scapular dyskinesis)
 *   - Bishop C et al. 2018. (Standardizing asymmetry index formulas)
 *   - Kiesel K et al. 2007. (Asymmetry >15% threshold for musculoskeletal injury risk)
 */

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface FrameLandmarks {
  [index: number]: LandmarkPoint;
  length?: number;
}

export type DyskinesisSeverity = 'NORMAL' | 'SUBTLE' | 'OBVIOUS';

export interface ShrugSignResult {
  detected: boolean;
  leftHikeRatio: number;
  rightHikeRatio: number;
  hikeAngleDegLeft: number | null;
  hikeAngleDegRight: number | null;
  clinicalNoteFr: string;
}

export interface AsymmetryResult {
  asiPercent: number;
  leftPeakRom: number;
  rightPeakRom: number;
  dominantDeficitSide: 'left' | 'right' | 'symmetric';
  isClinicallySignificant: boolean; // >15%
}

export interface EccentricControlResult {
  leftSmoothnessScore: number; // 0-100
  rightSmoothnessScore: number; // 0-100
  leftDropDetected: boolean;
  rightDropDetected: boolean;
  leftDropAngleDeg: number | null;
  rightDropAngleDeg: number | null;
  clinicalNoteFr: string;
}

export interface TrunkCompensationResult {
  maxLateralLeanDeg: number;
  lateralLeanSide: 'left' | 'right' | 'neutral';
  isCompensating: boolean; // >5 deg
  clinicalNoteFr: string;
}

export interface ClinicalDeductionHypothesis {
  id: string;
  titleFr: string;
  severity: 'info' | 'warning' | 'alert';
  descriptionFr: string;
  evidenceFr: string;
}

export interface ScapularEvaluationReport {
  timestamp: number;
  durationSeconds: number;
  sampleCount: number;
  classification: DyskinesisSeverity;
  shrugSign: ShrugSignResult;
  asymmetry: AsymmetryResult;
  eccentricControl: EccentricControlResult;
  trunkCompensation: TrunkCompensationResult;
  hypotheses: ClinicalDeductionHypothesis[];
  angleTimeSeries: {
    timestamps: number[];
    leftAngles: number[];
    rightAngles: number[];
    trunkAngles: number[];
  };
}

/**
 * Computes 3D angle formed by three spatial points (B is vertex).
 */
export function calculate3DAngle(
  a: LandmarkPoint | undefined,
  b: LandmarkPoint | undefined,
  c: LandmarkPoint | undefined
): number | null {
  if (!a || !b || !c) return null;
  if ((a.visibility ?? 1) < 0.4 || (b.visibility ?? 1) < 0.4 || (c.visibility ?? 1) < 0.4) return null;

  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v1z = (a.z ?? 0) - (b.z ?? 0);

  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const v2z = (c.z ?? 0) - (b.z ?? 0);

  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);

  if (mag1 < 1e-6 || mag2 < 1e-6) return null;
  const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.round((Math.acos(cosTheta) * 180) / Math.PI);
}

/**
 * Analyzes full video landmarks stream for bilateral scapular dyskinesis.
 */
export function evaluateScapularDyskinesis(
  landmarksSeq: FrameLandmarks[],
  timestamps: number[]
): ScapularEvaluationReport | null {
  if (!landmarksSeq || landmarksSeq.length < 15 || !timestamps || timestamps.length !== landmarksSeq.length) {
    return null;
  }

  const N = landmarksSeq.length;
  const timeSeries = {
    timestamps: [] as number[],
    leftAngles: [] as number[],
    rightAngles: [] as number[],
    trunkAngles: [] as number[],
  };

  const leftEarSep: number[] = [];
  const rightEarSep: number[] = [];

  for (let i = 0; i < N; i++) {
    const lm = landmarksSeq[i];
    const t = timestamps[i];
    if (!lm) continue;

    // MediaPipe points:
    // 7/8: Ears, 11/12: Shoulders, 13/14: Elbows, 23/24: Hips
    const earL = lm[7], earR = lm[8];
    const shL = lm[11], shR = lm[12];
    const elL = lm[13], elR = lm[14];
    const hipL = lm[23], hipR = lm[24];

    // Compute shoulder abduction/elevation angle (Hip - Shoulder - Elbow)
    const angL = calculate3DAngle(hipL, shL, elL) ?? 0;
    const angR = calculate3DAngle(hipR, shR, elR) ?? 0;

    // Torso vector and trunk angle relative to vertical
    let trunkLean = 0;
    if (shL && shR && hipL && hipR) {
      const midShoulderX = (shL.x + shR.x) / 2;
      const midShoulderY = (shL.y + shR.y) / 2;
      const midHipX = (hipL.x + hipR.x) / 2;
      const midHipY = (hipL.y + hipR.y) / 2;
      const dx = midShoulderX - midHipX;
      const dy = midShoulderY - midHipY; // in MediaPipe Y points downward
      // Angle from true vertical (dy is negative when shoulder is above hip)
      trunkLean = Math.round((Math.atan2(dx, -dy) * 180) / Math.PI);
    }

    // Ear-to-shoulder vertical separation (MediaPipe Y is positive downwards, so sh.y - ear.y > 0)
    let sepL = 0, sepR = 0;
    if (shL && earL && (shL.visibility ?? 1) > 0.4 && (earL.visibility ?? 1) > 0.4) {
      sepL = shL.y - earL.y;
    }
    if (shR && earR && (shR.visibility ?? 1) > 0.4 && (earR.visibility ?? 1) > 0.4) {
      sepR = shR.y - earR.y;
    }

    timeSeries.timestamps.push(t);
    timeSeries.leftAngles.push(angL);
    timeSeries.rightAngles.push(angR);
    timeSeries.trunkAngles.push(trunkLean);
    leftEarSep.push(sepL);
    rightEarSep.push(sepR);
  }

  // 1. Asymmetry Index (Bishop 2018)
  const leftPeakRom = Math.max(...timeSeries.leftAngles, 0);
  const rightPeakRom = Math.max(...timeSeries.rightAngles, 0);
  const maxRom = Math.max(leftPeakRom, rightPeakRom);
  const asiPercent = maxRom > 10
    ? Math.round((Math.abs(leftPeakRom - rightPeakRom) / maxRom) * 1000) / 10
    : 0;

  let dominantDeficitSide: 'left' | 'right' | 'symmetric' = 'symmetric';
  if (asiPercent >= 8) {
    dominantDeficitSide = leftPeakRom < rightPeakRom ? 'left' : 'right';
  }
  const isClinicallySignificant = asiPercent > 15;

  // 2. Shrug Sign / Trapezius Hiking Detection
  // Baseline is taken over early frames where arm is below 30 deg
  let baseSepL = 0, baseSepCountL = 0;
  let baseSepR = 0, baseSepCountR = 0;
  for (let i = 0; i < N; i++) {
    if (timeSeries.leftAngles[i] < 30 && leftEarSep[i] > 0.05) {
      baseSepL += leftEarSep[i];
      baseSepCountL++;
    }
    if (timeSeries.rightAngles[i] < 30 && rightEarSep[i] > 0.05) {
      baseSepR += rightEarSep[i];
      baseSepCountR++;
    }
  }
  const meanBaseSepL = baseSepCountL > 0 ? baseSepL / baseSepCountL : 0.15;
  const meanBaseSepR = baseSepCountR > 0 ? baseSepR / baseSepCountR : 0.15;

  let minSepL = meanBaseSepL;
  let hikeAngleL: number | null = null;
  let minSepR = meanBaseSepR;
  let hikeAngleR: number | null = null;

  for (let i = 0; i < N; i++) {
    // Shrug sign occurs predominantly before 60 degrees of abduction
    if (timeSeries.leftAngles[i] >= 20 && timeSeries.leftAngles[i] <= 60 && leftEarSep[i] > 0) {
      if (leftEarSep[i] < minSepL) {
        minSepL = leftEarSep[i];
        hikeAngleL = timeSeries.leftAngles[i];
      }
    }
    if (timeSeries.rightAngles[i] >= 20 && timeSeries.rightAngles[i] <= 60 && rightEarSep[i] > 0) {
      if (rightEarSep[i] < minSepR) {
        minSepR = rightEarSep[i];
        hikeAngleR = timeSeries.rightAngles[i];
      }
    }
  }

  const leftHikeRatio = meanBaseSepL > 0 ? Math.max(0, (meanBaseSepL - minSepL) / meanBaseSepL) : 0;
  const rightHikeRatio = meanBaseSepR > 0 ? Math.max(0, (meanBaseSepR - minSepR) / meanBaseSepR) : 0;
  const shrugDetected = leftHikeRatio >= 0.20 || rightHikeRatio >= 0.20;

  let shrugNote = 'Aucun haussement prématuré du trapèze détecté.';
  if (shrugDetected) {
    const side = leftHikeRatio > rightHikeRatio ? 'gauche' : 'droit';
    const pct = Math.round(Math.max(leftHikeRatio, rightHikeRatio) * 100);
    shrugNote = `Haussement compensateur significatif du côté ${side} (${pct}\u00A0% de tassement avant 60°).`;
  }

  const shrugSign: ShrugSignResult = {
    detected: shrugDetected,
    leftHikeRatio: Math.round(leftHikeRatio * 100) / 100,
    rightHikeRatio: Math.round(rightHikeRatio * 100) / 100,
    hikeAngleDegLeft: hikeAngleL,
    hikeAngleDegRight: hikeAngleR,
    clinicalNoteFr: shrugNote,
  };

  // 3. Eccentric Phase Drop & Dysrhythmia Analysis (120 deg to 60 deg descent)
  // Locate peak index for left and right
  const maxIdxL = timeSeries.leftAngles.indexOf(leftPeakRom);
  const maxIdxR = timeSeries.rightAngles.indexOf(rightPeakRom);

  const evalEccentric = (angles: number[], startIdx: number) => {
    let drops = 0;
    let dropAngle: number | null = null;
    let jerks = 0;
    let countedSamples = 0;

    for (let i = startIdx; i < angles.length - 1; i++) {
      const aCurrent = angles[i];
      const aNext = angles[i + 1];
      const dt = timestamps[i + 1] - timestamps[i];
      if (dt <= 0) continue;

      // Inside critical eccentric test window (120 deg down to 60 deg)
      if (aCurrent <= 125 && aCurrent >= 55) {
        countedSamples++;
        const speed = (aCurrent - aNext) / dt; // positive during descent
        // Sudden drop: descending faster than 250 deg/sec
        if (speed > 250) {
          drops++;
          if (dropAngle === null) dropAngle = aCurrent;
        }
        // Hesitation or reversal (stuttering)
        if (speed < -15) {
          jerks++;
        }
      }
    }

    const dropDetected = drops > 0;
    const penalty = drops * 25 + jerks * 15;
    const smoothness = Math.max(20, Math.min(100, 100 - penalty));
    return { dropDetected, dropAngle, smoothness };
  };

  const eccL = evalEccentric(timeSeries.leftAngles, maxIdxL);
  const eccR = evalEccentric(timeSeries.rightAngles, maxIdxR);

  let eccNote = 'Descente excentrique symétrique et progressive.';
  if (eccL.dropDetected || eccR.dropDetected) {
    const side = eccL.dropDetected ? 'gauche' : 'droit';
    eccNote = `Décrochage excentrique détecté sur l’épaule ${side} lors de la descente entre 120° et 60°.`;
  }

  const eccentricControl: EccentricControlResult = {
    leftSmoothnessScore: eccL.smoothness,
    rightSmoothnessScore: eccR.smoothness,
    leftDropDetected: eccL.dropDetected,
    rightDropDetected: eccR.dropDetected,
    leftDropAngleDeg: eccL.dropAngle,
    rightDropAngleDeg: eccR.dropAngle,
    clinicalNoteFr: eccNote,
  };

  // 4. Trunk Compensation (Lateral Lean)
  let maxLean = 0;
  let leanSide: 'left' | 'right' | 'neutral' = 'neutral';
  for (const ang of timeSeries.trunkAngles) {
    if (Math.abs(ang) > Math.abs(maxLean)) {
      maxLean = ang;
      leanSide = ang > 0 ? 'right' : 'left';
    }
  }
  const isCompensating = Math.abs(maxLean) > 5;
  const trunkNote = isCompensating
    ? `Inclinaison latérale compensatrice du tronc (${Math.abs(maxLean)}°) vers la ${leanSide === 'right' ? 'droite' : 'gauche'}.`
    : 'Tronc stable sans compensation axiale significative.';

  const trunkCompensation: TrunkCompensationResult = {
    maxLateralLeanDeg: Math.abs(maxLean),
    lateralLeanSide: leanSide,
    isCompensating,
    clinicalNoteFr: trunkNote,
  };

  // 5. Synthesis & Clinical Hypotheses
  const hypotheses: ClinicalDeductionHypothesis[] = [];

  if (shrugDetected) {
    hypotheses.push({
      id: 'SUPRASPINATUS_IMPINGEMENT',
      titleFr: 'Suspicion d’inhibition ou conflit du supra-épineux',
      severity: 'alert',
      descriptionFr: 'Haussement réflexe du moignon de l’épaule avant 60° pour suppléer le couple de coaptation de la coiffe.',
      evidenceFr: `Tassement oreille-acromion supérieur au seuil critique de 20\u00A0% (ratio\u00A0: ${Math.round(Math.max(leftHikeRatio, rightHikeRatio) * 100)}\u00A0%).`,
    });
  }

  if (eccL.dropDetected || eccR.dropDetected) {
    hypotheses.push({
      id: 'SERRATUS_ANTERIOR_DEFICIT',
      titleFr: 'Dysrythmie excentrique / Suspicion dentelé antérieur',
      severity: 'alert',
      descriptionFr: 'Perte de contrôle de la sonnette interne lors de la phase descendante (Scapular Dyskinesis Test de McClure).',
      evidenceFr: 'Rupture de la vitesse angulaire et décrochage brutal entre 120° et 60°.',
    });
  }

  if (isClinicallySignificant) {
    hypotheses.push({
      id: 'CAPSULAR_RESTRICTION',
      titleFr: 'Asymétrie d’amplitude cliniquement significative',
      severity: 'warning',
      descriptionFr: 'Déficit unilatéral d’élévation active pouvant évoquer une rétraction capsulaire ou un enraidissement postural.',
      evidenceFr: `Indice d’asymétrie bilatérale (ASI) de ${asiPercent}\u00A0% (seuil de Kiesel >15\u00A0%). Côté déficitaire\u00A0: ${dominantDeficitSide}.`,
    });
  }

  if (isCompensating) {
    hypotheses.push({
      id: 'TRUNK_COMPENSATION',
      titleFr: 'Compensation motrice axiale du tronc',
      severity: 'info',
      descriptionFr: 'Déviation latérale du rachis pour masquer un déficit d’abduction pure en fin de course.',
      evidenceFr: `Inclinaison latérale maximale de ${Math.abs(maxLean)}° observée lors de l’élévation.`,
    });
  }

  // 6. Overall McClure Severity Rating
  let classification: DyskinesisSeverity = 'NORMAL';
  const alertCount = hypotheses.filter(h => h.severity === 'alert').length;
  const warningCount = hypotheses.filter(h => h.severity === 'warning').length;

  if (alertCount >= 1 || (warningCount >= 1 && (eccL.dropDetected || eccR.dropDetected))) {
    classification = 'OBVIOUS';
  } else if (warningCount >= 1 || shrugDetected || isCompensating) {
    classification = 'SUBTLE';
  }

  const durationSeconds = timestamps[N - 1] - timestamps[0];

  return {
    timestamp: Date.now(),
    durationSeconds: Math.round(durationSeconds * 10) / 10,
    sampleCount: N,
    classification,
    shrugSign,
    asymmetry: {
      asiPercent,
      leftPeakRom,
      rightPeakRom,
      dominantDeficitSide,
      isClinicallySignificant,
    },
    eccentricControl,
    trunkCompensation,
    hypotheses,
    angleTimeSeries: timeSeries,
  };
}

export interface ScapularPlaneAnalysis {
  scapularStabilityIndex: number;
  verdict: 'optimal' | 'mild_dyskinesis' | 'critical_dyskinesis';
  classification: DyskinesisSeverity;
  shrugDetected: boolean;
  eccentricDropDetected: boolean;
  asymmetryPercent: number;
  dominantDeficitSide: 'left' | 'right' | 'symmetric';
  cueFr: string;
  cueEn: string;
  report: ScapularEvaluationReport;
}

export function isScapularRelevantLift(lift?: string): boolean {
  if (!lift) return false;
  const l = lift.toLowerCase();
  return (
    l.includes('press') ||
    l.includes('overhead') ||
    l.includes('shoulder') ||
    l.includes('raise') ||
    l.includes('pull_up') ||
    l.includes('chin_up') ||
    l.includes('scaption') ||
    l.includes('arnold') ||
    l.includes('push_up') ||
    l.includes('row') ||
    l.includes('pulldown') ||
    l.includes('kine') ||
    l.includes('bilan')
  );
}

export function analyzeScapularPlane(
  landmarks: FrameLandmarks[],
  timestamps?: number[] | null,
  options?: { lift?: string; sampleRateFps?: number }
): ScapularPlaneAnalysis | null {
  if (!landmarks || landmarks.length < 15) return null;
  const ts =
    timestamps && timestamps.length === landmarks.length
      ? timestamps
      : landmarks.map((_, i) => i * (1 / (options?.sampleRateFps || 30)));

  const report = evaluateScapularDyskinesis(landmarks, ts);
  if (!report) return null;

  const penalty =
    (report.shrugSign.detected ? 25 : 0) +
    (report.eccentricControl.leftDropDetected || report.eccentricControl.rightDropDetected ? 30 : 0) +
    (report.asymmetry.isClinicallySignificant ? 20 : 0) +
    (report.trunkCompensation.isCompensating ? 15 : 0);
  const scapularStabilityIndex = Math.max(15, Math.min(100, 100 - penalty));

  let verdict: 'optimal' | 'mild_dyskinesis' | 'critical_dyskinesis' = 'optimal';
  if (scapularStabilityIndex < 70 || report.classification === 'OBVIOUS') {
    verdict = 'critical_dyskinesis';
  } else if (scapularStabilityIndex < 85 || report.classification === 'SUBTLE') {
    verdict = 'mild_dyskinesis';
  }

  let cueFr = 'Rythme scapulo-thoracique fluide\u00A0: élévation stable dans le plan scapulaire.';
  let cueEn = 'Fluid scapulothoracic rhythm: stable elevation in the scapular plane.';

  if (report.shrugSign.detected) {
    const side = report.shrugSign.leftHikeRatio > report.shrugSign.rightHikeRatio ? 'gauche' : 'droit';
    cueFr = `Haussement prématuré du trapèze (${side})\u00A0: abaissez les épaules au démarrage.`;
    cueEn = `Premature trapezius shrug (${side === 'gauche' ? 'left' : 'right'}): depress shoulders at drive start.`;
  } else if (report.eccentricControl.leftDropDetected || report.eccentricControl.rightDropDetected) {
    cueFr = 'Décrochage excentrique détecté\u00A0: freinez la descente sans rupture de tension.';
    cueEn = 'Eccentric drop detected: control lowering phase smoothly without tension loss.';
  } else if (report.asymmetry.isClinicallySignificant) {
    const sideFr = report.asymmetry.dominantDeficitSide === 'left' ? 'gauche' : 'droit';
    const sideEn = report.asymmetry.dominantDeficitSide === 'left' ? 'left' : 'right';
    cueFr = `Asymétrie scapulaire (${report.asymmetry.asiPercent}\u00A0%)\u00A0: déficit d’amplitude côté ${sideFr}.`;
    cueEn = `Scapular asymmetry (${report.asymmetry.asiPercent}%): elevation amplitude deficit on ${sideEn} side.`;
  } else if (report.trunkCompensation.isCompensating) {
    cueFr = 'Compensation axiale du tronc\u00A0: maintenez le buste vertical sans inclinaison.';
    cueEn = 'Axial trunk compensation: maintain vertical torso without lateral tilt.';
  }

  return {
    scapularStabilityIndex,
    verdict,
    classification: report.classification,
    shrugDetected: report.shrugSign.detected,
    eccentricDropDetected:
      report.eccentricControl.leftDropDetected || report.eccentricControl.rightDropDetected,
    asymmetryPercent: report.asymmetry.asiPercent,
    dominantDeficitSide: report.asymmetry.dominantDeficitSide,
    cueFr,
    cueEn,
    report,
  };
}
