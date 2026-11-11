// Gate 7 (METHOD.md; card 002, 11 November 2026): no reading reaches a screen until it has been run on David's labelled
// sets and shown to separate what it claims to separate. A reading whose most frequent verdict covers more than
// MAX_SHARE of the sets it answers on, or more, separates nothing: it says the same thing whatever the set.
// Passing is necessary, not sufficient: it shows a reading is not constant, not that it is right. A reading is shown
// only when its own card also holds it against a named reference (METHOD.md; R16).
// Source of the threshold: UNSOURCED, convention chosen on 11 November 2026 from that day's measurement, where the
// readings David called "garbage" gave one verdict on 60 to 100 % of his 20 stored sets (STATE.md). Status: experimental.
import { UNVALIDATED_BIOMECHANICS_SHOWN } from '../../../src/components/experience/measures';
import { calculateIntraSetVelocityLoss } from '../../../src/lib/biomechanics/stickingPoint';
import { analyzeDynamicKneeValgus } from '../../../src/lib/biomechanics/dynamicValgus';
import { analyzeKineticChainSequencing } from '../../../src/lib/biomechanics/kineticChainSequencing';
import { analyzeLumbopelvicRhythm } from '../../../src/lib/biomechanics/lumbopelvicRhythm';
import { analyzeBarbellTilt } from '../../../src/lib/biomechanics/barbellTilt';
import { analyzeScapularPlane } from '../../../src/lib/kine/shoulderDyskinesis';

export const MAX_SHARE = 0.8;
/** The fewest sets a reading must answer on to be judged at all. */
export const MIN_SETS = 8;

/** One set as the screens hold it: the app's result and its exercise. */
export type GateSet = { lift: string; reps: any[]; world: any; image: any; ts: number[] | null };
/** A reading a screen can show: its analyzer's export name, whether production shows it, and its verdict on a set (null: no answer). */
export type Reading = { name: string; shown: () => boolean; verdict: (s: GateSet) => string | null };

const safe = <T,>(f: () => T): T | null => { try { return f(); } catch { return null; } };

// Called as the screens call them (MovementOptimizationCard.jsx, Replay.jsx).
export const READINGS: Reading[] = [
  { name: 'calculateIntraSetVelocityLoss', shown: () => UNVALIDATED_BIOMECHANICS_SHOWN, verdict: s => safe(() => (s.reps.length >= 2 ? (calculateIntraSetVelocityLoss(s.reps) as any)?.fatigueZone ?? null : null)) },
  { name: 'analyzeDynamicKneeValgus', shown: () => UNVALIDATED_BIOMECHANICS_SHOWN, verdict: s => safe(() => (analyzeDynamicKneeValgus(s.image, s.ts as any, s.lift as any) as any)?.tier ?? null) },
  { name: 'analyzeKineticChainSequencing', shown: () => UNVALIDATED_BIOMECHANICS_SHOWN, verdict: s => safe(() => { const r: any = analyzeKineticChainSequencing(s.world, s.ts as any, s.lift as any, s.reps); return r ? String(r.hipShootDetected === true) : null; }) },
  { name: 'analyzeLumbopelvicRhythm', shown: () => UNVALIDATED_BIOMECHANICS_SHOWN, verdict: s => safe(() => { const r: any = analyzeLumbopelvicRhythm(s.world, s.ts as any, s.lift as any, s.reps); return r ? String(r.buttWinkDetected === true) : null; }) },
  { name: 'analyzeBarbellTilt', shown: () => UNVALIDATED_BIOMECHANICS_SHOWN, verdict: s => safe(() => (analyzeBarbellTilt(s.image, s.ts as any, { lift: s.lift } as any) as any)?.verdict ?? null) },
  { name: 'analyzeScapularPlane', shown: () => UNVALIDATED_BIOMECHANICS_SHOWN, verdict: s => safe(() => (analyzeScapularPlane(s.image, s.ts as any, { lift: s.lift } as any) as any)?.verdict ?? null) },
];

// Analyzers a screen imports that are not judged here, each with its reason. A new analyzer imported by a screen is in
// neither list, and gate7.test.ts fails until it is judged above or its exemption is written here.
export const EXEMPT: Record<string, string> = {
  analyzeBilateralKinematicSymmetry: 'a score with no verdict; behind UNVALIDATED_BIOMECHANICS_SHOWN; to be judged when a card gives it a reference',
  analyzeMovementOptimization: 'coaching text, behind UNVALIDATED_BIOMECHANICS_SHOWN (MovementOptimizationCard.jsx, not rendered since #368)',
  analyzeContinuousBiomechanics: 'as analyzeMovementOptimization',
  analyzeSet: 'the legacy set summary, not a verdict on form',
  detectSetStickingPoints: 'pins on the replay, behind UNVALIDATED_BIOMECHANICS_SHOWN (Replay.jsx)',
  predictFatigueHorizon: 'behind UNVALIDATED_BIOMECHANICS_SHOWN (Result.jsx)',
  evaluateFraming: 'framing of the camera before a set, not a reading of the movement',
  evaluateLiveRepQuality: 'live counting, off in production (VITE_LIVE)',
  calculateMobilityMetric: 'KineCabinetMode.jsx, a file no screen reaches (STATE.md, 11 November 2026)',
};

export type Judgment = { name: string; answered: number; top: string | null; share: number; pass: boolean; why: string };

/** Whether a reading varies across the sets: it answers on enough of them, and no verdict covers MAX_SHARE of them or more. */
export function judge(reading: Reading, sets: GateSet[]): Judgment {
  const verdicts = sets.map(s => reading.verdict(s)).filter((v): v is string => v !== null && v !== undefined).map(String);
  const tally = new Map<string, number>();
  for (const v of verdicts) tally.set(v, (tally.get(v) ?? 0) + 1);
  const [top, n] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  const share = verdicts.length ? n / verdicts.length : 0;
  if (verdicts.length < MIN_SETS) return { name: reading.name, answered: verdicts.length, top, share, pass: false, why: `answers on ${verdicts.length} sets, fewer than ${MIN_SETS}` };
  if (share >= MAX_SHARE) return { name: reading.name, answered: verdicts.length, top, share, pass: false, why: `"${top}" on ${n} of ${verdicts.length} sets` };
  return { name: reading.name, answered: verdicts.length, top, share, pass: true, why: `most frequent verdict "${top}" on ${n} of ${verdicts.length}` };
}
