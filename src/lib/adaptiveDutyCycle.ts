/**
 * Adaptive Thermal Duty Cycle Governor.
 *
 * Resolves the "Thermal Throttling Ceiling" on mobile WebKit:
 * Running continuous 15-30 fps pose inference on smartphones in warm gym environments
 * causes SoC heat buildup, battery drain, and thermal throttling (CPU downclocking by 30-50%).
 *
 * This governor dynamically shifts pose inference duty cycles:
 * - Idle / Rest: 4 fps (250 ms) -> 73% reduction in inference cycles during rest periods.
 * - Standby / Setup: 8 fps (125 ms) -> responsive presence detection before the set.
 * - Active Set: 15 fps (66.7 ms) -> full kinematic resolution during reps.
 * - Cooldown: 4 fps (250 ms) -> low-power recovery post-set.
 *
 * It dynamically throttles on backpressure when frame latency spikes, preventing queue overflow.
 */

export type DutyState = 'idle' | 'standby' | 'active' | 'cooldown';

export interface DutyTierConfig {
  targetFps: number;
  intervalMs: number;
}

export const DUTY_TIERS: Record<DutyState, DutyTierConfig> = Object.freeze({
  idle: { targetFps: 4, intervalMs: 250 },
  standby: { targetFps: 8, intervalMs: 125 },
  active: { targetFps: 15, intervalMs: 1000 / 15 }, // 66.67 ms (core TARGET_FPS)
  cooldown: { targetFps: 4, intervalMs: 250 },
});

export interface DutyCycleStats {
  totalFramesPresented: number;
  totalFramesProcessed: number;
  totalFramesSkipped: number;
  currentState: DutyState;
  effectiveIntervalMs: number;
  averageLatencyMs: number;
  thermalReductionRatio: number;
}

export class AdaptiveDutyGovernor {
  private state: DutyState = 'idle';
  private lastProcessedTimestamp = -Infinity;
  private latencyHistory: number[] = [];
  private readonly maxLatencyHistory = 10;

  private framesPresented = 0;
  private framesProcessed = 0;
  private framesSkipped = 0;

  constructor(initialState: DutyState = 'idle') {
    this.state = initialState;
  }

  /**
   * Transition governor state (e.g. from idle rest to active set).
   */
  public setState(nextState: DutyState): void {
    if (this.state !== nextState) {
      this.state = nextState;
    }
  }

  public getState(): DutyState {
    return this.state;
  }

  /**
   * Returns current target interval in milliseconds for the active duty state,
   * with backpressure compensation if inference latency exceeds the nominal interval.
   */
  public getEffectiveIntervalMs(): number {
    const nominal = DUTY_TIERS[this.state].intervalMs;
    const avgLatency = this.getAverageLatencyMs();

    // If pose worker latency is struggling (taking > 85% of interval), dynamically expand
    // interval by 20% to prevent queue backlog and thermal runaway.
    if (avgLatency > nominal * 0.85) {
      return Math.round(nominal * 1.25);
    }
    return Math.round(nominal * 10) / 10;
  }

  /**
   * Evaluates whether a video frame arriving at `timestampMs` should be sent to pose worker.
   */
  public shouldProcess(timestampMs: number): boolean {
    this.framesPresented++;
    const interval = this.getEffectiveIntervalMs();

    if (timestampMs - this.lastProcessedTimestamp >= interval) {
      this.lastProcessedTimestamp = timestampMs;
      this.framesProcessed++;
      return true;
    }

    this.framesSkipped++;
    return false;
  }

  /**
   * Records pose detection execution duration for adaptive backpressure monitoring.
   */
  public recordLatency(latencyMs: number): void {
    if (typeof latencyMs === 'number' && latencyMs >= 0) {
      this.latencyHistory.push(latencyMs);
      if (this.latencyHistory.length > this.maxLatencyHistory) {
        this.latencyHistory.shift();
      }
    }
  }

  public getAverageLatencyMs(): number {
    if (this.latencyHistory.length === 0) return 0;
    const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
    return Math.round((sum / this.latencyHistory.length) * 10) / 10;
  }

  /**
   * Proportion of compute cycles saved relative to continuous 15 fps operation.
   */
  public getThermalReductionRatio(): number {
    if (this.framesPresented === 0) return 0;
    const nominalFullFpsCycles = this.framesPresented;
    const actualCycles = this.framesProcessed;
    const ratio = (nominalFullFpsCycles - actualCycles) / nominalFullFpsCycles;
    return Math.max(0, Math.min(1, Math.round(ratio * 100) / 100));
  }

  public getStats(): DutyCycleStats {
    return {
      totalFramesPresented: this.framesPresented,
      totalFramesProcessed: this.framesProcessed,
      totalFramesSkipped: this.framesSkipped,
      currentState: this.state,
      effectiveIntervalMs: this.getEffectiveIntervalMs(),
      averageLatencyMs: this.getAverageLatencyMs(),
      thermalReductionRatio: this.getThermalReductionRatio(),
    };
  }

  public reset(): void {
    this.lastProcessedTimestamp = -Infinity;
    this.latencyHistory = [];
    this.framesPresented = 0;
    this.framesProcessed = 0;
    this.framesSkipped = 0;
  }
}
