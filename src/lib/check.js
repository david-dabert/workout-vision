// The check page (check.html): David's five labelled clips counted by the live code on his iPhone and
// compared with the count their committed landmarks give (check-baseline.json). No release that
// touches analysis goes out unless every row is as before (David's order, 29 September 2026).

/**
 * A row is as before when the whole video was read, from the same set, refused or not as before, and counted the same.
 * @param {{ before: number, samples: number, duration: number, refused?: boolean }} clip
 * @param {{ count: number | null, refused?: boolean | null, read: number, expected: number | null, duration?: number | null }} row
 */
export function rowVerdict(clip, { count, refused = null, read, expected, duration = null }) {
  const why = [];
  // The same set is known by its length: Photos hands the page a re-encoded file whose fingerprint differs
  // from the collector's, but whose length reads the same (David's run of 29 September, 5 of 5:
  // test/real-phone/decoder/11-david-check-normal.txt). Within 0.1 s, so that a reported length a few
  // milliseconds off, across a sample boundary, is still the same set (review 11). Status: convention.
  if (Number.isFinite(duration) && Math.abs(duration - clip.duration) > 0.1) why.push(`another video (${duration.toFixed(2)} s where the set lasts ${clip.duration.toFixed(2)} s)`);
  if (!(Number.isFinite(expected) && read === expected)) why.push(`read ${read} of ${expected ?? 'an unknown number of'} samples`);
  // What the app shows: a refused set shows no number, so a change of refusal is a change (review 01).
  if (refused != null && refused !== clip.refused) why.push(refused ? 'refused now, counted before' : 'counted now, refused before');
  if (count !== clip.before) why.push(count == null ? 'no count' : `counted ${count}, before ${clip.before}`);
  if (why.includes('no count') && why.some(w => w.startsWith('read '))) why.splice(why.indexOf('no count'), 1);
  return { ok: why.length === 0, why };
}

// WP0.2 (docs/SPEC-production.md): rows are keyed by clip id, never by lift, so two clips of one lift (the lateral
// raise of 29 September and the machine lateral raise of the 3 October incident) are two rows, each with its verdict.
/** A clip's id: the name of its committed landmarks file without the extension (the video's fingerprint ends it). */
export const clipId = clip => clip.id ?? clip.file.replace(/\.json\.gz$/, '');

/** The row's name in the page's summary: the lift's name, then the clip's fingerprint, so two of one lift differ. */
export const rowName = (clip, names = {}) => `${names[clip.lift] || clip.lift} ${clipId(clip).split('_').pop()}`;

/**
 * One path's line of the summary, from its verdicts keyed by clip id.
 * @param {Map<string, { ok: boolean }>} verdicts
 * @param {Array<{ lift: string, file: string, id?: string }>} clips
 */
export function pathTally(verdicts, clips, names = {}) {
  const ids = new Set(clips.map(clipId));
  const mine = [...verdicts.entries()].filter(([id]) => ids.has(id));
  const bad = mine.filter(([, v]) => !v.ok).map(([id]) => rowName(clips.find(c => clipId(c) === id), names));
  const checked = mine.length, ok = mine.length - bad.length;
  return { n: clips.length, checked, ok, bad, whole: checked === clips.length && !bad.length };
}

/**
 * The share of samples that repeat the one before, as isFrozenRead (frozenRead.js) reads it: repeats of samples - 1.
 * Null when no count of repeats came back.
 */
export function repeatShare(read) {
  if (!read || !Number.isFinite(read.samples) || !Number.isFinite(read.repeats)) return null;
  return { ...read, share: read.samples > 1 ? read.repeats / (read.samples - 1) : 0 };
}

const pct = (x, fr) => { const s = (Math.round(x * 1000) / 10).toString(); return fr ? `${s.replace('.', ',')} %` : `${s} %`; };

/**
 * The lines of a row that say how the video was read: the repeat share of the pictures (the extractor's) and of the
 * skeletons (analyzeCoreVideo's), the decoder's method and, when the playback path ran, why.
 * French copy pending David's approval (R10; test/real-phone/swarm/copy-check.md).
 * @param {{ pictures?: {samples:number, repeats:number} | null, skeletons?: {samples:number, repeats:number} | null, decoder?: string, fallback?: string | null }} read
 */
export function readLines({ pictures = null, skeletons = null, decoder = '', fallback = null }, fr = false) {
  const part = (label, r) => { const s = repeatShare(r); return s ? `${label} ${s.repeats}${fr ? ' sur ' : ' of '}${Math.max(s.samples - 1, 0)} (${pct(s.share, fr)})` : `${label} ${fr ? 'inconnu' : 'unknown'}`; };
  return [
    fr
      ? `Répétitions${' '}: ${part('images', pictures)} · ${part('squelettes', skeletons)}`
      : `Repeats: ${part('pictures', pictures)} · ${part('skeletons', skeletons)}`,
    fr
      ? `Décodeur${' '}: ${decoder || 'inconnu'} · repli${' '}: ${fallback || 'aucun'}`
      : `Decoder: ${decoder || 'unknown'} · fallback: ${fallback || 'none'}`,
  ];
}

/**
 * The frozen-injection row (check.html?inject=frozen): it passes only when the analysis was refused as a frozen read,
 * by the extractor (the error carries `frozen`, frameExtractor.js) or by the skeletons (FrozenSkeletonsError).
 * Anything else, a count included, fails it: the guard did not fire.
 */
export function injectVerdict(outcome) {
  const e = outcome?.error;
  if (e?.frozen || e?.name === 'FrozenReadError' || e?.name === 'FrozenSkeletonsError') {
    const read = e.frozen ?? { samples: e.samples, repeats: e.repeats };
    return { ok: true, why: [], read: repeatShare(read), by: e.name === 'FrozenSkeletonsError' ? 'skeletons' : 'pictures' };
  }
  const why = e ? `not refused as frozen (${e.name || 'Error'}: ${e.message || e})`
    : outcome?.count === 'refused' ? 'refused, but not as frozen' : `counted ${outcome?.count ?? 'nothing'}, not refused`;
  return { ok: false, why: [why], read: null, by: null };
}
