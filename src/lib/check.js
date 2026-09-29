// The check page (check.html): David's five labelled clips counted by the live code on his iPhone and
// compared with the count their committed landmarks give (check-baseline.json). No release that
// touches analysis goes out unless every row is as before (David's order, 29 September 2026).

/**
 * A row is as before when the whole video was read, from the same file, refused or not as before, and counted the same.
 * @param {{ before: number, fileSize: number, refused?: boolean }} clip
 * @param {{ count: number | null, refused?: boolean | null, read: number, expected: number | null, size: number }} row
 */
export function rowVerdict(clip, { count, refused = null, read, expected, size }) {
  const why = [];
  if (size !== clip.fileSize) why.push(`another file: ${size} bytes, the clip has ${clip.fileSize}`);
  if (!(Number.isFinite(expected) && read === expected)) why.push(`read ${read} of ${expected ?? 'an unknown number of'} samples`);
  // What the app shows: a refused set shows no number, so a change of refusal is a change (review 01).
  if (refused != null && refused !== clip.refused) why.push(refused ? 'refused now, counted before' : 'counted now, refused before');
  if (count !== clip.before) why.push(count == null ? 'no count' : `counted ${count}, before ${clip.before}`);
  if (why.includes('no count') && why.some(w => w.startsWith('read '))) why.splice(why.indexOf('no count'), 1);
  return { ok: why.length === 0, why };
}
