/**
 * AudioFeedback - Real-time auditory feedback for workout tracking.
 *
 * Replaces visual cues with sound so the user can focus on the lift.
 * Uses the Web Audio API with no external dependencies.
 *
 * Usage:
 *   const audio = new AudioFeedback();
 *   // On a user gesture (button click, etc.):
 *   audio.start();
 *   // Each frame during tracking:
 *   audio.updateAngle(currentAngle, targetAngle, phase);
 *   // When a rep is counted:
 *   audio.playRepComplete();
 *   // When form breaks down:
 *   audio.playFormWarning('minor');
 *   // Teardown:
 *   audio.dispose();
 */

const BASE_FREQ = 220; // A3
const SMOOTH_TIME_CONSTANT = 0.05; // seconds

export class AudioFeedback {
  /**
   * Creates an AudioFeedback instance.
   * Does NOT initialise the AudioContext; call start() on a user gesture.
   */
  constructor() {
    /** @type {AudioContext|null} */
    this._ctx = null;
    /** @type {OscillatorNode|null} */
    this._oscillator = null;
    /** @type {GainNode|null} */
    this._gain = null;
    this._started = false;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Initialises or resumes the AudioContext.
   * Must be called from a user-gesture handler (click, touch, etc.).
   */
  start() {
    if (!this._isAudioSupported()) return;

    try {
      if (!this._ctx) {
        this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      }

      if (this._ctx.state === 'suspended') {
        this._ctx.resume();
      }

      this._ensurePersistentOscillator();
      this._started = true;
    } catch (_) {
      // AudioContext unavailable; degrade silently.
    }
  }

  /**
   * Suspends the AudioContext and silences the persistent oscillator.
   */
  stop() {
    if (!this._ctx) return;

    this._silencePersistentOscillator();

    try {
      this._ctx.suspend();
    } catch (_) {
      // ignore
    }

    this._started = false;
  }

  /**
   * Permanently closes the AudioContext and releases all resources.
   * The instance cannot be reused after this call.
   */
  dispose() {
    this._destroyPersistentOscillator();

    if (this._ctx) {
      try {
        this._ctx.close();
      } catch (_) {
        // ignore
      }
    }

    this._ctx = null;
    this._started = false;
  }

  // ---------------------------------------------------------------------------
  // Continuous angle feedback
  // ---------------------------------------------------------------------------

  /**
   * Updates the tracking tone based on the current joint angle.
   *
   * Pitch rises from 220 Hz (far from target) to 440 Hz (at target).
   * Volume rises with proximity so the tone is unobtrusive when far away.
   *
   * @param {number} currentAngle - The measured joint angle in degrees.
   * @param {number} targetAngle  - The ideal angle at the bottom of the rep.
   * @param {string} phase        - Current movement phase (unused for now,
   *                                reserved for future per-phase behaviour).
   */
  updateAngle(currentAngle, targetAngle, phase) {
    if (!this._started || !this._ctx || !this._oscillator || !this._gain) return;

    const distance = Math.abs(currentAngle - targetAngle);
    // Normalise proximity to 0..1. Cap the "far" threshold at 90 degrees.
    const proximity = Math.max(0, Math.min(1, 1 - distance / 90));

    const frequency = BASE_FREQ + proximity * BASE_FREQ; // 220 -> 440
    const volume = proximity * 0.3; // 0 -> 0.3 (comfortable max)

    const now = this._ctx.currentTime;
    this._oscillator.frequency.setTargetAtTime(frequency, now, SMOOTH_TIME_CONSTANT);
    this._gain.gain.setTargetAtTime(volume, now, SMOOTH_TIME_CONSTANT);
  }

  // ---------------------------------------------------------------------------
  // One-shot sounds
  // ---------------------------------------------------------------------------

  /**
   * Plays two quick ascending tones to confirm a completed rep.
   * 440 Hz for 80 ms, then 660 Hz for 80 ms.
   */
  playRepComplete() {
    if (!this._started || !this._ctx) return;

    const now = this._ctx.currentTime;
    this._playTone(440, now, 0.08, 0.25);
    this._playTone(660, now + 0.08, 0.08, 0.25);
  }

  /**
   * Plays a warning sound when form breaks down.
   *
   * @param {'minor'|'major'} severity
   *   - 'minor': single 330 Hz tone, 150 ms, gentle volume.
   *   - 'major': two 220 Hz pulses, 100 ms each with 50 ms gap, louder.
   */
  playFormWarning(severity) {
    if (!this._started || !this._ctx) return;

    const now = this._ctx.currentTime;

    if (severity === 'major') {
      this._playTone(220, now, 0.1, 0.4);
      this._playTone(220, now + 0.15, 0.1, 0.4);
    } else {
      // 'minor' or any unknown value
      this._playTone(330, now, 0.15, 0.15);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * @returns {boolean} Whether the Web Audio API is available.
   * @private
   */
  _isAudioSupported() {
    return typeof window !== 'undefined' &&
      (typeof window.AudioContext !== 'undefined' ||
       typeof window.webkitAudioContext !== 'undefined');
  }

  /**
   * Creates the persistent oscillator and gain node used by updateAngle.
   * Starts silent (gain = 0).
   * @private
   */
  _ensurePersistentOscillator() {
    if (this._oscillator) return;
    if (!this._ctx) return;

    this._gain = this._ctx.createGain();
    this._gain.gain.value = 0;
    this._gain.connect(this._ctx.destination);

    this._oscillator = this._ctx.createOscillator();
    this._oscillator.type = 'sine';
    this._oscillator.frequency.value = BASE_FREQ;
    this._oscillator.connect(this._gain);
    this._oscillator.start();
  }

  /**
   * Fades the persistent oscillator to silence.
   * @private
   */
  _silencePersistentOscillator() {
    if (!this._gain || !this._ctx) return;
    this._gain.gain.setTargetAtTime(0, this._ctx.currentTime, SMOOTH_TIME_CONSTANT);
  }

  /**
   * Stops and disconnects the persistent oscillator permanently.
   * @private
   */
  _destroyPersistentOscillator() {
    if (this._oscillator) {
      try {
        this._oscillator.stop();
        this._oscillator.disconnect();
      } catch (_) {
        // May already be stopped.
      }
      this._oscillator = null;
    }

    if (this._gain) {
      try {
        this._gain.disconnect();
      } catch (_) {
        // ignore
      }
      this._gain = null;
    }
  }

  /**
   * Creates a one-shot oscillator with a short attack/decay envelope.
   *
   * @param {number} freq      - Frequency in Hz.
   * @param {number} startTime - AudioContext time to begin.
   * @param {number} duration  - Length in seconds.
   * @param {number} peakGain  - Maximum gain (0..1).
   * @private
   */
  _playTone(freq, startTime, duration, peakGain) {
    if (!this._ctx) return;

    const attack = 0.01;
    const decay = 0.02;

    const gain = this._ctx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + attack);
    gain.gain.setValueAtTime(peakGain, startTime + duration - decay);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);
    gain.connect(this._ctx.destination);

    const osc = this._ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01); // tiny buffer past envelope end

    // Clean up after the tone finishes.
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
}
