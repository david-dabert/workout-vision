import { useState, useRef, useCallback, useEffect } from 'react';
import { disposeAllLandmarkers } from '../lib/poseAnalysis';
import { EXERCISES, EXERCISE_GROUPS, getExerciseIllustration, getExerciseTier } from '../lib/exercises';
import { useProfile } from '../lib/ProfileContext';
import { useT } from '../lib/LanguageContext';
import { INJURY_MAP, INJURY_LABELS, loadInjuries, saveInjuries } from '../lib/injuries';
import { VideoSuitabilityDetector } from '../lib/videoSuitability';
import { AnalysisDiagnostics } from '../lib/analysisDiagnostics';
import { detectViewpointFromFrames } from '../lib/cameraViewpoint';
import s from './VideoUpload.module.css';
import VideoReplay from './VideoReplay';
import ResultCard from './ResultCard';
import FeedbackPanel from './FeedbackPanel';
import CameraPrivacyModal, { usePrivacyGate } from './CameraPrivacyModal';
import VideoSuitabilityBanner from './VideoSuitabilityBanner';
import usePoseWorker from '../lib/usePoseWorker';
import { analyzeVideoFile } from '../lib/analyzeVideo';

// Detect iOS Safari for platform-specific workarounds
const IS_IOS = (() => {
  try {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  } catch {
    return false;
  }
})();

// High-priority yield that lets the browser paint between frames.
// MessageChannel fires before setTimeout's 4ms minimum, keeping the UI responsive
// during the 30-120 second analysis pipeline without slowing it down.
const yieldToMain = () => new Promise(resolve => {
  const ch = new MessageChannel();
  ch.port1.onmessage = resolve;
  ch.port2.postMessage(null);
});

// Streaming extraction on iOS means only 1 frame in memory at a time,
// so frame count is no longer a memory constraint. 300 frames at 10fps = 30s of video.
const MAX_FRAMES = IS_IOS ? 300 : 600;
const MAX_FILE_SIZE = IS_IOS ? 250 * 1024 * 1024 : 500 * 1024 * 1024;

