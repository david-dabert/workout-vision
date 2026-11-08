// The import of David's set files (scripts/import-sets.mjs): planned from the file names alone, so an exam
// set is placed in test/real-phone/exam/<lift>/ without being opened (PLAN.md: only the exam script opens
// them), and a video handed over twice is caught by the fingerprint its name carries, even across a reload
// of the batch collector (review of 30 September).
import { describe, expect, it } from 'vitest';
import { parseSetName, planImport } from '../import-plan.mjs';
import { testerBlindSets } from '../../test/real-phone/accuracy/sets.ts';

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
  it('places tester blind-count sets in blind/<tester>/ and validates the tester name', () => {
    const plan = planImport(['squat_8_side_aaaaaaaa.json.gz'], { mode: 'tester', tester: 'olivier', existing: [] });
    expect(plan.problems).toEqual([]);
    expect(plan.moves).toEqual([{ from: 'squat_8_side_aaaaaaaa.json.gz', to: 'blind/olivier/squat_8_side_aaaaaaaa.json.gz' }]);
    expect(planImport(['squat_8_side_aaaaaaaa.json.gz'], { mode: 'tester', tester: 'Bad Name!', existing: [] }).problems)
      .toEqual(['a tester is named with lowercase letters, digits, - or _: Bad Name!']);
  });
});

