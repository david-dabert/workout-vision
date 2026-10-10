/**
 * Video packer page script (pack.html; rules in lib/pack.js, one video in lib/videoPack.js). David picks the videos of
 * his sets, the page makes each small on the phone, one at a time, and he types the exercise and the reps he counted
 * beside each; then one file (or a few, under a size he chooses) holds the packed videos and their labels. The page
 * shows no count of the app's, so his counts are blind (R1). Each label is kept on the phone (IndexedDB) as he types
 * it, and each packed video once, as soon as it is made, in records of their own (a label typed never rewrites a
 * video), so a reload or an evicted tab loses no work already done; nothing leaves the phone until he shares or
 * downloads the file.
 */
import localforage from 'localforage';
import { packVideo } from './lib/videoPack';
import { hashVideoContent } from './lib/collector';
import { filmingOrder, oneAtATime } from './lib/batchCollect';
import { watchInterruption, whenVisible, holdScreenAwake, isInterruption } from './lib/interruption';
import { COLLECTOR_LIFTS } from './lib/collectorLifts';
import { bppFrom, carryDown, fileKey, labelsFor, labelsName, packedName, packFileName, parseCount, planParts, sizeText, textEntry, zipStored } from './lib/pack';

const LIFTS = COLLECTOR_LIFTS;
const VIEWS = [['', 'Not said'], ['side', 'Side'], ['front', 'Front'], ['angle', 'Angle']];
// The original is hashed (its SHA-256, as the committed sets record videoSha256) only up to this size: hashing reads
// the whole file into memory at once. Source: convention (a 4K minute is about 400 MB). Status: convention.
const HASH_MAX_BYTES = 300e6;
const BPP = bppFrom(location.search);
const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : null;

const store = localforage.createInstance({ name: 'workoutVision', storeName: 'packed' });
const $ = id => document.getElementById(id);
const setsEl = $('sets'), summaryEl = $('summary');
// state: 'waiting' (to pack), 'packing', 'done' (packed), 'failed' (pick it again), 'missing' (kept from before a
// reload, never packed: pick it again), 'twin' (the same video as another row: not packed twice).
let rows = [], running = false, made = [], madeKeys = new Set();

const option = (value, text) => Object.assign(document.createElement('option'), { value, textContent: text });
const LABEL = k => `label:${k}`, VIDEO = k => `video:${k}`;
const labelOf = r => ({ key: r.key, order: r.order, name: r.name, size: r.size, lastModified: r.lastModified, lift: r.lift, view: r.view, count: r.count, countText: r.countText ?? null, touched: r.touched || null, twinOf: r.twinOf ?? null });
async function keepLabel(r) { try { await store.setItem(LABEL(r.key), labelOf(r)); } catch (e) { r.note = `Not kept on this phone: ${e.message}`; paint(r); } }
const typedBad = r => parseCount(r.countText ?? r.count ?? '') === undefined;
const number = r => rows.indexOf(r) + 1;

// A file made before the label of one of its videos changed no longer says what the page says: it goes, and the page
// asks for a new one. A video packed after the file was made changes nothing in it: the file stays, and the page says
// it can be made again to hold the new ones.
function stale(row = null) {
  if (!made.length || (row && !madeKeys.has(row.key))) return;
  made = []; madeKeys = new Set();
  $('files').replaceChildren();
  $('stale').textContent = 'A label in the file changed since it was made: make it again before sending it.';
  $('stale').hidden = false;
}
function packedSinceFile() {
  if (!made.length) return;
  $('stale').textContent = 'More videos were packed since the file was made: make it again to hold them too, or send it as it is.';
  $('stale').hidden = false;
}
// A row's fields as its label now says, without rebuilding the page (a rebuild would close the keyboard of a field
// being typed in); a field being typed in is left as it is.
function syncFields(r) {
  const i = rows.indexOf(r);
  for (const [id, v] of [[`lift${i}`, r.lift || ''], [`view${i}`, r.view || ''], [`count${i}`, r.countText ?? (r.count ?? '')]]) {
    const el = r.el?.querySelector(`#${id}`);
    if (el && el !== document.activeElement) el.value = String(v);
  }
  paint(r);
}

