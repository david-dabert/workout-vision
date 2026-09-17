/**
 * Shared type definitions for WorkoutVision.
 * Central types used across multiple modules.
 */

// ─── Pose / MediaPipe ───

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type LandmarkArray = Landmark[];

/**
 * MediaPipe Pose Landmarker 33-point model.
 * A full pose is exactly 33 landmarks.
 */
export type PoseLandmarks = Landmark[] & { length: 33 };

/** Named landmark indices for the MediaPipe 33-point model. */
export interface LandmarkIndices {
  NOSE: 0;
  LEFT_SHOULDER: 11; RIGHT_SHOULDER: 12;
  LEFT_ELBOW: 13; RIGHT_ELBOW: 14;
  LEFT_WRIST: 15; RIGHT_WRIST: 16;
  LEFT_HIP: 23; RIGHT_HIP: 24;
  LEFT_KNEE: 25; RIGHT_KNEE: 26;
  LEFT_ANKLE: 27; RIGHT_ANKLE: 28;
  LEFT_HEEL: 29; RIGHT_HEEL: 30;
  LEFT_FOOT_INDEX: 31; RIGHT_FOOT_INDEX: 32;
}

// ─── Joint Angles ───

export interface JointAngles {
  leftKnee: number;
  rightKnee: number;
  leftHip: number;
  rightHip: number;
  leftElbow: number;
  rightElbow: number;
  leftShoulder: number;
  rightShoulder: number;
  trunk: number;
  _visLeftKnee: number;
  _visRightKnee: number;
  _visLeftHip: number;
  _visRightHip: number;
  _visLeftElbow: number;
  _visRightElbow: number;
  _visLeftShoulder: number;
  _visRightShoulder: number;
  [key: string]: number;
}

// ─── Frame ───

export interface AnalysisFrame {
  landmarks: LandmarkArray;
  timestamp: number;
  angles: JointAngles;
}

// ─── Rep Boundary (from RepCounter to biomechanics) ───

export interface RepBoundary {
  startFrame: number;
  bottomFrame: number;
  endFrame: number;
}

// ─── Biomechanical Analysis (return type of analyzeSet) ───

export interface TUTPerRep {
  eccentric: number;
  concentric: number;
  total: number;
}

export interface TimeUnderTensionResult {
  total: number;
  eccentric: number;
  concentric: number;
  perRep: TUTPerRep[];
}

export interface RangeOfMotionResult {
  avgDegrees: number;
  perRep: number[];
  consistency: number;
}

export type AsymmetryRisk = 'low' | 'moderate' | 'elevated';

export interface AsymmetryResult {
  score: number;
  details: Record<string, number>;
  risk: AsymmetryRisk;
}

export interface VelocityResult {
  avg: number;
  perRep: number[];
  trend: string;
}

export interface BiomechanicalAnalysis {
  timeUnderTension: TimeUnderTensionResult;
  rangeOfMotion: RangeOfMotionResult;
  asymmetry: AsymmetryResult;
  movementQuality: number;
  velocity?: VelocityResult;
}

// ─── Coaching Engine (SPARC, DTW, fatigue, form detections) ───

export interface CoachingFormDetection {
  name: string;
  detected: boolean;
  severity: 'info' | 'warning' | 'critical';
  value?: number;
  threshold?: number;
  perRep?: boolean[];
}

export interface CoachingFeedback {
  priority: number;
  category: 'form' | 'tempo' | 'fatigue' | 'consistency' | 'smoothness';
  message: string;
  detail?: string;
}

export interface CoachingReport {
  sparc: { perRep: number[]; mean: number };
  consistency: { dtwScores: number[]; mean: number };
  fatigue: { detected: boolean; onsetRep: number | null; velocityLossPercent: number };
  formDetections: CoachingFormDetection[];
  centerOfMass?: { lateralRange: number; apRange: number; stability: number };
  feedback: CoachingFeedback[];
}

// ─── Rep Event (returned by RepCounter.update) ───

export interface RepEvent {
  reps: number;
  phase: string;
  angle: number | null;
  angles: JointAngles | null;
  formFeedback: FormFeedbackItem[];
  repCompleted: boolean;
  repHistory: RepHistoryEntry[];
}

export interface FormFeedbackItem {
  name: string;
  passed: boolean;
  text: string;
  severity?: string;
}

export interface RepHistoryEntry {
  score: number | null;
  issues: string[];
  feedback?: FormResultEntry[] | null;
  ts: number;
  startFrame: number;
  bottomFrame: number;
  endFrame: number;
  peakFrame?: number;
  rom?: number | null;
  romPercent?: number | null;
  startTime?: number;
  endTime?: number;
  velocity?: unknown;
}

