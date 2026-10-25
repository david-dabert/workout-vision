/**
 * Counting core — pure function, no DOM, no detection.
 *
 * In:  timestamped world landmarks (from MediaPipe PoseLandmarker) and a lift name.
 * Out: rep count, per-rep detail (start/end time, ROM, durations), side used, confidence.
 *
 * One joint angle per lift, from world-landmark 3D vectors (LIFTS below; every other countable
 * guide exercise by its pattern, liftDefinition):
 *   elbow    shoulder–elbow–wrist   curl, rows, triceps pushdown, bench and overhead press, lat pulldown
 *   shoulder hip–shoulder–elbow     lateral raise
 *   knee     hip–knee–ankle         squat, leg press, leg extension, leg curl, lunge
 *   hip      shoulder–hip–knee      Romanian deadlift, hip thrust
 * Which joint moves each lift, and which phase lifts the load (concentric) or
 * yields to it (eccentric), is standard kinesiology (Neumann, Kinesiology of the
 * Musculoskeletal System, 3rd ed., 2017). No per-lift parameter is set.
 *
 * Side selection: the side whose three joint landmarks have the highest average
 * visibility across the set, unless that side stays still and counts nothing while the other moves and counts
 * (countReps, 14 October 2026). Short dropouts (< bridgeGap) are filled with the last
 * valid angle; the side never alternates frame by frame. The alternating curl, and every guide
 * exercise whose pattern counts both sides (liftDefinition), count both sides and join them
 * (countBothSides). An either-side exercise (push-up, pull-up, a one-limb exercise) is counted on each side and keeps
 * the side with more reps among those seen in at least half the samples; the lunges (`together`) join both knees
 * when they bend together (TOGETHER_MIN_CORRELATION) and are counted as either-side when they do not.
 *
 * Signal conditioning pipeline: outlier removal → bridge dropouts → Savitzky–Golay.
 * Outlier removal nulls samples that deviate from their local median by more
 * than OUTLIER_DEVIATION_DEG (rejects pose-estimation glitches without
 * attenuating shallow reps). SG smoothing then operates on clean data.
 * All windows are defined in seconds and converted to samples at runtime.
 *
 * Rep detection: smoothed angle crosses a low and a high threshold derived from the
 * set's own 10th/90th percentile range, leaving the rest end and coming back to it.
 * A rep is one full cycle at least MIN_REP_SEC long whose moving time (its duration less its time held at the
 * working end, up to WORK_HOLD_CAP_SEC) is at most MAX_REP_SEC (6 October 2026). A last rep the video stops on
 * its way back counts, marked clipped, once it has come CUT_RETURN_SHARE of the way back (3 October 2026).
 * Its reported start and end are then placed where the angle leaves and regains
 * its rest level (placeBoundaries), so a rest that hovers near a threshold does
 * not move them; its range and phases are measured between them.
 *
 * Every parameter is in seconds or degrees, never frames.
 *
 * References (fixed parameters only):
 *   Rep duration bounds 0.5–8.0 s: the range of repetition durations over which
 *     Schoenfeld, Ogborn & Krieger ("Effect of Repetition Duration During Resistance
 *     Training on Muscle Hypertrophy", Sports Medicine 2015; 45(4):577-85) found
 *     similar hypertrophy. The paper sets no limit on how long a rep can last; using
 *     the range as bounds is ours. The upper bound applies to moving time (MAX_REP_SEC).
 *   Savitzky–Golay window, outlier parameters, the rest band and the overlap
 *     that joins two arms: unvalidated starting values. Not derived from a
 *     specific published recommendation.
 */

import guidePatterns from './guide-patterns.json';
import {
  zWeight, zAllViews, sideShare, depthShare, interpolateOn, fillOn, fillMinR, FILL_MIN_PAIRS, fitLine,
  shapeOn, shapeSlack, shapePart, SHAPE_POINTS, SHAPE_BAND, SHAPE_MIN_REPS, resample, dtw, medianSeries, altDiffOn, altMaxR,
} from './survey';

// ─── Types ───

export interface WorldLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export type WorldLandmarkFrame = WorldLandmark[] | null;

export interface RepDetail {
  index: number;        // 1-based rep number
  startTime: number;    // seconds into video
  endTime: number;      // seconds into video
  romDegrees: number;   // range of motion in degrees (peak-to-trough within this rep)
  concentricSec: number;
  eccentricSec: number;
  peakSpeed: number;    // highest frame-to-frame angular speed within the rep, degrees/second
  meanSpeed: number;    // average frame-to-frame angular speed within the rep, degrees/second
  side?: 'left' | 'right' | 'both'; // both-sides lifts only: the side that did it
  clipped?: boolean;    // the video starts or ends inside this rep: counted, but its times are not whole
  isPartial?: boolean;  // true when this repetition is a partial rep
  partialType?: 'lengthened' | 'shortened'; // kinesiological classification (Dr. Milo Wolf / Dr. Mike Israetel)
  romFraction?: number; // fraction of full repetition ROM achieved (e.g. 0.35 - 0.75)
}

export interface CountResult {
  count: number;        // full repetitions counted
  // The video opened inside a rep whose return the head rule refused (HEAD_RETURN_SHARE): the count may be one short.
  // A flag for the result screen to ask (R8, R16); it moves no count. Single-side lifts only. 19 October 2026.
  headRefused?: boolean;
  reps: RepDetail[];    // full repetitions list
  partialCount?: number; // number of partial reps detected
  totalCount?: number;  // count + partialCount
  partials?: RepDetail[]; // partial repetitions list
  arm: 'left' | 'right' | 'both'; // the side tracked; 'both' for a both-sides lift
  confidence: number;   // 0–1
  angles: (number | null)[];          // raw angle per sample
  smoothedAngles: (number | null)[];  // after SG + bridge
  lowThreshold: number;
  highThreshold: number;
  sides?: { left: CountResult; right: CountResult }; // both-sides lifts only
}

export type Joint = 'elbow' | 'shoulder' | 'knee' | 'hip';

export interface LiftDefinition {
  joint: Joint;
  /** Where the angle rests between reps: at the high end (extended) or the low end. */
  rest: 'high' | 'low';
  /** The phase that leaves the rest: lifting the load (concentric) or yielding to it (eccentric). */
  first: 'concentric' | 'eccentric';
  /** Both sides counted and joined, one rep per side (the alternating curl, walking lunge, dead bug…). */
  bothSides?: boolean;
  /**
   * Both sides counted, the side with more reps kept: for a movement that bends both joints on every rep (a
   * forward or reverse lunge, a push-up, a pull-up), where the side the camera serves worse misses reps; the other
   * side is kept only when it is itself seen on at least half the samples (countReps). Public build half's lunges,
   * 3 October: 44 to 54 exact of 156, 31 to 8 off by 3 or more, none newly off by 3 (TRIED.md). Experimental.
   * The lunges and the front raise (DETECTION) have since moved to `together`; the push-up and the pull-up keep this.
   * Since 6 October 2026 (audit, action 6) also the exercises done one limb at a time (one-arm rows, the
   * concentration curl, pistol and skater squats, the single-leg Romanian deadlift, standing and side-lying hip
   * abductions, donkey kicks; guide-families.json): the idle limb, held still, can be the better seen and read 0
   * (one-limb.test.ts). Source: UNSOURCED. Status: experimental; no labelled set holds these exercises.
   */
  eitherSide?: boolean;
  /**
   * Both joints bend together on every rep (a forward or reverse lunge: both knees): each side is counted and
   * the two lists joined as for bothSides, so a rep one knee misses and the other sees still counts, and a rep
   * both see counts once; the count needs either knee in sight at a sample, not both (coreAnalysis.js). When
   * the two knees' angles do not rise and fall together over the set (TOGETHER_MIN_CORRELATION), their reps
   * cannot be paired and the side with more reps counts, as eitherSide. Public build half's lunges against
   * eitherSide, 3 October, on the integrated core (test/real-phone/accuracy/variant-eval.test.ts): chosen on its
   * half A, 16 to 22 exact of 78, off by 3 or more (refusals included) 16 to 10, none lost; checked on half B,
   * 39 to 42 exact of 78 (3 gained, 0 lost; McNemar 1.33, not significant), off by 3 or more 6 to 6; none newly
   * off by 3 on either. Those figures include the pairing of a lagging knee's rep (countBothSides), added after
   * half B was first read (4 gained, 1 lost without it), on a synthetic case from the review, not on half B.
   * Six refused sets now get a count: 2 exact, 4 short by 1 or 2. David's sets and the synthetic sets hold no
   * lunge.
   * Status: experimental.
   */
  together?: boolean;
  /**
   * The correlation of the two sides' smoothed angles above which a `together` lift joins them;
   * TOGETHER_MIN_CORRELATION when absent (DETECTION). -Infinity joins them always.
   */
  togetherMinCorrelation?: number;
  /** Share of the set's range each threshold is set inside its percentile; THRESHOLD_MARGIN when absent (DETECTION). */
  thresholdMargin?: number;
  /** Smallest range one rep may have, in degrees; MIN_ROM_DEGREES when absent (DETECTION). */
  minRepRomDeg?: number;
  /**
   * How far above the working extreme the working-end threshold sits, as a share of the set's range
   * (10th to 90th percentile); THRESHOLD_MARGIN when absent. A rep counts once the angle passes it.
   * The rest-end threshold keeps THRESHOLD_MARGIN.
   */
  workMargin?: number;
  /**
   * The joint read as the lift of its limb against gravity, in place of the three-point angle in space: 180 plus the
   * angle of the limb from the joint to its end (LIFT_POINTS: the shoulder to the wrist) above the horizontal, the
   * world's y being down (liftAngleDeg).
   * For a body lying face down whose limb rises off the floor: on a prone Y raise the arms, overhead in a Y, lift; the
   * three-point shoulder angle then barely moves (2.3 degrees over a rep on its motion spec, test/real-phone/synth/
   * motions/prone_y_raise.json, the arms out in a Y) and, read in the image plane, folds back at 180 (one rep would read
   * as two). With the trunk level, 180 is the arm in line with it and the lift is the shoulder's flexion past that line
   * (177 to 193 on the spec). Neither the side the camera stands on nor a left-right swap changes it; a phone rolled
   * from upright tilts the horizontal it is read against. On rendered sets (8 October 2026, test/real-phone/synth/motions/
   * lift-angle.test.ts) it followed the rendered reps more closely than the shoulder's angle in the image plane taken
   * from the trunk's line (correlation with the rendered progress, plainly dressed body: median 0.80 against 0.26), the
   * hips of a body lying being read loosely, and read to the wrist more closely than to the elbow (the longer lever).
   * The replay still lights the joint's three points (JOINT_POINTS), not LIFT_POINTS: no exercise read this way is
   * offered yet (offer.js, NOT_YET_COUNTED). Source: UNSOURCED. Status: experimental.
   */
  lift?: boolean;
  /**
   * The set's own range floor, in degrees: a set whose angle spans less (10th to 90th percentile) counts no rep;
   * MIN_ROM_DEGREES when absent (DETECTION). The collector's warning reads the same floor (batchCollect.js,
   * mismatchFloor).
   */
  minRangeDeg?: number;
  /** Shortest plausible rep in seconds; MIN_REP_SEC when absent. */
  minRepSec?: number;
  /** Disables splitOverlongReps when true (e.g. for low-amplitude lifts with isometric pauses). */
  noSplit?: boolean;
  /**
   * For fixed-footplate machine exercises (hack squat, pendulum squat), feet remain stationary on the platform.
   * MediaPipe ankle landmarks that invert above the knee (c.y < b.y in world coordinates, where y is down) due to
   * machine occlusion are held at the median platform position to prevent false extension spikes at the bottom of the squat.
   */
  fixedFeet?: boolean;
  /** Clamp impossible anatomical inversions (ankle.y < knee.y) caused by angled sled footplate occlusion (hack_squat). */
  clampFootplateInversion?: boolean;
}

export const LIFTS = {
  bicep_curl: { joint: 'elbow', rest: 'high', first: 'concentric' },
  bicep_curl_alternating: { joint: 'elbow', rest: 'high', first: 'concentric', bothSides: true },
  lat_pulldown: { joint: 'elbow', rest: 'high', first: 'concentric' },
  seated_row: { joint: 'elbow', rest: 'high', first: 'concentric' },
  dumbbell_row: { joint: 'elbow', rest: 'high', first: 'concentric' },
  triceps_pushdown: { joint: 'elbow', rest: 'low', first: 'concentric' },
  // Presses rest at lockout, so the bar comes down first. To be confirmed on their build sets.
  bench_press: { joint: 'elbow', rest: 'high', first: 'eccentric' },
  overhead_press: { joint: 'elbow', rest: 'high', first: 'eccentric' },
  lateral_raise: { joint: 'shoulder', rest: 'low', first: 'concentric' },
  // Squat depth varies from rep to rep (a tiring or touch-and-go set; Countix clips): the working-end threshold sits
  // a third of the range above the deepest level, not a fifth, so a rep counts once the knee has bent two thirds of
  // the way down. Status: experimental, UNSOURCED; an unvalidated starting value (PLAN.md), chosen on the first
  // half (A) of the Countix build sets, squat (3 October 2026): 26 -> 28 of 50 exact, none lost, none newly off
  // by 3; 0.33 to 0.50 give the same counts there, 0.30 one exact fewer, 0.25 none. Only the working end moves:
  // the same rule on the rest end split or merged reps erratically there (0.25 to 0.40). Checked once afterwards,
  // unchanged: Countix half B squat 9 -> 10 of 42 exact, none lost; no count moved on the 96 synthetic sets or on
  // David's 14 (squat_7 stays 7). The crossings of the rest-end threshold are unchanged, so it can add a rep to
  // the count, never remove one. squat-depth.test.ts.
  squat: { joint: 'knee', rest: 'high', first: 'eccentric', workMargin: 1 / 3 },
  leg_press: { joint: 'knee', rest: 'high', first: 'eccentric' },
  leg_extension: { joint: 'knee', rest: 'low', first: 'concentric' },
  leg_curl: { joint: 'knee', rest: 'high', first: 'concentric' },
  lunge: { joint: 'knee', rest: 'high', first: 'eccentric', together: true },
  romanian_deadlift: { joint: 'hip', rest: 'high', first: 'eccentric' },
  hip_thrust: { joint: 'hip', rest: 'low', first: 'concentric' },
  // The fitness tests (fitness-tests.js), each counted by its movement. Chair stand: seated, the knee rests
  // bent (low) and each rep rises to standing first. Arm curl: as the curl. No existing lift changes.
  chair_stand_test: { joint: 'knee', rest: 'low', first: 'concentric' },
  arm_curl_test: { joint: 'elbow', rest: 'high', first: 'concentric' },
} as const satisfies Record<string, LiftDefinition>;