describe('the import script and tester exam', () => {
  const { execFileSync } = require('node:child_process');
  const { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync } = require('node:fs');
  const { gzipSync } = require('node:zlib');
  const { join } = require('node:path');
  const { tmpdir } = require('node:os');
  const SCRIPT = join(__dirname, '..', 'import-sets.mjs');
  const EXAM_SCRIPT = join(__dirname, '..', 'tester-exam.mjs');
  const run = (root, args, script = SCRIPT) => {
    try { return { code: 0, out: execFileSync('node', [script, ...args], { env: { ...process.env, WV_SETS_ROOT: root }, encoding: 'utf8', stdio: 'pipe' }) }; }
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
  it('imports valid tester blind-count files, refuses files without blind payload or duplicate hashes, and runs the one-shot exam once', () => {
    const { root, src } = tree();
    // A file as the phone keeps it (src/lib/phoneCollect.js collectedPayload; schema: test/real-phone/blind/README.md).
    const blindPayload = {
      lift: 'squat',
      count: 8,
      view: 'side',
      videoSha256: `11223344${'0'.repeat(56)}`,
      labelKind: 'after-app',
      appCount: 8,
      hashOf: 'video',
      recordedAt: '2026-11-09T18:30:00.000Z',
      sessionId: '00112233-4455-4677-8899-aabbccddeeff',
      blind: { count: 8, p: 1 },
      worldLandmarks: [[{ x: 0, y: 0, z: 0, visibility: 0.9 }]],
      timestamps: [0],
    };
    writeFileSync(join(src, 'squat_8_side_11223344.json.gz'), gzipSync(JSON.stringify(blindPayload)));
    expect(run(root, [src, '--tester', 'olivier', '--write']).code).toBe(0);
    expect(readdirSync(join(root, 'blind', 'olivier'))).toEqual(['squat_8_side_11223344.json.gz']);

    const parsed = testerBlindSets(root);
    expect(parsed.unreadable).toEqual([]);
    expect(parsed.sets.map(s => ({ name: s.name, tester: s.tester, lift: s.lift, label: s.label, kept: s.kept })))
      .toEqual([{ name: 'blind/olivier/squat_8_side_11223344.json.gz', tester: 'olivier', lift: 'squat', label: 8, kept: 8 }]);

    // Duplicate across testers is refused
    const again = run(root, [src, '--tester', 'lucas', '--write']);
    expect(again.code).toBe(1);
    expect(again.out).toContain('already in the repository');

    // File without blind field is refused
    const { root: root2, src: src2 } = tree();
    writeFileSync(join(src2, 'squat_8_side_55667788.json.gz'), gzipSync(JSON.stringify({ lift: 'squat', count: 8, worldLandmarks: [], timestamps: [] })));
    const noBlind = run(root2, [src2, '--tester', 'olivier', '--write']);
    expect(noBlind.code).toBe(1);
    expect(noBlind.out).toContain('not a blind-collected set file');

    // A file that breaks the schema (here, no labelKind: not a file kept on the result screen) is refused, with why
    const { root: root3, src: src3 } = tree();
    const { labelKind, ...noKind } = blindPayload;
    writeFileSync(join(src3, 'squat_8_side_11223344.json.gz'), gzipSync(JSON.stringify(noKind)));
    const broken = run(root3, [src3, '--tester', 'olivier', '--write']);
    expect(labelKind).toBe('after-app');
    expect(broken.code).toBe(1);
    expect(broken.out).toContain("labelKind is not 'after-app'");
    expect(existsSync(join(root3, 'blind'))).toBe(false);

    // One-shot exam reads the set once and marks it exposed on --record
    const firstExam = run(root, ['--record'], EXAM_SCRIPT);
    expect(firstExam.code).toBe(0);
    expect(firstExam.out).toContain('1 unseen set');
    expect(firstExam.out).toContain('blind/olivier/squat_8_side_11223344.json.gz  tester olivier  blind 8');

    const secondExam = run(root, ['--record'], EXAM_SCRIPT);
    expect(secondExam.code).toBe(0);
    expect(secondExam.out).toContain('0 unseen sets');
    expect(secondExam.out).toContain('EXPOSED blind/olivier/squat_8_side_11223344.json.gz');
  });

  // Review of 8 November 2026: what the change does to --build, to « Je ne sais pas » files and to the exam, held by a
  // test each.
  const phoneFile = (over = {}) => ({
    lift: 'squat', count: 8, view: 'side', videoSha256: `99aabbcc${'0'.repeat(56)}`, labelKind: 'after-app', appCount: 8,
    hashOf: 'video', recordedAt: '2026-11-09', blind: { count: 8, p: 1 }, worldLandmarks: [[{ x: 0, y: 0, z: 0, visibility: 0.9 }]], timestamps: [0], ...over,
  });

  it('refuses a build file whose blind count breaks the schema, and still takes a collector file that carries none', () => {
    const { root, src } = tree();
    writeFileSync(join(src, 'squat_8_side_99aabbcc.json.gz'), gzipSync(JSON.stringify(phoneFile({ blind: { count: 0, p: 1 } }))));
    const r = run(root, [src, '--build', 'sets-09nov', '--write']);
    expect(r.code).toBe(1);
    expect(r.out).toContain('blind.count is not a whole number');
    expect(existsSync(join(root, 'sets-09nov'))).toBe(false);
    const { root: root2, src: src2 } = tree();
    writeFileSync(join(src2, 'squat_8_side_99aabbcc.json.gz'), gzipSync(JSON.stringify({ lift: 'squat', count: 8, videoSha256: `99aabbcc${'0'.repeat(56)}`, worldLandmarks: [], timestamps: [] })));
    expect(run(root2, [src2, '--build', 'sets-09nov', '--write']).code).toBe(0);
    expect(readdirSync(join(root2, 'sets-09nov'))).toEqual(['squat_8_side_99aabbcc.json.gz']);
  });

  it('refuses a « Je ne sais pas » file that breaks the schema, which it imported before', () => {
    const { root, src } = tree();
    const { labelKind, ...noKind } = phoneFile({ blind: { count: null, p: 1 } });
    expect(labelKind).toBe('after-app');
    writeFileSync(join(src, 'squat_8_side_99aabbcc.json.gz'), gzipSync(JSON.stringify(noKind)));
    const r = run(root, [src, '--tester', 'olivier', '--write']);
    expect(r.code).toBe(1);
    expect(r.out).toContain("labelKind is not 'after-app'");
  });

  it('scores a set the phone refused by what the live core counts now, as the scoreboards do', async () => {
    // David's set sets-29sep/bicep_curl_5, kept by a tester's phone that had refused it. Until 8 November 2026 the exam
    // scored every such set as refused, whatever the core now counts, while npm run scoreboard counted it.
    const { blindOutcome } = await import('../../test/real-phone/accuracy/outcome.mjs');
    const d = JSON.parse(require('node:zlib').gunzipSync(require('node:fs').readFileSync(join(__dirname, '..', '..', 'test', 'real-phone', 'sets-29sep', 'bicep_curl_5_side_f5e5bdf2.json.gz'))).toString());
    const now = blindOutcome({ lift: 'bicep_curl', wl: d.worldLandmarks, ts: d.timestamps, il: d.imageLandmarks ?? null }).now;
    expect(now).not.toBe('refused');
    const { root, src } = tree();
    const name = `bicep_curl_5_side_99aabbcc.json.gz`;
    writeFileSync(join(src, name), gzipSync(JSON.stringify(phoneFile({ lift: 'bicep_curl', count: 5, appCount: null, appRefused: true, proposal: 5, blind: { count: 5, p: 1 }, worldLandmarks: d.worldLandmarks, imageLandmarks: d.imageLandmarks ?? null, timestamps: d.timestamps }))));
    expect(run(root, [src, '--tester', 'olivier', '--write']).code).toBe(0);
    const exam = run(root, [], EXAM_SCRIPT);
    expect(exam.code).toBe(0);
    expect(exam.out).toContain(`blind/olivier/${name}  tester olivier  blind 5  now ${now} (`);
  });
});
