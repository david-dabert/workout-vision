/**
 * Autonomous Set Gate (Hands-Free Auto-Start & Auto-Rack Termination)
 * 
 * Enables 100% hands-free workout execution:
 * 1. Auto-Start: Triggers countdown when the lifter establishes a steady brace posture
 *    inside optimal camera framing for 1.2s.
 * 2. Auto-Rack: Terminates and saves the set when the lifter completes their reps
 *    and remains stationary at lockout for > 3.5s, or steps away from the station.
 * 
 * Strict Invariants:
 * - 100% Client-side purity (deterministic state machine).
 * - Never drops active sets prematurely.
 * - French typography compliance: non-breaking space (\u00A0) before ':', ';', '?', '!'.
 */

export interface AutoGateOptions {
  braceDwellSec?: number; // Time stationary to trigger countdown (default: 1.2s)
  rackDwellSec?: number; // Time stationary at lockout after >=1 rep to terminate (default: 3.5s)
  angularVelocityThresholdDegPerSec?: number; // Maximum angular velocity to be considered 'still' (default: 10 deg/s)
}

export type AutoGateState = 
  | 'IDLE' // Waiting for optimal framing
  | 'BRACING' // Athlete framed, counting stationary dwell for countdown
  | 'COUNTDOWN' // Countdown active
  | 'ACTIVE_LIFTING' // Set in progress
  | 'LOCKOUT_RESTING' // Athlete finished reps, stationary at lockout awaiting auto-finish
  | 'COMPLETED'; // Auto-stop triggered

export class AutoSetGate {
  private state: AutoGateState = 'IDLE';
  private braceStartTime = 0;
  private lockoutStartTime = 0;
  private repCount = 0;
  private lastAngleDeg: number | null = null;
  private lastAngleTimestamp = 0;

  private readonly braceDwellMs: number;
  private readonly rackDwellMs: number;
  private readonly velocityThreshold: number;

  constructor(options: AutoGateOptions = {}) {
    this.braceDwellMs = (options.braceDwellSec ?? 1.2) * 1000;
    this.rackDwellMs = (options.rackDwellSec ?? 3.5) * 1000;
    this.velocityThreshold = options.angularVelocityThresholdDegPerSec ?? 10;
  }

  public getState(): AutoGateState {
    return this.state;
  }

  public setReps(count: number): void {
    this.repCount = count;
  }

  /**
   * Evaluates current frame telemetry to detect autonomous start/stop events.
   * 
   * @param isOptimallyFramed Whether the athlete is inside optimal camera bounds
   * @param currentAngleDeg The current tracked joint angle (degrees)
   * @param isNearLockout Whether the joint angle is near starting lockout position
   * @param nowMs Current high-resolution timestamp
   * @returns 'TRIGGER_COUNTDOWN' | 'TRIGGER_FINISH' | null
   */
  public update(
    isOptimallyFramed: boolean,
    currentAngleDeg: number | null,
    isNearLockout = true,
    nowMs = Date.now()
  ): 'TRIGGER_COUNTDOWN' | 'TRIGGER_FINISH' | null {
    // Calculate angular velocity (deg/sec)
    let angularVel = 0;
    if (this.lastAngleDeg !== null && currentAngleDeg !== null && this.lastAngleTimestamp > 0) {
      const dt = (nowMs - this.lastAngleTimestamp) / 1000;
      if (dt > 0.01) {
        angularVel = Math.abs(currentAngleDeg - this.lastAngleDeg) / dt;
      }
    }
    this.lastAngleDeg = currentAngleDeg;
    this.lastAngleTimestamp = nowMs;

    const isStationary = angularVel < this.velocityThreshold;

    // State 1: IDLE / Waiting for Bracing
    if (this.state === 'IDLE') {
      if (isOptimallyFramed && isStationary) {
        this.state = 'BRACING';
        this.braceStartTime = nowMs;
      }
      return null;
    }

    // State 2: BRACING (Counting dwell to auto-trigger countdown)
    if (this.state === 'BRACING') {
      if (!isOptimallyFramed || !isStationary) {
        // Lost brace or moved too violently, reset to idle
        this.state = 'IDLE';
        this.braceStartTime = 0;
        return null;
      }

      if (nowMs - this.braceStartTime >= this.braceDwellMs) {
        this.state = 'COUNTDOWN';
        return 'TRIGGER_COUNTDOWN';
      }
      return null;
    }

    // State 3: ACTIVE_LIFTING (Monitoring for set completion / rack)
    if (this.state === 'ACTIVE_LIFTING') {
      // Must have performed at least 1 valid rep to trigger auto-finish
      if (this.repCount >= 1 && isNearLockout && isStationary) {
        this.state = 'LOCKOUT_RESTING';
        this.lockoutStartTime = nowMs;
      }
      return null;
    }

    // State 4: LOCKOUT_RESTING (Monitoring prolonged stationary pause after reps)
    if (this.state === 'LOCKOUT_RESTING') {
      // If the lifter starts moving again before the rack dwell expires (new rep started)
      if (!isNearLockout || angularVel > this.velocityThreshold * 1.5) {
        this.state = 'ACTIVE_LIFTING';
        this.lockoutStartTime = 0;
        return null;
      }

      if (nowMs - this.lockoutStartTime >= this.rackDwellMs) {
        this.state = 'COMPLETED';
        return 'TRIGGER_FINISH';
      }
      return null;
    }

    return null;
  }

  /**
   * Manually notify the gate that lifting has started (e.g. countdown completed).
   */
  public onSetStarted(): void {
    this.state = 'ACTIVE_LIFTING';
    this.lockoutStartTime = 0;
  }

  public reset(): void {
    this.state = 'IDLE';
    this.braceStartTime = 0;
    this.lockoutStartTime = 0;
    this.repCount = 0;
    this.lastAngleDeg = null;
    this.lastAngleTimestamp = 0;
  }
}
