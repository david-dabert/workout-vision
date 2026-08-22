import { useState, useRef, useCallback, useEffect } from 'react';
import { getImageLandmarker, detectPoseImage, drawPose, extractJointAngles, disposeAllLandmarkers } from '../lib/poseAnalysis';
import { EXERCISES, EXERCISE_GROUPS, RepCounter, ExerciseAutoDetector } from '../lib/exercises';
import { analyzeSet } from '../lib/biomechanics';
import { generateWorkoutReport } from '../lib/coach';
import { saveWorkout } from '../lib/storage';
import { useProfile } from '../lib/ProfileContext';
import { shareCard } from '../lib/shareCard';
import { t, tExercise, getLang, setLang, onLangChange } from '../lib/i18n';
import VideoReplay from './VideoReplay';

// Build marker visible in UI to verify deployment is fresh
const BUILD_ID = 'v4-fix';

// Detect iOS Safari for platform-specific workarounds
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Hard cap on frames. iOS Safari crashes with high frame counts on large
// videos due to accumulated WASM/WebGL memory. 60 frames on iOS is safer.
const MAX_FRAMES = IS_IOS ? 60 : 120;

// File size cap. iOS Safari can crash loading very large blob URLs.
const MAX_FILE_SIZE = IS_IOS ? 250 * 1024 * 1024 : 500 * 1024 * 1024;