export type Lift = keyof typeof LIFTS;

// Every countable exercise of the guide, by its pattern (PLAN.md, GROWTH, step 2, 29 September
// 2026): its joint, the end it rests at, the phase that leaves the rest and whether both sides
// count, from guide-families.json through guide-patterns.json (scripts/make-guide-patterns.mjs),
// which holds the patterns alone. A pattern only chooses the joint, the side logic and which phase is
// concentric; the only counting parameters that depend on the exercise are in DETECTION below. Status:
// experimental: the catalogue's own reading of each exercise's anatomy (guide-families.test.ts cites Neumann 2017,
// "exercise-specific interpretations, not measurements"); not measured per exercise.
const PATTERNS = guidePatterns as Record<string, string>;

// Detection settings measured for one exercise, over its pattern; every other exercise keeps the core's.
// push_up (3 October 2026): its public build sets are counted short far more often than long (publicA half, 74
// sets: 43 under, 2 over): MediaPipe reads the elbow of a body lying level through a narrow range that varies
// from rep to rep, so a rep that turns short of the set's 10th or 90th percentile is not counted. Thresholds a
// quarter of the range inside the percentiles (the core's 0.20 elsewhere) and a rep's own range floor of 15°
// (the set's floor stays 20°, so the collector's warning still never stands beside a count): publicA 19 -> 23
// exact of 74, off by 3 or more 21 -> 18, no set less exact. Chosen on the publicA half alone; the publicB half,
// read once after: 30 -> 33 exact of 80, 19 -> 18 off by 3 or more, none newly off by 3; David's sets and the
// synthetic sets hold no push-up and do not move (scripts/compare-variants.mjs). Status: experimental.
// front_raise (3 October 2026): each shoulder counted and their reps joined, always (`together` with no correlation
// gate), rather than the shoulder with more reps (eitherSide): a raise both arms make counts once (75 % overlap of
// the shorter, or the middle of either inside the other, countBothSides), and alternating raises count one each.
// Public build half A, front_raise (80 sets), exact / off by 3 or more, against eitherSide 33 / 9: gate 0.3 36 / 9,
// 0 37 / 9, -0.3 40 / 5, -0.6 and -Infinity 42 / 5 (9 gained, 0 lost, none newly off by 3); David's and the
// synthetic sets hold no front raise and do not move. A short dropout of the raising arm no longer splits a rep
// (front-raise-together.test.ts: 8 alternating raises with a 0.3 s dropout read 8, not the 16 of 30 September).
// Source: UNSOURCED. Status: experimental, chosen on the public build half A (front_raise).
// prone_y_raise (8 October 2026): read as the arm's lift (LiftDefinition.lift). On the renders of 8 October before the
// landscape batch (test/real-phone/synth/motions/lift-angle.test.ts), in the rest windows (1 to 3 s before the first rep
// and after the last) the arm facing the camera spread 0 to 5.8 degrees and the far arm up to 12.7; the plainly dressed
// body's lifting arm spread 13 to 20 (arms read poorly, 3 to 8). 10 degrees, about twice the near arm's rest, for the
// set and for each rep; the far arm's rest can pass it, so the better seen arm is counted, never the one with more reps,
// nor the other when the better seen one stays still (countReps exempts a lift read).
// No set held still from start to end was rendered. Source: measured on rendered sets only, no person filmed.
// Status: experimental.
// hack_squat (25 October 2026, R16): fixed-footplate machine squat. Machine occlusion at the bottom of the movement
// causes MediaPipe ankle landmarks to glitch upwards into the air (ankle.y < knee.y), inverting the knee vector and
// doubling reps (pendulum_squat_7 counted 14 for 7). sanitizeFixedFeet holds inverted ankles at the platform position.
const DETECTION: Record<string, Pick<LiftDefinition, 'thresholdMargin' | 'minRepRomDeg' | 'minRangeDeg' | 'together' | 'eitherSide' | 'togetherMinCorrelation' | 'minRepSec' | 'noSplit' | 'fixedFeet' | 'clampFootplateInversion'>> = {
  push_up: { thresholdMargin: 0.25, minRepRomDeg: 15 },
  front_raise: { together: true, eitherSide: false, togetherMinCorrelation: -Infinity },
  prone_y_raise: { minRangeDeg: 10, minRepRomDeg: 10, minRepSec: 1.2, noSplit: true, thresholdMargin: 0.25 },
  hack_squat: { fixedFeet: true, clampFootplateInversion: true },
  sissy_squat: { fixedFeet: true, minRepRomDeg: 15 },
};

// Close variants counted as their parent (audit of 6 October 2026, action 6): the same elbow cycle with the hands,
// the incline, the knees or a load changed. They had kept the core's default rule (one side, the better seen, and
// the default thresholds), which the public push-up and pull-up sets rejected for their parents (eitherSide and
// DETECTION above, TRIED.md, 3 October). Each takes its parent's whole definition (side rule and detection
// settings); its guide pattern carries the parent's side rule too, so the two never disagree (close-variants.test.ts).
// Left out: the pike and feet-elevated pike push-ups (the shoulder, not a level body, carries the load), the wall
// push-up (a near-upright body and a short elbow range), the shoulder-tap push-up (one hand leaves the floor on
// every rep) and the archer push-up (one arm loaded at a time, counted on both sides). Source: UNSOURCED (the
// parents' settings were measured on Countix push-ups and pull-ups only; no labelled set holds these keys).
// Status: experimental.
export const COUNT_AS: Readonly<Record<string, string>> = Object.freeze({
  knee_push_up: 'push_up', incline_push_up: 'push_up', decline_push_up: 'push_up',
  wide_push_up: 'push_up', diamond_push_up: 'push_up', weighted_push_up: 'push_up',
  assisted_pull_up: 'pull_up', weighted_pull_up: 'pull_up', neutral_grip_pull_up: 'pull_up',
  commando_pull_up: 'pull_up', l_sit_pull_up: 'pull_up', towel_pull_up: 'pull_up',
  chin_up: 'pull_up', assisted_chin_up: 'pull_up', weighted_chin_up: 'pull_up',
});

/** The definition an exercise is counted by: its LIFTS entry, else its parent's (COUNT_AS), else its guide pattern; null if it has none. */
export function liftDefinition(key: string): LiftDefinition | null {
  if (Object.hasOwn(LIFTS, key)) return LIFTS[key as Lift];
  if (Object.hasOwn(COUNT_AS, key)) return liftDefinition(COUNT_AS[key]);
  if (!Object.hasOwn(PATTERNS, key)) return null;
  const [joint, rest, first, ...more] = PATTERNS[key].split('/') as [Joint, 'high' | 'low', 'concentric' | 'eccentric', ...string[]];
  return {
    joint, rest, first,
    ...(more.includes('both') ? { bothSides: true } : more.includes('either') ? { eitherSide: true } : more.includes('together') ? { together: true } : {}),
    ...(more.includes('lift') ? { lift: true } : {}),
    ...(Object.hasOwn(DETECTION, key) ? DETECTION[key] : {}),
  };
}

// ─── Constants ───

// Landmark indices (MediaPipe Pose, 33-point model)
const L_SHOULDER = 11, R_SHOULDER = 12;
const L_ELBOW = 13, R_ELBOW = 14;
const L_WRIST = 15, R_WRIST = 16;
const L_HIP = 23, R_HIP = 24;
const L_KNEE = 25, R_KNEE = 26;
const L_ANKLE = 27, R_ANKLE = 28;

// Each joint's three landmarks (first point, vertex, last point), per side.
// The replay draws the same three, so what it lights is what was measured.
export const JOINT_POINTS: Record<Joint, { left: [number, number, number]; right: [number, number, number] }> = {
  elbow: { left: [L_SHOULDER, L_ELBOW, L_WRIST], right: [R_SHOULDER, R_ELBOW, R_WRIST] },
  shoulder: { left: [L_HIP, L_SHOULDER, L_ELBOW], right: [R_HIP, R_SHOULDER, R_ELBOW] },
  knee: { left: [L_HIP, L_KNEE, L_ANKLE], right: [R_HIP, R_KNEE, R_ANKLE] },
  hip: { left: [L_SHOULDER, L_HIP, L_KNEE], right: [R_SHOULDER, R_HIP, R_KNEE] },
};

// The two landmarks a lift is read on (LiftDefinition.lift): the joint and its limb's end.
const LIFT_POINTS: Record<Joint, { left: [number, number]; right: [number, number] }> = {
  shoulder: { left: [L_SHOULDER, L_WRIST], right: [R_SHOULDER, R_WRIST] },
  elbow: { left: [L_ELBOW, L_WRIST], right: [R_ELBOW, R_WRIST] },
  hip: { left: [L_HIP, L_ANKLE], right: [R_HIP, R_ANKLE] },
  knee: { left: [L_KNEE, L_ANKLE], right: [R_KNEE, R_ANKLE] },
};

// Savitzky–Golay quadratic kernels (symmetric, preserves peaks), for the window SG_WINDOW_SEC gives at the
// actual sample rate (sgKernel). Until 6 October 2026 they came from a fixed table of 3 to 11 samples, and any
// other window (above about 33 samples per second) fell back to 5 samples without a word (audit of 6 October,
// action 4). They are now generated for any odd window from the closed form of a quadratic least-squares fit
// (Savitzky & Golay, Anal. Chem. 1964; 36(8):1627-39): for a window of 2m+1 samples, the weight at offset i is
// (3(3m² + 3m − 1) − 15 i²) / ((2m − 1)(2m + 1)(2m + 3)), which gives the table's 5 to 11 exactly
// (sg-kernel.test.ts). Status: literature (the formula); the window itself stays an unvalidated starting value.
// Three samples keep the table's moving average: a quadratic fit through three points is the points themselves.
const SG_KERNEL_3 = [1, 1, 1].map(v => v / 3);
const sgKernels = new Map<number, number[]>();
export function sgKernel(windowSize: number): number[] {
  let n = Math.max(3, Math.round(Number.isFinite(windowSize) ? windowSize : 3));
  if (n % 2 === 0) n += 1;
  if (n === 3) return SG_KERNEL_3;
  const cached = sgKernels.get(n);
  if (cached) return cached;
  const m = (n - 1) / 2;
  const norm = (2 * m - 1) * (2 * m + 1) * (2 * m + 3);
  const kernel = Array.from({ length: n }, (_, j) => (3 * (3 * m * m + 3 * m - 1) - 15 * (j - m) ** 2) / norm);
  sgKernels.set(n, kernel);
  return kernel;
}

