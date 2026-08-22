/**
 * Lightweight i18n for WorkoutVision.
 * Auto-detects browser language, user can toggle manually.
 * Only two languages: English (default) and French.
 */

const translations = {
  // ─── UI strings ───
  'analyze_video': { en: 'Analyze Video', fr: 'Analyser la vidéo' },
  'close': { en: 'Close', fr: 'Fermer' },
  'tap_to_select': { en: 'Tap to select videos', fr: 'Appuyer pour sélectionner des vidéos' },
  'file_types': { en: 'MP4, MOV, WebM', fr: 'MP4, MOV, WebM' },
  'automatic': { en: 'Automatic', fr: 'Automatique' },
  'compound': { en: 'Compound', fr: 'Polyarticulaire' },
  'isolation': { en: 'Isolation', fr: 'Isolation' },
  'bodyweight': { en: 'Bodyweight', fr: 'Poids du corps' },
  'other': { en: 'Other', fr: 'Autre' },
  'analyze': { en: 'Analyze', fr: 'Analyser' },
  'remove': { en: 'Remove', fr: 'Retirer' },
  'done': { en: 'Done', fr: 'Terminé' },
  'failed_try_different': { en: 'Failed — try a different clip or use Live Training', fr: 'Échec — essayez un autre clip ou le mode en direct' },
  'loading_ai': { en: 'Loading AI engine...', fr: 'Chargement du moteur IA...' },
  'downloading_model': { en: 'Downloading pose detection model (~3 MB)', fr: 'Téléchargement du modèle de détection (~3 Mo)' },
  'loading_file': { en: 'Loading', fr: 'Chargement de' },
  'analyzing_file': { en: 'Analyzing', fr: 'Analyse de' },
  'starting_file': { en: 'Starting', fr: 'Démarrage de' },
  'auto_detected': { en: 'Auto-detected', fr: 'Détecté auto.' },
  'reps': { en: 'Reps', fr: 'Reps' },
  'duration': { en: 'Duration', fr: 'Durée' },
  'form': { en: 'Form', fr: 'Forme' },
  'quality': { en: 'Quality', fr: 'Qualité' },
  'analysis': { en: 'Analysis', fr: 'Analyse' },
  'velocity_per_rep': { en: 'Velocity per rep', fr: 'Vitesse par rep' },
  'time_under_tension': { en: 'Time under tension', fr: 'Temps sous tension' },
  'eccentric': { en: 'Eccentric', fr: 'Excentrique' },
  'concentric': { en: 'Concentric', fr: 'Concentrique' },
  'total': { en: 'Total', fr: 'Total' },
  'range_of_motion': { en: 'Range of motion', fr: 'Amplitude de mouvement' },
  'avg_rom': { en: 'Avg ROM', fr: 'ROM moy.' },
  'consistency': { en: 'Consistency', fr: 'Régularité' },
  'asymmetry': { en: 'Asymmetry', fr: 'Asymétrie' },
  'imbalance': { en: 'Imbalance', fr: 'Déséquilibre' },
  'fatigue': { en: 'Fatigue', fr: 'Fatigue' },
  'fatigue_index': { en: 'Fatigue index', fr: 'Indice de fatigue' },
  'velocity_dropoff': { en: 'Velocity dropoff', fr: 'Perte de vitesse' },
  'form_notes': { en: 'Form notes', fr: 'Notes de forme' },
  'engine': { en: 'Engine', fr: 'Moteur' },
  'highlights': { en: 'Highlights', fr: 'Points forts' },
  'next_steps': { en: 'Next steps', fr: 'Prochaines étapes' },
  'per_rep_quality': { en: 'Per-rep quality', fr: 'Qualité par rep' },
  'watch_overlay': { en: 'Watch with AI Overlay', fr: 'Voir avec superposition IA' },
  'share_card': { en: 'Share Summary Card', fr: 'Partager la fiche résumé' },
  'no_poses': { en: 'Could not detect any poses', fr: 'Aucune pose détectée' },
  'try_different': { en: 'Try a different angle or better lighting, or use Live Training mode.', fr: 'Essayez un autre angle ou un meilleur éclairage, ou utilisez le mode en direct.' },
  'model_failed': { en: 'AI model failed to load. Check your connection.', fr: 'Le modèle IA n\'a pas pu se charger. Vérifiez votre connexion.' },
  'video_failed': { en: 'Video failed to load. Try a different file or shorter clip.', fr: 'Échec du chargement vidéo. Essayez un autre fichier ou un clip plus court.' },
  'too_large': { en: 'is too large. Maximum is 500 MB.', fr: 'est trop volumineux. Maximum 500 Mo.' },
  'back': { en: 'Back', fr: 'Retour' },
  'ai_overlay': { en: 'AI Overlay', fr: 'Superposition IA' },
  'download_hd': { en: 'Download HD Video', fr: 'Télécharger vidéo HD' },
  'save_screenshot': { en: 'Save HD Screenshot', fr: 'Enregistrer capture HD' },
  'cancel_export': { en: 'Cancel Export', fr: 'Annuler l\'export' },
  // Live camera
  'live_training': { en: 'Live Training', fr: 'Entraînement en direct' },
  'start_set': { en: 'Start Set', fr: 'Démarrer série' },
  'stop_set': { en: 'Stop Set', fr: 'Arrêter série' },
  'rest_timer': { en: 'Rest Timer', fr: 'Minuteur de repos' },
  'skip_rest': { en: 'Skip', fr: 'Passer' },
  'sets': { en: 'sets', fr: 'séries' },
  'cal': { en: 'cal', fr: 'cal' },
  // Dashboard
  'home': { en: 'Home', fr: 'Accueil' },
  'nutrition': { en: 'Nutrition', fr: 'Nutrition' },
  'progress': { en: 'Progress', fr: 'Progrès' },
  'profile': { en: 'Profile', fr: 'Profil' },
  'train': { en: 'Train', fr: 'S\'entraîner' },
  'need_more_reps': { en: 'Need more reps.', fr: 'Plus de reps nécessaires.' },

  // ─── Exercise names ───
  'ex.squat': { en: 'Squat', fr: 'Squat' },
  'ex.deadlift': { en: 'Deadlift', fr: 'Soulevé de terre' },
  'ex.bench_press': { en: 'Bench Press', fr: 'Développé couché' },
  'ex.overhead_press': { en: 'Overhead Press', fr: 'Développé militaire' },
  'ex.barbell_row': { en: 'Barbell Row', fr: 'Rowing barre' },
  'ex.bicep_curl': { en: 'Bicep Curl', fr: 'Curl biceps' },
  'ex.tricep_extension': { en: 'Tricep Extension', fr: 'Extension triceps' },
  'ex.lateral_raise': { en: 'Lateral Raise', fr: 'Élévation latérale' },
  'ex.front_raise': { en: 'Front Raise', fr: 'Élévation frontale' },
  'ex.romanian_deadlift': { en: 'Romanian Deadlift', fr: 'Soulevé de terre roumain' },
  'ex.leg_press': { en: 'Leg Press', fr: 'Presse à cuisses' },
  'ex.leg_extension': { en: 'Leg Extension', fr: 'Extension de jambe' },
  'ex.leg_curl': { en: 'Leg Curl', fr: 'Curl de jambe' },
  'ex.calf_raise': { en: 'Calf Raise', fr: 'Mollets debout' },
  'ex.pull_up': { en: 'Pull-Up', fr: 'Traction' },
  'ex.push_up': { en: 'Push-Up', fr: 'Pompe' },
  'ex.dip': { en: 'Dip', fr: 'Dips' },
  'ex.plank': { en: 'Plank', fr: 'Planche' },
  'ex.lunge': { en: 'Lunge', fr: 'Fente' },
  'ex.hip_thrust': { en: 'Hip Thrust', fr: 'Hip Thrust' },
  'ex.cable_fly': { en: 'Cable Fly', fr: 'Écarté poulie' },
  'ex.face_pull': { en: 'Face Pull', fr: 'Face Pull' },
  'ex.hammer_curl': { en: 'Hammer Curl', fr: 'Curl marteau' },
  'ex.skull_crusher': { en: 'Skull Crusher', fr: 'Barre au front' },
  'ex.upright_row': { en: 'Upright Row', fr: 'Rowing menton' },
  'ex.shrug': { en: 'Shrug', fr: 'Haussement d\'épaules' },
  'ex.chest_fly': { en: 'Chest Fly', fr: 'Écarté pectoraux' },
  'ex.incline_press': { en: 'Incline Press', fr: 'Développé incliné' },
  'ex.decline_press': { en: 'Decline Press', fr: 'Développé décliné' },
  'ex.seated_row': { en: 'Seated Row', fr: 'Rowing assis' },
  'ex.lat_pulldown': { en: 'Lat Pulldown', fr: 'Tirage vertical' },
  'ex.preacher_curl': { en: 'Preacher Curl', fr: 'Curl au pupitre' },
  'ex.concentration_curl': { en: 'Concentration Curl', fr: 'Curl concentration' },
  'ex.lying_bicep_curl': { en: 'Lying Bicep Curl', fr: 'Curl allongé' },
  'ex.spider_curl': { en: 'Spider Curl', fr: 'Spider curl' },
  'ex.cable_curl': { en: 'Cable Curl', fr: 'Curl poulie' },
  'ex.tricep_pushdown': { en: 'Tricep Pushdown', fr: 'Poussée triceps poulie' },
  'ex.overhead_tricep': { en: 'Overhead Tricep Extension', fr: 'Extension triceps au-dessus' },
  'ex.kickback': { en: 'Tricep Kickback', fr: 'Kickback triceps' },
  'ex.goblet_squat': { en: 'Goblet Squat', fr: 'Goblet squat' },
  'ex.bulgarian_split': { en: 'Bulgarian Split Squat', fr: 'Squat bulgare' },
  'ex.step_up': { en: 'Step-Up', fr: 'Step-up' },
  'ex.good_morning': { en: 'Good Morning', fr: 'Good morning' },
  'ex.sumo_deadlift': { en: 'Sumo Deadlift', fr: 'Soulevé sumo' },
  'ex.hack_squat': { en: 'Hack Squat', fr: 'Hack squat' },
  'ex.sit_up': { en: 'Sit-Up', fr: 'Abdos' },
  'ex.crunch': { en: 'Crunch', fr: 'Crunch' },
  'ex.mountain_climber': { en: 'Mountain Climber', fr: 'Mountain climber' },
  'ex.burpee': { en: 'Burpee', fr: 'Burpee' },
  'ex.jumping_jack': { en: 'Jumping Jack', fr: 'Jumping jack' },
  'ex.box_jump': { en: 'Box Jump', fr: 'Box jump' },
  'ex.superset': { en: 'Superset / Other', fr: 'Superset / Autre' },
};

