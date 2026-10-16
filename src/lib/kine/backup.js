// The physiotherapist's backup: what the physiotherapist module keeps on the phone (the practice, the invoice
// sequence, the follow-up, the calibration trials and the patient-side attempts, each a localStorage key starting with
// wv_kine_) in one file, encrypted with a password he chooses, to keep on his own computer or a USB key. No host is
// involved: health data stored online must be held by a certified host (HDS, Code de la santé publique L.1111-8,
// certification since décret 2018-137), which this app has none of (decision of 16 October 2026, issue #190).
//
// Encryption: AES-GCM 256 with a key derived from the password by PBKDF2-SHA-256, a random salt and IV per file.
// Source: OWASP Password Storage Cheat Sheet (PBKDF2-HMAC-SHA256, 600,000 iterations). Status: literature.
// Restoring checks every value against what the module's readers expect, merges with what the phone holds and never
// deletes (restore): lists joined without duplicates (by the follow-up's own rule) within the module's limits, the
// invoice sequence keeps the higher number, the practice's empty fields filled. Written all at once, or not at all.

import { cleanResult } from './links';
import { EMPTY_PROFILE, MAX_RESULTS, resultKey } from './store';

export const PREFIX = 'wv_kine_';
const RESULTS = 'wv_kine_results', CALIBRATION = 'wv_kine_calibration', PROFILE = 'wv_kine_profile', INVOICE_SEQ = 'wv_kine_invoice_seq', ATTEMPTS = 'wv_kine_attempts';
// The most calibration trials kept (calibration.js). Status: convention.
const MAX_TRIALS = 2000;
export const ITERATIONS = 600000;
// Iteration counts accepted when opening a file: around ours, so a forged file cannot hang the phone for minutes.
// Status: convention.
const MIN_ITERATIONS = 100000, MAX_ITERATIONS = 2000000;
// A backup file larger than this is not opened (1000 results and 2000 trials stay far below). Status: convention.
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
// The shortest password accepted. Source: NIST SP 800-63B (memorized secrets of at least 8 characters).
// Status: literature.
export const MIN_PASSWORD = 8;
const KIND = 'workout-vision kine backup';
const LAST = 'wv_kine_last_backup';

const b64 = bytes => {
  const u = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = text => Uint8Array.from(atob(text), ch => ch.charCodeAt(0));

async function keyFrom(password, salt, iterations) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** What the module keeps on this phone: { key: parsed value } for every wv_kine_ key (the backup's own date aside). */
export function collect(storage = localStorage) {
  const out = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(PREFIX) || key === LAST) continue;
    try { out[key] = JSON.parse(storage.getItem(key)); } catch { /* not ours to read */ }
  }
  return out;
}

/** The encrypted backup file's text. */
export async function makeBackup(password, { storage = localStorage, now = new Date() } = {}) {
  if (String(password).length < MIN_PASSWORD) throw new Error('password-short');
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(password, salt, ITERATIONS);
  const plain = new TextEncoder().encode(JSON.stringify({ made: now.toISOString(), data: collect(storage) }));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  return JSON.stringify({ kind: KIND, v: 1, kdf: 'PBKDF2-SHA-256', iterations: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(cipher) });
}

