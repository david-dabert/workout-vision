#!/usr/bin/env node
/**
 * Demo footage from Wikimedia Commons (no API key), ranked by what the app's pose pipeline sees in it
 * (14 October 2026). Per subject: search Commons' File namespace for videos, keep each file's licence, author and
 * page, download up to PER_SUBJECT of them, read each through the app's harness (test/real-phone/harness.html) in
 * Chromium, and measure: the share of samples where landmarks 11 to 28 are all seen (visibility > 0.5), the median
 * body height as a share of the frame, and camera motion (median frame-to-frame shift of the hip midpoint, share of
 * the frame). Numbers only; no judgement. Writes data/footage/commons.json and prints a Markdown ranking.
 * Runs in CI (.github/workflows/footage-commons.yml), where Commons is reachable.
 *
 *   node scripts/footage/commons.mjs
 */
import { mkdirSync, writeFileSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const arg = (n, d) => (process.argv.find(a => a.startsWith(`--${n}=`)) ?? `=${d}`).split('=')[1];
const PER_SUBJECT = Number(arg('per', '6'));
const MAX_MB = Number(arg('maxmb', '60'));
const HARNESS = arg('harness', 'http://localhost:5173/workout-vision/test/real-phone/harness.html');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'WorkoutVision-footage/1.0 (https://github.com/david-dabert/workout-vision)';

export const SUBJECTS = {
  golf: ['golf swing', 'golfer swing', 'golf drive'],
  tennis: ['tennis serve', 'tennis forehand', 'tennis player'],
  padel: ['padel', 'padel tennis'],
  rowing: ['rowing machine', 'ergometer rowing', 'indoor rowing'],
  cycling: ['indoor cycling', 'cycling trainer', 'cyclist pedaling'],
  running: ['treadmill running', 'running gait', 'sprinter running'],
  jump: ['countermovement jump', 'vertical jump', 'high jump'],
  volleyball: ['volleyball spike', 'volleyball jump', 'volleyball'],
  baseball: ['baseball pitch', 'baseball pitcher', 'baseball swing'],
  skiing: ['alpine skiing', 'slalom ski', 'ski racing'],
  swimming: ['swimming freestyle', 'swimming stroke', 'swimmer'],
  dressage: ['dressage', 'horse riding dressage'],
  horse_trot: ['horse trot', 'horse trotting'],
  dog_trot: ['dog trotting', 'dog running', 'dog gait'],
};
const HUMAN = s => !['horse_trot', 'dog_trot'].includes(s);

async function api(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: 'json', origin: '*', ...params })) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`Commons ${r.status}`);
  return r.json();
}

async function search(q) {
  const j = await api({ action: 'query', list: 'search', srsearch: `${q} filetype:video`, srnamespace: '6', srlimit: '20' });
  return (j.query?.search ?? []).map(x => x.title);
}

async function info(titles) {
  const j = await api({ action: 'query', prop: 'imageinfo', titles: titles.join('|'), iiprop: 'url|size|mime|extmetadata|mediatype' });
  return Object.values(j.query?.pages ?? {}).map(p => {
    const i = p.imageinfo?.[0];
    if (!i) return null;
    const m = i.extmetadata ?? {};
    const strip = s => String(s ?? '').replace(/<[^>]+>/g, '').trim();
    return { title: p.title, url: i.url, page: i.descriptionurl, mime: i.mime, bytes: i.size, width: i.width, height: i.height,
      duration: i.duration ?? null, licence: strip(m.LicenseShortName?.value), licenceUrl: strip(m.LicenseUrl?.value), author: strip(m.Artist?.value) };
  }).filter(Boolean);
}

const median = xs => { const v = xs.filter(Number.isFinite).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };

