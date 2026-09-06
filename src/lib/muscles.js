/**
 * Muscle name normalization layer.
 *
 * Exercise definitions use anatomical names (Pectorals, Latissimus Dorsi, etc.)
 * while UI components and coaching code sometimes use casual names (chest, back, etc.).
 * This module provides a single source of truth for mapping between them.
 */

// Canonical anatomical names used in EXERCISES definitions
export const CANONICAL_MUSCLES = [
  'Pectorals',
  'Upper Pectorals',
  'Latissimus Dorsi',
  'Quadriceps',
  'Hamstrings',
  'Deltoids',
  'Anterior Deltoid',
  'Medial Deltoid',
  'Rear Deltoid',
  'Biceps Brachii',
  'Triceps Brachii',
  'Triceps',
  'Gluteus Maximus',
  'Glutes',
  'Gastrocnemius',
  'Soleus',
  'Rectus Abdominis',
  'Transverse Abdominis',
  'Obliques',
  'Erectors',
  'Core',
  'Rhomboids',
  'Traps',
  'Upper Back',
  'Forearms',
  'Brachialis',
  'Brachioradialis',
  'Serratus Anterior',
  'Hip Flexors',
];

/**
 * Maps casual / short muscle names to their canonical anatomical equivalents.
 * Keys are lowercase, values are the canonical name used in exercise definitions.
 */
export const MUSCLE_ALIASES = {
  // Casual -> Canonical
  'chest': 'Pectorals',
  'pecs': 'Pectorals',
  'back': 'Latissimus Dorsi',
  'lats': 'Latissimus Dorsi',
  'quads': 'Quadriceps',
  'hamstrings': 'Hamstrings',
  'hammies': 'Hamstrings',
  'shoulders': 'Deltoids',
  'delts': 'Deltoids',
  'front delts': 'Anterior Deltoid',
  'side delts': 'Medial Deltoid',
  'rear delts': 'Rear Deltoid',
  'biceps': 'Biceps Brachii',
  'bis': 'Biceps Brachii',
  'triceps': 'Triceps Brachii',
  'tris': 'Triceps Brachii',
  'glutes': 'Gluteus Maximus',
  'butt': 'Gluteus Maximus',
  'calves': 'Gastrocnemius',
  'abs': 'Rectus Abdominis',
  'core': 'Core',
  'lower back': 'Erectors',
  'traps': 'Traps',
  'upper back': 'Upper Back',
  'forearms': 'Forearms',
  'hip flexors': 'Hip Flexors',
  'obliques': 'Obliques',

  // Canonical names mapping to themselves (lowercase)
  'pectorals': 'Pectorals',
  'upper pectorals': 'Upper Pectorals',
  'latissimus dorsi': 'Latissimus Dorsi',
  'quadriceps': 'Quadriceps',
  'deltoids': 'Deltoids',
  'anterior deltoid': 'Anterior Deltoid',
  'medial deltoid': 'Medial Deltoid',
  'rear deltoid': 'Rear Deltoid',
  'biceps brachii': 'Biceps Brachii',
  'triceps brachii': 'Triceps Brachii',
  'gluteus maximus': 'Gluteus Maximus',
  'gastrocnemius': 'Gastrocnemius',
  'soleus': 'Soleus',
  'rectus abdominis': 'Rectus Abdominis',
  'transverse abdominis': 'Transverse Abdominis',
  'erectors': 'Erectors',
  'rhomboids': 'Rhomboids',
  'serratus anterior': 'Serratus Anterior',
  'brachialis': 'Brachialis',
  'brachioradialis': 'Brachioradialis',
};

/**
 * Normalize a muscle name to its canonical form.
 * Returns the canonical name if found, otherwise returns the input unchanged.
 *
 * @param {string} name - muscle name in any form (casual or anatomical)
 * @returns {string} canonical muscle name
 */
export function normalizeMuscle(name) {
  if (!name || typeof name !== 'string') return name;
  const lower = name.trim().toLowerCase();
  return MUSCLE_ALIASES[lower] || name;
}

/**
 * Check if two muscle names refer to the same muscle.
 *
 * @param {string} a - first muscle name
 * @param {string} b - second muscle name
 * @returns {boolean}
 */
export function isSameMuscle(a, b) {
  if (!a || !b) return false;
  return normalizeMuscle(a) === normalizeMuscle(b);
}
