/**
 * zeroTouchCoach.ts
 *
 * 0-Touch Hands-Free Workout Engine.
 * Enables athletes to train without touching their device screen:
 * 1. Automatic posture-hold arming (detects lifter set in position)
 * 2. Acoustic audio countdown trigger
 * 3. Real-time repetition tracking
 * 4. Automatic rerack and rest-termination detection (>3s post-inflection stillness)
 * 5. Instant audio set recap
 */

export type ZeroTouchState =
  | 'STANDBY_UNFRAMED'
  | 'FRAMING_ACQUIRED'
  | 'STARTING_POSTURE_HOLD'
  | 'COUNTDOWN'
  | 'TRACKING_ACTIVE'
  | 'SET_TERMINATED';

export interface ZeroTouchEvent {
  type:
    | 'SUBJECT_ENTERED_FRAME'
    | 'SUBJECT_LEFT_FRAME'
    | 'POSTURE_HELD_STEADY'
    | 'COUNTDOWN_EXPIRED'
    | 'REP_COMPLETED'
    | 'RERACK_OR_REST_DETECTED'
    | 'MANUAL_ABORT';
  payload?: Record<string, unknown>;
}

export interface ZeroTouchContext {
  state: ZeroTouchState;
  holdDurationMs: number;
  countdownSecondsRemaining: number;
  completedReps: number;
  lastInflectionTimeMs: number;
  audioAnnouncementFr: string | null;
  audioAnnouncementEn: string | null;
}

export interface ZeroTouchConfig {
  requiredHoldDurationMs: number; // e.g. 1500ms
  countdownDurationSeconds: number; // e.g. 3s
  restAutoStopTimeoutMs: number; // e.g. 3500ms
}

const DEFAULT_CONFIG: ZeroTouchConfig = {
  requiredHoldDurationMs: 1500,
  countdownDurationSeconds: 3,
  restAutoStopTimeoutMs: 3500,
};

export class ZeroTouchCoach {
  private config: ZeroTouchConfig;
  private context: ZeroTouchContext;

  constructor(config?: Partial<ZeroTouchConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.context = {
      state: 'STANDBY_UNFRAMED',
      holdDurationMs: 0,
      countdownSecondsRemaining: this.config.countdownDurationSeconds,
      completedReps: 0,
      lastInflectionTimeMs: 0,
      audioAnnouncementFr: null,
      audioAnnouncementEn: null,
    };
  }

  public getContext(): ZeroTouchContext {
    return { ...this.context };
  }

  /**
   * Dispatches a lifecycle event to update the hands-free state machine.
   */
  public handleEvent(event: ZeroTouchEvent): ZeroTouchContext {
    switch (this.context.state) {
      case 'STANDBY_UNFRAMED':
        if (event.type === 'SUBJECT_ENTERED_FRAME') {
          this.context.state = 'FRAMING_ACQUIRED';
          this.context.audioAnnouncementFr = 'Cadrage validé. Mettez-vous en position.';
          this.context.audioAnnouncementEn = 'Framing acquired. Take your position.';
        }
        break;

      case 'FRAMING_ACQUIRED':
        if (event.type === 'SUBJECT_LEFT_FRAME') {
          this.context.state = 'STANDBY_UNFRAMED';
          this.context.audioAnnouncementFr = null;
          this.context.audioAnnouncementEn = null;
        } else if (event.type === 'POSTURE_HELD_STEADY') {
          const heldMs = (event.payload?.durationMs as number) || 0;
          this.context.holdDurationMs = heldMs;
          if (heldMs >= this.config.requiredHoldDurationMs) {
            this.context.state = 'COUNTDOWN';
            this.context.countdownSecondsRemaining = this.config.countdownDurationSeconds;
            this.context.audioAnnouncementFr = 'Prêt. Début dans 3... 2... 1...';
            this.context.audioAnnouncementEn = 'Ready. Starting in 3... 2... 1...';
          }
        }
        break;

      case 'COUNTDOWN':
        if (event.type === 'COUNTDOWN_EXPIRED') {
          this.context.state = 'TRACKING_ACTIVE';
          this.context.completedReps = 0;
          this.context.lastInflectionTimeMs = Date.now();
          this.context.audioAnnouncementFr = 'Partez.';
          this.context.audioAnnouncementEn = 'Go.';
        } else if (event.type === 'SUBJECT_LEFT_FRAME' || event.type === 'MANUAL_ABORT') {
          this.context.state = 'FRAMING_ACQUIRED';
          this.context.audioAnnouncementFr = 'Départ annulé.';
          this.context.audioAnnouncementEn = 'Start cancelled.';
        }
        break;

      case 'TRACKING_ACTIVE':
        if (event.type === 'REP_COMPLETED') {
          const count = (event.payload?.count as number) || (this.context.completedReps + 1);
          this.context.completedReps = count;
          this.context.lastInflectionTimeMs = Date.now();
          this.context.audioAnnouncementFr = `${count}`;
          this.context.audioAnnouncementEn = `${count}`;
        } else if (event.type === 'RERACK_OR_REST_DETECTED') {
          this.context.state = 'SET_TERMINATED';
          const reps = this.context.completedReps;
          this.context.audioAnnouncementFr = `Série terminée\u00A0: ${reps} répétitions enregistrées.`;
          this.context.audioAnnouncementEn = `Set complete: ${reps} reps recorded.`;
        }
        break;

      case 'SET_TERMINATED':
        if (event.type === 'SUBJECT_ENTERED_FRAME') {
          this.reset();
          this.context.state = 'FRAMING_ACQUIRED';
        }
        break;
    }

    return this.getContext();
  }

  /**
   * Helper to check whether a stationary rest period constitutes an automatic rerack stop.
   */
  public shouldAutoTerminateSet(timeSinceLastInflectionMs: number, repCount: number): boolean {
    if (repCount < 1) return false;
    return timeSinceLastInflectionMs >= this.config.restAutoStopTimeoutMs;
  }

  public reset(): void {
    this.context = {
      state: 'STANDBY_UNFRAMED',
      holdDurationMs: 0,
      countdownSecondsRemaining: this.config.countdownDurationSeconds,
      completedReps: 0,
      lastInflectionTimeMs: 0,
      audioAnnouncementFr: null,
      audioAnnouncementEn: null,
    };
  }
}
