import { describe, it, expect } from 'vitest';
import { KINEMATIC_ALIASES, liftDefinition, LIFTS } from '../core';
import catalogue from '../../guide-catalog.json';
import { searchMatch, searchWords } from '../../../components/experience/search-text';

describe('Kinematic Aliasing Registry & Catalog Expansion', () => {
  it('maps all defined gym variations to valid parent archetypes with countable definitions', () => {
    for (const [alias, parent] of Object.entries(KINEMATIC_ALIASES)) {
      expect(typeof parent).toBe('string');
      const parentDef = liftDefinition(parent);
      expect(parentDef, `Parent definition for ${parent} (aliased from ${alias}) must exist`).not.toBeNull();
      const aliasDef = liftDefinition(alias);
      expect(aliasDef, `Alias definition for ${alias} must resolve`).toEqual(parentDef);
    }
  });

  describe('Pattern 1: Lower Body — Quad Dominant (Squats & Machine Presses)', () => {
    const squatVariants = [
      'barbell_squat', 'safety_bar_squat', 'zercher_squat', 'box_squat', 'belt_squat', 'smith_machine_squat', 'smith_squat',
    ];

    it.each(squatVariants)('%s routes to squat archetype and inherits knee kinematics', (key) => {
      expect(KINEMATIC_ALIASES[key]).toBe('squat');
      const def = liftDefinition(key)!;
      expect(def.joint).toBe('knee');
      expect(def.rest).toBe('high');
      expect(def.first).toBe('eccentric');
      expect(def.workMargin).toBeCloseTo(1 / 3, 4);
    });

    it('pendulum_squat routes to hack_squat and inherits platform occlusion guards', () => {
      expect(KINEMATIC_ALIASES.pendulum_squat).toBe('hack_squat');
      const def = liftDefinition('pendulum_squat')!;
      expect(def.joint).toBe('knee');
      expect(def.rest).toBe('high');
      expect(def.first).toBe('eccentric');
      expect(def.fixedFeet).toBe(true);
      expect(def.clampFootplateInversion).toBe(true);
    });

    it('leg press variants route to leg_press archetype', () => {
      for (const key of ['horizontal_leg_press', 'vertical_leg_press', 'single_leg_press']) {
        expect(KINEMATIC_ALIASES[key]).toBe('leg_press');
        expect(liftDefinition(key)).toEqual(liftDefinition('leg_press'));
      }
    });

    it('lunge variants route to lunge archetype', () => {
      expect(KINEMATIC_ALIASES.side_lunge).toBe('lunge');
      expect(liftDefinition('side_lunge')).toEqual(liftDefinition('lunge'));
    });
  });

  describe('Pattern 2: Lower Body — Posterior Chain (Hinges & Isolations)', () => {
    it('deadlift and stiff-leg variations inherit hip hinge kinematics', () => {
      expect(KINEMATIC_ALIASES.stiff_legged_deadlift).toBe('romanian_deadlift');
      expect(KINEMATIC_ALIASES.good_morning).toBe('romanian_deadlift');
      expect(liftDefinition('stiff_legged_deadlift')).toEqual(liftDefinition('romanian_deadlift'));
      expect(liftDefinition('good_morning')).toEqual(liftDefinition('romanian_deadlift'));

      expect(KINEMATIC_ALIASES.deficit_deadlift).toBe('deadlift');
      expect(liftDefinition('deficit_deadlift')).toEqual(liftDefinition('deadlift'));
    });

    it('hip thrust variations route to hip_thrust archetype', () => {
      for (const key of ['barbell_hip_thrust', 'machine_hip_thrust']) {
        expect(KINEMATIC_ALIASES[key]).toBe('hip_thrust');
        expect(liftDefinition(key)).toEqual(LIFTS.hip_thrust);
      }
    });

    it('leg curl variations route to leg_curl archetype', () => {
      expect(KINEMATIC_ALIASES.standing_leg_curl).toBe('leg_curl');
      expect(liftDefinition('standing_leg_curl')).toEqual(LIFTS.leg_curl);
    });
  });

  describe('Pattern 3: Upper Body — Horizontal & Vertical Push', () => {
    it('bench press equipment variations route to bench_press archetype', () => {
      for (const key of ['wide_grip_bench_press', 'cambered_bar_bench_press']) {
        expect(KINEMATIC_ALIASES[key]).toBe('bench_press');
        expect(liftDefinition(key)).toEqual(LIFTS.bench_press);
      }
    });

    it('dip variations route to dip archetype', () => {
      for (const key of ['dips', 'tricep_dip']) {
        expect(KINEMATIC_ALIASES[key]).toBe('dip');
        expect(liftDefinition(key)).toEqual(liftDefinition('dip'));
      }
    });

    it('overhead press variations route to overhead_press archetype', () => {
      for (const key of ['seated_barbell_press', 'dumbbell_shoulder_press']) {
        expect(KINEMATIC_ALIASES[key]).toBe('overhead_press');
        expect(liftDefinition(key)).toEqual(LIFTS.overhead_press);
      }
    });
  });

  describe('Pattern 4: Upper Body — Horizontal & Vertical Pull', () => {
    it('lat pulldown grip variations route to lat_pulldown archetype', () => {
      for (const key of ['neutral_grip_lat_pulldown', 'reverse_grip_lat_pulldown', 'single_arm_lat_pulldown']) {
        expect(KINEMATIC_ALIASES[key]).toBe('lat_pulldown');
        expect(liftDefinition(key)).toEqual(LIFTS.lat_pulldown);
      }
    });

    it('pull up variations route to pull_up archetype', () => {
      expect(KINEMATIC_ALIASES.wide_grip_pull_up).toBe('pull_up');
      expect(liftDefinition('wide_grip_pull_up')).toEqual(liftDefinition('pull_up'));
    });

    it('rowing variations route to row archetypes', () => {
      expect(KINEMATIC_ALIASES.bent_over_row).toBe('seated_row');
      expect(KINEMATIC_ALIASES.seated_cable_row).toBe('seated_row');
      expect(KINEMATIC_ALIASES.dumbbell_row).toBe('dumbbell_row');
      expect(liftDefinition('bent_over_row')).toEqual(LIFTS.seated_row);
      expect(liftDefinition('dumbbell_row')).toEqual(LIFTS.dumbbell_row);
    });
  });

  describe('Pattern 5: Upper Body — Shoulders & Arms Isolations', () => {
    it('lateral raise variations route to shoulder archetypes', () => {
      expect(KINEMATIC_ALIASES.dumbbell_lateral_raise).toBe('lateral_raise');
      expect(liftDefinition('dumbbell_lateral_raise')).toEqual(LIFTS.lateral_raise);
    });

    it('biceps curl variations route to bicep_curl archetype', () => {
      expect(KINEMATIC_ALIASES.dumbbell_curl).toBe('bicep_curl');
      expect(liftDefinition('dumbbell_curl')).toEqual(LIFTS.bicep_curl);
    });

    it('triceps extension variations route to triceps_pushdown archetype', () => {
      for (const key of [
        'triceps_pushdown', 'tricep_rope_pushdown', 'straight_bar_pushdown',
        'skull_crusher', 'lying_triceps_extension', 'overhead_cable_triceps_extension', 'overhead_dumbbell_extension',
      ]) {
        expect(KINEMATIC_ALIASES[key]).toBe('triceps_pushdown');
        expect(liftDefinition(key)).toEqual(LIFTS.triceps_pushdown);
      }
    });
  });

  describe('Pattern 6: Core & Spinal Ergonomics', () => {
    it('back extension and hyperextension route to back_extension archetype', () => {
      expect(KINEMATIC_ALIASES.hyperextension).toBe('back_extension');
      expect(liftDefinition('hyperextension')).toEqual(liftDefinition('back_extension'));
    });

    it('captains chair variations route to hanging_knee_raise archetype', () => {
      expect(KINEMATIC_ALIASES.captains_chair_leg_raise).toBe('captains_chair_knee_raise');
      expect(liftDefinition('captains_chair_leg_raise')).toEqual(liftDefinition('captains_chair_knee_raise'));
    });
  });

  describe('Catalogue Search Discovery', () => {
    const exerciseWords = new Map(catalogue.map(e => [
      e.key,
      searchWords([e.fr, e.name, ...e.aliases, e.equipment].join(' ')),
    ]));

    const queries = [
      { q: 'pendulum squat', expectedKey: 'hack_squat' },
      { q: 'safety bar', expectedKey: 'squat' },
      { q: 'box squat', expectedKey: 'squat' },
      { q: 'cambered bar', expectedKey: 'bench_press' },
      { q: 'neutral grip', expectedKey: 'lat_pulldown' },
      { q: 'skull crusher', expectedKey: 'tricep_pushdown' },
      { q: 'hyperextension', expectedKey: 'back_extension' },
      { q: 'dips triceps', expectedKey: 'dip' },
      { q: 'presse a cuisses horizontale', expectedKey: 'leg_press' },
    ];

    it.each(queries)('search query "$q" finds exercise "$expectedKey"', ({ q, expectedKey }) => {
      const words = exerciseWords.get(expectedKey);
      expect(words).toBeDefined();
      expect(searchMatch(words, q)).toBe(true);
    });
  });
});
