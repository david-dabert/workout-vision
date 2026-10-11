/**
 * The plan for importing David's set files (scripts/import-sets.mjs), made from their names alone: an exam
 * set is placed without being opened (PLAN.md: only the exam script opens exam sets). A name carries the
 * lift, the count, the view and the first eight hex digits of the video's SHA-256 (src/lib/collector.js,
 * setFileName; a batch file is led by its set number). If anything is wrong, nothing is imported.
 */
const NAME = /^(?:set(\d+)_)?(.+?)_(\d+)_(side|front|angle)_([0-9a-f]{8})\.json\.gz$/;

export function parseSetName(name) {
  const m = NAME.exec(name);
  return m && { set: m[1] ? Number(m[1]) : null, lift: m[2], count: Number(m[3]), view: m[4], hash: m[5] };
}

/**
 * @param names the files handed over
 * @param mode 'exam' (into exam/<lift>/) or 'build' (into `folder`, a sets-<date> folder)
 * @param existing the set files already in test/real-phone, as '<folder>/<name>'
 */
export function planImport(names, { mode, folder, existing }) {
  const problems = [];
  if (mode === 'build' && !/^sets-[0-9a-z]+$/.test(folder || '')) problems.push(`a build folder is named sets-<date>: ${folder}`);
  const known = new Map(existing.map(path => [parseSetName(path.split('/').pop())?.hash, path]).filter(([h]) => h));
  const seen = new Map();
  for (const name of names) {
    const s = parseSetName(name);
    if (!s) { problems.push(`not a set file: ${name}`); continue; }
    // One video under two names is two labels for one set: David decides which holds (CLAUDE.md R1).
    if (seen.has(s.hash)) problems.push(`one video, two files: ${seen.get(s.hash)} and ${name}`);
    else seen.set(s.hash, name);
    if (known.has(s.hash)) problems.push(`already in the repository: ${name} is the video of ${known.get(s.hash)}`);
  }
  if (problems.length) return { moves: [], problems };
  return { moves: names.map(name => ({ from: name, to: mode === 'exam' ? `exam/${parseSetName(name).lift}/${name}` : `${folder}/${name}` })), problems };
}
