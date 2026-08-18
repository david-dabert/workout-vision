import { useState, useRef, useCallback, useEffect } from 'react';
import { getImageLandmarker, detectPoseImage, drawPose, extractJointAngles } from '../lib/poseAnalysis';
import { EXERCISES, RepCounter, ExerciseAutoDetector } from '../lib/exercises';
import { analyzeSet } from '../lib/biomechanics';
import { generateWorkoutReport } from '../lib/coach';
import { getProfile, saveWorkout } from '../lib/storage';
import { shareCard } from '../lib/shareCard';
import VideoReplay from './VideoReplay';

const exerciseKeys = Object.keys(EXERCISES);
const MAX_FRAMES = 250; // hard cap for very long videos
const MAX_FRAMES_LARGE = 100; // tighter cap for files >100MB to prevent mobile OOM
const MIN_FPS = 2; // floor: below this, rep counting breaks (Nyquist on ~2s reps)

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
  const [queue, setQueue] = useState([]);
  const [exercise, setExercise] = useState(preSelectedExercise || 'squat');
  const [autoDetect, setAutoDetect] = useState(!preSelectedExercise);
  const userChangedExercise = useRef(!!preSelectedExercise);
  const [weight, setWeight] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [currentFile, setCurrentFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [replayResult, setReplayResult] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const abortRef = useRef(false);
  const videoUrlsRef = useRef([]);

  // Revoke all created video URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      videoUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
    };
  }, []);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('video/'));
    if (files.length === 0) return;
    const items = files.map(f => ({
      id: Date.now() + Math.random(),
      file: f,
      name: f.name,
      size: (f.size / 1024 / 1024).toFixed(1) + ' MB',
      status: 'queued',
      progress: 0,
    }));
    setQueue(prev => [...prev, ...items]);
    e.target.value = '';
  };

  const removeFromQueue = (id) => {
    setQueue(prev => prev.filter(q => q.id !== id));
  };

  const analyzeVideo = useCallback(async (queueItem) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const landmarker = await getImageLandmarker();
    if (!landmarker) return null;

    const url = URL.createObjectURL(queueItem.file);
    videoUrlsRef.current.push(url);
    let urlRevoked = false;
    const safeRevoke = () => {
      if (!urlRevoked) { urlRevoked = true; URL.revokeObjectURL(url); }
    };

    return new Promise((resolve) => {
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.src = url;
      video.load();

      let readyFired = false;

      const onReady = async () => {
        if (readyFired) return;
        readyFired = true;
        video.removeEventListener('loadeddata', onReady);
        video.onloadedmetadata = null;

        const duration = video.duration;
        if (!duration || !isFinite(duration)) { safeRevoke(); resolve(null); return; }

        // Large files need aggressive memory management to avoid mobile OOM.
        const isLargeFile = queueItem.file.size > 100 * 1024 * 1024;
        const frameCap = isLargeFile ? MAX_FRAMES_LARGE : MAX_FRAMES;

        // Adaptive FPS: short videos get 3 FPS, long videos get fewer.
        // MIN_FPS ensures rep counting works (need ~2 samples per rep cycle).
        // For large files, allow MIN_FPS=1 to stay within frame cap.
        const minFps = isLargeFile ? 1 : MIN_FPS;
        const analysisFps = Math.max(minFps, Math.min(3, frameCap / duration));
        const totalFrames = Math.min(frameCap, Math.ceil(duration * analysisFps));
        const interval = duration / totalFrames;

        // Scale canvas: large files get 320px to minimize decoded frame memory.
        const maxW = isLargeFile ? 320 : 480;
        const scale = Math.min(1, maxW / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext('2d');

        const frames = [];
        const replayFrames = []; // sampled subset for replay (every 3rd)
        let detectedExercise = exercise;
        let repCounter = new RepCounter(exercise, { fps: analysisFps });
        const skipAutoDetect = userChangedExercise.current;
        const autoDetector = (autoDetect && !skipAutoDetect) ? new ExerciseAutoDetector({ fps: analysisFps }) : null;
        let autoDetectDone = false;
        const analysisStart = Date.now();

        // Seek to a timestamp, process the frame, return true to continue.
        // Includes a per-seek timeout so it never hangs.
        const processFrame = (frameIdx) => {
          return new Promise((res) => {
            const time = frameIdx * interval;
            if (time >= duration || abortRef.current) { res(false); return; }

            video.currentTime = time;

            let settled = false;
            const settle = (cont) => { if (!settled) { settled = true; res(cont); } };

            const onSeeked = () => {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const result = detectPoseImage(landmarker, canvas);

              if (result && result.landmarks && result.landmarks.length > 0) {
                const landmarks = result.landmarks[0];
                drawPose(ctx, landmarks, canvas.width, canvas.height);

                if (autoDetector && !autoDetectDone && !userChangedExercise.current) {
                  const detected = autoDetector.update(landmarks);
                  if (detected) {
                    detectedExercise = detected;
                    repCounter = new RepCounter(detected, { fps: analysisFps });
                    for (const f of frames) repCounter.update(f.landmarks);
                    autoDetectDone = true;
                  }
                }

                const angles = extractJointAngles(landmarks);
                // For large files, don't store angles per frame (saves memory; re-derived at end if needed)
                if (isLargeFile) {
                  frames.push({ landmarks, timestamp: time });
                } else {
                  frames.push({ landmarks, timestamp: time, angles });
                }
                repCounter.update(landmarks);

                // Sample frames for replay: every 5th for large files, every 3rd otherwise
                const replaySampleRate = isLargeFile ? 5 : 3;
                if (frameIdx % replaySampleRate === 0) {
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

            video.addEventListener('seeked', onSeeked, { once: true });
            // Per-seek timeout: skip this frame if seek hangs (3s)
            setTimeout(() => {
              video.removeEventListener('seeked', onSeeked);
              settle(true); // skip frame, continue to next
            }, 3000);
          });
        };

        // Process all frames sequentially, yielding to UI between frames
        let frameIdx = 0;
        const processLoop = async () => {
          while (frameIdx < totalFrames) {
            const cont = await processFrame(frameIdx);
            if (!cont) break;
            frameIdx++;
            // Yield to UI and let browser GC decoded video frames.
            // Large files yield every frame with a longer delay to reduce memory pressure.
            if (isLargeFile) {
              await new Promise(r => setTimeout(r, 50));
            } else if (frameIdx % 5 === 0) {
              await new Promise(r => setTimeout(r, 0));
            }
          }

          // Done — finalize (keep URL alive for replay)
          const analysisTime = ((Date.now() - analysisStart) / 1000).toFixed(1);

          if (frames.length === 0) { safeRevoke(); resolve(null); return; }

          console.log(`[VideoUpload] ${frames.length}/${totalFrames} frames in ${analysisTime}s (${analysisFps.toFixed(1)} FPS)`);

          const landmarkFrames = frames.map(f => f.landmarks);
          const repHistory = repCounter.repHistory || [];
          const repBoundaries = repHistory.map((r, i) => i);
          const reps = repHistory.length;

          let bioAnalysis = null;
          try {
            bioAnalysis = analyzeSet(landmarkFrames, analysisFps, detectedExercise, repBoundaries);
          } catch (err) { console.error('Bio analysis error:', err); }

          const profile = await getProfile();
          let report = null;
          try {
            report = generateWorkoutReport(profile, [{
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

          try { await saveWorkout(workout); }
          catch (err) { console.error('Save error:', err); }

          setProgress(100);
          resolve({
            fileName: queueItem.name, exercise: detectedExercise,
            exerciseName: EXERCISES[detectedExercise]?.name || detectedExercise,
            reps, duration: Math.round(duration), analysisTime, formScore: avgScore,
            bioAnalysis, report, repHistory,
            // Sampled subset for replay overlay (every 3rd frame)
            videoUrl: url,
            frames: replayFrames,
          });
        };

        processLoop().catch(err => {
          console.error('Analysis failed:', err);
          safeRevoke();
          resolve(null);
        });
      };

      video.addEventListener('loadeddata', onReady);
      video.onloadedmetadata = () => {
        setTimeout(() => { if (video.readyState >= 2) onReady(); }, 300);
      };
      video.onerror = (e) => {
        console.error('Video load error:', e, video.error);
        video.removeEventListener('loadeddata', onReady);
        video.onloadedmetadata = null;
        safeRevoke();
        resolve(null);
      };
      setTimeout(() => {
        if (readyFired) return;
        if (video.readyState >= 2) onReady();
        else { safeRevoke(); resolve(null); }
      }, 15000);
    });
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

  // Show replay view if active
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

      {/* Upload zone */}
      <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
        <div className="upload-content">
          <div className="upload-icon">+</div>
          <p className="text-sm" style={{ color: '#fff', fontWeight: 600 }}>
            Tap to select videos
          </p>
          <p className="text-xs text-muted">MP4, MOV, WebM</p>
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

      {/* Queue */}
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
                {q.status === 'error' && <span style={{ color: 'var(--red)', fontSize: '0.78rem' }}>Failed to load</span>}
                {q.status === 'queued' && !analyzing && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeFromQueue(q.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="analyze-controls">
        {!analyzing ? (
          <>
            <select
              value={exercise}
              onChange={(e) => { setExercise(e.target.value); userChangedExercise.current = true; }}
              style={{ flex: 1, padding: 8, fontSize: '0.82rem' }}
            >
              {exerciseKeys.map(key => (
                <option key={key} value={key}>{EXERCISES[key].name}</option>
              ))}
            </select>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="kg"
              style={{ width: 56, padding: '8px 6px', fontSize: '0.82rem', textAlign: 'center' }}
            />
            <label className="cam-auto">
              <input
                type="checkbox"
                checked={autoDetect}
                onChange={(e) => setAutoDetect(e.target.checked)}
                style={{ width: 'auto', marginRight: 4 }}
              />
              Auto
            </label>
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
            <span>Analyzing {currentFile}... {progress}%</span>
          </div>
        )}
      </div>

      {/* Video element: always in DOM for iOS Safari compatibility.
           Hidden visually but not display:none (iOS won't seek on hidden elements).
           Canvas shows the video frame + skeleton overlay during analysis. */}
      <video
        ref={videoRef}
        muted
        playsInline
        preload="metadata"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
      {/* Canvas: shows video frame + skeleton during analysis */}
      <div
        className="analysis-card"
        style={analyzing
          ? { display: 'block', padding: 8 }
          : { display: 'none' }
        }
      >
        <canvas ref={canvasRef} style={{ width: '100%', borderRadius: 8, display: 'block' }} />
      </div>

      {/* Results */}
      {results.map((r, idx) => (
        <ResultCard key={idx} result={r} onReplay={() => setReplayResult(r)} />
      ))}
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
          <span className="text-xs text-muted">{fileName}</span>
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

      {/* Velocity chart */}
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
                    <div
                      className="rep-bar"
                      style={{
                        height: `${Math.max(pct, 5)}%`,
                        background: declining ? 'var(--yellow)' : 'var(--accent)',
                      }}
                    />
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

      {/* Time Under Tension */}
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
                  (r.eccentric || r.down || 0) + (r.concentric || r.up || 0)
                ),
                1
              );
              const pct = (total / maxTut) * 100;
              return (
                <div key={i} className="rep-bar-col">
                  <div className="rep-bar-wrap">
                    <div
                      className="rep-bar"
                      style={{
                        height: `${Math.max(pct, 5)}%`,
                        background: `linear-gradient(to top, var(--accent) ${(con / total) * 100}%, var(--yellow) 0%)`,
                      }}
                    />
                  </div>
                  <span className="rep-num">{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Range of Motion */}
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
                      <div
                        className="rep-bar"
                        style={{
                          height: `${Math.max(pct, 5)}%`,
                          background: 'var(--accent)',
                        }}
                      />
                    </div>
                    <span className="rep-num">{i + 1}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Asymmetry */}
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

      {/* Fatigue curve */}
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
                      <div
                        className="rep-bar"
                        style={{
                          height: `${Math.max(pct, 5)}%`,
                          background: pct < 60 ? 'var(--red)' : pct < 80 ? 'var(--yellow)' : 'var(--accent)',
                        }}
                      />
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

      {/* Form notes */}
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

      {/* Report highlights */}
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

      {/* Report improvements */}
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

      {/* Rep quality bars */}
      {repHistory && repHistory.length > 0 && (
        <div className="rep-quality" style={{ marginTop: 14 }}>
          <h4>Per-rep quality</h4>
          <div className="rep-bars">
            {repHistory.map((r, i) => {
              const score = r.score || 0;
              return (
                <div key={i} className="rep-bar-col">
                  <div className="rep-bar-wrap">
                    <div
                      className="rep-bar"
                      style={{
                        height: `${Math.max(score, 5)}%`,
                        background: score >= 80 ? 'var(--accent)' : score >= 50 ? 'var(--yellow)' : 'var(--red)',
                      }}
                    />
                  </div>
                  <span className="rep-num">{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
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
