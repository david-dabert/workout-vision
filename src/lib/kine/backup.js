// The physiotherapist's backup: everything the physiotherapist module keeps on the phone (localStorage keys starting
// with wv_kine_: the practice, the invoice sequence, the follow-up, the calibration trials) in one file, encrypted with
// a password he chooses, to keep on his own computer or a USB key. No host is involved: health data stored online
// must be held by a certified host (HDS, Code de la santé publique L.1111-8), which this app has none of (decision of
// 16 October 2026, issue #190).
//
// Encryption: AES-GCM 256 with a key derived from the password by PBKDF2-SHA-256, a random salt and IV per file.
// Source: OWASP Password Storage Cheat Sheet (PBKDF2-HMAC-SHA256, 600,000 iterations). Status: literature.
// Restoring merges with what the phone holds and never deletes: lists are joined without duplicates, the invoice
// sequence keeps the higher number (no invoice number is given twice), anything else on the phone is kept as it is.

export const PREFIX = 'wv_kine_';
export const ITERATIONS = 600000;
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
  let f;
  try { f = JSON.parse(text); } catch { throw new Error('not-backup'); }
  if (f?.kind !== KIND || f.v !== 1) throw new Error('not-backup');
  const iterations = Number.isInteger(f.iterations) && f.iterations >= 100000 && f.iterations <= 10000000 ? f.iterations : null;
  if (!iterations) throw new Error('not-backup');
  try {
    const key = await keyFrom(password, unb64(f.salt), iterations);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(f.iv) }, key, unb64(f.data));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch { throw new Error('wrong-password'); }
}

/** Merges a backup's data into the phone; returns how many list entries were added, or false when storage refuses. */
export function restore(data, storage = localStorage) {
  let added = 0;
  try {
    for (const [key, value] of Object.entries(data || {})) {
      if (!key.startsWith(PREFIX) || key === LAST) continue;
      let current = null;
      try { current = JSON.parse(storage.getItem(key)); } catch { current = null; }
      let next = current;
      if (Array.isArray(value)) {
        const have = new Set((Array.isArray(current) ? current : []).map(x => JSON.stringify(x)));
        const fresh = value.filter(x => !have.has(JSON.stringify(x)));
        added += fresh.length;
        next = [...(Array.isArray(current) ? current : []), ...fresh];
      } else if (key === `${PREFIX}invoice_seq`) {
        const a = current || { year: 0, n: 0 }, b = value || { year: 0, n: 0 };
        next = a.year > b.year || (a.year === b.year && a.n >= b.n) ? a : b;
      } else if (current == null) {
        next = value;
      }
      if (next !== current) storage.setItem(key, JSON.stringify(next));
    }
    return added;
  } catch { return false; }
}

export const markBackedUp = (now = new Date()) => { try { localStorage.setItem(LAST, JSON.stringify(now.toISOString())); } catch { /* blocked */ } };
export const lastBackup = () => { try { return JSON.parse(localStorage.getItem(LAST) || 'null'); } catch { return null; } };
