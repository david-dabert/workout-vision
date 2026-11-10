/**
 * adaptiveMetronome.ts
 *
 * Adaptive Audio Metronome for Hypertrophy & Tendon Remodeling.
 * Guides lifters and physical therapy patients through optimal tempo cadences
 * (e.g. 3s eccentric lowering, 1s isometric stretch hold, explosive concentric).
 *
 * Implements pure programmatic Web Audio API synthesis (zero audio file downloads).
 */

export interface MetronomeCadence {
  eccentricSeconds: number; // e.g. 3.0
  pauseSeconds: number; // e.g. 1.0
  concentricSeconds: number; // e.g. 1.0
}

export type MetronomePhase = 'ECCENTRIC' | 'INFLECTION_PAUSE' | 'CONCENTRIC' | 'REST';

export interface MetronomeState {
  currentPhase: MetronomePhase;
  phaseElapsedSeconds: number;
  cadence: MetronomeCadence;
  isEnabled: boolean;
}

export class AdaptiveMetronome {
  private cadence: MetronomeCadence;
  private isEnabled = false;
  private currentPhase: MetronomePhase = 'REST';
  private audioCtx: AudioContext | null = null;

  constructor(cadence?: Partial<MetronomeCadence>) {
    this.cadence = {
      eccentricSeconds: cadence?.eccentricSeconds ?? 3.0,
      pauseSeconds: cadence?.pauseSeconds ?? 1.0,
      concentricSeconds: cadence?.concentricSeconds ?? 1.0,
    };
  }

  public enable(): void {
    this.isEnabled = true;
    if (typeof window !== 'undefined' && !this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
  }

  public disable(): void {
    this.isEnabled = false;
    this.currentPhase = 'REST';
  }

  public setCadence(cadence: MetronomeCadence): void {
    this.cadence = { ...cadence };
  }

  public getCadence(): MetronomeCadence {
    return { ...this.cadence };
  }

  public getPhase(): MetronomePhase {
    return this.currentPhase;
  }

  /**
   * Updates metronome phase based on real-time repetition progress.
   */
  public transitionPhase(newPhase: MetronomePhase): void {
    if (this.currentPhase === newPhase) return;
    this.currentPhase = newPhase;

    if (!this.isEnabled || !this.audioCtx) return;

    try {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      if (newPhase === 'ECCENTRIC') {
        // Soft calming descending tone (260 Hz -> 200 Hz)
        this.synthesizeTone(260, 200, 0.15, 'sine', now);
      } else if (newPhase === 'INFLECTION_PAUSE') {
        // Crisp wooden click at inflection hold (600 Hz impulse)
        this.synthesizeTone(600, 600, 0.05, 'triangle', now);
      } else if (newPhase === 'CONCENTRIC') {
        // Bright energetic chime (520 Hz)
        this.synthesizeTone(520, 520, 0.12, 'sine', now);
      }
    } catch {
      // Audio playback fails safely if blocked by browser policy
    }
  }

  /**
   * Pure synthesis helper using Web Audio API nodes.
   */
  private synthesizeTone(
    startFreq: number,
    endFreq: number,
    durationSeconds: number,
    type: OscillatorType,
    startTime: number
  ): void {
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (startFreq !== endFreq) {
      osc.frequency.linearRampToValueAtTime(endFreq, startTime + durationSeconds);
    }

    gain.gain.setValueAtTime(0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + durationSeconds);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(startTime);
    osc.stop(startTime + durationSeconds);
  }
}
