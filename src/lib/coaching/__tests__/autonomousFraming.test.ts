import { describe, it, expect } from 'vitest';
import { evaluateFraming, AutonomousFramingCoach, LandmarkPoint } from '../autonomousFraming';

function createDummyLandmarks(options: {
  noseY?: number;
  hipX?: number;
  hipY?: number;
  ankleY?: number;
  visibility?: number;
} = {}): LandmarkPoint[] {
  const vis = options.visibility ?? 0.9;
  const list: LandmarkPoint[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: vis,
  }));

  list[0] = { x: options.hipX ?? 0.5, y: options.noseY ?? 0.15, z: 0, visibility: vis }; // nose
  list[11] = { x: (options.hipX ?? 0.5) - 0.1, y: 0.25, z: 0, visibility: vis }; // left shoulder
  list[12] = { x: (options.hipX ?? 0.5) + 0.1, y: 0.25, z: 0, visibility: vis }; // right shoulder
  list[23] = { x: (options.hipX ?? 0.5) - 0.08, y: options.hipY ?? 0.5, z: 0, visibility: vis }; // left hip
  list[24] = { x: (options.hipX ?? 0.5) + 0.08, y: options.hipY ?? 0.5, z: 0, visibility: vis }; // right hip
  list[27] = { x: (options.hipX ?? 0.5) - 0.08, y: options.ankleY ?? 0.85, z: 0, visibility: vis }; // left ankle
  list[28] = { x: (options.hipX ?? 0.5) + 0.08, y: options.ankleY ?? 0.85, z: 0, visibility: vis }; // right ankle

  return list;
}

describe('Autonomous Camera Framing Assistant', () => {
  it('detects when no person is present in the frame', () => {
    const evalNull = evaluateFraming(null);
    expect(evalNull.status).toBe('NO_PERSON');
    expect(evalNull.isReadyToLift).toBe(false);

    const evalLowVis = evaluateFraming(createDummyLandmarks({ visibility: 0.2 }));
    expect(evalLowVis.status).toBe('NO_PERSON');
  });

  it('detects optimal framing for whole-body exercises', () => {
    const optimalLandmarks = createDummyLandmarks({
      noseY: 0.15,
      hipX: 0.5,
      hipY: 0.5,
      ankleY: 0.85,
    });

    const res = evaluateFraming(optimalLandmarks, true);
    expect(res.status).toBe('OPTIMAL');
    expect(res.isReadyToLift).toBe(true);
    expect(res.cueFr).toContain('Cadrage optimal');
  });

  it('detects feet cut off when ankles are below viewport boundary', () => {
    const feetCutOff = createDummyLandmarks({
      noseY: 0.15,
      ankleY: 0.98, // Below 0.96 threshold
    });

    const res = evaluateFraming(feetCutOff, true);
    expect(res.status).toBe('FEET_CUT_OFF');
    expect(res.isReadyToLift).toBe(false);
    expect(res.cueFr).toContain('Reculez d’un pas');
  });

  it('detects head cut off when nose is near top border', () => {
    const headCut = createDummyLandmarks({
      noseY: 0.02, // Above 0.04 boundary
      ankleY: 0.80,
    });

    const res = evaluateFraming(headCut, true);
    expect(res.status).toBe('HEAD_CUT_OFF');
    expect(res.isReadyToLift).toBe(false);
    expect(res.cueFr).toContain('Inclinez légèrement le téléphone vers le haut');
  });

  it('detects when athlete is off-center to the left or right', () => {
    const farLeft = createDummyLandmarks({ hipX: 0.10 });
    const resLeft = evaluateFraming(farLeft, true);
    expect(resLeft.status).toBe('OFF_CENTER_LEFT');
    expect(resLeft.cueFr).toContain('droite');

    const farRight = createDummyLandmarks({ hipX: 0.90 });
    const resRight = evaluateFraming(farRight, true);
    expect(resRight.status).toBe('OFF_CENTER_RIGHT');
    expect(resRight.cueFr).toContain('gauche');
  });

  it('debounces verbal framing speech with AutonomousFramingCoach', () => {
    const coach = new AutonomousFramingCoach(500, 3000);
    const feetCut = evaluateFraming(createDummyLandmarks({ ankleY: 0.98 }), true);

    // Initial detection: persistence check not yet satisfied
    expect(coach.update(feetCut, 1000)).toBeNull();
    // After 200ms: still under 500ms persistence
    expect(coach.update(feetCut, 1200)).toBeNull();
    // After 600ms: persisted! Speaks cue
    const spoken = coach.update(feetCut, 1600);
    expect(spoken).toContain('Reculez d’un pas');

    // Immediate next frame: cooldown active, does not repeat
    expect(coach.update(feetCut, 1700)).toBeNull();
  });
});
