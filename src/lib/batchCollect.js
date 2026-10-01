/**
 * The batch collector's rules (collect-batch.html): many sets picked at once, one row each, in the order
 * they were filmed. Pure, so the page and its tests share them.
 */
import { COUNTABLE_RANGE_DEG } from './counting/core';

/** The videos by their files' dates, then by name read as the phone numbers them (IMG_999 before IMG_1000).
 * On an iPhone the date may be when Photos handed the file over, so each row shows its video. */
export function filmingOrder(files) {
  return [...files].sort((a, b) => (a.lastModified - b.lastModified) || a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/** A new row takes the previous row's exercise and view: a session films the same lift several times. */
export function rowsFor(files, previous = { lift: '', view: 'side' }) {
  return filmingOrder(files).map((file, i) => ({ set: i + 1, file, lift: previous.lift, view: previous.view, count: '', state: 'waiting' }));
}

/** What stops a row from being collected: no exercise, or a count that is not a whole number from 0 to 99. */
export function rowErrors(row) {
  const errors = [];
  if (!row.lift) errors.push('choose the exercise');
  if (!/^\d{1,2}$/.test(String(row.count).trim())) errors.push('enter the reps you counted (0 to 99)');
  return errors;
}

/**
 * A set whose own joint moves less than the counter's minimum range cannot be counted at all: the video is
 * likely not the labelled exercise, or the joint did not show (1 October 2026: three of four mispaired sets read
 * 11 to 22 degrees). The threshold is the counter's own (MIN_ROM_DEGREES, core.ts), so the warning never
 * stands beside a count. Status: convention, tied to the counter's minimum range. On correctly labelled
 * public clips, 6.4 % fall under 35 degrees (review of 1 October), which is why 35 was not kept.
 */
export const MISMATCH_RANGE_DEG = COUNTABLE_RANGE_DEG;
export function mismatchNote(set, liftLabel, range) {
  if (!(range < MISMATCH_RANGE_DEG)) return '';
  return `Check set ${set}: the app sees too little movement of the joint that counts ${liftLabel} (${Math.round(range)}°) to count it. Is it the right video, filmed so that joint shows?`;
}

/** The flagged sets' numbers, said in the summary and before the files leave the page. */
export function flaggedSets(rows) {
  return rows.filter(r => r.state === 'done' && r.mismatch).map(r => r.set);
}

/** The file's name, led by its set number so the files sort as they were filmed: set07_<collector name>. */
export function batchFileName(set, name) {
  return `set${String(set).padStart(2, '0')}_${name}`;
}

/**
 * A choice made on one set carries to the sets below, up to the first one the user set by hand
 * (row.touched), skipping collected ones. A set chosen by hand is never overwritten (review, 30 September: a
 * correction on set 1 had turned sets 2 and 3, set to leg press, into lateral raises).
 */
export function carryChoice(rows, from, key, value) {
  for (let j = from + 1; j < rows.length; j++) {
    // The first set the user has worked on (any field chosen by hand, or its count typed) ends the carry:
    // the sets below it follow that one (reviews, 30 September).
    // A count filled from the one-line box (row.lineCount) was not typed on the set: it does not stop the carry.
    if (Object.keys(rows[j].touched || {}).length || (String(rows[j].count ?? '').trim() !== '' && !rows[j].lineCount)) break;
    if (rows[j].state === 'done') continue;
    rows[j][key] = value;
  }
  return rows;
}

// Not by date: iPhone Safari dates a file from Photos when it hands it over, so a video picked again
// comes with a new date (seventh review, 30 September). The fingerprint catches what the name misses.
const sameFile = (a, b) => a.name === b.name && a.size === b.size;

/**
 * The collected set of this page holding the same video as this row (same SHA-256), if any, with its
 * label: a video is kept once.
 */
export function twinOf(rows, row, sha256) {
  const here = rows.find(r => r !== row && r.state === 'done' && r.sha256 === sha256);
  return here && { set: here.set, lift: here.lift, count: Number(here.count) };
}

/**
 * What the page says of a video already collected. Two different labels for one video mean one of them is
 * wrong: the page says so and keeps the first file as it is, and David decides (CLAUDE.md R1).
 */
export function twinNote(row, twin) {
  if (row.lift !== twin.lift) return `Same video as set ${twin.set}, labelled ${twin.lift} there and ${row.lift} here: check which is right. Not kept; set ${twin.set} keeps ${twin.lift}.`;
  if (Number(row.count) !== twin.count) return `Same video as set ${twin.set}, labelled ${twin.count} reps there and ${Number(row.count)} here: check which is right. Not kept; set ${twin.set} keeps ${twin.count}.`;
  return `Same video as set ${twin.set}: not kept.`;
}

/**
 * One share at a time: a tap while a share sheet is open is ignored, since Safari rejects it and the page
 * would report a failure while the first sheet may still succeed. A share that never settles is let go
 * after `ms`, so the button cannot stay dead (seventh review, 30 September).
 */
export function oneAtATime(ms) {
  let since = null;
  return {
    start: now => (since === null || now - since >= ms ? ((since = now), true) : false),
    end: () => { since = null; },
  };
}

/**
 * What the page remembers across a reload (iOS may evict the tab after a long run): only the next set
 * number, so that no new file takes the number of one already handed over. A hand-over (Share or
 * Download) marks the collected sets' numbers as used when it starts, since the page cannot know whether
 * the files reached the phone: a number never used leaves a gap, which is harmless; a number used twice
 * is not. `gen` counts the restarts from set 1 (seventh review, 30 September).
 */
export function numbersUsed(memory, rows) {
  return { gen: memory.gen, next: Math.max(memory.next, ...rows.filter(r => r.state === 'done').map(r => r.set + 1)) };
}

/** Two tabs' memories joined: a later restart wins over older numbers, else the higher next number. */
export function mergeMemory(a, b) {
  if (!b || b.gen < a.gen) return a;
  if (b.gen > a.gen) return b;
  return { gen: a.gen, next: Math.max(a.next, b.next) };
}

/**
 * A second pick adds its sets after those already there, numbering on, each pick in its files' date
 * order; a video picked again is ignored. A set keeps its number once given, so a file already collected
 * or shared never changes name, and no new file takes its number (sixth and seventh reviews, 30 September).
 */
export function appendRows(rows, files, first = 1) {
  const last = rows.at(-1);
  // After a reload the page's rows are gone, but the numbers given are not: `first` is the next number the
  // page remembers, so a new file never takes the number of one already shared (seventh review).
  const next = Math.max(first, (last?.set ?? 0) + 1);
  const fresh = files.filter(file => !rows.some(r => sameFile(r.file, file)));
  const added = rowsFor(fresh, last ? { lift: last.lift, view: last.view } : undefined).map((r, i) => ({ ...r, set: next + i }));
  return [...rows, ...added];
}

/**
 * All the counts of a batch typed on one line, in the order of the sets ("8 10 7" or "8, 10, 7"): each set
 * still to collect takes the next one; a collected set keeps its own. Nothing is filled unless the line holds
 * exactly one whole number from 0 to 99 per set still to collect: a count is David's label, never guessed
 * (CLAUDE.md R1).
 */
export function countsFromLine(rows, line) {
  // A comma or semicolon separates only when a space follows it: "9,5" is nine and a half in French, not two counts.
  const typed = String(line).replace(/[,;]\s+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const bad = typed.find(t => !/^\d{1,2}$/.test(t));
  if (bad !== undefined) return { counts: null, error: `${bad} is not a whole number from 0 to 99` };
  const open = rows.filter(r => r.state !== 'done' && r.state !== 'duplicate');
  if (typed.length !== open.length) return { counts: null, error: `${open.length} set${open.length === 1 ? '' : 's'} to count, ${typed.length} count${typed.length === 1 ? '' : 's'} typed` };
  let k = 0;
  return { counts: rows.map(r => (r.state !== 'done' && r.state !== 'duplicate' ? typed[k++] : r.count)), error: null };
}
