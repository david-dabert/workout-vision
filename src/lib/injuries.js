/**
 * Injury/limitation layer — maps body areas to affected landmarks and form checks.
 * When a user marks an area as limited, form checks that stress that area
 * are auto-passed instead of penalizing the score.
 */

import localforage from 'localforage';

export const INJURY_MAP = {
  'lower_back': { landmarks: [11, 12, 23, 24], checks: ['Lumbar flexion', 'Trunk angle', 'Hip hinge', 'Back angle'] },
  'shoulder':   { landmarks: [11, 12, 13, 14], checks: ['Shoulder protraction', 'Scapular retraction', 'Elbow flare', 'Shoulder stability'] },
  'knee':       { landmarks: [23, 24, 25, 26, 27, 28], checks: ['Knee valgus', 'Knee position', 'Hip depth', 'Knee tracking'] },
  'wrist':      { landmarks: [15, 16], checks: ['Wrist position', 'Wrist alignment'] },
  'hip':        { landmarks: [23, 24], checks: ['Hip depth', 'Hip hinge', 'Hip alignment'] },
  'ankle':      { landmarks: [27, 28, 29, 30, 31, 32], checks: ['Knee position', 'Ankle mobility'] },
  'neck':       { landmarks: [0, 1, 2, 3, 4, 5, 6], checks: ['Head position', 'Neck alignment'] },
  'elbow':      { landmarks: [13, 14], checks: ['Elbow flare', 'Wrist position', 'Full extension'] },
};

export const INJURY_LABELS = {
  'lower_back': { en: 'Lower back', fr: 'Bas du dos' },
  'shoulder':   { en: 'Shoulder', fr: 'Épaule' },
  'knee':       { en: 'Knee', fr: 'Genou' },
  'wrist':      { en: 'Wrist', fr: 'Poignet' },
  'hip':        { en: 'Hip', fr: 'Hanche' },
  'ankle':      { en: 'Ankle', fr: 'Cheville' },
  'neck':       { en: 'Neck', fr: 'Cou' },
  'elbow':      { en: 'Elbow', fr: 'Coude' },
};

/**
 * Returns true if a form check should be skipped for this user's injuries.
 */
export function shouldSkipCheck(checkName, userInjuries) {
  if (!userInjuries || userInjuries.length === 0) return false;
  for (const injury of userInjuries) {
    const affected = INJURY_MAP[injury]?.checks || [];
    if (affected.some(c => checkName.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(checkName.toLowerCase()))) {
      return true;
    }
  }
  return false;
}

/**
 * Load saved injuries from IndexedDB via localforage.
 */
export async function loadInjuries() {
  try {
    const saved = await localforage.getItem('wv_injuries');
    return saved || [];
  } catch (_) {
    return [];
  }
}

/**
 * Save injuries to IndexedDB via localforage.
 */
export async function saveInjuries(injuries) {
  try {
    await localforage.setItem('wv_injuries', injuries);
  } catch (_) {}
}
