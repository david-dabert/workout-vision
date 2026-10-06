/**
 * One limb at a time (audit of 6 October 2026, action 6). selectSide counts the side whose three landmarks are
 * better seen; on a one-arm row, a pistol squat, a single-leg Romanian deadlift or a standing hip abduction that
 * can be the idle limb, held still, and the set reads 0. These exercises are counted on each side and keep the
 * side with more reps (`eitherSide`, core.ts). Angles and visibilities are illustrative (UNSOURCED): the working
 * limb seen at 0.8 on every sample, the idle one at 0.99 and held at its rest angle with a 1° wobble.
 * Status: experimental; no labelled set holds these exercises.
 */
import { describe, expect, it } from 'vitest';
import { countReps, liftDefinition, JOINT_POINTS } from '../core';
import { cycles, jointFrame, sample, seeded, timestamps, type Side } from './synthetic';

export const ONE_LIMB = [
  'one_arm_dumbbell_row', 'single_arm_cable_row', 'meadows_row', 'concentration_curl',
  'single_arm_dumbbell_tricep_extension',
  'pistol_squat', 'assisted_pistol_squat', 'single_leg_box_squat', 'skater_squat', 'shrimp_squat', 'step_down',
  'single_leg_romanian_deadlift', 'single_leg_glute_bridge',
  'cable_standing_hip_abduction', 'cable_standing_hip_adduction', 'banded_standing_hip_abduction',
  'side_lying_hip_abduction', 'side_lying_leg_raise', 'donkey_kick', 'banded_donkey_kick',
];

describe('a one-limb exercise is counted on the working limb, even when the idle one is better seen', () => {
  it.each(ONE_LIMB.flatMap(key => (['left', 'right'] as Side[]).map(working => [key, working] as const)))('%s, working %s', (key, working) => {
    const def = liftDefinition(key)!;
    expect(def, key).not.toBeNull();
    const rest = def.rest === 'high' ? 170 : def.joint === 'shoulder' ? 20 : 80;
    const work = def.rest === 'high' ? rest - 90 : rest + 90;
    const sps = 30;
    const moving = sample(cycles({ rest, work, firstSec: 1.2, secondSec: 0.8 }), rest, sps);
    const rng = seeded(6);
    const idle: Side = working === 'left' ? 'right' : 'left';
    const frames = moving.map(a => {
      const frame = jointFrame(def.joint, { [working]: a, [idle]: rest + (rng() - 0.5) })!;
      for (const i of JOINT_POINTS[def.joint][working]) frame[i] = { ...frame[i], visibility: 0.8 };
      return frame;
    });
    const result = countReps(frames, timestamps(moving.length, sps), key);
    expect(result.count).toBe(10);
    expect(result.arm).toBe(working);
  });
});
