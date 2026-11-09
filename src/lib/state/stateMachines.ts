/**
 * stateMachines.ts: Canonical Finite State Machine (FSM) Engine for Workout Vision.
 *
 * Elevates:
 * - UX: Deterministic, predictable UI states; zero flicker; impossible state combinations eliminated.
 * - DX: Strict TypeScript discrimination; single source of truth; pure transition reducers.
 * - AX (Agent Experience): Clear explicit states and transitions for AI pair programmers to inspect and extend.
 *
 * Zero external dependencies. Fully backward-compatible with existing React components.
 */

export type Listener<TState, TContext> = (state: TState, context: TContext) => void;

export interface StateConfig<TState extends string, TEvent extends string, TContext> {
  on?: Partial<Record<TEvent, TState | ((context: TContext, payload?: any) => { nextState: TState; context?: Partial<TContext> })>>;
  onEnter?: (context: TContext, prev: TState) => Partial<TContext> | void;
  onExit?: (context: TContext, next: TState) => void;
}

export interface MachineConfig<TState extends string, TEvent extends string, TContext> {
  id: string;
  initial: TState;
  context: TContext;
  states: Record<TState, StateConfig<TState, TEvent, TContext>>;
}

export class FiniteStateMachine<TState extends string, TEvent extends string, TContext> {
  readonly id: string;
  private _state: TState;
  private _context: TContext;
  private readonly _config: MachineConfig<TState, TEvent, TContext>;
  private readonly _listeners = new Set<Listener<TState, TContext>>();

  constructor(config: MachineConfig<TState, TEvent, TContext>) {
    this.id = config.id;
    this._state = config.initial;
    this._context = { ...config.context };
    this._config = config;
  }

  get state(): TState {
    return this._state;
  }

  get context(): Readonly<TContext> {
    return this._context;
  }

  matches(target: TState | TState[]): boolean {
    return Array.isArray(target) ? target.includes(this._state) : this._state === target;
  }

  can(event: TEvent): boolean {
    const stateConfig = this._config.states[this._state];
    return !!(stateConfig && stateConfig.on && stateConfig.on[event]);
  }

  send(event: TEvent, payload?: any): { changed: boolean; state: TState; context: Readonly<TContext> } {
    const currentStateConfig = this._config.states[this._state];
    if (!currentStateConfig || !currentStateConfig.on || !currentStateConfig.on[event]) {
      // Transition not allowed from current state: ignore safely without crash
      return { changed: false, state: this._state, context: this._context };
    }

    const target = currentStateConfig.on[event];
    let nextState: TState;
    let nextContextUpdate: Partial<TContext> | undefined;

    if (typeof target === 'function') {
      const res = target(this._context, payload);
      nextState = res.nextState;
      nextContextUpdate = res.context;
    } else {
      nextState = target as TState;
    }

    const prevState = this._state;
    currentStateConfig.onExit?.(this._context, nextState);

    this._state = nextState;
    if (nextContextUpdate) {
      this._context = { ...this._context, ...nextContextUpdate };
    }

    const nextConfig = this._config.states[nextState];
    const enterUpdate = nextConfig?.onEnter?.(this._context, prevState);
    if (enterUpdate) {
      this._context = { ...this._context, ...enterUpdate };
    }

    this.notify();
    return { changed: true, state: this._state, context: this._context };
  }

  subscribe(listener: Listener<TState, TContext>): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this._listeners) {
      try {
        listener(this._state, this._context);
      } catch (err) {
        console.error(`[FSM:${this.id}] Listener error:`, err);
      }
    }
  }
}

// ============================================================================
// 1. VIDEO ANALYSIS PIPELINE STATE MACHINE (Replaces 22 scattered useStates)
// ============================================================================

export type AnalysisState =
  | 'IDLE'
  | 'HASHING_FILE'
  | 'LOADING_MODEL'
  | 'EXTRACTING_FRAMES'
  | 'DETECTING_EXERCISE'
  | 'ANALYZING_KINEMATICS'
  | 'COMPLETED'
  | 'ERROR'
  | 'ABORTED';

export type AnalysisEvent =
  | 'SELECT_FILE'
  | 'START_HASH'
  | 'MODEL_LOAD_PROGRESS'
  | 'MODEL_READY'
  | 'FRAMES_PROGRESS'
  | 'EXERCISE_IDENTIFIED'
  | 'KINEMATICS_COMPLETE'
  | 'FAIL'
  | 'CANCEL'
  | 'RESET';

