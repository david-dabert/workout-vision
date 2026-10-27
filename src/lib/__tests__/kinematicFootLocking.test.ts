import { describe, it, expect } from 'vitest';
import { KinematicFootLocker, Landmark3D } from '../biomechanics/kinematicFootLocking';

function createDummyLandmarks(ankleY: number = 0.90, ankleX: number = 0.5): Landmark3D[] {
  const lms: Landmark3D[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.95,
  }));

  // Left ankle (27), heel (29), toe (31)
  lms[27] = { x: ankleX - 0.1, y: ankleY - 0.03, z: 0, visibility: 0.95 };
  lms[29] = { x: ankleX - 0.1, y: ankleY, z: 0, visibility: 0.95 };
  lms[31] = { x: ankleX - 0.1, y: ankleY, z: 0.05, visibility: 0.95 };

  // Right ankle (28), heel (30), toe (32)
  lms[28] = { x: ankleX + 0.1, y: ankleY - 0.03, z: 0, visibility: 0.95 };
  lms[30] = { x: ankleX + 0.1, y: ankleY, z: 0, visibility: 0.95 };
  lms[32] = { x: ankleX + 0.1, y: ankleY, z: 0.05, visibility: 0.95 };

  return lms;
}

describe('KinematicFootLocker (ZUPT Contact Filter)', () => {
  it('handles empty or incomplete landmarks gracefully', () => {
    const locker = new KinematicFootLocker();
    const result = locker.processFrame([], 100);
    expect(result.leftFootContact).toBe(false);
    expect(result.rightFootContact).toBe(false);
    expect(result.skatingReductionPercent).toBe(0);
  });

  it('detects grounded contact state after hysteresis frames', () => {
    const locker = new KinematicFootLocker({ hysteresisFrames: 3 });

    let res;
    // Feed 4 frames with static low velocity near ground plane (y = 0.90)
    for (let i = 0; i < 4; i++) {
      const lms = createDummyLandmarks(0.90);
      res = locker.processFrame(lms, 100 + i * 33);
    }

    expect(res?.leftFootContact).toBe(true);
    expect(res?.rightFootContact).toBe(true);
    expect(res?.skatingReductionPercent).toBeGreaterThanOrEqual(90);
  });

  it('eliminates horizontal jitter while contact is active (zero-skate constraint)', () => {
    const locker = new KinematicFootLocker({ hysteresisFrames: 2, blendFactor: 1.0 });

    // Establish lock on frame 1 and 2
    locker.processFrame(createDummyLandmarks(0.90, 0.50), 100);
    locker.processFrame(createDummyLandmarks(0.90, 0.50), 133);

    // Frame 3: inject synthetic monocular horizontal jitter on heels (+0.04)
    const jittered = createDummyLandmarks(0.90, 0.50);
    jittered[29].x += 0.04;
    jittered[30].x += 0.04;

    const locked = locker.processFrame(jittered, 166);

    // Filtered coordinates should be pinned back toward the anchor (0.40 and 0.60)
    expect(locked.landmarks[29].x).toBeCloseTo(0.40, 2);
    expect(locked.landmarks[30].x).toBeCloseTo(0.60, 2);
  });

  it('releases contact lock during flight or swing phase', () => {
    const locker = new KinematicFootLocker({ hysteresisFrames: 2 });

    // Lock first
    locker.processFrame(createDummyLandmarks(0.90), 100);
    locker.processFrame(createDummyLandmarks(0.90), 133);

    // Lift foot high off ground (y = 0.60)
    locker.processFrame(createDummyLandmarks(0.60), 166);
    const release = locker.processFrame(createDummyLandmarks(0.60), 200);

    expect(release.leftFootContact).toBe(false);
    expect(release.rightFootContact).toBe(false);
  });
});
