// npm run scoreboard:blind (Phase 6 of David's order of 6 November 2026, loop/blind-count): every blind count on disk,
// David's (test/real-phone/sets-*/) and the testers' (test/real-phone/blind/<tester>/), against the app's outcome now,
// set by set: exact, off by 3 or more, refused, and the refusal rate. A blind count is the number a person gave in the
// app before it showed its own (src/lib/blind.js), a label since David's rulings of 15 October 2026 (his own) and
// 25 October 2026 (a person he names; CLAUDE.md R1). The gate fails when one set's error grows, a set that gave a count
// is refused, a set becomes off by 3 or more, a set of the baseline leaves the disk, or a file breaks the schema
// (compare.mjs, parse.mjs). The counts compared with are the base branch's (SCOREBOARD_BASE in CI): the baseline
// npm run scoreboard reads and writes (blindCounts, testerBlindCounts in test/real-phone/accuracy/scoreboard-baseline.json);
// this file never writes it. The gate runs only when asked (SCOREBOARD=1), so a plain npm test changes no file; the
// first test, the path a tester's file takes, runs in every npm test.
import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { blindSets, decides, labelledSets, PRESS_DECIDES_NOTHING, testerBlindSets, writeScoreboard, type BlindSet } from '../accuracy/sets';
import { blindOutcome } from '../accuracy/outcome.mjs';
import { blindLockEntries, lockLine } from '../accuracy/lock-text';
import { compareBlind, gateFailures } from './compare.mjs';

const BASELINE = resolve(__dirname, '../accuracy/scoreboard-baseline.json');
const pct = (x: number | null) => (x === null ? '-' : `${Math.round(x * 100)}%`);
type Read = { sets: (BlindSet & { tester?: string })[]; unsure: string[]; unreadable: string[]; why: Record<string, string> };

// One section: the head with its tallies, a row per set, then the files with no label and what fails the gate.
function section(title: string, read: Read, baseCounts: Record<string, number | 'refused'>) {
  const outcomes = read.sets.map(s => blindOutcome(s));
  const now = Object.fromEntries(read.sets.map((s, i) => [s.name, outcomes[i].now]));
  const r = compareBlind(read.sets, baseCounts, now, decides);
  const tally = (x: typeof r) => `${x.decide} that decide: ${x.exact} exact, ${x.catastrophic} off by 3 or more, ${x.refused} refused (refusal rate ${pct(x.refusalRate)})`;
  const head = `${title}: ${r.n} set${r.n === 1 ? '' : 's'}, ${tally(r)}; ${r.added.length} new since the baseline, ${r.regressed.length} regressed, ${r.newlyCatastrophic.length} newly off by 3 or more, ${r.missing.length} missing; ${read.unsure.length} answered "Je ne sais pas", ${read.unreadable.length} unreadable.`;
  const lines = [head];
  // Per tester, the same tallies (measured, the gate is the section's).
  const testers = [...new Set(read.sets.map(s => s.tester).filter(Boolean))] as string[];
  for (const t of testers) {
    const mine = read.sets.filter(s => s.tester === t);
    lines.push(`   ${t}: ${mine.length} set${mine.length === 1 ? '' : 's'}, ${tally(compareBlind(mine, {}, now, decides))}`);
  }
  r.rows.forEach((row, i) => {
    const s = read.sets[i];
    const mark = row.regressed || row.newlyCatastrophic ? '!!' : row.before === row.now ? '  ' : '->';
    const app = s.appRefused ? 'refused' : s.appCount ?? '-';
    lines.push(`${mark} ${row.name}${s.tester ? `  tester ${s.tester}` : ''}  blind ${row.label}  before ${row.before ?? '-'} (${row.beforeVerdict})  now ${row.now} (${row.verdict})${outcomes[i].note ? `  ${outcomes[i].note}` : ''}  kept ${s.kept}${s.kept !== s.label ? ' (changed after the app\'s count)' : ''}  app then ${app}${s.recordedAt ? `  counted ${s.recordedAt.slice(0, 10)}` : ''}${row.decides ? '' : `  ${PRESS_DECIDES_NOTHING}`}`);
  });
  for (const name of read.unsure) lines.push(`   ${name}  answered "Je ne sais pas": no blind count`);
  for (const name of read.unreadable) lines.push(`UNREADABLE ${name}  (${read.why[name]})`);
  lines.push(...gateFailures(r));
  return { r, now, text: lines.join('\n') };
}