/** The backup's content; throws 'not-backup' for another file, 'wrong-password' when it does not open. */
export async function openBackup(text, password) {
  if (typeof text !== 'string' || text.length > MAX_FILE_BYTES * 1.4) throw new Error('not-backup');
  let f;
  try { f = JSON.parse(text); } catch { throw new Error('not-backup'); }
  if (f?.kind !== KIND || f.v !== 1) throw new Error('not-backup');
  const iterations = Number.isInteger(f.iterations) && f.iterations >= MIN_ITERATIONS && f.iterations <= MAX_ITERATIONS ? f.iterations : null;
  if (!iterations) throw new Error('not-backup');
  try {
    const key = await keyFrom(password, unb64(f.salt), iterations);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(f.iv) }, key, unb64(f.data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch { throw new Error('wrong-password'); }
}

// What each key of the module holds, as its readers expect it (store.js, calibration.js); a value that is not so is
// left out of the restore. The calibration trials are checked as calibration.js reads them.
const isObject = v => v != null && typeof v === 'object' && !Array.isArray(v);
const validTrial = t => isObject(t) && t.v === 1 && typeof t.exercise === 'string' && Array.isArray(t.joints) && (t.label === 'match' || t.label === 'revise');
const byDate = (a, b) => String(a.date ?? '').localeCompare(String(b.date ?? ''));

/**
 * Joins two lists without duplicates (by `key`), within `max`: what the phone holds is always kept; the backup's
 * entries fill the room left, the newest first. Returns { list, added, dropped } (dropped: backup entries left out).
 */
function join(current, incoming, key, max) {
  const have = new Set(current.map(key));
  const fresh = incoming.filter(x => { const k = key(x); if (have.has(k)) return false; have.add(k); return true; });
  const room = Math.max(0, max - current.length);
  const taken = [...fresh].sort(byDate).slice(Math.max(0, fresh.length - room));
  return { list: [...current, ...taken].sort(byDate), added: taken.length, dropped: fresh.length - taken.length };
}

/**
 * Merges a backup's data into the phone. Returns { ok, added, filled, dropped, skipped }: entries added to lists,
 * practice fields filled, oldest entries left out at the module's limits, values left out as not what the module
 * reads. ok is false when the storage refuses; then nothing was written.
 */
export function restore(data, storage = localStorage) {
  const report = { ok: true, added: 0, filled: 0, dropped: 0, skipped: 0 };
  const now = key => { try { return JSON.parse(storage.getItem(key)); } catch { return null; } };
  const next = {};
  for (const [key, value] of Object.entries(isObject(data) ? data : {})) {
    if (!key.startsWith(PREFIX) || key === LAST) continue;
    if (key === RESULTS) {
      const incoming = Array.isArray(value) ? value.map(cleanResult).filter(Boolean) : [];
      report.skipped += (Array.isArray(value) ? value.length : 1) - incoming.length;
      const current = (Array.isArray(now(key)) ? now(key) : []).map(cleanResult).filter(Boolean);
      const j = join(current, incoming, resultKey, MAX_RESULTS);
      if (j.added) next[key] = j.list;
      report.added += j.added; report.dropped += j.dropped;
    } else if (key === CALIBRATION) {
      const incoming = Array.isArray(value) ? value.filter(validTrial) : [];
      report.skipped += (Array.isArray(value) ? value.length : 1) - incoming.length;
      const current = Array.isArray(now(key)) ? now(key).filter(validTrial) : [];
      const j = join(current, incoming, t => JSON.stringify(t), MAX_TRIALS);
      if (j.added) next[key] = j.list;
      report.added += j.added; report.dropped += j.dropped;
    } else if (key === PROFILE) {
      if (!isObject(value)) { report.skipped++; continue; }
      const current = isObject(now(key)) ? now(key) : {};
      const merged = { ...current };
      for (const [field, empty] of Object.entries(EMPTY_PROFILE)) {
        const v = value[field];
        if (typeof v !== typeof empty) continue;
        const missing = current[field] == null || current[field] === '' || current[field] === 0;
        if (missing && v !== '' && v !== 0) { merged[field] = v; report.filled++; }
      }
      if (report.filled) next[key] = merged;
    } else if (key === INVOICE_SEQ) {
      const ok = v => isObject(v) && Number.isInteger(v.year) && Number.isInteger(v.n) && v.n >= 0;
      if (!ok(value)) { report.skipped++; continue; }
      const current = ok(now(key)) ? now(key) : null;
      if (!current || value.year > current.year || (value.year === current.year && value.n > current.n)) next[key] = value;
    } else if (key === ATTEMPTS) {
      if (!isObject(value)) { report.skipped++; continue; }
      const current = isObject(now(key)) ? now(key) : {};
      const merged = { ...current };
      for (const [prog, list] of Object.entries(value)) {
        if (!/^[a-z0-9]{1,13}$/.test(prog) || !Array.isArray(list)) { report.skipped++; continue; }
        const j = join(Array.isArray(current[prog]) ? current[prog] : [], list.filter(isObject), x => JSON.stringify(x), 200);
        if (j.added) { merged[prog] = j.list; report.added += j.added; next[key] = merged; }
      }
    } else {
      report.skipped++;
    }
  }
  // All at once: the previous values come back if any write is refused.
  const before = Object.fromEntries(Object.keys(next).map(k => [k, storage.getItem(k)]));
  try {
    for (const [k, v] of Object.entries(next)) storage.setItem(k, JSON.stringify(v));
  } catch {
    for (const [k, v] of Object.entries(before)) { try { if (v == null) storage.removeItem(k); else storage.setItem(k, v); } catch { /* as it was as far as it goes */ } }
    return { ...report, ok: false, added: 0, filled: 0, dropped: 0 };
  }
  return report;
}

export const markBackedUp = (now = new Date()) => { try { localStorage.setItem(LAST, JSON.stringify(now.toISOString())); } catch { /* blocked */ } };
export const lastBackup = () => { try { return JSON.parse(localStorage.getItem(LAST) || 'null'); } catch { return null; } };
