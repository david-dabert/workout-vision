/**
 * The movement grammar (docs/VISION.md, "The engine"): an activity is declared as data. A specification names the
 * body signals it reads from the pose, the events it finds in them, and the measures it reports, each measure with its
 * formula, unit, source, R9 status and error model. The engine (engine.ts) reads any specification; nothing in it is
 * specific to one sport. A specification holds no function, so it can be stored, sent and checked as JSON.
 *
 * Coordinates: MediaPipe image landmarks, normalised to the frame (x right, y down), turned into pixels with the frame's
 * size. Heights are measured up from the ground line and expressed in leg lengths (hip to ankle, the body's own ruler),
 * so no specification needs the person's height or the phone's distance.
 */

/** R9: where a threshold, check or measure stands. */
export type Status = 'validated' | 'literature' | 'convention' | 'experimental';

export interface Text { fr: string; en: string }

/** A signal read from the landmarks of every sample (MediaPipe pose indices). */
export type SignalSpec =
  /** The lowest of these points (largest y), as a height above the ground in leg lengths. */
  | { kind: 'lowest'; points: number[] }
  /** The mean of these points, as a height above the ground in leg lengths. */
  | { kind: 'height'; points: number[] }
  /** The horizontal distance between two points, in pixels (used in ratios only). */
  | { kind: 'width'; points: [number, number] };

/** A threshold or setting with its R9 note: every number a specification holds carries one. */
export interface Setting { value: number; source: string; status: Status }

export type EventSpec =
  /**
   * Phases where `signal` stays above the ground band: the body off the ground. The band is the larger of `floor`
   * (leg lengths) and `noiseK` times the signal's own noise on the ground.
   */
  | { kind: 'airborne'; signal: string; floor: Setting; noiseK: Setting }
  /**
   * A cycle of `hip` height that carries a flight of `flight`: the hip rises at least `minRise` leg lengths above
   * standing during the flight, and the flight lasts at least `minFlightSec`. Flights inside one hip cycle are one jump
   * (a foot point lost at the top of a jump does not make two).
   */
  | { kind: 'jump'; flight: string; hip: string; minRise: Setting; minFlightSec: Setting }
  /** Flights of `flight` that are not part of a `jump`, of at least `minSamples` samples: the strides of a run-up. */
  | { kind: 'stride'; flight: string; jump: string; minSamples: Setting }
  /** After each `jump` lands: the deepest point of `hip` within `withinSec`, where the landing is absorbed. */
  | { kind: 'landing'; jump: string; hip: string; withinSec: Setting };

/** How a measure turns events into a value. */
export type FormulaSpec =
  /** How many events. */
  | { kind: 'count' }
  /** Height from the flight, in centimetres, per event: h = g·t²/8 corrected for a landing lower than the takeoff,
   *  v0 = (g·t²/2 − Δ)/t and h = v0²/2g, with Δ read on the hip's parabola (engine.ts); only when the margin is at most
   *  `maxRelError` of the value. */
  | { kind: 'flightHeight'; maxRelError: Setting }
  /** Time on the ground between the landing of the last `before` event and the takeoff of each event, in seconds;
   *  only when the last `before` event lands within `withinSec`, only from `minRate` samples a second, and only when
   *  the margin is at most `maxRelError` of the value. */
  | { kind: 'contactBefore'; before: string; withinSec: Setting; maxRelError: Setting; minRate: Setting }
  /** num / den of two width signals at each event's sample, read only from the front; flagged below `below`. */
  | { kind: 'widthRatio'; num: string; den: string; below: Setting };

/**
 * The error model, as the screen states it. `sampling`: the margin follows from the samples actually read (a contact
 * falls somewhere between two samples) and from the body points' own noise in that read, computed per value (engine.ts,
 * airborne, hipApex). `none`: no margin can be computed; the value says how it was checked in `note`.
 */
export interface ErrorSpec { kind: 'sampling' | 'none'; note: Text }

export interface MeasureSpec {
  key: string;
  label: Text;
  /** The name of one event's value, when the label names the summary ('Best jump': each jump's 'Height'). */
  each?: Text;
  /** The event the measure reads. */
  of: string;
  formula: FormulaSpec;
  /** The formula as the screen writes it. */
  formulaText: Text;
  unit: string | null;
  /** How the events' values become the one shown: the highest, the lowest, the mean, or the count itself. */
  summary: 'max' | 'min' | 'mean' | 'count';
  source: string;
  status: Status;
  error: ErrorSpec;
  /** Which camera view the measure needs, when it needs one. */
  view?: 'front';
}

export interface ActivitySpec {
  key: string;
  name: Text;
  /** One line under the name. */
  tagline: Text;
  /** How to film it, in short steps. */
  filming: Text[];
  /** The signal whose resting level is the ground line. */
  ground: string;
  signals: Record<string, SignalSpec>;
  events: Record<string, EventSpec>;
  measures: MeasureSpec[];
}

/** One landmark as MediaPipe gives it (normalised image coordinates). */
export interface Landmark { x: number; y: number; z?: number; visibility?: number }
export type LandmarkFrame = Landmark[] | null | undefined;

/** What the engine reads: the pose of every sample, its time in seconds, and the frame's size in pixels. */
export interface PoseRead { landmarks: LandmarkFrame[]; timestamps: number[]; width: number; height: number }

/** An event found in the read: its samples, its times, and what each kind adds. */
export interface FoundEvent {
  /** First and last sample of the event. */
  start: number;
  end: number;
  /** Takeoff and landing, in seconds, for events with a flight, each with its margin (±, seconds); the flight time and
   *  its margin. A contact the samples do not bracket (the video starts or ends in the air) is left undefined. */
  takeoff?: number;
  takeoffMargin?: number;
  landing?: number;
  landingMargin?: number;
  flight?: number;
  flightMargin?: number;
  /** The sample the event is read at (the landing's deepest point). */
  at?: number;
  /** For a jump: the time of the top of the hip's flight and its margin (seconds), the leg length its fall at g implies
   *  (metres), and how much lower the hip lands than it took off (metres, read on the same parabola). */
  apex?: number;
  apexMargin?: number;
  legM?: number;
  drop?: number;
}

export interface MeasureValue { value: number; margin: number | null; event: number; flag?: boolean }

export interface MeasureResult {
  key: string;
  label: Text;
  unit: string | null;
  formulaText: Text;
  source: string;
  status: Status;
  error: ErrorSpec;
  /** The value shown, and its margin (±, in the unit); null when refused. */
  value: number | null;
  margin: number | null;
  /** One value per event measured. Kept when only the summary is refused (the highest cannot be named), so each event's
   *  value can still be shown; empty when the measure is refused whole. */
  values: MeasureValue[];
  /** Why no value is shown (null when one is). */
  refused: Text | null;
  /** What a mean was taken over: the events measured, among those it applies to. */
  scope?: Text;
  /** A value flagged by the measure's threshold (a landing check). */
  flagged?: boolean;
}

export interface ActivityResult {
  /** Samples per second actually read (median spacing), and the median spacing in seconds. */
  rate: number;
  dt: number;
  duration: number;
  view: 'front' | 'side' | 'unknown';
  /** The ground line and the leg length, in pixels; the ground band in leg lengths. */
  ground: number | null;
  legLength: number | null;
  band: number | null;
  /** Every signal, per sample (null where the points were not seen). */
  signals: Record<string, (number | null)[]>;
  events: Record<string, FoundEvent[]>;
  measures: MeasureResult[];
  /** Why the whole read gives nothing (null when it gives something). */
  refused: Text | null;
}
