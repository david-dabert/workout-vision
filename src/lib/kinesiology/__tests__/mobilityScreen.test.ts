import { describe, expect, it } from 'vitest';
import {
  aggregateMobilityBattery,
  calculateJointAngle3D,
  evaluateActiveStraightLegRaiseScreen,
  evaluateAnkleDorsiflexionScreen,
  evaluateHipRotationScreen,
  evaluateOverheadMobilityScreen,
  evaluateSingleLegStabilityScreen,
  LandmarkFrame,
} from '../mobilityScreen';
import { getDrillsForDeficit, getWarmupProtocolForDeficits, REMEDIAL_DRILLS } from '../remedialDrills';
import { exerciseById, LIBRARY, MOBILITY_SCREENS } from '../../kine/library';

// Helper to construct a synthetic 33-point BlazePose skeleton frame
function makeFrame(timestamp: number, overrides: Record<number, { x: number; y: number; z?: number }>): LandmarkFrame {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.99 }));
  for (const [idxStr, pt] of Object.entries(overrides)) {
    const idx = Number(idxStr);
    landmarks[idx] = { ...landmarks[idx], ...pt };
  }
  return { timestamp, landmarks };
}

describe('Universal Functional Mobility & Kinesiology Screening Engine', () => {
  describe('Screen 1: Ankle Dorsiflexion (Closed-Kinetic-Chain Knee-to-Wall)', () => {
    it('passes when tibial forward inclination reaches >= 35° with heel flat on ground', () => {
      // Sagittal profile: ankle at (0.5, 0.8), heel at (0.45, 0.8), toe at (0.6, 0.8)
      // Max dorsiflexion: knee drives forward to (0.75, 0.5). dx = 0.25, dy = 0.3 => atan2(0.25, 0.3) = 39.8°
      const frames: LandmarkFrame[] = [
        makeFrame(0, { 25: { x: 0.5, y: 0.5 }, 27: { x: 0.5, y: 0.8 }, 29: { x: 0.45, y: 0.8 }, 31: { x: 0.6, y: 0.8 } }),
        makeFrame(500, { 25: { x: 0.6, y: 0.5 }, 27: { x: 0.5, y: 0.8 }, 29: { x: 0.45, y: 0.8 }, 31: { x: 0.6, y: 0.8 } }),
        makeFrame(1000, { 25: { x: 0.75, y: 0.5 }, 27: { x: 0.5, y: 0.8 }, 29: { x: 0.45, y: 0.8 }, 31: { x: 0.6, y: 0.8 } }),
        makeFrame(1500, { 25: { x: 0.75, y: 0.5 }, 27: { x: 0.5, y: 0.8 }, 29: { x: 0.45, y: 0.8 }, 31: { x: 0.6, y: 0.8 } }),
        makeFrame(2000, { 25: { x: 0.5, y: 0.5 }, 27: { x: 0.5, y: 0.8 }, 29: { x: 0.45, y: 0.8 }, 31: { x: 0.6, y: 0.8 } }),
      ];

      const res = evaluateAnkleDorsiflexionScreen(frames, 'left');
      expect(res.verdict).toBe('PASS');
      expect(res.measuredAngleDeg).toBeGreaterThanOrEqual(35);
      expect(res.heelLiftDetected).toBe(false);
      expect(res.remedialDrills).toHaveLength(0);
    });

    it('flags severe restriction when forward tibial inclination is < 25°', () => {
      // Knee only travels forward to (0.55, 0.5) => dx = 0.05, dy = 0.3 => atan2(0.05, 0.3) = 9.46°
      const frames: LandmarkFrame[] = Array.from({ length: 10 }, (_, i) =>
        makeFrame(i * 100, {
          25: { x: 0.55, y: 0.5 },
          27: { x: 0.5, y: 0.8 },
          29: { x: 0.45, y: 0.8 },
          31: { x: 0.6, y: 0.8 },
        })
      );

      const res = evaluateAnkleDorsiflexionScreen(frames, 'left');
      expect(res.verdict).toBe('SEVERE_RESTRICTION');
      expect(res.measuredAngleDeg).toBeLessThan(25);
      expect(res.remedialDrills.length).toBeGreaterThanOrEqual(2);
      expect(res.remedialDrills.map(d => d.id)).toContain('banded_talocrural_mobilization');
      expect(res.remedialDrills.map(d => d.id)).toContain('slant_board_eccentric_soleus_drop');
    });

    it('detects compensatory heel lift when the heel elevates off the ground', () => {
      // Baseline heel y = 0.80. At peak, heel lifts to y = 0.74 (lift = 0.06 > 0.025)
      const frames: LandmarkFrame[] = [
        makeFrame(0, { 25: { x: 0.5, y: 0.5 }, 27: { x: 0.5, y: 0.8 }, 29: { x: 0.45, y: 0.8 }, 31: { x: 0.6, y: 0.8 } }),
        makeFrame(100, { 25: { x: 0.5, y: 0.5 }, 27: { x: 0.5, y: 0.8 }, 29: { x: 0.45, y: 0.8 }, 31: { x: 0.6, y: 0.8 } }),
        makeFrame(200, { 25: { x: 0.75, y: 0.5 }, 27: { x: 0.5, y: 0.8 }, 29: { x: 0.45, y: 0.74 }, 31: { x: 0.6, y: 0.8 } }),
        makeFrame(300, { 25: { x: 0.75, y: 0.5 }, 27: { x: 0.5, y: 0.8 }, 29: { x: 0.45, y: 0.74 }, 31: { x: 0.6, y: 0.8 } }),
        makeFrame(400, { 25: { x: 0.5, y: 0.5 }, 27: { x: 0.5, y: 0.8 }, 29: { x: 0.45, y: 0.8 }, 31: { x: 0.6, y: 0.8 } }),
      ];

      const res = evaluateAnkleDorsiflexionScreen(frames, 'left');
      expect(res.heelLiftDetected).toBe(true);
      expect(res.findings.some(f => f.includes('heel lift'))).toBe(true);
    });
  });

  describe('Screen 2: Hip Internal & External Rotation Screen', () => {
    it('evaluates hip internal rotation with clinical threshold >= 35°', () => {
      // Knee at (0.5, 0.5), ankle pivots outward to (0.75, 0.8) => dx = 0.25, dy = 0.3 => 39.8°
      const frames: LandmarkFrame[] = Array.from({ length: 6 }, (_, i) =>
        makeFrame(i * 100, { 23: { x: 0.5, y: 0.2 }, 25: { x: 0.5, y: 0.5 }, 27: { x: 0.75, y: 0.8 } })
      );

      const res = evaluateHipRotationScreen(frames, 'left', 'internal');
      expect(res.verdict).toBe('PASS');
      expect(res.measuredAngleDeg).toBeGreaterThanOrEqual(35);
    });

    it('flags deficit and FAI risk when hip internal rotation is restricted (< 25°)', () => {
      // Ankle only moves to (0.55, 0.8) => dx = 0.05, dy = 0.3 => 9.5°
      const frames: LandmarkFrame[] = Array.from({ length: 6 }, (_, i) =>
        makeFrame(i * 100, { 23: { x: 0.5, y: 0.2 }, 25: { x: 0.5, y: 0.5 }, 27: { x: 0.55, y: 0.8 } })
      );

      const res = evaluateHipRotationScreen(frames, 'left', 'internal');
      expect(res.verdict).toBe('SEVERE_RESTRICTION');
      expect(res.remedialDrills.map(d => d.id)).toContain('hip_90_90_pails_rails');
    });
  });

  describe('Screen 3: Overhead Shoulder & Thoracic Extension Screen (Lumbar Decoupling)', () => {
    it('passes when arms elevate to >= 170° with zero compensatory lumbar lordosis flare', () => {
      // Hip (0.5, 0.6), Shoulder (0.5, 0.3), Wrist (0.5, 0.0) -> straight 180° arm elevation
      // Knee (0.5, 0.9), Hip (0.5, 0.6), Shoulder (0.5, 0.3) -> straight 180° vertical torso
      const frames: LandmarkFrame[] = Array.from({ length: 6 }, (_, i) =>
        makeFrame(i * 100, {
          23: { x: 0.5, y: 0.6 },
          11: { x: 0.5, y: 0.3 },
          15: { x: 0.5, y: 0.0 },
          25: { x: 0.5, y: 0.9 },
        })
      );

      const res = evaluateOverheadMobilityScreen(frames);
      expect(res.verdict).toBe('PASS');
      expect(res.measuredAngleDeg).toBeGreaterThanOrEqual(170);
      expect(res.compensationAngleDeg).toBe(0);
      expect(res.remedialDrills).toHaveLength(0);
    });

    it('detects compensatory lumbar lordosis cheat (+18° flare) masking thoracic stiffness', () => {
      // Baseline standing: knee (0.5, 0.9), hip (0.5, 0.6), shoulder (0.5, 0.3) -> 180°
      // At overhead reach: shoulder leans back to x = 0.40, hip shifts forward to x = 0.55 -> trunk hyperextension
      const frames: LandmarkFrame[] = [
        makeFrame(0, { 23: { x: 0.5, y: 0.6 }, 11: { x: 0.5, y: 0.3 }, 15: { x: 0.5, y: 0.5 }, 25: { x: 0.5, y: 0.9 } }),
        makeFrame(100, { 23: { x: 0.5, y: 0.6 }, 11: { x: 0.5, y: 0.3 }, 15: { x: 0.5, y: 0.5 }, 25: { x: 0.5, y: 0.9 } }),
        makeFrame(200, { 23: { x: 0.5, y: 0.6 }, 11: { x: 0.5, y: 0.3 }, 15: { x: 0.5, y: 0.5 }, 25: { x: 0.5, y: 0.9 } }),
        makeFrame(300, { 23: { x: 0.55, y: 0.6 }, 11: { x: 0.38, y: 0.3 }, 15: { x: 0.38, y: 0.0 }, 25: { x: 0.5, y: 0.9 } }),
        makeFrame(400, { 23: { x: 0.55, y: 0.6 }, 11: { x: 0.38, y: 0.3 }, 15: { x: 0.38, y: 0.0 }, 25: { x: 0.5, y: 0.9 } }),
      ];

      const res = evaluateOverheadMobilityScreen(frames);
      expect(res.compensationAngleDeg).toBeGreaterThan(10);
      expect(res.findings.some(f => f.includes('Lumbar lordosis cheat'))).toBe(true);
      expect(res.remedialDrills.map(d => d.id)).toContain('foam_roller_thoracic_extension');
    });
  });

  describe('Screen 4: Dynamic Single-Leg Stability & Trendelenburg Screen', () => {
    it('detects Trendelenburg pelvic drop when contralateral hip drops >= 5°', () => {
      // Left stance: Left hip at (0.45, 0.45). Right hip drops to y = 0.52 (dy = 0.07, dx = 0.10 => 35° drop)
      const frames: LandmarkFrame[] = Array.from({ length: 6 }, (_, i) =>
        makeFrame(i * 100, {
          23: { x: 0.45, y: 0.45 },
          24: { x: 0.55, y: 0.52 },
          25: { x: 0.45, y: 0.70 },
          27: { x: 0.45, y: 0.95 },
        })
      );

      const res = evaluateSingleLegStabilityScreen(frames, 'left');
      expect(res.verdict).toBe('SEVERE_RESTRICTION');
      expect(res.findings.some(f => f.includes('Trendelenburg'))).toBe(true);
      expect(res.remedialDrills.map(d => d.id)).toContain('clamshell_banded_neutral_pelvis');
    });

    it('detects dynamic knee valgus collapse when knee displaces medially', () => {
      // Left stance: hip (0.45, 0.45), ankle (0.45, 0.95). Knee collapses inward to (0.58, 0.70)
      const frames: LandmarkFrame[] = Array.from({ length: 6 }, (_, i) =>
        makeFrame(i * 100, {
          23: { x: 0.45, y: 0.45 },
          24: { x: 0.55, y: 0.45 },
          25: { x: 0.58, y: 0.70 },
          27: { x: 0.45, y: 0.95 },
        })
      );

      const res = evaluateSingleLegStabilityScreen(frames, 'left');
      expect(res.verdict).toBe('SEVERE_RESTRICTION');
      expect(res.findings.some(f => f.includes('Dynamic knee valgus'))).toBe(true);
      expect(res.remedialDrills.map(d => d.id)).toContain('spanish_squat_isometric_lock');
    });
  });

  describe('Screen 5: Active Straight Leg Raise (ASLR Hamstring & Neural Floss)', () => {
    it('passes when active hip flexes to >= 80° with knee straight and opposite leg grounded', () => {
      // Supine: Shoulder (0.2, 0.5), Hip (0.5, 0.5). Active knee raised vertically to (0.5, 0.2), ankle (0.5, 0.0)
      // Torso vector = (-0.3, 0); thigh vector = (0, -0.3). Angle = 90° => hip flexion = 180° - 90° = 90°
      const frames: LandmarkFrame[] = Array.from({ length: 6 }, (_, i) =>
        makeFrame(i * 100, {
          11: { x: 0.2, y: 0.5 },
          23: { x: 0.5, y: 0.5 },
          25: { x: 0.5, y: 0.2 },
          27: { x: 0.5, y: 0.0 },
          24: { x: 0.5, y: 0.55 },
          26: { x: 0.75, y: 0.55 },
          28: { x: 0.95, y: 0.55 },
        })
      );

      const res = evaluateActiveStraightLegRaiseScreen(frames, 'left');
      expect(res.verdict).toBe('PASS');
      expect(res.measuredAngleDeg).toBeGreaterThanOrEqual(80);
      expect(res.remedialDrills).toHaveLength(0);
    });

    it('detects contralateral hip flexor cheating when the opposite knee flexes off floor', () => {
      // Contralateral knee flexes to 140°: Hip (0.5, 0.55), Knee (0.70, 0.40), Ankle (0.90, 0.55)
      const frames: LandmarkFrame[] = Array.from({ length: 6 }, (_, i) =>
        makeFrame(i * 100, {
          11: { x: 0.2, y: 0.5 },
          23: { x: 0.5, y: 0.5 },
          25: { x: 0.5, y: 0.2 },
          27: { x: 0.5, y: 0.0 },
          24: { x: 0.5, y: 0.55 },
          26: { x: 0.70, y: 0.40 },
          28: { x: 0.90, y: 0.55 },
        })
      );

      const res = evaluateActiveStraightLegRaiseScreen(frames, 'left');
      expect(res.findings.some(f => f.includes('Contralateral knee flexion'))).toBe(true);
      expect(res.remedialDrills.map(d => d.id)).toContain('hip_90_90_pails_rails');
    });
  });

  describe('Full Mobility Battery Aggregation & Individualized Priming Protocol', () => {
    it('aggregates individual screens into a clinical report with gym transfer impacts', () => {
      const restrictedAnkle = evaluateAnkleDorsiflexionScreen(
        Array.from({ length: 6 }, (_, i) => makeFrame(i * 100, { 25: { x: 0.55, y: 0.5 }, 27: { x: 0.5, y: 0.8 }, 29: { x: 0.45, y: 0.8 }, 31: { x: 0.6, y: 0.8 } })),
        'left'
      );
      const passedOverhead = evaluateOverheadMobilityScreen(
        Array.from({ length: 6 }, (_, i) => makeFrame(i * 100, { 23: { x: 0.5, y: 0.6 }, 11: { x: 0.5, y: 0.3 }, 15: { x: 0.5, y: 0.0 }, 25: { x: 0.5, y: 0.9 } }))
      );

      const report = aggregateMobilityBattery([restrictedAnkle, passedOverhead], 'athlete-screen-001');

      expect(report.overallMobilityScore).toBeGreaterThan(0);
      expect(report.identifiedDeficits).toContain('ankle_dorsiflexion_restriction');
      expect(report.functionalGymImpacts.length).toBeGreaterThan(0);
      expect(report.functionalGymImpacts[0]).toContain('Barbell and Hack Squats');
      expect(report.recommendedWarmupProtocol.length).toBeGreaterThan(0);
      expect(report.recommendedWarmupProtocol.map(d => d.id)).toContain('banded_talocrural_mobilization');
    });
  });

  describe('Kinesiotherapy Reference Library Expansion', () => {
    it('preserves Olivier\'s four reference exercises intact in LIBRARY (R8, R9)', () => {
      expect(LIBRARY.map(e => e.id)).toEqual([
        'mains-jointes',
        'rotation-externe',
        'abduction-horizontale',
        'elevation-paliers',
      ]);
    });

    it('contains the 5 standardized clinical mobility screening tests in MOBILITY_SCREENS', () => {
      expect(MOBILITY_SCREENS.map(e => e.id)).toEqual([
        'test-dorsiflexion-cheville',
        'test-rotation-hanche',
        'test-mobilite-epaule-rachis',
        'test-stabilite-unipodale',
        'test-aslr-chaine-posterieure',
      ]);

      for (const screen of MOBILITY_SCREENS) {
        expect(screen.category).toBe('mobility_screen');
        expect(screen.compare).toBe(true);
        expect(screen.fr.steps.length).toBeGreaterThanOrEqual(3);
        expect(screen.en.steps.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('resolves both Olivier reference exercises and mobility screens via exerciseById', () => {
      expect(exerciseById('mains-jointes')).not.toBeNull();
      expect(exerciseById('test-dorsiflexion-cheville')).not.toBeNull();
      expect(exerciseById('non-existent')).toBeNull();
    });
  });
});
