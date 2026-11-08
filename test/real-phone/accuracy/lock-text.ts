// The blind sets' lines of test/real-phone/labels.lock, for any tree (labels-lock.test.ts writes and checks the lock;
// CLAUDE.md R1): each blind set's path with its label. A file answered « Je ne sais pas » is locked too, with "unsure"
// for its label, so it can neither gain a label from a later edit nor leave the tree unseen, and a batch of such files
// can be committed with the lock (review of 8 November 2026).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { blindSets, ROOT, testerBlindSets } from './sets';

export type LockLabel = number | 'unsure';

/** The blind files of a tree, David's and the testers', as [path, label]: the blind count, or 'unsure'. */
export function blindLockEntries(root = ROOT): [string, LockLabel][] {
  const david = blindSets(root), testers = testerBlindSets(root);
  return [
    ...[...david.sets, ...testers.sets].map(s => [s.name, s.label] as [string, LockLabel]),
    ...[...david.unsure, ...testers.unsure].map(name => [name, 'unsure'] as [string, LockLabel]),
  ];
}

/** One line of the lock: the file's SHA-256, its label and its path. */
export const lockLine = (root: string, name: string, label: LockLabel) => `${createHash('sha256').update(readFileSync(resolve(root, name))).digest('hex')}  ${label}  ${name}`;
