// Verifies that every labelled set on disk matches test/real-phone/labels.lock (sha256 + label + path).
// Fails if any labelled file or its label changes, or a labelled file is added or removed, without updating labels.lock
// (CLAUDE.md R1; PLAN.md, David's order of 6 November 2026).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { expect, test } from 'vitest';
import {
  BENCH_ONLY,
  benchSets,
  blindSets,
  labelledSets,
  loopBlindSets,
  publicSets,
  ROOT,
  testerBlindSets,
  videoSets,
} from './sets';

const LOCK_PATH = resolve(ROOT, 'labels.lock');
const HEADER = '# sha256  label  path (every labelled set read by test/real-phone/accuracy/sets.ts; CLAUDE.md R1)';

function buildLockText(): string {
  const stored = labelledSets();
  const vidImage = videoSets({ mode: 'image' });
  const vidMode = videoSets({ mode: 'video' });
  const blind = blindSets();
  const tblind = testerBlindSets();
  const loopBlind = loopBlindSets();
  const pub = publicSets('build');
  const benches = BENCH_ONLY.map(ds => benchSets(ds, 'build'));

  expect(stored.unreadable).toEqual([]);
  expect(vidImage.unreadable).toEqual([]);
  expect(vidMode.unreadable).toEqual([]);
  expect(blind.unreadable).toEqual([]);
  expect(tblind.unreadable).toEqual([]);
  expect(loopBlind.unreadable).toEqual([]);
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
    ...loopBlind.sets,
    ...pub.sets,
    ...benches.flatMap(b => b.sets),
  ];

  const byName = new Map<string, number>();
  for (const s of all) {
    byName.set(s.name, s.label);
  }

  const lines = [...byName.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, label]) => {
      const sha256 = createHash('sha256').update(readFileSync(resolve(ROOT, name))).digest('hex');
      return `${sha256}  ${label}  ${name}`;
    });

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

test('no existing line in labels.lock is modified or removed without an explicit ruling (CLAUDE.md R1)', () => {
  let baseContent: string | null = null;
  const baseRef = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main';
  try {
    baseContent = execSync(`git show ${baseRef}:test/real-phone/labels.lock 2>/dev/null`, { encoding: 'utf8' });
  } catch {
    try {
      baseContent = execSync('git show HEAD~1:test/real-phone/labels.lock 2>/dev/null', { encoding: 'utf8' });
    } catch {
      baseContent = null;
    }
  }
  if (!baseContent) return;

  const currentLines = new Set(
    readFileSync(LOCK_PATH, 'utf8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
  );

  const baseLines = baseContent
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  const removedOrModified: string[] = [];
  for (const line of baseLines) {
    if (!currentLines.has(line)) {
      removedOrModified.push(line);
    }
  }

  expect(
    removedOrModified,
    `Existing lines in labels.lock were modified or removed without an explicit ruling from David:\n${removedOrModified.join('\n')}`
  ).toEqual([]);
});
