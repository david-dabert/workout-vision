// Where programmes are kept: on this phone only, in localStorage. The coach's drafts under wv_pro_drafts; the
// programmes a client received under wv_programmes. Every read and write is guarded: a private window, a full or
// refused storage leaves the screens working, with nothing kept (the screens say so where it matters).
import { DEFAULT_ITEM, LIMITS, fromCompact, compact, programmeId } from './programme';

const DRAFTS = 'wv_pro_drafts', RECEIVED = 'wv_programmes';
// At most this many of each are kept. Received programmes: the oldest go first (a list on one phone, not an archive).
// Drafts: a new one past the cap is refused, never a coach's programme dropped unseen (excellence hunt, 9 October
// 2026; a draft is about 1 kB). Both UNSOURCED, convention.
export const MAX_DRAFTS = 300;
const MAX_RECEIVED = 20;

function read(key) {
  try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function write(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list)); return true; } catch { return false; }
}

const newId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** A new, empty draft. */
export const newDraft = (now = Date.now()) => ({ id: newId(), updatedAt: now, title: '', who: '', note: '', items: [] });
/** A new item of a draft, at the default target. */
export const newItem = key => ({ key, ...DEFAULT_ITEM });
/** A draft with nothing in it yet: not kept until something is (Pro.jsx). */
export const isEmptyDraft = d => !String(d.title ?? '').trim() && !String(d.who ?? '').trim() && !String(d.note ?? '').trim() && !d.items?.length;

/** The coach's drafts, the latest changed first; a stored entry that is not a draft is left out. */
export function loadDrafts() {
  return read(DRAFTS).filter(d => d && typeof d.id === 'string' && Array.isArray(d.items))
    .map(d => ({ ...d, title: String(d.title ?? '').slice(0, LIMITS.title), who: String(d.who ?? '').slice(0, LIMITS.who), note: String(d.note ?? '').slice(0, LIMITS.note) }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
/**
 * Keeps one draft (added or replaced): true once kept, false when the phone refuses, 'full' for a new draft past
 * MAX_DRAFTS (nothing is dropped to make room).
 */
export function saveDraft(draft) {
  // An empty draft kept before 9 October 2026 takes no place: it goes at the next save.
  const stored = read(DRAFTS).filter(d => d && !isEmptyDraft(d)), list = stored.filter(d => d.id !== draft.id);
  if (list.length === stored.length && list.length >= MAX_DRAFTS) return 'full';
  list.unshift(draft);
  return write(DRAFTS, list);
}

/**
 * The draft to adjust after a client's results (Results.jsx): the coach's own draft of that title and for that person
 * when this phone holds one, else a new one made from the results (each exercise at the sets and reps sent, the rest
 * at its default, no cue), kept at once. Returns { draft, kept }.
 */
export function draftFromResults(results, now = Date.now()) {
  const same = loadDrafts().find(d => d.title.trim() === results.title && d.who.trim() === (results.who || ''));
  if (same) return { draft: same, kept: true };
  const draft = { ...newDraft(now), title: results.title, who: results.who || '', items: results.items.map(i => ({ ...newItem(i.key), sets: i.sets, reps: i.reps })) };
  return { draft, kept: saveDraft(draft) };
}
export function removeDraft(id) { return write(DRAFTS, read(DRAFTS).filter(d => d?.id !== id)); }

/**
 * The programmes received, the latest opened first, each { id, programme, receivedAt, openedAt }; each one stored is
 * checked again as it is read, as a link is.
 */
export function loadReceived() {
  return read(RECEIVED).map(r => {
    const back = r && typeof r === 'object' ? fromCompact(r.data) : { ok: false };
    return back.ok ? { id: programmeId(back.programme), programme: back.programme, receivedAt: r.receivedAt || 0, openedAt: r.openedAt || 0 } : null;
  }).filter(Boolean).sort((a, b) => b.openedAt - a.openedAt);
}
/** Keeps a programme received (opened from a link); the same programme twice is kept once. Returns its id. */
export function keepReceived(programme, now = Date.now()) {
  const id = programmeId(programme);
  const list = read(RECEIVED).filter(r => r && r.id !== id);
  const was = read(RECEIVED).find(r => r?.id === id);
  list.unshift({ id, data: compact(programme), receivedAt: was?.receivedAt || now, openedAt: now });
  write(RECEIVED, list.slice(0, MAX_RECEIVED));
  return id;
}
/** Marks a received programme as the one opened last. */
export function openReceived(id, now = Date.now()) {
  const list = read(RECEIVED);
  const r = list.find(x => x?.id === id);
  if (r) { r.openedAt = now; write(RECEIVED, list); }
}
export function removeReceived(id) { return write(RECEIVED, read(RECEIVED).filter(r => r?.id !== id)); }