// Unvalidated starting values — recorded per PLAN.md rule
const BRIDGE_GAP_SEC = 0.5;       // max dropout to bridge
const OUTLIER_WINDOW_SEC = 0.5;   // window for local median in outlier removal
const OUTLIER_DEVIATION_DEG = 40; // max deviation from local median before nulling
const SG_WINDOW_SEC = 0.333;      // Savitzky–Golay window in seconds
const MIN_REP_SEC = 0.5;          // shortest plausible rep (Schoenfeld et al. 2015)
// Longest rep, in moving time (detectReps): its duration less the time it held at the working end, that hold
// counted up to WORK_HOLD_CAP_SEC. Source: Schoenfeld, Ogborn & Krieger, Sports Medicine 2015 (45(4):577-85)
// found similar hypertrophy over the repetition durations of the studies they pooled, 0.5 to 8 s; it states no
// longest possible rep, so 8 s as a bound is our reading of that range, not its finding. Status: literature (the
// range), experimental (its use as a bound on moving time).
const MAX_REP_SEC = 8.0;
// A rep's time at the working end (the samples past the working threshold) is not counted against MAX_REP_SEC, up
// to this many seconds (audit of 6 October 2026, action 5): with the bound on the whole duration, eight squats or
// lateral raises paused 5 s at the working end read 0, and a set of six plain and two paused reps read 6 with
// full coverage. The cap keeps a long stay at the working end that is no rep out (arms crossed for 20 s after a
// curl set: moving time 21 - 10 = 11 s). Trade-off: an isometric hold of up to 10 s entered and left from rest
// (a 10 s wall sit then standing up) now reads as 1 rep. A cycle whose entering sample is already at the working
// end (video or pose opening on it) keeps the whole-duration bound (detectReps, `bounded`). work-hold.test.ts.
// Source: UNSOURCED. Status: experimental.
const WORK_HOLD_CAP_SEC = 10;
const PERCENTILE_LOW = 10;        // for threshold from set's own range
const PERCENTILE_HIGH = 90;
const THRESHOLD_MARGIN = 0.20;    // fraction of range added as hysteresis band
const MIN_ROM_DEGREES = 20;       // minimum ROM to accept a rep
// Under this 95th minus 5th percentile spread of its smoothed angle, the better seen side of a one-side lift is still,
// and the other side may count (countReps). About twice the near arm's rest spread on the renders of 8 October
// (0 to 5.8 degrees, DETECTION prone_y_raise); the idle elbow of IntelliRehabDS ird_s101_g00_stand spread 3; the
// better seen side of every set the first form of the rule moved spread 13 or more (review of 14 October).
// Source: UNSOURCED. Status: experimental.
const STILL_SIDE_DEG = 10;
const VIS_THRESHOLD = 0.5;        // per-joint visibility floor
// Rest band, 2 October 2026 (David's order on tempo, PLAN.md): 10 % and 3° timed only the fast middle of each
// phase, so a 0.15 s hold at the turn read 0.53 s (median) and phases 0.7 s short on 96 synthetic sets
// (test/real-phone/synth/synth.txt). 5 % and 2°: hold 0.40 s, phases 0.61 s short; David's real reps lengthen
// by 5.5 % at the median and 19 % at most (1 % and 1° let pre-set movement into a bench rep: 1.5 s became 3.9 s).
// Boundaries only: David's counts are unchanged (7/14); on the public build half the exact count holds at
// 271/894, but one countix-whole push-up (label 3) went from 2 to 1, its rep's middle leaving the labelled
// window (count-in-window). Three of David's sets now mark their first rep as cut by the video, which they
// are (bicep_curl_5, both overhead_press 4/10 front). Status: experimental.
const REST_BAND_FRACTION = 0.05;  // a rep leaves its rest when the angle is this share of the set's range away from it
const REST_BAND_MIN_DEG = 2;      // … and never less than this many degrees
const REST_LEVEL_MIN_SEC = 0.3;   // shortest stay at rest whose median gives the rest level; below it, the extreme is used. Source: UNSOURCED. Status: experimental
const RETURN_WINDOW_SEC = 2;     // how long after its working half a rep's fullest return is looked for (placeBoundaries); since 8ff7313 (3 October 2026) also the longest a cut last rep may take to come back and still count (detectReps). Source: UNSOURCED. Status: experimental
// A first rep whose return is all the video shows (it starts at the working end and comes back to rest in under
// MIN_REP_SEC) counts when that return takes at least this share of the set's own extreme-to-rest time, the
// median over its accepted reps, measured from where each one last deepened its working extreme (detectReps;
// it needs HEAD_MIN_REPS accepted reps to compare with, and placeBoundaries marks it clipped so no measure uses it).
// Source: UNSOURCED. Status: experimental, chosen on the public build half A (0.5 against 0.6), bounded below
// by the pinned edges tests (edges.test.ts, window-edges.test.ts).
const HEAD_RETURN_SHARE = 0.5;
const HEAD_MIN_REPS = 1;          // accepted reps the head return time is read from (25 October 2026, matching TAIL_DEPTH_MIN_REPS = 1). Source: UNSOURCED. Status: experimental, chosen on half A
const EXTREME_HOLD_SEC = 1 / 3;   // each end of a rep's range is the mean of its most extreme third of a second, not one sample. Source: UNSOURCED. Status: experimental
const TOGETHER_OVERLAP = 0.75;    // two arms' reps overlapping by this share of the shorter one are one rep, both arms together
// A `together` lift joins its two sides only when their smoothed angles correlate above this over the samples
// where both are seen (Pearson). Two knees that bend together correlate. The two public lunges that doubled when
// joined (TRIED.md, 3 October: 3 read 7, 4 read 8) read their knees in opposition, one straight while the other
// bent (correlation -0.10 and -0.64: the far leg swapped or misread), and two whose knees barely correlated
// (0.06, 0.07) gained a false rep. 0.3 is the conventional "medium" correlation (Cohen, Statistical Power
// Analysis for the Behavioral Sciences, 2nd ed., 1988); on the lunges of the public build half's half A every
// value from 0.1 to 0.3 gives the same counts. Status: experimental (chosen on half A).
const TOGETHER_MIN_CORRELATION = 0.3;
// A last rep the video stops on its way back counts once its return has covered this share of the way from its
// working extreme to the rest threshold (detectReps), and it is marked clipped, so no measure uses it. The rule
// withdrawn on 1 October (TRIED.md) counted it from the working end on, which a movement after the set reaches
// too; a move to a new position (arms crossed, phone in hand, standing up) does not come back. It stays above the
// half-way-back cut that edges.test.ts keeps uncounted (a constraint of 30 September, older than this value).
// How the value was chosen (third audit C34, 3 October 2026). The first value, 0.75 (window-edges experiment,
// 8ff7313), was chosen partly by watching David's hip thrust set (0.5 read it 7 for 6), which PLAN.md forbids
// ("tune nothing to any clip"). It was re-chosen on the public build half A only: variant-eval swept 0.5 to 0.9
// and 1.01 (rule off); half A, 458 sets, exact / off by 3 or more: 0.5 178/74, 0.6 171/74, 0.65 169/76,
// 0.7 169/76, 0.75 167/76, 0.8 167/76, 0.85 164/76, 0.9 164/76, 1.01 160/77. 0.5 and 0.6 count the half-way-back
// cut of edges.test.ts, so they are out; 0.65 and 0.7 give the same count on every half-A set, and 0.7 keeps the
// wider margin from that cut. Half B, David's sets and the synthetic sets were read for 0.7 against 0.75: half B
// 164 -> 166 exact (off by 3 or more 99 -> 99), David's 8 -> 8 (no count moved), synthetic 74 -> 74; none newly
// off by 3. They had also been read once for 0.5, the first pick, before the full test suite showed it breaks
// edges.test.ts (TRIED.md); the exclusion of 0.5 and 0.6 rests on that synthetic test alone. Sweep in TRIED.md. Status: experimental; UNSOURCED (no published rule for a rep cut
// by the recording).
const CUT_RETURN_SHARE = 0.7;
// A last rep the video stops at its working end (David, 18 October 2026: a rep the video shows reaching its working
// end counts, even when the recording cuts it; his lat pulldown of 11 counts the pull the video ends on). It counts,
// marked cut, when every one of these holds (detectReps):
//  - the pose is seen, not filled in, from where it reached the working end to the video's last sample (a pose lost
//    before the end is not the recording stopping: two synthetic sets read a glitch there);
//  - it was still at the working end within TAIL_AT_WORK_SEC of that last sample;
//  - it reached the working end no more than TAIL_HOLD_MAX_SEC before the end: a posture held longer (arms crossed,
//    standing straight after the set) is not a rep;
//  - it went TAIL_DEPTH_SHARE as deep as the set's own reps (the median, from the rest threshold): a reach for the
//    phone stops short (the edges tests' reaches go 76 % and 83 % as deep);
//  - the video did not open holding the working end for OPEN_HOLD_SEC (a press racked at the shoulders: ending there
//    again is the end of the set).
// Measured (scoreboard, 18 October 2026): stored sets 11 -> 12 exact of 15 (set02 hip thrust 7), real video 7 -> 8 of
// 16 (chest-supported row 6; lat pulldown 11 read 9 -> 10), none newly off by 3, synthetic 74 -> 74. Depth 0.9 instead
// of 0.85 loses the row; hold 1.0 instead of 1.5 would also read set01 hip thrust 6, by 0.1 s, a fit to one clip.
// Source: UNSOURCED (no published rule for a rep cut by the recording). Status: experimental.
const TAIL_AT_WORK_SEC = 0.6;
const TAIL_HOLD_MAX_SEC = 1.5;
const TAIL_DEPTH_SHARE = 0.85;
const TAIL_REST_MAX_SEC = 4.0;   // a candidate cut rep must begin within 4.0 s of the previous cycle completing (post-set rest + exit is not a rep). Status: experimental
// How many accepted reps the depth is read from (their median). Two until 20 October 2026: a clip of two or three
// reps cut at its last working end then had no depth to compare with, and its last rep never counted (triage of the
// public undercounts, test/real-phone/consensus/triage.test.ts: 47 of 133 such tails refused for this alone). One rep
// is enough: chosen on the public build half A (variant-eval, 251 -> 256 exact, none lost), half B read after
// (251 -> 258, none lost); David's sets, his videos, the synthetic, RepCount-A and occlusion sets unchanged. Of the
// four other guards of this rule relaxed the same day, each lost sets (TRIED.md). Source: UNSOURCED. Status: experimental.
const TAIL_DEPTH_MIN_REPS = 1;
const OPEN_HOLD_SEC = 0.5;
// Splitting an overlong rep at an in-set return that came most of the way back (splitOverlongReps, 3 October
// 2026; extended 25 October 2026 to 2-cycle sets whose shorter cycle lasts at least SPLIT_TWO_MIN_SEC and to
// cycles entered on the first valid sample): two reps whose return between them stopped short of the rest
// threshold read as one long rep. Chosen on the public build half A only (variant-eval, 458 sets, exact against
// 169 before; off by 3 or more 76 throughout):
// return share 0.4 to 0.7: 175 (7 gained, 1 lost), 0.75 and 0.8: 176 (7 gained, 0 lost), 0.85 and 0.9: 175;
// long 1.4 to 1.8: 175-176 (1.4 and 1.6 lose a synthetic set), 2.0 and 2.2: 172; regular below 0.5 makes one
// half-A set newly off by 3, 0.5 to 0.7 the same counts; piece 0.4 to 0.7 the same counts. On 25 October 2026
// (half A, 546 sets, 256 -> 259 exact, 0 lost, off by 3 or more 74 -> 73; half B read after, 258 -> 258 exact,
// off by 3 or more 89 -> 89; David's sets, his videos, synthetic, RepCount-A and occlusion unchanged; TRIED.md):
// SPLIT_MIN_CYCLES = 2 with SPLIT_TWO_MIN_SEC = 0.8, HEAD_MIN_REPS = 1, and splitting first-sample overlong cycles.
// Source: UNSOURCED (no published rule). Status: experimental, chosen on half A.
const SPLIT_MIN_CYCLES = 2;      // fewest accepted cycles for splitOverlongReps to run. Source: UNSOURCED. Status: experimental, chosen on half A
const SPLIT_TWO_MIN_SEC = 0.8;   // in a 2-cycle set, the shorter cycle must last at least this long to anchor the tempo. Source: UNSOURCED. Status: experimental, chosen on half A
const SPLIT_REGULAR = 0.6;       // split only when every rep of the set lasts at least this share of the median rep. Source: UNSOURCED. Status: experimental, chosen on half A
const SPLIT_LONG = 1.7;          // a rep lasting more than this many median reps is a candidate. Source: UNSOURCED. Status: experimental, chosen on half A
const SPLIT_LONG_FIRST = 1.8;    // a cycle entered on the first valid sample needs this many median reps to split, so pre-set adjustments stay unsplit (edges.test.ts). Source: UNSOURCED. Status: experimental
const SPLIT_RETURN_SHARE = 0.8;  // the in-set return must cover this share of the way from the working extreme to the rest threshold. Source: UNSOURCED. Status: experimental, chosen on half A
const SPLIT_REGULAR_DEEP = 0.45; // when a return is unequivocal (>= 85%), sets with mild tempo variation (shortest cycle >= 45% median) may split. Status: experimental
const SPLIT_DEEP_RETURN = 0.85;   // an unequivocal deep return (>= 85%) splits an overlong rep even when set tempo varies (durations[0] < SPLIT_REGULAR * md). Status: experimental
const SPLIT_PIECE = 0.6;         // each piece lasts at least this share of the median rep (and MIN_REP_SEC). Source: UNSOURCED. Status: experimental, chosen on half A

// ─── Public API ───

/**
 * A recount with nearby settings, for the sensitivity check (coreAnalysis.js withSensitivity; stability study of
 * 10 October 2026): marginScale multiplies the threshold margin (step 6), outlierWindow replaces the outlier filter's
 * window in samples (step 3). Absent, the count is the app's own. Never used to change the count shown: a recount that
 * differs only marks the count as one the app cannot measure reliably (R8).
 */
export type CountTuning = { marginScale?: number; outlierWindow?: number };

