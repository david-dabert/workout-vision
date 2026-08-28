import { useState, useRef, useCallback } from 'react';
import { getImageLandmarker, detectPoseImage, selectSubjectPose, extractJointAngles } from '../lib/poseAnalysis';
import { EXERCISES, EXERCISE_GROUPS } from '../lib/exercises';
import { RepCounter } from '../lib/repCounter';
import { ExerciseAutoDetector } from '../lib/exerciseDetector';
import { analyzeSet } from '../lib/biomechanics';

const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const MAX_FRAMES = IS_IOS ? 90 : 150;

// RepCount dataset exercise categories → app exercise keys
const REPCOUNT_EXERCISE_MAP = {
  'squat': 'squat',
  'push_up': 'push_up',
  'pushup': 'push_up',
  'pull_up': 'pull_up',
  'pullup': 'pull_up',
  'bench_press': 'bench_press',
  'benchpress': 'bench_press',
  'front_raise': 'front_raise',
  'frontraise': 'front_raise',
  'situp': 'sit_up',
  'sit_up': 'sit_up',
  'deadlift': 'deadlift',
  'battle_rope': 'battle_rope',
  'battlerope': 'battle_rope',
};

function guessExerciseFromFilename(filename) {
  const lower = filename.toLowerCase().replace(/\.\w+$/, '');
  for (const [pattern, key] of Object.entries(REPCOUNT_EXERCISE_MAP)) {
    if (lower.includes(pattern)) return key;
  }
  return '__auto__';
}

function parseRepCountCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return {};
  const headers = lines[0].split(',').map(h => h.trim());
  const nameIdx = headers.indexOf('name');
  const countIdx = headers.indexOf('count');
  if (nameIdx === -1 || countIdx === -1) return {};

  const annotations = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (cols.length <= Math.max(nameIdx, countIdx)) continue;
    const name = cols[nameIdx];
    const count = parseInt(cols[countIdx], 10);
    if (name && !isNaN(count)) {
      // Strip path prefix if present (e.g. "test/squat_001.mp4" → "squat_001.mp4")
      const baseName = name.includes('/') ? name.split('/').pop() : name;
      annotations[baseName] = count;
    }
  }
  return annotations;
}

/**
 * Validation harness — hidden dev page for engine accuracy testing.
 *
 * Upload a video, enter ground truth (exercise + rep count),
 * run the analysis, get precision/recall/F1 report.
 *
 * Access via ?validate=1 or #validate in the URL.
 */
