// MG_MOTION=<motion.json from frames.mjs> MG_OUT=<rows.json> [MG_EXTRA_DIR=<exposed held-out landmark files>] npx vitest run --no-cache test/real-phone/motion-gate/gate.test.ts
// The image-motion count beside the core's, on the Countix build sets (plan.md; bench only, the app imports none of it;
// measured, decides nothing). Per set: its half (A or B, as compare-variants reads them), label, the core's count as the
// public scoreboard scores it (inside the labelled window), whether the app shows it as sure today (sure.ts sureRow),
// and the motion count with its confidence (a whole clip's peaks counted inside its window).
import { test } from 'vitest';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { summarizeCount, withBodyCheck } from '../../../src/lib/coreAnalysis';
import { countInWindow, publicSets } from '../accuracy/sets';
import { sureRow } from '../accuracy/sure';

const half = (name: string) => (parseInt(createHash('sha256').update('variant:' + name.split('/').pop()!.slice(0, 11)).digest('hex')[0], 16) < 8 ? 'A' : 'B');

test.skipIf(!process.env.MG_MOTION || !process.env.MG_OUT)('the motion count beside the core on the Countix sets', () => {
  const motion = JSON.parse(readFileSync(process.env.MG_MOTION!, 'utf8'));
  const rows: Record<string, any> = {};
  const put = (name: string, suite: string, id: string, lift: string, label: number, wl: any[], ts: number[], window?: [number, number]) => {
    const countOf = window ? (x: any) => countInWindow(x.reps ?? [], window) : (x: any) => x.count;
    const c: any = summarizeCount(wl, ts, lift);
    const app = withBodyCheck({ ...c, worldLandmarks: wl, timestamps: ts, imageLandmarks: null }, lift);
    const s = sureRow(app, lift, label, countOf);
    const m = motion[id];
    let mc: any = null;
    if (m && !m.error) {
      if (window) mc = { count: (m.whole.peaksAt ?? []).filter((t: number) => t >= window[0] && t <= window[1]).length, confidence: m.whole.confidence };
      else mc = { count: m.trim.count, confidence: m.trim.confidence };
    }
    rows[name] = { suite, lift, label, core: c.refused ? 'refused' : countOf(c), appSure: s.err !== null && !s.flagged && !s.moved, motion: mc };
  };
  for (const s of publicSets('build').sets) {
    if (s.dataset !== 'countix' && s.dataset !== 'countix-whole') continue;
    put(s.name, half(s.name), s.name.split('/').pop()!.replace(/\.json\.gz$/, ''), s.lift, s.label, s.wl, s.ts, s.window);
  }
  // The second look, not sealed: the Countix held-out sets exposed on 24 October, read from where they were rebuilt.
  if (process.env.MG_EXTRA_DIR) {
    const D = process.env.MG_EXTRA_DIR;
    for (const f of readdirSync(D).filter(f => f.endsWith('.json.gz')).sort()) {
      const d = JSON.parse(gunzipSync(readFileSync(resolve(D, f))).toString());
      put(`exposed/${f}`, 'exposed', f.replace(/\.json\.gz$/, ''), d.lift, d.count, d.worldLandmarks, d.timestamps, d.window);
    }
  }
  writeFileSync(process.env.MG_OUT!, JSON.stringify(rows) + '\n');
}, 7_200_000);
