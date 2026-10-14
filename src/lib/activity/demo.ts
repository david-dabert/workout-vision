/**
 * The volleyball demonstration (docs/VISION.md, the truth lab): the engine run on synthetic jumps whose truth is known
 * by construction (synthetic.ts), at the frame rate the screen picks, with the truth of every value the engine returns.
 * The screen shows a number only with its margin and beside its truth, so the visitor sees each margin hold or fail.
 *
 * The jumps: four, two standing and two after a three-stride run-up, of 0.45 to 0.70 s in the air, landing as they took
 * off, toes leaving at full speed; every point jitters by a standard deviation of 1 px on a 360x640 frame, seeded so
 * every visit reads the same values. What this seed shows at each rate is pinned by demo.test.ts; how the margins hold
 * over many runs, and in wider conditions, is in volleyball-heldout.test.ts. Status: experimental (level 1 of the truth
 * lab: no pose model, no filmed person).
 */
import { runActivity } from './engine';
import { volleyball } from './specs/volleyball';
import { seededNoise, syntheticJumps, type SyntheticJump, type SyntheticTruthJump } from './synthetic';
import type { ActivityResult, ActivitySpec, FoundEvent } from './types';

/** The truth of a measure: of the value shown, of each value in the order the engine returns them, and of each event
 *  the measure reads (null where it does not apply: a standing jump has no run-up). */
export interface DemoTruth { value: number | null; each: (number | null)[]; byEvent: (number | null)[] }

export interface DemoRun {
  result: ActivityResult;
  truth: Record<string, DemoTruth>;
  /** How many jumps were made, how many after a run-up, at which rate and noise. */
  made: { jumps: number; approaches: number; rate: number; noisePx: number };
}

export interface ActivityDemo { spec: ActivitySpec; rates: number[]; rate: number; run: (rate: number) => DemoRun }

const JUMPS: SyntheticJump[] = [{ flight: 0.55 }, { flight: 0.7, approach: 3 }, { flight: 0.45 }, { flight: 0.62, approach: 3 }];
const NOISE_PX = 1;
const SEED = 7;

/** The truth jump nearest an event in time: 0 when the event's span meets the jump's flight, else the gap. */
function nearest(jumps: SyntheticTruthJump[], e: FoundEvent, t: number[]): SyntheticTruthJump | null {
  const from = t[e.start], to = t[e.end];
  let best: SyntheticTruthJump | null = null, gap = Infinity;
  for (const j of jumps) {
    const g = Math.max(0, j.takeoff - to, from - j.landing);
    if (g < gap) { gap = g; best = j; }
  }
  return best;
}

const TRUTH_OF: Partial<Record<string, (j: SyntheticTruthJump) => number | null>> = {
  height: j => j.heightCm,
  approach: j => j.plant,
  landing: j => j.knees,
};

export function runVolleyballDemo(rate: number): DemoRun {
  const read = syntheticJumps({ jumps: JUMPS, rate, phase: 0.37 / rate, noisePx: NOISE_PX, noise: seededNoise(SEED) });
  const result = runActivity(volleyball, read);
  const truth: Record<string, DemoTruth> = {};
  for (const m of result.measures) {
    const spec = volleyball.measures.find(s => s.key === m.key);
    if (spec?.formula.kind === 'count') { truth[m.key] = { value: read.truth.jumps.length, each: [], byEvent: [] }; continue; }
    const of = TRUTH_OF[m.key], events = result.events[spec?.of ?? ''] ?? [];
    const byEvent = events.map(e => {
      const j = nearest(read.truth.jumps, e, read.timestamps);
      return j && of ? of(j) : null;
    });
    const each = m.values.map(v => byEvent[v.event] ?? null);
    // The truth of the value shown: the true highest (or lowest) of all the jumps made, whichever jump the engine picked;
    // for a mean, the mean of the truths of the values it averaged.
    let value: number | null = null;
    if (m.value !== null && each.length) {
      if (spec?.summary === 'mean') value = each.every(x => x !== null) ? (each as number[]).reduce((s, x) => s + x, 0) / each.length : null;
      else {
        const all = read.truth.jumps.map(j => (of ? of(j) : null)).filter((x): x is number => x !== null);
        value = all.length ? (spec?.summary === 'max' ? Math.max(...all) : Math.min(...all)) : null;
      }
    }
    truth[m.key] = { value, each, byEvent };
  }
  return {
    result, truth,
    made: { jumps: JUMPS.length, approaches: JUMPS.filter(j => (j.approach ?? 0) > 0).length, rate, noisePx: NOISE_PX },
  };
}

export const volleyballDemo: ActivityDemo = { spec: volleyball, rates: [15, 30, 60, 240], rate: 60, run: runVolleyballDemo };