export function countReps(
  worldLandmarks: WorldLandmarkFrame[],
  timestamps: number[],
  lift: Lift | string,
  tuning: CountTuning = {},
): CountResult {
  // An exercise with no definition (no joint in the guide, or a key the core does not know) gets no
  // count: never another lift's (review of 29 September 2026).
  const def = liftDefinition(lift);
  if (!def) return { count: 0, reps: [], partialCount: 0, totalCount: 0, partials: [], arm: 'left', confidence: 0, angles: [], smoothedAngles: [], lowThreshold: 0, highThreshold: 0 };
  if (def.bothSides) return countBothSides(worldLandmarks, timestamps, def, tuning);
  const seen = selectSide(worldLandmarks, def.joint);
  if (def.together) {
    const joined = countBothSides(worldLandmarks, timestamps, def, tuning);
    const { left, right } = joined.sides!;
    if (correlation(left.smoothedAngles, right.smoothedAngles) > (def.togetherMinCorrelation ?? TOGETHER_MIN_CORRELATION)) {
      // Either knee in sight sees the rep: the share of samples where one of them is.
      const either = left.angles.filter((a, i) => a !== null || right.angles[i] !== null).length;
      return { ...joined, confidence: worldLandmarks.length > 0 ? either / worldLandmarks.length : 0 };
    }
    // The knees do not move together: counted as eitherSide, below.
  }
  const mine = countSide(worldLandmarks, timestamps, def, seen, tuning);
  const countable = (r: CountResult) => r.angles.filter(a => a !== null).length >= worldLandmarks.length / 2;
  if (!def.eitherSide && !def.together) {
    // A still limb counts nothing. When the better seen side counts no rep and stays still (STILL_SIDE_DEG), the
    // other side counts if it is seen on at least half the samples, moves at least MIN_ROM_DEGREES and counts one or
    // more: a one-arm curl or raise filmed from the front sees both arms alike, and the idle one, held still, read 0
    // (IntelliRehabDS, Zenodo record 4610859, review of PR #175 on 14 October 2026: on ird_s101_g00_stand, 6 elbow
    // flexions, the elbow kept spanned 160 to 163 degrees while the other spanned 20 to 167). Only a set the app does
    // not count today (it asks how many, Result.jsx) can change. A side that moves, even too little to count, is
    // kept: the first form of this rule (any count of 0) turned 13 asked sets into numbers, 9 of them wrong, on sets
    // whose better seen side moved 13 to 85 degrees (review of 14 October). An arm's lift read (prone raises) never
    // switches: its far arm's rest wanders past the 10-degree floor (DETECTION, prone_y_raise).
    // Source: UNSOURCED (no published rule). Status: experimental.
    if (mine.count > 0 || def.lift || spreadDeg(mine.smoothedAngles) >= STILL_SIDE_DEG) return mine;
    const other = countSide(worldLandmarks, timestamps, def, seen === 'left' ? 'right' : 'left', tuning);
    return other.count > 0 && countable(other) && spreadDeg(other.smoothedAngles) >= MIN_ROM_DEGREES ? other : mine;
  }
  // The side with more reps; on a tie, the better seen. A side seen in fewer than half the samples, which the count
  // refuses (summarizeCount), is never kept over one seen in more: its extra reps would turn a set the better side
  // counts into a refusal (3 October: a push-up seen 91 % on one elbow and 49 % on the other; a public pull-up
  // labelled 2 went from 0 to refused). Experimental.
  // "Better seen" is selectSide's summed visibility, while a sample is seen only when each landmark clears
  // VIS_THRESHOLD on its own, so the side it picks can be the one seen less: whether each side is countable is
  // compared first, then reps (third audit, C01, 3 October: a push-up whose picked wrist hovered at 0.45 was
  // refused although the other elbow, seen on every sample, counted the same 6). Measured on 3 October with
  // variant-eval: no count moved on David's sets, either public half or the synthetic sets.
  const other = countSide(worldLandmarks, timestamps, def, seen === 'left' ? 'right' : 'left', tuning);
  const mineSeen = countable(mine), otherSeen = countable(other);
  if (mineSeen !== otherSeen) return otherSeen ? other : mine;
  return other.count > mine.count ? other : mine;
}

function sanitizeFixedFeet(worldLandmarks: WorldLandmarkFrame[], joint: Joint, clampInversion = false): WorldLandmarkFrame[] {
  if (joint !== 'knee') return worldLandmarks;
  const lKnee = JOINT_POINTS.knee.left[1], lAnkle = JOINT_POINTS.knee.left[2];
  const rKnee = JOINT_POINTS.knee.right[1], rAnkle = JOINT_POINTS.knee.right[2];
  const lValidY: number[] = [], rValidY: number[] = [];
  const lAnks: WorldLandmark[] = [], rAnks: WorldLandmark[] = [];
  for (const f of worldLandmarks) {
    if (!f) continue;
    if (f[lKnee] && f[lAnkle] && f[lAnkle].y > f[lKnee].y) lValidY.push(f[lAnkle].y);
    if (f[rKnee] && f[rAnkle] && f[rAnkle].y > f[rKnee].y) rValidY.push(f[rAnkle].y);
    if (f[lAnkle] && f[lAnkle].visibility >= VIS_THRESHOLD) lAnks.push(f[lAnkle]);
    if (f[rAnkle] && f[rAnkle].visibility >= VIS_THRESHOLD) rAnks.push(f[rAnkle]);
  }
  const lFootplate = clampInversion && lValidY.length ? lValidY.sort((a, b) => a - b)[Math.floor(lValidY.length * 0.75)] : null;
  const rFootplate = clampInversion && rValidY.length ? rValidY.sort((a, b) => a - b)[Math.floor(rValidY.length * 0.75)] : null;

  // When ankles are clamped in a fixed platform apparatus (e.g. sissy squat machine) and occluded
  // by footplate/roller pads on a majority of frames (< 50%) but seen on >= 5% of frames, hold
  // occluded ankle samples at their median stationary platform coordinate.
  const n = worldLandmarks.length;
  const lOccluded = lAnks.length < n * 0.5 && lAnks.length >= n * 0.05;
  const rOccluded = rAnks.length < n * 0.5 && rAnks.length >= n * 0.05;
  const medPt = (pts: WorldLandmark[]) => {
    if (!pts.length) return null;
    const xs = pts.map(p => p.x).sort((a, b) => a - b);
    const ys = pts.map(p => p.y).sort((a, b) => a - b);
    const zs = pts.map(p => p.z).sort((a, b) => a - b);
    const m = Math.floor(pts.length / 2);
    return { x: xs[m], y: ys[m], z: zs[m] };
  };
  const lMed = lOccluded ? medPt(lAnks) : null;
  const rMed = rOccluded ? medPt(rAnks) : null;

  return worldLandmarks.map(f => {
    if (!f) return null;
    let copy: WorldLandmark[] | null = null;
    if (lMed && (!f[lAnkle] || f[lAnkle].visibility < VIS_THRESHOLD)) {
      copy = f.map((p, i) => (i === lAnkle ? { ...lMed, visibility: 0.99 } : p));
    } else if (lFootplate != null && f[lKnee] && f[lAnkle] && f[lAnkle].y < f[lKnee].y) {
      copy = f.map((p, i) => (i === lAnkle ? { ...p, y: lFootplate } : p));
    }
    if (rMed && (!f[rAnkle] || f[rAnkle].visibility < VIS_THRESHOLD)) {
      copy = (copy || f).map((p, i) => (i === rAnkle ? { ...rMed, visibility: 0.99 } : p));
    } else if (rFootplate != null && f[rKnee] && f[rAnkle] && f[rAnkle].y < f[rKnee].y) {
      copy = (copy || f).map((p, i) => (i === rAnkle ? { ...p, y: rFootplate } : p));
    }
    return copy || f;
  });
}

function countSide(
  worldLandmarks: WorldLandmarkFrame[],
  timestamps: number[],
  def: LiftDefinition,
  arm: 'left' | 'right',
  tuning: CountTuning = {},
): CountResult {
  const landmarks = def.fixedFeet ? sanitizeFixedFeet(worldLandmarks, def.joint, !!def.clampFootplateInversion) : worldLandmarks;
  // 1. Extract raw angle per sample
  const zw = setZWeight(landmarks);
  const liftEnd = def.lift ? chooseLiftEnd(landmarks, def.joint, arm) : undefined;
  const rawAngles = landmarks.map(wl => {
    if (!wl) return null;
    return extractAngle(wl, def.joint, arm, zw, def.lift, liftEnd);
  });
  // T1 (survey.ts, FILL_FROM_PARTNER, off): samples the counted side misses, filled from the other side's angle.
  // rawAngles stays as seen (coverage); `filled` marks the samples that were not.
  const { values: filledAngles, filled } = fillFromPartner(rawAngles, landmarks, def, arm, zw);

  // 2. Estimate sample rate from timestamps
  const sampleRate = estimateSampleRate(timestamps);

  // 3. Remove outliers (before bridging, so spikes don't propagate)
  const outlierSize = tuning.outlierWindow ?? secToOddSamples(OUTLIER_WINDOW_SEC, sampleRate);
  const cleaned = removeOutliers(filledAngles, outlierSize, OUTLIER_DEVIATION_DEG);

  // 4. Bridge short dropouts
  const bridged = bridgeDropouts(cleaned, timestamps, BRIDGE_GAP_SEC);

  // 5. Smooth with Savitzky–Golay (window in seconds)
  const sgSize = secToOddSamples(SG_WINDOW_SEC, sampleRate);
  const smoothed = savitzkyGolay(bridged, sgSize);

  // 6. Compute thresholds from the set's own range
  const validAngles = smoothed.filter((a): a is number => a !== null);
  if (validAngles.length < 3) {
    return { count: 0, reps: [], partialCount: 0, totalCount: 0, partials: [], arm, confidence: 0, angles: rawAngles, smoothedAngles: smoothed, lowThreshold: 0, highThreshold: 0 };
  }
  const sorted = [...validAngles].sort((a, b) => a - b);
  const p = (pct: number) => sorted[Math.floor(sorted.length * pct / 100)];
  const pLow = p(PERCENTILE_LOW);
  const pHigh = p(PERCENTILE_HIGH);
  const range = pHigh - pLow;

  if (range < (def.minRangeDeg ?? MIN_ROM_DEGREES)) {
    return { count: 0, reps: [], partialCount: 0, totalCount: 0, partials: [], arm, confidence: 0, angles: rawAngles, smoothedAngles: smoothed, lowThreshold: pLow, highThreshold: pHigh };
  }

  const scale = tuning.marginScale ?? 1;
  const margin = range * (def.thresholdMargin ?? THRESHOLD_MARGIN) * scale;
  // The working end may sit further in (LiftDefinition.workMargin, squat); the rest end keeps the margin.
  const workMargin = range * (def.workMargin ?? def.thresholdMargin ?? THRESHOLD_MARGIN) * scale;
  const lowThreshold = pLow + (def.rest === 'high' ? workMargin : margin);
  const highThreshold = pHigh - (def.rest === 'high' ? margin : workMargin);

  // 7. Detect reps via threshold crossings, then place their boundaries at the rest
  const cycles = detectReps(smoothed, timestamps, lowThreshold, highThreshold, def.rest, def.minRepRomDeg ?? MIN_ROM_DEGREES, def.minRepSec ?? MIN_REP_SEC, !!def.noSplit, def.joint !== 'elbow', !!def.lift, rawAngles.map(a => a !== null));
  const band = Math.max(REST_BAND_MIN_DEG, range * REST_BAND_FRACTION);
  // Speeds are read only where every sample the smoothing used was seen, not filled in by the bridge: the jump
  // where a pose comes back after a short loss is no limb's speed (second audit, 3 October).
  const halfSg = Math.floor(sgSize / 2);
  const seenAround = cleaned.map((_, i) => { for (let j = Math.max(0, i - halfSg); j <= Math.min(cleaned.length - 1, i + halfSg); j++) if ((cleaned[j] === null && bridged[j] !== null) || filled[j]) return false; return true; });
  const reps = placeBoundaries(cycles, smoothed, timestamps, lowThreshold, highThreshold, band, def, seenAround);

  // Partial repetitions (lengthened and shortened partials):
  const partials = detectPartialReps(smoothed, timestamps, lowThreshold, highThreshold, def, range, cycles, reps, seenAround);

  // 8. Confidence: fraction of samples with a detected pose on the tracked side. It is pose coverage, not certainty
  // that the count is right: a set seen throughout can still be miscounted (Astra's review of 5 October). Read it as
  // coverage; the field keeps its name for the sets already saved with it.
  const totalSamples = worldLandmarks.length;
  const detectedSamples = rawAngles.filter(a => a !== null).length;
  const confidence = totalSamples > 0 ? detectedSamples / totalSamples : 0;

  return {
    count: reps.length,
    reps,
    partialCount: partials.length,
    totalCount: reps.length + partials.length,
    partials,
    arm,
    confidence,
    angles: rawAngles,
    smoothedAngles: smoothed,
    lowThreshold,
    highThreshold,
    ...(cycles.headRefused ? { headRefused: true } : {}),
  };
}

/** Steps 1–5 of the count for one side: raw angle, outliers removed, dropouts bridged, smoothed. */
export function sideAngles(worldLandmarks: WorldLandmarkFrame[], timestamps: number[], def: LiftDefinition, arm: 'left' | 'right') {
  const landmarks = def.fixedFeet ? sanitizeFixedFeet(worldLandmarks, def.joint, !!def.clampFootplateInversion) : worldLandmarks;
  const zw = setZWeight(landmarks);
  const liftEnd = def.lift ? chooseLiftEnd(landmarks, def.joint, arm) : undefined;
  const rawAngles = landmarks.map(wl => (wl ? extractAngle(wl, def.joint, arm, zw, def.lift, liftEnd) : null));
  const { values: filledAngles } = fillFromPartner(rawAngles, landmarks, def, arm, zw);
  const sampleRate = estimateSampleRate(timestamps);
  const cleaned = removeOutliers(filledAngles, secToOddSamples(OUTLIER_WINDOW_SEC, sampleRate), OUTLIER_DEVIATION_DEG);
  const bridged = bridgeDropouts(cleaned, timestamps, BRIDGE_GAP_SEC);
  return { rawAngles, smoothed: savitzkyGolay(bridged, secToOddSamples(SG_WINDOW_SEC, sampleRate)) };
}

/**
 * How far the lift's own joint moves over the whole video, in degrees: the 95th minus the 5th percentile
 * of the smoothed angle on the side the count tracks (for an either-side or together lift, the larger of the two
 * sides, since either may be counted); NaN with no definition or no angle. Under
 * MIN_ROM_DEGREES the count is 0 whatever the video (its 90th minus 10th percentile is smaller still), so the
 * batch collector warns there: the video is likely not the labelled lift, or not filmed so the joint shows
 * (1 October 2026: three of four sets paired with the wrong label read 11 to 22 degrees).
 */