// Detect browser language, default to English
let currentLang = 'en';
if (typeof navigator !== 'undefined') {
  const browserLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
  if (browserLang.startsWith('fr')) currentLang = 'fr';
}

// Listeners for reactivity
const listeners = new Set();

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (lang !== 'en' && lang !== 'fr') return;
  currentLang = lang;
  try { localStorage.setItem('wv_lang', lang); } catch (_) {}
  listeners.forEach(fn => fn(lang));
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Initialize from localStorage if available
try {
  const saved = localStorage.getItem('wv_lang');
  if (saved === 'en' || saved === 'fr') currentLang = saved;
} catch (_) {}

/**
 * Translate a key. Falls back to English if no translation exists.
 * @param {string} key
 * @returns {string}
 */
export function t(key) {
  const entry = translations[key];
  if (!entry) return key;
  return entry[currentLang] || entry.en || key;
}

/**
 * Get exercise name in current language.
 * @param {string} exerciseKey - key from EXERCISES dict
 * @param {string} fallbackName - English name from the exercise definition
 * @returns {string}
 */
export function tExercise(exerciseKey, fallbackName) {
  const key = `ex.${exerciseKey}`;
  const entry = translations[key];
  if (entry && entry[currentLang]) return entry[currentLang];
  return fallbackName || exerciseKey;
}
