/**
 * VoiceCoach — Real-time voice coaching via Web Speech API.
 *
 * Speaks short coaching cues during a workout. Throttled, prioritized,
 * and designed to stay out of the way while the user is lifting.
 *
 * Usage:
 *   const coach = new VoiceCoach();
 *   coach.repComplete(3);
 *   coach.formWarning('Keep your back straight');
 *   coach.setComplete(8, 'A');
 *   coach.dispose();
 */

const PRIORITY = { low: 0, normal: 1, high: 2, critical: 3 };
const MAX_QUEUE = 2;
const DEFAULT_COOLDOWN = 3000; // ms

/**
 * Pick a preferred voice from the available speechSynthesis voices.
 * Prefers natural-sounding English voices.
 * @returns {SpeechSynthesisVoice|null}
 */
function pickVoice() {
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Preference order: Google US English, Samantha (macOS), any en voice
  const preferred = [
    v => /google us english/i.test(v.name),
    v => /samantha/i.test(v.name),
    v => /google.*english/i.test(v.name),
    v => v.lang.startsWith('en') && v.localService,
    v => v.lang.startsWith('en'),
  ];

  for (const test of preferred) {
    const match = voices.find(test);
    if (match) return match;
  }
  return voices[0];
}

export class VoiceCoach {
  constructor() {
    this.enabled = true;
    this.queue = [];
    this.speaking = false;
    this.lastCue = '';
    this.lastCueTime = 0;
    this.cooldown = DEFAULT_COOLDOWN;
    this._voice = null;
    this._voiceLoaded = false;
    this._disposed = false;
    this._heavySetMode = false; // Suppress non-critical cues for sets under 5 reps

    // Voices may load asynchronously
    if (this._isSupported()) {
      this._voice = pickVoice();
      if (!this._voice) {
        speechSynthesis.addEventListener('voiceschanged', () => {
          if (!this._voiceLoaded) {
            this._voice = pickVoice();
            this._voiceLoaded = true;
          }
        }, { once: true });
      } else {
        this._voiceLoaded = true;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Queue a speech cue.
   * @param {string} text
   * @param {'low'|'normal'|'high'|'critical'} priority
   */
  speak(text, priority = 'normal') {
    if (!this.enabled || !this._isSupported() || this._disposed) return;
    if (!text) return;

    const now = Date.now();
    const pri = PRIORITY[priority] ?? PRIORITY.normal;

    // Heavy-set mode: only allow critical cues (safety warnings)
    if (this._heavySetMode && pri < PRIORITY.critical) return;

    // Throttle: skip if same cue was spoken recently
    if (text === this.lastCue && now - this.lastCueTime < this.cooldown) return;

    // Drop low-priority items when queue is full
    if (this.queue.length >= MAX_QUEUE) {
      if (pri <= PRIORITY.normal) return;
      // Remove lowest priority item from queue
      let minIdx = 0;
      for (let i = 1; i < this.queue.length; i++) {
        if (this.queue[i].priority < this.queue[minIdx].priority) minIdx = i;
      }
      if (this.queue[minIdx].priority < pri) {
        this.queue.splice(minIdx, 1);
      } else {
        return;
      }
    }

    this.queue.push({ text, priority: pri, time: now });
    this._processQueue();
  }

  /**
   * Interrupt current speech and speak immediately.
   * @param {string} text
   */
  speakImmediate(text) {
    if (!this.enabled || !this._isSupported() || this._disposed) return;
    if (!text) return;

    // Cancel everything
    speechSynthesis.cancel();
    this.queue.length = 0;
    this.speaking = false;

    this.lastCue = text;
    this.lastCueTime = Date.now();
    this._utterSpeak(text);
  }

  /**
   * Announce a completed rep.
   * @param {number} repNum
   */
  repComplete(repNum) {
    const cues = [`Rep ${repNum}`, `${repNum}, good`, `That's ${repNum}`];
    this.speak(cues[repNum % cues.length], 'normal');
  }

  /**
   * Announce a form warning.
   * @param {string} issue - Short description of the form issue
   */
  formWarning(issue) {
    // Keep it short: truncate to first sentence / 8 words max
    const short = (issue || 'Check your form').split('.')[0].split(' ').slice(0, 8).join(' ');
    this.speak(short, 'high');
  }

  /**
   * Announce a personal record.
   * @param {string} type - e.g. 'reps', 'weight', 'form'
   */
  prAchieved(type) {
    this.speakImmediate('New personal record!');
  }

  /**
   * Announce set completion.
   * @param {number} reps
   * @param {string} grade
   */
  setComplete(reps, grade) {
    const gradeWord = grade || '';
    this.speakImmediate(`Set complete. ${reps} reps, grade ${gradeWord}`);
  }

  enable() { this.enabled = true; }
  disable() { this.enabled = false; }
  toggle() { this.enabled = !this.enabled; return this.enabled; }

  /**
   * Enable heavy-set mode: suppresses all non-critical cues.
   * Use when target reps < 5 to avoid breaking concentration during max-effort sets.
   * @param {boolean} active
   */
  setHeavySetMode(active) { this._heavySetMode = !!active; }

  dispose() {
    this._disposed = true;
    this.queue.length = 0;
    if (this._isSupported()) {
      try { speechSynthesis.cancel(); } catch (_) {}
    }
    this.speaking = false;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  _isSupported() {
    return typeof window !== 'undefined' && typeof speechSynthesis !== 'undefined';
  }

  _processQueue() {
    if (this.speaking || this.queue.length === 0 || this._disposed) return;

    // Sort by priority descending, then by time ascending
    this.queue.sort((a, b) => b.priority - a.priority || a.time - b.time);

    const item = this.queue.shift();
    if (!item) return;

    // Check cooldown again (may have waited in queue)
    const now = Date.now();
    if (item.text === this.lastCue && now - this.lastCueTime < this.cooldown) {
      this._processQueue();
      return;
    }

    this.lastCue = item.text;
    this.lastCueTime = now;
    this._utterSpeak(item.text);
  }

  _utterSpeak(text) {
    if (!this._isSupported()) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1; // slightly faster than default
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    if (this._voice) {
      utterance.voice = this._voice;
    }

    this.speaking = true;

    utterance.onend = () => {
      this.speaking = false;
      if (!this._disposed) this._processQueue();
    };

    utterance.onerror = () => {
      this.speaking = false;
      if (!this._disposed) this._processQueue();
    };

    try {
      speechSynthesis.speak(utterance);
    } catch (_) {
      this.speaking = false;
    }
  }
}
