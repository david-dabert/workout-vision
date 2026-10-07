// npm run scoreboard      (SCOREBOARD_UPDATE=1 npm run scoreboard once a change is accepted)
// CLAUDE.md R2: every change that can move a count is measured before and after. The live core's count on
// every labelled set on disk, set by set, against its label and against the counts last accepted
// (scoreboard-baseline.json). It fails if fewer sets are exact than before, or if any set is off by 3 or
// more, or if a set that gave a count becomes refused. Bench press and overhead press sets are measured, shown and
// kept in the baseline, and decide nothing (PLAN.md; decides() in sets.ts). Build sets only (David's sets in every test/real-phone/sets-*/ folder and the five build clips): no exam set exists yet,
// and nothing here may tune a parameter. Runs only when asked, so a plain npm test changes no file.
// A second section, "Real video, 7 October", counts David's 13 whole gym videos as the built app read them
// (test/real-phone/sets-07oct-video/), under the same rules and its own baseline (videoCounts).
import { expect, test } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { decides, doubtLine, labelledSets, PRESS_DECIDES_NOTHING, videoSets } from './sets';

const BASELINE = resolve(__dirname, 'scoreboard-baseline.json');

const verdict = (count: number | string, label: number) => (count === 'refused' ? 'refused' : count === label ? 'exact' : Math.abs((count as number) - label) >= 3 ? 'catastrophic' : `off ${(count as number) > label ? '+' : ''}${(count as number) - label}`);

type Tally = { rows: string[]; live: Record<string, number | string>; doubts: { flagged: boolean; err: number }[]; exactNow: number; exactBefore: number; catastrophic: number; known: number; becameRefused: number; n: number; added: number; press: number; missing: string[] };

// One section of the scoreboard: each set's live count against its label and against the baseline's count, with the
// tallies of the R2 gate. `count` gives the app's outcome for a set (a number or 'refused').
function section(sets: { name: string; lift: string; label: number }[], baseCounts: Record<string, number | string>, count: (i: number) => { now: number | string; doubt?: { flagged: boolean } | null }): Tally {
  const t: Tally = { rows: [], live: {}, doubts: [], exactNow: 0, exactBefore: 0, catastrophic: 0, known: 0, becameRefused: 0, n: 0, added: 0, press: 0, missing: [] };
  const { rows } = t;
  sets.forEach((s, i) => {
    const { now, doubt } = count(i), before = baseCounts[s.name];
    t.live[s.name] = now; t.n++;
    if (doubt && now !== 'refused') t.doubts.push({ flagged: doubt.flagged, err: Math.abs((now as number) - s.label) });
    const v = verdict(now, s.label), vb = before === undefined ? 'new' : verdict(before, s.label);
    // A press set is shown like any other and moves no tally of the gate (PLAN.md: "measured but decide nothing").
    const mark = decides(s.lift) ? '' : `  ${PRESS_DECIDES_NOTHING}`;
    if (mark) { t.press++; rows.push(`${now === before ? '  ' : '->'} ${s.name}  label ${s.label}  before ${before ?? '-'} (${vb})  now ${now} (${v})${mark}`); return; }
    if (before === undefined) t.added++;
    else { if (v === 'exact') t.exactNow++; if (vb === 'exact') t.exactBefore++; }
    // R2 reads "no clip becomes a catastrophic error". A set already off by 3 or more (in the baseline, or added
    // with that error) is shown and kept, and fails only if its error grows: a set is never left out of the gate
    // because it fails (review of 6 October: the held 13-rep set was a gate escape).
    const err = (c: number | string) => (c === 'refused' ? Infinity : Math.abs((c as number) - s.label));
    if (v === 'catastrophic') {
      if (before === undefined || (vb === 'catastrophic' && err(now) <= err(before))) { t.known++; rows.push(`KNOWN CATASTROPHIC  ${s.name}  label ${s.label}  now ${now}`); }
      else t.catastrophic++;
    }
    // A set that gave a count and is now refused fails like one off by 3 or more, as in the public gate and
    // scripts/compare-variants.mjs; a set already refused in the baseline does not (third audit, C31).
    if (v === 'refused' && before !== undefined && before !== 'refused') { t.becameRefused++; rows.push(`BECAME REFUSED  ${s.name}  label ${s.label}  before ${before}`); }
    rows.push(`${now === before ? '  ' : '->'} ${s.name}  label ${s.label}  before ${before ?? '-'} (${vb})  now ${now} (${v})`);
  });
  // A set of the baseline no longer on disk is named, and fails the gate: a set is never dropped quietly.
  t.missing = Object.keys(baseCounts).filter(name => !(name in t.live));
  for (const name of t.missing) rows.push(`MISSING ${name}  (in the baseline, not on disk)`);
  return t;
}

