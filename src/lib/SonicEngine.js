/**
 * SonicEngine — The Mario Coin Sound for Reps
 *
 * Web Audio API. Zero dependencies. Works offline.
 * Distinctive feedback tones that make WorkoutVision instantly recognizable.
 *
 * Convergence item #7: Sonic identity.
 */

let _audioCtx = null;

function getAudioContext() {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume();
  }
  return _audioCtx;
}

// ---------------------------------------------------------------------------
// Core tone generators
// ---------------------------------------------------------------------------

function playTone(frequency, duration, type = 'sine', gainValue = 0.15) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  gain.gain.setValueAtTime(gainValue, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playChord(frequencies, duration, type = 'sine', gainValue = 0.08) {
  for (const freq of frequencies) {
    playTone(freq, duration, type, gainValue);
  }
}

// ---------------------------------------------------------------------------
// SonicEngine
// ---------------------------------------------------------------------------

export class SonicEngine {
  constructor() {
    this._enabled = true;
    this._repCount = 0;
  }

  get enabled() { return this._enabled; }
  set enabled(v) { this._enabled = v; }

  /**
   * Rep completed — perfect fifth chord (C5 + G5).
   * Pitch rises every 5 reps to build momentum.
   */
  repComplete(repNumber) {
    if (!this._enabled) return;
    this._repCount = repNumber || this._repCount + 1;

    // Base pitch rises every 5 reps (semitone steps)
    const pitchStep = Math.floor((this._repCount - 1) / 5);
    const baseFreq = 523.25 * Math.pow(2, pitchStep / 12); // C5 base
    const fifthFreq = baseFreq * 1.5; // Perfect fifth

    playChord([baseFreq, fifthFreq], 0.25, 'sine', 0.10);
  }

  /**
   * Concentric phase start — pitch rises (triangle wave).
   * Subtle cue that the upward movement began.
   */
  concentricStart() {
    if (!this._enabled) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(440, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  }

  /**
   * Eccentric phase start — pitch falls.
   */
  eccentricStart() {
    if (!this._enabled) return;
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(330, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  }

  /**
   * Good form — major third chord (bright, warm).
   */
  formGood() {
    if (!this._enabled) return;
    // C5 + E5 (major third)
    playChord([523.25, 659.25], 0.3, 'sine', 0.07);
  }

  /**
   * Form warning — tritone (dissonant, attention-grabbing).
   * Not punishing, just alerting.
   */
  formWarning() {
    if (!this._enabled) return;
    // C4 + F#4 (tritone — the "devil's interval")
    playChord([261.63, 369.99], 0.2, 'square', 0.04);
  }

  /**
   * Personal record — shimmering ascending arpeggio.
   */
  personalRecord() {
    if (!this._enabled) return;
    const ctx = getAudioContext();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.10, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    });

    // Add shimmer (high frequency sine)
    const shimmer = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(2093, ctx.currentTime);
    shimmerGain.gain.setValueAtTime(0.03, ctx.currentTime);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmer.start(ctx.currentTime);
    shimmer.stop(ctx.currentTime + 0.6);
  }

  /**
   * Milestone — every 5 reps. Deeper, more resonant.
   * Also triggers haptic feedback if available.
   */
  milestone(repNumber) {
    if (!this._enabled) return;

    // Deep resonant pulse (C3 + G3)
    playChord([130.81, 196.00], 0.4, 'sine', 0.12);

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 80]);
    }
  }

  /**
   * Set complete — resolving chord.
   */
  setComplete() {
    if (!this._enabled) return;
    // C major chord spread: C4, E4, G4, C5
    const ctx = getAudioContext();
    const notes = [261.63, 329.63, 392.00, 523.25];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.05;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  }

  /**
   * Fatigue warning — low rumble.
   */
  fatigueWarning() {
    if (!this._enabled) return;
    playTone(80, 0.3, 'sine', 0.10);
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  }

  /**
   * AI lock-on — the moment the skeleton first appears.
   * Subsonic thrum + rising tone.
   */
  aiLockOn() {
    if (!this._enabled) return;
    const ctx = getAudioContext();

    // Subsonic thrum
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(40, ctx.currentTime);
    subGain.gain.setValueAtTime(0.08, ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(ctx.currentTime);
    sub.stop(ctx.currentTime + 0.5);

    // Rising recognition tone
    const rise = ctx.createOscillator();
    const riseGain = ctx.createGain();
    rise.type = 'sine';
    rise.frequency.setValueAtTime(200, ctx.currentTime + 0.1);
    rise.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.4);
    riseGain.gain.setValueAtTime(0.06, ctx.currentTime + 0.1);
    riseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    rise.connect(riseGain);
    riseGain.connect(ctx.destination);
    rise.start(ctx.currentTime + 0.1);
    rise.stop(ctx.currentTime + 0.5);
  }

  /**
   * Reset rep counter for new set.
   */
  resetSet() {
    this._repCount = 0;
  }
}

// Singleton
export const sonicEngine = new SonicEngine();
