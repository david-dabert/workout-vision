// npm run scoreboard:blind      (SCOREBOARD_UPDATE=1 once a change is accepted)
// Phase 6 of David's order of 6 November 2026 (PLAN.md):
// Automated collection and evaluation loop for testers' blind counts (test/real-phone/blind/).
// Evaluates: exact match count, catastrophic errors (off by >= 3), and refusal rate.
// Gate in CI: fails if any recorded blind set regresses or becomes catastrophic.

import { expect, test } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { loopBlindSets, writeScoreboard } from './sets';

const BASELINE = process.env.SCOREBOARD_BASE || resolve(__dirname, 'blind-baseline.json');
const SCOREBOARD_TXT = resolve(__dirname, 'scoreboard-blind.txt');

const off = (c: number | string, label: number) =>
  c === 'refused' ? Infinity : Math.abs((c as number) - label);

export function evaluateBlindSets(sets: ReturnType<typeof loopBlindSets>['sets']) {
  const live: Record<string, number | string> = {};
  const rows: { name: string; lift: string; label: number; now: number | string; off: number; verdict: string }[] = [];

  for (const s of sets) {
    let now: number | string;
    if (s.wl && s.ts && s.wl.length > 0 && s.wl.length === s.ts.length) {
      const res: any = summarizeCount(s.wl, s.ts, s.lift, undefined, s.il ?? undefined);
      now = res.refused ? 'refused' : res.count;
    } else {
      now = s.appRefused ? 'refused' : (s.appCount ?? 'refused');
    }

    live[s.name] = now;
    const diff = off(now, s.label);
    const verdict = now === 'refused' ? 'refused' : diff === 0 ? 'exact' : diff >= 3 ? 'catastrophic' : `off ${now > s.label ? '+' : ''}${Number(now) - s.label}`;
    rows.push({ name: s.name, lift: s.lift, label: s.label, now, off: diff, verdict });
  }

  const exactCount = rows.filter(r => r.off === 0).length;
  const catastrophicCount = rows.filter(r => r.off !== Infinity && r.off >= 3).length;
  const refusedCount = rows.filter(r => r.now === 'refused').length;
  const total = rows.length;

  return { live, rows, exactCount, catastrophicCount, refusedCount, total };
}

test('scoreboard:blind evaluates recorded blind sets with regression and catastrophe gates', () => {
  const { sets, unreadable } = loopBlindSets();
  expect(unreadable, 'no unreadable blind set files').toEqual([]);

  let base: { counts?: Record<string, number | string> } = { counts: {} };
  if (existsSync(BASELINE)) {
    try {
      const content = readFileSync(BASELINE, 'utf8').trim();
      if (content) base = JSON.parse(content);
    } catch {
      base = { counts: {} };
    }
  }
  const baseCounts = base.counts ?? {};

  const evaluated = evaluateBlindSets(sets);

  const regressions: string[] = [];
  const newlyCatastrophic: string[] = [];

  for (const r of evaluated.rows) {
    const prev = baseCounts[r.name];
    if (prev !== undefined) {
      const prevDiff = off(prev, r.label);
      if (prevDiff === 0 && r.off !== 0) {
        regressions.push(`${r.name} (${r.lift}): previously exact (${r.label}), now ${r.now}`);
      }
      if (prevDiff < 3 && r.off >= 3) {
        newlyCatastrophic.push(`${r.name} (${r.lift}): previously off ${prevDiff}, now off ${r.off} (${r.now} vs ${r.label})`);
      }
    } else {
      if (r.off >= 3 && r.now !== 'refused') {
        newlyCatastrophic.push(`${r.name} (${r.lift}): newly added set is catastrophic (${r.now} vs ${r.label})`);
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const exactPct = evaluated.total ? Math.round((100 * evaluated.exactCount) / evaluated.total) : 0;
  const refusalPct = evaluated.total ? Math.round((100 * evaluated.refusedCount) / evaluated.total) : 0;

  const header = `Testers' blind counts scoreboard (${today}): ${evaluated.total} sets; ${evaluated.exactCount} exact (${exactPct}%); ${evaluated.catastrophicCount} catastrophic; ${evaluated.refusedCount} refused (${refusalPct}%).`;
  console.log(header);

  const lines = [header];
  for (const r of evaluated.rows) {
    const prev = baseCounts[r.name];
    const prevStr = prev !== undefined ? ` (was ${prev})` : ' (new)';
    lines.push(`   ${r.name}  lift ${r.lift}  blind ${r.label}  now ${r.now} (${r.verdict})${prevStr}`);
  }

  writeScoreboard(SCOREBOARD_TXT, lines.join('\n') + '\n');

  if (process.env.SCOREBOARD_UPDATE) {
    writeFileSync(
      BASELINE,
      JSON.stringify(
        {
          note: `Testers' blind counts baseline (${today}), measured by npm run scoreboard:blind. SCOREBOARD_UPDATE=1 updates this file.`,
          counts: evaluated.live,
        },
        null,
        2
      ) + '\n'
    );
  }

  expect(regressions, 'no regression on previously exact blind sets').toEqual([]);
  expect(newlyCatastrophic, 'no catastrophic errors on blind sets').toEqual([]);
});
