/**
 * TF.js model hook — no-op when no model is present.
 *
 * This module provides the seam for a future trained classifier.
 * When a model file exists in IndexedDB (saved after offline training),
 * it loads the model and provides predictions. Otherwise it returns null.
 *
 * The model expects a flat feature vector from TemporalFeatureExtractor output
 * and returns per-exercise probability scores.
 *
 * Training pipeline (future):
 *   1. User confirms/corrects exercises during workouts (sampleCapture.js)
 *   2. Export JSONL from sampleCapture.exportSamplesBlob()
 *   3. Train model offline (Python script or Colab notebook)
 *   4. Convert to TF.js format and load via this module
 *
 * No model ships with this version. Minimum ~40 confirmed sets per exercise
 * before training is meaningful.
 */

const MODEL_DB_KEY = 'wv_exercise_model';
const FEATURE_ORDER = [
  'knee_range', 'knee_mean', 'knee_dwellLow', 'knee_dwellHigh', 'knee_cycles',
  'hip_range', 'hip_mean', 'hip_dwellLow', 'hip_dwellHigh', 'hip_cycles',
  'elbow_range', 'elbow_mean', 'elbow_dwellLow', 'elbow_dwellHigh', 'elbow_cycles',
  'shoulder_range', 'shoulder_mean', 'shoulder_dwellLow', 'shoulder_dwellHigh', 'shoulder_cycles',
  'trunk_range', 'trunk_mean', 'trunk_dwellLow', 'trunk_dwellHigh', 'trunk_cycles',
  'corr_elbow_shoulder', 'corr_knee_hip', 'corr_elbow_knee',
];

/**
 * Convert temporal features to a flat array in canonical order.
 * @param {object} features - from TemporalFeatureExtractor.extract()
 * @returns {number[]}
 */
export function featuresToVector(features) {
  if (!features) return new Array(FEATURE_ORDER.length).fill(0);
  const vec = [];
  for (const key of FEATURE_ORDER) {
    const parts = key.split('_');
    if (parts.length === 1) {
      // Top-level key like corr_elbow_shoulder
      vec.push(features[key] || 0);
    } else {
      const channel = parts[0];
      const stat = parts.slice(1).join('_');
      // Map: 'corr_elbow_shoulder' → features.corr_elbow_shoulder
      if (key.startsWith('corr_')) {
        vec.push(features[key] || 0);
      } else {
        vec.push(features[channel]?.[stat] || 0);
      }
    }
  }
  return vec;
}

// Deduplicate the corr entries that got double-pushed
// Actually let's fix the logic above properly:
// FEATURE_ORDER entries like 'corr_elbow_shoulder' have underscores but are top-level.
// Channel entries like 'knee_range' map to features.knee.range.

/**
 * Create a model prediction function, or null if no model is available.
 *
 * Usage:
 *   const predict = await createModelPredictor();
 *   if (predict) {
 *     const scores = predict(features, candidateIds);
 *   }
 *
 * @returns {Promise<Function|null>}
 */
export async function createModelPredictor() {
  // Check if TF.js is available
  let tf;
  try {
    tf = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/+esm');
  } catch {
    return null; // TF.js not available
  }

  // Try to load model from IndexedDB
  try {
    const model = await tf.loadLayersModel(`indexeddb://${MODEL_DB_KEY}`);
    const labelMap = JSON.parse(localStorage.getItem(`${MODEL_DB_KEY}_labels`) || '{}');

    return function predict(features, candidateIds) {
      const vec = featuresToVector(features);
      const input = tf.tensor2d([vec]);
      const output = model.predict(input);
      const probs = output.dataSync();
      input.dispose();
      output.dispose();

      const scores = {};
      for (const id of candidateIds) {
        const idx = labelMap[id];
        scores[id] = idx != null ? probs[idx] : 0;
      }
      return scores;
    };
  } catch {
    return null; // No model saved yet
  }
}

/**
 * Check if a trained model is available.
 * @returns {Promise<boolean>}
 */
export async function hasTrainedModel() {
  try {
    const tf = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/+esm');
    await tf.loadLayersModel(`indexeddb://${MODEL_DB_KEY}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Feature vector length for model input layer specification.
 */
export const FEATURE_VECTOR_LENGTH = FEATURE_ORDER.length;
