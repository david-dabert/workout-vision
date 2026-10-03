/**
 * Batch collector page script (collect-batch.html): many sets at once, each read exactly as the single
 * collector reads it (src/lib/collectSet.js). The sets are collected one after another; a set running
 * while the page is hidden is dropped and can be collected again. The files are shared in one sheet, or
 * downloaded. No video is uploaded and no count is shown.
 */
import { collectSet } from './lib/collectSet';
import { mismatchNote, flaggedSets, rowErrors, batchFileName, carryChoice, appendRows, twinOf, twinNote, oneAtATime, numbersUsed, mergeMemory, countsFromLine } from './lib/batchCollect';
import { watchInterruption, whenVisible, holdScreenAwake, isInterruption } from './lib/interruption';
import { COLLECTOR_LIFTS } from './lib/collectorLifts';

// The exercises the app offers, but the fitness tests, as in the single collector (src/lib/collectorLifts.js).
const LIFTS = COLLECTOR_LIFTS;
const VIEWS = [['side', 'Side'], ['front', 'Front'], ['angle', 'Angle']];

const $ = id => document.getElementById(id);
const setsEl = $('sets'), summaryEl = $('summary');
let rows = [], busy = false;

// What survives a reload: the next set number (batchCollect.js, numbersUsed). Read afresh before each use
// and joined on each write, so two tabs do not erase each other. Browser storage may be missing or
// blocked: the page then works for this load only.
const MEMORY = 'wv-batch-collector';
let memory = { gen: 0, next: 1 };
function recall() {
  try {
    const saved = JSON.parse(localStorage.getItem(MEMORY) || 'null');
    if (saved && Number.isInteger(saved.gen) && Number.isInteger(saved.next)) memory = mergeMemory(memory, saved);
  } catch { /* this load only */ }
  return memory;
}
function remember(next) {
  memory = mergeMemory(next, recall());
  try { localStorage.setItem(MEMORY, JSON.stringify(memory)); } catch { /* this load only */ }
}
recall();

// A set still to collect: not collected, and not a video already collected under another set.
const open = r => r.state !== 'done' && r.state !== 'duplicate';
const option = (value, text) => Object.assign(document.createElement('option'), { value, textContent: text });

