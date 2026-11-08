// writeScoreboard (sets.ts): a scoreboard file is rewritten only when more than its heads' run dates moved, so the
// date in a file is the day its counts last changed (R13; David's rule change of 15 October 2026). Until 8 November
// 2026 only the first line's date was set aside, and the testers' dated head rewrote scoreboard.txt on every day's run.
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeScoreboard } from './sets';

const board = (date: string, exact: number, row = '   sets-x/a.json.gz  label 5  now 5 (exact)') =>
  `Scoreboard ${date}: of the 15 sets that decide, ${exact} exact now.\n${row}\n\nTesters' blind counts ${date} (their count): 0 sets.\n`;

describe('writeScoreboard', () => {
  it('leaves the file as it was when only the heads\' run dates differ', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'wv-board-')), 'scoreboard.txt');
    writeScoreboard(path, board('2026-11-07', 13));
    writeScoreboard(path, board('2026-11-08', 13));
    expect(readFileSync(path, 'utf8')).toBe(board('2026-11-07', 13));
  });

  it('rewrites it when a count or a row moved, a date inside a row included', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'wv-board-')), 'scoreboard.txt');
    writeScoreboard(path, board('2026-11-07', 13));
    writeScoreboard(path, board('2026-11-08', 14));
    expect(readFileSync(path, 'utf8')).toBe(board('2026-11-08', 14));
    writeScoreboard(path, board('2026-11-09', 14, '   blind/t01/a.json.gz  blind 5  now 5 (exact)  counted 2026-11-09'));
    writeScoreboard(path, board('2026-11-10', 14, '   blind/t01/a.json.gz  blind 5  now 5 (exact)  counted 2026-11-10'));
    expect(readFileSync(path, 'utf8')).toContain('counted 2026-11-10');
  });
});