function render() {
  for (const old of setsEl.querySelectorAll('video')) { old.removeAttribute('src'); old.load(); }
  setsEl.replaceChildren(...rows.map((row, i) => {
    const box = document.createElement('div');
    box.innerHTML = `<div class="set-head"><b>Video ${i + 1}</b><span></span></div>
      <div class="thumb"><video muted playsinline preload="metadata"></video><em></em><button type="button" class="close-video">Close the video</button></div>
      <label for="lift${i}">Exercise</label><select id="lift${i}"></select>
      <div class="row"><div><label for="count${i}">Reps you counted</label><input type="text" id="count${i}" inputmode="numeric" autocomplete="off"></div>
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
    lift.value = row.lift || ''; view.value = row.view || ''; count.value = row.countText ?? (row.count ?? '');
    // A choice carries to the videos below, packed or not, up to the first one worked on by hand (lib/pack.js).
    const choose = (key, value) => {
      row[key] = value; row.touched = { ...row.touched, [key]: true };
      const changed = carryDown(rows, i, key, value);
      for (const r of [row, ...changed]) { const el = r.el?.querySelector(`#${key}${number(r) - 1}`); if (el) el.value = r[key] || ''; keepLabel(r); stale(r); }
      summarize();
    };
    lift.addEventListener('change', () => choose('lift', lift.value));
    view.addEventListener('change', () => choose('view', view.value));
    count.addEventListener('input', () => {
      row.countText = count.value;
      const n = parseCount(count.value);
      if (n !== undefined) row.count = n;
      row.touched = { ...row.touched, count: true };
      keepLabel(row); stale(row); paint(row); summarize();
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
  const bad = row.state === 'failed' || row.state === 'missing' || typedBad(row);
  row.el.className = `set ${row.state === 'done' && !bad ? 'done' : bad ? 'failed' : ''}${row.open ? ' open' : ''}`;
  row.el.querySelector('.state').textContent = `${row.note || ''}${typedBad(row) ? ' The reps must be a whole number from 0 to 99, or empty.' : ''}`;
  const fill = row.el.querySelector('.bar-fill');
  if (pct !== undefined) fill.style.width = `${Math.round(pct)}%`;
  else fill.style.width = row.state === 'done' ? '100%' : '0%';
}

function summarize() {
  const done = rows.filter(r => r.state === 'done'), failed = rows.filter(r => r.state === 'failed' || r.state === 'missing');
  const labelled = done.filter(r => r.lift && Number.isInteger(r.count)).length;
  const bytes = done.reduce((s, r) => s + (r.video?.size ?? 0), 0);
  const counted = rows.filter(r => r.state !== 'twin').length;
  summaryEl.textContent = rows.length
    ? `${done.length} of ${counted} packed (${sizeText(bytes)})${failed.length ? `, ${failed.length} to pick again` : ''}; ${labelled} with exercise and reps.${running ? ' Packing: keep the screen on.' : ''}`
    : '';
  $('make-box').hidden = !done.length;
  $('clear').hidden = running || !rows.length;
}

// Rows for newly picked files, in filming order, after those already there. A file already on the page (its name and
// size: lib/pack.js fileKey) is not added twice; one that failed, or was kept from before a reload without being
// packed, takes the file back, with its label, and is packed now.
function addFiles(files) {
  const prev = rows[rows.length - 1] || { lift: '', view: '' };
  let order = rows.reduce((m, r) => Math.max(m, r.order), 0);
  for (const file of filmingOrder(files)) {
    const key = fileKey(file), have = rows.find(r => r.key === key);
    if (have) {
      if ((have.state === 'failed' || have.state === 'missing') && !have.video) { have.file = file; have.state = 'waiting'; have.note = 'Waiting to be packed.'; if (have.url) { URL.revokeObjectURL(have.url); have.url = null; } }
      continue;
    }
    const row = { key, order: ++order, file, name: file.name, size: file.size, lastModified: file.lastModified, lift: prev.lift, view: prev.view, count: null, countText: '', state: 'waiting', note: 'Waiting to be packed.' };
    rows.push(row);
    keepLabel(row);
  }
}

// One video at a time, while the page is visible. A video whose packing the page's hiding stopped waits for the page
// to come back and starts again. The screen lock is asked for again each time the page comes back: the browser lets it
// go while the page is hidden (Screen Wake Lock; rest-clock.js does the same).
async function packAll() {
  if (running) return;
  running = true; summarize();
  let release = holdScreenAwake();
  const again = () => { if (document.visibilityState === 'visible') { const old = release; release = holdScreenAwake(); old(); } };
  document.addEventListener('visibilitychange', again);
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
        // A fingerprint that cannot be read leaves the packed video as it is, with no fingerprint.
        try { row.sha256 = row.file.size <= HASH_MAX_BYTES ? await hashVideoContent(row.file) : null; } catch { row.sha256 = null; }
        const twin = row.sha256 && rows.find(r => r !== row && r.sha256 === row.sha256 && r.state === 'done');
        if (twin) { markTwin(row, twin); continue; }
        row.video = { blob: out.blob, size: out.size, crc: out.crc };
        row.packed = { ...out.packed, source: out.source };
        row.state = 'done';
        const short = out.packed.whole === false ? ` Only ${out.packed.frames} of the ${out.packed.expected} pictures the app reads: it would refuse this video too.` : '';
        row.note = `Packed: ${sizeText(out.size)}, ${out.packed.frames} pictures, ${out.packed.packSeconds} s.${short}`;
        // Kept on the phone once; the video as IndexedDB holds it from then on: on an iPhone a Blob read back from it
        // lives on disk, so a pick of 100 does not keep 100 packed videos in memory. A phone whose storage is full keeps
        // the video for this visit only: it is packed all the same, and the file can still be made before leaving.
        try {
          await store.setItem(VIDEO(row.key), { blob: out.blob, size: out.size, crc: out.crc, sha256: row.sha256, packed: row.packed });
          const back = await store.getItem(VIDEO(row.key)).catch(() => null);
          if (back?.blob) row.video.blob = back.blob;
        } catch (e) {
          row.note = `${row.note} Not kept on this phone (${e.message}): make the file before leaving this page.`;
        }
        packedSinceFile();
      } catch (err) {
        if (isInterruption(controller.signal.reason)) { row.state = 'waiting'; row.note = 'Stopped while the page was hidden: it starts again when the page is back.'; }
        else { row.state = 'failed'; row.note = `Not packed: ${err.message}. Pick it again to try once more.`; console.error(err); }
      } finally {
        unwatch();
        paint(row);
        summarize();
      }
      if (row.state === 'waiting') await whenVisible();
    }
  } finally {
    document.removeEventListener('visibilitychange', again);
    await release();
    running = false;
    summarize();
  }
}

// The same video as another row (its fingerprint): not packed twice. A label typed on the copy and not on the first
// goes to the first, so nothing David typed is lost; the copy says where its label went.
function markTwin(row, twin) {
  row.state = 'twin'; row.twinOf = twin.key;
  const moved = [];
  for (const k of ['lift', 'view']) if (row.touched?.[k] && !twin.touched?.[k]) { twin[k] = row[k]; twin.touched = { ...twin.touched, [k]: true }; moved.push(k === 'lift' ? 'exercise' : 'view'); }
  if (String(row.countText ?? '').trim() !== '' && String(twin.countText ?? '').trim() === '') { twin.countText = row.countText; twin.count = row.count; twin.touched = { ...twin.touched, count: true }; moved.push('reps'); }
  row.note = twinNote(row);
  if (moved.length) { keepLabel(twin); syncFields(twin); stale(twin); }
  keepLabel(row);
}
const twinNote = row => { const t = rows.find(r => r.key === row.twinOf); return `The same video as ${t ? `video ${number(t)}` : 'one already packed'}: not packed twice. Label that one.`; };

$('pick').addEventListener('click', () => $('videos').click());
$('videos').addEventListener('change', () => {
  const files = [...($('videos').files || [])];
  $('videos').value = '';
  if (!files.length) return;
  addFiles(files);
  render();
  packAll();
});

// The file, made on a tap, then handed over by Share (one sheet at a time) or Download, each on its own tap: the share
// sheet opens only from a tap, so the file is whole before it opens.
$('make').addEventListener('click', () => {
  const done = rows.filter(r => r.state === 'done' && r.video);
  if (!done.length) return;
  const typo = rows.find(r => r.state !== 'twin' && typedBad(r));
  if (typo) { summaryEl.textContent = `Video ${number(typo)}: the reps must be a whole number from 0 to 99, or empty.`; return; }
  const missing = done.filter(r => !r.lift || !Number.isInteger(r.count)).length;
  if (missing && !confirm(`${missing} packed video${missing > 1 ? 's have' : ' has'} no exercise or no reps: ${missing > 1 ? 'they go' : 'it goes'} in the file unlabelled. Make the file anyway?`)) return;
  if (running && !confirm('Some videos are still packing: the file will hold only those already packed. Make it now?')) return;
  try {
    const now = new Date();
    // Each video is named by its number on this page, so "Video 12" here is videos/012-… in the file.
    const items = done.map(r => ({ row: r, name: packedName(number(r) - 1, r.lift), size: r.video.size }));
    const cap = Number($('cap').value) * 1e6 || Infinity;
    const parts = planParts(items, cap);
    made = parts.map((part, k) => {
      const labels = labelsFor(part.map(it => ({ name: it.name, file: { name: it.row.name, size: it.row.size, lastModified: it.row.lastModified }, sha256: it.row.sha256, lift: it.row.lift, count: Number.isInteger(it.row.count) && String(it.row.countText ?? it.row.count).trim() !== '' ? it.row.count : null, view: it.row.view, source: it.row.packed?.source ?? null, packed: it.row.packed })), { version: VERSION, packedAt: now.toISOString(), part: k + 1, parts: parts.length });
      const entries = [textEntry(labelsName(k + 1, parts.length), JSON.stringify(labels, null, 1), now), ...part.map(it => ({ name: it.name, data: it.row.video.blob, size: it.row.video.size, crc: it.row.video.crc, date: new Date(it.row.lastModified) }))];
      return new File([zipStored(entries)], packFileName(now, k + 1, parts.length), { type: 'application/zip' });
    });
    madeKeys = new Set(done.map(r => r.key));
    $('stale').hidden = true;
    showFiles();
    summaryEl.textContent = `${made.length > 1 ? `${made.length} files` : 'The file'} ready: ${done.length} video${done.length > 1 ? 's' : ''}, ${sizeText(made.reduce((s, f) => s + f.size, 0))}. Share or download ${made.length > 1 ? 'each' : 'it'}, then send ${made.length > 1 ? 'them' : 'it'} to Claude.`;
  } catch (e) {
    made = []; madeKeys = new Set();
    summaryEl.textContent = `The file could not be made: ${e.message}`;
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
      catch (e) { if (e.name !== 'AbortError' && e.name !== 'InvalidStateError') summaryEl.textContent = `Sharing did not go through (${e.message}): use Download.`; }
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
  rows = []; made = []; madeKeys = new Set(); $('files').replaceChildren(); $('stale').hidden = true; render();
  summaryEl.textContent = 'Cleared.';
});

// Back from a reload: the rows kept on this phone, packed ones with their video, the others to pick again.
(async () => {
  try {
    const labels = new Map(), videos = new Map();
    await store.iterate((v, k) => { if (k.startsWith('label:')) labels.set(v.key, v); else if (k.startsWith('video:')) videos.set(k.slice(6), v); });
    rows = [...labels.values()].sort((a, b) => a.order - b.order).map(l => {
      const v = videos.get(l.key);
      const row = { ...l, file: null, sha256: v?.sha256 ?? null, packed: v?.packed ?? null, video: v ? { blob: v.blob, size: v.size, crc: v.crc } : null };
      row.state = v ? 'done' : l.twinOf ? 'twin' : 'missing';
      row.note = v ? `Packed: ${sizeText(v.size)}.` : l.twinOf ? '' : 'Not packed before the page closed: pick it again.';
      return row;
    });
    for (const r of rows) if (r.state === 'twin') r.note = twinNote(r);
    if (rows.length) render();
  } catch { /* nothing kept, or storage refused: the page works for this visit */ }
})();