export default function VideoUpload({ onClose, preSelectedExercise }) {
  const { t, tExercise, tFormCheck, lang, setLang } = useT();
  const { profile: userProfile } = useProfile();
  const { accepted: privacyAccepted, accept: acceptPrivacy, showModal: showPrivacyModal } = usePrivacyGate();
  const { isReady: workerReady, isSupported: workerSupported, initWorker, detectFrame, resetWorker, disposeWorker } = usePoseWorker();
  const [queue, setQueue] = useState([]);
  const [exercise, setExercise] = useState(preSelectedExercise || '__auto__');
  const [autoDetect, setAutoDetect] = useState(!preSelectedExercise);
  const userChangedExercise = useRef(!!preSelectedExercise);
  const [weight, setWeight] = useState('');
  const weightRef = useRef('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState('');
  const [phaseLabel, setPhaseLabel] = useState('');
  const [currentFile, setCurrentFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [replayResult, setReplayResult] = useState(null);
  const [liveReps, setLiveReps] = useState(0);
  const [userInjuries, setUserInjuries] = useState([]);

  // loadInjuries is async — resolve it into state after mount
  useEffect(() => {
    loadInjuries().then(injuries => setUserInjuries(injuries || []));
  }, []);
  const [errorMsg, setErrorMsg] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null); // { videoHash, frameCount, landmarkHash }
  const [dragOver, setDragOver] = useState(false);
  const [ffmpegStatus, setFfmpegStatus] = useState('');
  const [suitabilityAssessment, setSuitabilityAssessment] = useState(null);
  const [progressiveDetection, setProgressiveDetection] = useState(null);
  const [cancelled, setCancelled] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const abortControllerRef = useRef(null);
  const blobUrlRef = useRef(null);
  const audioFeedbackRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(false);

  useEffect(() => {
    // Pre-initialize worker in background (model downloads while user picks video)
    if (workerSupported) initWorker().catch(() => {});
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      disposeAllLandmarkers();
      disposeWorker();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      if (audioFeedbackRef.current) {
        audioFeedbackRef.current.dispose();
        audioFeedbackRef.current = null;
      }
    };
  }, []);

  const [iosWarning, setIosWarning] = useState(null);

  const handleFiles = (e) => {
    setErrorMsg(null);
    setIosWarning(null);
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith('video/') || f.type === '');
    if (files.length === 0) return;
    const items = [];
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        setErrorMsg(`${f.name} (${(f.size / 1024 / 1024).toFixed(0)} MB) ${t('too_large')}`);
        continue;
      }
      // iOS large file warning (>50MB)
      if (IS_IOS && f.size > 50 * 1024 * 1024) {
        setIosWarning(`${f.name} ${t('ios_large_file_warning').replace('{size}', (f.size / 1024 / 1024).toFixed(0))}`);
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

  // ─── VIDEO ANALYSIS ENGINE ───
  // Domain logic extracted to src/lib/analyzeVideo.js.
  // This wrapper bridges React state (progress, phase, errors) to the pure engine.

  const analyzeVideo = useCallback(async (queueItem, signal) => {
    const weightKg = parseFloat(weight) || 0;

    const result = await analyzeVideoFile({
      file: queueItem.file,
      exercise,
      autoDetect,
      userChangedExercise: userChangedExercise.current,
      weightKg,
      userInjuries,
      userProfile,
      worker: {
        ready: workerReady,
        supported: workerSupported,
        init: initWorker,
        detect: detectFrame,
        reset: resetWorker,
      },
      onProgress: (pct) => {
        setProgress(pct);
        setFfmpegStatus(pct < 95 ? `Analyzing... ${pct}%` : '');
        setQueue(prev => prev.map(q =>
          q.id === queueItem.id ? { ...q, progress: pct } : q
        ));
      },
      onPhase: (phase) => {
        setAnalysisPhase(phase);
        const labels = { hashing: 'Hashing video file...', model: 'Loading AI model...', extracting: 'Analyzing video...', analyzing: 'Processing movement data...' };
        setFfmpegStatus(labels[phase] || '');
        if (phase === 'extracting') { setLiveReps(0); setProgressiveDetection(null); }
      },
      onLiveReps: (reps) => setLiveReps(reps),
      onExerciseDetected: (ex) => setExercise(ex),
      onSuitability: (assessment) => setSuitabilityAssessment(assessment),
      onProgressiveUpdate: (update) => setProgressiveDetection(update),
      signal,
    });

    if (!result) {
      setErrorMsg(`${t('no_poses')} ${queueItem.name}. ${t('try_different')}`);
      return null;
    }

    // Handle aborted results
    if (result.aborted) {
      setCancelled(true);
      setFfmpegStatus('');
      if (result.reps > 0) {
        // Partial results available
        setDebugInfo(result.debug || null);
        const url = URL.createObjectURL(queueItem.file);
        blobUrlRef.current = url;
        return { ...result, videoUrl: url, partial: true };
      }
      return null;
    }

    setDebugInfo(result.debug);
    setFfmpegStatus('');

    // Create blob URL for replay
    const url = URL.createObjectURL(queueItem.file);
    blobUrlRef.current = url;

    return { ...result, videoUrl: url };
  }, [exercise, autoDetect, weight, userInjuries, userProfile, workerReady, workerSupported, initWorker, detectFrame, resetWorker]);

  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const startAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setCancelled(false);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const pending = queue.filter(q => q.status === 'queued');
    const allResults = [...results];

    for (const item of pending) {
      if (controller.signal.aborted) break;
      setCurrentFile(item.name);
      setProgress(0);
      setQueue(prev => prev.map(q =>
        q.id === item.id ? { ...q, status: 'analyzing' } : q
      ));

      try {
        const result = await analyzeVideo(item, controller.signal);

        if (result && !result.aborted) {
          setQueue(prev => prev.map(q =>
            q.id === item.id ? { ...q, status: 'done', progress: 100 } : q
          ));
          allResults.push(result);
        } else if (result?.aborted && result.reps > 0) {
          // Partial results from cancelled analysis
          setQueue(prev => prev.map(q =>
            q.id === item.id ? { ...q, status: 'cancelled', progress: result.progress || 0 } : q
          ));
          allResults.push(result);
        } else if (controller.signal.aborted) {
          setQueue(prev => prev.map(q =>
            q.id === item.id ? { ...q, status: 'cancelled' } : q
          ));
        } else {
          setQueue(prev => prev.map(q =>
            q.id === item.id ? { ...q, status: 'error', progress: 0 } : q
          ));
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          setQueue(prev => prev.map(q =>
            q.id === item.id ? { ...q, status: 'cancelled' } : q
          ));
          break;
        }
        console.error('[VideoUpload] Analysis failed for', item.name, err);
        setQueue(prev => prev.map(q =>
          q.id === item.id ? { ...q, status: 'error', progress: 0 } : q
        ));
      }
    }

    setResults(allResults);
    setAnalyzing(false);
    setCurrentFile(null);
    abortControllerRef.current = null;
  }, [queue, results, analyzeVideo]);

  // Resume: re-queue cancelled items and start analysis again
  const resumeAnalysis = useCallback(() => {
    setCancelled(false);
    setQueue(prev => prev.map(q =>
      q.status === 'cancelled' ? { ...q, status: 'queued', progress: 0 } : q
    ));
  }, []);

  const hasQueued = queue.some(q => q.status === 'queued');
  const hasCancelled = queue.some(q => q.status === 'cancelled');

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
        audioEnabled={audioEnabled}
      />
    );
  }

  return (
    <div className="page">
      {showPrivacyModal && (
        <CameraPrivacyModal
          onAccept={acceptPrivacy}
          onDecline={onClose || (() => window.history.back())}
        />
      )}
      <div className="page-header">
        <h2>{t('analyze_video')}</h2>
        <div className={s.headerControls}>
          <button
            className={`btn btn-ghost btn-sm ${s.langButton}`}
            style={{ opacity: lang === 'en' ? 1 : 0.5 }}
            onClick={() => setLang('en')}
          >EN</button>
          <button
            className={`btn btn-ghost btn-sm ${s.langButton}`}
            style={{ opacity: lang === 'fr' ? 1 : 0.5 }}
            onClick={() => setLang('fr')}
          >FR</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{t('close')}</button>
        </div>
      </div>

      {queue.length === 0 && results.length === 0 && (
        <div className={s.tipBanner}>
          <p className={s.tipText}>
            📐 {t('filming_tip')}
          </p>
        </div>
      )}

      {iosWarning && (
        <div className={s.iosWarningBanner}>
          <p className={s.iosWarningText}>
            {iosWarning}
          </p>
        </div>
      )}

      <div
        className={`upload-zone${dragOver ? ' dragover' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={t('upload_video') || 'Upload video'}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
        onDrop={(e) => {
          e.preventDefault(); e.stopPropagation(); setDragOver(false);
          const files = e.dataTransfer?.files;
          if (files?.length) handleFiles({ target: { files } });
        }}
      >
        <div className="upload-content">
          <div className="upload-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className={`text-sm ${s.uploadLabel}`}>
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
          className={s.hiddenInput}
        />
      </div>

      {cancelled && !analyzing && (
        <div className={s.cancelledBanner}>
          <p className={s.cancelledText}>
            Analysis cancelled. {hasCancelled ? 'Press Resume to continue from checkpoint.' : 'Partial results shown below.'}
          </p>
          <button
            onClick={() => setCancelled(false)}
            className={s.dismissButton}
          >&times;</button>
        </div>
      )}

      {errorMsg && (
        <div className={s.errorBanner}>
          <span className={s.errorIcon}>!</span>
          <div className={s.errorBody}>
            <p className={s.errorText}>{errorMsg}</p>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className={s.dismissButton}
          >&times;</button>
        </div>
      )}

      {queue.length > 0 && (
        <div className={s.queueList}>
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
                {q.status === 'cancelled' && (
                  <span className={s.statusCancelled}>
                    Cancelled
                  </span>
                )}
                {q.status === 'error' && (
                  <span className={s.statusError}>
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
            <div className={s.exerciseRow}>
              {exercise !== '__auto__' && getExerciseIllustration(exercise) && (
                <img
                  src={getExerciseIllustration(exercise, 2)}
                  alt=""
                  className={s.exerciseIllustration}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <select
                aria-label={t('exercise_select') || 'Select exercise'}
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
                className={s.exerciseSelect}
              >
                <option value="__auto__">{t('automatic')}</option>
                <optgroup label={t('compound')}>
                  {EXERCISE_GROUPS.compound.map(e => (
                    <option key={e.key} value={e.key}>{tExercise(e.key, e.name)}{e.tier === 'validated' ? ' ✓' : e.tier === 'experimental' ? ' ·' : ''}</option>
                  ))}
                </optgroup>
                <optgroup label={t('isolation')}>
                  {EXERCISE_GROUPS.isolation.map(e => (
                    <option key={e.key} value={e.key}>{tExercise(e.key, e.name)}{e.tier === 'validated' ? ' ✓' : e.tier === 'experimental' ? ' ·' : ''}</option>
                  ))}
                </optgroup>
                <optgroup label={t('bodyweight')}>
                  {EXERCISE_GROUPS.bodyweight.map(e => (
                    <option key={e.key} value={e.key}>{tExercise(e.key, e.name)}{e.tier === 'validated' ? ' ✓' : e.tier === 'experimental' ? ' ·' : ''}</option>
                  ))}
                </optgroup>
                <optgroup label={t('other')}>
                  <option value="superset">{t('ex.superset')}</option>
                </optgroup>
              </select>
            </div>
            <div className={s.weightRow}>
              <input
                type="number"
                value={weight}
                onChange={(e) => { setWeight(e.target.value); weightRef.current = e.target.value; }}
                placeholder="kg"
                aria-label={t('weight_label') || 'Weight in kg'}
                className={s.weightInput}
              />
              <button
                className={`btn btn-ghost btn-sm ${audioEnabled ? 'active' : ''} ${s.audioToggle}`}
                style={{
                  opacity: audioEnabled ? 1 : 0.4,
                  background: audioEnabled ? 'rgba(0,245,212,0.15)' : 'transparent',
                }}
                onClick={() => setAudioEnabled(prev => !prev)}
                title={audioEnabled ? 'Audio feedback ON' : 'Audio feedback OFF'}
              >
                {audioEnabled ? '\u{1F50A}' : '\u{1F507}'}
              </button>
              {hasCancelled && !hasQueued ? (
                <button
                  className={`btn btn-primary ${s.flexGrow}`}
                  onClick={() => { resumeAnalysis(); }}
                >
                  Resume
                </button>
              ) : (
                <button
                  className={`btn btn-primary ${s.flexGrow}`}
                  onClick={startAnalysis}
                  disabled={!hasQueued}
                >
                  {t('analyze')}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="analysis-progress-panel">
            <div className={s.progressHeader}>
              <span className={s.currentFileName}>
                {currentFile}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={cancelAnalysis}>{t('stop')}</button>
            </div>
            <div className="analysis-phases">
              {[
                { key: 'hashing', label: t('phase_hashing'), icon: '#' },
                { key: 'model', label: t('phase_model'), icon: '\u25C6' },
                { key: 'extracting', label: t('phase_extracting'), icon: '\u25A6' },
                { key: 'analyzing', label: t('phase_analyzing'), icon: '\u25C9' },
              ].map((phase, i) => {
                const phaseOrder = ['hashing', 'model', 'extracting', 'analyzing'];
                const currentIdx = phaseOrder.indexOf(analysisPhase);
                const thisIdx = phaseOrder.indexOf(phase.key);
                const isActive = thisIdx === currentIdx;
                const isDone = thisIdx < currentIdx;
                return (
                  <div key={phase.key} className={s.phaseStep}
                    style={{ opacity: isDone ? 0.4 : isActive ? 1 : 0.25 }}>
                    <span className={`${s.phaseIndicator} ${isDone ? s.phaseIndicatorDone : isActive ? s.phaseIndicatorActive : s.phaseIndicatorPending}`}>
                      {isDone ? '\u2713' : i + 1}
                    </span>
                    <span className={isActive ? s.phaseLabelActive : s.phaseLabelInactive}>
                      {phase.label}
                    </span>
                    {isActive && <div className={`spinner-sm ${s.phaseSpinner}`} />}
                  </div>
                );
              })}
            </div>
            <div className={s.progressBarArea}>
              <div className={s.progressTrack}>
                <div className={s.progressFill} style={{ width: `${progress}%` }} />
              </div>
              {ffmpegStatus && (
                <span className={s.ffmpegStatus}>
                  {ffmpegStatus}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className={s.injurySection}>
        <span className={s.injuryLabel}>
          {t('limitations')}:
        </span>
        <div className={s.injuryGrid}>
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
                  userInjuriesRef.current = next;
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
        <div className={s.analysisVideoWrapper}>
          {/* Video element: must stay in DOM for iOS Safari to decode frames via seeking.
              Hidden visually — the canvas draws video frame + skeleton as a single composited image,
              bypassing the iOS Safari hardware compositor that renders <video> above <canvas>. */}
          <video ref={videoRef} className={`analysis-video ${s.analysisVideoElement}`} muted playsInline preload="auto" />

          {/* Single canvas: drawImage(video) + drawPose(skeleton) + rep counter */}
          <canvas ref={overlayRef}
            className={s.overlayCanvas} />
        </div>
        {analyzing && (analysisPhase === 'extracting' || analysisPhase === 'analyzing') && (
          <div className={s.liveRepSection}>
            {suitabilityAssessment && suitabilityAssessment.suitable !== 'good' && (
              <VideoSuitabilityBanner assessment={suitabilityAssessment} compact />
            )}
            {progressiveDetection && progressiveDetection.exercise && (
              <span className={s.liveExerciseLabel}>
                {tExercise(progressiveDetection.exercise)}
              </span>
            )}
            <div className={s.liveRepRow}>
              <span className={s.liveRepCount}>{liveReps} {t('reps').toLowerCase()}</span>
              <div className={s.liveRepTrack} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className={s.liveRepFill} style={{ width: `${progress}%` }} />
              </div>
              <span className={s.liveRepPercent}>{progress}%</span>
            </div>
          </div>
        )}
      </div>

      {results.map((r, idx) => (
        <div key={idx}>
          <ResultCard result={r} onReplay={() => setReplayResult(r)} />
          <FeedbackPanel result={r} />
        </div>
      ))}

      {results.length > 0 && (
        <button
          className="analyze-another"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          {t('analyze_another')}
        </button>
      )}


    </div>
  );
}

/* ResultCard, generateCoachingInsight, generateProgressionNote moved to ./ResultCard.jsx */