export const COUNTABLE_RANGE_DEG = MIN_ROM_DEGREES;
export function jointRange(worldLandmarks: WorldLandmarkFrame[], timestamps: number[], lift: Lift | string): number {
  const def = liftDefinition(lift);
  // A both-sides lift counts each arm on its own: one still arm says nothing about the set.
  if (!def || def.bothSides) return NaN;
  const range = (arm: 'left' | 'right') => {
    const xs = sideAngles(worldLandmarks, timestamps, def, arm).smoothed
      .filter((a): a is number => a !== null).sort((a, b) => a - b);
    return xs.length < 3 ? NaN : xs[Math.floor(xs.length * 0.95)] - xs[Math.floor(xs.length * 0.05)];
  };
  // The side the count tracks, which is the other one when the better seen limb stays still (countReps).
  if (!def.eitherSide && !def.together) return range(countReps(worldLandmarks, timestamps, lift).arm as 'left' | 'right');
  // An either-side or together lift can be counted on either side (countReps), so the larger of the two ranges:
  // a still, better seen limb beside a working one no longer warns beside a count (third audit, C03, 3 October).
  const both = [range('left'), range('right')].filter(x => !Number.isNaN(x));
  return both.length ? Math.max(...both) : NaN;
}

// ─── Both sides: the alternating curl and the guide's both-sides exercises ───

/**
 * Each arm is counted on its own, then the two lists are joined in time order:
 * a rep of one arm that overlaps a rep of the other by more than TOGETHER_OVERLAP
 * of the shorter is the same rep done with both arms together and counts once;
 * every other rep counts for its arm (David, 27 September: one rep per arm).
 * For a lift whose two sides bend on every rep (`together`, the lunges), two reps
 * are also one when the middle of either falls inside the other: one knee bending
 * a little after the other is still the same rep (review of 3 October: half a
 * second's lag counted 12 for 6). Status: experimental, UNSOURCED.
 * The count needs both arms in view, so the confidence is the lower of the two.
 */
function countBothSides(worldLandmarks: WorldLandmarkFrame[], timestamps: number[], def: LiftDefinition, tuning: CountTuning = {}): CountResult {
  const left = countSide(worldLandmarks, timestamps, def, 'left', tuning);
  const right = countSide(worldLandmarks, timestamps, def, 'right', tuning);
  // T5 (survey.ts, ALT_DIFF, off): the two sides move in turn, so the reps are read on their difference.
  if (def.bothSides && !def.together && altDiffOn() && correlation(left.smoothedAngles, right.smoothedAngles) < altMaxR()) {
    const alt = countAlternating(left, right, timestamps, def);
    if (alt) return alt;
  }
  const all = [
    ...left.reps.map(r => ({ ...r, side: 'left' as const })),
    ...right.reps.map(r => ({ ...r, side: 'right' as const })),
  ].sort((a, b) => a.startTime - b.startTime);
  const joined: RepDetail[] = [];
  for (const r of all) {
    const last = joined[joined.length - 1];
    if (last && last.side !== 'both' && last.side !== r.side) {
      const overlap = Math.min(last.endTime, r.endTime) - Math.max(last.startTime, r.startTime);
      const shorter = Math.min(last.endTime - last.startTime, r.endTime - r.startTime);
      const mid = (x: { startTime: number; endTime: number }) => (x.startTime + x.endTime) / 2;
      const inside = (m: number, x: { startTime: number; endTime: number }) => m >= x.startTime && m <= x.endTime;
      if (overlap > TOGETHER_OVERLAP * shorter || (def.together && (inside(mid(r), last) || inside(mid(last), r)))) {
        // One rep with both arms: its span covers both, its measures are one arm's, the arm with the larger range,
        // so its phases and speeds belong together; it is cut if either arm's was (audit FINDING-013: the largest
        // range and speeds of the two were kept with the first arm's phases, a rep no arm made).
        const big = r.romDegrees > last.romDegrees ? r : last;
        last.side = 'both';
        last.startTime = Math.min(last.startTime, r.startTime);
        last.endTime = Math.max(last.endTime, r.endTime);
        last.romDegrees = big.romDegrees;
        last.concentricSec = big.concentricSec;
        last.eccentricSec = big.eccentricSec;
        last.peakSpeed = big.peakSpeed;
        last.meanSpeed = big.meanSpeed;
        if (last.clipped || r.clipped) last.clipped = true;
        continue;
      }
    }
    joined.push({ ...r });
  }
  joined.forEach((r, i) => { r.index = i + 1; });

  const joinedPartials: RepDetail[] = [];
  const allPartials = [
    ...(left.partials || []).map(r => ({ ...r, side: 'left' as const })),
    ...(right.partials || []).map(r => ({ ...r, side: 'right' as const })),
  ].sort((a, b) => a.startTime - b.startTime);
  for (const r of allPartials) {
    const last = joinedPartials[joinedPartials.length - 1];
    if (last && last.side !== 'both' && last.side !== r.side) {
      const overlap = Math.min(last.endTime, r.endTime) - Math.max(last.startTime, r.startTime);
      const shorter = Math.min(last.endTime - last.startTime, r.endTime - r.startTime);
      if (overlap > TOGETHER_OVERLAP * shorter) {
        last.side = 'both';
        continue;
      }
    }
    joinedPartials.push({ ...r });
  }
  joinedPartials.forEach((r, i) => { r.index = i + 1; });

  const primary = left.reps.length >= right.reps.length ? left : right;
  return {
    count: joined.length,
    reps: joined,
    partialCount: joinedPartials.length,
    totalCount: joined.length + joinedPartials.length,
    partials: joinedPartials,
    arm: 'both',
    confidence: Math.min(left.confidence, right.confidence),
    angles: primary.angles,
    smoothedAngles: primary.smoothedAngles,
    lowThreshold: primary.lowThreshold,
    highThreshold: primary.highThreshold,
    sides: { left, right },
  };
}

/**
 * T5: an alternating lift read on the left minus right difference of the smoothed angles. Each excursion of the
 * difference to one side is one rep of the arm that moved (for a lift resting high, the left arm working pulls the
 * difference below zero); a full cycle of the difference is two reps. Each half is counted as a one-sided signal
 * resting at 0, by the core's own thresholds and rep rules. Null when the difference has no range.
 */
function countAlternating(left: CountResult, right: CountResult, timestamps: number[], def: LiftDefinition): CountResult | null {
  const diff = left.smoothedAngles.map((l, i) => { const r = right.smoothedAngles[i]; return l === null || r === null ? null : l - r; });
  const restHigh = def.rest === 'high';
  const half = (sign: -1 | 1, side: 'left' | 'right') => {
    // Oriented as the lift: resting high, the working side's excursion goes down.
    const s = diff.map(d => (d === null ? null : sign < 0 ? Math.min(d, 0) : Math.max(d, 0)));
    const rest: 'high' | 'low' = sign < 0 ? 'high' : 'low';
    const vals = s.filter((a): a is number => a !== null).sort((a, b) => a - b);
    if (vals.length < 3) return [];
    const p = (pct: number) => vals[Math.floor(vals.length * pct / 100)];
    const pLow = p(PERCENTILE_LOW), pHigh = p(PERCENTILE_HIGH), range = pHigh - pLow;
    if (range < (def.minRangeDeg ?? MIN_ROM_DEGREES)) return [];
    const margin = range * (def.thresholdMargin ?? THRESHOLD_MARGIN);
    const lowT = pLow + margin, highT = pHigh - margin;
    const cycles = detectReps(s, timestamps, lowT, highT, rest, def.minRepRomDeg ?? MIN_ROM_DEGREES);
    const band = Math.max(REST_BAND_MIN_DEG, range * REST_BAND_FRACTION);
    return placeBoundaries(cycles, s, timestamps, lowT, highT, band, { ...def, rest }).map(r => ({ ...r, side }));
  };
  const reps = [...half(-1, restHigh ? 'left' : 'right'), ...half(1, restHigh ? 'right' : 'left')].sort((a, b) => a.startTime - b.startTime);
  if (!reps.length) return null;
  reps.forEach((r, i) => { r.index = i + 1; });
  const primary = left.reps.length >= right.reps.length ? left : right;
  return {
    count: reps.length, reps, arm: 'both', confidence: Math.min(left.confidence, right.confidence),
    angles: primary.angles, smoothedAngles: primary.smoothedAngles, lowThreshold: primary.lowThreshold, highThreshold: primary.highThreshold,
    sides: { left, right },
  };
}

/** Pearson correlation of two angle series over the samples where both have a value; 0 under three such samples or with no spread. */
function correlation(a: (number | null)[], b: (number | null)[]): number {
  const xs: number[] = [], ys: number[] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a[i], y = b[i];
    if (x !== null && y !== null) { xs.push(x); ys.push(y); }
  }
  if (xs.length < 3) return 0;
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length, my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
}

// ─── Side selection ───

function selectSide(worldLandmarks: WorldLandmarkFrame[], joint: Joint): 'left' | 'right' {
  const [la, lb, lc] = JOINT_POINTS[joint].left;
  const [ra, rb, rc] = JOINT_POINTS[joint].right;
  let lVis = 0, rVis = 0, count = 0;
  for (const wl of worldLandmarks) {
    if (!wl) continue;
    count++;
    lVis += vis(wl[la]) + vis(wl[lb]) + vis(wl[lc]);
    rVis += vis(wl[ra]) + vis(wl[rb]) + vis(wl[rc]);
  }
  if (count === 0) return 'left';
  return lVis >= rVis ? 'left' : 'right';
}

/** The 95th minus the 5th percentile of the angles seen, in degrees, as jointRange reads it; 0 under 3 angles. */
function spreadDeg(angles: (number | null)[]): number {
  const xs = angles.filter((a): a is number => a !== null).sort((a, b) => a - b);
  return xs.length < 3 ? 0 : xs[Math.floor(xs.length * 0.95)] - xs[Math.floor(xs.length * 0.05)];
}

function vis(p: WorldLandmark): number {
  return p?.visibility ?? 0;
}

function chooseLiftEnd(worldLandmarks: WorldLandmarkFrame[], joint: Joint, arm: 'left' | 'right'): number {
  const [, ie] = LIFT_POINTS[joint][arm];
  const seen = worldLandmarks.filter(wl => wl && vis(wl[ie]) >= VIS_THRESHOLD).length;
  // If the wrist/ankle is seen on at least 20% of frames, track it consistently for the whole set;
  // otherwise fallback to elbow/knee consistently, preventing frame-to-frame sawtooth switching.
  if (seen >= worldLandmarks.length * 0.2) return ie;
  return joint === 'shoulder' ? (arm === 'left' ? L_ELBOW : R_ELBOW) : (arm === 'left' ? L_KNEE : R_KNEE);
}

// ─── Angle extraction ───

function extractAngle(wl: WorldLandmark[], joint: Joint, arm: 'left' | 'right', zw = 1, lift = false, liftEnd?: number): number | null {
  if (lift) {
    const [iv, defaultEnd] = LIFT_POINTS[joint][arm];
    const target = liftEnd ?? defaultEnd;
    if (vis(wl[iv]) < VIS_THRESHOLD || vis(wl[target]) < VIS_THRESHOLD) return null;
    return liftAngleDeg(wl[iv], wl[target]);
  }
  const [ia, ib, ic] = JOINT_POINTS[joint][arm];
  const a = wl[ia], b = wl[ib], c = wl[ic];
  if (vis(a) < VIS_THRESHOLD || vis(b) < VIS_THRESHOLD || vis(c) < VIS_THRESHOLD) {
    return null;
  }
  return angleDeg(a, b, c, zw);
}

// T3 (survey.ts, Z_WEIGHT, off at 1): the depth weight for this set: below 1 only on a set read as filmed from the
// side (its shoulder line points mostly into depth), so a front-view squat or curl, which bends in depth, keeps z.
function setZWeight(worldLandmarks: WorldLandmarkFrame[]): number {
  const w = zWeight();
  if (w === 1) return 1;
  if (zAllViews()) return w;
  return depthShare(worldLandmarks) >= sideShare() ? w : 1;
}

// T1 (survey.ts): missing samples of this side's angle filled from the other side's, through a straight line fitted
// where both are seen, when they correlate at |r| >= FILL_MIN_R. Not for a lift counted on both sides.
function fillFromPartner(raw: (number | null)[], worldLandmarks: WorldLandmarkFrame[], def: LiftDefinition, arm: 'left' | 'right', zw: number) {
  const none = { values: raw, filled: raw.map(() => false) };
  if (!fillOn() || def.bothSides || !raw.some(a => a === null)) return none;
  const otherArm = arm === 'left' ? 'right' : 'left';
  const otherEnd = def.lift ? chooseLiftEnd(worldLandmarks, def.joint, otherArm) : undefined;
  const other = worldLandmarks.map(wl => (wl ? extractAngle(wl, def.joint, otherArm, zw, def.lift, otherEnd) : null));
  const { a, b, r, n } = fitLine(other, raw);
  if (n < FILL_MIN_PAIRS || Math.abs(r) < fillMinR()) return none;
  const filled = raw.map((x, i) => x === null && other[i] !== null);
  return { values: raw.map((x, i) => (filled[i] ? a + b * other[i]! : x)), filled };
}

function angleDeg(a: WorldLandmark, vertex: WorldLandmark, c: WorldLandmark, zw = 1): number {
  const v1x = a.x - vertex.x, v1y = a.y - vertex.y, v1z = (a.z - vertex.z) * zw;
  const v2x = c.x - vertex.x, v2y = c.y - vertex.y, v2z = (c.z - vertex.z) * zw;
  const dot = v1x * v2x + v1y * v2y + v1z * v2z;
  const m1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
  const m2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);
  if (m1 < 1e-9 || m2 < 1e-9) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / (m1 * m2)))) * (180 / Math.PI);
}

/**
 * The lift of a limb against gravity (LiftDefinition.lift): 180 plus its angle above the horizontal, in degrees, from
 * the joint to the limb's end, in world coordinates (y down). 180 level, above 180 rising, below falling.
 */
