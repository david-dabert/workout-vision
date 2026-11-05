/**
 * WorkoutVision — 1-Tap Boardroom Investor Showcase Engine
 *
 * Provides a zero-friction, boardroom-ready live simulation of the full
 * computer vision pipeline. Executes at 30 fps with realistic biomechanical
 * kinematics, dynamic HUD distance scaling, and psychoacoustic Web Audio cues.
 *
 * Invariants:
 * - 100% Client-Side Purity: Zero video downloads or network calls.
 * - Sub-5ms audio/kinematic latency.
 * - Emits a complete BiomechanicalSummary upon completion for the Share Card.
 */

import { hapticResonanceAudio } from './hapticResonanceAudio';
import { BiomechanicalSummary } from './biomechanicalShareCard';

export interface ShowcaseFrame {
  timestampMs: number;
  repCount: number;
  phase: 'eccentric' | 'turnaround' | 'concentric' | 'lockout';
  kneeAngleDeg: number;
  hipAngleDeg: number;
  instantaneousVelocityMps: number;
  distanceMeters: number; // For dynamic High-Glance HUD testing
  isRepComplete: boolean;
  isInflection: boolean;
}

export interface ShowcaseOptions {
  exerciseName?: string;
  targetReps?: number;
  repDurationMs?: number; // Default: 3000 ms per rep (2s eccentric, 1s concentric)
  playbackSpeed?: number; // 1.0 = real-time, 2.0 = fast
  enableAudio?: boolean;
  onFrame?: (frame: ShowcaseFrame) => void;
  onRepCompleted?: (rep: number, summary: Partial<BiomechanicalSummary>) => void;
  onComplete?: (summary: BiomechanicalSummary) => void;
}

export class InvestorShowcaseEngine {
  private isRunning = false;
  private animId: number | null = null;
  private startTime = 0;
  private options: Required<ShowcaseOptions>;
  private currentRep = 0;
  private lastPhase: ShowcaseFrame['phase'] = 'lockout';
  private peakVelocities: number[] = [];

