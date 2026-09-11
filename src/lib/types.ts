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
  leftAnkle: number;
  rightAnkle: number;
  torsoAngle: number;
  neckAngle: number;
  _visLeftKnee: number;
  _visRightKnee: number;
  _visLeftHip: number;
  _visRightHip: number;
  _visLeftElbow: number;
  _visRightElbow: number;
  _visLeftShoulder: number;
  _visRightShoulder: number;
  _visLeftAnkle: number;
  _visRightAnkle: number;
  [key: string]: number;
}

// ─── Frame ───

export interface AnalysisFrame {
  landmarks: LandmarkArray;
  timestamp: number;
  angles: JointAngles;
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