function measure(r) {
  const n = r.timestamps.length;
  const full = r.worldLandmarks.filter(f => f && [...Array(18)].every((_, k) => (f[11 + k]?.visibility ?? 0) > 0.5)).length;
  const heights = [], shifts = [];
  let prev = null;
  for (const f of r.imageLandmarks) {
    if (!f) { prev = null; continue; }
    const ys = f.map(p => p.y).filter(Number.isFinite);
    heights.push(Math.max(...ys) - Math.min(...ys));
    const hip = { x: (f[23].x + f[24].x) / 2, y: (f[23].y + f[24].y) / 2 };
    if (prev) shifts.push(Math.hypot(hip.x - prev.x, hip.y - prev.y));
    prev = hip;
  }
  return { samples: n, fullBodyShare: n ? full / n : 0, bodyHeight: median(heights), cameraMotion: median(shifts) };
}

// Clips go under public/footage-tmp/ so the dev server serves them to the harness; never committed (CI only).
const CLIPS = join('public', 'footage-tmp');
mkdirSync(CLIPS, { recursive: true });
const { chromium } = await import('@playwright/test');
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const results = [];
for (const [subject, queries] of Object.entries(SUBJECTS)) {
  const titles = [...new Set((await Promise.all(queries.map(search))).flat())].slice(0, 40);
  const files = titles.length ? (await info(titles)).filter(f => f.bytes <= MAX_MB * 1e6 && /video/.test(f.mime)) : [];
  files.sort((a, b) => (b.width * b.height) - (a.width * a.height));
  console.log(`${subject}: ${titles.length} found, ${files.length} videos under ${MAX_MB} MB`);
  for (const f of files.slice(0, PER_SUBJECT)) {
    const name = `${subject}--${f.title.replace(/^File:/, '').replace(/[^\w.-]+/g, '_')}`;
    const local = join(CLIPS, name);
    let m = null, error = null;
    try {
      const r = await fetch(f.url, { headers: { 'User-Agent': UA } });
      await pipeline(Readable.fromWeb(r.body), createWriteStream(local));
      if (HUMAN(subject)) {
        const page = await browser.newPage();
        await page.goto(HARNESS);
        await page.waitForFunction(() => window._harnessReady === true, null, { timeout: 60000 });
        const served = `/workout-vision/footage-tmp/${name}`;
        const res = await page.evaluate(async u => { const x = await window._fetchAndProcess(u); return { timestamps: x.timestamps, worldLandmarks: x.worldLandmarks, imageLandmarks: x.imageLandmarks }; }, served);
        m = measure(res);
        await page.close();
      }
    } catch (e) { error = String(e.message ?? e).split('\n')[0]; }
    results.push({ subject, ...f, local, ...m, error });
    console.log(`  ${f.title} ${f.width}x${f.height} ${f.licence} -> ${error ? 'ERROR ' + error : m ? `full ${(m.fullBodyShare * 100).toFixed(0)} %, height ${(m.bodyHeight ?? 0).toFixed(2)}, motion ${(m.cameraMotion ?? 0).toFixed(3)}` : 'metadata only'}`);
  }
}
await browser.close();
mkdirSync('data/footage', { recursive: true });
writeFileSync('data/footage/commons.json', JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), source: 'Wikimedia Commons', results }, null, 1) + '\n');

console.log('\n### Commons footage, ranked per subject (full-body share, then body height, then camera stillness)\n');
console.log('| Subject | File | Licence | Size | Full body | Body height | Camera motion |');
console.log('|---|---|---|---|---|---|---|');
for (const s of Object.keys(SUBJECTS)) {
  const rows = results.filter(r => r.subject === s).sort((a, b) => (b.fullBodyShare ?? -1) - (a.fullBodyShare ?? -1) || (b.bodyHeight ?? 0) - (a.bodyHeight ?? 0) || (a.cameraMotion ?? 9) - (b.cameraMotion ?? 9));
  for (const r of rows) console.log(`| ${s} | [${r.title.replace(/^File:/, '')}](${r.page}) | ${r.licence} | ${r.width}x${r.height} | ${r.error ? 'error' : r.fullBodyShare == null ? 'n/a' : (r.fullBodyShare * 100).toFixed(0) + ' %'} | ${r.bodyHeight?.toFixed(2) ?? ''} | ${r.cameraMotion?.toFixed(3) ?? ''} |`);
}
