import { describe, it, expect } from 'vitest';
import { exportToBVH, BvhFrameData } from '../biomechanics/bvhExport';
import { Landmark3D } from '../biomechanics/kinematicFootLocking';

function createDummyFrame(tMs: number): BvhFrameData {
  const landmarks: Landmark3D[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 0.95,
  }));

  // Hips
  landmarks[23] = { x: 0.45, y: 0.60, z: 0 };
  landmarks[24] = { x: 0.55, y: 0.60, z: 0 };
  // Shoulders
  landmarks[11] = { x: 0.40, y: 0.30, z: 0 };
  landmarks[12] = { x: 0.60, y: 0.30, z: 0 };
  // Elbows / Wrists
  landmarks[13] = { x: 0.35, y: 0.45, z: 0 };
  landmarks[14] = { x: 0.65, y: 0.45, z: 0 };
  landmarks[15] = { x: 0.30, y: 0.60, z: 0 };
  landmarks[16] = { x: 0.70, y: 0.60, z: 0 };
  // Knees / Ankles / Toes
  landmarks[25] = { x: 0.45, y: 0.75, z: 0 };
  landmarks[26] = { x: 0.55, y: 0.75, z: 0 };
  landmarks[27] = { x: 0.45, y: 0.90, z: 0 };
  landmarks[28] = { x: 0.55, y: 0.90, z: 0 };
  landmarks[31] = { x: 0.45, y: 0.92, z: 0.05 };
  landmarks[32] = { x: 0.55, y: 0.92, z: 0.05 };

  return { landmarks, timestampMs: tMs };
}

describe('exportToBVH (Universal 3D Mocap BioVision Exporter)', () => {
  it('returns empty string on empty frames', () => {
    expect(exportToBVH([])).toBe('');
  });

  it('generates standard HIERARCHY and MOTION blocks', () => {
    const frames = [createDummyFrame(0), createDummyFrame(33), createDummyFrame(66)];
    const bvh = exportToBVH(frames, { frameRate: 30 });

    expect(bvh).toContain('HIERARCHY');
    expect(bvh).toContain('ROOT Hips');
    expect(bvh).toContain('JOINT Spine');
    expect(bvh).toContain('JOINT Chest');
    expect(bvh).toContain('JOINT LeftUpLeg');
    expect(bvh).toContain('JOINT RightUpLeg');
    expect(bvh).toContain('MOTION');
    expect(bvh).toContain('Frames: 3');
    expect(bvh).toContain('Frame Time: 0.033333');
  });

  it('formats motion channels correctly for each frame', () => {
    const frames = [createDummyFrame(0)];
    const bvh = exportToBVH(frames, { scale: 100 });

    const lines = bvh.trim().split('\n');
    const lastLine = lines[lines.length - 1];

    // The last line should contain numeric values separated by spaces
    const values = lastLine.split(' ').map(Number);
    expect(values.length).toBeGreaterThanOrEqual(30);
    expect(values.every(v => Number.isFinite(v))).toBe(true);
  });
});