export function liftAngleDeg(vertex: WorldLandmark, c: WorldLandmark): number {
  const ex = c.x - vertex.x, ey = c.y - vertex.y, ez = c.z - vertex.z;
  return 180 + Math.atan2(-ey, Math.hypot(ex, ez)) * (180 / Math.PI);
}

// ─── Sample rate helpers ───

function estimateSampleRate(timestamps: number[]): number {
  if (timestamps.length < 2) return 15;
  const duration = timestamps[timestamps.length - 1] - timestamps[0];
  if (duration <= 0) return 15;
  return (timestamps.length - 1) / duration;
}

function secToOddSamples(sec: number, sampleRate: number): number {
  let n = Math.round(sec * sampleRate);
  if (n < 3) n = 3;
  if (n % 2 === 0) n += 1;
  return n;
}

// ─── Outlier removal ───

/**
 * Nulls samples that deviate from their local median by more than maxDev degrees.
 * Requires at least 2 non-null neighbors (excluding self) to judge; otherwise
 * keeps the sample. Run before bridging so spikes don't propagate.
 */
function removeOutliers(
  angles: (number | null)[],
  windowSize: number,
  maxDev: number,
): (number | null)[] {
  const result: (number | null)[] = [...angles];
  const half = Math.floor(windowSize / 2);

  for (let i = 0; i < angles.length; i++) {
    if (angles[i] === null) continue;
    const neighbors: number[] = [];
    const lo = Math.max(0, i - half);
    const hi = Math.min(angles.length - 1, i + half);
    for (let j = lo; j <= hi; j++) {
      if (j === i) continue;
      const v = angles[j];
      if (v !== null) neighbors.push(v);
    }
    if (neighbors.length < 2) continue;
    neighbors.sort((a, b) => a - b);
    const median = neighbors[Math.floor(neighbors.length / 2)];
    if (Math.abs(angles[i]! - median) > maxDev) {
      result[i] = null;
    }
  }
  return result;
}

// ─── Bridging ───

function bridgeDropouts(
  angles: (number | null)[],
  timestamps: number[],
  maxGapSec: number,
): (number | null)[] {
  const result = [...angles];
  let lastValid: number | null = null;
  let lastValidTime = -Infinity;
  const interpolate = interpolateOn();
  let next = -1; // T2: the next seen sample after a gap, looked up once per gap

  for (let i = 0; i < result.length; i++) {
    if (result[i] !== null) {
      lastValid = result[i];
      lastValidTime = timestamps[i];
    } else if (lastValid !== null && (timestamps[i] - lastValidTime) <= maxGapSec) {
      // T2 (survey.ts, BRIDGE_INTERPOLATE, off): an inner gap no longer than maxGapSec, seen on both sides, is filled
      // by a straight line; otherwise the last value is repeated, as before.
      if (interpolate) {
        if (next < i) { next = i; while (next < angles.length && angles[next] === null) next++; }
        if (next < angles.length && timestamps[next] - lastValidTime <= maxGapSec) {
          const f = (timestamps[i] - lastValidTime) / (timestamps[next] - lastValidTime);
          result[i] = lastValid + f * (angles[next]! - lastValid);
          continue;
        }
      }
      result[i] = lastValid;
    }
  }
  return result;
}

// ─── Smoothing ───

function savitzkyGolay(angles: (number | null)[], windowSize: number): (number | null)[] {
  const kernel = sgKernel(windowSize);
  const result: (number | null)[] = [...angles];
  const half = Math.floor(kernel.length / 2);

  for (let i = half; i < angles.length - half; i++) {
    let sum = 0;
    let allValid = true;
    for (let j = 0; j < kernel.length; j++) {
      const v = angles[i - half + j];
      if (v === null) { allValid = false; break; }
      sum += kernel[j] * v;
    }
    if (allValid) result[i] = sum;
  }
  return result;
}

// ─── Rep detection ───

/**
 * A rep leaves the rest end and comes back to it, crossing both thresholds:
 *   rest high (curl, rows, presses, pulldown, squat…): high → low → high
 *   rest low (lateral raise, triceps pushdown, leg extension, hip thrust): low → high → low
 * Returns each accepted cycle as sample indices: where the state machine entered
 * the rep, and where it completed it. Which cycles count is decided here alone.
 * The sample that enters a rep is itself checked against the working threshold: the first
 * sample of a video, or the first after a lost pose, may already be there (window-edges,
 * 3 October 2026: unchecked, such a rep counted only when a second sample was there too).
 * `cut`: the video, or a pose lost until its end, stopped the rep on its way back.
 */
interface Cycle { enter: number; complete: number; cut?: boolean }

function detectReps(
  smoothed: (number | null)[],
  timestamps: number[],
  lowThreshold: number,
  highThreshold: number,
  rest: 'high' | 'low',
  minRom: number = MIN_ROM_DEGREES,
  minSec: number = MIN_REP_SEC,
  noSplit: boolean = false,
  isLift: boolean = false,
  isLimbLift: boolean = false,
  seen: boolean[] | null = null,
): Cycle[] & { headRefused?: boolean } {
  const restsLow = rest === 'low';
  const cycles: Cycle[] = [];
  let state: 'waiting' | 'inRep' = 'waiting';
  let repStartIdx = -1;
  let peakAngle = -Infinity;
  let troughAngle = Infinity;
  let crossIdx = -1;
  // Where the working extreme was last deepened, per cycle (the rep's return is timed from it), and the
  // first rep's return when the video opened on it (see HEAD_RETURN_SHARE).
  let hiIdx = -1;
  const hiIdxs: number[] = [];
  let enteredAtWork = false;
  let head: Cycle | null = null;
  let minAfterCross = Infinity;
  let minAfterCrossIdx = -1;
  // The rest end's extreme while waiting (the lowest angle for a lift that rests low, the highest otherwise), so a rep's
  // range is read from where it left rest, not from the sample that crossed the rest threshold (12 October 2026). Read
  // from that crossing, the range lost the stretch under the hysteresis band (THRESHOLD_MARGIN of the set's range, a
  // quarter on the prone Y raise), so a rep the replay showed at 12.7 degrees failed a 10-degree floor
  // (benchmark-catalogue.test.ts, depth); RepDetail.romDegrees was already read from the rest.
  let restExtreme = restsLow ? Infinity : -Infinity;
  let firstSeen = -1;
  for (let i = 0; i < smoothed.length; i++) if (smoothed[i] !== null) { firstSeen = i; break; }
  // A cycle's moving time: its duration less the time it spent past the working threshold (two consecutive samples
  // both past it), that hold counted up to WORK_HOLD_CAP_SEC. MAX_REP_SEC bounds this, not the whole duration.
  const atWork = (a: number | null) => a !== null && (restsLow ? a >= highThreshold : a <= lowThreshold);
  const moving = (from: number, to: number) => {
    let held = 0;
    for (let i = from + 1; i <= to; i++) if (atWork(smoothed[i]) && atWork(smoothed[i - 1])) held += timestamps[i] - timestamps[i - 1];
    return timestamps[to] - timestamps[from] - Math.min(held, WORK_HOLD_CAP_SEC);
  };
  // A cycle whose entering sample is already at the working end (the video, or the pose after a loss, opens on it)
  // keeps the bound on its whole duration: what came before the hold is not seen, so the hold may be setup, not a
  // rep's pause (context.test.ts: 8 s holding a dumbbell with the elbow bent before a curl set read as an 11th rep).
  const bounded = (from: number, to: number) =>
    (enteredAtWork ? timestamps[to] - timestamps[from] : moving(from, to)) <= MAX_REP_SEC;

  for (let i = 0; i < smoothed.length; i++) {
    const angle = smoothed[i];
    if (angle === null) continue;

    if (restsLow) {
      if (state === 'waiting') {
        if (angle > lowThreshold) {
          state = 'inRep';
          repStartIdx = i;
          peakAngle = angle;
          troughAngle = isLift && Number.isFinite(restExtreme) ? restExtreme : angle;
          crossIdx = angle >= highThreshold ? i : -1; // the entering sample may already be at the working end
          enteredAtWork = crossIdx === i;
          hiIdx = i;
          minAfterCross = Infinity;
          minAfterCrossIdx = -1;
        } else {
          restExtreme = Math.min(restExtreme, angle);
        }
      } else {
        if (angle > peakAngle) hiIdx = i;
        peakAngle = Math.max(peakAngle, angle);
        troughAngle = Math.min(troughAngle, angle);
        if (angle >= highThreshold) crossIdx = i;

        if (isLimbLift && crossIdx > -1) {
          if (angle < minAfterCross) {
            minAfterCross = angle;
            minAfterCrossIdx = i;
          }
        }

        if (angle < lowThreshold && crossIdx > -1) {
          const rom = peakAngle - troughAngle;
          const duration = timestamps[i] - timestamps[repStartIdx];
          if (duration >= minSec && bounded(repStartIdx, i) && rom >= minRom) {
            cycles.push({ enter: repStartIdx, complete: i });
            hiIdxs.push(hiIdx);
          } else if (duration < minSec && rom >= minRom && !cycles.length && !head
            && repStartIdx === firstSeen && enteredAtWork) {
            head = { enter: repStartIdx, complete: i }; // only its return is on video: judged after the loop
          }
          state = 'waiting';
          restExtreme = angle;
          minAfterCross = Infinity;
          minAfterCrossIdx = -1;
        } else if (isLimbLift && crossIdx > -1 && minAfterCrossIdx > -1 && Number.isFinite(minAfterCross)) {
          // Adaptive floor turnaround: if lifter tires and arms move from forward flexion to
          // backward extension (swimmer/pigeon/T wings) on later reps, angle returned by >= 70% of
          // amplitude and is now ascending again toward highThreshold by at least 2.5 degrees.
          const currentRom = peakAngle - troughAngle;
          const returnDrop = peakAngle - minAfterCross;
          const turnClimb = angle - minAfterCross;
          const thresholdBand = highThreshold - lowThreshold;
          if (
            (returnDrop >= 0.70 * currentRom || minAfterCross <= lowThreshold + 0.20 * thresholdBand) &&
            turnClimb >= Math.max(2.5, 0.20 * currentRom) &&
            minAfterCrossIdx > repStartIdx
          ) {
            const rom = peakAngle - minAfterCross;
            const duration = timestamps[minAfterCrossIdx] - timestamps[repStartIdx];
            if (duration >= minSec && bounded(repStartIdx, minAfterCrossIdx) && rom >= minRom) {
              cycles.push({ enter: repStartIdx, complete: minAfterCrossIdx });
              hiIdxs.push(hiIdx);
            }
            state = 'inRep';
            repStartIdx = minAfterCrossIdx;
            peakAngle = angle;
            troughAngle = minAfterCross;
            crossIdx = angle >= highThreshold ? i : -1;
            enteredAtWork = crossIdx === i;
            hiIdx = i;
            minAfterCross = Infinity;
            minAfterCrossIdx = -1;
          }
        } else if (angle < lowThreshold) {
          state = 'waiting'; // back at rest without reaching the working end: not a rep
          restExtreme = angle;
          minAfterCross = Infinity;
          minAfterCrossIdx = -1;
        }
      }
    } else {
      if (state === 'waiting') {
        if (angle < highThreshold) {
          state = 'inRep';
          repStartIdx = i;
          peakAngle = isLift && Number.isFinite(restExtreme) ? restExtreme : angle;
          troughAngle = angle;
          crossIdx = angle <= lowThreshold ? i : -1; // the entering sample may already be at the working end
          enteredAtWork = crossIdx === i;
          hiIdx = i;
        } else {
          restExtreme = Math.max(restExtreme, angle);
        }
      } else {
        if (angle < troughAngle) hiIdx = i;
        peakAngle = Math.max(peakAngle, angle);
        troughAngle = Math.min(troughAngle, angle);
        if (angle <= lowThreshold) crossIdx = i;
        if (angle > highThreshold && crossIdx > -1) {
          const rom = peakAngle - troughAngle;
          const duration = timestamps[i] - timestamps[repStartIdx];
          if (duration >= minSec && bounded(repStartIdx, i) && rom >= minRom) {
            cycles.push({ enter: repStartIdx, complete: i });
            hiIdxs.push(hiIdx);
          } else if (duration < minSec && rom >= minRom && !cycles.length && !head
            && repStartIdx === firstSeen && enteredAtWork) {
            head = { enter: repStartIdx, complete: i }; // only its return is on video: judged after the loop
          }
          state = 'waiting';
          restExtreme = angle;
        } else if (angle > highThreshold) {
          state = 'waiting'; // back at rest without reaching the working end: not a rep
          restExtreme = angle;
        }
      }
    }
  }

  // A first rep whose return is all the video shows: it counts when that return took at least HEAD_RETURN_SHARE of
  // the set's own extreme-to-rest time (median over the accepted reps). Judged on the accepted reps as the state
  // machine found them, before splitOverlongReps adds pieces that have no working extreme of their own (audit of
  // 6 October, action 4: read after the split, a piece was timed from a later rep's extreme, the times fell below
  // zero, and any quick first return counted).
  let headCounts = false;
  if (head && cycles.length >= HEAD_MIN_REPS) {
    const backs = cycles.map((c, k) => timestamps[c.complete] - timestamps[hiIdxs[k]]).sort((x, y) => x - y);
    const m = Math.floor(backs.length / 2);
    const back = backs.length % 2 ? backs[m] : (backs[m - 1] + backs[m]) / 2;
    headCounts = timestamps[head.complete] - timestamps[head.enter] >= HEAD_RETURN_SHARE * back;
  }

  // T4 (survey.ts, SHAPE_EDGES, off): the set's own rep shape, from the reps accepted so far.
  const shape = shapeOn() ? repShape(cycles, smoothed, timestamps, lowThreshold, highThreshold, restsLow) : null;
  if (!noSplit) splitOverlongReps(cycles, smoothed, timestamps, lowThreshold, highThreshold, restsLow, minRom, shape);
  let headRefused = false;
  if (head && headCounts) cycles.unshift(head);
  // T4: a first rep the head rule refused counts when its return matches the end of the set's rep shape.
  else if (head && shape && shapePart('h') && shape.matches(head.enter, head.complete, 'end')) cycles.unshift(head);
  // A head judged and refused (two accepted reps to compare with): reported, never counted.
  else if (head && cycles.length >= 2) headRefused = true;

  // A last rep the video (or a pose lost until its end) stopped on its way back: it reached the working end and
  // has covered CUT_RETURN_SHARE of its return to the rest threshold, within RETURN_WINDOW_SEC of leaving its
  // working half, and it meets every rule a whole rep meets, the lift's own range floor (minRom) included (third
  // audit, C02, 3 October: it read the core's 20° where a whole push-up needs 15°; no count moved). A movement after the set that goes to a new
  // position and stays there (arms crossed, phone in hand, standing up) never comes back that far.
  if (state === 'inRep' && crossIdx > -1) {
    let last = smoothed.length - 1;
    while (last > repStartIdx && smoothed[last] === null) last--;
    const extreme = restsLow ? peakAngle : troughAngle;
    const returned = (smoothed[last]! - extreme) / ((restsLow ? lowThreshold : highThreshold) - extreme);
    const mid = (lowThreshold + highThreshold) / 2;
    let lastWorking = repStartIdx;
    for (let i = repStartIdx; i <= last; i++) {
      const a = smoothed[i];
      if (a !== null && (restsLow ? a > mid : a < mid)) lastWorking = i;
    }
    let lastAtWork = -1, firstAtWork = -1;
    for (let i = repStartIdx; i <= last; i++) if (atWork(smoothed[i])) { lastAtWork = i; if (firstAtWork < 0) firstAtWork = i; }
    const duration = timestamps[last] - timestamps[repStartIdx];
    const whole = duration >= minSec && bounded(repStartIdx, last) && peakAngle - troughAngle >= minRom;
    // Seen by the pose model, not filled in, from where it reached the working end to the video's last sample.
    const seenToEnd = !!seen && firstAtWork > -1 && last === timestamps.length - 1
      && seen.slice(firstAtWork, last + 1).every(Boolean);
    // As deep as the set's own reps: the median working extreme of the accepted reps, measured from the rest threshold.
    const restLine = restsLow ? lowThreshold : highThreshold;
    const depths = cycles.map(c => {
      let e = restLine;
      for (let i = c.enter; i <= c.complete; i++) { const a = smoothed[i]; if (a !== null) e = restsLow ? Math.max(e, a) : Math.min(e, a); }
      return Math.abs(e - restLine);
    }).sort((x, y) => x - y);
    const setDepth = depths.length >= TAIL_DEPTH_MIN_REPS ? depths[Math.floor(depths.length / 2)] : Infinity;
    const deepEnough = Math.abs((restsLow ? peakAngle : troughAngle) - restLine) >= TAIL_DEPTH_SHARE * setDepth;
    // A video that opens holding the working end (a press racked at the shoulders, a curl held bent) shows where the
    // person rests: ending there again is the end of the set, not a rep cut by the recording.
    let openHold = 0;
    for (let i = firstSeen + 1; i < smoothed.length && atWork(smoothed[i]) && atWork(smoothed[i - 1]); i++) openHold = timestamps[i] - timestamps[firstSeen];
    const opensHeldAtWork = firstSeen > -1 && atWork(smoothed[firstSeen]) && openHold >= OPEN_HOLD_SEC;
    const notAfterRest = cycles.length === 0 || timestamps[repStartIdx] - timestamps[cycles[cycles.length - 1].complete] <= TAIL_REST_MAX_SEC;
    const stoppedAtWork = lastAtWork > -1 && seenToEnd && deepEnough && !opensHeldAtWork && notAfterRest && timestamps[last] - timestamps[lastAtWork] <= TAIL_AT_WORK_SEC
      && timestamps[last] - timestamps[firstAtWork] <= TAIL_HOLD_MAX_SEC;
    // Bench only (WV_CORE_BENCH tailWhy, 20 October 2026): each condition of this rule, for the triage of the public undercounts.
    const why = (globalThis as any).__WV_CORE_BENCH__?.tailWhy;
    if (Array.isArray(why)) why.push({ returned, stoppedAtWork, reachedWork: lastAtWork > -1, seenToEnd, deepEnough, cycles: cycles.length, opensHeldAtWork, afterWork: lastAtWork > -1 ? timestamps[last] - timestamps[lastAtWork] : null, hold: firstAtWork > -1 ? timestamps[last] - timestamps[firstAtWork] : null, window: timestamps[last] - timestamps[lastWorking], duration, minSec, bounded: bounded(repStartIdx, last), rom: peakAngle - troughAngle, minRom, whole });
    if ((returned >= CUT_RETURN_SHARE || stoppedAtWork) && timestamps[last] - timestamps[lastWorking] <= RETURN_WINDOW_SEC && whole) {
      cycles.push({ enter: repStartIdx, complete: last, cut: true });
    } else if (shape && shapePart('c') && whole && returned > 0 && shape.matches(repStartIdx, last, 'start')) {
      // T4: a last rep cut short of the cut rule counts when what the video shows matches the start of the set's shape.
      cycles.push({ enter: repStartIdx, complete: last, cut: true });
    }
  }

  return Object.assign(cycles, { headRefused });
}

