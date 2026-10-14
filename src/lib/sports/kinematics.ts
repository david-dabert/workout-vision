/**
 * The sports lab's two calculators (SportsBiomechanics.jsx, "Repère"): the ratio of two durations the visitor sets
 * with sliders, beside a published coaching reference. Nothing here reads a video: the app does not read golf,
 * rowing or any other sport of this screen on a video yet.
 *
 * Honesty pass of 14 October 2026 (audit SP-01 to SP-30). Removed from this file, because no code could measure them
 * and their cut-offs had no source: the X-factor and its "Tour level" grade (it needs 3D), the clubhead speed (a
 * constant input clamped to 65-135 mph; the club is not tracked), the tennis "trophy pose", the padel "glass
 * suppression" index (one of three constants), the bike-fit saddle verdict, the baseball elbow torque and "UCL
 * safety" (constants of 52, 78 and 84 N·m; elbow torque needs inverse dynamics in a laboratory), the skiing edge angle
 * and G load, the swimming "propulsion score" (one of three constants). The landmark presets and their drawing
 * (landmarkKinematics.ts) went with them: their labels contradicted the values they computed.
 *
 * No verdict is derived from a ratio: the cut-offs the first version graded with (2.7 and 3.4 for golf, 1.7 and 2.4
 * for rowing) had no source.
 */

/**
 * Golf tempo reference: a backswing three times as long as the downswing.
 * Source: J. Novosel, Tour Tempo (a coaching book). Status: convention (coaching practice; not a measured threshold).
 */
export const GOLF_TEMPO_REFERENCE = 3;

/**
 * Rowing rhythm reference: a recovery twice as long as the drive.
 * Source: Concept2, "Understanding Stroke Rate" ("your drive-recovery ratio should be 1:2"). Status: convention (the
 * ergometer maker's technique guidance; not an Olympic or measured standard).
 */
export const ROWING_RATIO_REFERENCE = 2;

const positive = (v: number) => Number.isFinite(v) && v > 0;
const oneDecimal = (v: number) => Math.round(v * 10) / 10;

/** Backswing over downswing, to one decimal; null when either duration is not a positive number (no ratio exists). */
export function golfTempoRatio(backswingMs: number, downswingMs: number): number | null {
  if (!positive(backswingMs) || !positive(downswingMs)) return null;
  return oneDecimal(backswingMs / downswingMs);
}

/** Recovery over drive, to one decimal; null when either duration is not a positive number (no ratio exists). */
export function rowingRhythmRatio(driveMs: number, recoveryMs: number): number | null {
  if (!positive(driveMs) || !positive(recoveryMs)) return null;
  return oneDecimal(recoveryMs / driveMs);
}
