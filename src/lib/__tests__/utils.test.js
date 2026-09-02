/**
 * Tests for shared utility functions.
 *
 * Covers: gradeFromScore, gradeClass, translateMuscle.
 * These are pure functions with no dependencies.
 */

import { describe, it, expect } from 'vitest';
import { gradeFromScore, gradeClass, translateMuscle, MUSCLE_FR } from '../utils';

// ---------------------------------------------------------------------------
// gradeFromScore — maps a numeric score (0-100) to a letter grade
// ---------------------------------------------------------------------------

describe('gradeFromScore', () => {
  it('returns A+ for scores >= 95', () => {
    expect(gradeFromScore(95)).toBe('A+');
    expect(gradeFromScore(100)).toBe('A+');
    expect(gradeFromScore(99.5)).toBe('A+');
  });

  it('returns A for scores 90-94', () => {
    expect(gradeFromScore(90)).toBe('A');
    expect(gradeFromScore(94)).toBe('A');
  });

  it('returns B+ for scores 85-89', () => {
    expect(gradeFromScore(85)).toBe('B+');
    expect(gradeFromScore(89)).toBe('B+');
  });

  it('returns B for scores 80-84', () => {
    expect(gradeFromScore(80)).toBe('B');
    expect(gradeFromScore(84)).toBe('B');
  });

  it('returns C+ for scores 70-79', () => {
    expect(gradeFromScore(70)).toBe('C+');
    expect(gradeFromScore(79)).toBe('C+');
  });

  it('returns C for scores 60-69', () => {
    expect(gradeFromScore(60)).toBe('C');
    expect(gradeFromScore(69)).toBe('C');
  });

  it('returns D for scores 50-59', () => {
    expect(gradeFromScore(50)).toBe('D');
    expect(gradeFromScore(59)).toBe('D');
  });

  it('returns F for scores below 50', () => {
    expect(gradeFromScore(49)).toBe('F');
    expect(gradeFromScore(0)).toBe('F');
    expect(gradeFromScore(10)).toBe('F');
  });

  it('handles exact boundary values correctly', () => {
    // Each boundary is the lower bound of the next grade
    const boundaries = [
      [95, 'A+'], [90, 'A'], [85, 'B+'], [80, 'B'],
      [70, 'C+'], [60, 'C'], [50, 'D'],
    ];
    for (const [score, expected] of boundaries) {
      expect(gradeFromScore(score)).toBe(expected);
      // One point below should yield the previous grade
      expect(gradeFromScore(score - 1)).not.toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// gradeClass — maps a numeric score to a CSS class name
// ---------------------------------------------------------------------------

describe('gradeClass', () => {
  it('returns grade-a for scores >= 90', () => {
    expect(gradeClass(90)).toBe('grade-a');
    expect(gradeClass(100)).toBe('grade-a');
  });

  it('returns grade-b for scores 75-89', () => {
    expect(gradeClass(75)).toBe('grade-b');
    expect(gradeClass(89)).toBe('grade-b');
  });

  it('returns grade-c for scores 60-74', () => {
    expect(gradeClass(60)).toBe('grade-c');
    expect(gradeClass(74)).toBe('grade-c');
  });

  it('returns grade-d for scores below 60', () => {
    expect(gradeClass(59)).toBe('grade-d');
    expect(gradeClass(0)).toBe('grade-d');
  });
});

// ---------------------------------------------------------------------------
// translateMuscle — returns French muscle name when lang is 'fr'
// ---------------------------------------------------------------------------

describe('translateMuscle', () => {
  it('returns French name for known muscles when lang is fr', () => {
    expect(translateMuscle('Pectorals', 'fr')).toBe('Pectoraux');
    expect(translateMuscle('Quadriceps', 'fr')).toBe('Quadriceps');
    expect(translateMuscle('Latissimus Dorsi', 'fr')).toBe('Grand dorsal');
    expect(translateMuscle('Hamstrings', 'fr')).toBe('Ischio-jambiers');
    expect(translateMuscle('Glutes', 'fr')).toBe('Fessiers');
    expect(translateMuscle('Core', 'fr')).toBe('Gainage');
  });

  it('returns the original name when lang is not fr', () => {
    expect(translateMuscle('Pectorals', 'en')).toBe('Pectorals');
    expect(translateMuscle('Glutes', 'en')).toBe('Glutes');
  });

  it('returns the original name for unknown muscles even in fr', () => {
    expect(translateMuscle('UnknownMuscle', 'fr')).toBe('UnknownMuscle');
  });

  it('covers all entries in the MUSCLE_FR dictionary', () => {
    for (const [en, fr] of Object.entries(MUSCLE_FR)) {
      expect(translateMuscle(en, 'fr')).toBe(fr);
    }
  });
});
