// What stays on the physiotherapist's and the patient's phones (localStorage): the practitioner's identity for the
// documents, the next invoice number, the patient's attempts, and the results the physiotherapist received (the
// follow-up). Every read and write survives a blocked storage
// (private browsing): the screens work, and simply forget. Status: convention.
import { cleanResult } from './links';

const PROFILE = 'wv_kine_profile', INVOICE_SEQ = 'wv_kine_invoice_seq', ATTEMPTS = 'wv_kine_attempts', RESULTS = 'wv_kine_results';

const read = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
/** Writes a value; false when the storage is blocked or full. */
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };

export const EMPTY_PROFILE = Object.freeze({ name: '', title: 'Masseur-kinésithérapeute', address: '', phone: '', email: '', rpps: '', siret: '', fee: 0 });
export const readProfile = () => ({ ...EMPTY_PROFILE, ...read(PROFILE, {}) });
export const saveProfile = p => write(PROFILE, p);

/** The next invoice number, year and sequence ("2026-0007"); the sequence restarts each year. */
export function nextInvoiceNumber(now = new Date()) {
  const year = now.getFullYear();
  const seq = read(INVOICE_SEQ, { year, n: 0 });
  const n = seq.year === year ? seq.n + 1 : 1;
  write(INVOICE_SEQ, { year, n });
  return `${year}-${String(n).padStart(4, '0')}`;
}

/** The patient's attempts of a programme's exercises: { [programmeId]: [{ id, date, verdict }] }, the last 200. */
export function logAttempt(programmeId, entry) {
  const all = read(ATTEMPTS, {});
  all[programmeId] = [...(all[programmeId] || []), entry].slice(-200);
  write(ATTEMPTS, all);
}
export const attemptsOf = programmeId => read(ATTEMPTS, {})[programmeId] || [];

// The follow-up: every result the physiotherapist opens (#kine-r=, KineResult.jsx) or pastes, kept once, the last 1000.
// The same result twice: the same patient, exercise, minute, verdict and figures.
const resultKey = r => JSON.stringify([patientKey(r), r.id, r.date, r.verdict, r.joints, r.holds]);
/**
 * The key a patient's results are grouped under: the name as the programme gave it, without case or outer spaces; a
 * result with no name, by its programme (two unnamed patients stay apart). Two patients given the same name in their
 * programmes are one to this phone: the name is the physiotherapist's to make distinct.
 */
export const patientKey = r => {
  const name = String(r?.patient || '').trim().toLowerCase();
  return name || (r?.prog ? `#${r.prog}` : '');
};

/** Keeps a received result: 'kept', 'already' (kept before), 'failed' (storage blocked or full) or 'invalid'. */
export function keepResult(result) {
  const r = cleanResult(result);
  if (!r) return 'invalid';
  const all = read(RESULTS, []);
  if (all.some(x => resultKey(x) === resultKey(r))) return 'already';
  return write(RESULTS, [...all, r].slice(-1000)) ? 'kept' : 'failed';
}

/** Whether a result is already kept. */
export const hasResult = result => { const r = cleanResult(result); return !!r && read(RESULTS, []).some(x => resultKey(x) === resultKey(r)); };

// A result opened on this phone (KineResult.jsx) asks the workspace to open on its patient's follow-up: the patient's
// key, in sessionStorage, read once.
const OPEN_FOLLOW_UP = 'wv_kine_open_follow_up';
export function requestFollowUp(key) {
  try { sessionStorage.setItem(OPEN_FOLLOW_UP, key); } catch { /* blocked: the workspace opens on its first tab */ }
}
export function takeFollowUpRequest() {
  try {
    const v = sessionStorage.getItem(OPEN_FOLLOW_UP);
    sessionStorage.removeItem(OPEN_FOLLOW_UP);
    return v;
  } catch { return null; }
}

export const readResults = () => read(RESULTS, []).map(cleanResult).filter(Boolean);

/** Removes one patient's results from this phone. */
export function forgetPatient(key) {
  write(RESULTS, read(RESULTS, []).filter(r => patientKey(r) !== key));
}

/**
 * The results grouped for the follow-up: patients, the most recently active first, each with its exercises and their
 * sessions in date order: [{ key, name, last, count, exercises: [{ id, sessions }] }].
 */
export function followUp(results = readResults()) {
  const byPatient = new Map();
  for (const r of results) {
    const key = patientKey(r);
    if (!byPatient.has(key)) byPatient.set(key, { key, name: r.patient.trim(), last: '', count: 0, byExercise: new Map() });
    const p = byPatient.get(key);
    p.count++;
    if (r.date > p.last) { p.last = r.date; p.name = r.patient.trim() || p.name; }
    if (!p.byExercise.has(r.id)) p.byExercise.set(r.id, []);
    p.byExercise.get(r.id).push(r);
  }
  return [...byPatient.values()]
    .map(({ byExercise, ...p }) => ({
      ...p,
      exercises: [...byExercise.entries()].map(([id, sessions]) => ({ id, sessions: sessions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) })),
    }))
    .sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : 0));
}

/** The lowest share within tolerance of a session's measures: the measure furthest from the reference sets it. */
export const sessionWithin = r => {
  const w = r.joints.map(j => j.within).filter(x => x != null);
  return w.length ? Math.min(...w) : null;
};
