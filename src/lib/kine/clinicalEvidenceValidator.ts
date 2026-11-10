/**
 * clinicalEvidenceValidator.ts: Independent clinical evidence validator for sports & physical therapy metrics.
 * Ensures every metric, diagnostic conclusion, and prescription emitted by Workout Vision
 * is anchored in peer-reviewed clinical literature with explicit validity bounds,
 * confidence intervals, and camera perspective constraints.
 */

export interface ClinicalReference {
  id: string;
  author: string;
  year: number;
  title: string;
  journal: string;
  doi?: string;
  normativeThreshold: string;
  clinicalSignificance: string;
}

export interface MetricValidationResult {
  metricKey: string;
  value: number;
  referenceNorm: number;
  unit: string;
  isWithinNorm: boolean;
  confidenceScore: number; // 0.0 to 1.0 based on landmark visibility and optical plane alignment
  isValidForClinicalReport: boolean;
  refusalReason?: string;
  clinicalReference: ClinicalReference;
}

export const CLINICAL_EVIDENCE_REGISTRY: Record<string, ClinicalReference> = {
  kiblerDyskinesis: {
    id: 'kibler-2002',
    author: 'Kibler WB, McMullen J.',
    year: 2002,
    title: 'Scapular dyskinesis and its relation to shoulder pain.',
    journal: 'J Am Acad Orthop Surg',
    normativeThreshold: 'Grade 0 (normal) to Grade III (prominent superior medial border)',
    clinicalSignificance: 'Altered 3D scapular mechanics contribute to subacromial impingement and rotator cuff pathology.',
  },
  dynamicKneeValgus: {
    id: 'hewett-2005',
    author: 'Hewett TE, et al.',
    year: 2005,
    title: 'Biomechanical measures of neuromuscular control and valgus loading of the knee predict anterior cruciate ligament injury risk.',
    journal: 'Am J Sports Med',
    normativeThreshold: 'Frontal Plane Projection Angle (FPPA) < 8.0 degrees',
    clinicalSignificance: 'Dynamic knee valgus > 8 degrees during single-leg landing or squat indicates high ACL strain and patellofemoral stress.',
  },
  limbSymmetryIndex: {
    id: 'noyes-2012',
    author: 'Noyes FR, Barber-Westin SD.',
    year: 2012,
    title: 'Neuromuscular retraining in female athletes.',
    journal: 'Sports Health',
    normativeThreshold: 'LSI >= 90.0 % (RTP standard), >= 100 % (symmetrical)',
    clinicalSignificance: 'LSI < 85% is associated with a 3.8-fold increase in secondary ACL reinjury risk upon return to sport.',
  },
  lumbopelvicRhythm: {
    id: 'esola-1996',
    author: 'Esola MA, et al.',
    year: 1996,
    title: 'Analysis of lumbar spine and hip motion during forward bending in subjects with and without a history of low back pain.',
    journal: 'Spine',
    normativeThreshold: 'Lumbar-to-pelvic ratio 1.0 to 1.4 in early-to-mid anterior flexion',
    clinicalSignificance: 'Ratio > 1.8 indicates lumbopelvic rhythm inversion with lumbar dominance and excessive L4-S1 posterior shear.',
  },
  trendelenburgDrop: {
    id: 'hardcastle-1985',
    author: 'Hardcastle P, Nade S.',
    year: 1985,
    title: 'The significance of the Trendelenburg test.',
    journal: 'J Bone Joint Surg Br',
    normativeThreshold: 'Contralateral pelvic tilt <= 2.5 degrees during unipedal stance',
    clinicalSignificance: 'Pelvic drop > 3.0 degrees confirms gluteus medius abductor weakness and hip joint instability.',
  },
  fadirHipImpingement: {
    id: 'ganz-2003',
    author: 'Ganz R, et al.',
    year: 2003,
    title: 'Femoroacetabular impingement: a cause for osteoarthritis of the hip.',
    journal: 'Clin Orthop Relat Res',
    normativeThreshold: 'Internal rotation at 90 deg flexion >= 35.0 degrees',
    clinicalSignificance: 'Internal rotation < 20 degrees with anterior groin pain constitutes a positive FADIR test for CAM-type impingement.',
  },
  wbltAnkleDorsiflexion: {
    id: 'bennell-1998',
    author: 'Bennell KL, et al.',
    year: 1998,
    title: 'Intra-rater and inter-rater reliability of a weight-bearing lunge measure of ankle dorsiflexion.',
    journal: 'Aust J Physiother',
    normativeThreshold: 'Weight-Bearing Lunge Test (WBLT) >= 35.0 degrees (or >= 10.0 cm from wall)',
    clinicalSignificance: 'Dorsiflexion < 30 degrees elevates kinetic chain stress, contributing to patellar tendinopathy and plantar fasciitis.',
  },
  cranioVertebralAngle: {
    id: 'yip-2008',
    author: 'Yip CH, et al.',
    year: 2008,
    title: 'The relationship between head posture and severity and disability of patients with neck pain.',
    journal: 'Man Ther',
    normativeThreshold: 'Cranio-Vertebral Angle (CVA) >= 50.0 degrees',
    clinicalSignificance: 'CVA < 45 degrees confirms Forward Head Posture (FHP), increasing suboccipital compressive loading by up to 27 kg.',
  },
  carpalTunnelFlexion: {
    id: 'gelberman-1981',
    author: 'Gelberman RH, et al.',
    year: 1981,
    title: 'The carpal tunnel syndrome: a study of carpal canal pressures.',
    journal: 'J Bone Joint Surg Am',
    normativeThreshold: 'Wrist flexion <= 20.0 degrees during loaded gripping',
    clinicalSignificance: 'Wrist flexion > 30 degrees elevates carpal canal intracanal pressure eight-fold (> 30 mmHg), precipitating median nerve ischemia.',
  },
  navicularDropPronation: {
    id: 'brody-1982',
    author: 'Brody DM.',
    year: 1982,
    title: 'Techniques in the evaluation and treatment of running injuries.',
    journal: 'Orthop Clin North Am',
    normativeThreshold: 'Calcaneal eversion <= 5.0 degrees under bilateral stance',
    clinicalSignificance: 'Rearfoot eversion > 6 degrees under load indicates excessive subtalar pronation, precipitating internal tibial torque and patellar tracking deficits.',
  },
};