/**
 * Two reps read as one: the return between them came most of the way back but stopped short of the rest
 * threshold, so the state machine never closed the first. In a regular set (SPLIT_MIN_CYCLES reps or more, none
 * much shorter than the median; in a 2-cycle set, the shorter cycle serves as the tempo reference when it lasts
 * at least SPLIT_TWO_MIN_SEC), a rep lasting well over the median is split at its fullest in-set return when
 * that return covered SPLIT_RETURN_SHARE of the way from the working extreme to the rest threshold and both
 * pieces are whole reps by length and range. Cut last reps are added after this pass and are never split.
 * Mutates `cycles`.
 */
function splitOverlongReps(
  cycles: Cycle[],
  smoothed: (number | null)[],
  timestamps: number[],
  lowThreshold: number,
  highThreshold: number,
  restsLow: boolean,
  minRom: number,
  shape: RepShape | null = null,
): void {
  if (cycles.length < SPLIT_MIN_CYCLES) return;
  const durations = cycles.map(c => timestamps[c.complete] - timestamps[c.enter]).sort((a, b) => a - b);
  const n = durations.length;
  const md = n === 2 ? durations[0] : (n % 2 ? durations[(n - 1) / 2] : (durations[n / 2 - 1] + durations[n / 2]) / 2);
  if (n === 2 && md < SPLIT_TWO_MIN_SEC) return;
  if (!(md > 0)) return;
  const isRegular = durations[0] >= SPLIT_REGULAR * md;
  const isDeepRegular = durations[0] >= SPLIT_REGULAR_DEEP * md;
  // Oriented so the working side is positive.
  const o = (a: number) => (restsLow ? a : -a);
  const work = restsLow ? highThreshold : -lowThreshold;
  const restT = restsLow ? lowThreshold : -highThreshold;
  const range = (from: number, to: number) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = from; i <= to; i++) {
      const a = smoothed[i];
      if (a === null) continue;
      lo = Math.min(lo, a);
      hi = Math.max(hi, a);
    }
    return hi - lo;
  };
  const minPiece = Math.max(MIN_REP_SEC, SPLIT_PIECE * md);
  const firstValid = smoothed.findIndex(a => a !== null);
  const out: Cycle[] = [];
  for (const c of cycles) {
    const dur = timestamps[c.complete] - timestamps[c.enter];
    const longMult = c.enter === firstValid ? SPLIT_LONG_FIRST : SPLIT_LONG;
    if (dur <= longMult * md || c.cut) { out.push(c); continue; }
    let reached = false, extreme = -Infinity, ret = Infinity, retIdx = -1;
    let bestShare = -Infinity, bestK = -1;
    for (let i = c.enter; i <= c.complete; i++) {
      const a = smoothed[i];
      if (a === null) continue;
      const v = o(a);
      if (v >= work) {
        if (reached && retIdx > -1) {
          const share = (extreme - ret) / (extreme - restT);
          if (share > bestShare) { bestShare = share; bestK = retIdx; }
        }
        reached = true;
        retIdx = -1;
        ret = Infinity;
        extreme = Math.max(extreme, v);
      } else if (reached && v < ret) {
        ret = v;
        retIdx = i;
      }
    }
    const k = bestK;
    const pieces = k > -1 && timestamps[k] - timestamps[c.enter] >= minPiece && timestamps[c.complete] - timestamps[k] >= minPiece
      && range(c.enter, k) >= minRom && range(k, c.complete) >= minRom;
    // T4: a split whose return fell short of SPLIT_RETURN_SHARE is made when both pieces match the set's rep shape.
    if (pieces && ((isRegular && bestShare >= SPLIT_RETURN_SHARE) || (isDeepRegular && bestShare >= SPLIT_DEEP_RETURN) || (shape && shapePart('s') && shape.matches(c.enter, k, 'whole') && shape.matches(k, c.complete, 'whole')))) {
      out.push({ enter: c.enter, complete: k }, { enter: k, complete: c.complete });
    } else {
      out.push(c);
    }
  }
  cycles.splice(0, cycles.length, ...out);
}

// ─── T4: the set's rep shape (survey.ts, SHAPE_EDGES) ───

interface RepShape { matches(from: number, to: number, part: 'whole' | 'start' | 'end'): boolean }

/**
 * The median shape of the accepted reps (each resampled to SHAPE_POINTS, oriented so the rest threshold is 0 and the
 * working threshold 1) and the largest DTW distance of an accepted rep to it. A candidate matches when its distance
 * is at most SHAPE_SLACK times that. A part of a rep (the start of a cut last rep, the end of a first rep the video
 * opened on) is resampled on the same time scale (its duration over the median rep's) and compared with the same part
 * of the template. Null under SHAPE_MIN_REPS accepted reps.
 */
function repShape(cycles: Cycle[], smoothed: (number | null)[], timestamps: number[], low: number, high: number, restsLow: boolean): RepShape | null {
  const whole = cycles.filter(c => !c.cut);
  if (whole.length < SHAPE_MIN_REPS) return null;
  const span = high - low;
  if (!(span > 0)) return null;
  const norm = smoothed.map(a => (a === null ? null : restsLow ? (a - low) / span : (high - a) / span));
  const traces = whole.map(c => resample(norm, timestamps, c.enter, c.complete, SHAPE_POINTS)).filter((t): t is number[] => !!t);
  if (traces.length < SHAPE_MIN_REPS) return null;
  const template = medianSeries(traces);
  const maxD = Math.max(...traces.map(t => dtw(t, template, SHAPE_BAND)));
  const durs = whole.map(c => timestamps[c.complete] - timestamps[c.enter]).sort((x, y) => x - y);
  const md = durs[Math.floor(durs.length / 2)];
  const limit = shapeSlack() * maxD;
  return {
    matches(from, to, part) {
      if (part === 'whole') {
        const t = resample(norm, timestamps, from, to, SHAPE_POINTS);
        return !!t && dtw(t, template, SHAPE_BAND) <= limit;
      }
      const pts = Math.max(2, Math.min(SHAPE_POINTS, Math.round((SHAPE_POINTS * (timestamps[to] - timestamps[from])) / md)));
      const t = resample(norm, timestamps, from, to, pts);
      const ref = part === 'start' ? template.slice(0, pts) : template.slice(SHAPE_POINTS - pts);
      return !!t && dtw(t, ref, SHAPE_BAND) <= limit;
    },
  };
}

// ─── Rep boundaries (step 3c) ───

/**
 * Where a counted rep starts and ends, and what it measured. The state machine
 * enters a rep where the angle first crosses a threshold, which a rest hovering
 * near that threshold moves with every flicker of noise. Here each rep is anchored
 * on its working half instead: the samples past the midpoint of the two thresholds.
 * - Start: walking back from the first of them, the last sample still within
 *   `band` of the rest level before it (the median of the rest-side samples since
 *   the previous rep, or their extreme when the set barely pauses).
 * - End: walking on from the last of them, the first sample back within `band`
 *   of the rest level after it (looked for over at most RETURN_WINDOW_SEC).
 * - Range: from the working extreme to the furthest rest-side level of the rep,
 *   the level it left or the fullest return it reached, so no boundary sample
 *   decides it.
 * - Clipped: a rep with no rest before it or after it inside the video (the
 *   recording started or stopped during it) is counted, but its times are marked
 *   as not whole.
 * - Phases: the first runs from the start to the moment the angle comes within
 *   `band` of the working extreme, the second from the moment it leaves that band
 *   to the end; a pause at the working end belongs to neither. Which phase is
 *   concentric depends on the lift.
 */
