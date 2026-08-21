import { useState, useRef, useCallback, useEffect } from 'react';
import { getImageLandmarker, detectPoseImage, drawPose, extractJointAngles } from '../lib/poseAnalysis';
import { EXERCISES, EXERCISE_GROUPS, RepCounter, ExerciseAutoDetector } from '../lib/exercises';
import { analyzeSet } from '../lib/biomechanics';
import { generateWorkoutReport } from '../lib/coach';
import { saveWorkout } from '../lib/storage';
import { useProfile } from '../lib/ProfileContext';
import { shareCard } from '../lib/shareCard';
import VideoReplay from './VideoReplay';

// ── Build marker: if you see this version in the UI, the deployment is fresh ──
const BUILD_ID = '2026-08-20T' + Date.now().toString(36).slice(-4);

const MAX_FRAMES = 500;
// Universal 50 MB limit. No mobile detection (every detection method failed on iOS).
// 50 MB covers ~50 seconds of 1080p HEVC, which is plenty for form analysis.
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_ANALYSIS_SECONDS = 60;
const WALL_CLOCK_CAP_MS = 90_000;
const PLAY_TIMEOUT_MS = 10_000;

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
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const abortRef = useRef(false);
  const videoUrlsRef = useRef([]);

  // Hide video on mount (managed via DOM, never via React style prop)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.style.cssText =
        'width:1px;height:1px;position:absolute;opacity:0.01;pointer-events:none;';
    }
    return () => { videoUrlsRef.current.forEach(u => URL.revokeObjectURL(u)); };
  }, []);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('video/') || f.type === '');
    if (files.length === 0) return;
    const items = [];
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        alert(
          `${f.name} is ${(f.size / 1024 / 1024).toFixed(0)} MB — too large for analysis.\n\n` +
          `Trim to under 30 seconds for best results:\n` +
          `1. Open in Photos app\n` +
          `2. Tap Edit > drag handles to 30 seconds\n` +
          `3. Save as New Clip\n` +
          `4. Upload the trimmed clip\n\n` +
          `Or use Live Training mode for real-time analysis.`
        );
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

  // ─── Analysis engine ───
  //
  // Play-forward only. No seek mode (iOS HEVC blob URLs don't fire seeked events).
  // Video element visibility is managed via direct DOM manipulation to prevent
  // React re-renders (from setProgress) from overriding inline styles.
  // iOS Safari skips frame decoding for invisible/tiny video elements.

  const analyzeVideo = useCallback(async (queueItem) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const url = URL.createObjectURL(queueItem.file);
    videoUrlsRef.current.push(url);

    const hideVideo = () => {
      video.pause();
      video.removeAttribute('src');
      video.load(); // release resources
      video.style.cssText =
        'width:1px;height:1px;position:absolute;opacity:0.01;pointer-events:none;';
    };

    // ── 1. Make video VISIBLE before loading ──
    // iOS Safari refuses to decode frames unless the element is visible and
    // large enough. Set this BEFORE assigning src so the browser knows it
    // needs to commit to decoding.
    video.style.cssText =
      'width:100%;max-height:300px;display:block;border-radius:8px;pointer-events:none;object-fit:contain;';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    // ── 2. Load video + model in parallel ──
    setAnalysisPhase('model');

    const videoLoaded = new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; resolve(v); } };
      video.onloadedmetadata = () => done(true);
      video.onerror = () => done(false);
      setTimeout(() => done(false), 15_000);
      video.src = url;
      video.load();
    });

    const [landmarker, vidOk] = await Promise.all([
      getImageLandmarker(),
      videoLoaded,
    ]);

    if (!landmarker) {
      hideVideo();
      alert('AI model failed to load. Check your connection and try again.');
      return null;
    }

    if (!vidOk && video.readyState < 1) {
      // Give it a final 3 seconds
      await new Promise(r => setTimeout(r, 3000));
      if (video.readyState < 1) {
        hideVideo();
        alert('Video failed to load. Try a shorter clip or MP4 format.');
        return null;
      }
    }

    // ── 3. Get duration ──
    setAnalysisPhase('loading');
    let duration = video.duration;
    if (!isFinite(duration) || duration <= 0) {
      await new Promise((resolve) => {
        const onDur = () => {
          if (isFinite(video.duration) && video.duration > 0) {
            video.removeEventListener('durationchange', onDur);
            resolve();
          }
        };
        video.addEventListener('durationchange', onDur);
        setTimeout(() => {
          video.removeEventListener('durationchange', onDur);
          resolve();
        }, 8000);
      });
      duration = video.duration;
    }
    if (!isFinite(duration) || duration <= 0) {
      hideVideo();
      alert('Cannot read video duration. Try a different file.');
      return null;
    }

    const effectiveDuration = Math.min(duration, MAX_ANALYSIS_SECONDS);
    console.log(`[Upload] ${duration.toFixed(1)}s ${video.videoWidth}x${video.videoHeight} analyzing ${effectiveDuration}s [${BUILD_ID}]`);

    // ── 4. Start playback ──
    setAnalysisPhase('analyzing');
    video.currentTime = 0.01; // tiny offset avoids iOS black-frame-at-zero issue

    try {
      await video.play();
    } catch (err) {
      console.error('[Upload] play() rejected:', err);
      hideVideo();
      alert('Cannot play this video for analysis.\nTry trimming it or use Live Training.');
      return null;
    }

    // Wait for currentTime to actually advance (confirms decoder is running)
    const playConfirmed = await new Promise((resolve) => {
      const start = video.currentTime;
      let elapsed = 0;
      const timer = setInterval(() => {
        elapsed += 200;
        if (video.currentTime > start + 0.05) {
          clearInterval(timer);
          resolve(true);
        }
        if (elapsed >= PLAY_TIMEOUT_MS) {
          clearInterval(timer);
          resolve(false);
        }
      }, 200);
    });

    if (!playConfirmed) {
      video.pause();
      hideVideo();
      alert(
        'Video is not playing — this happens with large or HEVC files.\n\n' +
        'Fix: trim to under 30 seconds in Photos, or use Live Training.'
      );
      return null;
    }

    // ── 5. Capture frames via requestAnimationFrame ──
    const targetFps = 8;
    const captureInterval = 1.0 / targetFps;
    const maxDim = 480;
    const scale = Math.min(1, maxDim / (video.videoWidth || 320));
    canvas.width = Math.round((video.videoWidth || 320) * scale);
    canvas.height = Math.round((video.videoHeight || 240) * scale);
    const ctx = canvas.getContext('2d');

    const frames = [];
    const replayFrames = [];
    const isAutoMode = exercise === '__auto__';
    const initialExercise = isAutoMode ? 'squat' : exercise;
    let detectedExercise = initialExercise;
    let repCounter = new RepCounter(initialExercise, { fps: targetFps });
    const skipAutoDetect = !isAutoMode && userChangedExercise.current;
    const autoDetector = (isAutoMode || (autoDetect && !skipAutoDetect))
      ? new ExerciseAutoDetector({ fps: targetFps }) : null;
    let autoDetectDone = false;
    let autoDetected = false;
    const analysisStart = Date.now();

    // Speed up after confirming first frames are captured
    let speedBumped = false;

    await new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; video.pause(); resolve(); } };

      let frameIdx = 0;
      let lastCaptureVt = -Infinity;
      // Stall tracking: wall-clock based, checks every 5 seconds
      let stallCheckWall = performance.now();
      let stallCheckVt = video.currentTime || 0;

      const tick = () => {
        if (done) return;
        if (abortRef.current) { finish(); return; }

        const vt = video.currentTime;
        const wallNow = performance.now();
        const wallElapsed = Date.now() - analysisStart;

        // ── Exit conditions ──
        if (video.ended || video.paused) { finish(); return; }
        if (isFinite(vt) && vt >= effectiveDuration) { finish(); return; }
        if (wallElapsed > WALL_CLOCK_CAP_MS) {
          console.warn('[Upload] 90s wall-clock cap');
          finish(); return;
        }
        if (frameIdx >= MAX_FRAMES) { finish(); return; }

        // ── Stall detection (every 5 seconds) ──
        if (wallNow - stallCheckWall > 5000) {
          const vtDelta = (isFinite(vt) ? vt : 0) - stallCheckVt;
          if (vtDelta < 0.2) {
            console.warn(`[Upload] Stall: ${vtDelta.toFixed(3)}s video in 5s real`);
            finish(); return;
          }
          stallCheckWall = wallNow;
          stallCheckVt = isFinite(vt) ? vt : stallCheckVt;
        }

        // ── Frame capture ──
        // Don't gate on readyState — just try drawImage. If the frame isn't
        // decoded, canvas gets a black/stale frame and pose detection returns
        // no landmarks, which is harmless. Gating on readyState>=2 caused
        // zero captures on iOS where readyState fluctuates during HEVC decode.
        if (isFinite(vt) && vt > 0 && vt - lastCaptureVt >= captureInterval * 0.7) {
          lastCaptureVt = vt;

          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          } catch (_) {
            // drawImage can throw if video is in a bad state; skip this frame
            requestAnimationFrame(tick);
            return;
          }

          const result = detectPoseImage(landmarker, canvas);

          if (result?.landmarks?.length) {
            const landmarks = result.landmarks[0];
            drawPose(ctx, landmarks, canvas.width, canvas.height);

            // Auto-detect is now deferred to the end of the video

            const angles = extractJointAngles(landmarks);
            frames.push({ landmarks, timestamp: vt, angles });
            repCounter.update(landmarks);
            if (frameIdx % 3 === 0) {
              replayFrames.push({ landmarks, timestamp: vt });
            }
            frameIdx++;

            // Speed up after 5 successful captures
            if (!speedBumped && frameIdx >= 5) {
              speedBumped = true;
              try { video.playbackRate = effectiveDuration > 30 ? 2.5 : 2; } catch (_) {}
            }
          }

          // Update progress
          const pct = Math.min(99, Math.round((vt / effectiveDuration) * 100));
          setProgress(pct);
          setQueue(prev => prev.map(q =>
            q.id === queueItem.id ? { ...q, progress: pct } : q
          ));
        }

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });

    // ── 6. Finalize ──
    hideVideo();
    const analysisTime = ((Date.now() - analysisStart) / 1000).toFixed(1);

    if (frames.length === 0) {
      console.error(`[Upload] Zero frames captured in ${analysisTime}s`);
      alert(
        `Could not detect any poses in ${queueItem.name}.\n\n` +
        `This can happen with:\n` +
        `• Very large or long videos\n` +
        `• Uncommon video formats\n\n` +
        `Try trimming to 30 seconds in Photos, or use Live Training.`
      );
      return null;
    }

    // ── 6.5. Deferred Auto-Detection (Rep-based scoring) ──
    if (autoDetector && !userChangedExercise.current) {
      const tallies = {};
      const detector = new ExerciseAutoDetector({ fps: targetFps });
      for (const f of frames) {
         const det = detector.update(f.landmarks);
         if (det) tallies[det] = (tallies[det] || 0) + 1;
      }
      
      const candidates = Object.keys(tallies);
      if (candidates.length > 0) {
        let bestEx = initialExercise;
        let bestScore = -1;

        for (const ex of candidates) {
           const rc = new RepCounter(ex, { fps: targetFps });
           for (const f of frames) rc.update(f.landmarks);
           rc.finalize();
           const reps = rc.repHistory ? rc.repHistory.length : 0;
           
           // Score = reps * 1000 + tallies (prioritize reps, tie-break with tallies)
           const score = reps * 1000 + tallies[ex];
           if (score > bestScore) {
              bestScore = score;
              bestEx = ex;
           }
        }

        if (bestEx !== initialExercise || candidates.includes(initialExercise)) {
           detectedExercise = bestEx;
           autoDetected = true;
           setExercise(detectedExercise); // Update UI dropdown
           
           // Rebuild final repCounter for the winner
           repCounter = new RepCounter(detectedExercise, { fps: targetFps });
           for (const f of frames) repCounter.update(f.landmarks);
        }
      }
    }

    repCounter.finalize();
    console.log(`[Upload] ${frames.length} frames in ${analysisTime}s`);

    const landmarkFrames = frames.map(f => f.landmarks);
    const repHistory = repCounter.repHistory || [];
    const reps = repHistory.length;

    let bioAnalysis = null;
    try { bioAnalysis = analyzeSet(landmarkFrames, targetFps, detectedExercise, repHistory); }
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
        <h2>Analyze Video</h2>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
      </div>

      <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
        <div className="upload-content">
          <div className="upload-icon">+</div>
          <p className="text-sm" style={{ color: '#fff', fontWeight: 600 }}>
            Tap to select videos
          </p>
          <p className="text-xs text-muted">MP4, MOV — max 50 MB (~30 sec)</p>
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
                {q.status === 'done' && <span className="queue-done">Done</span>}
                {q.status === 'error' && (
                  <span style={{ color: 'var(--red)', fontSize: '0.73rem', lineHeight: 1.4 }}>
                    Failed — trim to 30s or use Live Training
                  </span>
                )}
                {q.status === 'queued' && !analyzing && (
                  <button className="btn btn-ghost btn-sm" onClick={() => removeFromQueue(q.id)}>
                    Remove
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
              <option value="__auto__">Automatic</option>
              <optgroup label="Compound">
                {EXERCISE_GROUPS.compound.map(e => (
                  <option key={e.key} value={e.key}>{e.name}</option>
                ))}
              </optgroup>
              <optgroup label="Isolation">
                {EXERCISE_GROUPS.isolation.map(e => (
                  <option key={e.key} value={e.key}>{e.name}</option>
                ))}
              </optgroup>
              <optgroup label="Bodyweight">
                {EXERCISE_GROUPS.bodyweight.map(e => (
                  <option key={e.key} value={e.key}>{e.name}</option>
                ))}
              </optgroup>
              <optgroup label="Other">
                <option value="superset">Superset / Other</option>
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
              Analyze
            </button>
          </>
        ) : (
          <div className="analyzing-status">
            <div className="spinner-sm" />
            <span>
              {analysisPhase === 'model'
                ? 'Loading AI engine...'
                : analysisPhase === 'loading'
                ? `Buffering ${currentFile}...`
                : analysisPhase === 'analyzing'
                ? `Analyzing ${currentFile}... ${progress}%`
                : `Starting ${currentFile}...`}
            </span>
            {analysisPhase === 'model' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 4 }}>
                Downloading pose detection model (~3 MB)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Video element: NO React style prop. Visibility managed via DOM only.
          React re-renders from setProgress/setQueue would override inline styles
          if we used a React style prop, potentially hiding the video mid-analysis
          on iOS Safari (which then stops decoding frames). */}
      <video ref={videoRef} muted playsInline preload="auto" />

      <div
        className="analysis-card"
        style={analyzing ? { display: 'block', padding: 8 } : { display: 'none' }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', borderRadius: 8, display: 'block' }} />
      </div>

      {results.map((r, idx) => (
        <ResultCard key={idx} result={r} onReplay={() => setReplayResult(r)} />
      ))}

      <div style={{ textAlign: 'center', padding: '8px 0', fontSize: '0.65rem', color: '#333' }}>
        v{BUILD_ID}
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

  return (
    <div className="card result-card" style={{ marginTop: 14 }}>
      <div className="result-header">
        <div>
          <h3 style={{ marginBottom: 2 }}>{exerciseName}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="text-xs text-muted">{fileName}</span>
            {result.autoDetected && (
              <span style={{
                fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4,
                background: 'rgba(0,255,136,0.15)', color: 'var(--accent)', fontWeight: 600,
              }}>Auto-detected</span>
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
          <span className="stat-label">Reps</span>
        </div>
        <div className="stat">
          <span className="stat-value">{formatTime(duration)}</span>
          <span className="stat-label">Duration</span>
        </div>
        <div className="stat">
          <span className="stat-value">{formScore}</span>
          <span className="stat-label">Form</span>
        </div>
        {bioAnalysis?.movementQuality != null && (
          <div className="stat">
            <span className="stat-value">{Math.round(bioAnalysis.movementQuality)}</span>
            <span className="stat-label">Quality</span>
          </div>
        )}
        <div className="stat">
          <span className="stat-value">{analysisTime}s</span>
          <span className="stat-label">Analysis</span>
        </div>
      </div>

      {bioAnalysis?.velocity?.perRep && bioAnalysis.velocity.perRep.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4>Velocity per rep</h4>
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
          <h4>Time under tension</h4>
          <div className="result-stats" style={{ marginBottom: 6 }}>
            <div className="stat">
              <span className="stat-value">{bioAnalysis.timeUnderTension.eccentric?.toFixed(1)}s</span>
              <span className="stat-label">Eccentric</span>
            </div>
            <div className="stat">
              <span className="stat-value">{bioAnalysis.timeUnderTension.concentric?.toFixed(1)}s</span>
              <span className="stat-label">Concentric</span>
            </div>
            <div className="stat">
              <span className="stat-value">{bioAnalysis.timeUnderTension.total?.toFixed(1)}s</span>
              <span className="stat-label">Total</span>
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
          <h4>Range of motion</h4>
          <div className="result-stats" style={{ marginBottom: 6 }}>
            <div className="stat">
              <span className="stat-value">{Math.round(bioAnalysis.rangeOfMotion.avgDegrees)}&deg;</span>
              <span className="stat-label">Avg ROM</span>
            </div>
            <div className="stat">
              <span className="stat-value">{Math.round(bioAnalysis.rangeOfMotion.consistency || 0)}%</span>
              <span className="stat-label">Consistency</span>
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
          <h4>Asymmetry</h4>
          <div className="result-stats">
            <div className="stat">
              <span className="stat-value">
                <span className={`score-badge ${bioAnalysis.asymmetry.score <= 10 ? 'good' : bioAnalysis.asymmetry.score <= 20 ? 'ok' : 'poor'}`}>
                  {Math.round(bioAnalysis.asymmetry.score)}%
                </span>
              </span>
              <span className="stat-label">Imbalance</span>
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
          <h4>Fatigue</h4>
          <div className="result-stats" style={{ marginBottom: 6 }}>
            <div className="stat">
              <span className="stat-value">{Math.round(bioAnalysis.fatigue.index || 0)}%</span>
              <span className="stat-label">Fatigue index</span>
            </div>
            {bioAnalysis.fatigue.velocityDropoff != null && (
              <div className="stat">
                <span className="stat-value">{Math.round(bioAnalysis.fatigue.velocityDropoff)}%</span>
                <span className="stat-label">Velocity dropoff</span>
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
            <h4>Form notes</h4>
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
          <strong style={{ color: 'var(--text)' }}>Engine</strong>
          <div>Range: {result.diagnostics.observedMin}&deg; &ndash; {result.diagnostics.observedMax}&deg; ({result.diagnostics.observedRange}&deg;)</div>
          <div>Min ROM per rep: {result.diagnostics.minROM}&deg;</div>
          <div>Frames: {result.diagnostics.totalFrames} | Method: {result.diagnostics.method}</div>
        </div>
      )}

      {report?.highlights && report.highlights.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4>Highlights</h4>
          {report.highlights.map((h, i) => (
            <p key={i} className="text-sm" style={{ color: 'var(--accent)', padding: '2px 0' }}>
              {'> '}{h}
            </p>
          ))}
        </div>
      )}

      {report?.improvements && report.improvements.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4>Next steps</h4>
          {report.improvements.map((imp, i) => (
            <p key={i} className="text-sm text-muted" style={{ padding: '2px 0' }}>
              {i + 1}. {imp}
            </p>
          ))}
        </div>
      )}

      {repHistory && repHistory.length > 0 && (
        <div className="rep-quality" style={{ marginTop: 14 }}>
          <h4>Per-rep quality</h4>
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
          Watch with AI Overlay
        </button>
      )}
      <button
        className="btn btn-ghost"
        style={{ width: '100%', marginTop: 8, padding: '12px 0', fontSize: '0.9rem', fontWeight: 600 }}
        onClick={() => shareCard(result)}
      >
        Share Summary Card
      </button>
    </div>
  );
}
