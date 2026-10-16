// Calibration with the physiotherapist (David's decision of 16 October 2026, issue #190: "I accept Olivier's judgments
// as ground truth"). Olivier films an attempt, gives his own judgment ("Conforme" or "À revoir") before he sees the
// app's, and the app keeps the attempt's figures with his judgment. From those trials, the tolerance that agrees best
// with him is found per exercise (sweep), to be set in compare.js after review (R9: status then "validated").
//
// A trial keeps no video, no name and no programme: the exercise, his judgment and the fault he names, the app's
// verdict, and per measure the distribution of the gaps to the reference (whole degrees) and the range reached, which
// is all that a verdict at another tolerance needs (verdictAt).
import { MIN_RANGE_SHARE, TOLERANCE_DEG, TOLERANCE_SHARE } from '../reference/compare.js';

// Gaps are kept as counts per whole degree, rounded up (a gap is within a whole tolerance t exactly when its rounded-up
// value is at most t), 0 to 59, and one last bin for 60 and over. Status: convention.
export const GAP_BINS = 61;
export const FAULTS = Object.freeze(['range', 'tempo', 'hold', 'position', 'other']);

const STORE = 'wv_kine_calibration';
const read = () => { try { const v = JSON.parse(localStorage.getItem(STORE) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const write = v => { try { localStorage.setItem(STORE, JSON.stringify(v)); return true; } catch { return false; } };

/** A trial from a comparison result (compareAttempt) and the physiotherapist's judgment given before it. */
export function trialFromResult(result, { exercise, label, fault = '', side = '', date = new Date().toISOString() }) {
  const joints = result.verdict === 'refused' ? [] : result.joints.map((j, k) => {
    const hist = new Array(GAP_BINS).fill(0);
    let n = 0;
    result.reference[k].forEach((ref, i) => {
      if (!result.seen[k][i]) return;
      hist[Math.min(GAP_BINS - 1, Math.ceil(Math.abs(result.matched[k][i] - ref)))]++;
      n++;
    });
    return { name: j.measure ?? j.name, kind: j.kind, rangeShare: j.rangeShare, hist, n };
  });
  return {
    v: 1, exercise, label: label === 'match' ? 'match' : 'revise',
    fault: FAULTS.includes(fault) ? fault : '', side, date,
    app: result.verdict, joints,
  };
}

/** The verdict the trial would get at these tolerances; null when the app gave no verdict. */
export function verdictAt(trial, { tol = TOLERANCE_DEG, share = TOLERANCE_SHARE, minRange = MIN_RANGE_SHARE } = {}) {
  if (trial.app === 'refused' || !trial.joints.length) return null;
  const off = trial.joints.some(j => {
    const within = j.hist.slice(0, Math.floor(tol) + 1).reduce((s, c) => s + c, 0) / Math.max(1, j.n);
    return within < share || (j.kind === 'moving' && j.rangeShare != null && j.rangeShare < minRange);
  });
  return off ? 'revise' : 'match';
}

/**
 * Agreement of the app with the physiotherapist at these tolerances, over the trials that have a verdict: how many
 * agree, how many of his "À revoir" the app also flags (caught), how many of his "Conforme" it wrongly flags (false).
 */
export function agreement(trials, params) {
  let n = 0, agree = 0, revise = 0, caught = 0, match = 0, falseFlags = 0;
  for (const t of trials) {
    const v = verdictAt(t, params);
    if (!v) continue;
    n++;
    if (v === t.label) agree++;
    if (t.label === 'revise') { revise++; if (v === 'revise') caught++; } else { match++; if (v === 'revise') falseFlags++; }
  }
  return { n, agree, revise, caught, match, falseFlags, share: n ? agree / n : null };
}

// The tolerances tried: 5 to 30 degrees, and 70 to 95 % of the movement within them. Status: convention (around the
// provisional 15 degrees and 90 %, wide enough to find where his judgment lies).
const TOLS = Array.from({ length: 26 }, (_, i) => 5 + i);
const SHARES = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95];
// A tolerance is proposed only from trials with both judgments, this many at least. Status: experimental, UNSOURCED.
export const MIN_TRIALS = 6;

/**
 * The tolerances that agree best with the physiotherapist on these trials: the highest balanced agreement (the mean of
 * the shares of his "À revoir" caught and of his "Conforme" passed), then the nearest to the provisional ones. Null
 * with too few trials, or without both judgments.
 */
export function bestTolerance(trials) {
  const base = agreement(trials);
  if (base.n < MIN_TRIALS || !base.revise || !base.match) return null;
  let best = null;
  for (const tol of TOLS) {
    for (const share of SHARES) {
      const a = agreement(trials, { tol, share });
      const balanced = (a.caught / a.revise + (a.match - a.falseFlags) / a.match) / 2;
      const distance = Math.abs(tol - TOLERANCE_DEG) / 25 + Math.abs(share - TOLERANCE_SHARE);
      if (!best || balanced > best.balanced + 1e-9 || (Math.abs(balanced - best.balanced) < 1e-9 && distance < best.distance)) {
        best = { tol, share, balanced, distance, ...a };
      }
    }
  }
  return best;
}

export const readTrials = () => read().filter(t => t && t.v === 1 && typeof t.exercise === 'string' && Array.isArray(t.joints));
/** Adds a trial; false when the phone's storage is blocked or full. */
export const addTrial = trial => write([...read(), trial].slice(-2000));
export const clearTrials = () => write([]);
/** The trials as a file to send for review: figures and judgments only. */
export const exportTrials = () => JSON.stringify({ kind: 'workout-vision kine calibration', v: 1, exported: new Date().toISOString(), trials: readTrials() }, null, 1);
