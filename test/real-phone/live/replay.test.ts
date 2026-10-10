// LIVE_REPLAY=1 npx vitest run --no-cache test/real-phone/live/replay.test.ts
// Pillar 3 of David's order of 9 October 2026 (count while filming), first measure (L0): the stored landmarks of every
// labelled set fed sample by sample to the app's live counter (liveCounter.js), as liveEngine.js feeds it, with the
// screen's provisional count worked out every LIVE_EVAL_MS of set time and the numbers displayed kept as Live.jsx keeps
// them (nextShown, shownForResult). It answers what the live path does to the count and to the screen when the samples
// are the recorded path's own: the final count, whether the result screen asks (Result.jsx liveDiffers), numbers
// announced above the final, a shown number going down, and the time to the first number. It does not measure the
// camera, the phone's speed or the frames live would pick (TRIED.md, 9 October 2026). Writes replay.txt.
// Research tool: it changes nothing and gates nothing.
import { test } from 'vitest';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { createLiveCounter, LIVE_EVAL_MS, nextShown, shownForResult } from '../../../src/lib/liveCounter';
import { summarizeCount } from '../../../src/lib/coreAnalysis';
import { labelledSets, videoSets, ROOT } from '../accuracy/sets';

const read = (p: string) => JSON.parse(gunzipSync(readFileSync(p)).toString());
function replay(lift: string, world: any[], image: any[] | null, t: number[]) {
  const live = createLiveCounter(lift);
  let next = t[0] + LIVE_EVAL_MS / 1000, rec: any = null, prev: number | null = null, drops = 0, firstAt: number | null = null, maxShown = 0;
  const evalNow = (at: number) => {
    const e = live.evaluate();
    rec = nextShown(rec, e.count);
    if (Number.isInteger(e.count) && e.count > 0) {
      if (prev !== null && e.count < prev) drops++;
      prev = e.count; maxShown = Math.max(maxShown, e.count);
      if (firstAt === null) firstAt = at - t[0];
    }
  };
  for (let k = 0; k < t.length; k++) {
    live.push({ image: image?.[k] ?? null, world: world[k], t: t[k], width: 360, height: 640 });
    while (k + 1 < t.length && t[k + 1] > next) { evalNow(next); next += LIVE_EVAL_MS / 1000; }
  }
  const fin: any = live.finish(), batch: any = summarizeCount(world, t, lift);
  const final = fin.refused ? null : fin.count;
  const shown = shownForResult(rec, final);
  return { final, refused: !!fin.refused, same: fin.count === batch.count && !!fin.refused === !!batch.refused, shown, asks: final !== null && final > 0 && shown !== null && shown !== final, over: maxShown > (final ?? 0), drops, firstAt };
}
const f2 = (x: number | null) => (x === null ? '-' : x.toFixed(1));

test.skipIf(!process.env.LIVE_REPLAY)('the live counter on the stored samples', () => {
  const L: string[] = [`Live replay (L0), ${new Date().toISOString().slice(0, 10)}: liveCounter.js on the stored samples, provisional count every ${LIVE_EVAL_MS} ms of set time.`];
  const block = (title: string, sets: { name: string; lift: string; label: number; wl: any[]; ts: number[]; il: any[] | null; partial?: boolean }[]) => {
    let exact = 0, same = 0, asks = 0, over = 0, dropped = 0;
    const rows: string[] = [];
    for (const s of sets) {
      const r = replay(s.lift, s.wl, s.il, s.ts);
      const final = s.partial ? 'refused (partial read)' : r.refused ? 'refused' : r.final;
      if (!s.partial && r.final === s.label) exact++;
      if (r.same) same++; if (r.asks) asks++; if (r.over) over++; if (r.drops) dropped++;
      rows.push(`  ${s.name}  label ${s.label}  final ${final}${r.same ? '' : ' (NOT the batch count)'}  last shown for the result ${r.shown ?? '-'}${r.asks ? '  ASKS' : ''}${r.over ? '  above the final announced' : ''}${r.drops ? `  shown number went down ${r.drops}x` : ''}  first number ${f2(r.firstAt)} s`);
    }
    L.push('', `${title}: ${sets.length} sets; final = batch count on ${same}; exact ${exact}; the result asks (a number shown live is not the final) on ${asks}; a number above the final announced on ${over}; a shown number went down on ${dropped}.`, ...rows);
  };
  block('David\'s real videos (sets-07oct-video)', videoSets().sets.map(s => ({ name: s.name, lift: s.lift, label: s.label, wl: s.wl, ts: s.ts, il: s.il, partial: s.appRefused })));
  block('David\'s stored sets', labelledSets().sets.map(s => ({ name: s.name, lift: s.lift, label: s.label, wl: s.wl, ts: s.ts, il: read(resolve(ROOT, s.name)).imageLandmarks ?? null })));
  const D = resolve(ROOT, 'synth/sets');
  block('Synthetic sets (truth: the generator\'s reps)', readdirSync(D).filter(f => f.endsWith('.json.gz')).sort().map(f => { const d = read(resolve(D, f)); return { name: `synth/${f}`, lift: d.params.exercise, label: d.reps.length, wl: d.worldLandmarks, ts: d.timestamps, il: null }; }));
  const text = L.join('\n') + '\n';
  writeFileSync(resolve(__dirname, 'replay.txt'), text);
  process.stdout.write(text.split('\n').filter(l => !l.startsWith('  ')).join('\n') + '\n');
}, 1_800_000);
