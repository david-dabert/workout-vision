// The coach's programme (Espace pro, 6 October 2026): what it holds, how it travels in a link, and how the sets the
// client films are read against it. No server, no account: the programme lives on the coach's phone, then in the
// link's hash (the part of an address a browser never sends), then on the client's phone. Pure: no DOM, no storage.
import { isOffered } from '../../lib/offer';
import { isTest } from '../../lib/fitness-tests';

const NBSP = ' ';

// Bounds of a programme. The numbers are a coach's ordinary ranges, not a prescription (status: convention, UNSOURCED;
// R9): from one to ten sets, one to a hundred reps, a rest of up to ten minutes. A link outside them is refused, never
// stretched to fit.
export const LIMITS = Object.freeze({
  title: 80, who: 60, note: 600, itemNote: 140, items: 24,
  sets: [1, 10], reps: [1, 100], rest: [0, 600],
});
// A new exercise starts at three sets of ten with 90 s of rest (convention, UNSOURCED; R9): the coach changes them.
export const DEFAULT_ITEM = Object.freeze({ sets: 3, reps: 10, rest: 90, note: '' });

// The longest link payload read (characters after "#programme="), and the most text it may unpack to: a programme at
// every limit packs to about 4 kB of JSON; anything far beyond is not a programme, and a small packed payload that
// would unpack to megabytes is stopped as it unpacks.
export const MAX_PAYLOAD = 8000;
export const MAX_JSON = 16384;
export const HASH_KEY = 'programme=';

// Text as typed, made safe to keep: Unicode composed, control characters out (a line break kept in notes), spaces
// trimmed. Content is only ever shown as text (React escapes it): nothing in a programme is run or parsed as markup.
export function cleanText(s, { lines = false } = {}) {
  let t = String(s ?? '').normalize('NFC').replace(/\r\n?/g, '\n');
  // oxlint-disable-next-line no-control-regex -- the control characters are what is removed
  t = lines ? t.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '') : t.replace(/[\u0000-\u001F\u007F]+/g, ' ');
  t = lines ? t.split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n') : t.replace(/\s+/g, ' ');
  return t.trim();
}

/** Whether the builder offers this exercise: every exercise the app counts, but the two fitness tests (a protocol of their own). */
export const programmable = key => typeof key === 'string' && /^[a-z0-9_]{1,64}$/.test(key) && isOffered(key) && !isTest(key);

const intIn = (v, [lo, hi]) => Number.isInteger(v) && v >= lo && v <= hi;
const clampInt = (v, [lo, hi], fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

/** A draft's item, its numbers brought into bounds (the builder's fields, on leaving them). */
export function fixItem(item) {
  return {
    key: item.key,
    sets: clampInt(item.sets, LIMITS.sets, DEFAULT_ITEM.sets),
    reps: clampInt(item.reps, LIMITS.reps, DEFAULT_ITEM.reps),
    rest: clampInt(item.rest, LIMITS.rest, DEFAULT_ITEM.rest),
    note: cleanText(item.note).slice(0, LIMITS.itemNote),
  };
}

/** A draft as the outputs take it: { title, who, note, items }, or null while it has no title or no exercise. */
export function programmeOf(draft) {
  const title = cleanText(draft?.title).slice(0, LIMITS.title);
  const items = (draft?.items || []).filter(i => programmable(i.key)).slice(0, LIMITS.items).map(fixItem);
  if (!title || !items.length) return null;
  return { title, who: cleanText(draft.who).slice(0, LIMITS.who), note: cleanText(draft.note, { lines: true }).slice(0, LIMITS.note), items };
}

// The compact form the link carries: { v: 1, t, w?, n?, x: [[key, sets, reps, rest, note?], ...] }.
export function compact(p) {
  const out = { v: 1, t: p.title };
  if (p.who) out.w = p.who;
  if (p.note) out.n = p.note;
  out.x = p.items.map(i => (i.note ? [i.key, i.sets, i.reps, i.rest, i.note] : [i.key, i.sets, i.reps, i.rest]));
  return out;
}

/**
 * The compact form read back, every field checked: { ok: true, programme } or { ok: false, error }, error among
 * 'malformed' (not a programme of this app), 'unknown-exercise' (an exercise this version does not count),
 * 'bad-value' (a number or a text out of bounds).
 */
export function fromCompact(raw) {
  const bad = error => ({ ok: false, error });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.v !== 1) return bad('malformed');
  const str = (v, max, opts) => {
    if (v === undefined) return '';
    if (typeof v !== 'string') return null;
    const t = cleanText(v, opts);
    return t.length <= max ? t : null;
  };
  const title = str(raw.t, LIMITS.title), who = str(raw.w, LIMITS.who), note = str(raw.n, LIMITS.note, { lines: true });
  if (title === null || who === null || note === null) return bad('bad-value');
  if (!title) return bad('malformed');
  if (!Array.isArray(raw.x) || raw.x.length < 1 || raw.x.length > LIMITS.items) return bad('malformed');
  const items = [];
  for (const x of raw.x) {
    if (!Array.isArray(x) || x.length < 4 || x.length > 5 || typeof x[0] !== 'string') return bad('malformed');
    const [key, sets, reps, rest, n] = x;
    if (!/^[a-z0-9_]{1,64}$/.test(key)) return bad('malformed');
    if (!programmable(key)) return bad('unknown-exercise');
    if (!intIn(sets, LIMITS.sets) || !intIn(reps, LIMITS.reps) || !intIn(rest, LIMITS.rest)) return bad('bad-value');
    const itemNote = str(n, LIMITS.itemNote);
    if (itemNote === null) return bad('bad-value');
    items.push({ key, sets, reps, rest, note: itemNote });
  }
  return { ok: true, programme: { title, who, note, items } };
}

