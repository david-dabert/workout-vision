/**
 * Close variants counted as their parent (core.ts, COUNT_AS; audit of 6 October 2026, action 6): each push-up and
 * pull-up variant listed takes its parent's whole definition, and its guide pattern carries the parent's side rule.
 * Status: experimental; no labelled set holds these keys.
 */
import { describe, expect, it } from 'vitest';
import { COUNT_AS, liftDefinition } from '../core';
import patternsJson from '../guide-patterns.json';

const patterns = patternsJson as Record<string, string>;
const PUSH = ['knee_push_up', 'incline_push_up', 'decline_push_up', 'wide_push_up', 'diamond_push_up', 'weighted_push_up'];
const PULL = ['assisted_pull_up', 'weighted_pull_up', 'neutral_grip_pull_up', 'commando_pull_up', 'l_sit_pull_up', 'towel_pull_up', 'chin_up', 'assisted_chin_up', 'weighted_chin_up'];

describe('close variants are counted by their parent\'s definition', () => {
  it('lists exactly the push-up and pull-up variants', () => {
    expect(Object.keys(COUNT_AS).sort()).toEqual([...PUSH, ...PULL].sort());
  });

  it.each([...PUSH.map(k => [k, 'push_up']), ...PULL.map(k => [k, 'pull_up'])])('%s is counted as %s', (key, parent) => {
    expect(COUNT_AS[key]).toBe(parent);
    expect(liftDefinition(key)).toEqual(liftDefinition(parent));
    expect(patterns[key]).toBe(patterns[parent]);
  });

  it('leaves the pike, wall, shoulder-tap and archer push-ups on their own patterns', () => {
    for (const key of ['pike_push_up', 'feet_elevated_pike_push_up', 'wall_push_up', 'push_up_shoulder_tap', 'archer_push_up']) {
      expect(Object.hasOwn(COUNT_AS, key), key).toBe(false);
      expect(liftDefinition(key), key).not.toEqual(liftDefinition('push_up'));
    }
  });
});
