#!/usr/bin/env node
/**
 * Clip collector — local web server for David's phone.
 *
 * Open the URL on your phone (same WiFi), pick a video,
 * choose the exercise, type the rep count, hit Send.
 * The clip lands on your Mac and the manifest updates.
 *
 * Usage:
 *   node scripts/collect-clips.mjs
 *   node scripts/collect-clips.mjs --port 3456
 */

import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, createWriteStream } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { networkInterfaces } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REAL_PHONE_DIR = join(ROOT, 'test', 'real-phone');
const CLIPS_DIR = join(REAL_PHONE_DIR, 'clips');
const MANIFEST_PATH = join(REAL_PHONE_DIR, 'manifest.json');

const args = process.argv.slice(2);
let port = 3333;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && args[i + 1]) port = parseInt(args[i + 1], 10);
}

mkdirSync(CLIPS_DIR, { recursive: true });

// Get local IP
function getLocalIP() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

// Load or create manifest
function loadManifest() {
  if (existsSync(MANIFEST_PATH)) {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  }
  return {
    name: 'WorkoutVision Real-Phone Benchmark',
    description: 'Clips filmed by David on his iPhone, with human-counted ground truth.',
    source: 'david-phone',
    rule: 'R1: never modify a label, never delete a clip, labels come from David only.',
    clips: [],
  };
}

