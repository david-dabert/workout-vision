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

/**
 * RepCount-A as mirrored on Hugging Face in Lance format (https://huggingface.co/datasets/lmms-lab-eval/repcounta-lance,
 * licence "other": the videos are YouTube's, the labels TransRAC's; used here as a research benchmark, only derived
 * landmarks enter the repository, no video or frame). Its rows hold the same labels as the CSVs above:
 * `count`, and `cycle_bounds_json`, the L1..Ln frame marks in pairs. The mirror spells some classes two ways
 * (bench_pressing / benchpressing, squat / squant, ...): each is read as one class. Every class is kept, a lift the
 * app has a counter for with its key, the others with lift null, so the benchmark measures a class-agnostic counter on
 * them too. A row whose count disagrees with its marks is left out, and said so (CLAUDE.md R1).
 */
export const REPCOUNT_CLASSES = {
  bench_pressing: 'bench_pressing', benchpressing: 'bench_pressing', front_raise: 'front_raise', frontraise: 'front_raise',
  jump_jack: 'jump_jack', jumpjacks: 'jump_jack', pull_up: 'pull_up', pullups: 'pull_up', push_up: 'push_up', pushups: 'push_up',
  squat: 'squat', squant: 'squat', situp: 'situp', pommelhorse: 'pommelhorse', battle_rope: 'battle_rope', others: 'others',
};

export function repCountLanceManifest(rows, { videoDir }) {
  const sets = [], skipped = [];
  for (const r of rows) {
    const id = r.video_id, cls = REPCOUNT_CLASSES[r.action_type] ?? r.action_type;
    const marks = JSON.parse(r.cycle_bounds_json || '[]').map(v => Math.round(Number(v)));
    const reps = [];
    for (let i = 0; i + 1 < marks.length; i += 2) reps.push([marks[i], marks[i + 1]]);
    if (r.count === null || !Number.isInteger(r.count)) { skipped.push({ dataset: 'repcount', id, reason: 'no count' }); continue; }
    if (r.count !== reps.length) { skipped.push({ dataset: 'repcount', id, reason: `count ${r.count} but ${reps.length} marked reps` }); continue; }
    sets.push({ id, group: id, dataset: 'repcount', video: `${videoDir}/${r.source_name}`, lift: REPCOUNT_LIFTS[cls] ?? null, class: cls, source: r.split, count: r.count, repFrames: reps });
  }
  return { sets, skipped };
}