test.skipIf(!process.env.SCOREBOARD)('scoreboard', () => {
  // In CI the counts compared with are the base branch's (SCOREBOARD_BASE), so a change cannot lower the bar by
  // editing the baseline it is compared with (audit of 3 October).
  const base = JSON.parse(readFileSync(process.env.SCOREBOARD_BASE || BASELINE, 'utf8'));
  // The gate compares the sets both runs hold: a set added since cannot hide a regression (review, 30 September).
  const { sets, unreadable } = labelledSets();
  const b = section(sets, base.counts, i => { const r = summarizeCount(sets[i].wl, sets[i].ts, sets[i].lift); return { now: r.refused ? 'refused' : r.count, doubt: r.doubt }; });
  for (const name of unreadable) b.rows.push(`UNREADABLE ${name}  (not gzip JSON, or no lift, whole count or landmarks)`);
  const kept = b.n - b.added - b.press;
  const head = `Scoreboard ${new Date().toISOString().slice(0, 10)}: of the ${kept} sets in the baseline that decide, ${b.exactNow} exact now, ${b.exactBefore} before; ${b.catastrophic} newly catastrophic, ${b.known} known catastrophic (shown, gated on growth), ${b.becameRefused} newly refused${b.added ? `; ${b.added} set${b.added > 1 ? 's' : ''} new since` : ''}. The ${b.press} bench and overhead press sets are measured and decide nothing (PLAN.md). Build sets only; no exam set yet. "->" marks a set whose count moved.`;
  // Real video, 7 October (test/real-phone/sets-07oct-video/, README.md there): David's 13 gym videos read whole by the
  // built app (analyzeCoreVideo), his labels (R1). The same R2 rules, on their own baseline (videoCounts): no exact
  // count lost, none newly off by 3 or more, none newly refused. A read the app itself refused (partial) is refused here.
  const video = videoSets();
  const v = section(video.sets, base.videoCounts ?? {}, i => {
    const s = video.sets[i];
    if (s.appRefused) return { now: 'refused' };
    const r = summarizeCount(s.wl, s.ts, s.lift);
    return { now: r.refused ? 'refused' : r.count, doubt: r.doubt };
  });
  for (const name of video.unreadable) v.rows.push(`UNREADABLE ${name}  (not gzip JSON, or no lift, whole count or landmarks)`);
  const vkept = v.n - v.added - v.press;
  const vhead = `Real video, 7 October (label: David's count, R1; the built app's own read of each whole video): of the ${vkept} sets in the baseline, ${v.exactNow} exact now, ${v.exactBefore} before; ${v.catastrophic} newly catastrophic, ${v.known} known catastrophic (shown, gated on growth), ${v.becameRefused} newly refused${v.added ? `; ${v.added} set${v.added > 1 ? 's' : ''} new since` : ''}; ${Object.values(v.live).filter(c => c === 'refused').length} refused of ${v.n}.`;
  const text = [head, doubtLine(b.doubts), ...b.rows, '', vhead, ...v.rows].join('\n') + '\n';
  writeFileSync(resolve(__dirname, 'scoreboard.txt'), text);
  process.stdout.write(text);
  // R2: a change ships only if the exact count does not decrease and no set becomes catastrophic; a set newly
  // refused counts as catastrophic (third audit, C31). Both sections.
  for (const t of [b, v]) {
    expect(t.exactNow).toBeGreaterThanOrEqual(t.exactBefore);
    expect(t.catastrophic).toBe(0);
    expect(t.becameRefused).toBe(0);
    expect(t.missing).toEqual([]);
  }
  expect(unreadable).toEqual([]);
  expect(video.unreadable).toEqual([]);
  // In CI the committed baseline must hold the live counts: a change that moves a count commits the
  // SCOREBOARD_UPDATE output, and a baseline edited by hand fails, so the next change is compared with the
  // counts the code really gives (third audit, C27). The note and its date are not compared.
  if (process.env.SCOREBOARD_BASE) {
    const committed = JSON.parse(readFileSync(BASELINE, 'utf8'));
    expect(committed.counts).toEqual(b.live);
    expect(committed.videoCounts ?? {}).toEqual(v.live);
  }
  // Only a change that passes the gate is recorded as accepted (review, 30 September).
  if (process.env.SCOREBOARD_UPDATE) writeFileSync(BASELINE, JSON.stringify({ note: `The counts last accepted (${new Date().toISOString().slice(0, 10)}), measured by npm run scoreboard on the live core, not typed. npm run scoreboard compares the live core with these; SCOREBOARD_UPDATE=1 npm run scoreboard records the live counts once a change passes the gate (CLAUDE.md R2). videoCounts: the real-video section (test/real-phone/sets-07oct-video/).`, counts: b.live, videoCounts: v.live }, null, 2) + '\n');
});
