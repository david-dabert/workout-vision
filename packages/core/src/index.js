// @workoutvision/core — SDK entry point
// Re-exports the core analysis engine for use in other applications

// Exercise database and form check definitions
export { EXERCISES, EXERCISE_GROUPS, qualityBelow, qualityAbove, qualitySymmetry, qualityRange } from '../../../src/lib/exercises.js';

// Rep counting and form scoring
export { RepCounter } from '../../../src/lib/repCounter.js';

// Biomechanical analysis
export { analyzeSet } from '../../../src/lib/biomechanics.js';

// Coaching report generation
export { generateWorkoutReport } from '../../../src/lib/coach.js';

// Velocity and tempo analysis
export { VelocityEngine } from '../../../src/lib/VelocityEngine.js';

// Form baselines (cross-session learning)
export { updateBaseline, getBaseline, compareToBaseline } from '../../../src/lib/formBaselines.js';
