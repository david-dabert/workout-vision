/**
 * Video packer page script (pack.html; rules in lib/pack.js, one video in lib/videoPack.js). David picks the videos of
 * his sets, the page makes each small on the phone, one at a time, and he types the exercise and the reps he counted
 * beside each; then one file (or a few, under a size he chooses) holds the packed videos and labels.json. The page
 * shows no count of the app's, so his counts are blind (R1). Each packed video is kept on the phone (IndexedDB) as soon
 * as it is made, with its label, so a reload or an evicted tab loses no work already done; nothing leaves the phone
 * until he shares or downloads the file.
 */
import localforage from 'localforage';
import { packVideo } from './lib/videoPack';
import { hashVideoContent } from './lib/collector';
import { filmingOrder, carryChoice, oneAtATime } from './lib/batchCollect';
import { watchInterruption, whenVisible, holdScreenAwake, isInterruption } from './lib/interruption';
import { COLLECTOR_LIFTS } from './lib/collectorLifts';
import { bppFrom, fileKey, parseCount, packedName, packFileName, planParts, labelsFor, zipStored, textEntry, sizeText } from './lib/pack';

const LIFTS = COLLECTOR_LIFTS;
const VIEWS = [['', '—'], ['side', 'Side'], ['front', 'Front'], ['angle', 'Angle']];
// The original is hashed (its SHA-256, as the committed sets record videoSha256) only up to this size: hashing reads
// the whole file into memory at once. Source: convention (a 4K minute is about 400 MB). Status: convention.
const HASH_MAX_BYTES = 300e6;
const BPP = bppFrom(location.search);
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null;

const store = localforage.createInstance({ name: 'workoutVision', storeName: 'packed' });
const $ = id => document.getElementById(id);
const setsEl = $('sets'), summaryEl = $('summary');
let rows = [], running = false, made = [];

const option = (value, text) => Object.assign(document.createElement('option'), { value, textContent: text });
// What is kept of a row: its label and, once packed, its video; never the original file.
const saved = r => ({ key: r.key, order: r.order, name: r.name, size: r.size, lastModified: r.lastModified, lift: r.lift, count: r.count, view: r.view, touched: r.touched || null, sha256: r.sha256 ?? null, packed: r.packed ?? null, video: r.video ?? null });
async function keep(r) { try { await store.setItem(r.key, saved(r)); } catch (e) { r.note = `Not kept on this phone: ${e.message}`; paint(r); } }

function render() {
  for (const old of setsEl.querySelectorAll('video')) { old.removeAttribute('src'); old.load(); }
  setsEl.replaceChildren(...rows.map((row, i) => {
    const box = document.createElement('div');
    box.innerHTML = `<div class="set-head"><b>Video ${i + 1}</b><span></span></div>
      <div class="thumb"><video muted playsinline preload="metadata"></video><em></em><button type="button" class="close-video">Close the video</button></div>
      <label for="lift${i}">Exercise</label><select id="lift${i}"></select>
      <div class="row"><div><label for="count${i}">Reps you counted</label><input type="text" id="count${i}" inputmode="numeric" autocomplete="off" placeholder="—"></div>
      <div><label for="view${i}">Camera view</label><select id="view${i}"></select></div></div>
      <div class="state"></div><div class="bar-wrap"><div class="bar-fill"></div></div>`;
    box.querySelector('.set-head span').textContent = row.name;
    const video = box.querySelector('video');
    // The thumbnail plays the packed video once there is one (small, and still there after a reload), else the
    // original; it loads only near the screen (watchThumbs), as the batch collector does with a pick of 100.
    row.url ??= row.video?.blob ? URL.createObjectURL(row.video.blob) : row.file ? URL.createObjectURL(row.file) : null;
    if (row.url) video.dataset.src = `${row.url}#t=0.5`;
    if (row.packed?.seconds) box.querySelector('.thumb em').textContent = `${Math.round(row.packed.seconds)} s`;
    video.controls = !!row.open;
    video.addEventListener('click', () => { if (!row.open) openRow(row); });
    box.querySelector('.close-video').addEventListener('click', () => closeRow(row));
    const lift = box.querySelector('select[id^=lift]'), view = box.querySelector('select[id^=view]'), count = box.querySelector('input');
    lift.append(option('', 'Choose…'), ...LIFTS.map(l => option(l.key, l.label)));
    view.append(...VIEWS.map(([v, t]) => option(v, t)));
    lift.value = row.lift; view.value = row.view; count.value = row.count ?? '';
    const choose = (key, value) => {
      row[key] = value; row.touched = { ...row.touched, [key]: true };
      carryChoice(rows, i, key, value);
      rows.forEach((r, j) => { const el = r.el?.querySelector(`#${key}${j}`); if (el) el.value = r[key]; });
      rows.slice(i).forEach(r => keep(r));
      summarize();
    };
    lift.addEventListener('change', () => choose('lift', lift.value));
    view.addEventListener('change', () => choose('view', view.value));
    count.addEventListener('input', () => {
      const n = parseCount(count.value);
      row.countText = count.value;
      if (n !== undefined) { row.count = n; row.touched = { ...row.touched, count: true }; keep(row); }
      paint(row); summarize();
    });
    row.el = box;
    paint(row);
    return box;
  }));
  watchThumbs();
  summarize();
}

