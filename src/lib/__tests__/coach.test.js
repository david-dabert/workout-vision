/**
 * Tests for the coaching intelligence layer.
 *
 * Covers:
 *   - generateWorkoutReport: post-workout summary, grading, highlights
 *   - calculateWorkloadRatio: acute:chronic workload ratio (Gabbett 2016)
 *   - estimateOneRepMax: Brzycki/Epley 1RM estimation
 *   - getStrengthLevel: population-relative strength classification
 *   - _scoreToGrade: internal grade boundary mapping
 */

import { describe, it, expect, vi } from 'vitest';
import {
  generateWorkoutReport,
  calculateWorkloadRatio,
  estimateOneRepMax,
  getStrengthLevel,
} from '../coach';

// ---------------------------------------------------------------------------
// generateWorkoutReport
// ---------------------------------------------------------------------------

describe('generateWorkoutReport', () => {
  it('returns a valid report structure for a simple workout', () => {
    const profile = { bodyweight: 80, sex: 'male', experience: 'intermediate' };
    const results = [
      {
        exerciseKey: 'squat',
        reps: 8,
        sets: 3,
        weight: 80,
        analysis: {
          movementQuality: 75,
          asymmetry: { score: 5 },
          fatigue: { velocityDropoff: 10 },
          rangeOfMotion: { consistency: 85 },
        },
      },
    ];

    const report = generateWorkoutReport(profile, results);

    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('grade');
    expect(report).toHaveProperty('highlights');
    expect(report).toHaveProperty('improvements');
    expect(report).toHaveProperty('volumeLoad');
    expect(report).toHaveProperty('musclesWorked');

    // Grade should be C+ (score 75 maps to 70-79 range)
    expect(report.grade).toBe('C+');

    // Volume load = reps * sets * weight = 8 * 3 * 80 = 1920
    expect(report.volumeLoad).toBe(1920);

    // Squat primary muscles: Quadriceps and Glutes
    const muscleNames = report.musclesWorked.map(m => m.name);
    expect(muscleNames).toContain('Quadriceps');
    expect(muscleNames).toContain('Glutes');
  });

  it('returns grade D and improvement suggestion when no exercises provided', () => {
    const profile = { bodyweight: 70 };
    const report = generateWorkoutReport(profile, []);

    expect(report.grade).toBe('D');
    expect(report.volumeLoad).toBe(0);
    expect(report.musclesWorked).toHaveLength(0);
    expect(report.improvements.length).toBeGreaterThan(0);
  });

  it('returns grade D when exerciseResults is null', () => {
    const report = generateWorkoutReport({}, null);
    expect(report.grade).toBe('D');
  });

  it('flags high velocity dropoff as an improvement area', () => {
    const results = [
      {
        exerciseKey: 'bench_press',
        reps: 10,
        sets: 3,
        weight: 60,
        analysis: {
          movementQuality: 65,
          fatigue: { velocityDropoff: 35 },
          asymmetry: { score: 8 },
          rangeOfMotion: { consistency: 90 },
        },
      },
    ];

    const report = generateWorkoutReport({}, results);
    const velocityImprovement = report.improvements.find(
      i => i.key === 'coach_velocity_drop'
    );
    expect(velocityImprovement).toBeDefined();
  });

  it('highlights good symmetry when asymmetry score is low', () => {
    const results = [
      {
        exerciseKey: 'squat',
        reps: 5,
        sets: 4,
        weight: 100,
        analysis: {
          movementQuality: 90,
          asymmetry: { score: 5 },
          fatigue: { velocityDropoff: 8 },
          rangeOfMotion: { consistency: 95 },
        },
      },
    ];

    const report = generateWorkoutReport({}, results);
    const symmetryHighlight = report.highlights.find(
      h => h.key === 'coach_symmetry'
    );
    expect(symmetryHighlight).toBeDefined();
  });

  it('handles multiple exercises and aggregates muscles', () => {
    const results = [
      { exerciseKey: 'squat', reps: 5, sets: 3, weight: 100 },
      { exerciseKey: 'bench_press', reps: 8, sets: 3, weight: 60 },
      { exerciseKey: 'bent_over_row', reps: 8, sets: 3, weight: 50 },
    ];

    const report = generateWorkoutReport({}, results);

    // Should have muscles from all three exercises
    expect(report.musclesWorked.length).toBeGreaterThanOrEqual(3);

    // Total volume = (5*3*100) + (8*3*60) + (8*3*50) = 1500 + 1440 + 1200 = 4140
    expect(report.volumeLoad).toBe(4140);
  });
});

