/**
 * Session badge / achievement system.
 * Detects shareable achievements earned during a single workout analysis.
 * Returns an array of badge objects for display on the ResultCard and share card.
 *
 * Badges are purely computed — no persistence needed. They're derived from
 * the current result + workout history on every render.
 */

import { getAllWorkouts } from './storage';

/**
 * @typedef {Object} Badge
 * @property {string} id       - unique key (used for translation + dedup)
 * @property {string} icon     - icon key (maps to SVG via BADGE_ICON_KEY in icons.jsx)
 * @property {'gold'|'silver'|'bronze'|'accent'} tier - visual tier for styling
 */

/**
 * Detect all badges earned for a given workout result.
 * @param {object} result - full analysis result
 * @param {object[]} [allWorkouts] - pre-fetched workout history (fetched if omitted)
 * @returns {Promise<Badge[]>}
 */
export async function detectBadges(result, allWorkouts) {
  const workouts = allWorkouts || await getAllWorkouts();
  const badges = [];

  const score = result.formScore ?? 0;
  const reps = result.reps ?? 0;
  const exercise = result.exercise;
  const repHistory = result.repHistory || [];
  const bio = result.bioAnalysis || {};

  // Past workouts for this exercise (exclude current)
  const pastForExercise = workouts.filter(w =>
    w.exercise === exercise && w.id !== result.workoutId
  );

  // All unique exercises ever done
  const pastExercises = new Set(workouts.map(w => w.exercise));

  // ── TIER 1: Gold badges (rare, highly shareable) ──

  // Perfect Form: score >= 95
  if (score >= 95) {
    badges.push({ id: 'badge_perfect_form', icon: 'crown', tier: 'gold' });
  }

  // New Exercise Unlocked: first time doing this exercise
  if (!pastExercises.has(exercise) || pastForExercise.length === 0) {
    badges.push({ id: 'badge_new_exercise', icon: 'unlock', tier: 'gold' });
  }

  // Century Club: 100+ total workouts
  if (workouts.length >= 100) {
    badges.push({ id: 'badge_century_club', icon: 'hundred', tier: 'gold' });
  }

  // ── TIER 2: Silver badges (notable achievements) ──

  // A-Grade Club: score >= 90
  if (score >= 90 && score < 95) {
    badges.push({ id: 'badge_a_grade', icon: 'star', tier: 'silver' });
  }

  // Form Breakthrough: beat your personal best form score for this exercise
  if (pastForExercise.length > 0) {
    const prevBest = Math.max(...pastForExercise.map(w => w.formScore || 0));
    if (score > prevBest && prevBest > 0) {
      badges.push({ id: 'badge_form_breakthrough', icon: 'chartUp', tier: 'silver' });
    }
  }

  // Iron Consistency: all reps within 10% quality variance
  if (repHistory.length >= 4) {
    const scores = repHistory.map(r => r.score || 0).filter(s => s > 0);
    if (scores.length >= 4) {
      const variance = Math.max(...scores) - Math.min(...scores);
      if (variance <= 10) {
        badges.push({ id: 'badge_iron_consistency', icon: 'target', tier: 'silver' });
      }
    }
  }

  // Symmetry Master: asymmetry score < 5%
  if (bio.asymmetry && bio.asymmetry.score < 5 && bio.asymmetry.score >= 0) {
    badges.push({ id: 'badge_symmetry_master', icon: 'scale', tier: 'silver' });
  }

  // ── TIER 3: Bronze badges (encouragement, common) ──

  // Endurance Set: 12+ reps in a single set
  if (reps >= 12) {
    badges.push({ id: 'badge_endurance_set', icon: 'fire', tier: 'bronze' });
  }

  // Slow & Controlled: average eccentric tempo 2-4s (hypertrophy range)
  if (repHistory.length >= 3 && repHistory.some(r => r.velocity?.eccentricTime > 0)) {
    const eccTimes = repHistory.map(r => r.velocity?.eccentricTime || 0).filter(t => t > 0);
    if (eccTimes.length >= 3) {
      const avgEcc = eccTimes.reduce((a, b) => a + b, 0) / eccTimes.length;
      if (avgEcc >= 2.0 && avgEcc <= 4.0) {
        badges.push({ id: 'badge_slow_controlled', icon: 'snowflake', tier: 'bronze' });
      }
    }
  }

  // Full ROM: ROM consistency >= 90%
  if (bio.rangeOfMotion && bio.rangeOfMotion.consistency >= 90) {
    badges.push({ id: 'badge_full_rom', icon: 'muscle', tier: 'bronze' });
  }

  // Comeback: form improved 10+ pts from last session of same exercise
  if (pastForExercise.length > 0) {
    const sorted = [...pastForExercise].sort((a, b) =>
      new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime()
    );
    const lastScore = sorted[0]?.formScore || 0;
    if (lastScore > 0 && score >= lastScore + 10) {
      badges.push({ id: 'badge_comeback', icon: 'chartUp', tier: 'bronze' });
    }
  }

  // ── TIER 4: Accent badges (collection / variety) ──

  // Exercise Explorer: 5+ different exercises
  const uniqueWithCurrent = new Set([...pastExercises, exercise]);
  if (uniqueWithCurrent.size >= 5) {
    badges.push({ id: 'badge_explorer', icon: 'globe', tier: 'accent' });
  }

  // Variety Pack: 10+ different exercises
  if (uniqueWithCurrent.size >= 10) {
    badges.push({ id: 'badge_variety_pack', icon: 'trophy', tier: 'accent' });
  }

  // Dedicated: 5+ sessions of the same exercise
  if (pastForExercise.length >= 4) {
    badges.push({ id: 'badge_dedicated', icon: 'gem', tier: 'accent' });
  }

  return badges;
}