function render() {
  // The thumbnails replaced here let go of their video, so a long batch does not pile them up in memory.
  for (const old of setsEl.querySelectorAll('video')) { old.removeAttribute('src'); old.load(); }
  setsEl.replaceChildren(...rows.map((row, i) => {
    const box = document.createElement('div');
    box.className = `set ${row.state === 'done' ? 'done' : row.state === 'failed' ? 'failed' : ''}`;
    // The video itself on each row, with its length: the set is labelled against what is seen, whatever
    // order the phone hands the files in (review, 30 September).
    box.innerHTML = `<div class="set-head"><b>Set ${row.set}</b><span></span></div>
      <div class="thumb"><video muted playsinline preload="metadata"></video><em></em><button type="button" class="close-video">Close the video</button></div>
      <label for="lift${i}">Exercise</label><select id="lift${i}"></select>
      <div class="row"><div><label for="count${i}">Reps you counted</label><input type="number" id="count${i}" min="0" max="99" inputmode="numeric" placeholder="0"></div>
      <div><label for="view${i}">Camera view</label><select id="view${i}"></select></div></div>
      <div class="state"></div><div class="bar-wrap"><div class="bar-fill"></div></div>`;
    box.querySelector('.set-head span').textContent = row.file.name;
    const video = box.querySelector('video');
    row.url ??= URL.createObjectURL(row.file);
    // The video loads only while its row is near the screen (watchThumbs), so a large pick never holds
    // dozens of videos at once; one likely cause of a pick of 100 failing on David's iPhone (1 October).
    // The iOS picker preparing every file is another, which the note on the page answers.
    video.dataset.src = `${row.url}#t=0.5`;
    video.dataset.set = String(row.set);
    if (row.seconds) box.querySelector('.thumb em').textContent = `${row.seconds} s`;
    video.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(video.duration)) { row.seconds = Math.round(video.duration); box.querySelector('.thumb em').textContent = `${row.seconds} s`; }
    });
    // A tap opens the video full width with its controls, to watch the set and count it. One video is open
    // at a time, so memory stays bounded however many are watched; Close (or a tap) closes it. The open
    // state is the row's, so a repaint (paint) keeps it.
    video.controls = !!row.open;
    video.addEventListener('click', () => { if (!row.open) openRow(row); });
    box.querySelector('.close-video').addEventListener('click', () => closeRow(row));
    const lift = box.querySelector('select[id^=lift]'), view = box.querySelector('select[id^=view]'), count = box.querySelector('input');
    lift.append(option('', 'Choose…'), ...LIFTS.map(l => option(l.key, l.label)));
    view.append(...VIEWS.map(([v, t]) => option(v, t)));
    lift.value = row.lift; view.value = row.view; count.value = row.count;
    const locked = busy || !open(row);
    lift.disabled = view.disabled = count.disabled = locked;
    // A choice carries to the sets below, up to the first one chosen by hand (batchCollect.js).
    const choose = (key, value) => { row[key] = value; row.touched = { ...row.touched, [key]: true }; carryChoice(rows, i, key, value); sync(key); recheck(); };
    lift.addEventListener('change', () => choose('lift', lift.value));
    view.addEventListener('change', () => choose('view', view.value));
    count.addEventListener('input', () => { row.count = count.value; row.lineCount = false; recheck(); });
    row.el = box;
    paint(row);
    return box;
  }));
  watchThumbs();
  const left = rows.filter(open).length;
  $('collect').hidden = !rows.length || !left;
  $('collect').disabled = busy;
  $('collect').textContent = left === rows.length ? `Collect all ${rows.length} sets` : `Collect the ${left} remaining`;
  const done = rows.filter(r => r.state === 'done');
  $('share').hidden = !done.length || busy || typeof navigator.canShare !== 'function';
  $('download').hidden = !done.length || busy;
  $('share').textContent = `Share ${done.length} file${done.length > 1 ? 's' : ''}`;
  $('download').textContent = `Download ${done.length} file${done.length > 1 ? 's' : ''}`;
  $('pick').disabled = busy;
  $('all').hidden = busy || !rows.some(open);
  $('restart').hidden = busy || recall().next <= 1;
  // Where numbering starts, shown before a pick, so a reset is seen: Safari deletes a site's storage after
  // seven days without a visit, unless the page is on the home screen (WebKit, "Full Third-Party Cookie
  // Blocking and More", March 2020; fifth review, 30 September).
  if (!rows.length) summaryEl.textContent = `The next set is set ${recall().next}. Safari forgets this after a week without a visit.`;
}

// Each row's video is loaded when the row comes near the screen and let go when it leaves, unless it is
// open or playing, so a batch of any size holds only a few videos at once.
let thumbs = null;
function watchThumbs() {
  thumbs?.disconnect();
  if (typeof IntersectionObserver !== 'function') { for (const v of setsEl.querySelectorAll('video')) v.src = v.dataset.src; return; }
  thumbs = new IntersectionObserver(entries => {
    for (const { target: v, isIntersecting } of entries) {
      if (isIntersecting) { if (!v.getAttribute('src')) v.src = v.dataset.src; }
      else if (v.getAttribute('src') && !v.closest('.open')) { v.pause(); v.removeAttribute('src'); v.load(); }
    }
  }, { rootMargin: '300px 0px' });
  for (const v of setsEl.querySelectorAll('video')) thumbs.observe(v);
}

// The rows' fields follow the rows after a choice carried.
function sync(key) {
  rows.forEach((r, j) => { const el = r.el?.querySelector(`#${key}${j}`); if (el) el.value = r[key]; });
}

// A set marked for a missing exercise or count says so only while it is still missing (seventh review).
function recheck() {
  for (const r of rows.filter(r => r.invalid)) {
    const e = rowErrors(r);
    if (e.length) r.note = `Set ${r.set}: ${e.join(' and ')}.`;
    else { r.invalid = false; r.state = 'waiting'; r.note = ''; }
    paint(r);
  }
}

