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
 * French copy approved by David on 9 October 2026 (R10; test/real-phone/swarm/copy-check.md).
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

/** ?delegate=gpu: the rows read with MediaPipe's GPU delegate (pillar 4, 9 October 2026), else null (the CPU, as the app). */
export const delegateParam = (search = '') => (new URLSearchParams(search).get('delegate') || '').toLowerCase() === 'gpu' ? 'GPU' : null;

/**
 * The line of a row that says how the pose model ran on this phone (coreAnalysis.js, metadata.pose): the delegate and,
 * on the GPU, the renderer WebGL names; the model's median and 90th-percentile time per sample; the first 12 hex of the
 * SHA-256 of the world landmarks, so a row read twice shows whether the model repeats itself. The live counter needs
 * at most 66.7 ms a sample (liveEngine.js SLOW_MS). French copy written 9 October 2026, awaiting David's approval (R10).
 */
export function poseLine(pose, hash, fr = false) {
  const ms = v => (Number.isFinite(v) ? (fr ? String(v).replace('.', ',') : String(v)) : '?');
  const who = `${pose?.delegate || (fr ? 'inconnu' : 'unknown')}${pose?.renderer ? ` (${pose.renderer})` : ''}`;
  return fr
    ? `Modèle : ${who} · ${ms(pose?.msMedian)} ms par échantillon (p90 ${ms(pose?.msP90)}) · empreinte ${hash || '?'}`
    : `Model: ${who} · ${ms(pose?.msMedian)} ms a sample (p90 ${ms(pose?.msP90)}) · fingerprint ${hash || '?'}`;
}

/** The first 12 hex of the SHA-256 of the world landmarks as JSON: the same read gives the same fingerprint. */
export async function landmarksPrint(worldLandmarks, subtle = globalThis.crypto?.subtle) {
  if (!subtle) return null;
  const d = await subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(worldLandmarks ?? [])));
  return Array.from(new Uint8Array(d)).slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Bundled public demo clips with David's verified rep counts for one-tap on-device Safari checks (no gallery picker). */
export const DEMO_CLIPS = [
  { id: 'demo_bicep_curl_5', file: 'bicep-curl-5.mp4', lift: 'bicep_curl', label: 5, titleEn: 'Bicep curl (bundled demo MP4)', titleFr: 'Curl biceps (vidéo intégrée MP4)' },
  { id: 'demo_bodyweight_squat_9', file: 'bodyweight-squat-9.mp4', lift: 'squat', label: 9, titleEn: 'Bodyweight squat (bundled demo MP4)', titleFr: 'Squat poids du corps (vidéo intégrée MP4)' },
  { id: 'demo_dip_13', file: 'dip-13.mp4', lift: 'dip', label: 13, titleEn: 'Dip (bundled demo MP4)', titleFr: 'Dips (vidéo intégrée MP4)' },
  { id: 'demo_ez_curl_10', file: 'ez-curl-10.mp4', lift: 'bicep_curl', label: 10, titleEn: 'EZ bar curl (bundled demo MP4)', titleFr: 'Curl barre EZ (vidéo intégrée MP4)' },
  { id: 'demo_lat_pulldown_6', file: 'lat-pulldown-6.mp4', lift: 'lat_pulldown', label: 6, titleEn: 'Lat pulldown (bundled demo MP4)', titleFr: 'Tirage vertical (vidéo intégrée MP4)' },
  { id: 'demo_iphone_bicep_curl_5', file: 'iphone/bicep-curl-5.mov', lift: 'bicep_curl', label: 5, titleEn: 'Bicep curl (iPhone MOV)', titleFr: 'Curl biceps (MOV iPhone)' },
  { id: 'demo_iphone_bicep_curl_5_rot', file: 'iphone/bicep-curl-5-rot.mov', lift: 'bicep_curl', label: 5, titleEn: 'Bicep curl sideways (iPhone MOV)', titleFr: 'Curl biceps tourné (MOV iPhone)' },
  { id: 'demo_iphone_bodyweight_squat_9', file: 'iphone/bodyweight-squat-9.mov', lift: 'squat', label: 9, titleEn: 'Bodyweight squat (iPhone MOV)', titleFr: 'Squat poids du corps (MOV iPhone)' },
  { id: 'demo_iphone_bodyweight_squat_9_rot', file: 'iphone/bodyweight-squat-9-rot.mov', lift: 'squat', label: 9, titleEn: 'Bodyweight squat sideways (iPhone MOV)', titleFr: 'Squat poids du corps tourné (MOV iPhone)' },
  { id: 'demo_iphone_dip_13', file: 'iphone/dip-13.mov', lift: 'dip', label: 13, titleEn: 'Dip (iPhone MOV)', titleFr: 'Dips (MOV iPhone)' },
  { id: 'demo_iphone_dip_13_rot', file: 'iphone/dip-13-rot.mov', lift: 'dip', label: 13, titleEn: 'Dip sideways (iPhone MOV)', titleFr: 'Dips tournés (MOV iPhone)' },
  { id: 'demo_iphone_ez_curl_10', file: 'iphone/ez-curl-10.mov', lift: 'bicep_curl', label: 10, titleEn: 'EZ bar curl (iPhone MOV)', titleFr: 'Curl barre EZ (MOV iPhone)' },
  { id: 'demo_iphone_ez_curl_10_rot', file: 'iphone/ez-curl-10-rot.mov', lift: 'bicep_curl', label: 10, titleEn: 'EZ bar curl sideways (iPhone MOV)', titleFr: 'Curl barre EZ tourné (MOV iPhone)' },
  { id: 'demo_iphone_lat_pulldown_6', file: 'iphone/lat-pulldown-6.mov', lift: 'lat_pulldown', label: 6, titleEn: 'Lat pulldown (iPhone MOV)', titleFr: 'Tirage vertical (MOV iPhone)' },
  { id: 'demo_iphone_lat_pulldown_6_rot', file: 'iphone/lat-pulldown-6-rot.mov', lift: 'lat_pulldown', label: 6, titleEn: 'Lat pulldown sideways (iPhone MOV)', titleFr: 'Tirage vertical tourné (MOV iPhone)' },
];