  constructor(options: ShowcaseOptions = {}) {
    this.options = {
      exerciseName: options.exerciseName ?? 'Barbell Back Squat',
      targetReps: options.targetReps ?? 9,
      repDurationMs: options.repDurationMs ?? 2800,
      playbackSpeed: options.playbackSpeed ?? 1.0,
      enableAudio: options.enableAudio ?? true,
      onFrame: options.onFrame ?? (() => {}),
      onRepCompleted: options.onRepCompleted ?? (() => {}),
      onComplete: options.onComplete ?? (() => {}),
    };
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = performance.now();
    this.currentRep = 0;
    this.lastPhase = 'lockout';
    this.peakVelocities = [];

    if (this.options.enableAudio) {
      hapticResonanceAudio.setEnabled(true);
      hapticResonanceAudio.playCadenceTick(true);
    }

    this.tick();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  private tick = (): void => {
    if (!this.isRunning) return;

    const elapsedMs = (performance.now() - this.startTime) * this.options.playbackSpeed;
    const repDuration = this.options.repDurationMs;
    const totalDuration = repDuration * this.options.targetReps;

    if (elapsedMs >= totalDuration) {
      this.finish();
      return;
    }

    const currentRepFloat = elapsedMs / repDuration;
    const repIndex = Math.floor(currentRepFloat);
    const progressInRep = currentRepFloat - repIndex; // [0, 1]

    // Biomechanical Phase Modeling
    // 0.0 - 0.65: Eccentric descent (e.g. 1.8s)
    // 0.65 - 0.72: Turnaround / Inflection point (bottom of squat)
    // 0.72 - 0.95: Concentric drive (e.g. 0.8s)
    // 0.95 - 1.00: Lockout stasis
    let phase: ShowcaseFrame['phase'];
    let kneeAngleDeg: number;
    let hipAngleDeg: number;
    let velocityMps: number;
    let isRepComplete = false;
    let isInflection = false;

    // Simulate athlete stepping back from 1.8m to 3.2m during reps 1-3 to demonstrate HUD
    const distanceMeters = Math.min(3.2, 1.8 + (elapsedMs / totalDuration) * 1.4);

    if (progressInRep < 0.65) {
      phase = 'eccentric';
      const p = progressInRep / 0.65;
      kneeAngleDeg = 175 - 95 * Math.sin((p * Math.PI) / 2); // 175 deg down to 80 deg (full depth)
      hipAngleDeg = 170 - 85 * Math.sin((p * Math.PI) / 2);
      velocityMps = -0.45 * Math.sin(p * Math.PI);
    } else if (progressInRep < 0.72) {
      phase = 'turnaround';
      kneeAngleDeg = 80;
      hipAngleDeg = 85;
      velocityMps = 0;
      isInflection = true;
    } else if (progressInRep < 0.95) {
      phase = 'concentric';
      const p = (progressInRep - 0.72) / 0.23;
      kneeAngleDeg = 80 + 95 * Math.sin((p * Math.PI) / 2);
      hipAngleDeg = 85 + 85 * Math.sin((p * Math.PI) / 2);
      // Realistic velocity profile: slight slowdown under fatigue
      const fatigueFactor = 1 - repIndex * 0.015;
      velocityMps = 0.72 * fatigueFactor * Math.sin(p * Math.PI);
    } else {
      phase = 'lockout';
      kneeAngleDeg = 175;
      hipAngleDeg = 170;
      velocityMps = 0.05;
    }

    // Trigger Turnaround Acoustic Cue
    if (phase === 'turnaround' && this.lastPhase !== 'turnaround') {
      if (this.options.enableAudio) {
        hapticResonanceAudio.playTurnaround();
      }
    }

    // Trigger Rep Completion Cue
    if (repIndex > this.currentRep) {
      this.currentRep = repIndex;
      isRepComplete = true;
      const repPeakVel = 0.72 * (1 - (repIndex - 1) * 0.015);
      this.peakVelocities.push(repPeakVel);

      if (this.options.enableAudio) {
        hapticResonanceAudio.playRepSuccess();
      }

      this.options.onRepCompleted(this.currentRep, {
        totalReps: this.currentRep,
        peakVelocityMps: repPeakVel,
      });
    }

    this.lastPhase = phase;

    const frame: ShowcaseFrame = {
      timestampMs: elapsedMs,
      repCount: this.currentRep,
      phase,
      kneeAngleDeg,
      hipAngleDeg,
      instantaneousVelocityMps: velocityMps,
      distanceMeters,
      isRepComplete,
      isInflection,
    };

    this.options.onFrame(frame);

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animId = requestAnimationFrame(this.tick);
    }
  };

  private finish(): void {
    this.isRunning = false;
    this.currentRep = this.options.targetReps;
    const finalPeakVel = 0.72 * (1 - (this.options.targetReps - 1) * 0.015);
    this.peakVelocities.push(finalPeakVel);

    if (this.options.enableAudio) {
      hapticResonanceAudio.playRepSuccess();
    }

    const baselineVel = this.peakVelocities[0] || 0.72;
    const lastVel = this.peakVelocities[this.peakVelocities.length - 1] || 0.65;
    const velocityLossPercent = Math.max(0, ((baselineVel - lastVel) / baselineVel) * 100);

    const summary: BiomechanicalSummary = {
      exerciseName: this.options.exerciseName,
      totalReps: this.options.targetReps,
      completedAt: new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
      peakVelocityMps: baselineVel,
      averageVelocityMps: (baselineVel + lastVel) / 2,
      velocityLossPercent,
      eccentricCadenceSec: (this.options.repDurationMs * 0.65) / 1000,
      concentricCadenceSec: (this.options.repDurationMs * 0.23) / 1000,
      bilateralSymmetryPercent: 98.4,
      romConsistencyScore: 96,
      depthQuality: 'full',
    };

    this.options.onComplete(summary);
  }
}
