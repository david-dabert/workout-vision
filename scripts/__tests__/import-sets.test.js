// The import of David's set files (scripts/import-sets.mjs): planned from the file names alone, so an exam
// set is placed in test/real-phone/exam/<lift>/ without being opened (PLAN.md: only the exam script opens
// them), and a video handed over twice is caught by the fingerprint its name carries, even across a reload
// of the batch collector (review of 30 September).
import { describe, expect, it } from 'vitest';
import { parseSetName, planImport } from '../import-plan.mjs';

describe('the import of set files', () => {
  it('reads the lift, count, view and fingerprint from a collector or batch file name', () => {
    expect(parseSetName('set07_bicep_curl_8_side_1a2b3c4d.json.gz')).toEqual({ set: 7, lift: 'bicep_curl', count: 8, view: 'side', hash: '1a2b3c4d' });
    expect(parseSetName('lat_pulldown_10_front_0f0f0f0f.json.gz')).toEqual({ set: null, lift: 'lat_pulldown', count: 10, view: 'front', hash: '0f0f0f0f' });
    expect(parseSetName('IMG_0412.MOV')).toBeNull();
    expect(parseSetName('squat_8_side_xyz.json.gz')).toBeNull();
  });
  it('places exam sets in their lift folder, under their own name', () => {
    const plan = planImport(['set01_squat_8_side_aaaaaaaa.json.gz', 'set02_bicep_curl_6_side_bbbbbbbb.json.gz'], { mode: 'exam', existing: [] });
    expect(plan.problems).toEqual([]);
    expect(plan.moves).toEqual([
      { from: 'set01_squat_8_side_aaaaaaaa.json.gz', to: 'exam/squat/set01_squat_8_side_aaaaaaaa.json.gz' },
      { from: 'set02_bicep_curl_6_side_bbbbbbbb.json.gz', to: 'exam/bicep_curl/set02_bicep_curl_6_side_bbbbbbbb.json.gz' },
    ]);
  });
  it('places build sets in the named sets folder', () => {
    expect(planImport(['squat_8_side_aaaaaaaa.json.gz'], { mode: 'build', folder: 'sets-01oct', existing: [] }).moves)
      .toEqual([{ from: 'squat_8_side_aaaaaaaa.json.gz', to: 'sets-01oct/squat_8_side_aaaaaaaa.json.gz' }]);
  });
  it('imports nothing when one video comes twice, and names both labels (R1)', () => {
    const plan = planImport(['set01_squat_8_side_aaaaaaaa.json.gz', 'set14_squat_9_side_aaaaaaaa.json.gz', 'set02_squat_7_side_cccccccc.json.gz'], { mode: 'exam', existing: [] });
    expect(plan.moves).toEqual([]);
    expect(plan.problems).toEqual(['one video, two files: set01_squat_8_side_aaaaaaaa.json.gz and set14_squat_9_side_aaaaaaaa.json.gz']);
  });
  it('imports nothing when a video is already in the repository, as a build or an exam set', () => {
    const plan = planImport(['set03_squat_8_side_21fd7ccf.json.gz'], { mode: 'exam', existing: ['sets-29sep/squat_7_side_21fd7ccf.json.gz'] });
    expect(plan.moves).toEqual([]);
    expect(plan.problems).toEqual(['already in the repository: set03_squat_8_side_21fd7ccf.json.gz is the video of sets-29sep/squat_7_side_21fd7ccf.json.gz']);
  });
  it('imports nothing when a name cannot be read, or a build folder is not a sets- folder', () => {
    expect(planImport(['notes.txt'], { mode: 'exam', existing: [] }).problems).toEqual(['not a set file: notes.txt']);
    expect(planImport(['squat_8_side_aaaaaaaa.json.gz'], { mode: 'build', folder: 'exam', existing: [] }).problems).toEqual(['a build folder is named sets-<date>: exam']);
  });
});

describe('the import script', () => {
  const { execFileSync } = require('node:child_process');
  const { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync } = require('node:fs');
  const { join } = require('node:path');
  const { tmpdir } = require('node:os');
  const SCRIPT = join(__dirname, '..', 'import-sets.mjs');
  const run = (root, args) => {
    try { return { code: 0, out: execFileSync('node', [SCRIPT, ...args], { env: { ...process.env, WV_SETS_ROOT: root }, encoding: 'utf8', stdio: 'pipe' }) }; }
    catch (e) { return { code: e.status, out: `${e.stdout}${e.stderr}` }; }
  };
  const tree = () => {
    const base = mkdtempSync(join(tmpdir(), 'wv import '));
    const root = join(base, 'real phone'), src = join(base, 'files');
    mkdirSync(root, { recursive: true }); mkdirSync(src);
    return { root, src };
  };
  it('copies into exam/<lift>/ under a path with spaces, then refuses the same files a second time', () => {
    const { root, src } = tree();
    writeFileSync(join(src, 'set01_squat_8_side_aaaaaaaa.json.gz'), 'x');
    expect(run(root, [src, '--exam', '--write']).code).toBe(0);
    expect(readdirSync(join(root, 'exam', 'squat'))).toEqual(['set01_squat_8_side_aaaaaaaa.json.gz']);
    const again = run(root, [src, '--exam', '--write']);
    expect(again.code).toBe(1);
    expect(again.out).toContain('Nothing imported');
  });
  it('plans only without --write, and refuses --exam with --build', () => {
    const { root, src } = tree();
    writeFileSync(join(src, 'set01_squat_8_side_aaaaaaaa.json.gz'), 'x');
    expect(run(root, [src, '--exam']).code).toBe(0);
    expect(existsSync(join(root, 'exam'))).toBe(false);
    expect(run(root, [src, '--exam', '--build', 'sets-01oct']).code).toBe(2);
  });
  it('takes back what it copied when a later copy fails', () => {
    const { root, src } = tree();
    writeFileSync(join(src, 'set01_squat_8_side_aaaaaaaa.json.gz'), 'x');
    // A folder under a set file's name cannot be copied as a file, even by root.
    mkdirSync(join(src, 'set02_squat_7_side_bbbbbbbb.json.gz'));
    const r = run(root, [src, '--exam', '--write']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('could not be copied');
    expect(readdirSync(join(root, 'exam', 'squat'))).toEqual([]);
  });
});
