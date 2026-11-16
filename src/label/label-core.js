// The labelling queue's state (label.html; David, 16 November 2026: "Go ahead, build it now"). A person David names
// counts the full reps of each stock clip, one tap per rep (R1: a count given by a person David names is a label).
// Nothing here reads the app's own count: the person never sees what the app would say, so the label stays blind.
// Labels live on the phone until sent (exportLabels); no server is involved.

export const STORE = 'wv_stock_labels';
export const WHO = 'wv_stock_labeller';

/** The verdicts a clip can get before or instead of a count. */
export const VERDICTS = Object.freeze(['counted', 'other_lift', 'unusable']);

/** The labels kept on this phone: { [clipId]: label }. */
export function readLabels(storage) {
  try { const v = JSON.parse(storage.getItem(STORE) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}

/**
 * A label for one clip. taps: the video's time at each full rep, in seconds, in the order given. A rep counted twice
 * by mistake is undone on the page before it is saved; the taps kept are sorted and must rise.
 */
export function makeLabel(clip, { verdict, taps = [], who, at = new Date().toISOString() }) {
  if (!VERDICTS.includes(verdict)) throw new Error(`unknown verdict ${verdict}`);
  if (!who || !String(who).trim()) throw new Error('the person labelling is not named');
  const t = verdict === 'counted' ? [...taps].map(Number).filter(Number.isFinite).sort((a, b) => a - b) : [];
  return { id: clip.id, lift: clip.lift, verdict, count: verdict === 'counted' ? t.length : null, taps: t.map(x => Math.round(x * 100) / 100), who: String(who).trim(), at, file: clip.file };
}

/** Saves a label; a clip already labelled on this phone keeps its first label (R1: a label is never modified). */
export function saveLabel(storage, label) {
  const all = readLabels(storage);
  if (all[label.id]) return { saved: false, reason: 'already' };
  all[label.id] = label;
  try { storage.setItem(STORE, JSON.stringify(all)); } catch { return { saved: false, reason: 'storage' }; }
  return { saved: true };
}

/** The next clip not labelled on this phone, optionally of one lift; null when the queue is done. */
export function nextClip(clips, labels, lift = '') {
  return clips.find(c => !labels[c.id] && (!lift || c.lift === lift)) ?? null;
}

/** Progress per lift: { lift: { done, total } }. */
export function progress(clips, labels) {
  const out = {};
  for (const c of clips) {
    const p = (out[c.lift] ||= { done: 0, total: 0 });
    p.total += 1;
    if (labels[c.id]) p.done += 1;
  }
  return out;
}

/** The file sent back: every label of this phone, with who gave them and when the file was made. */
export function exportLabels(labels, who, at = new Date().toISOString()) {
  const list = Object.values(labels).sort((a, b) => a.at.localeCompare(b.at));
  return { kind: 'wv-stock-labels', version: 1, who, exportedAt: at, labels: list };
}