function gradeFromScore(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function gradeClass(score) {
  if (score >= 80) return 'good';
  if (score >= 60) return 'ok';
  return 'poor';
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function VideoUpload({ onClose, preSelectedExercise }) {
  const { profile: userProfile } = useProfile();
  const [queue, setQueue] = useState([]);
  const [exercise, setExercise] = useState(preSelectedExercise || '__auto__');
  const [autoDetect, setAutoDetect] = useState(!preSelectedExercise);
  const userChangedExercise = useRef(!!preSelectedExercise);
  const [weight, setWeight] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState('');
  const [currentFile, setCurrentFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [replayResult, setReplayResult] = useState(null);
  const [lang, setLangState] = useState(getLang());
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const abortRef = useRef(false);

  useEffect(() => {
    const unsub = onLangChange((l) => setLangState(l));
    return () => {
      unsub();
      // Abort any in-progress analysis
      abortRef.current = true;
      // Free WebGL contexts to prevent iOS Safari crash on re-mount
      disposeAllLandmarkers();
    };
  }, []);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('video/') || f.type === '');
    if (files.length === 0) return;
    const items = [];
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        alert(`${f.name} (${(f.size / 1024 / 1024).toFixed(0)} MB) ${t('too_large')}`);
        continue;
      }
      items.push({
        id: Date.now() + Math.random(),
        file: f,
        name: f.name,
        size: (f.size / 1024 / 1024).toFixed(1) + ' MB',
        status: 'queued',
        progress: 0,
      });
    }
    if (items.length) setQueue(prev => [...prev, ...items]);
    e.target.value = '';
  };

  const removeFromQueue = (id) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  // ─── SEEK-BASED ANALYSIS ENGINE ───
  //
  // This is the approach that WORKED on mobile (commit 45cb6bb).
  // It sets video.currentTime to each target timestamp, waits for the
  // 'seeked' event, draws the frame to canvas, runs pose detection.
  // One frame at a time, sequential, with a 3-second per-seek timeout.
  //
  // The play-based approach that replaced this NEVER worked on iOS Safari
  // with HEVC blob URLs. Restored to the proven working method.

  const analyzeVideo = useCallback(async (queueItem) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    // Load model first
    setAnalysisPhase('model');
    const landmarker = await getImageLandmarker();
    if (!landmarker) {
      alert(t('model_failed'));
      return null;
    }

    // Load video
    setAnalysisPhase('loading');
    const url = URL.createObjectURL(queueItem.file);
    let urlRevoked = false;
    const safeRevoke = () => { if (!urlRevoked) { urlRevoked = true; URL.revokeObjectURL(url); } };

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

    if (!loaded) {
      safeRevoke();
      alert(t('video_failed'));
      return null;
    }

    const duration = video.duration;
    if (!duration || !isFinite(duration)) {
      safeRevoke();
      alert('Cannot read video duration. Try a different file.');
      return null;
    }

    // Adaptive FPS: short videos get 3 FPS, long videos get fewer.
    // Cap total frames at MAX_FRAMES so a long video doesn't produce hundreds of seeks.
    const analysisFps = Math.min(3, MAX_FRAMES / duration);
    const totalFrames = Math.min(MAX_FRAMES, Math.ceil(duration * analysisFps));
    const interval = duration / totalFrames;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    console.log(`[Upload] ${BUILD_ID}: ${duration.toFixed(1)}s, ${video.videoWidth}x${video.videoHeight}, ${totalFrames} frames at ${analysisFps.toFixed(1)} FPS`);

    // Analysis state
    const frames = [];
    const replayFrames = [];
    const isAutoMode = exercise === '__auto__';
    const initialExercise = isAutoMode ? 'squat' : exercise;
    let detectedExercise = initialExercise;
    let repCounter = new RepCounter(initialExercise, { fps: analysisFps });
    const skipAutoDetect = !isAutoMode && userChangedExercise.current;
    const autoDetector = (isAutoMode || (autoDetect && !skipAutoDetect))
      ? new ExerciseAutoDetector({ fps: analysisFps }) : null;
    let autoDetectDone = false;
    let autoDetected = false;
    const analysisStart = Date.now();

    setAnalysisPhase('analyzing');

    // Wait for the video frame to actually be decoded and ready to draw.
    // iOS Safari fires 'seeked' BEFORE the frame is decoded, so drawing
    // immediately produces a black canvas.
    //
    // Strategy: wait for video.readyState >= HAVE_CURRENT_DATA, then
    // double-rAF to let the compositor present the frame. On iOS with
    // HEVC, this can take 50-150ms. Timeout after 500ms and try anyway.
    const waitForFrame = () => new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        if (video.readyState >= 2 || Date.now() - start > 500) {
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          } else {
            setTimeout(resolve, 80);
          }
        } else {
          setTimeout(check, 20);
        }
      };
      check();
    });

    // Process one frame at a time via seeking
    const processFrame = (frameIdx) => {
      return new Promise((res) => {
        const time = frameIdx * interval;
        if (time >= duration || abortRef.current) { res(false); return; }

        video.currentTime = time;

        let settled = false;
        const settle = (cont) => { if (!settled) { settled = true; res(cont); } };

        const onSeeked = async () => {
          video.removeEventListener('seeked', onSeeked);

          // iOS Safari fix: wait for the frame to actually render.
          // Without this, 90%+ of seeks produce black canvas frames.
          await waitForFrame();

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const result = detectPoseImage(landmarker, canvas);

          if (result?.landmarks?.length) {
            const landmarks = result.landmarks[0];
            drawPose(ctx, landmarks, canvas.width, canvas.height);

            const angles = extractJointAngles(landmarks);
            frames.push({ landmarks, timestamp: time, angles });
            repCounter.update(landmarks);

            // Store frames for replay overlay. On iOS, store every other
            // frame to save memory; on desktop, store every frame.
            if (!IS_IOS || frameIdx % 2 === 0) {
              replayFrames.push({ landmarks, timestamp: time });
            }
          }

          const pct = Math.min(99, Math.round(((frameIdx + 1) / totalFrames) * 100));
          setProgress(pct);
          setQueue(prev => prev.map(q =>
            q.id === queueItem.id ? { ...q, progress: pct } : q
          ));
          settle(true);
        };

        video.addEventListener('seeked', onSeeked);
        // Per-seek 5-second timeout: skip this frame if seek hangs
        setTimeout(() => {
          video.removeEventListener('seeked', onSeeked);
          settle(true); // skip frame, continue to next
        }, 5000);
      });
    };

    // Sequential frame processing with UI yields
    let frameIdx = 0;
    while (frameIdx < totalFrames) {
      const cont = await processFrame(frameIdx);
      if (!cont) break;
      frameIdx++;
      // Yield to UI thread every 5 frames so progress bar updates
      if (frameIdx % 5 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
      // Hard wall-clock cap: 3 minutes
      if (Date.now() - analysisStart > 180_000) {
        console.warn('[Upload] 3-minute wall-clock cap reached');
        break;
      }
    }

    const analysisTime = ((Date.now() - analysisStart) / 1000).toFixed(1);

    if (frames.length === 0) {
      safeRevoke();
      alert(`${t('no_poses')} ${queueItem.name}.\n\n${t('try_different')}`);
      return null;
    }

    // Deferred auto-detection: run all frames through each candidate exercise's
    // rep counter and pick the one with the most reps
    if (autoDetector && !userChangedExercise.current) {
      const tallies = {};
      const detector = new ExerciseAutoDetector({ fps: analysisFps });
      for (const f of frames) {
        const det = detector.update(f.landmarks);
        if (det) tallies[det] = (tallies[det] || 0) + 1;
      }
      const candidates = Object.keys(tallies);
      if (candidates.length > 0) {
        let bestEx = initialExercise;
        let bestScore = -1;
        for (const ex of candidates) {
          const rc = new RepCounter(ex, { fps: analysisFps });
          for (const f of frames) rc.update(f.landmarks);
          rc.finalize();
          const reps = rc.repHistory ? rc.repHistory.length : 0;
          const score = reps * 1000 + tallies[ex];
          if (score > bestScore) { bestScore = score; bestEx = ex; }
        }
        if (bestEx !== initialExercise || candidates.includes(initialExercise)) {
          detectedExercise = bestEx;
          autoDetected = true;
          setExercise(detectedExercise);
          repCounter = new RepCounter(detectedExercise, { fps: analysisFps });
          for (const f of frames) repCounter.update(f.landmarks);
        }
      }
    }

    repCounter.finalize();
    console.log(`[Upload] ${frames.length}/${totalFrames} frames in ${analysisTime}s`);

    const landmarkFrames = frames.map(f => f.landmarks);
    const repHistory = repCounter.repHistory || [];
    const reps = repHistory.length;

    let bioAnalysis = null;
    try { bioAnalysis = analyzeSet(landmarkFrames, analysisFps, detectedExercise, repHistory); }
    catch (err) { console.error('Bio analysis error:', err); }

    let report = null;
    try {
      report = generateWorkoutReport(userProfile, [{
        exerciseKey: detectedExercise, exercise: detectedExercise,
        reps, analysis: bioAnalysis, bioAnalysis, repHistory,
      }]);
    } catch (err) { console.error('Report error:', err); }

    const avgScore = repHistory.length > 0
      ? Math.round(repHistory.reduce((s, r) => s + (r.score || 0), 0) / repHistory.length)
      : bioAnalysis?.movementQuality || 0;

    const w = parseFloat(weight) || 0;
    const workout = {
      id: Date.now().toString(), date: new Date().toISOString(),
      exercise: detectedExercise,
      exerciseName: EXERCISES[detectedExercise]?.name || detectedExercise,
      reps, duration: Math.round(duration), formScore: avgScore,
      repHistory, weight: w, volume: w * reps, source: 'upload',
    };
    try { await saveWorkout(workout); } catch (err) { console.error('Save error:', err); }

    setProgress(100);

    return {
      fileName: queueItem.name, exercise: detectedExercise,
      exerciseName: EXERCISES[detectedExercise]?.name || detectedExercise,
      reps, duration: Math.round(duration), analysisTime, formScore: avgScore,
      bioAnalysis, report, repHistory,
      videoUrl: url,
      frames: replayFrames,
      diagnostics: repCounter.diagnostics,
      autoDetected,
    };
  }, [exercise, autoDetect]);

  const startAnalysis = useCallback(async () => {
    setAnalyzing(true);
    abortRef.current = false;

    const pending = queue.filter(q => q.status === 'queued');
    const allResults = [...results];

    for (const item of pending) {
      if (abortRef.current) break;
      setCurrentFile(item.name);
      setProgress(0);
      setQueue(prev => prev.map(q =>
        q.id === item.id ? { ...q, status: 'analyzing' } : q
      ));

      const result = await analyzeVideo(item);

      if (result) {
        setQueue(prev => prev.map(q =>
          q.id === item.id ? { ...q, status: 'done', progress: 100 } : q
        ));
        allResults.push(result);
      } else {
        setQueue(prev => prev.map(q =>
          q.id === item.id ? { ...q, status: 'error', progress: 0 } : q
        ));
      }
    }

    setResults(allResults);
    setAnalyzing(false);
    setCurrentFile(null);
  }, [queue, results, analyzeVideo]);

  const hasQueued = queue.some(q => q.status === 'queued');

  if (replayResult) {
    return (
      <VideoReplay
        videoUrl={replayResult.videoUrl}
        frames={replayResult.frames}
        exerciseName={replayResult.exerciseName}
        reps={replayResult.reps}
        formScore={replayResult.formScore}
        onClose={() => setReplayResult(null)}
      />
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h2>{t('analyze_video')}</h2>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '0.7rem', padding: '4px 8px', opacity: lang === 'en' ? 1 : 0.5 }}
            onClick={() => setLang('en')}
          >EN</button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '0.7rem', padding: '4px 8px', opacity: lang === 'fr' ? 1 : 0.5 }}
            onClick={() => setLang('fr')}
          >FR</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('close')}</button>
        </div>
      </div>

      <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
        <div className="upload-content">
          <div className="upload-icon">+</div>
          <p className="text-sm" style={{ color: '#fff', fontWeight: 600 }}>
            {t('tap_to_select')}
          </p>
          <p className="text-xs text-muted">{t('file_types')}</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          onChange={handleFiles}
          style={{ display: 'none' }}
        />
      </div>

      {queue.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {queue.map(q => (
            <div key={q.id} className={`queue-item ${q.status === 'done' ? 'done' : ''}`}>
              <div className="queue-info">
                <span className="queue-name">{q.name}</span>
                <span className="queue-size">{q.size}</span>
              </div>
              <div className="queue-right">
                {q.status === 'analyzing' && (
                  <div className="queue-progress">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${q.progress}%` }} />
                    </div>
                    <span className="progress-text">{q.progress}%</span>
                  </div>
                )}
                {q.status === 'done' && <span className="queue-done">{t('done')}</span>}
                {q.status === 'error' && (
                  <span style={{ color: 'var(--red)', fontSize: '0.73rem', lineHeight: 1.4 }}>
                    {t('failed_try_different')}
                  </span>
                )}
                {q.status === 'queued' && !analyzing && (
                  <button className="btn btn-ghost btn-sm" onClick={() => removeFromQueue(q.id)}>
                    {t('remove')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="analyze-controls">
        {!analyzing ? (
          <>
            <select
              value={exercise}
              onChange={(e) => {
                const val = e.target.value;
                setExercise(val);
                if (val === '__auto__') {
                  setAutoDetect(true);
                  userChangedExercise.current = false;
                } else {
                  setAutoDetect(false);
                  userChangedExercise.current = true;
                }
              }}
              style={{ flex: 1, padding: 8, fontSize: '0.82rem' }}
            >
              <option value="__auto__">{t('automatic')}</option>
              <optgroup label={t('compound')}>
                {EXERCISE_GROUPS.compound.map(e => (
                  <option key={e.key} value={e.key}>{tExercise(e.key, e.name)}</option>
                ))}
              </optgroup>
              <optgroup label={t('isolation')}>
                {EXERCISE_GROUPS.isolation.map(e => (
                  <option key={e.key} value={e.key}>{tExercise(e.key, e.name)}</option>
                ))}
              </optgroup>
              <optgroup label={t('bodyweight')}>
                {EXERCISE_GROUPS.bodyweight.map(e => (
                  <option key={e.key} value={e.key}>{tExercise(e.key, e.name)}</option>
                ))}
              </optgroup>
              <optgroup label={t('other')}>
                <option value="superset">{t('ex.superset')}</option>
              </optgroup>
            </select>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="kg"
              style={{ width: 56, padding: '8px 6px', fontSize: '0.82rem', textAlign: 'center' }}
            />
            <button
              className="btn btn-primary"
              onClick={startAnalysis}
              disabled={!hasQueued}
            >
              {t('analyze')}
            </button>
          </>
        ) : (
          <div className="analyzing-status">
            <div className="spinner-sm" />
            <span>
              {analysisPhase === 'model'
                ? t('loading_ai')
                : analysisPhase === 'loading'
                ? `${t('loading_file')} ${currentFile}...`
                : analysisPhase === 'analyzing'
                ? `${t('analyzing_file')} ${currentFile}... ${progress}%`
                : `${t('starting_file')} ${currentFile}...`}
            </span>
            {analysisPhase === 'model' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
                {t('downloading_model')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Video + canvas inside a container that is visible when analyzing,
          collapsed when not. Using opacity+position (not display:none) because
          iOS Safari refuses to seek on display:none video elements. */}
      <div
        className="analysis-card"
        style={analyzing
          ? { display: 'block', padding: 8 }
          : { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }
        }
      >
        <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#000' }}>
          <video ref={videoRef} className="analysis-video" muted playsInline preload="auto"
            style={{ width: '100%', display: 'block' }} />
          <canvas ref={canvasRef}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
        </div>
      </div>

      {results.map((r, idx) => (
        <ResultCard key={idx} result={r} onReplay={() => setReplayResult(r)} />
      ))}

      <div style={{ textAlign: 'center', padding: '8px 0', fontSize: '0.65rem', color: '#555' }}>
        {BUILD_ID}
      </div>
    </div>
  );
}


function ResultCard({ result, onReplay }) {
  const {
    fileName, exerciseName, reps, duration, analysisTime,
    formScore, bioAnalysis, report, repHistory,
  } = result;

  const grade = gradeFromScore(formScore);
  const cls = gradeClass(formScore);
  const displayName = tExercise(result.exercise, exerciseName);

  return (
    <div className="card result-card" style={{ marginTop: 14 }}>
      <div className="result-header">
        <div>
          <h3 style={{ marginBottom: 2 }}>{displayName}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="text-xs text-muted">{fileName}</span>
            {result.autoDetected && (
              <span style={{
                fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4,
                background: 'rgba(0,255,136,0.15)', color: 'var(--accent)', fontWeight: 600,
              }}>{t('auto_detected')}</span>
            )}
          </div>
        </div>
        <span className={`score-badge ${cls}`}>{grade}</span>
      </div>

      {report?.summary && (
        <p className="text-sm" style={{ marginBottom: 10, lineHeight: 1.5 }}>
          {report.summary}
        </p>
      )}

      <div className="result-stats">
        <div className="stat">
          <span className="stat-value">{reps}</span>
          <span className="stat-label">{t('reps')}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{formatTime(duration)}</span>
          <span className="stat-label">{t('duration')}</span>
        </div>
        <div className="stat">
          <span className="stat-value">{formScore}</span>
          <span className="stat-label">{t('form')}</span>
        </div>
        {bioAnalysis?.movementQuality != null && (
          <div className="stat">
            <span className="stat-value">{Math.round(bioAnalysis.movementQuality)}</span>
            <span className="stat-label">{t('quality')}</span>
          </div>
        )}
        <div className="stat">
          <span className="stat-value">{analysisTime}s</span>
          <span className="stat-label">{t('analysis')}</span>
        </div>
      </div>

      {bioAnalysis?.velocity?.perRep && bioAnalysis.velocity.perRep.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4>{t('velocity_per_rep')}</h4>
          <div className="rep-bars">
            {bioAnalysis.velocity.perRep.map((v, i) => {
              const max = Math.max(...bioAnalysis.velocity.perRep, 1);
              const pct = (v / max) * 100;
              const declining = i > 0 && v < bioAnalysis.velocity.perRep[i - 1];
              return (
                <div key={i} className="rep-bar-col">
                  <div className="rep-bar-wrap">
                    <div className="rep-bar" style={{
                      height: `${Math.max(pct, 5)}%`,
                      background: declining ? 'var(--yellow)' : 'var(--accent)',
                    }} />
                  </div>
                  <span className="rep-num">{i + 1}</span>
                </div>
              );
            })}
          </div>
          {bioAnalysis.velocity.trend && (
            <p className="text-xs text-muted" style={{ marginTop: 4 }}>
              Trend: {bioAnalysis.velocity.trend}
            </p>
          )}
        </div>
      )}

      {bioAnalysis?.timeUnderTension?.perRep && bioAnalysis.timeUnderTension.perRep.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4>{t('time_under_tension')}</h4>
          <div className="result-stats" style={{ marginBottom: 6 }}>
            <div className="stat">
              <span className="stat-value">{bioAnalysis.timeUnderTension.eccentric?.toFixed(1)}s</span>
              <span className="stat-label">{t('eccentric')}</span>
            </div>
            <div className="stat">
              <span className="stat-value">{bioAnalysis.timeUnderTension.concentric?.toFixed(1)}s</span>
              <span className="stat-label">{t('concentric')}</span>
            </div>
            <div className="stat">
              <span className="stat-value">{bioAnalysis.timeUnderTension.total?.toFixed(1)}s</span>
              <span className="stat-label">{t('total')}</span>
            </div>
          </div>
          <div className="rep-bars">
            {bioAnalysis.timeUnderTension.perRep.map((t, i) => {
              const ecc = t.eccentric || t.down || 0;
              const con = t.concentric || t.up || 0;
              const total = ecc + con || 1;
              const maxTut = Math.max(
                ...bioAnalysis.timeUnderTension.perRep.map(r =>
                  (r.eccentric || r.down || 0) + (r.concentric || r.up || 0)),
                1);
              const pct = (total / maxTut) * 100;
              return (
                <div key={i} className="rep-bar-col">
                  <div className="rep-bar-wrap">
                    <div className="rep-bar" style={{
                      height: `${Math.max(pct, 5)}%`,
                      background: `linear-gradient(to top, var(--accent) ${(con / total) * 100}%, var(--yellow) 0%)`,
                    }} />
                  </div>
                  <span className="rep-num">{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {bioAnalysis?.rangeOfMotion && (
        <div style={{ marginTop: 14 }}>
          <h4>{t('range_of_motion')}</h4>
          <div className="result-stats" style={{ marginBottom: 6 }}>
            <div className="stat">
              <span className="stat-value">{Math.round(bioAnalysis.rangeOfMotion.avgDegrees)}&deg;</span>
              <span className="stat-label">{t('avg_rom')}</span>
            </div>
            <div className="stat">
              <span className="stat-value">{Math.round(bioAnalysis.rangeOfMotion.consistency || 0)}%</span>
              <span className="stat-label">{t('consistency')}</span>
            </div>
          </div>
          {bioAnalysis.rangeOfMotion.perRep && bioAnalysis.rangeOfMotion.perRep.length > 0 && (
            <div className="rep-bars">
              {bioAnalysis.rangeOfMotion.perRep.map((rom, i) => {
                const maxRom = Math.max(...bioAnalysis.rangeOfMotion.perRep, 1);
                const pct = (rom / maxRom) * 100;
                return (
                  <div key={i} className="rep-bar-col">
                    <div className="rep-bar-wrap">
                      <div className="rep-bar" style={{
                        height: `${Math.max(pct, 5)}%`, background: 'var(--accent)',
                      }} />
                    </div>
                    <span className="rep-num">{i + 1}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {bioAnalysis?.asymmetry && (
        <div style={{ marginTop: 14 }}>
          <h4>{t('asymmetry')}</h4>
          <div className="result-stats">
            <div className="stat">
              <span className="stat-value">
                <span className={`score-badge ${bioAnalysis.asymmetry.score <= 10 ? 'good' : bioAnalysis.asymmetry.score <= 20 ? 'ok' : 'poor'}`}>
                  {Math.round(bioAnalysis.asymmetry.score)}%
                </span>
              </span>
              <span className="stat-label">{t('imbalance')}</span>
            </div>
          </div>
          {bioAnalysis.asymmetry.details && typeof bioAnalysis.asymmetry.details === 'object' && (
            <div style={{ marginTop: 6 }}>
              {Object.entries(bioAnalysis.asymmetry.details).map(([key, val]) => (
                <p key={key} className="text-xs text-muted" style={{ padding: '2px 0' }}>
                  {key}: {typeof val === 'number' ? `${Math.round(val)}%` : String(val)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {bioAnalysis?.fatigue && (
        <div style={{ marginTop: 14 }}>
          <h4>{t('fatigue')}</h4>
          <div className="result-stats" style={{ marginBottom: 6 }}>
            <div className="stat">
              <span className="stat-value">{Math.round(bioAnalysis.fatigue.index || 0)}%</span>
              <span className="stat-label">{t('fatigue_index')}</span>
            </div>
            {bioAnalysis.fatigue.velocityDropoff != null && (
              <div className="stat">
                <span className="stat-value">{Math.round(bioAnalysis.fatigue.velocityDropoff)}%</span>
                <span className="stat-label">{t('velocity_dropoff')}</span>
              </div>
            )}
          </div>
          {bioAnalysis.fatigue.curve && bioAnalysis.fatigue.curve.length > 0 && (
            <div className="rep-bars">
              {bioAnalysis.fatigue.curve.map((v, i) => {
                const max = Math.max(...bioAnalysis.fatigue.curve, 1);
                const pct = (v / max) * 100;
                return (
                  <div key={i} className="rep-bar-col">
                    <div className="rep-bar-wrap">
                      <div className="rep-bar" style={{
                        height: `${Math.max(pct, 5)}%`,
                        background: pct < 60 ? 'var(--red)' : pct < 80 ? 'var(--yellow)' : 'var(--accent)',
                      }} />
                    </div>
                    <span className="rep-num">{i + 1}</span>
                  </div>
                );
              })}
            </div>
          )}
          {bioAnalysis.fatigue.recommendation && (
            <p className="text-xs text-muted" style={{ marginTop: 4 }}>
              {bioAnalysis.fatigue.recommendation}
            </p>
          )}
        </div>
      )}

      {repHistory && repHistory.length > 0 && (() => {
        const allIssues = {};
        repHistory.forEach(r => {
          (r.issues || []).forEach(issue => {
            allIssues[issue] = (allIssues[issue] || 0) + 1;
          });
        });
        const sorted = Object.entries(allIssues).sort((a, b) => b[1] - a[1]);
        if (sorted.length === 0) return null;
        return (
          <div className="form-notes" style={{ marginTop: 14 }}>
            <h4>{t('form_notes')}</h4>
            {sorted.map(([issue, count]) => (
              <div key={issue} className="note-item">
                {issue} ({count}/{repHistory.length} reps)
              </div>
            ))}
          </div>
        );
      })()}

      {result.diagnostics && (
        <div style={{ marginTop: 14, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: '0.75rem', color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--text)' }}>{t('engine')}</strong>
          <div>Range: {result.diagnostics.observedMin}&deg; &ndash; {result.diagnostics.observedMax}&deg; ({result.diagnostics.observedRange}&deg;)</div>
          <div>Min ROM per rep: {result.diagnostics.minROM}&deg;</div>
          <div>Frames: {result.diagnostics.totalFrames} | Method: {result.diagnostics.method}</div>
        </div>
      )}

      {report?.highlights && report.highlights.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4>{t('highlights')}</h4>
          {report.highlights.map((h, i) => (
            <p key={i} className="text-sm" style={{ color: 'var(--accent)', padding: '2px 0' }}>
              {'> '}{h}
            </p>
          ))}
        </div>
      )}

      {report?.improvements && report.improvements.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4>{t('next_steps')}</h4>
          {report.improvements.map((imp, i) => (
            <p key={i} className="text-sm text-muted" style={{ padding: '2px 0' }}>
              {i + 1}. {imp}
            </p>
          ))}
        </div>
      )}

      {repHistory && repHistory.length > 0 && (
        <div className="rep-quality" style={{ marginTop: 14 }}>
          <h4>{t('per_rep_quality')}</h4>
          <div className="rep-bars">
            {repHistory.map((r, i) => {
              const score = r.score || 0;
              return (
                <div key={i} className="rep-bar-col">
                  <div className="rep-bar-wrap">
                    <div className="rep-bar" style={{
                      height: `${Math.max(score, 5)}%`,
                      background: score >= 80 ? 'var(--accent)' : score >= 50 ? 'var(--yellow)' : 'var(--red)',
                    }} />
                  </div>
                  <span className="rep-num">{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result.videoUrl && result.frames && (
        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 16, padding: '14px 0', fontSize: '1rem', fontWeight: 700 }}
          onClick={onReplay}
        >
          {t('watch_overlay')}
        </button>
      )}
      <button
        className="btn btn-ghost"
        style={{ width: '100%', marginTop: 8, padding: '12px 0', fontSize: '0.9rem', fontWeight: 600 }}
        onClick={() => shareCard(result)}
      >
        {t('share_card')}
      </button>
    </div>
  );
}
