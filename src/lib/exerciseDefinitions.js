/**
 * Exercise definitions loader — lazily fetches from public/data/exercises.json.
 *
 * Replaces the previous 4,357-line JS module with a thin async loader.
 * The JSON contains all 274 exercise definitions in DSL format. Custom checks
 * that cannot be serialized (landmark-based, conditional, multi-joint) are
 * resolved at compile time via named references in exerciseCustomChecks.js.
 *
 * For synchronous access after initial load, use getExerciseDefinitionsSync().
 */

let _cache = null;
let _loadPromise = null;

/**
 * Lazily fetch and cache exercise definitions from the JSON file.
 * @returns {Promise<Object>} The EXERCISE_DEFINITIONS object
 */
export async function loadExerciseDefinitions() {
  if (_cache) return _cache;
  if (_loadPromise) return _loadPromise;

  _loadPromise = fetch(import.meta.env.BASE_URL + 'data/exercises.json')
    .then(resp => {
      if (!resp.ok) throw new Error(`Failed to load exercises.json: ${resp.status}`);
      return resp.json();
    })
    .then(data => {
      _cache = data;
      _loadPromise = null;
      return data;
    })
    .catch(err => {
      _loadPromise = null;
      throw err;
    });

  return _loadPromise;
}

/**
 * Synchronous access to exercise definitions after initial load.
 * Returns null if not yet loaded.
 * @returns {Object|null}
 */
export function getExerciseDefinitionsSync() {
  return _cache;
}

/**
 * Preload exercise definitions (call at app startup).
 * @returns {Promise<Object>}
 */
export function preloadExerciseDefinitions() {
  return loadExerciseDefinitions();
}

// For backwards compatibility: EXERCISE_DEFINITIONS is now loaded lazily.
// Direct synchronous import of EXERCISE_DEFINITIONS is no longer supported.
// Use loadExerciseDefinitions() or getExerciseDefinitionsSync() instead.
