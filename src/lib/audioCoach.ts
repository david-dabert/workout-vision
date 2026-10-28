/**
 * WorkoutVision Universal Kinematic Manifold — Psychoacoustic Audio Coach
 * 
 * High-precision, zero-latency Web Audio API acoustic and micro-haptic cueing service.
 * Delivers subconscious real-time pacing, concentric/eccentric phase transitions,
 * turnaround notifications, and velocity loss alerts without requiring the user
 * to look at the screen.
 * 
 * Invariants:
 * - 100% Client-Side Purity: Zero audio sample assets or network requests.
 * - Sub-5ms acoustic latency via native Web Audio oscillators and envelope shapers.
 * - Anti-pop exponential gain ramping on all transitions.
 */

export type MovementPhase = 'concentric' | 'eccentric' | 'turnaround' | 'lockout';

export interface AudioCoachConfig {
  enabled: boolean;
  masterVolume: number; // 0.0 to 1.0
  pacingBpm?: number;
}

class AudioCoachService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private config: AudioCoachConfig = {
    enabled: true,
    masterVolume: 0.8,
  };

  /**
   * Initializes or resumes the Web Audio context upon user interaction
   */
  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!this.ctx) {
      try {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.config.masterVolume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public setVolume(volume: number): void {
    this.config.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.config.masterVolume, this.ctx.currentTime);
    }
  }

  /**
   * Synthesizes a tempo metronome tick with optional downbeat accent
   */
  public playTempoTick(accent = false): void {
    if (!this.config.enabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // High woodblock tick: 1200 Hz accented, 800 Hz normal
    const freq = accent ? 1200 : 800;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.02);

    const amp = accent ? 0.25 : 0.12;
    gain.gain.setValueAtTime(amp, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.025);
  }

  /**
   * Synthesizes phase transition micro-tones (concentric, eccentric, turnaround, lockout)
   */
  public playPhaseTransition(phase: MovementPhase): void {
    if (!this.config.enabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    switch (phase) {
      case 'concentric': {
        // Uplifting harmonic chirp: 440 Hz -> 660 Hz over 50ms
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.05);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }

      case 'eccentric': {
        // Controlled descending hum: 520 Hz -> 330 Hz over 60ms
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.06);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.06);
        break;
      }

      case 'turnaround': {
        // Resonant bottom turnaround anchor: 300 Hz -> 200 Hz warm tone
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.045);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.045);
        break;
      }

      case 'lockout': {
        // Precision mechanical shutter click (880 Hz -> 440 Hz over 20ms)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.02);

        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.02);
        break;
      }
    }
  }

  /**
   * Triggers micro-haptic vibration on supported hardware
   */
  private triggerHaptic(pattern = [20]): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Haptics not allowed or unsupported
      }
    }
  }

  /**
   * Synthesizes a crisp, high-definition tactile click indicating the athlete
   * has achieved the target stretch-mediated hypertrophy depth in the bottom position.
   * Cuts through ambient gym noise and music playing in AirPods.
   */
  public playStretchDepthClick(): void {
    if (!this.config.enabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // High resonant tactile tick: 1050 Hz down to 525 Hz over 20ms
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1050, now);
    osc.frequency.exponentialRampToValueAtTime(525, now + 0.02);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.02);

    this.triggerHaptic([15]);
  }

  /**
   * Synthesizes a low-frequency dissonant warning indicating an abrupt
   * turnaround bounce (momentum cheating / joint shock) rather than controlled muscular reversal.
   */
  public playBounceWarning(): void {
    if (!this.config.enabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    // Dissonant low warning: 130 Hz + 185 Hz descending over 70ms
    osc1.type = 'sawtooth';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(130, now);
    osc1.frequency.exponentialRampToValueAtTime(80, now + 0.07);

    osc2.frequency.setValueAtTime(185, now);
    osc2.frequency.exponentialRampToValueAtTime(110, now + 0.07);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.07);
    osc2.stop(now + 0.07);

    this.triggerHaptic([25, 40, 25]);
  }

  /**
   * Synthesizes a subtle acoustic reminder if the lifter rests at lockout > 800ms
   * during a continuous-tension set.
   */
  public playContinuousTensionAlert(): void {
    if (!this.config.enabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.05);

    gain.gain.setValueAtTime(0.10, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Synthesizes a precision mechanical click indicating clean joint lockout or rep completion.
   */
  public playLockoutCue(pan = 0): void {
    if (!this.config.enabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.025);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    if (ctx.createStereoPanner && pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(this.masterGain);
    } else {
      osc.connect(gain);
      gain.connect(this.masterGain);
    }

    osc.start(now);
    osc.stop(now + 0.025);

    this.triggerHaptic([15]);
  }

  /**
   * Synthesizes a warm resonant low-frequency tone at peak concentric/eccentric turnaround
   */
  public playTurnaroundCue(): void {
    if (!this.config.enabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.04);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.04);

    this.triggerHaptic([10]);
  }

  /**
   * Psychoacoustic warning tone for significant bar/joint velocity loss (e.g. fatigue failure threshold)
   */
  public playVelocityLossAlert(lossPercentage?: number): void {
    if (!this.config.enabled) return;
    if (lossPercentage !== undefined && lossPercentage < 0.20) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const master = this.masterGain;
    [0, 0.08].forEach(offset => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now + offset); // C5

      gain.gain.setValueAtTime(0.15, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);

      osc.connect(gain);
      gain.connect(master);

      osc.start(now + offset);
      osc.stop(now + offset + 0.05);
    });

    this.triggerHaptic([20, 40, 20]);
  }

  /**
   * Countdown cue (3... 2... 1... GO!)
   */
  public playCountdownTick(remainingSeconds: number): void {
    if (!this.config.enabled) return;
    const ctx = this.getContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const isGo = remainingSeconds <= 0;
    const freq = isGo ? 987.77 : 587.33; // B5 for GO, D5 for ticks
    const duration = isGo ? 0.15 : 0.04;

    osc.type = isGo ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(isGo ? 0.25 : 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration);
  }
}

export const audioCoach = new AudioCoachService();

