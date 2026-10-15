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
    return { id: it.id, reps: int(it.reps, 1, 100, 10), sets: int(it.sets, 1, 20, 3), note: clip(it.note, 400) };
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
export function cleanResult(r) {
  if (!r || typeof r !== 'object' || !exerciseById(r.id)) return null;
  const verdicts = ['match', 'revise', 'refused'];
  return {
    v: 1,
    id: r.id,
    patient: clip(r.patient, 60),
    kine: clip(r.kine, 80),
    date: clip(r.date, 16),
    verdict: verdicts.includes(r.verdict) ? r.verdict : 'refused',
    tempo: Number.isFinite(r.tempo) ? Math.round(r.tempo * 100) / 100 : null,
    joints: (Array.isArray(r.joints) ? r.joints : []).slice(0, 4).map(j => ({
      name: clip(j.name, 20),
      within: Number.isFinite(j.within) ? Math.round(j.within * 100) / 100 : null,
      range: Number.isFinite(j.range) ? Math.round(j.range * 100) / 100 : null,
    })),
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