function saveManifest(manifest) {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

// ─── HTML page served to phone ─────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<title>WV Clip Collector</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, system-ui, sans-serif;
    background: #0a0a0e; color: #e8e6e1;
    padding: 20px; max-width: 500px; margin: 0 auto;
    -webkit-text-size-adjust: 100%;
  }
  h1 { font-size: 1.3rem; margin-bottom: 4px; color: #D4A76A; }
  .sub { font-size: 0.8rem; color: #777; margin-bottom: 24px; }
  .field { margin-bottom: 20px; }
  label { display: block; font-size: 0.85rem; color: #999; margin-bottom: 6px; font-weight: 600; }
  .file-btn {
    display: block; width: 100%; padding: 14px;
    background: #1e1e22; border: 2px dashed #333; border-radius: 12px;
    color: #999; font-size: 0.9rem; text-align: center; cursor: pointer;
  }
  .file-btn.has-file { border-color: #D4A76A; color: #D4A76A; border-style: solid; }
  input[type=file] { display: none; }
  select, input[type=number] {
    width: 100%; padding: 12px; font-size: 1rem;
    background: #161619; border: 1px solid #333; border-radius: 8px;
    color: #e8e6e1; -webkit-appearance: none;
  }
  select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M6 8L1 3h10z' fill='%23666'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }
  .lift-group { font-size: 0.7rem; color: #666; font-weight: 700; text-transform: uppercase; padding: 4px 0; }
  .row { display: flex; gap: 12px; }
  .row > .field { flex: 1; }
  button.submit {
    width: 100%; padding: 16px; font-size: 1.1rem; font-weight: 700;
    background: #D4A76A; color: #0a0a0e; border: none; border-radius: 12px;
    cursor: pointer; margin-top: 8px;
  }
  button.submit:disabled { opacity: 0.3; cursor: not-allowed; }
  .status { margin-top: 16px; padding: 12px; border-radius: 8px; font-size: 0.85rem; display: none; }
  .status.ok { display: block; background: rgba(93,184,122,0.15); color: #5DB87A; }
  .status.err { display: block; background: rgba(255,80,80,0.15); color: #ff5050; }
  .status.uploading { display: block; background: rgba(212,167,106,0.1); color: #D4A76A; }
  .progress { width: 100%; height: 4px; background: #222; border-radius: 2px; margin-top: 8px; overflow: hidden; display: none; }
  .progress.active { display: block; }
  .progress-bar { height: 100%; background: #D4A76A; width: 0%; transition: width 0.3s; }
  .history { margin-top: 32px; }
  .history h2 { font-size: 0.85rem; color: #666; margin-bottom: 8px; }
  .clip-row { padding: 8px 0; border-bottom: 1px solid #1a1a1e; font-size: 0.82rem; display: flex; justify-content: space-between; }
  .clip-name { color: #ccc; }
  .clip-info { color: #D4A76A; }
  video { width: 100%; max-height: 200px; border-radius: 8px; margin-top: 8px; display: none; background: #000; }
</style>
</head>
<body>

<h1>Clip Collector</h1>
<p class="sub">Film a set, send it here. The video stays on your network.</p>

<div class="field">
  <label>Video</label>
  <div class="file-btn" id="fileBtn" onclick="document.getElementById('fileInput').click()">
    Tap to select video
  </div>
  <input type="file" id="fileInput" accept=".mov,.mp4,.m4v,.webm,video/quicktime,video/mp4">
  <video id="preview" playsinline muted></video>
</div>

<div class="field">
  <label>Exercise</label>
  <select id="exercise">
    <optgroup label="Launch lifts">
      <option value="bench_press">Bench press</option>
      <option value="bicep_curl">Bicep curl</option>
      <option value="lateral_raise">Lateral raise</option>
      <option value="overhead_press">Shoulder press</option>
      <option value="lat_pulldown">Lat pulldown</option>
    </optgroup>
    <optgroup label="Other validated">
      <option value="squat">Squat</option>
      <option value="pull_up">Pull-up</option>
      <option value="push_up">Push-up</option>
      <option value="lunge">Lunge</option>
      <option value="front_raise">Front raise</option>
      <option value="sit_up">Sit-up</option>
      <option value="battle_rope">Battle rope</option>
    </optgroup>
  </select>
</div>

<div class="row">
  <div class="field">
    <label>Reps (you counted)</label>
    <input type="number" id="reps" min="1" max="100" placeholder="e.g. 8" inputmode="numeric">
  </div>
  <div class="field">
    <label>View</label>
    <select id="view">
      <option value="front">Front</option>
      <option value="side">Side</option>
      <option value="angle">Angle</option>
    </select>
  </div>
</div>

<button class="submit" id="sendBtn" disabled>Send clip</button>

<div class="progress" id="progress"><div class="progress-bar" id="progressBar"></div></div>
<div class="status" id="status"></div>

<div class="history" id="history"></div>

<script>
const fileInput = document.getElementById('fileInput');
const fileBtn = document.getElementById('fileBtn');
const preview = document.getElementById('preview');
const exercise = document.getElementById('exercise');
const reps = document.getElementById('reps');
const view = document.getElementById('view');
const sendBtn = document.getElementById('sendBtn');
const statusEl = document.getElementById('status');
const progressEl = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');
const historyEl = document.getElementById('history');

let selectedFile = null;
const sent = [];

fileInput.addEventListener('change', () => {
  selectedFile = fileInput.files[0];
  if (selectedFile) {
    const sizeMB = (selectedFile.size / 1024 / 1024).toFixed(1);
    fileBtn.textContent = selectedFile.name + ' (' + sizeMB + ' MB)';
    fileBtn.classList.add('has-file');
    preview.src = URL.createObjectURL(selectedFile);
    preview.style.display = 'block';
    preview.play();
    checkReady();
  }
});

reps.addEventListener('input', checkReady);

function checkReady() {
  sendBtn.disabled = !(selectedFile && reps.value && parseInt(reps.value) > 0);
}

sendBtn.addEventListener('click', async () => {
  if (!selectedFile || !reps.value) return;
  sendBtn.disabled = true;
  statusEl.className = 'status uploading';
  statusEl.textContent = 'Uploading...';
  progressEl.classList.add('active');
  progressBar.style.width = '0%';

  const ext = selectedFile.name.split('.').pop() || 'mov';
  const params = new URLSearchParams({
    exercise: exercise.value,
    reps: reps.value,
    view: view.value,
    ext: ext,
  });

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload?' + params.toString());

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        progressBar.style.width = Math.round(e.loaded / e.total * 100) + '%';
      }
    };

    const result = await new Promise((resolve, reject) => {
      xhr.onload = () => {
        if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
        else reject(new Error(xhr.responseText));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(selectedFile);
    });

    statusEl.className = 'status ok';
    statusEl.textContent = '\\u2713 Saved: ' + result.file + ' (' + result.totalClips + ' clips total)';

    sent.unshift({ exercise: exercise.value, reps: reps.value, view: view.value, file: result.file });
    renderHistory();

    // Reset for next clip
    selectedFile = null;
    fileInput.value = '';
    fileBtn.textContent = 'Tap to select video';
    fileBtn.classList.remove('has-file');
    preview.style.display = 'none';
    reps.value = '';
    sendBtn.disabled = true;
  } catch (err) {
    statusEl.className = 'status err';
    statusEl.textContent = 'Error: ' + err.message;
    sendBtn.disabled = false;
  }

  progressEl.classList.remove('active');
});

function renderHistory() {
  if (sent.length === 0) { historyEl.innerHTML = ''; return; }
  let html = '<h2>Sent this session</h2>';
  for (const c of sent) {
    html += '<div class="clip-row"><span class="clip-name">' + c.exercise.replace(/_/g, ' ') + '</span><span class="clip-info">' + c.reps + ' reps · ' + c.view + '</span></div>';
  }
  historyEl.innerHTML = html;
}
</script>
</body>
</html>`;

// ─── Server ────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  // Serve the HTML page
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  // Handle upload
  if (req.method === 'POST' && req.url.startsWith('/upload')) {
    const url = new URL(req.url, `http://localhost:${port}`);
    const exercise = url.searchParams.get('exercise');
    const reps = parseInt(url.searchParams.get('reps'), 10);
    const view = url.searchParams.get('view') || 'front';
    const ext = url.searchParams.get('ext') || 'mov';

    if (!exercise || isNaN(reps) || reps < 1) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing exercise or reps');
      return;
    }

    // Generate filename: exercise_reps_view_timestamp.ext
    const ts = Date.now().toString(36);
    const filename = `${exercise}_${reps}_${view}_${ts}.${ext}`;
    const filepath = join(CLIPS_DIR, filename);

    // Stream body to file
    const ws = createWriteStream(filepath);
    let bytes = 0;

    req.on('data', (chunk) => {
      bytes += chunk.length;
      ws.write(chunk);
    });

    req.on('end', () => {
      ws.end();

      // Update manifest
      const manifest = loadManifest();
      manifest.clips.push({
        file: filename,
        exercise,
        reps,
        view,
        source: 'david-phone',
        addedAt: new Date().toISOString().slice(0, 10),
        sizeBytes: bytes,
      });
      manifest.clips.sort((a, b) => a.file.localeCompare(b.file));
      saveManifest(manifest);

      const sizeMB = (bytes / 1024 / 1024).toFixed(1);
      console.log(`  ✓ ${filename} (${sizeMB} MB) — ${exercise} × ${reps} reps`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, file: filename, totalClips: manifest.clips.length }));
    });

    req.on('error', (err) => {
      ws.destroy();
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Upload error: ' + err.message);
    });

    return;
  }

  // Show manifest
  if (req.method === 'GET' && req.url === '/manifest') {
    const manifest = loadManifest();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(manifest, null, 2));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

const ip = getLocalIP();
server.listen(port, '0.0.0.0', () => {
  console.log(`\n  ┌─────────────────────────────────────────┐`);
  console.log(`  │  Clip Collector running                  │`);
  console.log(`  │                                          │`);
  console.log(`  │  On your phone, open:                    │`);
  console.log(`  │  http://${ip}:${port}`.padEnd(45) + `│`);
  console.log(`  │                                          │`);
  console.log(`  │  Clips → test/real-phone/clips/          │`);
  console.log(`  │  Manifest → test/real-phone/manifest.json│`);
  console.log(`  │                                          │`);
  console.log(`  │  Ctrl+C to stop                          │`);
  console.log(`  └─────────────────────────────────────────┘\n`);
});