function openRow(row) {
  for (const r of rows) if (r !== row && r.open) closeRow(r);
  row.open = true;
  paint(row);
  const v = row.el?.querySelector('video');
  if (v) { if (!v.getAttribute('src')) v.src = v.dataset.src; v.controls = true; }
}

function closeRow(row) {
  row.open = false;
  paint(row);
  const v = row.el?.querySelector('video');
  if (!v) return;
  v.pause(); v.controls = false;
  // Closed while off screen (another row opened further down), it is let go now: the observer fired
  // when it left the screen, while it was still open.
  const r = v.getBoundingClientRect(), margin = 300;
  if (v.getAttribute('src') && (r.bottom < -margin || r.top > innerHeight + margin)) { v.removeAttribute('src'); v.load(); }
}

function paint(row, pct) {
  if (!row.el) return;
  row.el.className = `set ${row.state === 'done' ? 'done' : row.state === 'failed' ? 'failed' : ''}${row.open ? ' open' : ''}`;
  row.el.querySelector('.state').textContent = row.note || '';
  if (pct !== undefined) row.el.querySelector('.bar-fill').style.width = `${Math.round(pct * 100)}%`;
  else if (row.state === 'done') row.el.querySelector('.bar-fill').style.width = '100%';
}

$('pick').addEventListener('click', () => { if (!busy) $('videos').click(); });

// All the counts on one line (batchCollect.js, countsFromLine): filled only when there is one per set.
$('fill').addEventListener('click', () => {
  if (busy) return;
  const { counts, error } = countsFromLine(rows, $('all-counts').value);
  if (error) { summaryEl.textContent = `Nothing filled: ${error}.`; return; }
  rows.forEach((r, i) => { if (r.count !== counts[i]) { r.count = counts[i]; r.lineCount = true; } });
  sync('count'); recheck();
  summaryEl.textContent = 'Counts filled. Check each set against its picture, then collect.';
});
$('videos').addEventListener('change', () => {
  const files = [...($('videos').files || [])];
  $('videos').value = '';
  if (!files.length || busy) return;
  // A second pick adds sets after those already there; collected sets are kept (review, 30 September).
  rows = appendRows(rows, files, recall().next);
  summaryEl.textContent = `${rows.length} video${rows.length > 1 ? 's' : ''}. Each pick is numbered by its files' dates, after the sets already there and the files already shared or downloaded, even before a reload; a video collected twice on this page is kept once. Check each one against its picture, then collect.`;
  render();
});