export interface AnalysisContext {
  file: File | null;
  exercise: string;
  autoDetect: boolean;
  progressPercent: number;
  stageMessageFr: string;
  repsCount: number;
  errorReason: string | null;
  result: any | null;
}

export function createAnalysisStateMachine(initialExercise = ''): FiniteStateMachine<AnalysisState, AnalysisEvent, AnalysisContext> {
  return new FiniteStateMachine<AnalysisState, AnalysisEvent, AnalysisContext>({
    id: 'VideoAnalysisPipeline',
    initial: 'IDLE',
    context: {
      file: null,
      exercise: initialExercise,
      autoDetect: !initialExercise,
      progressPercent: 0,
      stageMessageFr: 'En attente d’une vidéo',
      repsCount: 0,
      errorReason: null,
      result: null,
    },
    states: {
      IDLE: {
        on: {
          SELECT_FILE: (ctx, file: File) => ({
            nextState: 'HASHING_FILE',
            context: { file, progressPercent: 5, stageMessageFr: 'Calcul de l’empreinte vidéo...' },
          }),
        },
      },
      HASHING_FILE: {
        on: {
          MODEL_LOAD_PROGRESS: (ctx, pct: number) => ({
            nextState: 'LOADING_MODEL',
            context: { progressPercent: pct, stageMessageFr: `Chargement du modèle IA (${pct}\u00A0%)...` },
          }),
          CANCEL: () => ({ nextState: 'ABORTED', context: { stageMessageFr: 'Analyse annulée' } }),
          FAIL: (ctx, err: string) => ({ nextState: 'ERROR', context: { errorReason: err } }),
        },
      },
      LOADING_MODEL: {
        on: {
          MODEL_LOAD_PROGRESS: (ctx, pct: number) => ({
            nextState: 'LOADING_MODEL',
            context: { progressPercent: pct, stageMessageFr: `Chargement du modèle IA (${pct}\u00A0%)...` },
          }),
          MODEL_READY: () => ({
            nextState: 'EXTRACTING_FRAMES',
            context: { progressPercent: 20, stageMessageFr: 'Décodage matériel des images...' },
          }),
          CANCEL: () => ({ nextState: 'ABORTED', context: { stageMessageFr: 'Analyse annulée' } }),
          FAIL: (ctx, err: string) => ({ nextState: 'ERROR', context: { errorReason: err } }),
        },
      },
      EXTRACTING_FRAMES: {
        on: {
          FRAMES_PROGRESS: (ctx, { pct, reps }: { pct: number; reps?: number }) => ({
            nextState: 'EXTRACTING_FRAMES',
            context: {
              progressPercent: Math.min(85, 20 + Math.round(pct * 0.65)),
              repsCount: reps ?? ctx.repsCount,
              stageMessageFr: `Analyse des mouvements (${reps ?? 0} répétitions détectées)...`,
            },
          }),
          EXERCISE_IDENTIFIED: (ctx, detected: string) => ({
            nextState: 'DETECTING_EXERCISE',
            context: { exercise: detected, stageMessageFr: `Exercice reconnu\u00A0: ${detected}` },
          }),
          KINEMATICS_COMPLETE: (ctx, result: any) => ({
            nextState: 'COMPLETED',
            context: { progressPercent: 100, result, repsCount: result?.reps ?? ctx.repsCount, stageMessageFr: 'Analyse terminée' },
          }),
          CANCEL: () => ({ nextState: 'ABORTED', context: { stageMessageFr: 'Analyse interrompue' } }),
          FAIL: (ctx, err: string) => ({ nextState: 'ERROR', context: { errorReason: err } }),
        },
      },
      DETECTING_EXERCISE: {
        on: {
          FRAMES_PROGRESS: (ctx, { pct, reps }: { pct: number; reps?: number }) => ({
            nextState: 'ANALYZING_KINEMATICS',
            context: { progressPercent: pct, repsCount: reps ?? ctx.repsCount },
          }),
          KINEMATICS_COMPLETE: (ctx, result: any) => ({
            nextState: 'COMPLETED',
            context: { progressPercent: 100, result, stageMessageFr: 'Analyse terminée' },
          }),
          FAIL: (ctx, err: string) => ({ nextState: 'ERROR', context: { errorReason: err } }),
          CANCEL: () => ({ nextState: 'ABORTED' }),
        },
      },
      ANALYZING_KINEMATICS: {
        on: {
          KINEMATICS_COMPLETE: (ctx, result: any) => ({
            nextState: 'COMPLETED',
            context: { progressPercent: 100, result, stageMessageFr: 'Rapport biomécanique prêt' },
          }),
          FAIL: (ctx, err: string) => ({ nextState: 'ERROR', context: { errorReason: err } }),
          CANCEL: () => ({ nextState: 'ABORTED' }),
        },
      },
      COMPLETED: {
        on: {
          RESET: () => ({
            nextState: 'IDLE',
            context: { file: null, result: null, progressPercent: 0, repsCount: 0, errorReason: null },
          }),
          SELECT_FILE: (ctx, file: File) => ({
            nextState: 'HASHING_FILE',
            context: { file, result: null, progressPercent: 5, stageMessageFr: 'Préparation...' },
          }),
        },
      },
      ERROR: {
        on: {
          RESET: () => ({ nextState: 'IDLE', context: { errorReason: null, progressPercent: 0 } }),
          SELECT_FILE: (ctx, file: File) => ({
            nextState: 'HASHING_FILE',
            context: { file, errorReason: null, progressPercent: 5 },
          }),
        },
      },
      ABORTED: {
        on: {
          RESET: () => ({ nextState: 'IDLE', context: { file: null, progressPercent: 0 } }),
          SELECT_FILE: (ctx, file: File) => ({ nextState: 'HASHING_FILE', context: { file, progressPercent: 5 } }),
        },
      },
    },
  });
}