// Base64url, as a URL carries it without escaping (RFC 4648, section 5), with no padding.
export function toBase64url(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function fromBase64url(text) {
  const s = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const canGzip = () => typeof CompressionStream === 'function';
const canGunzip = () => typeof DecompressionStream === 'function';

async function gzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
// Unpacked piece by piece, and stopped once past `max` bytes: a payload made to unpack to megabytes stops there.
async function gunzip(bytes, max) {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) { reader.cancel().catch(() => {}); return null; }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

/**
 * The programme as the link's payload: "z" and the gzip of its compact JSON in base64url where the browser can pack
 * it (CompressionStream: Safari 16.4, Chrome 80), else, or when packing does not make it shorter, "j" and the JSON
 * itself in base64url. gzip: false forces the plain form.
 */
export async function encodeProgramme(p, { gzip: pack = true } = {}) {
  const bytes = new TextEncoder().encode(JSON.stringify(compact(p)));
  const plain = 'j' + toBase64url(bytes);
  if (!pack || !canGzip()) return plain;
  try {
    const packed = 'z' + toBase64url(await gzip(bytes));
    return packed.length < plain.length ? packed : plain;
  } catch { return plain; }
}

/**
 * A payload read back, never trusted: { ok: true, programme } or { ok: false, error }, error among 'empty',
 * 'too-long', 'malformed', 'unsupported' (a packed link on a browser that cannot unpack it), 'unknown-exercise',
 * 'bad-value'. Never throws.
 */
export async function decodeProgramme(payload) {
  if (typeof payload !== 'string' || !payload) return { ok: false, error: 'empty' };
  if (payload.length > MAX_PAYLOAD) return { ok: false, error: 'too-long' };
  if (!/^[zj][A-Za-z0-9_-]+$/.test(payload)) return { ok: false, error: 'malformed' };
  try {
    let bytes = fromBase64url(payload.slice(1));
    if (payload[0] === 'z') {
      if (!canGunzip()) return { ok: false, error: 'unsupported' };
      bytes = await gunzip(bytes, MAX_JSON);
      if (!bytes) return { ok: false, error: 'too-long' };
    } else if (bytes.length > MAX_JSON) return { ok: false, error: 'too-long' };
    const raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return fromCompact(raw);
  } catch { return { ok: false, error: 'malformed' }; }
}

/** The payload of an address's hash, "#programme=…", or null when the hash holds no programme. */
export function payloadOf(hash) {
  const h = String(hash || '').replace(/^#\/?/, '');
  return h.startsWith(HASH_KEY) ? h.slice(HASH_KEY.length) : null;
}

/** The link that opens the programme in the app: the app's own address, the payload in its hash. */
export const programmeLink = (base, payload) => `${String(base).split('#')[0]}#${HASH_KEY}${payload}`;

/**
 * A programme's identity: the same programme, received twice, is one programme on the phone, and the sets filmed for
 * it stay its own. FNV-1a over its compact JSON (a name, not a safeguard).
 */
export function programmeId(p) {
  const s = JSON.stringify(compact(p));
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `p${h.toString(36)}`;
}

/** What a set filmed from a programme keeps (saved-set.js): the programme, the exercise's place in it, the target. */
export const plannedOf = (id, index, item) => ({ programme: id, item: index, sets: item.sets, reps: item.reps, rest: item.rest });

/** "3 × 10": the target as a coach writes it; null for a set saved outside a programme. */
export function targetText(planned) {
  if (!planned || !Number.isInteger(planned.sets) || !Number.isInteger(planned.reps)) return null;
  return `${planned.sets}${NBSP}×${NBSP}${planned.reps}`;
}

const localDay = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
const setTimeOf = w => new Date(w.createdAt ?? w.date).getTime();

/**
 * Planned against counted, for one programme and one day (by default today): for each exercise, its target and the
 * sets saved for it that day, oldest first, each with the reps the person kept (the app's count, or theirs when they
 * corrected it). A programme followed again another day starts afresh; the sets of other days stay in Vos séries.
 */
export function progressOf(programme, id, sets, now = new Date()) {
  const today = localDay(now);
  const mine = (sets || []).filter(w => w?.planned?.programme === id && Number.isFinite(w.reps) && localDay(setTimeOf(w)) === today)
    .sort((a, b) => setTimeOf(a) - setTimeOf(b));
  const items = programme.items.map((item, index) => {
    const done = mine.filter(w => w.planned.item === index && w.exercise === item.key).map(w => w.reps);
    return { index, key: item.key, target: { sets: item.sets, reps: item.reps }, done, complete: done.length >= item.sets };
  });
  return { items, complete: items.filter(i => i.complete).length, total: items.length };
}