$('collect').addEventListener('click', async () => {
  if (busy) return;
  const todo = rows.filter(open);
  const wrong = todo.map(r => [r, rowErrors(r)]).filter(([, e]) => e.length);
  if (wrong.length) {
    for (const [r, e] of wrong) { r.state = 'failed'; r.invalid = true; r.note = `Set ${r.set}: ${e.join(' and ')}.`; paint(r); }
    summaryEl.textContent = `${wrong.length} set${wrong.length > 1 ? 's need' : ' needs'} attention before collecting.`;
    return;
  }
  busy = true; render();
  const release = holdScreenAwake();
  let stopped = false;
  for (const row of todo) {
    const controller = new AbortController();
    let unwatch = () => {};
    row.state = 'running'; row.note = 'Waiting for the page to be visible…'; paint(row, 0);
    try {
      await whenVisible({ signal: controller.signal });
      unwatch = watchInterruption(controller);
      const out = await collectSet(row.file, { lift: row.lift, count: Number(row.count), view: row.view }, {
        signal: controller.signal,
        onStatus: text => { row.note = text; paint(row); },
        onProgress: pct => { row.note = `Extracting landmarks… ${Math.round(pct * 100)}%`; paint(row, pct); },
      });
      // The same video under another name or date is kept once: its fingerprint is already collected.
      const twin = twinOf(rows, row, out.sha256);
      if (twin) { row.state = 'duplicate'; row.note = twinNote(row, twin); continue; }
      row.blob = out.blob; row.baseName = out.name; row.sha256 = out.sha256;
      row.state = 'done'; row.note = `Done: ${out.samples} samples. ${batchFileName(row.set, row.baseName)}`;
      // A video whose exercise joint barely moves is likely paired with the wrong label: said before sharing.
      const warn = mismatchNote(row.set, LIFTS.find(l => l.key === row.lift)?.label ?? row.lift, out.jointRange);
      if (warn) { row.mismatch = true; row.note = `${row.note} ${warn}`; }
    } catch (err) {
      row.state = 'failed';
      if (isInterruption(controller.signal.reason)) { row.note = 'Interrupted: the page was hidden. Collect again.'; stopped = true; }
      else { row.note = `Error: ${err.message}`; console.error(err); }
    } finally {
      unwatch();
      paint(row);
    }
    if (stopped) break;
  }
  await release();
  busy = false;
  const done = rows.filter(r => r.state === 'done').length, twins = rows.filter(r => r.state === 'duplicate').length;
  const kept = rows.length - twins, also = twins ? ` ${twins} duplicate video${twins > 1 ? 's' : ''} not kept.` : '';
  const flagged = flaggedSets(rows);
  const check = flagged.length ? ` Check set${flagged.length > 1 ? 's' : ''} ${flagged.join(', ')} before sharing: the app sees too little movement to count ${flagged.length > 1 ? 'them' : 'it'}.` : '';
  summaryEl.textContent = stopped
    ? `Stopped: the page was hidden. ${done} of ${kept} sets collected; keep the screen on and collect the rest.${also}${check}`
    : `${done} of ${kept} sets collected.${done < kept ? ' Fix the others and collect again.' : ''}${also}${check}`;
  render();
});

// Flagged sets leave the page only once David has said they are right.
function flaggedOk() {
  const flagged = flaggedSets(rows);
  return !flagged.length || confirm(`Set${flagged.length > 1 ? 's' : ''} ${flagged.join(', ')}: the app sees too little movement to count ${flagged.length > 1 ? 'them' : 'it'}. Send anyway?`);
}

const files = () => rows.filter(r => r.state === 'done').map(r => new File([r.blob], batchFileName(r.set, r.baseName), { type: 'application/gzip' }));

// The share sheet opens only from a tap, so the files are ready before it and shared inside it.
// One share at a time (batchCollect.js, oneAtATime). The numbers are marked used before the sheet opens:
// the tab may be evicted while it is open (batchCollect.js, numbersUsed).
const share = oneAtATime(10_000);
$('share').addEventListener('click', async () => {
  const list = files();
  if (!flaggedOk()) return;
  if (!navigator.canShare?.({ files: list })) { summaryEl.textContent = 'This browser cannot share these files: use Download.'; return; }
  if (!share.start(performance.now())) return;
  remember(numbersUsed(recall(), rows));
  try { await navigator.share({ files: list, title: 'Workout Vision sets' }); }
  catch (e) { if (e.name !== 'AbortError') summaryEl.textContent = 'Sharing did not go through: use Download.'; }
  finally { share.end(); render(); }
});

// A new session of filming starts again from set 1, once the files of the last one are kept.
$('restart').addEventListener('click', () => {
  if (busy || !confirm('Start again from set 1? New files will take the numbers of those already shared: keep them apart, and share any set collected here first.')) return;
  // A new restart count, so another open tab holding the old numbers does not bring them back.
  remember({ gen: recall().gen + 1, next: 1 });
  rows = []; summaryEl.textContent = ''; render();
});

$('download').addEventListener('click', () => {
  if (!flaggedOk()) return;
  for (const file of files()) {
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  // Several downloads from one tap are not certain on iPhone Safari: Share is the way there (review, 30 September).
  remember(numbersUsed(recall(), rows)); render();
  summaryEl.textContent = 'Download started. On iPhone, use Share to keep all the files.';
});

render();