// ============================================================================
// 2. KINÉ ATTEMPT & MIRROR AVATAR LIFECYCLE MACHINE (Monsieur Lamine Priority)
// ============================================================================

export type KineAttemptState =
  | 'AWAITING_INPUT'
  | 'LOADING_REFERENCE'
  | 'READING_PATIENT_ATTEMPT'
  | 'COMPARING_BIOMECHANICS'
  | 'CLINICAL_VERDICT_READY'
  | 'DEEP_HEAVY_FALLBACK'
  | 'FAILED';

export type KineAttemptEvent =
  | 'LOAD_REF_START'
  | 'LOAD_REF_SUCCESS'
  | 'START_PATIENT_READ'
  | 'PATIENT_READ_SUCCESS'
  | 'EVALUATE_SYMMETRY'
  | 'TRIGGER_DEEP_READ'
  | 'RETRY_HEAVY_SUCCESS'
  | 'ERROR'
  | 'RESET';

export interface KineAttemptContext {
  exerciseId: string;
  patientId: string;
  hasHealthyMirror: boolean;
  referencePose: any | null;
  patientPose: any | null;
  lsiPercent: number | null;
  clinicalVerdict: 'match' | 'revise' | null;
  errorNoteFr: string | null;
}

export function createKineAttemptStateMachine(exerciseId: string, patientId: string): FiniteStateMachine<KineAttemptState, KineAttemptEvent, KineAttemptContext> {
  return new FiniteStateMachine<KineAttemptState, KineAttemptEvent, KineAttemptContext>({
    id: 'KineAttemptLifecycle',
    initial: 'AWAITING_INPUT',
    context: {
      exerciseId,
      patientId,
      hasHealthyMirror: false,
      referencePose: null,
      patientPose: null,
      lsiPercent: null,
      clinicalVerdict: null,
      errorNoteFr: null,
    },
    states: {
      AWAITING_INPUT: {
        on: {
          LOAD_REF_START: () => ({ nextState: 'LOADING_REFERENCE' }),
          START_PATIENT_READ: () => ({ nextState: 'READING_PATIENT_ATTEMPT' }),
        },
      },
      LOADING_REFERENCE: {
        on: {
          LOAD_REF_SUCCESS: (ctx, refPose: any) => ({
            nextState: 'AWAITING_INPUT',
            context: { referencePose: refPose },
          }),
          ERROR: (ctx, err: string) => ({ nextState: 'FAILED', context: { errorNoteFr: err } }),
        },
      },
      READING_PATIENT_ATTEMPT: {
        on: {
          PATIENT_READ_SUCCESS: (ctx, attPose: any) => ({
            nextState: 'COMPARING_BIOMECHANICS',
            context: { patientPose: attPose },
          }),
          ERROR: (ctx, err: string) => ({ nextState: 'FAILED', context: { errorNoteFr: err } }),
        },
      },
      COMPARING_BIOMECHANICS: {
        on: {
          EVALUATE_SYMMETRY: (ctx, { lsi, verdict }: { lsi: number; verdict: 'match' | 'revise' }) => ({
            nextState: 'CLINICAL_VERDICT_READY',
            context: { lsiPercent: lsi, clinicalVerdict: verdict },
          }),
          TRIGGER_DEEP_READ: () => ({ nextState: 'DEEP_HEAVY_FALLBACK' }),
          ERROR: (ctx, err: string) => ({ nextState: 'FAILED', context: { errorNoteFr: err } }),
        },
      },
      CLINICAL_VERDICT_READY: {
        on: {
          TRIGGER_DEEP_READ: () => ({ nextState: 'DEEP_HEAVY_FALLBACK' }),
          RESET: () => ({
            nextState: 'AWAITING_INPUT',
            context: { patientPose: null, lsiPercent: null, clinicalVerdict: null, errorNoteFr: null },
          }),
        },
      },
      DEEP_HEAVY_FALLBACK: {
        on: {
          RETRY_HEAVY_SUCCESS: (ctx, deepPose: any) => ({
            nextState: 'COMPARING_BIOMECHANICS',
            context: { patientPose: deepPose },
          }),
          ERROR: (ctx, err: string) => ({ nextState: 'FAILED', context: { errorNoteFr: err } }),
        },
      },
      FAILED: {
        on: {
          RESET: () => ({ nextState: 'AWAITING_INPUT', context: { errorNoteFr: null } }),
        },
      },
    },
  });
}

