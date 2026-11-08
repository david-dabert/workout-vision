// No line of test/real-phone/labels.lock changes or goes without a ruling of David's (labels-lock-diff.mjs; Phase 6 of
// his order of 6 November 2026, point 3).
import { describe, expect, it } from 'vitest';
import { dataLines, lockPath, lockViolations, rulingProblems } from './labels-lock-diff.mjs';

const H = '# sha256  label  path (every labelled set read by test/real-phone/accuracy/sets.ts; CLAUDE.md R1)';
const a = `${'a'.repeat(64)}  7  landmarks/bench_press_7_angle_mufhcy60.json.gz`;
const b = `${'b'.repeat(64)}  10  sets-29sep/lat_pulldown_10_front_11111111.json.gz`;
const c = `${'c'.repeat(64)}  5  blind/olivier/squat_5_side_22222222.json.gz`;
const lock = (...lines) => [H, ...lines, ''].join('\n');
const none = { rulings: [] };
const relabelled = b.replace('  10  ', '  9  ');
// A ruling names the line as it stood and the line it becomes (now), or null when David rules that the set goes.
const ruling = (line, over = {}) => ({ line, now: relabelled, date: '2026-11-08', ruling: 'David: "the count is 9, not 10"', source: 'https://github.com/david-dabert/workout-vision/issues/190#issuecomment-1', ...over });

describe('the labels lock', () => {
  it('reads label lines only, and the path each names', () => {
    expect(dataLines(lock(a, b))).toEqual([a, b]);
    expect(dataLines(`${a}   \n\n# note\n`)).toEqual([a]);
    expect(lockPath(b)).toBe('sets-29sep/lat_pulldown_10_front_11111111.json.gz');
  });

  it('lets lines be added, and the header change', () => {
    expect(lockViolations(lock(a, b), lock(a, b, c), none)).toEqual([]);
    expect(lockViolations(lock(a, b), `# another header\n${a}\n${b}\n`, none)).toEqual([]);
  });

  it('fails a line removed, a label changed and a file changed, each with what the change holds now', () => {
    const rehashed = `${'d'.repeat(64)}  7  landmarks/bench_press_7_angle_mufhcy60.json.gz`;
    expect(lockViolations(lock(a, b, c), lock(a, c), none)).toEqual([{ line: b, path: lockPath(b), now: null }]);
    expect(lockViolations(lock(a, b), lock(a, relabelled), none)).toEqual([{ line: b, path: lockPath(b), now: relabelled }]);
    expect(lockViolations(lock(a, b), lock(rehashed, b), none)).toEqual([{ line: a, path: lockPath(a), now: rehashed }]);
  });

  it('lets a line become exactly what a whole ruling of David\'s says, and nothing else', () => {
    expect(lockViolations(lock(a, b), lock(a, relabelled), { rulings: [ruling(b)] })).toEqual([]);
    expect(lockViolations(lock(a, b), lock(a, relabelled), { rulings: [ruling(`${b}  `, { now: `${relabelled} ` })] })).toEqual([]);
    // Review of 8 November 2026: a ruling to relabel 10 as 9 lets the set neither go nor become an 8.
    expect(lockViolations(lock(a, b), lock(a), { rulings: [ruling(b)] })).toHaveLength(1);
    expect(lockViolations(lock(a, b), lock(a, b.replace('  10  ', '  8  ')), { rulings: [ruling(b)] })).toHaveLength(1);
    // A set goes only on a ruling that says so (now: null), and then it goes whole.
    expect(lockViolations(lock(a, b), lock(a), { rulings: [ruling(b, { now: null })] })).toEqual([]);
    expect(lockViolations(lock(a, b), lock(a, relabelled), { rulings: [ruling(b, { now: null })] })).toHaveLength(1);
    // A ruling for another line, or one without its source or without what the line becomes, covers nothing.
    expect(lockViolations(lock(a, b), lock(a, relabelled), { rulings: [ruling(a)] })).toHaveLength(1);
    expect(lockViolations(lock(a, b), lock(a, relabelled), { rulings: [ruling(b, { source: ' ' })] })).toHaveLength(1);
    const { now, ...unsaid } = ruling(b);
    expect(now).toBe(relabelled);
    expect(lockViolations(lock(a, b), lock(a, relabelled), { rulings: [unsaid] })).toHaveLength(1);
  });

  it('names each ruling that is not whole', () => {
    expect(rulingProblems(none)).toEqual([]);
    expect(rulingProblems({ rulings: [ruling(b), ruling(b, { now: null })] })).toEqual([]);
    expect(rulingProblems({})).toEqual(['label-rulings.json holds no "rulings" list']);
    const { now, ...unsaid } = ruling(b);
    expect(now).toBe(relabelled);
    const bad = rulingProblems({ rulings: [ruling(b), ruling(b, { date: '8 November' }), ruling(`${a}\n${b}`), ruling(b, { ruling: '' }), unsaid, ruling(b, { now: `${a}\n${b}` })] });
    expect(bad).toHaveLength(5);
    for (const [i, n] of [[0, 2], [1, 3], [2, 4], [3, 5], [4, 6]]) expect(bad[i]).toContain(`ruling ${n} needs`);
  });
});