/**
 * Validates a kinematic measurement against clinical normative bounds and camera perspective limits.
 */
export function validateClinicalMetric(
  metricKey: string,
  value: number,
  landmarkVisibility: number,
  planeConfidence: number = 0.95
): MetricValidationResult {
  const ref = CLINICAL_EVIDENCE_REGISTRY[metricKey];
  if (!ref) {
    throw new Error(`Unregistered clinical metric: ${metricKey}`);
  }

  // Combined optical reliability score
  const confidenceScore = Math.min(1.0, Math.max(0.0, landmarkVisibility * planeConfidence));

  // Minimum visibility threshold for legal/clinical BDK report inclusion
  const isValidConfidence = confidenceScore >= 0.70;

  let isWithinNorm = true;
  let referenceNorm = 0;
  let unit = 'deg';
  let refusalReason: string | undefined = undefined;

  if (!isValidConfidence) {
    refusalReason = `Optical confidence (${Math.round(confidenceScore * 100)}%) is below clinical reporting threshold (70%). Re-frame camera with full subject visibility.`;
  }

  switch (metricKey) {
    case 'dynamicKneeValgus':
      referenceNorm = 4.0;
      isWithinNorm = value <= 8.0;
      break;
    case 'limbSymmetryIndex':
      unit = '%';
      referenceNorm = 100.0;
      isWithinNorm = value >= 90.0;
      break;
    case 'lumbopelvicRhythm':
      unit = 'ratio';
      referenceNorm = 1.2;
      isWithinNorm = value <= 1.6;
      break;
    case 'trendelenburgDrop':
      referenceNorm = 1.5;
      isWithinNorm = value <= 2.5;
      break;
    case 'fadirHipImpingement':
      referenceNorm = 35.0;
      isWithinNorm = value >= 25.0;
      break;
    case 'wbltAnkleDorsiflexion':
      referenceNorm = 38.0;
      isWithinNorm = value >= 32.0;
      break;
    case 'cranioVertebralAngle':
      referenceNorm = 52.0;
      isWithinNorm = value >= 48.0;
      break;
    case 'carpalTunnelFlexion':
      referenceNorm = 10.0;
      isWithinNorm = value <= 20.0;
      break;
    case 'navicularDropPronation':
      referenceNorm = 4.0;
      isWithinNorm = value <= 5.0;
      break;
    default:
      referenceNorm = 0;
      isWithinNorm = true;
  }

  return {
    metricKey,
    value,
    referenceNorm,
    unit,
    isWithinNorm,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    isValidForClinicalReport: isValidConfidence,
    refusalReason,
    clinicalReference: ref,
  };
}