// ============================================================================
// 3. HARDWARE PHONE STABILITY & AUTO-ARMING STATE MACHINE
// ============================================================================

export type DeviceStabilityState =
  | 'HANDHELD_MOTION'
  | 'STABILIZING_ON_SURFACE'
  | 'MOUNTED_STATIC'
  | 'COUNTDOWN_ARMED'
  | 'SESSION_ACTIVE';

export type DeviceStabilityEvent =
  | 'MOTION_DETECTED'
  | 'SURFACE_SETTLED'
  | 'TIMER_STABLE_1500MS'
  | 'ARM_TRIGGER'
  | 'USER_TOUCH';

export interface DeviceStabilityContext {
  variance: number;
  stableDurationMs: number;
  pitchDeg: number;
}

export function createDeviceStabilityStateMachine(): FiniteStateMachine<DeviceStabilityState, DeviceStabilityEvent, DeviceStabilityContext> {
  return new FiniteStateMachine<DeviceStabilityState, DeviceStabilityEvent, DeviceStabilityContext>({
    id: 'DeviceStabilityArming',
    initial: 'HANDHELD_MOTION',
    context: {
      variance: 1.0,
      stableDurationMs: 0,
      pitchDeg: 0,
    },
    states: {
      HANDHELD_MOTION: {
        on: {
          SURFACE_SETTLED: (ctx, payload: { variance: number; pitch: number }) => ({
            nextState: 'STABILIZING_ON_SURFACE',
            context: { variance: payload.variance, pitchDeg: payload.pitch, stableDurationMs: 0 },
          }),
        },
      },
      STABILIZING_ON_SURFACE: {
        on: {
          MOTION_DETECTED: () => ({ nextState: 'HANDHELD_MOTION', context: { stableDurationMs: 0 } }),
          TIMER_STABLE_1500MS: (ctx) => ({
            nextState: 'MOUNTED_STATIC',
            context: { stableDurationMs: 1500 },
          }),
        },
      },
      MOUNTED_STATIC: {
        on: {
          MOTION_DETECTED: () => ({ nextState: 'HANDHELD_MOTION', context: { stableDurationMs: 0 } }),
          ARM_TRIGGER: () => ({ nextState: 'COUNTDOWN_ARMED' }),
        },
      },
      COUNTDOWN_ARMED: {
        on: {
          MOTION_DETECTED: () => ({ nextState: 'HANDHELD_MOTION' }),
          USER_TOUCH: () => ({ nextState: 'SESSION_ACTIVE' }),
        },
      },
      SESSION_ACTIVE: {
        on: {
          USER_TOUCH: () => ({ nextState: 'HANDHELD_MOTION' }),
        },
      },
    },
  });
}
