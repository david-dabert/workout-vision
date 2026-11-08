// The one reader of a blind-count set file (Phase 6 of David's order of 6 November 2026; schema in README.md here).
// A blind count is the number a person gave in the app before it showed its own (src/lib/blind.js); since David's
// rulings of 15 October 2026 (his own) and 25 October 2026 (a person he names, on a #collecte phone) it is a label
// (CLAUDE.md R1). The file is the one the phone keeps when the count is kept on the result screen
// (src/lib/phoneCollect.js, collectedPayload) and sends only through the share sheet.
//
// Read by test/real-phone/accuracy/sets.ts (blindSets, testerBlindSets), so the scoreboards, the lock and the exam
// read one schema, and by scripts/import-sets.mjs, which refuses a file this reader does not take.
// Plain JavaScript, so Node scripts and the TypeScript tests import the same code.

export const SHA256 = /^[0-9a-f]{64}$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/**
 * The highest blind count the person's field takes (src/lib/blind.js BLIND_MAX). It bounds the blind count only: the
 * app's count, its proposal, and a count kept as the app gave it have no such bound (review of 8 November 2026).
 */
export const MAX_COUNT = 99;
// The collector's file name (src/lib/collector.js setFileName; a batch file is led by its set number).
const NAME = /^(?:set\d+_)?(.+?)_(\d+)_(side|front|angle)_([0-9a-f]{8})\.json\.gz$/;

const isWhole = (n, min) => Number.isInteger(n) && n >= min;
// A calendar day (YYYY-MM-DD, what the phone writes since the review of 8 November 2026) or a full ISO 8601 time.
const isDay = s => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
};
const isTime = s => typeof s === 'string' && (isDay(s) || (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && isDay(s.slice(0, 10)) && Number.isFinite(Date.parse(s))));

/**
 * Reads one parsed file. `name` (the file's own name, optional) is checked against what the file says.
 * Returns { status: 'none' } when the file carries no blind count at all (not a blind set), { status: 'unsure' } when
 * the person answered "Je ne sais pas" (no label), { status: 'unreadable', reason } when the file breaks the schema,
 * and { status: 'set', set } otherwise.
 */
export function parseBlindFile(d, name = null) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { status: 'unreadable', reason: 'not a JSON object' };
  if (d.blind === undefined) return { status: 'none' };
  const b = d.blind;
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { status: 'unreadable', reason: 'blind is not { count, p }' };
  if (b.p !== undefined && b.p !== null && !(typeof b.p === 'number' && b.p > 0 && b.p <= 1)) return { status: 'unreadable', reason: 'blind.p is not a share in (0, 1]' };
  if (b.count !== null && !(isWhole(b.count, 1) && b.count <= MAX_COUNT)) return { status: 'unreadable', reason: `blind.count is not a whole number from 1 to ${MAX_COUNT}` };
  // A « Je ne sais pas » file carries no label, and is held to the rest of the schema all the same: it is locked and
  // kept like the others (review of 8 November 2026).
  if (d.labelKind !== 'after-app') return { status: 'unreadable', reason: "labelKind is not 'after-app' (not a file kept on the result screen)" };
  if (typeof d.lift !== 'string' || !/^[a-z][a-z0-9_]*$/.test(d.lift)) return { status: 'unreadable', reason: 'no exercise key (lift)' };
  if (!isWhole(d.count, 0)) return { status: 'unreadable', reason: 'count (the count kept after the app\'s) is not a whole number' };
  const wl = d.worldLandmarks, ts = d.timestamps;
  if (!Array.isArray(wl) || !wl.length) return { status: 'unreadable', reason: 'no world landmarks' };
  if (!Array.isArray(ts) || ts.length !== wl.length || !ts.every(Number.isFinite)) return { status: 'unreadable', reason: 'timestamps do not match the landmarks' };
  if (d.imageLandmarks != null && (!Array.isArray(d.imageLandmarks) || d.imageLandmarks.length !== wl.length)) return { status: 'unreadable', reason: 'image landmarks do not match the world landmarks' };
  if (typeof d.videoSha256 !== 'string' || !SHA256.test(d.videoSha256)) return { status: 'unreadable', reason: 'videoSha256 is not a SHA-256' };
  if (d.hashOf !== undefined && d.hashOf !== 'video' && d.hashOf !== 'landmarks') return { status: 'unreadable', reason: "hashOf is neither 'video' nor 'landmarks'" };
  if (d.appCount !== undefined && d.appCount !== null && !isWhole(d.appCount, 0)) return { status: 'unreadable', reason: 'appCount is not a whole number' };
  if (d.appRefused !== undefined && typeof d.appRefused !== 'boolean') return { status: 'unreadable', reason: 'appRefused is not true or false' };
  if (d.proposal !== undefined && d.proposal !== null && !isWhole(d.proposal, 1)) return { status: 'unreadable', reason: 'proposal is not a whole number' };
  if (d.recordedAt !== undefined && !isTime(d.recordedAt)) return { status: 'unreadable', reason: 'recordedAt is not a day (YYYY-MM-DD) or an ISO 8601 time' };
  if (d.sessionId !== undefined && !(typeof d.sessionId === 'string' && UUID.test(d.sessionId))) return { status: 'unreadable', reason: 'sessionId is not a UUID' };
  if (name !== null) {
    const m = NAME.exec(String(name).split('/').pop());
    if (!m) return { status: 'unreadable', reason: 'the file name is not the collector\'s (lift_count_view_hash.json.gz)' };
    if (m[1] !== d.lift || Number(m[2]) !== d.count || m[4] !== d.videoSha256.slice(0, 8)) return { status: 'unreadable', reason: 'the file name does not match its exercise, kept count or hash' };
  }
  if (b.count === null) return { status: 'unsure' };
  return {
    status: 'set',
    set: {
      lift: d.lift,
      label: b.count,
      kept: d.count,
      appCount: d.appCount ?? null,
      appRefused: d.appRefused === true,
      proposal: Number.isInteger(d.proposal) ? d.proposal : null,
      videoSha256: d.videoSha256,
      hashOf: d.hashOf ?? null,
      recordedAt: d.recordedAt ?? null,
      sessionId: d.sessionId ?? null,
      wl,
      ts,
      il: d.imageLandmarks ?? null,
    },
  };
}
