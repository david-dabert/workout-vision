/**
 * Universal 3D Motion Capture Exporter (.BVH - BioVision Hierarchy)
 *
 * Converts 3D pose landmark micro-sequences into standard BioVision Hierarchy (.bvh)
 * animation files compatible with Blender, Unreal Engine 5, Autodesk Maya, Mixamo,
 * Unity, and kinematic laboratory software.
 *
 * Implements a standard humanoid hierarchy with 6-DOF root (3 translation, 3 rotation)
 * and 3-DOF rotational joints (Zrotation Xrotation Yrotation).
 */

import { Landmark3D } from './kinematicFootLocking';

export interface BvhFrameData {
  landmarks: Landmark3D[];
  timestampMs: number;
}

export interface BvhExportOptions {
  frameRate?: number; // Target frame rate (default: 30)
  scale?: number;     // Metric scaling factor (default: 100 for cm)
}

/**
 * Computes Euler angles (degrees) from vector direction relative to nominal rest pose.
 */
function computeEulerAnglesFromVector(v: { x: number; y: number; z: number }): [number, number, number] {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-4) return [0, 0, 0];

  const nx = v.x / len;
  const ny = v.y / len;
  const nz = v.z / len;

  // Pitch (around X), Yaw (around Y), Roll (around Z)
  const pitch = Math.asin(Math.max(-1, Math.min(1, -ny))) * (180 / Math.PI);
  const yaw = Math.atan2(nx, nz) * (180 / Math.PI);
  const roll = 0; // Monocular constraint simplification

  return [
    Math.round(roll * 100) / 100,
    Math.round(pitch * 100) / 100,
    Math.round(yaw * 100) / 100,
  ];
}

/**
 * Generates the standard BioVision Hierarchy (BVH) header definition.
 */
function generateBvhHierarchy(scale: number): string {
  const s = scale;
  return `HIERARCHY
ROOT Hips
{
  OFFSET 0.00 0.00 0.00
  CHANNELS 6 Xposition Yposition Zposition Zrotation Xrotation Yrotation
  JOINT Spine
  {
    OFFSET 0.00 ${ (0.20 * s).toFixed(2) } 0.00
    CHANNELS 3 Zrotation Xrotation Yrotation
    JOINT Chest
    {
      OFFSET 0.00 ${ (0.25 * s).toFixed(2) } 0.00
      CHANNELS 3 Zrotation Xrotation Yrotation
      JOINT Neck
      {
        OFFSET 0.00 ${ (0.15 * s).toFixed(2) } 0.00
        CHANNELS 3 Zrotation Xrotation Yrotation
        End Site
        {
          OFFSET 0.00 ${ (0.15 * s).toFixed(2) } 0.00
        }
      }
      JOINT LeftShoulder
      {
        OFFSET ${ (-0.18 * s).toFixed(2) } 0.00 0.00
        CHANNELS 3 Zrotation Xrotation Yrotation
        JOINT LeftArm
        {
          OFFSET ${ (-0.28 * s).toFixed(2) } 0.00 0.00
          CHANNELS 3 Zrotation Xrotation Yrotation
          JOINT LeftForeArm
          {
            OFFSET ${ (-0.25 * s).toFixed(2) } 0.00 0.00
            CHANNELS 3 Zrotation Xrotation Yrotation
            End Site
            {
              OFFSET ${ (-0.18 * s).toFixed(2) } 0.00 0.00
            }
          }
        }
      }
      JOINT RightShoulder
      {
        OFFSET ${ (0.18 * s).toFixed(2) } 0.00 0.00
        CHANNELS 3 Zrotation Xrotation Yrotation
        JOINT RightArm
        {
          OFFSET ${ (0.28 * s).toFixed(2) } 0.00 0.00
          CHANNELS 3 Zrotation Xrotation Yrotation
          JOINT RightForeArm
          {
            OFFSET ${ (0.25 * s).toFixed(2) } 0.00 0.00
            CHANNELS 3 Zrotation Xrotation Yrotation
            End Site
            {
              OFFSET ${ (0.18 * s).toFixed(2) } 0.00 0.00
            }
          }
        }
      }
    }
  }
  JOINT LeftUpLeg
  {
    OFFSET ${ (-0.10 * s).toFixed(2) } 0.00 0.00
    CHANNELS 3 Zrotation Xrotation Yrotation
    JOINT LeftLeg
    {
      OFFSET 0.00 ${ (-0.42 * s).toFixed(2) } 0.00
      CHANNELS 3 Zrotation Xrotation Yrotation
      JOINT LeftFoot
      {
        OFFSET 0.00 ${ (-0.40 * s).toFixed(2) } 0.00
        CHANNELS 3 Zrotation Xrotation Yrotation
        End Site
        {
          OFFSET 0.00 0.00 ${ (0.20 * s).toFixed(2) }
        }
      }
    }
  }
  JOINT RightUpLeg
  {
    OFFSET ${ (0.10 * s).toFixed(2) } 0.00 0.00
    CHANNELS 3 Zrotation Xrotation Yrotation
    JOINT RightLeg
    {
      OFFSET 0.00 ${ (-0.42 * s).toFixed(2) } 0.00
      CHANNELS 3 Zrotation Xrotation Yrotation
      JOINT RightFoot
      {
        OFFSET 0.00 ${ (-0.40 * s).toFixed(2) } 0.00
        CHANNELS 3 Zrotation Xrotation Yrotation
        End Site
        {
          OFFSET 0.00 0.00 ${ (0.20 * s).toFixed(2) }
        }
      }
    }
  }
}`;
}

