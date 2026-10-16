// The physiotherapist's programme and the patient's results travel in the link itself, as the coach's programme does
// (components/experience/programme.js): no server holds them. "#kine-p=<payload>" opens a programme on the patient's
// phone; "#kine-r=<payload>" opens a patient's results on the physiotherapist's. The payload is "z" and the gzip of
// the JSON in base64url (or "j" and the JSON when that is shorter). Status: convention.
import { gzipSync, gunzipSync } from 'fflate';
import { fromBase64url, toBase64url } from '../../components/experience/programme';
import { exerciseById } from './library';

export const PROGRAMME_KEY = 'kine-p=';
export const RESULT_KEY = 'kine-r=';
// A link longer than this is refused when read: a phone's address bar and a QR code both stop well before.
export const MAX_PAYLOAD = 12000;

// Control characters become spaces: a link's text is shown, never run.
const clip = (s, n) => [...String(s ?? '')].map(ch => (ch.charCodeAt(0) < 32 ? ' ' : ch)).join('').trim().slice(0, n);
const int = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi ? v : d);

export function pack(obj) {
  const json = new TextEncoder().encode(JSON.stringify(obj));
  const plain = 'j' + toBase64url(json), packed = 'z' + toBase64url(gzipSync(json, { level: 9 }));
  return packed.length < plain.length ? packed : plain;
}

export function unpack(payload) {
  try {
    if (typeof payload !== 'string' || payload.length < 2 || payload.length > MAX_PAYLOAD) return null;
    const bytes = fromBase64url(payload.slice(1));
    const json = payload[0] === 'z' ? gunzipSync(bytes) : payload[0] === 'j' ? bytes : null;
    if (!json || json.length > 64000) return null;
    return JSON.parse(new TextDecoder().decode(json));
  } catch {
    return null;
  }
}

/** A programme as the physiotherapist sets it, cleaned: unknown exercises and out-of-range numbers are dropped. */
export function cleanProgramme(p) {
  if (!p || typeof p !== 'object') return null;
  const items = (Array.isArray(p.items) ? p.items : []).map(it => {
    if (!exerciseById(it?.id)) return null;
    const item = { id: it.id, reps: int(it.reps, 1, 100, 10), sets: int(it.sets, 1, 20, 3), note: clip(it.note, 400) };
    // The treated side, for an exercise done with one arm (library.js `side`).
    if (exerciseById(it.id).side && (it.side === 'left' || it.side === 'right')) item.side = it.side;
    return item;
  }).filter(Boolean).slice(0, 20);
  if (!items.length) return null;
  return {
    v: 1,
    kine: { name: clip(p.kine?.name, 80), phone: clip(p.kine?.phone, 30), email: clip(p.kine?.email, 80) },
    patient: clip(p.patient, 60),
    perDay: int(p.perDay, 1, 6, 1),
    weeks: int(p.weeks, 1, 52, 4),
    note: clip(p.note, 600),
    items,
    date: clip(p.date, 10),
  };
}

export const programmeLink = (base, p) => `${String(base).split('#')[0]}#${PROGRAMME_KEY}${pack(cleanProgramme(p))}`;

/** A patient's result of one exercise, as sent back: the verdict and its figures, never a video or a skeleton. */
/** The result payload inside pasted text (a message may carry words, other links or '#' around it): its last one. */
export function resultPayload(text) {
  const all = [...String(text || '').matchAll(/kine-r=([A-Za-z0-9_-]+)/g)];
  return all.length ? all.at(-1)[1] : null;
}

// The measures a result may name (src/lib/reference/compare.js joints and the library's directions, either side): any
// other name in a link is dropped, so that it can never reach a lookup by name (a forged "__proto__").
export const MEASURES = Object.freeze(['leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftArm', 'rightArm', 'leftForearm', 'rightForearm']);
const share = (v, hi) => (Number.isFinite(v) ? Math.round(Math.min(hi, Math.max(0, v)) * 100) / 100 : null);

export function cleanResult(r) {
  if (!r || typeof r !== 'object' || !exerciseById(r.id)) return null;
  const verdicts = ['match', 'revise', 'refused'];
  const date = clip(r.date, 16);
  return {
    v: 1,
    id: r.id,
    patient: clip(r.patient, 60),
    kine: clip(r.kine, 80),
    // The patient's local time of the attempt, to the minute; anything else is no date.
    date: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date) && !Number.isNaN(new Date(date).getTime()) ? date : '',
    // The programme the attempt belongs to (KinePatient.jsx), so that two patients with no name stay apart.
    prog: /^[a-z0-9]{1,13}$/.test(r.prog ?? '') ? r.prog : '',
    verdict: verdicts.includes(r.verdict) ? r.verdict : 'refused',
    tempo: Number.isFinite(r.tempo) ? Math.round(r.tempo * 100) / 100 : null,
    joints: (Array.isArray(r.joints) ? r.joints : [])
      .filter((j, i, all) => MEASURES.includes(j?.name) && all.findIndex(x => x?.name === j.name) === i).slice(0, 4)
      .map(j => ({ name: j.name, within: share(j.within, 1), range: share(j.range, 10) })),
    holds: (Array.isArray(r.holds) ? r.holds : []).slice(0, 12).map(h => ({
      ref: Math.round(Number(h.ref) || 0), att: Math.round(Number(h.att) || 0),
      refSec: Math.round((Number(h.refSec) || 0) * 10) / 10, attSec: Math.round((Number(h.attSec) || 0) * 10) / 10,
      status: ['held', 'short', 'angle'].includes(h.status) ? h.status : 'angle',
    })),
  };
}

export const resultLink = (base, r) => `${String(base).split('#')[0]}#${RESULT_KEY}${pack(cleanResult(r))}`;

/** The payload of a hash for a key, or null. */
export function payloadAfter(hash, key) {
  const h = String(hash || '').replace(/^#\/?/, '');
  return h.startsWith(key) ? h.slice(key.length) : null;
}
