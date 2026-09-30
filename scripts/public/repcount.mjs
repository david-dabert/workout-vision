/**
 * RepCount-A (Hu et al., TransRAC, CVPR 2022; https://github.com/SvipRepetitionCounting/TransRAC): videos
 * from YouTube, each with the start and end frame of every repetition marked by people. The label files
 * are read as TransRAC's own loader reads them (dataset/RepCountA_raw_Loader.py): one row per video,
 * with its name, count and type, and L1..Ln, the frame numbers of each rep's start and end in pairs.
 * Labels are never changed (CLAUDE.md R1): a video whose count disagrees with its marks is left out, and
 * said so.
 */

// RepCount-A's types, to the app's lift keys (src/lib/counting/guide-patterns.json); the others (situp,
// jump_jack, pommelhorse, battle_rope, others) are not lifts the app counts.
export const REPCOUNT_LIFTS = { squat: 'squat', bench_pressing: 'bench_press', front_raise: 'front_raise', pull_up: 'pull_up', push_up: 'push_up' };

function parseCsvLine(line) {
  const out = [];
  let cur = '', quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

export function parseRepCount(text) {
  const [head, ...lines] = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const cols = parseCsvLine(head);
  return lines.map(line => {
    const cells = parseCsvLine(line), row = Object.fromEntries(cols.map((c, i) => [c, cells[i] ?? '']));
    const marks = cols.filter(c => /^L\d+$/.test(c)).map(c => row[c]).filter(v => v !== '').map(v => Math.round(Number(v)));
    const reps = [];
    for (let i = 0; i + 1 < marks.length; i += 2) reps.push([marks[i], marks[i + 1]]);
    return { name: row.name, type: row.type, count: row.count === '' ? null : Number(row.count), reps };
  });
}

export function repCountManifest(rows, { videoDir }) {
  const sets = [], skipped = [];
  for (const r of rows) {
    const lift = REPCOUNT_LIFTS[r.type];
    if (!lift) { skipped.push(`${r.name}: ${r.type} is not a lift the app counts`); continue; }
    if (r.count === null || !Number.isFinite(r.count)) { skipped.push(`${r.name}: no count`); continue; }
    if (!Number.isInteger(r.count) || r.count !== r.reps.length) { skipped.push(`${r.name}: count ${r.count} but ${r.reps.length} marked reps`); continue; }
    const id = r.name.replace(/\.[^.]+$/, '');
    sets.push({ id, group: id, dataset: 'repcount', video: `${videoDir}/${r.name}`, lift, count: r.count, repFrames: r.reps });
  }
  return { sets, skipped };
}