export interface FormResultEntry {
  name: string;
  passed: boolean;
  quality: number;
  bad?: string;
  severity?: string;
  skipped?: boolean;
  skippedReason?: string;
}

// ─── Rep ───

export interface RepRecord {
  index: number;
  startFrame: number;
  endFrame: number;
  score: number | null;
  rom: number;
  duration: number;
  notes: string[];
  tempoLabel?: string;
  tempoSeconds?: number;
}

// ─── Exercise ───

export type FormCheckType = 'bestSide' | 'bestSideMax' | 'direct' | 'custom';

export interface ValueSpec {
  type: FormCheckType;
  left?: string;
  right?: string;
  visLeft?: string;
  visRight?: string;
  joint?: string;
  fn?: (angles: JointAngles, landmarks: LandmarkArray) => number;
}

export interface FormCheck {
  name: string;
  value: ValueSpec;
  quality: (v: number) => number;
  weight?: number;
}

export interface ExerciseDefinition {
  key: string;
  name: string;
  aliases?: string[];
  muscles: string[];
  signal: string;
  rom?: [number, number];
  checks?: FormCheck[];
  placeholder?: boolean;
  category?: string;
}

export interface CompiledExercise extends ExerciseDefinition {
  getValue: (angles: JointAngles, landmarks: LandmarkArray) => number;
  evaluateForm: (angles: JointAngles, landmarks: LandmarkArray) => {
    score: number;
    details: Array<{ name: string; score: number; value: number }>;
  };
}

// ─── Workout Record ───

export interface WorkoutRecord {
  id: string;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  schemaVersion?: number;
  exercise?: string;
  exerciseKey?: string;
  exerciseName?: string;
  reps: number;
  machineReps?: number;
  repsOverridden?: boolean;
  formScore: number | null;
  weight: number;
  volume: number;
  duration: number;
  diagnostics: RepCounterDiagnostics | null;
  bioAnalysis: BioAnalysis | null;
  repHistory: RepRecord[] | null;
  report: WorkoutReport | null;
  confidence: ConfidenceInfo | null;
  progression?: ProgressionInfo | null;
  baselineComparison?: BaselineComparison | null;
  machineResult: MachineResult | null;
  correctedResult: CorrectedResult | null;
  recalibrated: boolean;
  fileName?: string;
  videoUrl?: string;
  frames?: number;
  fps?: number;
  autoDetected?: boolean;
  detectionFailed?: boolean;
  workoutId?: string;
}

export interface RepCounterDiagnostics {
  method: string;
  observedMin: number;
  observedMax: number;
  progression?: ProgressionInfo;
  anthropometrics?: AnthropometricData;
}

export interface ProgressionInfo {
  score: number;
  grade: { label: string; title: string };
}

export interface AnthropometricData {
  calibrated: boolean;
  bodyType: {
    torsoType: string;
    femurType: string;
    armType: string;
    symmetryIndex: number;
  };
}

export interface ConfidenceInfo {
  level: 'high' | 'medium' | 'low';
  totalFrames: number;
}

export interface BaselineComparison {
  deviation: number;
  baselineReps: number;
}

export interface MachineResult {
  reps: number;
  formScore: number | null;
}

export interface CorrectedResult {
  reps: number;
  formScore: number | null;
}

// ─── Bio Analysis ───

export interface BioAnalysis {
  velocity?: VelocityData;
  timeUnderTension?: TUTData;
  rom?: ROMData;
  asymmetry?: AsymmetryData;
  fatigue?: FatigueData;
}

export interface VelocityData {
  meanConcentric: number;
  meanEccentric: number;
  peakConcentric: number;
  ratio: number;
}

export interface TUTData {
  total: number;
  perRep: number;
  concentric: number;
  eccentric: number;
}

export interface ROMData {
  mean: number;
  min: number;
  max: number;
  consistency: number;
}

export interface AsymmetryData {
  index: number;
  dominant: 'left' | 'right' | 'balanced';
}

export interface FatigueData {
  index: number;
  trend: 'stable' | 'declining' | 'improving';
}

// ─── Coach / Report ───

export interface WorkoutReport {
  summary: string;
  grade: string;
  highlights: string[];
  suggestions: string[];
  zone?: string;
}

// ─── Telemetry ───

export interface TelemetryEvent {
  name: string;
  ts: number;
  sid: string;
  [key: string]: unknown;
}

// ─── Profile ───

export interface UserProfile {
  heightCm?: number;
  weightKg?: number;
  sex?: 'male' | 'female' | 'other';
  birthYear?: number;
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  injuries?: string[];
  trainingDays?: string[];
  menstrualTracking?: boolean;
  cycleLength?: number;
  lastPeriodDate?: string;
  medicalDocument?: string;
}

// ─── Validation ───

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized: WorkoutRecord | null;
}
