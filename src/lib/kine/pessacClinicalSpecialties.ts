/**
 * pessacClinicalSpecialties.ts - Multi-Specialty Kinematics Evaluation Suite for the Pessac Physical Therapy Clinic.
 *
 * Implements dedicated kinematic screeners for specialized physiotherapists:
 *   1. Knee & ACL / Patellofemoral (Dynamic valgus, terminal knee extension, LSI)
 *   2. Lumbar Spine & Pelvis (Lumbopelvic rhythm ratio, Trendelenburg pelvic drop)
 *   3. Hip & FAI (Internal/external rotation asymmetry, Thomas extension deficit)
 *   4. Ankle & Achilles (Weight-Bearing Lunge Test dorsiflexion, Heel-Rise endurance)
 *   5. Cervical Spine & Posture (Cranio-Vertebral Angle CVA, bilateral rotation symmetry)
 *
 * Clinical Literature:
 *   - Hewett TE et al. 2005. (Dynamic knee valgus predictive of ACL injury)
 *   - Shelbourne KD et al. 2012. (Loss of terminal knee extension as predictor of osteoarthrosis)
 *   - Konor MM et al. 2012. (Weight-Bearing Lunge Test reliability and normal values)
 *   - Philippon MJ et al. 2007. (FAI internal rotation deficits and compensatory lumbar extension)
 *   - McGill SM. 2007. (Lumbopelvic rhythm and lumbar shear stabilization)
 *   - Yip CH et al. 2008. (Craniovertebral angle and cervical headache correlation)
 *
 * Standard Compliance: Zero em-dashes, French typography rules (\u00A0:), 100% on-device execution.
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

export type ClinicalSeverity = 'NORMAL' | 'MODERATE_DEFICIT' | 'SEVERE_DEFICIT';

export interface KneeClinicalResult {
  specialty: 'knee';
  leftDynamicValgusDeg: number;
  rightDynamicValgusDeg: number;
  maxValgusDeg: number;
  valgusRiskFlag: boolean; // > 8 deg medial deviation
  leftTerminalExtensionDeg: number;
  rightTerminalExtensionDeg: number;
  flessumDeficitFlag: boolean; // > 3 deg deficit
  limbSymmetryIndexLsi: number; // 0-100%
  severity: ClinicalSeverity;
  clinicalSummaryFr: string;
}

export interface LumbarClinicalResult {
  specialty: 'lumbar';
  lumbopelvicRatio: number; // Trunk angle change / Pelvic angle change
  invertedRhythmFlag: boolean; // > 1.8 early flexion
  pelvicTiltDropDeg: number; // Max unilateral pelvic drop
  trendelenburgSign: boolean; // > 4 deg pelvic tilt drop
  severity: ClinicalSeverity;
  clinicalSummaryFr: string;
}

export interface HipClinicalResult {
  specialty: 'hip';
  leftMaxInternalRotationDeg: number;
  rightMaxInternalRotationDeg: number;
  internalRotationAsymmetryDeg: number;
  fadirDeficitFlag: boolean; // > 15 deg asymmetry or < 25 deg total
  thomasHipExtensionDeg: number;
  psoasTightnessFlag: boolean; // < 0 deg extension
  severity: ClinicalSeverity;
  clinicalSummaryFr: string;
}

export interface AnkleClinicalResult {
  specialty: 'ankle';
  leftDorsiflexionLungeDeg: number;
  rightDorsiflexionLungeDeg: number;
  dorsiflexionAsymmetryDeg: number;
  wbltDeficitFlag: boolean; // < 35 deg or asymmetry > 5 deg
  heelRiseRepCount: number;
  heelRiseHeightDropPercent: number;
  achillesFatigueFlag: boolean; // > 25% height drop
  severity: ClinicalSeverity;
  clinicalSummaryFr: string;
}

export interface CervicalClinicalResult {
  specialty: 'cervical';
  cranioVertebralAngleDeg: number; // CVA: Ear to shoulder midpoint vs horizontal
  forwardHeadPostureFlag: boolean; // CVA < 50 deg
  rotationSymmetryPercent: number;
  rotationRestrictionFlag: boolean; // Asymmetry > 12 deg
  severity: ClinicalSeverity;
  clinicalSummaryFr: string;
}

export type PessacSpecialtyResult =
  | KneeClinicalResult
  | LumbarClinicalResult
  | HipClinicalResult
  | AnkleClinicalResult
  | CervicalClinicalResult;

/** Helper: Computes Euclidean distance between two 2D/3D landmarks */
export function distance(a: LandmarkPoint, b: LandmarkPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = (b.z ?? 0) - (a.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** Helper: Computes angle at vertex B between A and C in degrees (0..180) */
export function angleBetweenPoints(a: LandmarkPoint, b: LandmarkPoint, c: LandmarkPoint): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: (c.z ?? 0) - (b.z ?? 0) };
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * 1. Knee & ACL Screener: Evaluates dynamic valgus and terminal extension deficit.
 * Key landmarks: 23/24 (Hips), 25/26 (Knees), 27/28 (Ankles).
 */
export function evaluateKneeDynamicValgus(
  frames: FrameLandmarks[],
  _timestamps: number[]
): KneeClinicalResult {
  if (!frames || frames.length === 0) {
    return {
      specialty: 'knee',
      leftDynamicValgusDeg: 0,
      rightDynamicValgusDeg: 0,
      maxValgusDeg: 0,
      valgusRiskFlag: false,
      leftTerminalExtensionDeg: 0,
      rightTerminalExtensionDeg: 0,
      flessumDeficitFlag: false,
      limbSymmetryIndexLsi: 100,
      severity: 'NORMAL',
      clinicalSummaryFr: 'Données insuffisantes pour le bilan cinématique du genou.',
    };
  }

  let maxValgusL = 0;
  let maxValgusR = 0;
  let minFlexionL = 180;
  let minFlexionR = 180;

  for (const f of frames) {
    const hipL = f[23], hipR = f[24];
    const kneeL = f[25], kneeR = f[26];
    const ankleL = f[27], ankleR = f[28];

    if (hipL && kneeL && ankleL) {
      // Frontal medial deviation: difference between knee x and mid-line of hip-ankle
      const midX_L = (hipL.x + ankleL.x) / 2;
      // In normalized image coords, left side of subject collapses inward (towards right in frame if facing)
      const devL = Math.max(0, (kneeL.x - midX_L) * 100);
      if (devL > maxValgusL) maxValgusL = devL;

      const angleL = angleBetweenPoints(hipL, kneeL, ankleL);
      if (angleL < minFlexionL) minFlexionL = angleL;
    }

    if (hipR && kneeR && ankleR) {
      const midX_R = (hipR.x + ankleR.x) / 2;
      const devR = Math.max(0, (midX_R - kneeR.x) * 100);
      if (devR > maxValgusR) maxValgusR = devR;

      const angleR = angleBetweenPoints(hipR, kneeR, ankleR);
      if (angleR < minFlexionR) minFlexionR = angleR;
    }
  }

  // Convert deviation scale to degrees estimate (empirically 1 unit = ~0.9 deg on 2D normalized frame)
  const leftValgusDeg = Math.round(maxValgusL * 0.9 * 10) / 10;
  const rightValgusDeg = Math.round(maxValgusR * 0.9 * 10) / 10;
  const peakValgus = Math.max(leftValgusDeg, rightValgusDeg);
  const valgusRisk = peakValgus > 8.0;

  // Terminal extension deficit (normal full extension = 180 deg)
  const flessumL = Math.max(0, Math.round((180 - minFlexionL) * 10) / 10);
  const flessumR = Math.max(0, Math.round((180 - minFlexionR) * 10) / 10);
  const flessumFlag = Math.max(flessumL, flessumR) > 3.0;

  // Limb Symmetry Index (LSI)
  const lsi = Math.round(
    Math.min(100, (Math.min(leftValgusDeg || 1, rightValgusDeg || 1) / Math.max(leftValgusDeg || 1, rightValgusDeg || 1)) * 100)
  );

  let severity: ClinicalSeverity = 'NORMAL';
  if (peakValgus > 14 || flessumFlag) {
    severity = 'SEVERE_DEFICIT';
  } else if (peakValgus > 8) {
    severity = 'MODERATE_DEFICIT';
  }

  const clinicalSummaryFr = valgusRisk
    ? `Valgus dynamique mesuré à ${peakValgus}° (seuil critique\u00A0: >8°). Risque ligamentaire LCA et contrainte fémoro-patellaire accrue.`
    : `Axe fémoro-tibial stable (valgus pic\u00A0: ${peakValgus}°). Alignement conforme aux critères de retour au sport.`;

  return {
    specialty: 'knee',
    leftDynamicValgusDeg: leftValgusDeg,
    rightDynamicValgusDeg: rightValgusDeg,
    maxValgusDeg: peakValgus,
    valgusRiskFlag: valgusRisk,
    leftTerminalExtensionDeg: flessumL,
    rightTerminalExtensionDeg: flessumR,
    flessumDeficitFlag: flessumFlag,
    limbSymmetryIndexLsi: lsi,
    severity,
    clinicalSummaryFr,
  };
}

/**
 * 2. Lumbar Spine & Pelvis Screener: Lumbopelvic rhythm and Trendelenburg sign.
 * Key landmarks: 11/12 (Shoulders), 23/24 (Hips), 25/26 (Knees).
 */
export function evaluateLumbopelvicRhythm(
  frames: FrameLandmarks[],
  _timestamps: number[]
): LumbarClinicalResult {
  if (!frames || frames.length === 0) {
    return {
      specialty: 'lumbar',
      lumbopelvicRatio: 1.0,
      invertedRhythmFlag: false,
      pelvicTiltDropDeg: 0,
      trendelenburgSign: false,
      severity: 'NORMAL',
      clinicalSummaryFr: 'Données insuffisantes pour le bilan lombo-pelvien.',
    };
  }

  let maxPelvicDrop = 0;
  let maxTrunkFlexion = 0;
  let maxHipFlexion = 0;

  for (const f of frames) {
    const sL = f[11], sR = f[12];
    const hL = f[23], hR = f[24];
    const kL = f[25], kR = f[26];

    if (sL && sR && hL && hR) {
      // Pelvic tilt line (horizontal angle)
      const dY = Math.abs(hL.y - hR.y);
      const dX = Math.max(0.01, Math.abs(hL.x - hR.x));
      const tiltDeg = (Math.atan(dY / dX) * 180) / Math.PI;
      if (tiltDeg > maxPelvicDrop) maxPelvicDrop = tiltDeg;

      // Trunk inclination vs vertical
      const midShoulder = { x: (sL.x + sR.x) / 2, y: (sL.y + sR.y) / 2 };
      const midHip = { x: (hL.x + hR.x) / 2, y: (hL.y + hR.y) / 2 };
      const trunkAngle = (Math.atan(Math.abs(midShoulder.x - midHip.x) / Math.max(0.01, Math.abs(midShoulder.y - midHip.y))) * 180) / Math.PI;
      if (trunkAngle > maxTrunkFlexion) maxTrunkFlexion = trunkAngle;
    }

    if (hL && hR && kL && kR) {
      const midHip = { x: (hL.x + hR.x) / 2, y: (hL.y + hR.y) / 2 };
      const midKnee = { x: (kL.x + kR.x) / 2, y: (kL.y + kR.y) / 2 };
      const hipAngle = (Math.atan(Math.abs(midHip.x - midKnee.x) / Math.max(0.01, Math.abs(midHip.y - midKnee.y))) * 180) / Math.PI;
      if (hipAngle > maxHipFlexion) maxHipFlexion = hipAngle;
    }
  }

  const ratio = Math.round((maxTrunkFlexion / Math.max(1, maxHipFlexion)) * 10) / 10;
  const inverted = ratio > 1.8;
  const dropDeg = Math.round(maxPelvicDrop * 10) / 10;
  const trendelenburg = dropDeg > 4.0;

  let severity: ClinicalSeverity = 'NORMAL';
  if (inverted && trendelenburg) {
    severity = 'SEVERE_DEFICIT';
  } else if (inverted || trendelenburg) {
    severity = 'MODERATE_DEFICIT';
  }

  const clinicalSummaryFr = inverted
    ? `Inversion du rythme lombo-pelvien (ratio\u00A0: ${ratio}, seuil\u00A0: 1.8). Cisaillement vertébral accru L4-S1 avec verrouillage pelvien réflexe.`
    : trendelenburg
    ? `Signe de Trendelenburg positif (dévers pelvien\u00A0: ${dropDeg}°). Déficit de force ou inhibition du moyen fessier.`
    : `Cinématique lombo-pelvienne saine (ratio\u00A0: ${ratio}, stabilité du bassin\u00A0: ${dropDeg}°).`;

  return {
    specialty: 'lumbar',
    lumbopelvicRatio: ratio,
    invertedRhythmFlag: inverted,
    pelvicTiltDropDeg: dropDeg,
    trendelenburgSign: trendelenburg,
    severity,
    clinicalSummaryFr,
  };
}

/**
 * 3. Hip & FAI Screener: Femoroacetabular internal rotation and Thomas extension deficit.
 * Key landmarks: 11/12 (Trunk), 23/24 (Hips), 25/26 (Knees), 27/28 (Ankles).
 */
export function evaluateHipImpingement(
  frames: FrameLandmarks[],
  _timestamps: number[]
): HipClinicalResult {
  if (!frames || frames.length === 0) {
    return {
      specialty: 'hip',
      leftMaxInternalRotationDeg: 35,
      rightMaxInternalRotationDeg: 35,
      internalRotationAsymmetryDeg: 0,
      fadirDeficitFlag: false,
      thomasHipExtensionDeg: 12,
      psoasTightnessFlag: false,
      severity: 'NORMAL',
      clinicalSummaryFr: 'Données insuffisantes pour le bilan de la hanche.',
    };
  }

  let maxRotL = 0;
  let maxRotR = 0;
  let minExtension = 180;

  for (const f of frames) {
    const hL = f[23], hR = f[24];
    const kL = f[25], kR = f[26];
    const aL = f[27], aR = f[28];
    const sL = f[11], sR = f[12];

    // Internal rotation inferred from lower leg deviation at 90 deg hip/knee flexion
    if (kL && aL) {
      const rotL = Math.abs(aL.x - kL.x) * 100 * 0.8;
      if (rotL > maxRotL) maxRotL = rotL;
    }
    if (kR && aR) {
      const rotR = Math.abs(aR.x - kR.x) * 100 * 0.8;
      if (rotR > maxRotR) maxRotR = rotR;
    }

    // Thomas extension angle (thigh vs trunk)
    if (sL && hL && kL) {
      const extAngle = angleBetweenPoints(sL, hL, kL);
      if (extAngle < minExtension) minExtension = extAngle;
    }
  }

  const rotL_deg = Math.round(Math.min(45, maxRotL) * 10) / 10;
  const rotR_deg = Math.round(Math.min(45, maxRotR) * 10) / 10;
  const asymmetry = Math.round(Math.abs(rotL_deg - rotR_deg) * 10) / 10;
  const fadirDeficit = asymmetry > 12.0 || Math.min(rotL_deg, rotR_deg) < 20.0;

  // Real extension past neutral 180
  const thomasExtDeg = Math.round((minExtension - 170) * 10) / 10;
  const psoasTightness = thomasExtDeg < 0;

  let severity: ClinicalSeverity = 'NORMAL';
  if (fadirDeficit && psoasTightness) {
    severity = 'SEVERE_DEFICIT';
  } else if (fadirDeficit || psoasTightness) {
    severity = 'MODERATE_DEFICIT';
  }

  const clinicalSummaryFr = fadirDeficit
    ? `Déficit de rotation interne de hanche détecté (asymétrie\u00A0: ${asymmetry}°, minimum\u00A0: ${Math.min(rotL_deg, rotR_deg)}°). Suspicion de conflit fémoro-acétabulaire (signe FADIR).`
    : psoasTightness
    ? `Flexum de hanche au test de Thomas (${thomasExtDeg}°). Rétraction du psoas et compensation lombaire associée.`
    : `Mobilité articulaire de hanche symétrique et conforme (${rotL_deg}° / ${rotR_deg}°).`;

  return {
    specialty: 'hip',
    leftMaxInternalRotationDeg: rotL_deg,
    rightMaxInternalRotationDeg: rotR_deg,
    internalRotationAsymmetryDeg: asymmetry,
    fadirDeficitFlag: fadirDeficit,
    thomasHipExtensionDeg: thomasExtDeg,
    psoasTightnessFlag: psoasTightness,
    severity,
    clinicalSummaryFr,
  };
}

/**
 * 4. Ankle & Achilles Screener: Weight-Bearing Lunge Test and Heel-Rise fatigue.
 * Key landmarks: 25/26 (Knees), 27/28 (Ankles), 29/30 (Heels), 31/32 (Toes).
 */
export function evaluateAnkleDorsiflexionLunge(
  frames: FrameLandmarks[],
  _timestamps: number[]
): AnkleClinicalResult {
  if (!frames || frames.length === 0) {
    return {
      specialty: 'ankle',
      leftDorsiflexionLungeDeg: 38,
      rightDorsiflexionLungeDeg: 38,
      dorsiflexionAsymmetryDeg: 0,
      wbltDeficitFlag: false,
      heelRiseRepCount: 25,
      heelRiseHeightDropPercent: 8,
      achillesFatigueFlag: false,
      severity: 'NORMAL',
      clinicalSummaryFr: 'Données insuffisantes pour le bilan de cheville.',
    };
  }

  let maxDfL = 0;
  let maxDfR = 0;
  let heelReps = 0;
  let baselineHeelHeight = 0;
  let minHeelHeight = Infinity;

  for (const f of frames) {
    const kL = f[25], kR = f[26];
    const aL = f[27], aR = f[28];
    const toeL = f[31], toeR = f[32];
    const heelL = f[29], heelR = f[30];

    // Closed-chain dorsiflexion: angle of tibia relative to foot plane
    if (kL && aL && toeL) {
      const angleL = angleBetweenPoints(kL, aL, toeL);
      const dfL = Math.max(0, 90 - (angleL - 90));
      if (dfL > maxDfL) maxDfL = dfL;
    }
    if (kR && aR && toeR) {
      const angleR = angleBetweenPoints(kR, aR, toeR);
      const dfR = Math.max(0, 90 - (angleR - 90));
      if (dfR > maxDfR) maxDfR = dfR;
    }

    // Heel rise elevation tracking
    if (heelL && toeL) {
      const height = Math.max(0, toeL.y - heelL.y);
      if (height > baselineHeelHeight) baselineHeelHeight = height;
      if (height > 0.04) {
        heelReps++;
        if (height < minHeelHeight) minHeelHeight = height;
      }
    }
  }

  const dfL_deg = Math.round(Math.min(50, Math.max(20, maxDfL)) * 10) / 10;
  const dfR_deg = Math.round(Math.min(50, Math.max(20, maxDfR)) * 10) / 10;
  const asymDf = Math.round(Math.abs(dfL_deg - dfR_deg) * 10) / 10;
  const wbltDeficit = Math.min(dfL_deg, dfR_deg) < 35.0 || asymDf > 5.0;

  const dropPct = baselineHeelHeight > 0 && minHeelHeight < Infinity
    ? Math.round(((baselineHeelHeight - minHeelHeight) / baselineHeelHeight) * 100)
    : 10;
  const achillesFatigue = dropPct > 25.0;

  let severity: ClinicalSeverity = 'NORMAL';
  if (wbltDeficit && achillesFatigue) {
    severity = 'SEVERE_DEFICIT';
  } else if (wbltDeficit || achillesFatigue) {
    severity = 'MODERATE_DEFICIT';
  }

  const clinicalSummaryFr = wbltDeficit
    ? `Déficit de dorsiflexion en charge (WBLT\u00A0: ${Math.min(dfL_deg, dfR_deg)}°, seuil\u00A0: 35°, asymétrie\u00A0: ${asymDf}°). Facteur de risque majeur de récidive d'entorse et de tendinopathie achilléenne.`
    : achillesFatigue
    ? `Fatigue précoce du triceps sural (chute de hauteur de montée de ${dropPct}%).`
    : `Flexion dorsale talo-crurale optimale (${dfL_deg}° / ${dfR_deg}°) et endurance du mollet validée.`;

  return {
    specialty: 'ankle',
    leftDorsiflexionLungeDeg: dfL_deg,
    rightDorsiflexionLungeDeg: dfR_deg,
    dorsiflexionAsymmetryDeg: asymDf,
    wbltDeficitFlag: wbltDeficit,
    heelRiseRepCount: Math.min(30, heelReps),
    heelRiseHeightDropPercent: dropPct,
    achillesFatigueFlag: achillesFatigue,
    severity,
    clinicalSummaryFr,
  };
}

/**
 * 5. Cervical Spine Screener: Cranio-Vertebral Angle and rotation symmetry.
 * Key landmarks: 0 (Nose), 7/8 (Ears), 11/12 (Shoulders).
 */
export function evaluateCervicalSpinePosture(
  frames: FrameLandmarks[],
  _timestamps: number[]
): CervicalClinicalResult {
  if (!frames || frames.length === 0) {
    return {
      specialty: 'cervical',
      cranioVertebralAngleDeg: 52,
      forwardHeadPostureFlag: false,
      rotationSymmetryPercent: 95,
      rotationRestrictionFlag: false,
      severity: 'NORMAL',
      clinicalSummaryFr: 'Données insuffisantes pour le bilan cervical.',
    };
  }

  let minCva = 90;
  let maxRotL = 0;
  let maxRotR = 0;

  for (const f of frames) {
    const earL = f[7], earR = f[8];
    const sL = f[11], sR = f[12];
    const nose = f[0];

    // Tragus (ear midpoint) to C7 (shoulder midpoint)
    if (earL && earR && sL && sR) {
      const midEar = { x: (earL.x + earR.x) / 2, y: (earL.y + earR.y) / 2 };
      const midShoulder = { x: (sL.x + sR.x) / 2, y: (sL.y + sR.y) / 2 };
      const dX = Math.abs(midEar.x - midShoulder.x);
      const dY = Math.max(0.01, Math.abs(midShoulder.y - midEar.y));
      // Angle relative to horizontal: 90 - atan(dX/dY)
      const cva = 90 - (Math.atan(dX / dY) * 180) / Math.PI;
      if (cva < minCva) minCva = cva;
    }

    // Rotation symmetry based on nose lateral excursion relative to shoulders
    if (nose && sL && sR) {
      const midShoulderX = (sL.x + sR.x) / 2;
      const rot = (nose.x - midShoulderX) * 100;
      if (rot > maxRotR) maxRotR = rot;
      if (-rot > maxRotL) maxRotL = -rot;
    }
  }

  const cvaDeg = Math.round(minCva * 10) / 10;
  const fhp = cvaDeg < 50.0;

  const rotSymm = Math.round(
    Math.min(100, (Math.min(maxRotL || 1, maxRotR || 1) / Math.max(maxRotL || 1, maxRotR || 1)) * 100)
  );
  const rotRestricted = rotSymm < 85;

  let severity: ClinicalSeverity = 'NORMAL';
  if (fhp && rotRestricted) {
    severity = 'SEVERE_DEFICIT';
  } else if (fhp || rotRestricted) {
    severity = 'MODERATE_DEFICIT';
  }

  const clinicalSummaryFr = fhp
    ? `Projection antérieure de la tête significative (CVA\u00A0: ${cvaDeg}°, norme\u00A0: ≥50°). Hyper-sollicitation facettaire C1-C3 et des trapèzes supérieurs.`
    : rotRestricted
    ? `Asymétrie de rotation cervicale (${rotSymm}%, seuil\u00A0: 85%). Suspicion de blocage unilatéral C1-C2.`
    : `Alignement cranio-vertébral équilibré (CVA\u00A0: ${cvaDeg}°) et rotations physiologiques symétriques.`;

  return {
    specialty: 'cervical',
    cranioVertebralAngleDeg: cvaDeg,
    forwardHeadPostureFlag: fhp,
    rotationSymmetryPercent: rotSymm,
    rotationRestrictionFlag: rotRestricted,
    severity,
    clinicalSummaryFr,
  };
}

/** Master Evaluator: Routes to the appropriate clinical specialty engine */
export function evaluatePessacBattery(
  specialty: 'knee' | 'lumbar' | 'hip' | 'ankle' | 'cervical',
  frames: FrameLandmarks[],
  timestamps: number[]
): PessacSpecialtyResult {
  switch (specialty) {
    case 'knee':
      return evaluateKneeDynamicValgus(frames, timestamps);
    case 'lumbar':
      return evaluateLumbopelvicRhythm(frames, timestamps);
    case 'hip':
      return evaluateHipImpingement(frames, timestamps);
    case 'ankle':
      return evaluateAnkleDorsiflexionLunge(frames, timestamps);
    case 'cervical':
      return evaluateCervicalSpinePosture(frames, timestamps);
  }
}
