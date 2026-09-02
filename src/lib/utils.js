/**
 * Shared utilities used across multiple components.
 */

export function gradeFromScore(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

export function gradeClass(score) {
  if (score >= 90) return 'grade-a';
  if (score >= 75) return 'grade-b';
  if (score >= 60) return 'grade-c';
  return 'grade-d';
}

export function getRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  const types = [
    'video/mp4;codecs=avc1.42E01E',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

// Muscle name translations (single source of truth)
export const MUSCLE_FR = {
  'Pectorals': 'Pectoraux', 'Upper Pectorals': 'Pectoraux sup.',
  'Anterior Deltoid': 'Deltoïde ant.', 'Medial Deltoid': 'Deltoïde moy.',
  'Rear Deltoid': 'Deltoïde post.', 'Triceps': 'Triceps',
  'Triceps (long head)': 'Triceps (long.)',
  'Biceps Brachii': 'Biceps', 'Biceps': 'Biceps',
  'Brachialis': 'Brachial', 'Brachioradialis': 'Brachio-radial',
  'Forearms': 'Avant-bras', 'Latissimus Dorsi': 'Grand dorsal',
  'Rhomboids': 'Rhomboïdes', 'Traps': 'Trapèzes', 'Upper Back': 'Haut du dos',
  'Erectors': 'Érecteurs', 'Serratus Anterior': 'Dentelé ant.',
  'Quadriceps': 'Quadriceps', 'Hamstrings': 'Ischio-jambiers',
  'Glutes': 'Fessiers', 'Hip Flexors': 'Fléch. hanche',
  'Gastrocnemius': 'Mollets', 'Soleus': 'Soléaire',
  'Core': 'Gainage', 'Rectus Abdominis': 'Abdominaux',
  'Obliques': 'Obliques', 'Transverse Abdominis': 'Transverse',
  'Full Body': 'Corps entier',
  'Chest': 'Pectoraux', 'Shoulders': 'Épaules', 'Abs': 'Abdominaux',
  'Lats': 'Grand dorsal', 'Rear Delts': 'Deltoïdes post.',
  'Lower Back': 'Bas du dos', 'Calves': 'Mollets',
};

export function translateMuscle(name, lang) {
  if (lang === 'fr' && MUSCLE_FR[name]) return MUSCLE_FR[name];
  return name;
}
