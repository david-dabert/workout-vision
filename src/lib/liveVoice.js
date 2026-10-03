// How a new rep is announced during a live set: a short vibration where the phone has one (navigator.vibrate; iPhone
// Safari has none), and the number spoken, in the app's language, when the person leaves the voice on.
//
// Privacy: only a voice that runs on the phone is used (SpeechSynthesisVoice.localService). Some browsers offer voices
// that are synthesised on a server (Chrome's "Google" voices); the number would then leave the phone, so those are
// never chosen, and where the phone has no voice of its own the number is not spoken at all.

/** The vibration for a rep, in ms. Status: convention (UNSOURCED): short enough to feel as a tap, not an alert. */
export const REP_BUZZ_MS = 40;

const VOICE_KEY = 'wv_live_voice';

/** The person's choice for the spoken count on this phone: on unless turned off. A convenience; nothing is sent. */
export function voiceWanted() {
  try { return globalThis.localStorage?.getItem(VOICE_KEY) !== 'off'; } catch { return true; }
}
export function setVoiceWanted(on) {
  try { if (on) globalThis.localStorage?.removeItem(VOICE_KEY); else globalThis.localStorage?.setItem(VOICE_KEY, 'off'); } catch { /* holds for this visit */ }
}

/** The phone's own voice for `lang` ('fr' or 'en'), or null: never a voice synthesised on a server. */
export function localVoice(lang, synth = globalThis.speechSynthesis) {
  let voices = [];
  try { voices = synth?.getVoices?.() || []; } catch { return null; }
  const mine = voices.filter(v => v.localService === true && String(v.lang || '').toLowerCase().replace('_', '-').startsWith(lang));
  return mine.find(v => v.default) || mine[0] || null;
}

/** True where a number can be spoken on the phone in `lang`. Voices may arrive late: ask again on voiceschanged. */
export const canSpeak = (lang, synth = globalThis.speechSynthesis) => !!localVoice(lang, synth);

/**
 * The speech engine of iPhone Safari speaks only once a tap has started it: an empty utterance, spoken inside the
 * tap that starts the set, opens it for the numbers that follow.
 */
export function unlockSpeech(lang, synth = globalThis.speechSynthesis) {
  const voice = localVoice(lang, synth);
  if (!voice || typeof SpeechSynthesisUtterance !== 'function') return;
  try { const u = new SpeechSynthesisUtterance(''); u.voice = voice; u.volume = 0; synth.speak(u); } catch { /* no speech */ }
}

/** Says `text` with the phone's own voice, cutting off anything still being said. Returns false when it cannot. */
export function say(text, lang, synth = globalThis.speechSynthesis) {
  const voice = localVoice(lang, synth);
  if (!voice || typeof SpeechSynthesisUtterance !== 'function') return false;
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.voice = voice; u.lang = voice.lang; u.rate = 1.05;
    synth.speak(u);
    return true;
  } catch { return false; }
}

/** A short vibration, where the phone can. */
export function buzz(ms = REP_BUZZ_MS, nav = globalThis.navigator) {
  try { if (typeof nav?.vibrate === 'function') nav.vibrate(ms); } catch { /* no vibration */ }
}

/** Stops anything being said (leaving the screen). */
export function hush(synth = globalThis.speechSynthesis) {
  try { synth?.cancel?.(); } catch { /* nothing to stop */ }
}