// ---------------------------------------------------------------------------
// _scoreToGrade (tested via generateWorkoutReport output)
// ---------------------------------------------------------------------------

describe('_scoreToGrade (via generateWorkoutReport)', () => {
  // We test the internal _scoreToGrade by controlling movementQuality input
  const makeResult = (quality) => [{
    exerciseKey: 'squat',
    reps: 5,
    sets: 1,
    analysis: { movementQuality: quality },
  }];

  it('maps 95 to A+', () => {
    expect(generateWorkoutReport({}, makeResult(95)).grade).toBe('A+');
  });

  it('maps 90 to A', () => {
    expect(generateWorkoutReport({}, makeResult(90)).grade).toBe('A');
  });

  it('maps 85 to B+', () => {
    expect(generateWorkoutReport({}, makeResult(85)).grade).toBe('B+');
  });

  it('maps 80 to B', () => {
    expect(generateWorkoutReport({}, makeResult(80)).grade).toBe('B');
  });

  it('maps 70 to C+', () => {
    expect(generateWorkoutReport({}, makeResult(70)).grade).toBe('C+');
  });

  it('maps 60 to C', () => {
    expect(generateWorkoutReport({}, makeResult(60)).grade).toBe('C');
  });

  it('maps 50 to D', () => {
    expect(generateWorkoutReport({}, makeResult(50)).grade).toBe('D');
  });

  it('maps 30 to F', () => {
    expect(generateWorkoutReport({}, makeResult(30)).grade).toBe('F');
  });
});

// ---------------------------------------------------------------------------
// calculateWorkloadRatio — acute:chronic workload ratio (Gabbett 2016)
// ---------------------------------------------------------------------------