let thumbs = null;
function watchThumbs() {
  thumbs?.disconnect();
  if (typeof IntersectionObserver !== 'function') { for (const v of setsEl.querySelectorAll('video')) if (v.dataset.src) v.src = v.dataset.src; return; }
  thumbs = new IntersectionObserver(entries => {
    for (const { target: v, isIntersecting } of entries) {
      if (isIntersecting) { if (!v.getAttribute('src') && v.dataset.src) v.src = v.dataset.src; }
      else if (v.getAttribute('src') && !v.closest('.open')) { v.pause(); v.removeAttribute('src'); v.load(); }
    }
  }, { rootMargin: '300px 0px' });
  for (const v of setsEl.querySelectorAll('video')) thumbs.observe(v);
}

function openRow(row) {
  for (const r of rows) if (r !== row && r.open) closeRow(r);
  row.open = true; paint(row);
  const v = row.el?.querySelector('video');
  if (v) { if (!v.getAttribute('src') && v.dataset.src) v.src = v.dataset.src; v.controls = true; }
}

function closeRow(row) {
  row.open = false; paint(row);
  const v = row.el?.querySelector('video');
  if (!v) return;
  v.pause(); v.controls = false;
  const r = v.getBoundingClientRect(), margin = 300;
  if (v.getAttribute('src') && (r.bottom < -margin || r.top > innerHeight + margin)) { v.removeAttribute('src'); v.load(); }
}

function paint(row, pct) {
  if (!row.el) return;
  const bad = row.state === 'failed' || parseCount(row.countText ?? row.count ?? '') === undefined;
  row.el.className = `set ${row.state === 'done' && !bad ? 'done' : bad ? 'failed' : ''}${row.open ? ' open' : ''}`;
  const countNote = parseCount(row.countText ?? row.count ?? '') === undefined ? ' The reps must be a whole number from 0 to 99.' : '';
  row.el.querySelector('.state').textContent = `${row.note || ''}${countNote}`;
  const fill = row.el.querySelector('.bar-fill');
  if (pct !== undefined) fill.style.width = `${Math.round(pct)}%`;
  else fill.style.width = row.state === 'done' ? '100%' : '0%';
}

function summarize() {
  const done = rows.filter(r => r.state === 'done'), failed = rows.filter(r => r.state === 'failed');
  const labelled = done.filter(r => r.lift && Number.isInteger(r.count)).length;
  const bytes = done.reduce((s, r) => s + (r.video?.size ?? 0), 0);
  summaryEl.textContent = rows.length
    ? `${done.length} of ${rows.length} packed (${sizeText(bytes)})${failed.length ? `, ${failed.length} failed` : ''}; ${labelled} with exercise and reps.${running ? ' Packing: keep the screen on.' : ''}`
    : '';
  $('make-box').hidden = !done.length;
  $('clear').hidden = running || !rows.some(r => r.video);
  $('pick').disabled = false;
}

