/**
 * EquiVision's simulated horse: the vertical movement of a head (poll) and a pelvis (sacrum) at the trot, written in
 * the code, so the screen can show what a gait assessment measures without pretending to read a real horse.
 *
 * The trot is a two-beat diagonal gait: in each stride the left fore and right hind are in stance together (diagonal A
 * of this simulation, from t = 0), then the right fore and left hind (diagonal B). The head and the pelvis each dip
 * once per diagonal stance, so twice per stride. Status: convention (textbook description of the trot).
 *
 * A lameness is simulated the way the gait literature describes it: the body drops less while the lame limb bears
 * weight. A lame fore shows on the head, a lame hind on the pelvis. Status: convention (the classic "head nod" and
 * "hip hike" teaching; the measures MinDiff and MaxDiff are those of Rhodin et al. 2017, PLoS ONE 12:e0176253, status
 * literature, abstract read through a search summary). Real lameness also changes the other trace and the crests; this
 * simulation changes one dip only, so the drawing stays readable. It is a teaching drawing, not a model of a horse.
 *
 * Each value returned beside the frames (truth) is what the simulation was written with, so the screen can show the
 * engine's reading next to the true value, as the volleyball demo does (docs/VISION.md, honesty rules for demos).
 */
import type { EquineFrame } from './kinematics';

export type EquineScenario = 'sound' | 'fore' | 'hind';

export interface SimulationOptions {
  fps?: number;
  durationSec?: number;
  strideMs?: number;
}

export interface SimulationTruth {
  strideMs: number;
  /** Dip of diagonal A minus dip of diagonal B, in mm, for each trace. */
  headMinDiffMm: number;
  pelvisMinDiffMm: number;
}

// Depth of each dip below the crests, in mm, for a regular trot.
// Status: UNSOURCED (chosen so the drawing reads at phone width; not a measured horse).
export const HEAD_DIP_MM = 60;
export const PELVIS_DIP_MM = 40;
// How much less the body drops while the lame limb bears weight, in mm.
// Status: UNSOURCED (chosen to sit well above the 6 mm head and 3 mm pelvis thresholds cited on the screen, so the
// difference is visible; real lameness spans from below those thresholds to far above them).
export const FORE_LAMENESS_MM = 20;
export const HIND_LAMENESS_MM = 10;

/** The simulation's defaults: 30 frames a second, 6 strides of 0.7 s (1.43 Hz). Status: UNSOURCED (a plausible trot). */
export const SIMULATION_DEFAULTS = { fps: 30, durationSec: 4.2, strideMs: 700 } as const;

/**
 * One trace over time: two dips per stride of depth `dip` (mm below the crests at 0), the dip of diagonal A made
 * shallower by `lame` mm. Smooth everywhere, crests always at 0, so only the minima differ (MaxDiff 0).
 */
function trace(tMs: number, strideMs: number, dip: number, lame: number): number {
  const twice = Math.cos((4 * Math.PI * tMs) / strideMs); // 1 at both dips of a stride, -1 at both crests
  const onA = (1 + Math.cos((2 * Math.PI * tMs) / strideMs)) / 2; // 1 at dip A, 0 at dip B
  return -((dip - lame * onA) / 2) * (1 + twice);
}

/** The frames of a simulated trot, and the values they were written with. */
export function simulateTrot(scenario: EquineScenario, options: SimulationOptions = {}): { frames: EquineFrame[]; truth: SimulationTruth } {
  const fps = options.fps ?? SIMULATION_DEFAULTS.fps;
  const durationSec = options.durationSec ?? SIMULATION_DEFAULTS.durationSec;
  const strideMs = options.strideMs ?? SIMULATION_DEFAULTS.strideMs;
  if (!['sound', 'fore', 'hind'].includes(scenario)) throw new RangeError(`simulateTrot: unknown scenario ${scenario}`);
  const headLame = scenario === 'fore' ? FORE_LAMENESS_MM : 0;
  const pelvisLame = scenario === 'hind' ? HIND_LAMENESS_MM : 0;
  const n = Math.round(fps * durationSec);
  const frames: EquineFrame[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / fps) * 1000;
    frames.push({
      timestamp: t,
      landmarks: {
        poll: { x: 0.8, y: trace(t, strideMs, HEAD_DIP_MM, headLame) },
        sacrum: { x: 0.2, y: trace(t, strideMs, PELVIS_DIP_MM, pelvisLame) },
      },
    });
  }
  return { frames, truth: { strideMs, headMinDiffMm: headLame, pelvisMinDiffMm: pelvisLame } };
}