describe('calculateWorkloadRatio', () => {
  it('returns zero ratio and undertraining for empty history', () => {
    const result = calculateWorkloadRatio([]);
    expect(result.ratio).toBe(0);
    expect(result.zone).toBe('undertraining');
  });

  it('returns zero for null history', () => {
    const result = calculateWorkloadRatio(null);
    expect(result.ratio).toBe(0);
  });

  it('returns optimal zone for steady training (ratio ~1.0)', () => {
    const now = new Date();
    const history = [];

    // 4 weeks of consistent training: 3 sessions/week, load 100 each
    for (let week = 0; week < 4; week++) {
      for (let session = 0; session < 3; session++) {
        const daysAgo = week * 7 + session * 2;
        const date = new Date(now - daysAgo * 86400000);
        history.push({ date: date.toISOString(), load: 100 });
      }
    }

    const result = calculateWorkloadRatio(history);
    expect(result.ratio).toBeGreaterThanOrEqual(0.8);
    expect(result.ratio).toBeLessThanOrEqual(1.5);
    expect(result.zone).toBe('optimal');
  });

  it('detects danger zone when acute load spikes', () => {
    const now = new Date();
    const history = [];

    // Weeks 2-4: light training (load 50 per session, 2 sessions/week)
    for (let week = 1; week < 4; week++) {
      for (let session = 0; session < 2; session++) {
        const daysAgo = week * 7 + session * 3;
        const date = new Date(now - daysAgo * 86400000);
        history.push({ date: date.toISOString(), load: 50 });
      }
    }

    // This week: massive spike (load 500 per session, 5 sessions)
    for (let session = 0; session < 5; session++) {
      const daysAgo = session;
      const date = new Date(now - daysAgo * 86400000);
      history.push({ date: date.toISOString(), load: 500 });
    }

    const result = calculateWorkloadRatio(history);
    expect(result.ratio).toBeGreaterThan(1.5);
    expect(result.zone).toBe('danger');
  });

  it('returns a numeric ratio between 0 and ~5 for typical inputs', () => {
    const now = new Date();
    const history = [
      { date: new Date(now - 1 * 86400000).toISOString(), load: 200 },
      { date: new Date(now - 3 * 86400000).toISOString(), load: 150 },
      { date: new Date(now - 10 * 86400000).toISOString(), load: 100 },
      { date: new Date(now - 17 * 86400000).toISOString(), load: 100 },
      { date: new Date(now - 24 * 86400000).toISOString(), load: 100 },
    ];

    const result = calculateWorkloadRatio(history);
    expect(typeof result.ratio).toBe('number');
    expect(result.ratio).toBeGreaterThanOrEqual(0);
    expect(result.ratio).toBeLessThan(5);
    expect(['undertraining', 'optimal', 'caution', 'danger']).toContain(result.zone);
  });

  it('ignores entries older than 28 days', () => {
    const now = new Date();
    const history = [
      { date: new Date(now - 30 * 86400000).toISOString(), load: 10000 },
      { date: new Date(now - 2 * 86400000).toISOString(), load: 100 },
    ];

    const result = calculateWorkloadRatio(history);
    // The old entry should be ignored; acute = 100, chronic includes only recent
    expect(result.acuteLoad).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// estimateOneRepMax — Brzycki (<=10 reps) and Epley (>10 reps)
// ---------------------------------------------------------------------------

describe('estimateOneRepMax', () => {
  it('returns the weight itself for 1 rep', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it('estimates higher 1RM for more reps at the same weight', () => {
    const fiveReps = estimateOneRepMax(80, 5);
    const tenReps = estimateOneRepMax(80, 10);
    expect(fiveReps).toBeGreaterThan(80);
    expect(tenReps).toBeGreaterThan(fiveReps);
  });

  it('returns 0 for invalid inputs', () => {
    expect(estimateOneRepMax(0, 5)).toBe(0);
    expect(estimateOneRepMax(100, 0)).toBe(0);
    expect(estimateOneRepMax(-10, 5)).toBe(0);
    expect(estimateOneRepMax(null, 5)).toBe(0);
  });

  it('uses Brzycki formula for <= 10 reps (known value check)', () => {
    // Brzycki: 1RM = weight / (1.0278 - 0.0278 * reps)
    // At 100kg for 5 reps: 1RM = 100 / (1.0278 - 0.139) = 100 / 0.8888 = ~112.5
    const result = estimateOneRepMax(100, 5);
    expect(result).toBeGreaterThan(110);
    expect(result).toBeLessThan(115);
  });

  it('uses Epley formula for > 10 reps', () => {
    // Epley: 1RM = weight * (1 + reps/30)
    // At 60kg for 15 reps: 1RM = 60 * (1 + 0.5) = 90
    expect(estimateOneRepMax(60, 15)).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// getStrengthLevel — population-relative strength classification
// ---------------------------------------------------------------------------

describe('getStrengthLevel', () => {
  it('returns beginner for low relative strength', () => {
    // Squat male beginner threshold: 0.75 * BW
    // 40kg squat at 80kg BW = 0.5 ratio = below beginner
    expect(getStrengthLevel('squat', 40, 80, 'male')).toBe('beginner');
  });

  it('returns intermediate for moderate relative strength', () => {
    // Squat male intermediate threshold: 1.5 * BW
    // 120kg at 80kg = 1.5 ratio = intermediate
    expect(getStrengthLevel('squat', 120, 80, 'male')).toBe('intermediate');
  });

  it('returns elite for very high relative strength', () => {
    // Squat male elite threshold: 2.5 * BW
    // 210kg at 80kg = 2.625 ratio
    expect(getStrengthLevel('squat', 210, 80, 'male')).toBe('elite');
  });

  it('uses female standards when sex is female', () => {
    // Squat female intermediate: 1.0 * BW
    // 60kg at 60kg = 1.0 ratio = intermediate
    expect(getStrengthLevel('squat', 60, 60, 'female')).toBe('intermediate');
  });

  it('returns beginner for missing inputs', () => {
    expect(getStrengthLevel('squat', 0, 80, 'male')).toBe('beginner');
    expect(getStrengthLevel('squat', 100, 0, 'male')).toBe('beginner');
  });

  it('returns intermediate for unknown exercises', () => {
    expect(getStrengthLevel('unknown_exercise', 100, 80, 'male')).toBe('intermediate');
  });
});