// Rows for newly picked files, in filming order, after those already there; a file already on the page is not added
// twice (its name, size and date: lib/pack.js fileKey).
function addFiles(files) {
  const have = new Set(rows.map(r => r.key));
  const prev = rows[rows.length - 1] || { lift: '', view: '' };
  let order = rows.reduce((m, r) => Math.max(m, r.order), 0);
  for (const file of filmingOrder(files)) {
    const key = fileKey(file);
    // A row kept from before a reload but never packed takes its file back and is packed now.
    const back = rows.find(r => r.key === key && !r.video && !r.file);
    if (back) { back.file = file; back.state = 'waiting'; back.note = 'Waiting to be packed.'; continue; }
    if (have.has(key)) continue;
    have.add(key);
    rows.push({ key, order: ++order, file, name: file.name, size: file.size, lastModified: file.lastModified, lift: prev.lift, view: prev.view, count: null, state: 'waiting', note: 'Waiting to be packed.' });
  }
  rows.forEach(r => { if (!r.video) keep(r); });
}

// One video at a time, while the page is visible; a video whose packing the page's hiding stopped waits for the page
// to come back and starts again.
async function packAll() {
  if (running) return;
  running = true; summarize();
  const release = holdScreenAwake();
  try {
    for (;;) {
      const row = rows.find(r => r.state === 'waiting' && r.file);
      if (!row) break;
      const controller = new AbortController();
      let unwatch = () => {};
      row.state = 'packing'; row.note = 'Waiting for the page to be visible…'; paint(row, 0);
      try {
        await whenVisible({ signal: controller.signal });
        unwatch = watchInterruption(controller);
        row.note = 'Packing…'; paint(row, 0);
        const out = await packVideo(row.file, { signal: controller.signal, bpp: BPP, onProgress: p => { row.note = `Packing… ${p}%`; paint(row, p); } });
        row.note = 'Packed; fingerprinting the original…'; paint(row, 100);
        row.sha256 = row.file.size <= HASH_MAX_BYTES ? await hashVideoContent(row.file) : null;
        const twin = row.sha256 && rows.find(r => r !== row && r.sha256 === row.sha256 && r.state === 'done');
        if (twin) { row.state = 'failed'; row.note = `The same video as video ${rows.indexOf(twin) + 1}: not packed twice.`; continue; }
        row.video = { blob: out.blob, size: out.size, crc: out.crc };
        row.packed = { ...out.packed, source: out.source };
        row.state = 'done';
        row.note = `Packed: ${sizeText(out.size)}, ${out.packed.frames} pictures, ${out.packed.packSeconds} s.`;
        await keep(row);
        // The video as IndexedDB holds it from now on: on an iPhone a Blob read back from it lives on disk, so a pick
        // of 100 does not keep 100 packed videos in memory.
        try { const back = await store.getItem(row.key); if (back?.video?.blob) row.video.blob = back.video.blob; } catch { /* kept in memory */ }
      } catch (err) {
        if (isInterruption(controller.signal.reason)) { row.state = 'waiting'; row.note = 'Stopped while the page was hidden: it starts again when the page is back.'; }
        else { row.state = 'failed'; row.note = `Not packed: ${err.message}`; console.error(err); }
      } finally {
        unwatch();
        paint(row);
        summarize();
      }
      if (row.state === 'waiting') await whenVisible();
    }
  } finally {
    await release();
    running = false;
    summarize();
  }
}

$('pick').addEventListener('click', () => $('videos').click());
$('videos').addEventListener('change', () => {
  const files = [...($('videos').files || [])];
  $('videos').value = '';
  if (!files.length) return;
  addFiles(files);
  made = []; $('files').replaceChildren();
  render();
  packAll();
});

