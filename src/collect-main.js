/**
 * Set collector page script.
 *
 * Extracts pose landmarks from a video at the same settings as the app
 * (15 fps, 640 px long side), packages them with the user's count, view
 * and the video's SHA-256, and offers a .json.gz download and a prefilled
 * GitHub issue. No video is uploaded and no token is stored.
 */
import { issueUrl } from './lib/collector';
import { collectSet } from './lib/collectSet';
import { watchInterruption, whenVisible, holdScreenAwake, isInterruption } from './lib/interruption';
import { COLLECTOR_LIFTS } from './lib/collectorLifts';

// The exercises: the same as the app offers, but the fitness tests, until David says which count labels them (src/lib/collectorLifts.js).
const LIFTS = COLLECTOR_LIFTS;

const $ = id => document.getElementById(id);

// Populate lift dropdown
const liftSelect = $('lift');
for (const lift of LIFTS) {
  const opt = document.createElement('option');
  opt.value = lift.key;
  opt.textContent = lift.label;
  liftSelect.appendChild(opt);
}

const pickBtn = $('pick');
const videoInput = $('video-input');
const statusEl = $('status');
const barEl = $('bar');
const resultEl = $('result');
const fileNameEl = $('file-name');
const saveLinkEl = $('save-link');
const issueLinkEl = $('issue-link');
const resetBtn = $('reset');

let busy = false;
// Locked while a set is processed: the file keeps what was chosen when the video was picked.
const fields = [liftSelect, $('count'), $('view')];
const lock = on => { for (const f of fields) f.disabled = on; };

pickBtn.addEventListener('click', () => {
  if (busy) return;
  videoInput.click();
});

videoInput.addEventListener('change', async () => {
  const file = videoInput.files?.[0];
  if (!file || busy) return;

  const lift = liftSelect.value;
  const typed = $('count').value.trim();
  const view = $('view').value;

  // The count is David's label: a whole number from 0 to 99, never cut or rounded to one.
  if (!/^\d{1,2}$/.test(typed)) {
    statusEl.textContent = 'Enter the number of reps you counted, as a whole number from 0 to 99.';
    videoInput.value = '';
    return;
  }
  const count = Number(typed);

  busy = true;
  pickBtn.disabled = true;
  lock(true);
  // As in the app (src/lib/interruption.js): a set processed while the page was hidden is not
  // trusted, so the run waits for the page to be visible, keeps the screen awake, stops when the
  // page is hidden or unloaded, and offers no file after an interruption.
  const controller = new AbortController();
  let unwatch = () => {}, release = async () => {};
  resultEl.style.display = 'none';
  barEl.style.width = '0%';

  try {
    await whenVisible({ signal: controller.signal });
    unwatch = watchInterruption(controller);
    release = holdScreenAwake();

    const { blob, name, sha256 } = await collectSet(file, { lift, count, view }, {
      signal: controller.signal,
      onStatus: text => { statusEl.textContent = text; },
      onProgress: pct => {
        barEl.style.width = `${Math.round(pct * 100)}%`;
        statusEl.textContent = `Extracting landmarks… ${Math.round(pct * 100)}%`;
      },
    });
    barEl.style.width = '100%';

    // 5. Offer download and issue link, only if the page stayed visible to the end.
    controller.signal.throwIfAborted();
    saveLinkEl.href = URL.createObjectURL(blob);
    saveLinkEl.download = name;
    fileNameEl.textContent = name;
    issueLinkEl.href = issueUrl({ lift, count, view, sha256 });
    resultEl.style.display = 'block';

  } catch (err) {
    if (isInterruption(controller.signal.reason)) {
      statusEl.textContent = 'The set was interrupted: the page was hidden. No file is offered. Keep the screen on and pick the video again.';
    } else {
      statusEl.textContent = `Error: ${err.message}`;
      console.error(err);
    }
  } finally {
    unwatch();
    await release();
    busy = false;
    pickBtn.disabled = false;
    lock(false);
    videoInput.value = '';
  }
});

resetBtn.addEventListener('click', () => {
  resultEl.style.display = 'none';
  statusEl.textContent = '';
  barEl.style.width = '0%';
  $('count').value = '';
});
