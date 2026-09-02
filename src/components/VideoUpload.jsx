import { useState, useRef, useCallback, useEffect } from 'react';
import { getImageLandmarker, detectPoseImage, drawPose, extractJointAngles, disposeAllLandmarkers, selectSubjectPose } from '../lib/poseAnalysis';
import { EXERCISES, EXERCISE_GROUPS, getExerciseIllustration } from '../lib/exercises';
import MuscleMap from './MuscleMap';
import { RepCounter } from '../lib/repCounter';
import { ExerciseAutoDetector } from '../lib/exerciseDetector';
import { analyzeSet } from '../lib/biomechanics';
import { generateWorkoutReport } from '../lib/coach';
import { shareCard } from '../lib/shareCard';
import { saveWorkout, getAllWorkouts } from '../lib/storage';
import { useProfile } from '../lib/ProfileContext';
import { useT } from '../lib/LanguageContext';
import { INJURY_MAP, INJURY_LABELS, loadInjuries, saveInjuries } from '../lib/injuries';
import VideoReplay from './VideoReplay';

// Build marker visible in UI to verify deployment is fresh
const BUILD_ID = 'v14-ios-compressed';

// Detect iOS Safari for platform-specific workarounds
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Hard cap on frames. iOS Safari crashes with high frame counts on large
// videos due to accumulated WASM/WebGL memory.
// Higher frame counts improve rep counting accuracy (10fps→20fps reduced
// period quantization errors and Nyquist violations on fast exercises).
const MAX_FRAMES = IS_IOS ? 300 : 600;

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
  const { t, tExercise, tFormCheck, lang, setLang } = useT();
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
  const [liveReps, setLiveReps] = useState(0);
  const [userInjuries, setUserInjuries] = useState(() => loadInjuries());
  const [errorMsg, setErrorMsg] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
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
    setErrorMsg(null);
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('video/') || f.type === '');
    if (files.length === 0) return;
    const items = [];
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        setErrorMsg(`${f.name} (${(f.size / 1024 / 1024).toFixed(0)} MB) ${t('too_large')}`);
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
    if (!video) return null;

    // Load model first
    setAnalysisPhase('model');
    const landmarker = await getImageLandmarker();
    if (!landmarker) {
      setErrorMsg(t('model_failed'));
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
      setErrorMsg(t('video_failed'));
      return null;
    }

    const duration = video.duration;
    if (!duration || !isFinite(duration)) {
      safeRevoke();
      setErrorMsg(t('video_failed'));
      return null;
    }

    // Adaptive FPS: target 15fps (iOS) or 20fps (desktop) for accurate rep counting.
    // At 10fps, fast exercises (battle rope, sit-ups) hit Nyquist limits and period
    // quantization errors. 20fps gives YIN enough samples for sub-frame accuracy.
    // Cap total frames at MAX_FRAMES so a long video doesn't exhaust WASM memory.
    const analysisFps = Math.min(IS_IOS ? 15 : 20, MAX_FRAMES / duration);
    const totalFrames = Math.min(MAX_FRAMES, Math.ceil(duration * analysisFps));
    const interval = duration / totalFrames;

    // Offscreen canvas for MediaPipe input only (not displayed).
    // Cap resolution to save memory. iOS: 480p, Desktop: 720p.
    const maxAnalysisWidth = IS_IOS ? 480 : 720;
    const scale = Math.min(1, maxAnalysisWidth / video.videoWidth);
    const offscreen = document.createElement('canvas');
    offscreen.width = Math.round(video.videoWidth * scale);
    offscreen.height = Math.round(video.videoHeight * scale);
    const offCtx = offscreen.getContext('2d');

    console.log(`[Upload] ${BUILD_ID}: ${duration.toFixed(1)}s, ${video.videoWidth}x${video.videoHeight}, ${totalFrames} frames at ${analysisFps.toFixed(1)} FPS`);

    // Analysis state
    const frames = [];
    const replayFrames = [];
    const isAutoMode = exercise === '__auto__';
    const initialExercise = isAutoMode ? 'squat' : exercise;
    let detectedExercise = initialExercise;
    const weightKg = parseFloat(weight) || 0;
    let repCounter = new RepCounter(initialExercise, { fps: analysisFps, userInjuries, mode: 'video', weightKg });
    const skipAutoDetect = !isAutoMode && userChangedExercise.current;
    const autoDetector = (isAutoMode || (autoDetect && !skipAutoDetect))
      ? new ExerciseAutoDetector({ fps: analysisFps }) : null;
    let autoDetectDone = false;
    let autoDetected = false;
    const analysisStart = Date.now();

    setAnalysisPhase('analyzing');
    setLiveReps(0);

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

          // Draw video frame to offscreen canvas for MediaPipe input
          offCtx.drawImage(video, 0, 0, offscreen.width, offscreen.height);
          const result = detectPoseImage(landmarker, offscreen);

          // iOS optimization: only paint every 3rd frame to reduce GPU overhead.
          const shouldPaint = !IS_IOS || (frameIdx % 3 === 0);

          // Extract landmarks if detected
          let landmarks = null;
          let updateResult = null;
          if (result?.landmarks?.length) {
            if (result.landmarks.length === 1) {
              landmarks = result.landmarks[0];
            } else {
              if (lockedSubjectIdx === null) {
                landmarks = selectSubjectPose(result.landmarks);
                lockedSubjectIdx = result.landmarks.indexOf(landmarks);
              } else {
                landmarks = result.landmarks[lockedSubjectIdx] || selectSubjectPose(result.landmarks);
              }
            }
            const angles = extractJointAngles(landmarks);
            frames.push({ landmarks, timestamp: time, angles });
            updateResult = repCounter.update(landmarks, time);
            setLiveReps(updateResult.reps);

            if (!IS_IOS || frameIdx % 2 === 0) {
              replayFrames.push({ landmarks, timestamp: time });
            }
          }

          // ALWAYS draw the video frame to canvas so user sees the video during analysis.
          // Skeleton overlay is added on top when landmarks are available.
          const canvas = overlayRef.current;
          if (canvas && shouldPaint) {
            let cw, ch;
            if (IS_IOS) {
              cw = offscreen.width;
              ch = offscreen.height;
              if (canvas.width !== cw || canvas.height !== ch) {
                canvas.width = cw;
                canvas.height = ch;
              }
              const ctx = canvas.getContext('2d');
              ctx.drawImage(offscreen, 0, 0);
              if (landmarks) drawPose(ctx, landmarks, cw, ch, 1.0, updateResult?.formFeedback || null);
            } else {
              cw = video.videoWidth || 1080;
              ch = video.videoHeight || 1920;
              if (canvas.width !== cw || canvas.height !== ch) {
                canvas.width = cw;
                canvas.height = ch;
              }
              const ctx = canvas.getContext('2d');
              ctx.drawImage(video, 0, 0, cw, ch);
              if (landmarks) drawPose(ctx, landmarks, cw, ch, 1.0, updateResult?.formFeedback || null);
            }
            // Rep counter pill — always visible
            {
              const ctx = canvas.getContext('2d');
              const currentReps = updateResult?.reps ?? repCounter.reps;
              const repText = `${currentReps}`;
              const labelText = t('reps').toLowerCase();
              const fontSize = Math.round(cw * 0.12);
              const labelSize = Math.round(fontSize * 0.4);
              ctx.font = `bold ${fontSize}px -apple-system, system-ui, sans-serif`;
              const repWidth = ctx.measureText(repText).width;
              ctx.font = `${labelSize}px -apple-system, system-ui, sans-serif`;
              const labelWidth = ctx.measureText(labelText).width;
              const pillW = Math.max(repWidth, labelWidth) + fontSize;
              const pillH = fontSize * 1.8;
              const pillX = (cw - pillW) / 2;
              const pillY = ch * 0.03;
              ctx.fillStyle = 'rgba(0,0,0,0.6)';
              ctx.beginPath();
              const r = pillH / 2;
              ctx.moveTo(pillX + r, pillY);
              ctx.lineTo(pillX + pillW - r, pillY);
              ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + r, r);
              ctx.arcTo(pillX + pillW, pillY + pillH, pillX + pillW - r, pillY + pillH, r);
              ctx.lineTo(pillX + r, pillY + pillH);
              ctx.arcTo(pillX, pillY + pillH, pillX, pillY + pillH - r, r);
              ctx.arcTo(pillX, pillY, pillX + r, pillY, r);
              ctx.fill();
              ctx.fillStyle = '#00f5d4';
              ctx.font = `bold ${fontSize}px -apple-system, system-ui, sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(repText, cw / 2, pillY + pillH * 0.42);
              ctx.fillStyle = 'rgba(240,240,245,0.8)';
              ctx.font = `${labelSize}px -apple-system, system-ui, sans-serif`;
              ctx.fillText(labelText, cw / 2, pillY + pillH * 0.78);
            }
          }

          const pct = Math.min(99, Math.round(((frameIdx + 1) / totalFrames) * 100));
          setProgress(pct);
          setQueue(prev => prev.map(q =>
            q.id === queueItem.id ? { ...q, progress: pct } : q
          ));

          // Yield to browser paint cycle. On iOS, yield less frequently
          // to reduce per-frame overhead (~16ms per rAF yield).
          if (!IS_IOS || shouldPaint) {
            await new Promise(r => requestAnimationFrame(r));
          }
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
      setErrorMsg(`${t('no_poses')} ${queueItem.name}. ${t('try_different')}`);
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
          const rc = new RepCounter(ex, { fps: analysisFps, userInjuries, mode: 'video', weightKg });
          for (const f of frames) rc.update(f.landmarks, f.timestamp);
          rc.finalize();
          const reps = rc.repHistory ? rc.repHistory.length : 0;
          const score = reps * 1000 + tallies[ex];
          if (score > bestScore) { bestScore = score; bestEx = ex; }
        }
        if (bestEx !== initialExercise || candidates.includes(initialExercise)) {
          detectedExercise = bestEx;
          autoDetected = true;
          setExercise(detectedExercise);
          repCounter = new RepCounter(detectedExercise, { fps: analysisFps, userInjuries, mode: 'video', weightKg });
          for (const f of frames) repCounter.update(f.landmarks, f.timestamp);
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
    try { bioAnalysis = analyzeSet(landmarkFrames, analysisFps, detectedExercise, repHistory, userProfile?.height); }
    catch (err) { console.error('Bio analysis error:', err); }

    let report = null;
    try {
      report = generateWorkoutReport(userProfile, [{
        exerciseKey: detectedExercise, exercise: detectedExercise,
        reps, analysis: bioAnalysis, bioAnalysis, repHistory,
      }]);
    } catch (err) { console.error('Report error:', err); }

    const diagnostics = repCounter.diagnostics || null;

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
      bioAnalysis, repHistory, progression, report, diagnostics,
      videoUrl: url,
      frames: replayFrames,
      autoDetected,
    };
  }, [exercise, autoDetect, weight, userInjuries]);

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
        exerciseKey={replayResult.exercise}
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
          <div className="upload-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-primary)', fontWeight: 700, marginTop: 2 }}>
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

      {errorMsg && (
        <div style={{
          margin: '10px 0', padding: '12px 14px', borderRadius: 10,
          background: 'rgba(255,59,92,0.1)', border: '1px solid rgba(255,59,92,0.3)',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <span style={{ color: 'var(--red)', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>!</span>
          <div style={{ flex: 1 }}>
            <p style={{ color: 'var(--red)', fontSize: '0.82rem', margin: 0, lineHeight: 1.4 }}>{errorMsg}</p>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            style={{
              background: 'none', border: 'none', color: 'var(--muted)',
              cursor: 'pointer', fontSize: 16, padding: '0 2px', flexShrink: 0,
            }}
          >&times;</button>
        </div>
      )}

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
              {exercise !== '__auto__' && getExerciseIllustration(exercise) && (
                <img
                  src={getExerciseIllustration(exercise, 2)}
                  alt=""
                  style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6,
                    background: 'var(--surface-elevated)', flexShrink: 0 }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
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
                style={{ flex: 1, minWidth: 0, padding: 8, fontSize: '0.82rem' }}
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
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="kg"
                style={{ width: 64, padding: '10px 8px', fontSize: '0.82rem', textAlign: 'center' }}
              />
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={startAnalysis}
                disabled={!hasQueued}
              >
                {t('analyze')}
              </button>
            </div>
          </>
        ) : (
          <div className="analyzing-status">
            <div className="spinner-sm" />
            {currentFile && <span>{currentFile}</span>}
            <button className="btn btn-ghost btn-sm" onClick={() => { abortRef.current = true; }}>{t('stop')}</button>
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
          {t('limitations')}:
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.keys(INJURY_MAP).map(key => {
            const active = userInjuries.includes(key);
            const label = INJURY_LABELS[key]?.[lang] || key;
            return (
              <button
                key={key}
                onClick={() => {
                  const next = active
                    ? userInjuries.filter(i => i !== key)
                    : [...userInjuries, key];
                  setUserInjuries(next);
                  saveInjuries(next);
                }}
                style={{
                  padding: '6px 14px', fontSize: '0.75rem', borderRadius: 20,
                  border: active ? '1px solid var(--red)' : '1px solid rgba(255,255,255,0.12)',
                  background: active ? 'rgba(255,59,92,0.15)' : 'rgba(255,255,255,0.04)',
                  color: active ? 'var(--red)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Analysis display: VISIBLE video + transparent overlay canvas.
          Video element MUST be visible for iOS Safari to decode frames.
          Canvas sits on top, draws only the green skeleton + rep counter.
          This is how AR filters work — video is the background, canvas is the overlay. */}
      <div
        className="analysis-card"
        style={analyzing
          ? { display: 'block', padding: 8 }
          : { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }
        }
      >
        <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: 'var(--void)' }}>
          {/* Video element: must stay in DOM for iOS Safari to decode frames via seeking.
              Hidden visually — the canvas draws video frame + skeleton as a single composited image,
              bypassing the iOS Safari hardware compositor that renders <video> above <canvas>. */}
          <video ref={videoRef} className="analysis-video" muted playsInline preload="auto"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.01, pointerEvents: 'none', zIndex: -1 }} />

          {/* Single canvas: drawImage(video) + drawPose(skeleton) + rep counter */}
          <canvas ref={overlayRef}
            style={{ width: '100%', display: 'block' }} />
        </div>
        {analyzing && analysisPhase === 'analyzing' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8, padding: '0 4px' }}>
            <span style={{ color: 'var(--bio-cyan)', fontSize: 20, fontWeight: 800 }}>{liveReps} {t('reps').toLowerCase()}</span>
            <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--bio-cyan)',
                borderRadius: 2, transition: 'width 0.1s linear' }} />
            </div>
            <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>{progress}%</span>
          </div>
        )}
      </div>

      {results.map((r, idx) => (
        <ResultCard key={idx} result={r} onReplay={() => setReplayResult(r)} />
      ))}

      {/* BUILD_ID hidden from production UI — visible only in console */}
    </div>
  );
}


// ── Coaching logic: one sentence, data-driven ──

function generateCoachingInsight(repHistory, bioAnalysis, t) {
  if (!repHistory || repHistory.length === 0) return null;

  // Use per-rep ROM from repHistory (signal-based, more accurate) if available
  const hasRepRom = repHistory.length >= 3 && repHistory[0]?.rom != null;
  if (hasRepRom) {
    const last = repHistory[repHistory.length - 1];
    if (last.romPercent != null && last.romPercent < 80) {
      const drop = 100 - last.romPercent;
      return t('insight_rom_drop', { drop });
    }
  } else if (bioAnalysis?.rangeOfMotion?.perRep && bioAnalysis.rangeOfMotion.perRep.length >= 3) {
    const roms = bioAnalysis.rangeOfMotion.perRep;
    const firstRom = roms[0];
    const lastRom = roms[roms.length - 1];
    if (firstRom > 0 && lastRom < firstRom * 0.8) {
      const drop = Math.round((1 - lastRom / firstRom) * 100);
      return t('insight_rom_drop', { drop });
    }
  }

  if (bioAnalysis?.fatigue?.velocityDropoff > 25) {
    return t('insight_fatigue', { drop: Math.round(bioAnalysis.fatigue.velocityDropoff) });
  }

  if (bioAnalysis?.asymmetry?.score > 15) {
    return t('insight_asymmetry', { score: Math.round(bioAnalysis.asymmetry.score) });
  }

  if (bioAnalysis?.velocity?.perRep) {
    const avgVel = bioAnalysis.velocity.perRep.reduce((a, b) => a + b, 0) / bioAnalysis.velocity.perRep.length;
    if (avgVel > 0.8) return t('insight_too_fast');
  }

  const scores = repHistory.map(r => r.score || 0);
  const variance = Math.max(...scores) - Math.min(...scores);
  if (variance < 15 && scores[0] >= 70) return t('insight_ready_progress');

  const best = repHistory.reduce((a, b, i) => (b.score || 0) > (a.score || 0) ? { ...b, num: i + 1 } : a, { ...repHistory[0], num: 1 });
  return t('insight_best_rep', { num: best.num });
}

function generateProgressionNote(progression, t) {
  if (!progression) return null;
  const { prevScore, prevRom, prevDate } = progression;
  const daysSince = Math.round((Date.now() - new Date(prevDate).getTime()) / 86400000);
  const dateStr = daysSince <= 1 ? t('yesterday') : daysSince <= 7 ? t('days_ago', { n: daysSince }) : new Date(prevDate).toLocaleDateString();

  if (prevRom > 0 && progression.currentRom > 0) {
    const romChange = Math.round(progression.currentRom - prevRom);
    if (romChange > 5) return t('prog_rom_up', { change: romChange, date: dateStr });
    if (romChange < -5) return t('prog_rom_down', { change: romChange, date: dateStr });
  }
  if (progression.currentScore > prevScore + 5) return t('prog_form_up', { change: Math.round(progression.currentScore - prevScore), date: dateStr });
  if (progression.currentScore < prevScore - 10) return t('prog_form_down', { date: dateStr });
  return t('prog_consistent', { date: dateStr });
}

function ResultCard({ result, onReplay }) {
  const { t, tExercise, tFormCheck } = useT();
  const {
    fileName, exerciseName, reps, duration, analysisTime,
    formScore, bioAnalysis, report, repHistory, progression,
  } = result;

  const grade = gradeFromScore(formScore);
  const cls = gradeClass(formScore);
  const displayName = tExercise(result.exercise, exerciseName);
  const exerciseDef = EXERCISES[result.exercise];
  const muscles = exerciseDef?.muscles;

  const coachingInsight = generateCoachingInsight(repHistory, bioAnalysis, t);
  const progressionNote = generateProgressionNote(progression, t);

  return (
    <div className="card result-card" style={{ marginTop: 14 }}>
      {/* Header with grade badge */}
      <div className="result-header">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            {getExerciseIllustration(result.exercise) && (
              <img
                src={getExerciseIllustration(result.exercise, 2)}
                alt=""
                style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6,
                  background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <div>
              <h3 style={{ marginBottom: 0, fontSize: '1.1rem' }}>{displayName}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="text-xs text-muted">{fileName}</span>
                {result.autoDetected && (
                  <span style={{
                    fontSize: '0.6rem', padding: '1px 6px', borderRadius: 4,
                    background: 'rgba(0,245,212,0.12)', color: 'var(--accent)', fontWeight: 600,
                  }}>{t('auto_detected')}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <span className={`score-badge ${cls}`} style={{ fontSize: '1.1rem', padding: '8px 16px' }}>{grade}</span>
      </div>

      {/* Muscle Map */}
      {muscles && <MuscleMap muscles={muscles} size={90} />}

      {/* Grid Stats — like the reference app */}
      <div className="stats-grid-2x2">
        <div className="stat-card">
          <span className="stat-card-label">{t('reps').toUpperCase()}</span>
          <span className="stat-card-value">{reps}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">{t('duration').toUpperCase()}</span>
          <span className="stat-card-value">{formatTime(duration)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">{t('form').toUpperCase()} SCORE</span>
          <span className="stat-card-value">
            <span style={{ color: formScore >= 80 ? 'var(--accent)' : formScore >= 60 ? 'var(--yellow)' : 'var(--red)' }}>
              {formScore}
            </span>
            <span style={{ fontSize: '0.7em', color: 'var(--muted)', marginLeft: 2 }}>/100</span>
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">{t('quality').toUpperCase()}</span>
          <span className="stat-card-value">
            {bioAnalysis?.movementQuality != null ? Math.round(bioAnalysis.movementQuality) : '--'}
            <span style={{ fontSize: '0.7em', color: 'var(--muted)', marginLeft: 2 }}>%</span>
          </span>
        </div>
      </div>

      {/* Progression Score (from convergence ProgressionScore engine) */}
      {result.diagnostics?.progression && result.diagnostics.progression.score > 0 && (() => {
        const prog = result.diagnostics.progression;
        const gradeColor = prog.score >= 750 ? 'var(--accent)' : prog.score >= 500 ? 'var(--yellow)' : 'var(--red)';
        return (
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'linear-gradient(135deg, rgba(0,245,212,0.06), rgba(0,245,212,0.02))', borderRadius: 10, border: '1px solid rgba(0,245,212,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Progression Score</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: gradeColor }}>{prog.score}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: gradeColor }}>{prog.grade.label}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{prog.grade.title}</span>
              <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>Top {100 - prog.percentile}%</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {[
                { label: 'Form', val: prog.components.form, max: 250 },
                { label: 'Consistency', val: prog.components.consistency, max: 200 },
                { label: 'Tempo', val: prog.components.tempo, max: 150 },
                { label: 'Power', val: prog.components.power, max: 150 },
              ].map(c => (
                <div key={c.label} style={{ textAlign: 'center' }}>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', marginBottom: 3 }}>
                    <div style={{ width: `${(c.val / c.max) * 100}%`, height: '100%', borderRadius: 2, background: gradeColor, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Tempo & Velocity (from convergence VelocityEngine) */}
      {result.diagnostics?.velocity && (() => {
        const vel = result.diagnostics.velocity;
        return (
          <div className="stats-grid-2x2" style={{ marginTop: 10 }}>
            {vel.fatigue && (
              <div className="stat-card">
                <span className="stat-card-label">FATIGUE</span>
                <span className="stat-card-value" style={{ color: vel.fatigue.detected ? 'var(--red)' : 'var(--accent)' }}>
                  {vel.fatigue.detected ? `${Math.round(vel.fatigue.decay * 100)}%` : 'OK'}
                </span>
              </div>
            )}
            {vel.power && vel.power.peakW > 0 && (
              <div className="stat-card">
                <span className="stat-card-label">PEAK POWER</span>
                <span className="stat-card-value">{vel.power.peakW}<span style={{ fontSize: '0.6em', color: 'var(--muted)', marginLeft: 2 }}>W</span></span>
              </div>
            )}
            {vel.power && vel.power.meanW > 0 && (
              <div className="stat-card">
                <span className="stat-card-label">AVG POWER</span>
                <span className="stat-card-value">{vel.power.meanW}<span style={{ fontSize: '0.6em', color: 'var(--muted)', marginLeft: 2 }}>W</span></span>
              </div>
            )}
            {vel.smoothness != null && (
              <div className="stat-card">
                <span className="stat-card-label">SMOOTHNESS</span>
                <span className="stat-card-value">{Math.round(vel.smoothness * 100)}<span style={{ fontSize: '0.6em', color: 'var(--muted)', marginLeft: 2 }}>%</span></span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Coaching Insight */}
      {coachingInsight && (
        <div className="coaching-card">
          <div className="coaching-icon">AI</div>
          <p className="coaching-text">{coachingInsight}</p>
        </div>
      )}

      {/* Progression Note */}
      {progressionNote && (
        <div className="progression-card">
          <span className="progression-icon">&#x2191;</span>
          <p className="text-sm" style={{ margin: 0, color: 'var(--text-secondary)' }}>{progressionNote}</p>
        </div>
      )}

      {report?.summary && (
        <p className="text-sm" style={{ marginTop: 12, marginBottom: 6, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          {typeof report.summary === 'string' ? report.summary : t(report.summary.key, report.summary)}
        </p>
      )}

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
              {t('trend')}: {t(bioAnalysis.velocity.trend)}
            </p>
          )}
        </div>
      )}

      {/* Per-rep ROM with %ROM degradation — descriptive, not prescriptive */}
      {repHistory && repHistory.length >= 2 && repHistory[0]?.rom != null && (
        <div style={{ marginTop: 14 }}>
          <h4>Range of Motion</h4>
          <div className="rep-bars">
            {repHistory.map((r, i) => {
              const maxRom = Math.max(...repHistory.map(h => h.rom || 0), 1);
              const pct = ((r.rom || 0) / maxRom) * 100;
              const degraded = r.romPercent != null && r.romPercent < 85;
              return (
                <div key={i} className="rep-bar-col">
                  <div className="rep-bar-wrap">
                    <div className="rep-bar" style={{
                      height: `${Math.max(pct, 5)}%`,
                      background: degraded ? 'var(--yellow)' : 'var(--accent)',
                    }} />
                  </div>
                  <span className="rep-num" style={{ fontSize: '0.6rem' }}>
                    {r.romPercent != null ? `${r.romPercent}%` : (i + 1)}
                  </span>
                </div>
              );
            })}
          </div>
          {(() => {
            const first = repHistory[0];
            const last = repHistory[repHistory.length - 1];
            if (first?.rom && last?.rom && last.romPercent != null && last.romPercent < 90) {
              const drop = 100 - last.romPercent;
              return (
                <p className="text-xs" style={{ marginTop: 4, color: 'var(--yellow)' }}>
                  Rep {repHistory.length} was {drop}% shallower than rep 1
                </p>
              );
            }
            if (first?.rom && last?.rom && last.romPercent != null && last.romPercent >= 95) {
              return (
                <p className="text-xs" style={{ marginTop: 4, color: 'var(--accent)' }}>
                  Consistent depth maintained across the set
                </p>
              );
            }
            return null;
          })()}
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
            {bioAnalysis.timeUnderTension.perRep.map((tut, i) => {
              const ecc = tut.eccentric || tut.down || 0;
              const con = tut.concentric || tut.up || 0;
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
                  {t(`joint_${key.toLowerCase()}`) || key}: {typeof val === 'number' ? `${Math.round(val)}%` : String(val)}
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
              {t(bioAnalysis.fatigue.recommendation)}
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
                {tFormCheck(issue)} ({count}/{repHistory.length} reps)
              </div>
            ))}
          </div>
        );
      })()}

      {result.diagnostics && (
        <div style={{ marginTop: 14, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: '0.75rem', color: 'var(--muted)' }}>
          <strong style={{ color: 'var(--text)' }}>{t('engine')}</strong>
          <div>{t('diag_range')}: {result.diagnostics.observedMin}&deg; &ndash; {result.diagnostics.observedMax}&deg; ({result.diagnostics.observedRange}&deg;)</div>
          <div>{t('diag_min_rom')}: {result.diagnostics.minROM}&deg;</div>
          <div>{t('diag_frames')}: {result.diagnostics.totalFrames} | {t('diag_method')}: {result.diagnostics.method}</div>
          {result.diagnostics.anthropometrics?.calibrated && result.diagnostics.anthropometrics.bodyType && (
            <div>Body: {result.diagnostics.anthropometrics.bodyType.torsoType} torso, {result.diagnostics.anthropometrics.bodyType.femurType} femurs, {result.diagnostics.anthropometrics.bodyType.armType} arms | Symmetry: {(result.diagnostics.anthropometrics.bodyType.symmetryIndex * 100).toFixed(0)}%</div>
          )}
        </div>
      )}

      {report?.highlights && report.highlights.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4>{t('highlights')}</h4>
          {report.highlights.map((h, i) => {
            const params = h.exercise ? { ...h, exerciseName: tExercise(h.exercise, h.exerciseName) } : h;
            return (
              <p key={i} className="text-sm" style={{ color: 'var(--accent)', padding: '2px 0' }}>
                {'> '}{typeof h === 'string' ? h : t(params.key, params)}
              </p>
            );
          })}
        </div>
      )}

      {report?.improvements && report.improvements.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4>{t('next_steps')}</h4>
          {report.improvements.map((imp, i) => {
            const params = imp.exercise ? { ...imp, exerciseName: tExercise(imp.exercise, imp.exerciseName) } : imp;
            return (
              <p key={i} className="text-sm text-muted" style={{ padding: '2px 0' }}>
                {i + 1}. {typeof imp === 'string' ? imp : t(params.key, params)}
              </p>
            );
          })}
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