// The file, made on a tap, then handed over by Share (one sheet at a time) or Download, each on its own tap: the
// share sheet opens only from a tap, and the videos come back from IndexedDB first.
$('make').addEventListener('click', async () => {
  const done = rows.filter(r => r.state === 'done' && r.video);
  if (!done.length) return;
  const typo = rows.findIndex(r => parseCount(r.countText ?? r.count ?? '') === undefined);
  if (typo >= 0) { summaryEl.textContent = `Video ${typo + 1}: the reps must be a whole number from 0 to 99, or empty.`; return; }
  const missing = done.filter(r => !r.lift || !Number.isInteger(r.count)).length;
  if (missing && !confirm(`${missing} packed video${missing > 1 ? 's have' : ' has'} no exercise or no reps: ${missing > 1 ? 'they go' : 'it goes'} in the file unlabelled. Make the file anyway?`)) return;
  if (running && !confirm('Some videos are still packing: the file will hold only those already packed. Make it now?')) return;
  $('make').disabled = true; summaryEl.textContent = 'Making the file…';
  try {
    const now = new Date();
    const items = done.map((r, i) => ({ row: r, name: packedName(i, r.lift), size: r.video.size }));
    const cap = Number($('cap').value) * 1e6 || Infinity;
    const parts = planParts(items, cap);
    made = parts.map((part, k) => {
      const labels = labelsFor(part.map(it => ({ name: it.name, file: { name: it.row.name, size: it.row.size, lastModified: it.row.lastModified }, sha256: it.row.sha256, lift: it.row.lift, count: it.row.count, view: it.row.view, source: it.row.packed?.source ?? null, packed: it.row.packed })), { version: VERSION, packedAt: now.toISOString(), part: k + 1, parts: parts.length });
      const entries = [textEntry('labels.json', JSON.stringify(labels, null, 1), now), ...part.map(it => ({ name: it.name, data: it.row.video.blob, size: it.row.video.size, crc: it.row.video.crc, date: new Date(it.row.lastModified) }))];
      return new File([zipStored(entries)], packFileName(now, k + 1, parts.length), { type: 'application/zip' });
    });
    showFiles();
    summaryEl.textContent = `${made.length > 1 ? `${made.length} files` : 'The file'} ready: ${done.length} video${done.length > 1 ? 's' : ''}, ${sizeText(made.reduce((s, f) => s + f.size, 0))}. Share or download ${made.length > 1 ? 'each' : 'it'}, then send ${made.length > 1 ? 'them' : 'it'} to Claude.`;
  } catch (e) {
    summaryEl.textContent = `The file could not be made: ${e.message}`;
  } finally {
    $('make').disabled = false;
  }
});

const share = oneAtATime(10_000);
function showFiles() {
  $('files').replaceChildren(...made.flatMap((file, k) => {
    const what = made.length > 1 ? `part ${k + 1} of ${made.length} (${sizeText(file.size)})` : `the file (${sizeText(file.size)})`;
    const s = Object.assign(document.createElement('button'), { className: 'btn', textContent: `Share ${what}` });
    const d = Object.assign(document.createElement('button'), { className: 'btn quiet', textContent: `Download ${what}` });
    s.hidden = typeof navigator.canShare !== 'function';
    s.addEventListener('click', async () => {
      if (!navigator.canShare?.({ files: [file] })) { summaryEl.textContent = 'This browser cannot share this file: use Download.'; return; }
      if (!share.start(performance.now())) return;
      try { await navigator.share({ files: [file], title: 'Workout Vision videos' }); }
      catch (e) { if (e.name !== 'AbortError') summaryEl.textContent = `Sharing did not go through (${e.message}): use Download.`; }
      finally { share.end(); }
    });
    d.addEventListener('click', () => {
      const url = URL.createObjectURL(file);
      const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
    return [s, d];
  }));
}

$('clear').addEventListener('click', async () => {
  if (running || !confirm('Delete every packed video and label from this phone? Make and send the file first.')) return;
  await store.clear();
  for (const r of rows) if (r.url) URL.revokeObjectURL(r.url);
  rows = []; made = []; $('files').replaceChildren(); render();
  summaryEl.textContent = 'Cleared.';
});

// Back from a reload: the rows kept on this phone, packed ones with their video, the others to pick again.
(async () => {
  try {
    const kept = [];
    await store.iterate(v => { kept.push(v); });
    kept.sort((a, b) => a.order - b.order);
    rows = kept.map(k => ({ ...k, file: null, state: k.video ? 'done' : 'failed', note: k.video ? `Packed: ${sizeText(k.video.size)}.` : 'Not packed before the page closed: pick it again.' }));
    if (rows.length) render();
  } catch { /* nothing kept, or storage refused: the page works for this visit */ }
})();
