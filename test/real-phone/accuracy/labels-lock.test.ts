// Verifies that every labelled set on disk matches test/real-phone/labels.lock (sha256 + label + path).
// Fails if any labelled file or its label changes, or a labelled file is added or removed, without updating labels.lock
// (CLAUDE.md R1; PLAN.md, David's order of 6 November 2026). Blind files answered « Je ne sais pas » are locked too,
// labelled "unsure" (lock-text.ts; Phase 6, review of 8 November 2026).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import {
  BENCH_ONLY,
  benchSets,
  blindSets,
  labelledSets,
  publicSets,
  ROOT,
  testerBlindSets,
  videoSets,
} from './sets';
import { blindLockEntries, lockLine, type LockLabel } from './lock-text';

const LOCK_PATH = resolve(ROOT, 'labels.lock');
const HEADER = '# sha256  label  path (every labelled set read by test/real-phone/accuracy/sets.ts; CLAUDE.md R1)';

function buildLockText(): string {
  const stored = labelledSets();
  const vidImage = videoSets({ mode: 'image' });
  const vidMode = videoSets({ mode: 'video' });
  const blind = blindSets();
  const tblind = testerBlindSets();
  const pub = publicSets('build');
  const benches = BENCH_ONLY.map(ds => benchSets(ds, 'build'));

  expect(stored.unreadable).toEqual([]);
  expect(vidImage.unreadable).toEqual([]);
  expect(vidMode.unreadable).toEqual([]);
  expect(blind.unreadable).toEqual([]);
  expect(tblind.unreadable).toEqual([]);
  expect(pub.unreadable).toEqual([]);
  expect(pub.missing).toEqual([]);
  for (const b of benches) {
    expect(b.unreadable).toEqual([]);
    expect(b.missing).toEqual([]);
  }

  const all = [
    ...stored.sets,
    ...vidImage.sets,
    ...vidMode.sets,
    ...blind.sets,
    ...tblind.sets,
    ...pub.sets,
    ...benches.flatMap(b => b.sets),
  ];

  const byName = new Map<string, LockLabel>();
  for (const s of all) {
    byName.set(s.name, s.label);
  }
  for (const [name, label] of blindLockEntries()) byName.set(name, label);

  const lines = [...byName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, label]) => lockLine(ROOT, name, label));

  return [HEADER, ...lines, ''].join('\n');
}

test('every labelled set on disk matches test/real-phone/labels.lock (sha256 and label)', () => {
  const actual = buildLockText();
  if (process.env.LABELS_LOCK_UPDATE) {
    writeFileSync(LOCK_PATH, actual);
  }
  const committed = readFileSync(LOCK_PATH, 'utf8');
  expect(actual).toBe(committed);
}, 120_000);