test('a tester\'s blind file goes through the one reader, the app, the comparator and the lock', () => {
  // A set of David's (sets-29sep, bicep curl, label 5), wrapped as the file a tester's phone keeps
  // (src/lib/phoneCollect.js collectedPayload), in a scratch tree; nothing is written under test/real-phone. The live
  // count is not pinned here (review of 8 November 2026): R2 may let this set move, so the test holds the blind path
  // to the app's own outcome on the same landmarks.
  const src = labelledSets().sets.find(s => s.name === 'sets-29sep/bicep_curl_5_side_f5e5bdf2.json.gz');
  expect(src, 'the source set').toBeTruthy();
  const root = mkdtempSync(join(tmpdir(), 'wv-blind-'));
  const dir = join(root, 'blind', 'olivier');
  mkdirSync(dir, { recursive: true });
  const sha = (s: string) => createHash('sha256').update(s).digest('hex');
  const file = (lift: string, kept: number, blind: { count: number | null; p: number } | undefined, seed: string) => {
    const h = sha(seed);
    const d: any = { lift, count: kept, view: 'side', videoSha256: h, worldLandmarks: src!.wl, imageLandmarks: src!.il ?? null, timestamps: src!.ts, labelKind: 'after-app', appCount: 5, corrected: kept !== 5, hashOf: 'video', source: 'result-screen', recordedAt: '2026-11-09', sessionId: '00112233-4455-4677-8899-aabbccddeeff' };
    if (blind) d.blind = blind;
    const name = `${lift}_${kept}_side_${h.slice(0, 8)}.json.gz`;
    writeFileSync(join(dir, name), gzipSync(JSON.stringify(d)));
    return `blind/olivier/${name}`;
  };
  const counted = file('bicep_curl', 5, { count: 5, p: 1 }, 'counted');
  const unsure = file('bicep_curl', 5, { count: null, p: 1 }, 'unsure');
  const bare = file('bicep_curl', 5, undefined, 'bare');
  const read = testerBlindSets(root);
  expect(read.sets.map(s => [s.name, s.tester, s.lift, s.label, s.kept, s.recordedAt, s.sessionId])).toEqual([[counted, 'olivier', 'bicep_curl', 5, 5, '2026-11-09', '00112233-4455-4677-8899-aabbccddeeff']]);
  expect(read.unsure).toEqual([unsure]);
  expect(read.unreadable).toEqual([bare]);
  expect(read.why[bare]).toContain('no blind count');
  const s = section('Testers', read, {});
  const app = blindOutcome({ lift: 'bicep_curl', wl: src!.wl, ts: src!.ts, il: src!.il ?? null }).now;
  expect(s.now[counted]).toBe(app);
  expect(s.r.added).toEqual([counted]);
  expect(gateFailures(s.r)).toEqual([]);
  expect(s.text).toContain(`olivier: 1 set, 1 that decide: ${s.r.exact} exact, ${s.r.catastrophic} off by 3 or more, ${s.r.refused} refused (refusal rate ${s.r.refused ? '100%' : '0%'})`);
  // Held against a baseline that holds the same outcome, it passes; one count further from its label, it fails.
  const further = app === 'refused' ? 'refused' : app >= 5 ? app + 1 : app - 1;
  expect(gateFailures(compareBlind(read.sets, { [counted]: app }, { [counted]: app }, decides))).toEqual([]);
  if (further !== 'refused') expect(gateFailures(compareBlind(read.sets, { [counted]: app }, { [counted]: further }, decides))).toEqual([`REGRESSED ${counted}`]);
  // The lock holds both: the counted file with its label, and the « Je ne sais pas » file as unsure, so neither can
  // gain a label or leave the tree unseen (review of 8 November 2026).
  expect(blindLockEntries(root).sort()).toEqual([[counted, 5], [unsure, 'unsure']].sort());
  expect(lockLine(root, unsure, 'unsure')).toMatch(new RegExp(`^[0-9a-f]{64}  unsure  ${unsure.replace(/[.]/g, '\\.')}$`));
}, 120_000);

test.skipIf(!process.env.SCOREBOARD)('scoreboard:blind', () => {
  // In CI the counts compared with are the base branch's (SCOREBOARD_BASE), so a change cannot lower the bar by editing
  // the baseline it is compared with (audit of 3 October).
  const base = JSON.parse(readFileSync(process.env.SCOREBOARD_BASE || BASELINE, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const david = blindSets(), testers = testerBlindSets();
  const d = section('David\'s blind counts (test/real-phone/sets-*/; labels since his ruling of 15 October 2026)', david, base.blindCounts ?? {});
  const t = section('Testers\' blind counts (test/real-phone/blind/<tester>/; labels since David\'s ruling of 25 October 2026)', testers, base.testerBlindCounts ?? {});
  const all = { decide: d.r.decide + t.r.decide, exact: d.r.exact + t.r.exact, catastrophic: d.r.catastrophic + t.r.catastrophic, refused: d.r.refused + t.r.refused };
  const head = `Blind counts ${today} (npm run scoreboard:blind; a count given in the app before it showed its own, CLAUDE.md R1): ${all.decide} sets that decide, ${all.exact} exact, ${all.catastrophic} off by 3 or more, ${all.refused} refused (refusal rate ${pct(all.decide ? all.refused / all.decide : null)}). Bench and overhead press sets are measured and decide nothing (PLAN.md). "->" marks a count that moved, "!!" a set that fails the gate.`;
  const text = [head, '', d.text, '', t.text].join('\n') + '\n';
  writeScoreboard(resolve(__dirname, 'scoreboard-blind.txt'), text);
  process.stdout.write(text);
  expect([...gateFailures(d.r), ...gateFailures(t.r)]).toEqual([]);
  expect(david.unreadable).toEqual([]);
  expect(testers.unreadable).toEqual([]);
  // The committed baseline holds the live counts (third audit, C27): a change that moves a blind count commits the
  // output of SCOREBOARD_UPDATE=1 npm run scoreboard, the only writer of the baseline.
  if (process.env.SCOREBOARD_BASE) {
    const committed = JSON.parse(readFileSync(BASELINE, 'utf8'));
    expect(committed.blindCounts ?? {}).toEqual(d.now);
    expect(committed.testerBlindCounts ?? {}).toEqual(t.now);
  }
}, 300_000);
