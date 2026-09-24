/**
 * Injury/limitation layer — maps body areas to affected landmarks and form checks.
 * When a user marks an area as limited, form checks that stress that area
 * are auto-passed instead of penalizing the score.
 */

import localforage from 'localforage';

const injuryStore = localforage.createInstance({ name: 'workoutVision', storeName: 'medical' });

// Check names must match actual formCheck names in exerciseDefinitions.js.
// shouldSkipCheck uses bidirectional includes() matching, so partial matches work
// (e.g. 'Trunk' matches 'Trunk angle', 'Trunk neutral', 'Trunk upright', 'Trunk stable').
export const INJURY_MAP = {
  'lower_back': {
    landmarks: [11, 12, 23, 24],
    checks: ['Lumbar flexion', 'Trunk angle', 'Trunk neutral', 'Trunk upright', 'Trunk stable',
             'Hip hinge', 'Back flat', 'Lower back', 'Spine flexion', 'Stable spine'],
  },
  'shoulder': {
    landmarks: [11, 12, 13, 14],
    checks: ['Shoulder symmetry', 'Shoulder height', 'Shoulders engaged', 'Scapular retraction',
             'No shrugging', 'Elbow position', 'Arm height', 'Overhead position'],
  },
  'knee': {
    landmarks: [23, 24, 25, 26, 27, 28],
    checks: ['Knee valgus', 'Knee symmetry', 'Knee angle', 'Knee bent', 'Knee soft lock',
             'Knee straight', 'Knees straight', 'Knee tuck height', 'Knee over ankle',
             'Depth', 'Landing mechanics', 'Landing depth', 'Landing control', 'Squat depth'],
  },
  'wrist': {
    landmarks: [15, 16],
    checks: ['Wrist Curl', 'Forearm stable'],
  },
  'hip': {
    landmarks: [23, 24],
    checks: ['Hip hinge', 'Hip drive', 'Hip extension', 'Hip position', 'Hip pike',
             'Hips high', 'Hips up', 'Depth', 'Full hip extension', 'Anterior pelvic tilt'],
  },
  'ankle': {
    landmarks: [27, 28, 29, 30, 31, 32],
    checks: ['Knee straight', 'Controlled dorsiflexion', 'Controlled motion'],
  },
  'neck': {
    landmarks: [0, 1, 2, 3, 4, 5, 6],
    checks: ['Upright posture'],
  },
  'elbow': {
    landmarks: [13, 14],
    checks: ['Elbow stable', 'Elbow position', 'Elbow pinned', 'Elbow symmetry',
             'Elbows stable', 'Elbows stationary', 'Full extension', 'Full lockout',
             'No arm bend', 'Slight elbow bend'],
  },
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
    const saved = await injuryStore.getItem('wv_injuries');
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
    await injuryStore.setItem('wv_injuries', injuries);
  } catch (_) {}
}
