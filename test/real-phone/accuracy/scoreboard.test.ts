// npm run scoreboard      (SCOREBOARD_UPDATE=1 npm run scoreboard once a change is accepted)
// CLAUDE.md R2: every change that can move a count is measured before and after. The live core's count on
// every labelled set on disk, set by set, against its label and against the counts last accepted
// (scoreboard-baseline.json). It fails if fewer sets are exact than before, or if any set is off by 3 or
// more, or if a set that gave a count becomes refused. Bench press and overhead press sets are measured, shown and
// kept in the baseline, and decide nothing (PLAN.md; decides() in sets.ts). Build sets only (David's sets in every test/real-phone/sets-*/ folder and the five build clips): no exam set exists yet,
// and nothing here may tune a parameter. Runs only when asked, so a plain npm test changes no file.
// A second section, "Real video, 7 October", counts David's 14 whole gym videos as the built app read them then, with
// MediaPipe in IMAGE mode (test/real-phone/sets-07oct-video/), under the same rules and its own baseline (videoCounts).
// A third, "Real video, VIDEO mode", counts the same videos read with MediaPipe in VIDEO mode (shipped on the morning
// of 9 October 2026 and withdrawn that evening on this very count: test/real-phone/sets-09oct-video-mode/). It is shown
// against its own baseline (videoModeCounts) and decides nothing while the app reads in IMAGE mode.
// In both, a refused set shows the proposal the app offers on it (coreAnalysis.js withProposal), which decides nothing.
// A fourth, "David's blind counts", counts the sets he collected on his phone with the count he gave before the app
// showed its own (blindSets, sets.ts; blind.js): shown, decides nothing until he says these counts are labels (R1).
// A collected file counted after the app's (labelKind 'after-app') is never a label: it is named as held, and skipped.
// Under each section, one measured line (pillar 2, 9 October 2026): of the sets that would decide, how many show the
// exact number, and how many have the label in the list the result screen can offer, [M, M + 1, M - 1]
// (result-choices.js). It decides nothing; choices.test.ts measures the same on every real-world suite.
import { expect, test } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarizeCount, withProposal, withBodyCheck } from '../../../src/lib/coreAnalysis';
import { countChoices, inList } from '../../../src/components/experience/result-choices';
import { gunzipSync } from 'node:zlib';
import { blindSets, decides, doubtLine, labelledSets, PRESS_DECIDES_NOTHING, videoSets } from './sets';

const BASELINE = resolve(__dirname, 'scoreboard-baseline.json');

const verdict = (count: number | string, label: number) => (count === 'refused' ? 'refused' : count === label ? 'exact' : Math.abs((count as number) - label) >= 3 ? 'catastrophic' : `off ${(count as number) > label ? '+' : ''}${(count as number) - label}`);

type Tally = { rows: string[]; live: Record<string, number | string>; doubts: { flagged: boolean; err: number }[]; exactNow: number; exactBefore: number; catastrophic: number; known: number; becameRefused: number; n: number; added: number; press: number; missing: string[] };

// One section of the scoreboard: each set's live count against its label and against the baseline's count, with the
// tallies of the R2 gate. `count` gives the app's outcome for a set (a number or 'refused').
function section(sets: { name: string; lift: string; label: number }[], baseCounts: Record<string, number | string>, count: (i: number) => { now: number | string; doubt?: { flagged: boolean } | null; note?: string }): Tally {
  const t: Tally = { rows: [], live: {}, doubts: [], exactNow: 0, exactBefore: 0, catastrophic: 0, known: 0, becameRefused: 0, n: 0, added: 0, press: 0, missing: [] };
  const { rows } = t;
  sets.forEach((s, i) => {
    const { now, doubt, note } = count(i), before = baseCounts[s.name];
    const tail = note ? `  ${note}` : '';
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
    rows.push(`${now === before ? '  ' : '->'} ${s.name}  label ${s.label}  before ${before ?? '-'} (${vb})  now ${now} (${v})${tail}`);
  });
  // A set of the baseline no longer on disk is named, and fails the gate: a set is never dropped quietly.
  t.missing = Object.keys(baseCounts).filter(name => !(name in t.live));
  for (const name of t.missing) rows.push(`MISSING ${name}  (in the baseline, not on disk)`);
  return t;
}

// The app's whole path on a set (coreAnalysis.js: count, proposal on a refused set, body check), and the list line.
const appPath = (lift: string, wl: any[], ts: number[], il: any[] | null, appRefused = false) => {
  const c: any = summarizeCount(wl, ts, lift);
  const r: any = withBodyCheck(withProposal({ ...c, refused: c.refused || appRefused, worldLandmarks: wl, timestamps: ts, imageLandmarks: il }, lift), lift);
  return appRefused ? { ...r, notRead: { kind: 'partial' } } : r;
};
function listLine(sets: { lift: string; label: number; result: any }[]) {
  const dec = sets.filter(s => decides(s.lift));
  const ch = dec.map(s => countChoices(s.result));
  const top1 = dec.filter((s, i) => ch[i].main === s.label).length, in3 = dec.filter((s, i) => inList(ch[i], s.label, 3)).length;
  return `In the list (result-choices.js, measured, decides nothing): of the ${dec.length} sets that would decide, the number shown is exact on ${top1}, the label is in [M, M + 1, M - 1] on ${in3}.`;
}