function placeBoundaries(
  cycles: Cycle[],
  smoothed: (number | null)[],
  timestamps: number[],
  lowThreshold: number,
  highThreshold: number,
  band: number,
  def: LiftDefinition,
  seenAround: boolean[] = [],
): RepDetail[] {
  const restsLow = def.rest === 'low';
  const mid = (lowThreshold + highThreshold) / 2;
  const working = (a: number) => (restsLow ? a > mid : a < mid);
  const near = (a: number, level: number) => (restsLow ? a <= level + band : a >= level - band);
  const furtherOut = (a: number, b: number) => (restsLow ? Math.min(a, b) : Math.max(a, b));
  const sampleRate = estimateSampleRate(timestamps);
  const returnWindow = Math.max(1, Math.round(RETURN_WINDOW_SEC * sampleRate));
  // One sample is the least stable point of the curve; two browsers decoding the same video
  // disagree most there. An end of the range is the mean of the most extreme third of a second.
  const hold = Math.max(1, Math.round(EXTREME_HOLD_SEC * sampleRate));
  const heldExtreme = (values: number[], lowest: boolean): number => {
    const most = [...values].sort((x, y) => (lowest ? x - y : y - x)).slice(0, hold);
    return most.reduce((sum, v) => sum + v, 0) / most.length;
  };

  // The working half of each cycle: its first and last samples past the midpoint.
  const halves = cycles.map(c => {
    let first = -1, last = -1;
    for (let i = c.enter; i <= c.complete; i++) {
      const a = smoothed[i];
      if (a === null || !working(a)) continue;
      if (first < 0) first = i;
      last = i;
    }
    return first < 0 ? { first: c.enter, last: c.complete } : { first, last };
  });

  const restLevel = (from: number, to: number): number | null => {
    const side: number[] = [];
    for (let i = Math.max(0, from); i < Math.min(smoothed.length, to); i++) {
      const a = smoothed[i];
      if (a !== null && !working(a)) side.push(a);
    }
    if (!side.length) return null;
    side.sort((x, y) => x - y);
    if (side.length >= REST_LEVEL_MIN_SEC * sampleRate) return side[Math.floor(side.length / 2)];
    return restsLow ? side[0] : side[side.length - 1];
  };

  let firstValid = 0, lastValid = smoothed.length - 1;
  while (firstValid < smoothed.length && smoothed[firstValid] === null) firstValid++;
  while (lastValid > 0 && smoothed[lastValid] === null) lastValid--;

  const reps: RepDetail[] = [];
  let previousEnd = 0;
  cycles.forEach((c, k) => {
    const { first, last } = halves[k];
    const nextFirst = k + 1 < halves.length ? halves[k + 1].first : smoothed.length;

    // The working extreme, held
    const workValues: number[] = [];
    for (let i = first; i <= last; i++) {
      const a = smoothed[i];
      if (a !== null) workValues.push(a);
    }
    const work = workValues.length ? heldExtreme(workValues, !restsLow) : smoothed[first] ?? 0;

    // Start: leaving the rest level
    let start = c.enter;
    const left = restLevel(previousEnd, first);
    if (left !== null) {
      for (let i = first - 1; i >= previousEnd; i--) {
        const a = smoothed[i];
        if (a !== null && near(a, left)) { start = i; break; }
      }
    }

    // End: back at the rest level; the fullest return reached on the way
    const windowEnd = Math.min(nextFirst, last + 1 + returnWindow);
    let end = c.complete;
    // A rep cut on its way back has no rest after it on video: it ends where the video stopped it.
    const after = c.cut ? null : restLevel(last + 1, windowEnd);
    const returned: number[] = [];
    for (let i = last + 1; i < windowEnd; i++) {
      const a = smoothed[i];
      if (a !== null && !working(a)) returned.push(a);
    }
    const reached = returned.length ? heldExtreme(returned, restsLow) : null;
    if (after !== null) {
      for (let i = last + 1; i < windowEnd; i++) {
        const a = smoothed[i];
        if (a !== null && near(a, after)) { end = i; break; }
      }
    }
    if (end <= start) { start = c.enter; end = c.complete; }

    // The working end: from first reaching the band around the extreme to leaving it
    let workFrom = -1, workTo = -1;
    for (let i = start; i <= end; i++) {
      const a = smoothed[i];
      if (a === null || (restsLow ? a < work - band : a > work + band)) continue;
      if (workFrom < 0) workFrom = i;
      workTo = i;
    }
    if (workFrom < 0) { workFrom = first; workTo = last; }

    const outer = [left, reached].filter((v): v is number => v !== null).reduce(furtherOut, restsLow ? Infinity : -Infinity);
    const rom = Number.isFinite(outer) ? Math.abs(outer - work) : Math.abs((smoothed[start] ?? work) - work);
    const firstSec = timestamps[workFrom] - timestamps[start];
    const secondSec = timestamps[end] - timestamps[workTo];
    const clipped = left === null || after === null || start <= firstValid || end >= lastValid;
    // Angular speed from the smoothed angle, frame to frame.
    let peak = 0, speedSum = 0, speedN = 0;
    for (let i = start; i < end; i++) {
      const a0 = smoothed[i], a1 = smoothed[i + 1];
      if (a0 === null || a1 === null || seenAround[i] === false || seenAround[i + 1] === false) continue;
      const dt = timestamps[i + 1] - timestamps[i];
      if (dt <= 0) continue;
      const s = Math.abs(a1 - a0) / dt;
      if (s > peak) peak = s;
      speedSum += s;
      speedN++;
    }
    reps.push({
      index: reps.length + 1,
      startTime: timestamps[start],
      endTime: timestamps[end],
      romDegrees: rom,
      concentricSec: def.first === 'concentric' ? firstSec : secondSec,
      eccentricSec: def.first === 'concentric' ? secondSec : firstSec,
      peakSpeed: peak,
      meanSpeed: speedN > 0 ? speedSum / speedN : 0,
      ...(clipped ? { clipped: true } : {}),
    });
    previousEnd = end;
  });
  return reps;
}

/**
 * Detects partial repetitions (lengthened and shortened partials) outside full repetition cycles.
 * Lengthened partials: excursions operating in the stretched / lengthened range of the movement
 * (literature, tentative: Wolf et al. 2023 found a trivial difference favouring full range overall, and the
 * lengthened-partial subgroup's 95 % interval crosses zero; Kassiano et al. 2023 and Pedrosa et al. 2022 unverified here).
 * Shortened partials: excursions operating in the contracted / lockout range.
 * Status: experimental, shown on no screen, report or export (honesty audit of 14 October 2026): on the 96 synthetic
 * sets, built with no partial rep, it reports 180, and 124 on David's counted sets, many before the first rep or after
 * the last (walk-out and re-rack). It stays for research until partials are labelled on real sets and measured (R2, R8).
 * Its thresholds (10°, 32 %, 92 %, 0.35 s) are UNSOURCED.
 */
function detectPartialReps(
  smoothed: (number | null)[],
  timestamps: number[],
  lowThreshold: number,
  highThreshold: number,
  def: LiftDefinition,
  range: number,
  fullCycles: Cycle[],
  fullReps: RepDetail[],
  seenAround: boolean[] = [],
): RepDetail[] {
  const restsLow = def.rest === 'low';
  // Minimum partial ROM: at least 10 degrees and at least 32% of total set range
  const minPartialRom = Math.max(10, 0.32 * range);
  // Upper bound: below 92% of range (otherwise it is a near-full rep)
  const maxPartialRom = range * 0.92;
  const minPartialSec = 0.35; // minimum duration to filter out balance twitches / noise
  const medianFullRom = fullReps.length > 0
    ? [...fullReps.map(r => r.romDegrees)].sort((a, b) => a - b)[Math.floor(fullReps.length / 2)]
    : range * 0.75;

  // Mark all frames occupied by accepted full rep cycles
  const occupied = new Uint8Array(smoothed.length);
  for (const c of fullCycles) {
    const from = Math.max(0, c.enter);
    const to = Math.min(smoothed.length - 1, c.complete);
    for (let i = from; i <= to; i++) occupied[i] = 1;
  }

  const partials: RepDetail[] = [];

  // Helper to construct a RepDetail for a partial excursion
  const addPartial = (startIdx: number, endIdx: number, peakIdx: number, partialType: 'lengthened' | 'shortened') => {
    // Expand startIdx backwards to where the limb left rest
    let realStart = startIdx;
    while (realStart > 0 && !occupied[realStart - 1] && smoothed[realStart - 1] !== null
      && (restsLow ? smoothed[realStart - 1]! <= lowThreshold : smoothed[realStart - 1]! >= highThreshold)) {
      realStart--;
    }
    // Expand endIdx forwards to where the limb returns to rest
    let realEnd = endIdx;
    while (realEnd < smoothed.length - 1 && !occupied[realEnd + 1] && smoothed[realEnd + 1] !== null
      && (restsLow ? smoothed[realEnd + 1]! <= lowThreshold : smoothed[realEnd + 1]! >= highThreshold)) {
      realEnd++;
    }

    let lo = Infinity, hi = -Infinity;
    for (let k = realStart; k <= realEnd; k++) {
      const a = smoothed[k];
      if (a !== null) {
        if (a < lo) lo = a;
        if (a > hi) hi = a;
      }
    }
    const rom = hi - lo;
    const dur = timestamps[realEnd] - timestamps[realStart];
    if (rom < minPartialRom || rom > maxPartialRom || dur < minPartialSec) return;

    let peak = 0, speedSum = 0, speedN = 0;
    for (let k = realStart; k < realEnd; k++) {
      const a0 = smoothed[k], a1 = smoothed[k + 1];
      if (a0 === null || a1 === null || seenAround[k] === false || seenAround[k + 1] === false) continue;
      const dt = timestamps[k + 1] - timestamps[k];
      if (dt <= 0) continue;
      const s = Math.abs(a1 - a0) / dt;
      if (s > peak) peak = s;
      speedSum += s;
      speedN++;
    }

    const firstSec = timestamps[peakIdx] - timestamps[realStart];
    const secondSec = timestamps[realEnd] - timestamps[peakIdx];
    const romFrac = Math.min(0.95, Math.max(0.2, Math.round((rom / Math.max(1, medianFullRom)) * 100) / 100));

    partials.push({
      index: partials.length + 1,
      startTime: timestamps[realStart],
      endTime: timestamps[realEnd],
      romDegrees: Math.round(rom * 10) / 10,
      concentricSec: Math.max(0.1, def.first === 'concentric' ? firstSec : secondSec),
      eccentricSec: Math.max(0.1, def.first === 'concentric' ? secondSec : firstSec),
      peakSpeed: peak,
      meanSpeed: speedN > 0 ? speedSum / speedN : 0,
      isPartial: true,
      partialType,
      romFraction: romFrac,
    });
  };

  // 1. Excursions leaving rest and returning without reaching working threshold
  let inExcursion = false;
  let exStart = -1;
  let exExtremeIdx = -1;
  let exExtremeVal = restsLow ? -Infinity : Infinity;

  for (let i = 0; i < smoothed.length; i++) {
    if (occupied[i]) {
      if (inExcursion) {
        inExcursion = false;
        exStart = -1;
      }
      continue;
    }
    const a = smoothed[i];
    if (a === null) continue;

    if (restsLow) {
      if (!inExcursion) {
        if (a > lowThreshold) {
          inExcursion = true;
          exStart = i;
          exExtremeIdx = i;
          exExtremeVal = a;
        }
      } else {
        if (a > exExtremeVal) {
          exExtremeVal = a;
          exExtremeIdx = i;
        }
        // If it crosses back below lowThreshold before reaching highThreshold
        if (a <= lowThreshold) {
          if (exExtremeVal < highThreshold) {
            const pType = def.first === 'concentric' ? 'lengthened' : 'shortened';
            addPartial(exStart, i, exExtremeIdx, pType);
          }
          inExcursion = false;
          exStart = -1;
        }
      }
    } else {
      if (!inExcursion) {
        if (a < highThreshold) {
          inExcursion = true;
          exStart = i;
          exExtremeIdx = i;
          exExtremeVal = a;
        }
      } else {
        if (a < exExtremeVal) {
          exExtremeVal = a;
          exExtremeIdx = i;
        }
        // If it crosses back above highThreshold before reaching lowThreshold
        if (a >= highThreshold) {
          if (exExtremeVal > lowThreshold) {
            const pType = def.first === 'concentric' ? 'lengthened' : 'shortened';
            addPartial(exStart, i, exExtremeIdx, pType);
          }
          inExcursion = false;
          exStart = -1;
        }
      }
    }
  }

  // 2. Pulses in the deep stretch for eccentric-first lifts (e.g. squats, bench press, hack squat, RDLs)
  if (def.first === 'eccentric') {
    const stretchZone = restsLow ? highThreshold - 0.35 * range : lowThreshold + 0.35 * range;
    let inStretch = false;
    let pulseStart = -1;
    let localTrough = restsLow ? -Infinity : Infinity;
    let localPeak = restsLow ? Infinity : -Infinity;
    let pState: 'descending' | 'rising' = 'descending';

    for (let i = 1; i < smoothed.length; i++) {
      const a = smoothed[i], prev = smoothed[i - 1];
      if (a === null || prev === null) continue;
      const inDeep = restsLow ? a >= stretchZone : a <= stretchZone;
      if (!inDeep) {
        inStretch = false;
        pState = 'descending';
        continue;
      }
      if (!inStretch) {
        inStretch = true;
        pulseStart = i;
        localTrough = a;
        localPeak = a;
        pState = 'descending';
      }

      if (pState === 'descending') {
        if (restsLow ? a > localTrough : a < localTrough) {
          localTrough = a;
        } else if (restsLow ? a < localTrough - 2 : a > localTrough + 2) {
          // Began rising from bottom
          pState = 'rising';
          localPeak = a;
        }
      } else if (pState === 'rising') {
        if (restsLow ? a < localPeak : a > localPeak) {
          localPeak = a;
        } else if (restsLow ? a > localPeak + 2 : a < localPeak - 2) {
          // Reversal! Peaked and started descending again
          const amp = Math.abs(localPeak - localTrough);
          if (amp >= minPartialRom && timestamps[i] - timestamps[pulseStart] >= minPartialSec) {
            addPartial(pulseStart, i, i, 'lengthened');
            pulseStart = i;
            localTrough = a;
            pState = 'descending';
          }
        }
      }
    }
  }

  return partials;
}
