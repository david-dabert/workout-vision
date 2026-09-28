/**
 * Set collector page script.
 *
 * Extracts pose landmarks from a video at the same settings as the app
 * (15 fps, 640 px long side), packages them with the user's count, view
 * and the video's SHA-256, and offers a .json.gz download and a prefilled
 * GitHub issue. No video is uploaded and no token is stored.
 */
import { extractFramesStreaming } from './lib/frameExtractor';
import { TARGET_FPS, MAX_LONG_SIDE, MAX_FRAMES } from './lib/extractionConfig';
import { setFileName, issueUrl, setPayload, hashVideoContent, gzipBlob, sampleSet, setIsWhole } from './lib/collector';
import { watchInterruption, whenVisible, holdScreenAwake, isInterruption } from './lib/interruption';

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

// Lift list: same as the app's choice screen
const LIFTS = [
  { key: 'lateral_raise', label: 'Lateral raise / Élévations latérales' },
  { key: 'bicep_curl', label: 'Biceps curl / Curl biceps' },
  { key: 'lat_pulldown', label: 'Lat pulldown / Tirage vertical' },
  { key: 'squat', label: 'Squat' },
  { key: 'bench_press', label: 'Bench press / Développé couché' },
  { key: 'hip_thrust', label: 'Hip thrust' },
  { key: 'romanian_deadlift', label: 'Romanian deadlift / Soulevé de terre roumain' },
  { key: 'leg_press', label: 'Leg press / Presse à cuisses' },
  { key: 'overhead_press', label: 'Overhead press / Développé militaire' },
];

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

    // 1. Hash the video content
    statusEl.textContent = 'Hashing video…';
    const sha256 = await hashVideoContent(file);
    statusEl.textContent = `SHA-256: ${sha256.slice(0, 16)}…`;

    // 2. Init the pose worker
    // A hide during hashing stops here, before any worker exists to be left running.
    controller.signal.throwIfAborted();
    statusEl.textContent = 'Loading pose model…';
    const worker = new Worker(new URL('./lib/corePoseWorker.js', import.meta.url));
    let reqId = 0;
    const pending = new Map();
    worker.onmessage = ({ data }) => {
      const req = pending.get(data.id);
      if (!req) return;
      clearTimeout(req.timer);
      pending.delete(data.id);
      if (data.error) req.reject(new Error(data.error));
      else req.resolve(data);
    };
    const send = (msg, transfer = []) => new Promise((resolve, reject) => {
      const id = reqId++;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Worker timed out')); }, 60_000);
      pending.set(id, { resolve, reject, timer });
      worker.postMessage({ ...msg, id }, transfer);
    });
    controller.signal.throwIfAborted();
    const aborted = new Promise((_, reject) => controller.signal.addEventListener('abort', () => reject(controller.signal.reason), { once: true }));
    aborted.catch(() => {});
    try {
      await Promise.race([send({ type: 'init' }), aborted]);
    } catch (err) {
      worker.terminate();
      throw err;
    }

    // 3. Extract frames and run pose detection
    statusEl.textContent = 'Extracting landmarks…';
    const set = sampleSet();
    let frameWidth = 0, frameHeight = 0;

    const metadata = await extractFramesStreaming(
      file, TARGET_FPS, MAX_FRAMES, MAX_LONG_SIDE,
      async (canvas, index, timestamp) => {
        frameWidth = canvas.width;
        frameHeight = canvas.height;
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer;
        let result;
        try {
          result = await send({ pixels, width: canvas.width, height: canvas.height, timestamp: index * 1000 / TARGET_FPS }, [pixels]);
        } catch (err) {
          set.fail(index);
          throw err;
        }
        set.add(index, result.world, timestamp);
      },
      pct => {
        barEl.style.width = `${Math.round(pct * 100)}%`;
        statusEl.textContent = `Extracting landmarks… ${Math.round(pct * 100)}%`;
      },
      { deterministic: true, signal: controller.signal },
    ).finally(() => worker.terminate());
    // A set hidden at any moment before this point offers no file.
    controller.signal.throwIfAborted();
    const worldLandmarks = set.world, timestamps = set.timestamps;
    // The file carries the count for the whole video, so its landmarks must cover all of it.
    if (!setIsWhole({ samples: worldLandmarks.length, duration: metadata.duration, fps: TARGET_FPS, maxFrames: MAX_FRAMES, failed: set.failed, posed: set.posed })) {
      throw new Error(set.posed === 0 && worldLandmarks.length
        ? 'no body was found in any frame of the video. No file is offered. Film the whole body in the frame.'
        : `the video was not read to the end (${worldLandmarks.length} of ${Math.floor(metadata.duration * TARGET_FPS)} samples${set.failed ? `, ${set.failed} unread` : ''}). No file is offered. Pick the video again.`);
    }
    barEl.style.width = '100%';
    statusEl.textContent = `Done: ${worldLandmarks.length} samples from ${metadata.method}.`;

    // 4. Build payload and compress
    const payload = setPayload({
      worldLandmarks, timestamps, lift, count, view, sha256,
      frameWidth, frameHeight, version: VERSION, extractor: metadata,
    });
    const json = JSON.stringify(payload);
    const blob = await gzipBlob(json);
    const name = setFileName(lift, count, view, sha256);

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