/** Join Vite base path and demo clip file name without double slashes. */
export function demoAssetUrl(file, base = '/') {
  const b = base && String(base).endsWith('/') ? String(base) : `${base || ''}/`;
  return `${b}demo/${file}`;
}

/** Integer pose coverage percentage (0..100) from metadata or non-empty world landmarks; null when unavailable. */
export function poseCoveragePct(worldLandmarks, explicitCoverage = null) {
  if (typeof explicitCoverage === 'number' && Number.isFinite(explicitCoverage)) {
    return Math.round(explicitCoverage <= 1 ? explicitCoverage * 100 : explicitCoverage);
  }
  if (!Array.isArray(worldLandmarks) || worldLandmarks.length === 0) return null;
  const detected = worldLandmarks.filter(w => (Array.isArray(w) ? w.length > 0 : Boolean(w))).length;
  return Math.round((detected / worldLandmarks.length) * 100);
}

/** True when an analysis failure means this browser cannot decode the container/codec (e.g. HEVC .mov in Chromium). */
export function isUndecodableError(err, file = '') {
  if (!err || err.name === 'AbortError' || err.frozen || err.name === 'FrozenReadError' || err.name === 'FrozenSkeletonsError' || err.name === 'PartialReadError') {
    return false;
  }
  const msg = String(err.message || err);
  if (/^HTTP \d+/i.test(msg)) return false;
  if (err.name === 'NotSupportedError') return true;
  if (/No decoder could process this file|Codec not supported|Video load failed|Video load timeout|MEDIA_ERR_SRC_NOT_SUPPORTED|MEDIA_ERR_DECODE|BLANK_FRAMES|Canvas tainted|No video track found/i.test(msg)) {
    return true;
  }
  return /\.mov$/i.test(file) && /decode|demux|format|support/i.test(msg);
}

/** Normalized demo row / JSON export entry carrying explicit count, samples read, decoder path, rotation decision, pose coverage and decode status. */
export function formatDemoEntry(clip, data = {}) {
  const notDecodable = Boolean(data.notDecodable);
  const samplesRead = Number.isFinite(data.samplesRead) ? data.samplesRead : 0;
  const decoderPath = data.decoderPath ?? data.decoder ?? null;
  const poseCoverage = Number.isFinite(data.poseCoverage) ? data.poseCoverage : null;
  return {
    id: clip.id,
    file: clip.file,
    lift: clip.lift,
    label: clip.label,
    count: notDecodable ? null : (data.count ?? null),
    samplesRead,
    samples: samplesRead,
    decoderPath,
    decoder: decoderPath,
    fallback: data.fallback ?? null,
    rotationDecision: data.rotationDecision ?? null,
    poseCoverage,
    poseCoveragePct: poseCoverage,
    notDecodable,
    exact: notDecodable ? false : Boolean(data.exact),
    refused: notDecodable ? false : Boolean(data.refused),
    error: notDecodable ? 'not decodable here' : (data.error || false),
    source: data.source ?? null,
    pose: data.pose ?? null,
    fingerprint: data.fingerprint ?? null,
  };
}

/** Tally string for the one-tap bundled demo section on check.html. */
export function demoVerdictText(entries, total, fr = false) {
  const ran = entries.length;
  const exact = entries.filter(e => e.exact).length;
  const refused = entries.filter(e => e.refused).length;
  const notDecodable = entries.filter(e => e.notDecodable).length;
  const failed = entries.filter(e => e.error && !e.notDecodable).length;
  if (fr) {
    const base = `Vidéos intégrées\u00A0: ${ran} sur ${total} testées · ${exact} exactes · ${refused} refusées · ${failed} erreurs`;
    return notDecodable > 0 ? `${base} · ${notDecodable} non décodable${notDecodable > 1 ? 's' : ''} ici` : base;
  }
  const base = `Bundled demo: ${ran} of ${total} checked · ${exact} exact · ${refused} refused · ${failed} errors`;
  return notDecodable > 0 ? `${base} · ${notDecodable} not decodable here` : base;
}
