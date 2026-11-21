// What stays on the physiotherapist's and the patient's phones (IndexedDB kineStore via storage.js, Card 059): the
// practitioner's identity for documents, invoice number, attempts, and received results. Synchronous in-memory cache
// backs instant UI access without blocking renders; writes persist to IndexedDB; legacy localStorage migrated and cleared.
import { cleanResult } from './links';
import { kineStore } from '../storage';

const PROFILE = 'wv_kine_profile', INVOICE_SEQ = 'wv_kine_invoice_seq', ATTEMPTS = 'wv_kine_attempts', RESULTS = 'wv_kine_results', LABELS = 'wv_kine_labels';

const KEY_MAP = {
  [PROFILE]: 'profile',
  [INVOICE_SEQ]: 'invoice_seq',
  [ATTEMPTS]: 'attempts',
  [RESULTS]: 'results',
  [LABELS]: 'labels',
};

// In-memory cache holding current values for synchronous screen access
export const memoryCache = new Map();

export function syncKineCache(key, value) {
  const storeKey = KEY_MAP[key] || key;
  memoryCache.set(storeKey, value);
}

// Helper to asynchronously sync memoryCache with kineStore and migrate from localStorage if present
let initPromise = null;
export async function initKineStore(force = false) {
  if (initPromise && !force) return initPromise;
  return (initPromise = (async () => {
    // 1. Check legacy localStorage keys and migrate into kineStore
    if (typeof localStorage !== 'undefined') {
      for (const [lsKey, storeKey] of Object.entries(KEY_MAP)) {
        try {
          const item = localStorage.getItem(lsKey);
          if (item) {
            const parsed = JSON.parse(item);
            await kineStore.setItem(storeKey, parsed);
            memoryCache.set(storeKey, parsed);
            localStorage.removeItem(lsKey);
          }
        } catch { /* ignore */ }
      }
    }
    // 2. Load whatever is in kineStore into memoryCache
    for (const storeKey of Object.values(KEY_MAP)) {
      try {
        const val = await kineStore.getItem(storeKey);
        if (val !== null && val !== undefined) {
          memoryCache.set(storeKey, val);
        }
      } catch { /* ignore */ }
    }
  })());
}

// Eagerly initiate store synchronization
if (typeof window !== 'undefined' || typeof globalThis !== 'undefined') {
  initKineStore().catch(() => {});
}

const read = (key, fallback) => {
  const storeKey = KEY_MAP[key] || key;
  if (memoryCache.has(storeKey)) {
    return memoryCache.get(storeKey);
  }
  // If memory cache is cold, check localStorage for backward compatibility or during migration
  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(key);
      if (v) {
        const parsed = JSON.parse(v);
        memoryCache.set(storeKey, parsed);
        kineStore.setItem(storeKey, parsed).catch(() => {});
        localStorage.removeItem(key);
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return fallback;
};

/** Writes a value; persists to memoryCache synchronously and kineStore in IndexedDB asynchronously. */
const write = (key, value) => {
  const storeKey = KEY_MAP[key] || key;
  try {
    // Check if storage is blocked or full (e.g. QuotaExceededError or private browsing)
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      try {
        localStorage.setItem('__wv_storage_check__', '1');
        localStorage.removeItem('__wv_storage_check__');
      } catch {
        return false;
      }
    }
    memoryCache.set(storeKey, value);
    kineStore.setItem(storeKey, value).catch(e => {
      console.warn('[KineStore] Failed to persist to IndexedDB:', storeKey, e);
    });
    if (typeof localStorage !== 'undefined') {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
    }
    return true;
  } catch {
    return false;
  }
};

export const EMPTY_PROFILE = Object.freeze({ name: '', title: 'Masseur-kinésithérapeute', address: '', phone: '', email: '', rpps: '', siret: '', fee: 0 });
export const readProfile = () => ({ ...EMPTY_PROFILE, ...read(PROFILE, {}) });
export const saveProfile = p => write(PROFILE, p);

/**
 * The physiotherapist's own label for a programme's patient, kept on this phone only (never in the #kine-p or #kine-r
 * links). Keyed by the FNV-1a hash of the #kine-p payload (`programmeId`).
 */
export function savePatientLabel(programmeId, label) {
  const id = String(programmeId || '').trim();
  const clean = String(label || '').trim().slice(0, 60);
  if (!id) return false;
  const all = read(LABELS, {});
  if (!clean) {
    delete all[id];
  } else {
    all[id] = clean;
  }
  return write(LABELS, all);
}

export const patientLabel = programmeId => {
  const id = String(programmeId || '').trim();
  return id ? String(read(LABELS, {})[id] || '').trim() : '';
};

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
/** Replaces the report of the attempt logged at `date` (an AI commentary added after it was logged, KinePatient.jsx). */
export function updateAttemptReport(programmeId, date, report) {
  const all = read(ATTEMPTS, {});
  const list = all[programmeId] || [];
  const i = list.findIndex(e => e.date === date);
  if (i < 0) return false;
  list[i] = { ...list[i], report };
  all[programmeId] = list;
  return write(ATTEMPTS, all);
}

// The follow-up: every result the physiotherapist opens (#kine-r=, KineResult.jsx) or pastes, kept once, the last 1000.
// The same result twice: the same patient, exercise, minute, verdict and figures.
export const resultKey = r => JSON.stringify([patientKey(r), r.id, r.date, r.verdict, r.joints, r.holds]);
// The most results the follow-up keeps (the oldest go first).
export const MAX_RESULTS = 1000;
/**
 * The key a patient's results are grouped under: the name kept on this phone for the programme (or the name an older
 * link carried), without case or outer spaces; a result with no name, by its programme (two unnamed patients stay apart).
 */
export const patientKey = r => {
  const local = r?.prog ? patientLabel(r.prog) : '';
  const name = String(r?.patient || local || '').trim().toLowerCase();
  return name || (r?.prog ? `#${r.prog}` : '');
};

/** Keeps a received result: 'kept', 'already' (kept before), 'failed' (storage blocked or full) or 'invalid'. */
export function keepResult(result) {
  const r = cleanResult(result);
  if (!r) return 'invalid';
  if (!r.patient && r.prog) {
    const local = patientLabel(r.prog);
    if (local) r.patient = local;
  }
  const all = read(RESULTS, []);
  if (all.some(x => resultKey(x) === resultKey(r))) return 'already';
  return write(RESULTS, [...all, r].slice(-MAX_RESULTS)) ? 'kept' : 'failed';
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

export const readResults = () => {
  const list = read(RESULTS, []);
  return (Array.isArray(list) ? list : []).map(cleanResult).filter(Boolean);
};

/** Removes one patient's results from this phone. */
export function forgetPatient(key) {
  const list = read(RESULTS, []);
  write(RESULTS, (Array.isArray(list) ? list : []).filter(r => patientKey(r) !== key));
}

/**
 * The results grouped for the follow-up: patients, the most recently active first, each with its exercises and their
 * sessions in date order: [{ key, name, last, count, exercises: [{ id, sessions }] }].
 */
export function followUp(results = readResults()) {
  const byPatient = new Map();
  for (const r of results) {
    const key = patientKey(r);
    const displayName = (r.patient || (r.prog ? patientLabel(r.prog) : '')).trim();
    if (!byPatient.has(key)) byPatient.set(key, { key, name: displayName, last: '', count: 0, byExercise: new Map() });
    const p = byPatient.get(key);
    p.count++;
    if (r.date > p.last) { p.last = r.date; p.name = displayName || p.name; }
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
