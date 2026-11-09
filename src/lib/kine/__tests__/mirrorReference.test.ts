import { describe, expect, it } from 'vitest';
import {
  mirrorLandmarksFrame,
  createHealthySideMirrorAvatar,
  computeLsiProgress,
} from '../mirrorReference';
import type { FrameLandmarks } from '../shoulderDyskinesis';

describe('mirrorReference engine (Monsieur Lamine patient-mirror model)', () => {
  describe('mirrorLandmarksFrame', () => {
    it('mirrors X coordinates across mid-sagittal line and swaps bilateral indices', () => {
      // Left shoulder at x=0.4, Right shoulder at x=0.6 -> midX = 0.5
      // Left elbow (13) at x=0.35, y=0.5
      const frame: FrameLandmarks = {
        11: { x: 0.4, y: 0.3, visibility: 0.9 }, // Left shoulder
        12: { x: 0.6, y: 0.3, visibility: 0.9 }, // Right shoulder
        13: { x: 0.35, y: 0.5, visibility: 0.9 }, // Left elbow
      };

      const mirrored = mirrorLandmarksFrame(frame);

      // In mirrored frame:
      // Index 13 (Left elbow) should become Index 14 (Right elbow)
      // x' = 2 * 0.5 - 0.35 = 0.65
      expect(mirrored[14]).toBeDefined();
      expect(mirrored[14].x).toBeCloseTo(0.65, 4);
      expect(mirrored[14].y).toBe(0.5);

      // Index 11 (Left shoulder) becomes Index 12 (Right shoulder)
      // x' = 2 * 0.5 - 0.4 = 0.6
      expect(mirrored[12].x).toBeCloseTo(0.6, 4);

      // Index 12 (Right shoulder) becomes Index 11 (Left shoulder)
      // x' = 2 * 0.5 - 0.6 = 0.4
      expect(mirrored[11].x).toBeCloseTo(0.4, 4);
    });
  });

  describe('createHealthySideMirrorAvatar', () => {
    it('generates a full mirrored trajectory with targetSide swapped', () => {
      const trajectory: FrameLandmarks[] = [
        { 11: { x: 0.4, y: 0.3 }, 12: { x: 0.6, y: 0.3 }, 13: { x: 0.3, y: 0.4 } },
        { 11: { x: 0.4, y: 0.3 }, 12: { x: 0.6, y: 0.3 }, 13: { x: 0.25, y: 0.2 } },
      ];

      const avatar = createHealthySideMirrorAvatar(trajectory, { healthySide: 'left' });
      expect(avatar.healthySide).toBe('left');
      expect(avatar.targetSide).toBe('right');
      expect(avatar.frameCount).toBe(2);
      expect(avatar.mirroredLandmarks[0][14]).toBeDefined(); // Right elbow mirrored
    });
  });

  describe('computeLsiProgress (Limb Symmetry Index: 95% - 105% Target)', () => {
    it('identifies initial deficit at baseline (60% LSI)', () => {
      const milestone = computeLsiProgress(102, 170, 102);
      expect(milestone.currentLsiPercent).toBe(60);
      expect(milestone.isWithinTargetZone).toBe(false);
      expect(milestone.gainFromBaselinePercent).toBe(0);
      expect(milestone.statusFr).toContain('Déficit');
    });

    it('identifies milestone reached when within 95% - 105% target zone', () => {
      const milestone = computeLsiProgress(165, 170, 102);
      // 165 / 170 = 97.1%
      expect(milestone.currentLsiPercent).toBe(97.1);
      expect(milestone.isWithinTargetZone).toBe(true);
      expect(milestone.gainFromBaselinePercent).toBeCloseTo(37.1, 1);
      expect(milestone.statusFr).toContain('Objectif atteint');
    });

    it('identifies overcompensation when exceeding 105%', () => {
      const milestone = computeLsiProgress(185, 170, 102);
      // 185 / 170 = 108.8%
      expect(milestone.currentLsiPercent).toBe(108.8);
      expect(milestone.isWithinTargetZone).toBe(false);
      expect(milestone.statusFr).toContain('Surcompensation');
    });
  });
});