export default function Validate({ onClose }) {
  const [tests, setTests] = useState([]);
  const [running, setRunning] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [results, setResults] = useState([]);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const datasetVideoRef = useRef(null);
  const [csvAnnotations, setCsvAnnotations] = useState(null);
  const [csvFilename, setCsvFilename] = useState('');

  // Add a test case
  const addTest = (file, exercise, reps) => {
    setTests(prev => [...prev, {
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      expectedExercise: exercise || '__auto__',
      expectedReps: reps != null ? String(reps) : '',
      status: 'pending',
    }]);
  };

  // Load RepCount CSV annotations
  const loadCSV = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const annotations = parseRepCountCSV(e.target.result);
      const count = Object.keys(annotations).length;
      if (count === 0) return;
      setCsvAnnotations(annotations);
      setCsvFilename(`${file.name} (${count} entries)`);
    };
    reader.readAsText(file);
  };

  // Load dataset videos (matched against CSV annotations)
  const loadDatasetVideos = (files) => {
    const videoFiles = Array.from(files).filter(f => f.name.match(/\.(mp4|webm|mov|avi|mkv)$/i));
    let matched = 0;
    for (const file of videoFiles) {
      const baseName = file.name;
      const reps = csvAnnotations?.[baseName];
      const exercise = guessExerciseFromFilename(baseName);
      addTest(file, exercise, reps != null ? reps : undefined);
      if (reps != null) matched++;
    }
  };

  // Load Countix benchmark from manifest.json (auto-fetch videos from server)
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState(null);

  const loadBenchmark = useCallback(async () => {
    setBenchmarkLoading(true);
    setBenchmarkError(null);
    try {
      const base = import.meta.env.BASE_URL || '/';
      const res = await fetch(`${base}benchmark/manifest.json`);
      if (!res.ok) throw new Error(`Manifest not found (${res.status}). Run the benchmark download script first.`);
      const manifest = await res.json();
      if (!manifest.videos?.length) throw new Error('Empty manifest');

      // Verify at least one video is accessible
      const testUrl = `${base}benchmark/videos/${manifest.videos[0].file}`;
      const probe = await fetch(testUrl, { method: 'HEAD' });
      if (!probe.ok) throw new Error(`Videos not served. Ensure benchmark/videos/ is in public/ or symlinked.`);

      // Add all videos as URL-based tests
      const newTests = manifest.videos.map(v => ({
        id: Date.now() + Math.random(),
        file: null,
        url: `${base}benchmark/videos/${v.file}`,
        name: v.file,
        expectedExercise: v.exercise,
        expectedReps: String(v.reps),
        status: 'pending',
      }));
      setTests(prev => [...prev, ...newTests]);
      setBenchmarkLoading(false);
    } catch (err) {
      setBenchmarkError(err.message);
      setBenchmarkLoading(false);
    }
  }, []);

  const updateTest = (id, field, value) => {
    setTests(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTest = (id) => {
    setTests(prev => prev.filter(t => t.id !== id));
    setResults(prev => prev.filter(r => r.testId !== id));
  };

  // Run one video through the exact same pipeline as VideoUpload
  const analyzeOne = useCallback(async (test) => {
    const video = videoRef.current;
    if (!video) return { error: 'No video element' };

    const landmarker = await getImageLandmarker();
    if (!landmarker) return { error: 'Model failed to load' };

    const url = test.url || URL.createObjectURL(test.file);
    const isObjectUrl = !test.url;
    try {
      // Load video
      const loaded = await new Promise((resolve) => {
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.src = url;
        video.load();
        let settled = false;
        const done = (v) => { if (!settled) { settled = true; resolve(v); } };
        video.addEventListener('loadeddata', () => done(true), { once: true });
        video.onerror = () => done(false);
        setTimeout(() => done(false), 20_000);
      });
      if (!loaded) return { error: 'Video failed to load' };

      const duration = video.duration;
      if (!duration || !isFinite(duration)) return { error: 'Cannot read duration' };

      const analysisFps = Math.min(IS_IOS ? 4 : 6, MAX_FRAMES / duration);
      const totalFrames = Math.min(MAX_FRAMES, Math.ceil(duration * analysisFps));
      const interval = duration / totalFrames;

      const maxW = IS_IOS ? 480 : 720;
      const scale = Math.min(1, maxW / video.videoWidth);
      const offscreen = document.createElement('canvas');
      offscreen.width = Math.round(video.videoWidth * scale);
      offscreen.height = Math.round(video.videoHeight * scale);
      const offCtx = offscreen.getContext('2d');

      const hasRVFC = typeof video.requestVideoFrameCallback === 'function';
      const waitForFrame = () => new Promise((resolve) => {
        if (hasRVFC) {
          const timeout = setTimeout(resolve, 800);
          video.requestVideoFrameCallback(() => { clearTimeout(timeout); resolve(); });
        } else {
          const start = Date.now();
          const check = () => {
            if (video.readyState >= 2 || Date.now() - start > 500) {
              requestAnimationFrame(() => requestAnimationFrame(resolve));
            } else setTimeout(check, 20);
          };
          check();
        }
      });

      const frames = [];
      let lockedSubjectIdx = null;
      const exerciseKey = test.expectedExercise === '__auto__' ? 'squat' : test.expectedExercise;
      const repCounter = new RepCounter(exerciseKey, { fps: analysisFps });
      const autoDetector = test.expectedExercise === '__auto__'
        ? new ExerciseAutoDetector({ fps: analysisFps }) : null;

      const t0 = Date.now();

      for (let i = 0; i < totalFrames; i++) {
        const time = i * interval;
        if (time >= duration) break;

        await new Promise((resolve) => {
          video.currentTime = time;
          let settled = false;
          const settle = () => { if (!settled) { settled = true; resolve(); } };
          const onSeeked = async () => {
            video.removeEventListener('seeked', onSeeked);
            await waitForFrame();
            offCtx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
            const result = detectPoseImage(landmarker, offscreen);
            if (result?.landmarks?.length) {
              let lm;
              if (result.landmarks.length === 1) {
                lm = result.landmarks[0];
              } else {
                if (lockedSubjectIdx === null) {
                  lm = selectSubjectPose(result.landmarks);
                  lockedSubjectIdx = result.landmarks.indexOf(lm);
                } else {
                  lm = result.landmarks[lockedSubjectIdx] || selectSubjectPose(result.landmarks);
                }
              }
              const angles = extractJointAngles(lm);
              frames.push({ landmarks: lm, timestamp: time, angles });
              repCounter.update(lm);
            }
            settle();
          };
          video.addEventListener('seeked', onSeeked);
          setTimeout(() => { video.removeEventListener('seeked', onSeeked); settle(); }, 5000);
        });

        if (Date.now() - t0 > 180_000) break;
      }

      if (frames.length === 0) return { error: 'No poses detected', frames: 0 };

      // Auto-detect exercise if needed
      let detectedExercise = exerciseKey;
      let autoDetected = false;
      if (autoDetector) {
        const tallies = {};
        const det = new ExerciseAutoDetector({ fps: analysisFps });
        for (const f of frames) {
          const d = det.update(f.landmarks);
          if (d) tallies[d] = (tallies[d] || 0) + 1;
        }
        const candidates = Object.keys(tallies);
        if (candidates.length > 0) {
          let bestEx = exerciseKey, bestScore = -1;
          for (const ex of candidates) {
            const rc = new RepCounter(ex, { fps: analysisFps });
            for (const f of frames) rc.update(f.landmarks);
            rc.finalize();
            const reps = rc.repHistory ? rc.repHistory.length : 0;
            const score = reps * 1000 + tallies[ex];
            if (score > bestScore) { bestScore = score; bestEx = ex; }
          }
          if (bestEx !== exerciseKey) {
            detectedExercise = bestEx;
            autoDetected = true;
          }
        }
      }

      // Re-run rep counter with the correct exercise
      const finalCounter = new RepCounter(detectedExercise, { fps: analysisFps });
      for (const f of frames) finalCounter.update(f.landmarks);
      finalCounter.finalize();
      const repHistory = finalCounter.repHistory || [];
      const reps = repHistory.length;

      // Biomechanics
      const landmarkFrames = frames.map(f => f.landmarks);
      let bioAnalysis = null;
      try { bioAnalysis = analyzeSet(landmarkFrames, analysisFps, detectedExercise, repHistory); }
      catch (_) {}

      const scoredReps = repHistory.filter(r => r.score != null);
      const formScore = scoredReps.length > 0
        ? Math.round(scoredReps.reduce((s, r) => s + r.score, 0) / scoredReps.length) : 0;

      const analysisTime = ((Date.now() - t0) / 1000).toFixed(1);

      return {
        detectedExercise,
        autoDetected,
        reps,
        formScore,
        frames: frames.length,
        duration: Math.round(duration),
        analysisTime,
        repHistory,
        bioAnalysis,
        diagnostics: finalCounter.diagnostics || null,
      };
    } finally {
      if (isObjectUrl) URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
    }
  }, []);

  // Run all tests
  const runAll = useCallback(async () => {
    setRunning(true);
    setResults([]);
    const allResults = [];

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      setCurrentIdx(i);
      setTests(prev => prev.map((t, j) => j === i ? { ...t, status: 'running' } : t));

      const result = await analyzeOne(test);
      const expected = parseInt(test.expectedReps, 10);
      const actual = result.reps || 0;
      const exerciseMatch = test.expectedExercise === '__auto__'
        ? true
        : result.detectedExercise === test.expectedExercise;

      const entry = {
        testId: test.id,
        name: test.name,
        expectedExercise: test.expectedExercise,
        detectedExercise: result.detectedExercise || 'N/A',
        exerciseMatch,
        expectedReps: isNaN(expected) ? '?' : expected,
        actualReps: actual,
        repError: isNaN(expected) ? null : actual - expected,
        repAccuracy: isNaN(expected) ? null : (expected === 0 ? (actual === 0 ? 100 : 0) : Math.max(0, Math.round((1 - Math.abs(actual - expected) / expected) * 100))),
        formScore: result.formScore || 0,
        frames: result.frames || 0,
        duration: result.duration || 0,
        analysisTime: result.analysisTime || '?',
        error: result.error || null,
        diagnostics: result.diagnostics,
      };

      allResults.push(entry);
      setResults([...allResults]);
      setTests(prev => prev.map((t, j) => j === i ? { ...t, status: result.error ? 'error' : 'done' } : t));
    }

    setCurrentIdx(-1);
    setRunning(false);
  }, [tests, analyzeOne]);

  // Aggregate stats
  const scored = results.filter(r => r.repAccuracy !== null && !r.error);
  const avgAccuracy = scored.length > 0
    ? Math.round(scored.reduce((s, r) => s + r.repAccuracy, 0) / scored.length) : null;
  const exactMatch = scored.filter(r => r.repError === 0).length;
  const withinOne = scored.filter(r => Math.abs(r.repError) <= 1).length;
  const exerciseMatches = results.filter(r => r.exerciseMatch && !r.error).length;
  const exerciseTotal = results.filter(r => !r.error && r.expectedExercise !== '__auto__').length;

  // Standard RepCount benchmark metrics
  const mae = scored.length > 0
    ? (scored.reduce((s, r) => s + Math.abs(r.repError), 0) / scored.length).toFixed(2) : null;
  const obo = scored.length > 0
    ? Math.round((withinOne / scored.length) * 100) : null;

  return (
    <div className="page" style={{ padding: '16px env(safe-area-inset-right) 16px env(safe-area-inset-left)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Engine Validation</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
        Upload videos with known rep counts. The engine runs the exact same pipeline as production.
        Compare detected reps vs ground truth to compute accuracy.
      </p>

      {/* Countix benchmark — one-click */}
      <div style={{
        background: 'rgba(0,245,212,0.04)', borderRadius: 10, padding: '12px 14px',
        marginBottom: 10, border: '1px solid rgba(0,245,212,0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Countix Benchmark
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>43 videos, 9 exercises</span>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: 8, lineHeight: 1.4 }}>
          Academic benchmark from Google Research (CVPR 2020). Ground truth rep counts across squats, push-ups, pull-ups, bench press, bicep curls, front raises, lunges, sit-ups, battle rope.
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={loadBenchmark}
          disabled={running || benchmarkLoading}
          style={{ fontSize: '0.75rem', fontWeight: 700, width: '100%' }}
        >
          {benchmarkLoading ? 'Loading manifest...' : 'Load Countix Benchmark'}
        </button>
        {benchmarkError && (
          <div style={{ fontSize: '0.7rem', color: 'var(--red)', marginTop: 6, lineHeight: 1.4 }}>
            {benchmarkError}
          </div>
        )}
      </div>

      {/* RepCount dataset loader (manual CSV + videos) */}
      <details style={{ marginBottom: 10 }}>
        <summary style={{ fontSize: '0.75rem', color: 'var(--muted)', cursor: 'pointer', padding: '6px 0' }}>
          Or load RepCount dataset manually (CSV + videos)
        </summary>
        <div style={{
          background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px',
          marginTop: 6, border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: 10, lineHeight: 1.4 }}>
            Step 1: Load CSV annotation file (test.csv). Step 2: Select video files.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => csvInputRef.current?.click()} style={{ fontSize: '0.72rem' }}>
              {csvAnnotations ? 'CSV loaded' : '1. Load CSV'}
            </button>
            <input ref={csvInputRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.[0]) loadCSV(e.target.files[0]); e.target.value = ''; }} />
            <button className="btn btn-ghost btn-sm" onClick={() => datasetVideoRef.current?.click()}
              style={{ fontSize: '0.72rem', opacity: csvAnnotations ? 1 : 0.5 }}>
              2. Load videos
            </button>
            <input ref={datasetVideoRef} type="file" accept="video/*" multiple style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.length) loadDatasetVideos(e.target.files); e.target.value = ''; }} />
          </div>
          {csvFilename && <div style={{ fontSize: '0.68rem', color: 'var(--accent)', marginTop: 6 }}>{csvFilename}</div>}
        </div>
      </details>

      {/* Add test videos manually */}
      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed rgba(255,255,255,0.15)', borderRadius: 10, padding: '14px',
          textAlign: 'center', cursor: 'pointer', marginBottom: 12,
        }}
      >
        <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>+ Add test video(s) manually</span>
        <input ref={fileInputRef} type="file" accept="video/*" multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            Array.from(e.target.files || []).forEach(f => addTest(f));
            e.target.value = '';
          }}
        />
      </div>

      {/* Test list */}
      {tests.map((test, i) => (
        <div key={test.id} style={{
          background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 12px',
          marginBottom: 8, border: test.status === 'running' ? '1px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {test.status === 'running' && '> '}{test.name}
            </span>
            {!running && (
              <button onClick={() => removeTest(test.id)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}>&times;</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={test.expectedExercise}
              onChange={(e) => updateTest(test.id, 'expectedExercise', e.target.value)}
              disabled={running}
              style={{
                flex: 1, minWidth: 140, padding: '6px 8px', borderRadius: 6, fontSize: '0.75rem',
                background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <option value="__auto__">Auto-detect</option>
              {EXERCISE_GROUPS.map(g => (
                <optgroup key={g.label} label={g.label}>
                  {g.exercises.map(ex => (
                    <option key={ex.key} value={ex.key}>{ex.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <input
              type="number"
              inputMode="numeric"
              placeholder="Reps"
              value={test.expectedReps}
              onChange={(e) => updateTest(test.id, 'expectedReps', e.target.value)}
              disabled={running}
              style={{
                width: 60, padding: '6px 8px', borderRadius: 6, fontSize: '0.75rem',
                background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.12)',
                textAlign: 'center',
              }}
            />
          </div>
        </div>
      ))}

      {/* Run button */}
      {tests.length > 0 && !running && (
        <button className="btn btn-primary" onClick={runAll}
          style={{ width: '100%', marginTop: 8, marginBottom: 16, fontWeight: 700 }}>
          Run {tests.length} test{tests.length > 1 ? 's' : ''}
        </button>
      )}

      {running && (
        <div style={{ textAlign: 'center', padding: '12px 0', fontSize: '0.82rem', color: 'var(--accent)' }}>
          Running test {currentIdx + 1} of {tests.length}...
        </div>
      )}

      {/* Hidden video element for analysis */}
      <video ref={videoRef} muted playsInline preload="auto"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />

      {/* Results */}
      {results.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>Results</h3>

          {/* Aggregate stats */}
          {scored.length > 0 && (
            <div style={{
              background: 'rgba(0,245,212,0.06)', border: '1px solid rgba(0,245,212,0.2)',
              borderRadius: 10, padding: '12px 14px', marginBottom: 14,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: avgAccuracy >= 90 ? 'var(--accent)' : avgAccuracy >= 70 ? 'var(--yellow)' : 'var(--red)' }}>
                    {avgAccuracy}%
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>AVG ACCURACY</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {exactMatch}/{scored.length}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>EXACT MATCH</div>
                </div>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {withinOne}/{scored.length}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>WITHIN +/-1 (OBO)</div>
                </div>
              </div>
              {mae !== null && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, textAlign: 'center', marginTop: 10 }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: parseFloat(mae) <= 1 ? 'var(--accent)' : parseFloat(mae) <= 2 ? 'var(--yellow)' : 'var(--red)' }}>
                      {mae}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>MAE (lower = better)</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: obo >= 80 ? 'var(--accent)' : obo >= 60 ? 'var(--yellow)' : 'var(--red)' }}>
                      {obo}%
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>OBO ACCURACY</div>
                  </div>
                </div>
              )}
              {exerciseTotal > 0 && (
                <div style={{ marginTop: 8, textAlign: 'center', fontSize: '0.72rem', color: 'var(--muted)' }}>
                  Exercise detection: {exerciseMatches}/{exerciseTotal} correct
                </div>
              )}
            </div>
          )}

          {/* Per-test results */}
          {results.map((r, i) => (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px',
              marginBottom: 6, borderLeft: r.error ? '3px solid var(--red)' :
                r.repError === 0 ? '3px solid var(--accent)' :
                Math.abs(r.repError) <= 1 ? '3px solid var(--yellow)' : '3px solid var(--red)',
            }}>
              {r.error ? (
                <div style={{ color: 'var(--red)', fontSize: '0.78rem' }}>{r.name}: {r.error}</div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.name}</span>
                    <span style={{
                      fontWeight: 700,
                      color: r.repError === 0 ? 'var(--accent)' : Math.abs(r.repError) <= 1 ? 'var(--yellow)' : 'var(--red)',
                    }}>
                      {r.actualReps}/{r.expectedReps === '?' ? '?' : r.expectedReps} reps
                      {r.repError !== null && r.repError !== 0 && ` (${r.repError > 0 ? '+' : ''}${r.repError})`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.68rem', color: 'var(--muted)' }}>
                    <span>Exercise: {EXERCISES[r.detectedExercise]?.name || r.detectedExercise}
                      {!r.exerciseMatch && r.expectedExercise !== '__auto__' &&
                        <span style={{ color: 'var(--red)' }}> (expected: {EXERCISES[r.expectedExercise]?.name || r.expectedExercise})</span>
                      }
                    </span>
                    <span>Form: {r.formScore}/100</span>
                    <span>{r.analysisTime}s</span>
                  </div>
                  {r.diagnostics && (
                    <div style={{ marginTop: 4, fontSize: '0.65rem', color: 'var(--muted)', opacity: 0.7 }}>
                      Method: {r.diagnostics.method} | Range: {r.diagnostics.observedMin}-{r.diagnostics.observedMax} | Frames: {r.frames}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          {/* Export as JSON */}
          {scored.length > 0 && (
            <button
              className="btn btn-ghost"
              style={{ width: '100%', marginTop: 10, fontSize: '0.78rem' }}
              onClick={() => {
                const report = {
                  date: new Date().toISOString(),
                  device: navigator.userAgent,
                  benchmark: 'RepCount-compatible',
                  summary: {
                    testsRun: results.length,
                    testsScored: scored.length,
                    avgAccuracy,
                    exactMatch,
                    withinOne,
                    mae: mae !== null ? parseFloat(mae) : null,
                    oboAccuracy: obo,
                    exerciseDetection: exerciseTotal > 0 ? `${exerciseMatches}/${exerciseTotal}` : 'N/A',
                  },
                  results: results.map(r => ({
                    video: r.name,
                    expectedExercise: r.expectedExercise,
                    detectedExercise: r.detectedExercise,
                    exerciseMatch: r.exerciseMatch,
                    expectedReps: r.expectedReps,
                    actualReps: r.actualReps,
                    repError: r.repError,
                    repAccuracy: r.repAccuracy,
                    formScore: r.formScore,
                    frames: r.frames,
                    duration: r.duration,
                    analysisTime: r.analysisTime,
                    method: r.diagnostics?.method,
                    error: r.error,
                  })),
                };
                const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `validation-report-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              Export Report (JSON)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
