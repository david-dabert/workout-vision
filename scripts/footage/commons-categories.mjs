#!/usr/bin/env node
/**
 * Demo footage from Wikimedia Commons by category (15 October 2026), replacing the hand-typed table of PR #189.
 * Per subject: every video in its Commons categories (and one level of subcategories), plus the three files PR #189
 * listed, which are always checked. Every column comes from Commons' API or from the app's pose pipeline; nothing is
 * typed in. Licences kept: CC0, public domain, CC BY, CC BY-SA (no NC, no ND). Files over MAX_MB are dropped.
 * Human subjects are read through the app's harness (test/real-phone/harness.html) in Chromium, measured as in
 * scripts/footage/commons.mjs: share of samples with landmarks 11 to 28 all seen (visibility > 0.5), median body height
 * as a share of the frame, and median frame-to-frame shift of the hip midpoint. That shift mixes camera motion with the
 * subject's own travel (a runner crossing a still frame moves too), so it is reported as hip motion, not as camera.
 * Animals are not read: the pose model is human; their rows are metadata only, and fixed or moving camera and whole
 * animal in view stay for David to judge on the clip. Writes data/footage/commons-categories.json and prints Markdown.
 * Runs in CI (.github/workflows/footage-commons-categories.yml), where Commons is reachable.
 * Its helpers repeat those of commons.mjs so that a change here does not trigger that 70-minute job.
 *
 *   node scripts/footage/commons-categories.mjs [--per=6] [--maxmb=60]
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
const VIDEO = /\.(webm|ogv|ogg|mp4|mpg|mpeg)$/i;

// Categories as named in PR #189's scripts; `listed` holds the files PR #189's table put forward, checked by name.
export const SUBJECTS = {
  golf_swing: {
    categories: ['Videos of golf', 'Swing (golf)'],
    listed: ['Stacy Prammanasudh practicing on the DR during 2008 WBO.ogv', 'Golfputt.ogv',
      'Dirk Oosterveer demonstreert staaltjes van golftechniek Weeknummer 39-16 - Open Beelden - 30179.ogv'],
  },
  tennis_serve: {
    categories: ['Videos of tennis', 'Service (tennis)'],
    listed: ['Maria Sharapova on Amelia Island.ogv', 'EVD-tenis-004.ogv', 'EVD-tenis-001.ogv'],
  },
  rowing_ergometer: {
    categories: ['Indoor rowing', 'Indoor rowers', 'Rowing machines', 'Concept2 Indoor Rower'],
    listed: ['DFN-DoD Warrior Games Rowing Day 3, COLORADO SPRINGS, CO, UNITED STATES, 05.31.2018.webm',
      'Severe-aberrant-glenohumeral-motor-patterns-in-a-young-female-rower-A-case-report-1746-1340-15-17-S1.ogv',
      'Video of man rowing in a professional sport rowing boat at Regattastrecke Oberschleißheim, Germany.webm'],
  },
  indoor_cycling: {
    categories: ['Stationary bicycles', 'Bicycle trainers', 'Tacx Booster trainer', 'Indoor cycling'],
    listed: ['TdF 2022 Castelnau-Magnoac Échauffement Jumbo-Visma.webm', 'Electricity generating exercise bike build log.webm',
      'Kiwanis Spinning Event haalt 10.000 euro op voor Leontienhuis.webm'],
  },
  running: {
    categories: ['Videos about running', 'Treadmills'],
    listed: ['Running form.ogv',
      'Effect-of-Running-Speed-and-Leg-Prostheses-on-Mediolateral-Foot-Placement-and-Its-Variability-pone.0115637.s007.ogv',
      'Humans-Running-in-Place-on-Water-at-Simulated-Reduced-Gravity-pone.0037300.s002.ogv'],
  },
  swimming: {
    categories: ['Videos of swimming', 'Freestyle swimming'],
    listed: ['Front Crawl Above Water.webm', "Mary's Swim Boot Camp - Kari freestyle.webm",
      'Europese zwemkampioenschappen voor de jeugd Weeknummer 71-34 - Open Beelden - 12744.ogv'],
  },
  skiing: {
    categories: ['Videos of skiing', 'Videos of alpine skiing'],
    listed: ['Todtnauberg-Winter-07-08-skiing.ogv', 'Hintertux Tiefschneefahren in der Laermstange.ogv',
      'Hintertux Zwischen Gefrorene Wand und Hoher Riffler.01.ogv'],
  },
  high_jump: {
    categories: ['High jump'],
    listed: [1, 2, 3].map(n => `Grand Prix Sudamericanos Estrella Puente - Darwin Piñeyrúa 2019 - Salto alto masculino - 0${n}.webm`),
  },
  horse_trot: {
    categories: ['Trotting horses', 'Trot (dressage)', 'Harness racing'],
    listed: ['Breeze walk trot right (50544837522).webm', 'Trot animated.webm', 'Harness racing New Zealand.webm'],
  },
  dog_trot: {
    categories: ['Dogs trotting', 'Dog gaits', 'Running dogs'],
    listed: ['Quantitative-Phenotyping-of-Duchenne-Muscular-Dystrophy-Dogs-by-Comprehensive-Gait-Analysis-and-pone.0059875.s003.ogv',
      'Identification-of-Behaviour-in-Freely-Moving-Dogs-(Canis-familiaris)-Using-Inertial-Sensors-pone.0077814.s009.ogv',
      'Slow motion of running greyhound.webm'],
  },
};
const HUMAN = s => !['horse_trot', 'dog_trot'].includes(s);

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(params, attempt = 0) {
  const u = new URL(API);
  for (const [k, v] of Object.entries({ format: 'json', origin: '*', ...params })) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { 'User-Agent': UA } });
  if (r.status === 429 && attempt < 4) { await sleep(2000 * 2 ** attempt); return api(params, attempt + 1); }
  if (!r.ok) throw new Error(`Commons ${r.status}`);
  return r.json();
}

async function members(category, type) {
  const out = [];
  let cont;
  do {
    const j = await api({ action: 'query', list: 'categorymembers', cmtitle: `Category:${category}`, cmtype: type, cmlimit: '500', ...(cont ? { cmcontinue: cont } : {}) });
    out.push(...(j.query?.categorymembers ?? []).map(x => x.title));
    cont = j.continue?.cmcontinue;
  } while (cont && out.length < 1000);
  return out;
}

const strip = s => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
async function info(titles) {
  const out = [];
  for (let i = 0; i < titles.length; i += 50) {
    const j = await api({ action: 'query', prop: 'imageinfo|categories', cllimit: 'max', titles: titles.slice(i, i + 50).join('|'),
      iiprop: 'url|size|mime|extmetadata' });
    for (const p of Object.values(j.query?.pages ?? {})) {
      const i0 = p.imageinfo?.[0];
      if (!i0) { out.push({ title: p.title, missing: true }); continue; }
      const m = i0.extmetadata ?? {};
      out.push({ title: p.title, url: i0.url, page: i0.descriptionurl, mime: i0.mime, bytes: i0.size, width: i0.width,
        height: i0.height, duration: i0.duration ?? null, licence: strip(m.LicenseShortName?.value), author: strip(m.Artist?.value),
        categories: (p.categories ?? []).map(c => c.title.replace(/^Category:/, '')) });
    }
  }
  return out;
}

// CC0, public domain, CC BY, CC BY-SA; anything naming NC or ND, or no licence at all, is out.
export function openLicence(l) {
  const s = String(l ?? '').toLowerCase();
  if (!s || /\bnc\b|\bnd\b|non-?commercial|no ?deriv/.test(s)) return false;
  return /cc0|cc-zero|public domain|^pd\b|cc[ -]by/.test(s);
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
  return { samples: n, fullBodyShare: n ? full / n : 0, bodyHeight: median(heights), hipMotion: median(shifts) };
}

// Clips go under public/footage-tmp/ so the dev server serves them to the harness; never committed (CI only).
const CLIPS = join('public', 'footage-tmp');
mkdirSync(CLIPS, { recursive: true });
const { chromium } = await import('@playwright/test');
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const results = [], tallies = {};
for (const [subject, { categories, listed }] of Object.entries(SUBJECTS)) {
  const from = new Map(); // title -> category it was found in
  for (const c of categories) {
    const subcats = (await members(c, 'subcat')).map(t => t.replace(/^Category:/, ''));
    for (const cat of [c, ...subcats.slice(0, 10)]) for (const t of await members(cat, 'file')) if (VIDEO.test(t) && !from.has(t)) from.set(t, cat);
  }
  const listedTitles = listed.map(t => `File:${t}`);
  const all = await info([...new Set([...listedTitles, ...from.keys()])]);
  const isListed = f => listedTitles.some(t => t.replace(/_/g, ' ') === f.title);
  const rows = all.map(f => ({ subject, ...f, listed: isListed(f), foundIn: from.get(f.title) ?? null }));
  const eligible = rows.filter(f => !f.missing && openLicence(f.licence) && f.bytes <= MAX_MB * 1e6 && /video/.test(f.mime));
  tallies[subject] = { inCategories: from.size, missingListed: rows.filter(r => r.listed && r.missing).length,
    closedLicence: rows.filter(r => !r.missing && !openLicence(r.licence)).length, tooBig: rows.filter(r => !r.missing && r.bytes > MAX_MB * 1e6).length,
    eligible: eligible.length };
  console.log(`${subject}: ${JSON.stringify(tallies[subject])}`);
  // The listed files that pass, then the largest frames among the rest, up to PER_SUBJECT read.
  eligible.sort((a, b) => (b.listed - a.listed) || (b.width * b.height) - (a.width * a.height));
  const chosen = new Set(eligible.slice(0, Math.max(PER_SUBJECT, eligible.filter(e => e.listed).length)));
  for (const f of rows) {
    if (!chosen.has(f)) { if (f.listed) results.push({ ...f, read: false, why: f.missing ? 'not on Commons' : !openLicence(f.licence) ? `licence ${f.licence || 'none'}` : f.bytes > MAX_MB * 1e6 ? 'over size' : 'not video' }); continue; }
    let m = null, error = null;
    if (HUMAN(subject)) {
      const name = `${subject}--${f.title.replace(/^File:/, '').replace(/[^\w.-]+/g, '_')}`;
      try {
        const r = await fetch(f.url, { headers: { 'User-Agent': UA } });
        if (!r.ok) throw new Error(`download ${r.status}`);
        await pipeline(Readable.fromWeb(r.body), createWriteStream(join(CLIPS, name)));
        const page = await browser.newPage();
        await page.goto(HARNESS);
        await page.waitForFunction(() => window._harnessReady === true, null, { timeout: 60000 });
        const res = await page.evaluate(async u => { const x = await window._fetchAndProcess(u); return { timestamps: x.timestamps, worldLandmarks: x.worldLandmarks, imageLandmarks: x.imageLandmarks }; }, `/workout-vision/footage-tmp/${name}`);
        m = measure(res);
        await page.close();
      } catch (e) { error = String(e.message ?? e).split('\n')[0]; }
    }
    results.push({ ...f, read: HUMAN(subject), ...m, error });
    console.log(`  ${f.title} -> ${error ? 'ERROR ' + error : m ? `full ${(m.fullBodyShare * 100).toFixed(0)} %, height ${(m.bodyHeight ?? 0).toFixed(2)}, hip ${(m.hipMotion ?? 0).toFixed(3)}` : 'metadata only'}`);
  }
}
await browser.close();
mkdirSync('data/footage', { recursive: true });
const fetched = new Date().toISOString().slice(0, 10);
writeFileSync('data/footage/commons-categories.json', JSON.stringify({ fetched, source: 'Wikimedia Commons API', maxMb: MAX_MB, tallies, results }, null, 1) + '\n');

const cell = s => String(s ?? '').replace(/\|/g, '\\|');
const pct = x => x == null ? '' : `${(x * 100).toFixed(0)} %`;
console.log(`\n### Commons footage by category, ${fetched}\n`);
console.log('Every cell from the Commons API or the app\'s pose pipeline. Hip motion mixes camera motion with the subject\'s travel. Animals: metadata only.\n');
console.log('| Subject | Category | File | Licence | Author | Duration | Resolution | MB | Full body | Body height | Hip motion | PR #189 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const s of Object.keys(SUBJECTS)) {
  const rows = results.filter(r => r.subject === s).sort((a, b) => (b.fullBodyShare ?? -1) - (a.fullBodyShare ?? -1) || (b.bodyHeight ?? 0) - (a.bodyHeight ?? 0));
  for (const r of rows) {
    const file = r.page ? `[${cell(r.title.replace(/^File:/, ''))}](${r.page})` : cell(r.title.replace(/^File:/, ''));
    const status = r.why ?? (r.error ? `error: ${cell(r.error)}` : '');
    console.log(`| ${s} | ${cell(r.foundIn ?? (r.missing ? '' : 'not in these categories'))} | ${file} | ${cell(r.licence)} | ${cell(r.author?.slice(0, 60))} | ${r.duration != null ? r.duration.toFixed(1) + ' s' : ''} | ${r.width ? `${r.width}×${r.height}` : ''} | ${r.bytes ? (r.bytes / 1e6).toFixed(1) : ''} | ${status || (r.read ? pct(r.fullBodyShare) : 'not read')} | ${r.bodyHeight?.toFixed(2) ?? ''} | ${r.hipMotion?.toFixed(3) ?? ''} | ${r.listed ? 'listed' : ''} |`);
  }
}
