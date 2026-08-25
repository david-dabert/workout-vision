import { useState, useRef, useCallback, useEffect } from 'react';
import { getImageLandmarker, detectPoseImage, drawPose, extractJointAngles, disposeAllLandmarkers, selectSubjectPose } from '../lib/poseAnalysis';
import { EXERCISES, EXERCISE_GROUPS } from '../lib/exercises';
import { RepCounter } from '../lib/repCounter';
import { ExerciseAutoDetector } from '../lib/exerciseDetector';
import { analyzeSet } from '../lib/biomechanics';
import { saveWorkout, getAllWorkouts } from '../lib/storage';
import { useProfile } from '../lib/ProfileContext';
import { useT } from '../lib/LanguageContext';
import VideoReplay from './VideoReplay';

// Build marker visible in UI to verify deployment is fresh
const BUILD_ID = 'v6-stable';

// Detect iOS Safari for platform-specific workarounds
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Hard cap on frames. iOS Safari crashes with high frame counts on large
// videos due to accumulated WASM/WebGL memory.
const MAX_FRAMES = IS_IOS ? 90 : 150;

// File size cap. iOS Safari can crash loading very large blob URLs.
const MAX_FILE_SIZE = IS_IOS ? 250 * 1024 * 1024 : 500 * 1024 * 1024;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function VideoUpload({ onClose, preSelectedExercise }) {
  const { t, tExercise, lang, setLang } = useT();
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
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const abortRef = useRef(false);
  const blobUrlRef = useRef(null);

  useEffect(() => {
    return () => {
      // Abort any in-progress analysis
      abortRef.current = true;
      // Free WebGL contexts to prevent iOS Safari crash on re-mount
      disposeAllLandmarkers();
      // Free any lingering blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      // Clear video src to release decoder memory
      if (videoRef.current) {
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
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
    // Revoke any previous blob URL before creating a new one
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    const url = URL.createObjectURL(queueItem.file);
    blobUrlRef.current = url;
    let urlRevoked = false;
    const safeRevoke = () => { if (!urlRevoked) { urlRevoked = true; URL.revokeObjectURL(url); blobUrlRef.current = null; } };

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
    const analysisFps = Math.min(IS_IOS ? 4 : 6, MAX_FRAMES / duration);
    const totalFrames = Math.min(MAX_FRAMES, Math.ceil(duration * analysisFps));
    const interval = duration / totalFrames;

    // Cap analysis canvas resolution to save memory.
    // iOS: 480p max (~1.5MB per RGBA buffer). Desktop: 720p max (~5MB).
    // MediaPipe works fine at lower resolution; full-res is unnecessary.
    const maxAnalysisWidth = IS_IOS ? 480 : 720;
    const scale = Math.min(1, maxAnalysisWidth / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
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
    // iOS Safari fires 'seeked' BEFORE the HEVC frame is decoded, so drawing
    // immediately produces a black canvas.
    //
    // Best: requestVideoFrameCallback (Safari 15.4+) fires only when an
    // actual decoded frame is presented — the only reliable signal for HEVC.
    // Fallback: readyState polling + double-rAF for older browsers.
    const hasRVFC = typeof video.requestVideoFrameCallback === 'function';
    const waitForFrame = () => new Promise((resolve) => {
      if (hasRVFC) {
        const timeout = setTimeout(resolve, 800); // safety cap
        video.requestVideoFrameCallback(() => {
          clearTimeout(timeout);
          resolve();
        });
      } else {
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
      }
    });

    // Person lock: select subject on first frame, keep it locked for the whole video
    let lockedSubjectIdx = null;

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
            let landmarks;
            if (result.landmarks.length === 1) {
              landmarks = result.landmarks[0];
            } else {
              // Lock to first-frame subject; subsequent frames use same index
              if (lockedSubjectIdx === null) {
                landmarks = selectSubjectPose(result.landmarks);
                lockedSubjectIdx = result.landmarks.indexOf(landmarks);
                console.log(`[Upload] Person lock: locked to pose index ${lockedSubjectIdx} of ${result.landmarks.length} detected`);
              } else {
                landmarks = result.landmarks[lockedSubjectIdx] || selectSubjectPose(result.landmarks);
              }
            }
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
      // Release video decoder memory
      video.removeAttribute('src');
      video.load();
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
    // Enrich repHistory with timestamps for replay form feedback sync
    const enrichedRepHistory = repCounter.repHistory.map(r => ({
      ...r,
      startTime: (r.startFrame * interval),
      peakTime: (r.peakFrame * interval),
      endTime: (r.endFrame * interval),
    }));
    console.log(`[Upload] Exercise: ${detectedExercise}, ${frames.length}/${totalFrames} frames in ${analysisTime}s`);
    console.log(`[Upload] Reps detected: ${repCounter.reps}, diagnostics:`, repCounter.diagnostics);
    // Log angle signal for debugging
    if (frames.length > 0) {
      const ex = EXERCISES[detectedExercise];
      const sampleAngles = frames.filter((_, i) => i % 5 === 0).map(f => {
        if (!f.angles) return null;
        const val = ex?.getValue(f.angles, f.landmarks);
        return val !== null ? Math.round(val) : null;
      }).filter(v => v !== null);
      console.log(`[Upload] Angle signal (every 5th frame):`, sampleAngles.join(', '));
    }

    const landmarkFrames = frames.map(f => f.landmarks);
    const repHistory = enrichedRepHistory;
    const reps = repHistory.length;

    // Run biomechanical analysis for velocity, ROM, fatigue, asymmetry
    let bioAnalysis = null;
    try { bioAnalysis = analyzeSet(landmarkFrames, analysisFps, detectedExercise, repHistory); }
    catch (err) { console.error('Bio analysis error:', err); }

    const scoredReps = repHistory.filter(r => r.score !== null && r.score !== undefined);
    const avgScore = scoredReps.length > 0
      ? Math.round(scoredReps.reduce((s, r) => s + r.score, 0) / scoredReps.length)
      : bioAnalysis?.movementQuality || 0;

    const w = parseFloat(weight) || 0;
    const workout = {
      id: Date.now().toString(), date: new Date().toISOString(),
      exercise: detectedExercise,
      exerciseName: EXERCISES[detectedExercise]?.name || detectedExercise,
      reps, duration: Math.round(duration), formScore: avgScore,
      repHistory, weight: w, volume: w * reps, source: 'upload',
      avgRom: bioAnalysis?.rangeOfMotion?.avgDegrees || 0,
    };
    try { await saveWorkout(workout); } catch (err) { console.error('Save error:', err); }

    // Fetch history for progression comparison
    let progression = null;
    try {
      const allWorkouts = await getAllWorkouts();
      const prev = allWorkouts
        .filter(s => s.exercise === detectedExercise && s.id !== workout.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      if (prev) {
        progression = { prevReps: prev.reps, prevScore: prev.formScore, prevRom: prev.avgRom || 0, prevWeight: prev.weight || 0, prevDate: prev.date };
      }
    } catch (_) {}

    setProgress(100);

    // Release the video decoder memory — the blob URL stays alive for replay
    video.removeAttribute('src');
    video.load();

    return {
      fileName: queueItem.name, exercise: detectedExercise,
      exerciseName: EXERCISES[detectedExercise]?.name || detectedExercise,
      reps, duration: Math.round(duration), analysisTime, formScore: avgScore,
      bioAnalysis, repHistory, progression,
      videoUrl: url,
      frames: replayFrames,
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

      try {
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
      } catch (err) {
        console.error('[VideoUpload] Analysis failed for', item.name, err);
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
        repHistory={replayResult.repHistory}
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


// ── Coaching logic: one sentence, data-driven ──

function generateCoachingInsight(repHistory, bioAnalysis) {
  if (!repHistory || repHistory.length === 0) return null;

  // Rule 1: ROM decay = fatigue
  if (bioAnalysis?.rangeOfMotion?.perRep && bioAnalysis.rangeOfMotion.perRep.length >= 3) {
    const roms = bioAnalysis.rangeOfMotion.perRep;
    const firstRom = roms[0];
    const lastRom = roms[roms.length - 1];
    if (firstRom > 0 && lastRom < firstRom * 0.8) {
      const drop = Math.round((1 - lastRom / firstRom) * 100);
      return `Range of motion dropped ${drop}% across the set. Stop before form breaks down.`;
    }
  }

  // Rule 2: Velocity slowdown = fatigue
  if (bioAnalysis?.fatigue?.velocityDropoff > 25) {
    return `Reps slowed ${Math.round(bioAnalysis.fatigue.velocityDropoff)}% toward the end. Fatigue detected.`;
  }

  // Rule 3: Asymmetry
  if (bioAnalysis?.asymmetry?.score > 15) {
    return `Left/right imbalance of ${Math.round(bioAnalysis.asymmetry.score)}% detected. Focus on equal effort from both sides.`;
  }

  // Rule 4: Tempo too fast
  if (bioAnalysis?.velocity?.perRep) {
    const avgVel = bioAnalysis.velocity.perRep.reduce((a, b) => a + b, 0) / bioAnalysis.velocity.perRep.length;
    if (avgVel > 0.8) {
      return `Reps are fast. Slow down the lowering phase for better muscle engagement.`;
    }
  }

  // Rule 5: Consistent quality — ready to progress
  const scores = repHistory.map(r => r.score || 0);
  const variance = Math.max(...scores) - Math.min(...scores);
  if (variance < 15 && scores[0] >= 70) {
    return `Consistent reps across the set. Ready to add weight next session.`;
  }

  // Rule 6: Identify best rep
  const best = repHistory.reduce((a, b, i) => (b.score || 0) > (a.score || 0) ? { ...b, num: i + 1 } : a, { ...repHistory[0], num: 1 });
  return `Rep ${best.num} was your best. Replicate that tempo and range of motion.`;
}

function generateProgressionNote(progression) {
  if (!progression) return null;
  const { prevReps, prevScore, prevRom, prevWeight, prevDate } = progression;
  const daysSince = Math.round((Date.now() - new Date(prevDate).getTime()) / 86400000);
  const dateLabel = daysSince <= 1 ? 'yesterday' : daysSince <= 7 ? `${daysSince} days ago` : new Date(prevDate).toLocaleDateString();

  if (prevRom > 0 && progression.currentRom > 0) {
    const romChange = Math.round(progression.currentRom - prevRom);
    if (romChange > 5) return `+${romChange}° ROM improvement vs ${dateLabel}.`;
    if (romChange < -5) return `${romChange}° ROM decrease vs ${dateLabel}. Check recovery or reduce weight.`;
  }
  if (progression.currentScore > prevScore + 5) return `Form improved vs ${dateLabel} (+${Math.round(progression.currentScore - prevScore)} points).`;
  if (progression.currentScore < prevScore - 10) return `Form dropped vs ${dateLabel}. Consider reducing weight.`;
  return `Consistent with last session (${dateLabel}).`;
}

function ResultCard({ result, onReplay }) {
  const { t, tExercise } = useT();
  const {
    fileName, exerciseName, reps, duration, analysisTime,
    formScore, bioAnalysis, repHistory, progression,
  } = result;
  const displayName = tExercise(result.exercise, exerciseName);

  const coachingInsight = generateCoachingInsight(repHistory, bioAnalysis);
  const progressionNote = generateProgressionNote(
    progression ? { ...progression, currentRom: bioAnalysis?.rangeOfMotion?.avgDegrees || 0, currentScore: formScore } : null
  );

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
      </div>

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
        <div className="stat">
          <span className="stat-value">{analysisTime}s</span>
          <span className="stat-label">{t('analysis')}</span>
        </div>
      </div>

      {/* Per-rep quality bars */}
      {repHistory && repHistory.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="rep-bars">
            {repHistory.map((r, i) => {
              const score = r.score || 0;
              return (
                <div key={i} className="rep-bar-col">
                  <div className="rep-bar-wrap">
                    <div className="rep-bar" style={{
                      height: `${Math.max(score, 5)}%`,
                      background: score >= 80 ? 'var(--accent)' : score >= 60 ? 'var(--yellow)' : 'var(--red)',
                    }} />
                  </div>
                  <span className="rep-num">{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* One coaching insight */}
      {coachingInsight && (
        <p className="text-sm" style={{ marginTop: 12, lineHeight: 1.5, color: 'var(--text)', fontStyle: 'italic' }}>
          "{coachingInsight}"
        </p>
      )}

      {/* Progression vs last session */}
      {progressionNote && (
        <p className="text-xs" style={{ marginTop: 8, color: 'var(--accent)' }}>
          {progressionNote}
        </p>
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
    </div>
  );
}