/**
 * Converts a sequence of 3D landmark frames into a standard BVH ASCII format.
 */
export function exportToBVH(frames: BvhFrameData[], options: BvhExportOptions = {}): string {
  if (!frames || frames.length === 0) {
    return '';
  }

  const frameRate = options.frameRate ?? 30;
  const scale = options.scale ?? 100; // cm
  const frameTime = (1 / frameRate).toFixed(6);

  const hierarchy = generateBvhHierarchy(scale);
  const motionLines: string[] = [];

  for (const frame of frames) {
    const lms = frame.landmarks;
    if (lms.length < 33) continue;

    // Root (Hips) translation
    const hipX = ((lms[23].x + lms[24].x) / 2 - 0.5) * scale;
    const hipY = ((1 - (lms[23].y + lms[24].y) / 2) - 0.5) * scale;
    const hipZ = (((lms[23].z ?? 0) + (lms[24].z ?? 0)) / 2) * scale;

    // Torso / Spine angles
    const spineV = {
      x: ((lms[11].x + lms[12].x) / 2) - ((lms[23].x + lms[24].x) / 2),
      y: ((lms[11].y + lms[12].y) / 2) - ((lms[23].y + lms[24].y) / 2),
      z: (((lms[11].z ?? 0) + (lms[12].z ?? 0)) / 2) - (((lms[23].z ?? 0) + (lms[24].z ?? 0)) / 2),
    };
    const [spineRz, spineRx, spineRy] = computeEulerAnglesFromVector(spineV);

    // Left Arm
    const lArmV = { x: lms[13].x - lms[11].x, y: lms[13].y - lms[11].y, z: (lms[13].z ?? 0) - (lms[11].z ?? 0) };
    const [lArmRz, lArmRx, lArmRy] = computeEulerAnglesFromVector(lArmV);
    const lForeArmV = { x: lms[15].x - lms[13].x, y: lms[15].y - lms[13].y, z: (lms[15].z ?? 0) - (lms[13].z ?? 0) };
    const [lFaRz, lFaRx, lFaRy] = computeEulerAnglesFromVector(lForeArmV);

    // Right Arm
    const rArmV = { x: lms[14].x - lms[12].x, y: lms[14].y - lms[12].y, z: (lms[14].z ?? 0) - (lms[12].z ?? 0) };
    const [rArmRz, rArmRx, rArmRy] = computeEulerAnglesFromVector(rArmV);
    const rForeArmV = { x: lms[16].x - lms[14].x, y: lms[16].y - lms[14].y, z: (lms[16].z ?? 0) - (lms[14].z ?? 0) };
    const [rFaRz, rFaRx, rFaRy] = computeEulerAnglesFromVector(rForeArmV);

    // Left Leg
    const lLegV = { x: lms[25].x - lms[23].x, y: lms[25].y - lms[23].y, z: (lms[25].z ?? 0) - (lms[23].z ?? 0) };
    const [lLegRz, lLegRx, lLegRy] = computeEulerAnglesFromVector(lLegV);
    const lLowLegV = { x: lms[27].x - lms[25].x, y: lms[27].y - lms[25].y, z: (lms[27].z ?? 0) - (lms[25].z ?? 0) };
    const [lLlRz, lLlRx, lLlRy] = computeEulerAnglesFromVector(lLowLegV);
    const lFootV = { x: lms[31].x - lms[27].x, y: lms[31].y - lms[27].y, z: (lms[31].z ?? 0) - (lms[27].z ?? 0) };
    const [lFtRz, lFtRx, lFtRy] = computeEulerAnglesFromVector(lFootV);

    // Right Leg
    const rLegV = { x: lms[26].x - lms[24].x, y: lms[26].y - lms[24].y, z: (lms[26].z ?? 0) - (lms[24].z ?? 0) };
    const [rLegRz, rLegRx, rLegRy] = computeEulerAnglesFromVector(rLegV);
    const rLowLegV = { x: lms[28].x - lms[26].x, y: lms[28].y - lms[26].y, z: (lms[28].z ?? 0) - (lms[26].z ?? 0) };
    const [rLlRz, rLlRx, rLlRy] = computeEulerAnglesFromVector(rLowLegV);
    const rFootV = { x: lms[32].x - lms[28].x, y: lms[32].y - lms[28].y, z: (lms[32].z ?? 0) - (lms[28].z ?? 0) };
    const [rFtRz, rFtRx, rFtRy] = computeEulerAnglesFromVector(rFootV);

    // Combine channels in order matching hierarchy
    const channels = [
      // Hips: 3 pos, 3 rot
      hipX.toFixed(2), hipY.toFixed(2), hipZ.toFixed(2), 0, 0, 0,
      // Spine
      spineRz, spineRx, spineRy,
      // Chest
      0, 0, 0,
      // Neck
      0, 0, 0,
      // Left Shoulder
      0, 0, 0,
      // Left Arm
      lArmRz, lArmRx, lArmRy,
      // Left ForeArm
      lFaRz, lFaRx, lFaRy,
      // Right Shoulder
      0, 0, 0,
      // Right Arm
      rArmRz, rArmRx, rArmRy,
      // Right ForeArm
      rFaRz, rFaRx, rFaRy,
      // Left UpLeg
      lLegRz, lLegRx, lLegRy,
      // Left Leg
      lLlRz, lLlRx, lLlRy,
      // Left Foot
      lFtRz, lFtRx, lFtRy,
      // Right UpLeg
      rLegRz, rLegRx, rLegRy,
      // Right Leg
      rLlRz, rLlRx, rLlRy,
      // Right Foot
      rFtRz, rFtRx, rFtRy,
    ];

    motionLines.push(channels.join(' '));
  }

  const motionHeader = `MOTION
Frames: ${motionLines.length}
Frame Time: ${frameTime}`;

  return `${hierarchy}\n${motionHeader}\n${motionLines.join('\n')}\n`;
}

/**
 * Triggers a client-side download of the BVH mocap animation in the browser.
 */
export function downloadBvhFile(bvhContent: string, filename: string = 'workout-mocap.bvh'): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const blob = new Blob([bvhContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
