// Where programmes are kept: on this phone only, in localStorage. The coach's drafts under wv_pro_drafts; the
// programmes a client received under wv_programmes. Every read and write is guarded: a private window, a full or
// refused storage leaves the screens working, with nothing kept (the screens say so where it matters).
import { DEFAULT_ITEM, LIMITS, fromCompact, compact, programmeId } from './programme';

const DRAFTS = 'wv_pro_drafts', RECEIVED = 'wv_programmes';
// At most this many of each are kept; the oldest go first (a list on one phone, not an archive).
const MAX_DRAFTS = 50, MAX_RECEIVED = 20;

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

/** The coach's drafts, the latest changed first; a stored entry that is not a draft is left out. */
export function loadDrafts() {
  return read(DRAFTS).filter(d => d && typeof d.id === 'string' && Array.isArray(d.items))
    .map(d => ({ ...d, title: String(d.title ?? '').slice(0, LIMITS.title), who: String(d.who ?? '').slice(0, LIMITS.who), note: String(d.note ?? '').slice(0, LIMITS.note) }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
/** Keeps one draft (added or replaced); returns whether the phone kept it. */
export function saveDraft(draft) {
  const list = read(DRAFTS).filter(d => d?.id !== draft.id);
  list.unshift(draft);
  return write(DRAFTS, list.slice(0, MAX_DRAFTS));
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
