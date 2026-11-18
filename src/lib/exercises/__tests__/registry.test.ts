// The exercise details read from the one catalogue (18 November 2026): the former registry's 1,296 ids (144 movements x
// 9 training techniques) each name their movement's catalogue exercise, and the catalogue's own keys and variants read
// directly.
import { describe, it, expect } from 'vitest';
import catalogue from '../../guide-catalog.json';
import {
  getExercise,
  getExerciseByCountingKey,
  getKinematicArchetype,
  searchExercises,
  getAllExercises,
  getExerciseCount,
} from '../index';

describe('exercise details from the one catalogue', () => {
  it('hold every catalogue exercise, variants included, and no technique as an exercise', () => {
    expect(getExerciseCount()).toBe(catalogue.length);
    expect(getAllExercises().map(e => e.id)).toEqual(catalogue.map(e => e.key));
    expect(getAllExercises().some(e => /drop set|rest-pause|tempo/i.test(e.name))).toBe(false);
  });

  it('read a former registry id as its movement\'s exercise, counted by that exercise', () => {
    const cases = [
      ['barbell_back_squat', 'squat', 'squat', 'squat'],
      ['pendulum_squat', 'hack_squat--pendulum', 'squat', 'hack_squat'],
      ['machine_hack_squat', 'hack_squat', 'squat', 'hack_squat'],
      ['45_degree_leg_press', 'leg_press', 'squat', 'leg_press'],
      ['conventional_deadlift', 'deadlift', 'hinge', 'deadlift'],
      ['barbell_hip_thrust', 'hip_thrust', 'hinge', 'hip_thrust'],
      ['flat_barbell_bench_press', 'bench_press', 'push', 'bench_press'],
      ['incline_dumbbell_press', 'incline_dumbbell_press', 'push', 'incline_dumbbell_press'],
      ['overhand_pull_up', 'pull_up', 'pull', 'pull_up'],
      ['seated_cable_row', 'seated_row', 'pull', 'seated_row'],
      ['skull_crusher', 'skull_crusher', 'isolation', 'skull_crusher'],
      ['45_degree_hyperextension', 'back_extension', 'hinge', 'back_extension'],
    ];
    for (const [id, key, archetype, counting] of cases) {
      const ex = getExercise(id);
      expect(ex, id).not.toBeNull();
      expect(ex!.id, id).toBe(key);
      expect(ex!.archetype, id).toBe(archetype);
      expect(ex!.counting_key, id).toBe(counting);
      expect(ex!.execution_cues_en.length, id).toBeGreaterThan(0);
      expect(ex!.execution_cues_fr.length, id).toBeGreaterThan(0);
    }
  });

  it('read a technique\'s id as its movement, with the technique\'s cue added', () => {
    const plain = getExercise('barbell_back_squat')!, drop = getExercise('barbell_back_squat_drop_set')!;
    expect(drop.id).toBe('squat');
    expect(drop.modifier).toBe('drop_set');
    expect(drop.execution_cues_en.length).toBe(plain.execution_cues_en.length + 1);
  });

  it('read a variant as itself, counted by its base, with its base\'s cues', () => {
    const v = getExercise('squat--box')!;
    expect(v.name).toBe('Box Squat');
    expect(v.counting_key).toBe('squat');
    expect(v.archetype).toBe('squat');
    expect(v.execution_cues_en).toEqual(getExercise('squat')!.execution_cues_en);
    expect(getExercise('no_such_exercise')).toBeNull();
  });

  it('determines kinematic archetypes for any key', () => {
    expect(getKinematicArchetype('squat')).toBe('squat');
    expect(getKinematicArchetype('pendulum_squat')).toBe('squat');
    expect(getKinematicArchetype('deadlift')).toBe('hinge');
    expect(getKinematicArchetype('bench_press')).toBe('push');
    expect(getKinematicArchetype('lat_pulldown')).toBe('pull');
    expect(getKinematicArchetype('bicep_curl')).toBe('isolation');
    expect(getExerciseByCountingKey('bench_press')!.archetype).toBe('push');
  });

  it('search the catalogue in English and French, variants included', () => {
    expect(searchExercises('pendulum squat').map(e => e.id)).toContain('hack_squat--pendulum');
    expect(searchExercises('pendulaire', 'fr').map(e => e.id)).toContain('hack_squat--pendulum');
    expect(searchExercises('roumain', 'fr').some(e => e.name_fr.toLowerCase().includes('roumain'))).toBe(true);
    expect(searchExercises('')).toEqual([]);
    expect(searchExercises('squat', 'en', 5)).toHaveLength(5);
  });
});