test.skipIf(!process.env.SCOREBOARD)('scoreboard', () => {
  // In CI the counts compared with are the base branch's (SCOREBOARD_BASE), so a change cannot lower the bar by
  // editing the baseline it is compared with (audit of 3 October).
  const base = JSON.parse(readFileSync(process.env.SCOREBOARD_BASE || BASELINE, 'utf8'));
  // The gate compares the sets both runs hold: a set added since cannot hide a regression (review, 30 September).
  const { sets, unreadable, held } = labelledSets();
  const b = section(sets, base.counts, i => { const r = summarizeCount(sets[i].wl, sets[i].ts, sets[i].lift); return { now: r.refused ? 'refused' : r.count, doubt: r.doubt }; });
  for (const name of unreadable) b.rows.push(`UNREADABLE ${name}  (not gzip JSON, or no lift, whole count or landmarks)`);
  for (const h of held) b.rows.push(`HELD ${h.name}  (labelKind ${h.labelKind}: counted after the app's count, no label, R1)`);
  const kept = b.n - b.added - b.press;
  const head = `Scoreboard ${new Date().toISOString().slice(0, 10)}: of the ${kept} sets in the baseline that decide, ${b.exactNow} exact now, ${b.exactBefore} before; ${b.catastrophic} newly catastrophic, ${b.known} known catastrophic (shown, gated on growth), ${b.becameRefused} newly refused${b.added ? `; ${b.added} set${b.added > 1 ? 's' : ''} new since` : ''}. The ${b.press} bench and overhead press sets are measured and decide nothing (PLAN.md). Build sets only; no exam set yet. "->" marks a set whose count moved.`;
  // Real video, 7 October (test/real-phone/sets-07oct-video/, README.md there): David's 13 gym videos read whole by the
  // built app (analyzeCoreVideo), his labels (R1). The same R2 rules, on their own baseline (videoCounts): no exact
  // count lost, none newly off by 3 or more, none newly refused. A read the app itself refused (partial) is refused here.
  // The app's outcome on a whole video, and on a set it refuses, the proposal it offers (shown, decides nothing).
  const videoCount = (s: ReturnType<typeof videoSets>['sets'][number]) => {
    if (s.appRefused) return { now: 'refused' as const };
    const r: any = summarizeCount(s.wl, s.ts, s.lift);
    if (!r.refused) return { now: r.count, doubt: r.doubt };
    const p: any = s.il ? withProposal({ ...r, worldLandmarks: s.wl, timestamps: s.ts, imageLandmarks: s.il }, s.lift) : null;
    return { now: 'refused' as const, note: p?.proposal?.count ? `(proposal ${p.proposal.count})` : '(no proposal)' };
  };
  const video = videoSets();
  const v = section(video.sets, base.videoCounts ?? {}, i => videoCount(video.sets[i]));
  for (const name of video.unreadable) v.rows.push(`UNREADABLE ${name}  (not gzip JSON, or no lift, whole count or landmarks)`);
  const vkept = v.n - v.added - v.press;
  const vhead = `Real video, 7 October (label: David's count, R1; the built app's own read of each whole video): of the ${vkept} sets in the baseline, ${v.exactNow} exact now, ${v.exactBefore} before; ${v.catastrophic} newly catastrophic, ${v.known} known catastrophic (shown, gated on growth), ${v.becameRefused} newly refused${v.added ? `; ${v.added} set${v.added > 1 ? 's' : ''} new since` : ''}; ${Object.values(v.live).filter(c => c === 'refused').length} refused of ${v.n}.`;
  // The same videos read in VIDEO mode (README.md there): measured, decides nothing while the app reads in IMAGE mode.
  const vmode = videoSets({ mode: 'video' });
  const m = section(vmode.sets, base.videoModeCounts ?? {}, i => videoCount(vmode.sets[i]));
  for (const name of vmode.unreadable) m.rows.push(`UNREADABLE ${name}  (not gzip JSON, or no lift, whole count or landmarks)`);
  const mkept = m.n - m.added - m.press;
  const mhead = `Real video, VIDEO mode (the same videos read in VIDEO mode, which the app does not use: measured, decides nothing): of the ${mkept} sets in the baseline, ${m.exactNow} exact now, ${m.exactBefore} before; ${m.catastrophic} newly catastrophic, ${m.known} known catastrophic (shown, gated on growth), ${m.becameRefused} newly refused${m.added ? `; ${m.added} set${m.added > 1 ? 's' : ''} new since` : ''}; ${Object.values(m.live).filter(c => c === 'refused').length} refused of ${m.n}.`;
  // David's blind counts (blindSets): the app's outcome now against the count he gave before seeing it; beside it, the
  // count he kept after seeing the app's, and whether he changed his mind. Measured only.
  const blind = blindSets();
  const bnow = blind.sets.map(s => videoCount({ ...s, appRefused: false, motion: null }) as { now: number | string; note?: string });
  const brows = blind.sets.map((s, i) => {
    const o = bnow[i];
    const changed = s.kept !== s.label ? `  kept ${s.kept} (changed after the app's count)` : `  kept ${s.kept}`;
    return `   ${s.name}  blind ${s.label}  now ${o.now} (${verdict(o.now, s.label)})${o.note ? `  ${o.note}` : ''}${changed}${decides(s.lift) ? '' : `  ${PRESS_DECIDES_NOTHING}`}`;
  });
  for (const name of blind.unsure) brows.push(`   ${name}  answered "Je ne sais pas": no blind count`);
  for (const name of blind.unreadable) brows.push(`UNREADABLE ${name}  (a blind count, but no lift, whole count or landmarks)`);
  const bexact = blind.sets.filter((s, i) => decides(s.lift) && bnow[i].now === s.label).length, bdec = blind.sets.filter(s => decides(s.lift)).length;
  const bhead = `David's blind counts (his count in the app before it showed its own, blind.js; measured, decides nothing until he says these counts are labels, R1): ${blind.sets.length} sets, ${bexact} exact of the ${bdec} that would decide; ${blind.sets.filter(s => s.kept !== s.label).length} kept at another count after seeing the app's; ${blind.unsure.length} answered "Je ne sais pas".`;
  const gzs = (name: string) => JSON.parse(gunzipSync(readFileSync(resolve(__dirname, '..', name))).toString());
  const bList = listLine(sets.map(s => ({ lift: s.lift, label: s.label, result: appPath(s.lift, s.wl, s.ts, gzs(s.name).imageLandmarks ?? null) })));
  const vList = listLine(video.sets.map(s => ({ lift: s.lift, label: s.label, result: appPath(s.lift, s.wl, s.ts, s.il, s.appRefused) })));
  const blList = listLine(blind.sets.map(s => ({ lift: s.lift, label: s.label, result: appPath(s.lift, s.wl, s.ts, s.il) })));
  const text = [head, doubtLine(b.doubts), bList, ...b.rows, '', vhead, vList, ...v.rows, '', mhead, ...m.rows, '', bhead, blList, ...brows].join('\n') + '\n';
  writeFileSync(resolve(__dirname, 'scoreboard.txt'), text);
  process.stdout.write(text);
  // R2: a change ships only if the exact count does not decrease and no set becomes catastrophic; a set newly
  // refused counts as catastrophic (third audit, C31). The two sections the app reads as; the VIDEO-mode one is shown.
  for (const t of [b, v]) {
    expect(t.exactNow).toBeGreaterThanOrEqual(t.exactBefore);
    expect(t.catastrophic).toBe(0);
    expect(t.becameRefused).toBe(0);
    expect(t.missing).toEqual([]);
  }
  expect(unreadable).toEqual([]);
  expect(video.unreadable).toEqual([]);
  expect(vmode.unreadable).toEqual([]);
  expect(m.missing).toEqual([]);
  // In CI the committed baseline must hold the live counts: a change that moves a count commits the
  // SCOREBOARD_UPDATE output, and a baseline edited by hand fails, so the next change is compared with the
  // counts the code really gives (third audit, C27). The note and its date are not compared.
  if (process.env.SCOREBOARD_BASE) {
    const committed = JSON.parse(readFileSync(BASELINE, 'utf8'));
    expect(committed.counts).toEqual(b.live);
    expect(committed.videoCounts ?? {}).toEqual(v.live);
    expect(committed.videoModeCounts ?? {}).toEqual(m.live);
  }
  // Only a change that passes the gate is recorded as accepted (review, 30 September).
  if (process.env.SCOREBOARD_UPDATE) writeFileSync(BASELINE, JSON.stringify({ note: `The counts last accepted (${new Date().toISOString().slice(0, 10)}), measured by npm run scoreboard on the live core, not typed. npm run scoreboard compares the live core with these; SCOREBOARD_UPDATE=1 npm run scoreboard records the live counts once a change passes the gate (CLAUDE.md R2). videoCounts: the real-video section read in IMAGE mode (test/real-phone/sets-07oct-video/); videoModeCounts: the same videos read in VIDEO mode, measured only (test/real-phone/sets-09oct-video-mode/).`, counts: b.live, videoCounts: v.live, videoModeCounts: m.live }, null, 2) + '\n');
}, 300_000); // the proposals (PSC) of the refused sets take a few seconds
