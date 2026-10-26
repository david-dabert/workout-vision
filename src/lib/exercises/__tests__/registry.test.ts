import { describe, it, expect } from 'vitest';
import {
  getExercise,
  getExerciseByCountingKey,
  getKinematicArchetype,
  searchExercises,
  getAllExercises,
  getExerciseCount,
} from '../index';

describe('Exercise Catalog & Biomechanical Aliasing Registry', () => {
  it('contains over 1,000 movement variations in local bundle', () => {
    const count = getExerciseCount();
    expect(count).toBeGreaterThanOrEqual(1000);
    const all = getAllExercises();
    expect(all.length).toBe(count);
  });

  it('maps key exercise variations to correct kinematic archetypes and counting keys', () => {
    const testCases = [
      { id: 'barbell_back_squat', expectedArchetype: 'squat', expectedCounting: 'squat' },
      { id: 'pendulum_squat', expectedArchetype: 'squat', expectedCounting: 'hack_squat' },
      { id: 'machine_hack_squat', expectedArchetype: 'squat', expectedCounting: 'hack_squat' },
      { id: '45_degree_leg_press', expectedArchetype: 'squat', expectedCounting: 'leg_press' },
      { id: 'conventional_deadlift', expectedArchetype: 'hinge', expectedCounting: 'deadlift' },
      { id: 'barbell_romanian_deadlift', expectedArchetype: 'hinge', expectedCounting: 'romanian_deadlift' },
      { id: 'barbell_hip_thrust', expectedArchetype: 'hinge', expectedCounting: 'hip_thrust' },
      { id: 'seated_leg_curl', expectedArchetype: 'isolation', expectedCounting: 'leg_curl' },
      { id: 'flat_barbell_bench_press', expectedArchetype: 'push', expectedCounting: 'bench_press' },
      { id: 'incline_dumbbell_press', expectedArchetype: 'push', expectedCounting: 'bench_press' },
      { id: 'standing_barbell_overhead_press', expectedArchetype: 'push', expectedCounting: 'overhead_press' },
      { id: 'bodyweight_dip', expectedArchetype: 'push', expectedCounting: 'dip' },
      { id: 'overhand_pull_up', expectedArchetype: 'pull', expectedCounting: 'pull_up' },
      { id: 'wide_grip_lat_pulldown', expectedArchetype: 'pull', expectedCounting: 'lat_pulldown' },
      { id: 'seated_cable_row', expectedArchetype: 'pull', expectedCounting: 'seated_row' },
      { id: 'standing_barbell_curl', expectedArchetype: 'isolation', expectedCounting: 'bicep_curl' },
      { id: 'tricep_rope_pushdown', expectedArchetype: 'isolation', expectedCounting: 'triceps_pushdown' },
      { id: 'skull_crusher', expectedArchetype: 'isolation', expectedCounting: 'triceps_pushdown' },
      { id: 'dumbbell_lateral_raise', expectedArchetype: 'isolation', expectedCounting: 'lateral_raise' },
      { id: 'captains_chair_knee_raise', expectedArchetype: 'isolation', expectedCounting: 'captains_chair_knee_raise' },
      { id: '45_degree_hyperextension', expectedArchetype: 'hinge', expectedCounting: 'back_extension' },
    ];

    for (const tc of testCases) {
      const ex = getExercise(tc.id);
      expect(ex, `Exercise ${tc.id} should exist`).not.toBeNull();
      expect(ex!.archetype).toBe(tc.expectedArchetype);
      expect(ex!.counting_key).toBe(tc.expectedCounting);
      expect(ex!.primary_muscles.length).toBeGreaterThan(0);
      expect(ex!.execution_cues_en.length).toBeGreaterThan(0);
      expect(ex!.execution_cues_fr.length).toBeGreaterThan(0);
      expect(ex!.hypertrophy_tips_en.length).toBeGreaterThanOrEqual(2);
      expect(ex!.hypertrophy_tips_fr.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('determines kinematic archetypes for any key or slug', () => {
    expect(getKinematicArchetype('squat')).toBe('squat');
    expect(getKinematicArchetype('pendulum_squat')).toBe('squat');
    expect(getKinematicArchetype('deadlift')).toBe('hinge');
    expect(getKinematicArchetype('romanian_deadlift')).toBe('hinge');
    expect(getKinematicArchetype('bench_press')).toBe('push');
    expect(getKinematicArchetype('overhead_press')).toBe('push');
    expect(getKinematicArchetype('pull_up')).toBe('pull');
    expect(getKinematicArchetype('lat_pulldown')).toBe('pull');
    expect(getKinematicArchetype('bicep_curl')).toBe('isolation');
    expect(getKinematicArchetype('lateral_raise')).toBe('isolation');
  });

  it('retrieves exercise by counting key', () => {
    const squatEx = getExerciseByCountingKey('squat');
    expect(squatEx).not.toBeNull();
    expect(squatEx!.archetype).toBe('squat');

    const benchEx = getExerciseByCountingKey('bench_press');
    expect(benchEx).not.toBeNull();
    expect(benchEx!.archetype).toBe('push');
  });

  describe('Search functionality', () => {
    it('finds exercises by English keywords', () => {
      const results = searchExercises('pendulum squat', 'en');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name.toLowerCase()).toContain('pendulum squat');

      const safetyResults = searchExercises('safety bar', 'en');
      expect(safetyResults.length).toBeGreaterThan(0);
      expect(safetyResults[0].name.toLowerCase()).toContain('safety bar');
    });

    it('finds exercises by French keywords', () => {
      const frResults = searchExercises('pendulaire', 'fr');
      expect(frResults.length).toBeGreaterThan(0);
      expect(frResults[0].name_fr.toLowerCase()).toContain('pendulaire');

      const rdlResults = searchExercises('roumain', 'fr');
      expect(rdlResults.length).toBeGreaterThan(0);
      expect(rdlResults[0].name_fr.toLowerCase()).toContain('roumain');
    });

    it('handles empty query and respects search limit', () => {
      expect(searchExercises('')).toEqual([]);
      expect(searchExercises('   ')).toEqual([]);

      const limited = searchExercises('squat', 'en', 5);
      expect(limited.length).toBe(5);
    });
  });
});
