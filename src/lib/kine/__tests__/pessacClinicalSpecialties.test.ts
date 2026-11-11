import { describe, it, expect } from 'vitest';
import {
  evaluateKneeDynamicValgus,
  evaluateLumbopelvicRhythm,
  evaluateHipImpingement,
  evaluateAnkleDorsiflexionLunge,
  evaluateCervicalSpinePosture,
  evaluatePessacBattery,
  FrameLandmarks,
} from '../pessacClinicalSpecialties';

describe('Pessac Multi-Specialty Kinematics Engine', () => {
  it('evaluates Knee & ACL kinematics and detects excessive dynamic valgus', () => {
    // Normal knee tracking
    const normalFrames: FrameLandmarks[] = [
      {
        23: { x: 0.45, y: 0.5 },
        24: { x: 0.55, y: 0.5 },
        25: { x: 0.45, y: 0.7 },
        26: { x: 0.55, y: 0.7 },
        27: { x: 0.45, y: 0.9 },
        28: { x: 0.55, y: 0.9 },
      },
    ];
    const normalRes = evaluateKneeDynamicValgus(normalFrames, [0]);
    expect(normalRes.valgusRiskFlag).toBe(false);
    expect(normalRes.severity).toBe('NORMAL');

    // Medial collapse (valgus) on right knee (inward excursion)
    const valgusFrames: FrameLandmarks[] = [
      {
        23: { x: 0.45, y: 0.5 },
        24: { x: 0.55, y: 0.5 },
        25: { x: 0.45, y: 0.7 },
        26: { x: 0.42, y: 0.7 }, // Collapsed medially past midpoint
        27: { x: 0.45, y: 0.9 },
        28: { x: 0.55, y: 0.9 },
      },
    ];
    const valgusRes = evaluateKneeDynamicValgus(valgusFrames, [0]);
    expect(valgusRes.valgusRiskFlag).toBe(true);
    expect(valgusRes.clinicalSummaryFr).toContain('Valgus dynamique');
    expect(valgusRes.clinicalSummaryFr).not.toContain('\u2014');
  });

  it('evaluates Lumbar Spine & Pelvis kinematics and flags lumbopelvic rhythm inversion', () => {
    // Severe lumbar bending without hip flexion
    const invertedFrames: FrameLandmarks[] = [
      {
        11: { x: 0.8, y: 0.4 },
        12: { x: 0.85, y: 0.4 },
        23: { x: 0.5, y: 0.6 },
        24: { x: 0.52, y: 0.6 },
        25: { x: 0.5, y: 0.85 },
        26: { x: 0.52, y: 0.85 },
      },
    ];
    const res = evaluateLumbopelvicRhythm(invertedFrames, [0]);
    expect(res.lumbopelvicRatio).toBeGreaterThan(1.8);
    expect(res.invertedRhythmFlag).toBe(true);
    expect(res.clinicalSummaryFr).toContain('Inversion du rythme lombo-pelvien');
    expect(res.clinicalSummaryFr).not.toContain('\u2014');
  });

  it('evaluates Hip Impingement and detects FADIR internal rotation deficit', () => {
    // Left hip restricted, right hip normal
    const hipFrames: FrameLandmarks[] = [
      {
        11: { x: 0.5, y: 0.2 },
        12: { x: 0.52, y: 0.2 },
        23: { x: 0.45, y: 0.5 },
        24: { x: 0.55, y: 0.5 },
        25: { x: 0.45, y: 0.7 },
        26: { x: 0.55, y: 0.7 },
        27: { x: 0.46, y: 0.9 }, // minimal internal rotation excursion on left
        28: { x: 0.75, y: 0.9 }, // good excursion on right
      },
    ];
    const res = evaluateHipImpingement(hipFrames, [0]);
    expect(res.internalRotationAsymmetryDeg).toBeGreaterThan(12);
    expect(res.fadirDeficitFlag).toBe(true);
    expect(res.clinicalSummaryFr).toContain('Déficit de rotation interne');
    expect(res.clinicalSummaryFr).not.toContain('\u2014');
  });

  it('evaluates Ankle & Achilles kinematics and assesses WBLT dorsiflexion', () => {
    const ankleFrames: FrameLandmarks[] = [
      {
        25: { x: 0.5, y: 0.6 },
        26: { x: 0.52, y: 0.6 },
        27: { x: 0.5, y: 0.85 },
        28: { x: 0.52, y: 0.85 },
        29: { x: 0.48, y: 0.88 },
        30: { x: 0.5, y: 0.88 },
        31: { x: 0.58, y: 0.9 },
        32: { x: 0.6, y: 0.9 },
      },
    ];
    const res = evaluateAnkleDorsiflexionLunge(ankleFrames, [0]);
    expect(res.specialty).toBe('ankle');
    expect(res.leftDorsiflexionLungeDeg).toBeGreaterThanOrEqual(20);
    expect(res.clinicalSummaryFr).not.toContain('\u2014');
  });

  it('evaluates Cervical Spine and flags forward head posture when CVA is low', () => {
    // Projected head (nose & ears far forward relative to shoulders)
    const fhpFrames: FrameLandmarks[] = [
      {
        0: { x: 0.75, y: 0.2 },
        7: { x: 0.7, y: 0.2 },
        8: { x: 0.72, y: 0.2 },
        11: { x: 0.5, y: 0.35 },
        12: { x: 0.52, y: 0.35 },
      },
    ];
    const res = evaluateCervicalSpinePosture(fhpFrames, [0]);
    expect(res.cranioVertebralAngleDeg).toBeLessThan(50);
    expect(res.forwardHeadPostureFlag).toBe(true);
    expect(res.clinicalSummaryFr).toContain('Projection antérieure de la tête');
    expect(res.clinicalSummaryFr).not.toContain('\u2014');
  });

  it('routes correctly via evaluatePessacBattery', () => {
    const frames: FrameLandmarks[] = [];
    const kneeRes = evaluatePessacBattery('knee', frames, []);
    expect(kneeRes.specialty).toBe('knee');

    const lumbarRes = evaluatePessacBattery('lumbar', frames, []);
    expect(lumbarRes.specialty).toBe('lumbar');

    const hipRes = evaluatePessacBattery('hip', frames, []);
    expect(hipRes.specialty).toBe('hip');

    const ankleRes = evaluatePessacBattery('ankle', frames, []);
    expect(ankleRes.specialty).toBe('ankle');

    const cervicalRes = evaluatePessacBattery('cervical', frames, []);
    expect(cervicalRes.specialty).toBe('cervical');
  });
});
