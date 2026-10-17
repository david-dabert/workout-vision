// The AI commentary on a patient's attempt (David, 17 October 2026: "Can we implement their API?"): what is asked of
// Elorian's model (Glimpse, elorian-1-agent) and what of its answer reaches the app. Pure functions, no network: the
// handlers (api/*.js) call them, the tests (commentary.test.js) pin them.
//
// The prompt is fixed here, on the server: the app sends only the exercise's own text (the physiotherapist's steps,
// dosage and holds, lib/kine/library.js) and the video, so the key cannot be used as a general-purpose model.
// The answer is read as JSON, cut to the fields and lengths below, and shown labelled as an AI's commentary, never as
// a measure of the app (R8, as amended by David's decision of 14 October: what the app does not measure is labelled).

export const MODEL = 'elorian-1-agent';
export const ELORIAN_URL = 'https://api.elorian.ai/v1/chat/completions';

// Limits on what the app may send (convention, UNSOURCED): enough for Olivier's longest exercise (nine steps).
const MAX_TITLE = 160, MAX_STEP = 400, MAX_STEPS = 16, MAX_HOLDS = 8;
// Limits on what reaches the app (convention, UNSOURCED): a screen and a page of the report.
const MAX_ITEMS = 6, MAX_ITEM = 300, MAX_SUMMARY = 700;

const str = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);

/** The exercise as the app sends it, or null when it is not one: { lang, title, position, steps[], reps, sets, holds[] }. */
export function cleanExercise(body) {
  if (!body || typeof body !== 'object') return null;
  const lang = body.lang === 'en' ? 'en' : 'fr';
  const title = str(body.title, MAX_TITLE);
  const steps = Array.isArray(body.steps) ? body.steps.slice(0, MAX_STEPS).map(s => str(s, MAX_STEP)).filter(Boolean) : [];
  if (!title || !steps.length) return null;
  const holds = Array.isArray(body.holds) ? body.holds.slice(0, MAX_HOLDS).map(h => int(h, 1, 120)).filter(h => h != null) : [];
  return { lang, title, position: str(body.position, MAX_STEP), steps, reps: int(body.reps, 1, 100), sets: int(body.sets, 1, 20), holds };
}

const SCHEMA = `{
  "visible": true or false (whether one person doing a movement is visible enough to comment on),
  "same_exercise": "yes", "partly" or "no" (whether the movement is the exercise described),
  "reps": a whole number of repetitions seen, or null when they cannot be counted,
  "holds": [{ "rep": whole number, "seconds": number }] (each position held still, and for how long),
  "compensations": [short sentences] (shoulder shrug, trunk lean or rotation, head lift, elbow bent when it should be straight, and similar),
  "setup": [short sentences] (the starting position and the support compared with the instructions),
  "camera": [short sentences] (what to change when filming, if anything prevents a clear view),
  "advice": [at most three short sentences] (what to change next time, in the words of the instructions),
  "summary": two or three sentences
}`;

/** The messages sent to the model for an exercise and the video's address. */
export function buildMessages(ex, videoUrl) {
  const fr = ex.lang === 'fr';
  const dosage = [ex.sets && `${ex.sets} sets`, ex.reps && `${ex.reps} repetitions`].filter(Boolean).join(' of ');
  const lines = [
    'You watch a patient doing a rehabilitation exercise prescribed by their physiotherapist, filmed on a phone.',
    'Describe only what the video shows. Do not diagnose, do not name a condition, do not judge pain, do not invent what you cannot see.',
    'When something cannot be seen clearly, say so instead of guessing.',
    `Write every sentence in ${fr ? 'French, as a French physiotherapist speaks to a patient, using "vous"' : 'English, as a physiotherapist speaks to a patient'}.`,
    '',
    `Exercise: ${ex.title}`,
    ex.position ? `Starting position: ${ex.position}` : null,
    'Steps, in the physiotherapist\'s words:',
    ...ex.steps.map((s, i) => `${i + 1}. ${s}`),
    dosage ? `Prescribed: ${dosage}.` : null,
    ex.holds.length ? `Positions to hold: ${ex.holds.map(s => `${s} s`).join(', ')}.` : null,
    '',
    'Answer with one JSON object and nothing else, of this form:',
    SCHEMA,
  ].filter(l => l != null);
  return [{ role: 'user', content: [{ type: 'text', text: lines.join('\n') }, { type: 'video_url', video_url: { url: videoUrl } }] }];
}

/** The request body sent to Elorian. */
export const requestBody = (ex, videoUrl) => ({ model: MODEL, messages: buildMessages(ex, videoUrl), max_completion_tokens: 8000, reasoning_effort: 'medium' });

/** The first JSON object in a text (the model may wrap it in a code fence or a sentence), or null. */
export function firstJson(text) {
  if (typeof text !== 'string') return null;
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) { try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; } }
  }
  return null;
}

const list = v => (Array.isArray(v) ? v.map(x => str(x, MAX_ITEM)).filter(Boolean).slice(0, MAX_ITEMS) : []);

/** What of the model's answer reaches the app, or null when the answer is not the JSON asked for. */
export function cleanCommentary(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const summary = str(raw.summary, MAX_SUMMARY);
  if (!summary) return null;
  const holds = Array.isArray(raw.holds)
    ? raw.holds.slice(0, 20).map(h => ({ rep: int(h?.rep, 1, 100), seconds: Number.isFinite(h?.seconds) && h.seconds >= 0 && h.seconds <= 600 ? Math.round(h.seconds * 10) / 10 : null })).filter(h => h.seconds != null)
    : [];
  return {
    visible: raw.visible !== false,
    sameExercise: ['yes', 'partly', 'no'].includes(raw.same_exercise) ? raw.same_exercise : null,
    reps: int(raw.reps, 0, 200),
    holds,
    compensations: list(raw.compensations),
    setup: list(raw.setup),
    camera: list(raw.camera),
    advice: list(raw.advice).slice(0, 3),
    summary,
  };
}

/** The commentary from Elorian's chat completion response, or null. */
export const commentaryOf = response => cleanCommentary(firstJson(response?.choices?.[0]?.message?.content));
