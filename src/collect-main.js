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
import { setFileName, issueUrl, setPayload, hashVideoContent, gzipBlob } from './lib/collector';

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

pickBtn.addEventListener('click', () => {
  if (busy) return;
  videoInput.click();
});

videoInput.addEventListener('change', async () => {
  const file = videoInput.files?.[0];
  if (!file || busy) return;

  const lift = liftSelect.value;
  const count = parseInt($('count').value, 10);
  const view = $('view').value;

  if (isNaN(count) || count < 0) {
    statusEl.textContent = 'Enter the number of reps you counted.';
    return;
  }

  busy = true;
  pickBtn.disabled = true;
  resultEl.style.display = 'none';
  barEl.style.width = '0%';

  try {
    // 1. Hash the video content
    statusEl.textContent = 'Hashing video…';
    const sha256 = await hashVideoContent(file);
    statusEl.textContent = `SHA-256: ${sha256.slice(0, 16)}…`;

    // 2. Init the pose worker
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
    await send({ type: 'init' });

    // 3. Extract frames and run pose detection
    statusEl.textContent = 'Extracting landmarks…';
    const worldLandmarks = [];
    const timestamps = [];
    let frameWidth = 0, frameHeight = 0;

    const metadata = await extractFramesStreaming(
      file, TARGET_FPS, MAX_FRAMES, MAX_LONG_SIDE,
      async (canvas, index, timestamp) => {
        frameWidth = canvas.width;
        frameHeight = canvas.height;
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer;
        const result = await send({ pixels, width: canvas.width, height: canvas.height, timestamp: index * 1000 / TARGET_FPS }, [pixels]);
        worldLandmarks.push(result.world);
        timestamps.push(timestamp);
      },
      pct => {
        barEl.style.width = `${Math.round(pct * 100)}%`;
        statusEl.textContent = `Extracting landmarks… ${Math.round(pct * 100)}%`;
      },
      { deterministic: true },
    );

    worker.terminate();
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

    // 5. Offer download and issue link
    saveLinkEl.href = URL.createObjectURL(blob);
    saveLinkEl.download = name;
    fileNameEl.textContent = name;
    issueLinkEl.href = issueUrl({ lift, count, view, sha256 });
    resultEl.style.display = 'block';

  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
    console.error(err);
  } finally {
    busy = false;
    pickBtn.disabled = false;
    videoInput.value = '';
  }
});

resetBtn.addEventListener('click', () => {
  resultEl.style.display = 'none';
  statusEl.textContent = '';
  barEl.style.width = '0%';
  $('count').value = '';
});
