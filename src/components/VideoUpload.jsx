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
import { getWorkoutCount } from '../lib/storage';
import { trackEvent, trackTiming, trackAnalysis } from '../lib/telemetry';
import ExercisePicker, { AutoLockBadge } from './ExercisePicker';
import ExerciseSelector from './ExerciseSelector';

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

const LIVE_CAMERA_ENABLED = false; // Returns in Step 3b after the route works.

export default function VideoUpload({ onClose, onLiveMode, preSelectedExercise }) {
  const { t, tExercise, tFormCheck, lang, setLang } = useT();
  const { profile: userProfile } = useProfile();
  const { accepted: privacyAccepted, accept: acceptPrivacy, showModal: showPrivacyModal } = usePrivacyGate();
  const { isReady: workerReady, isSupported: workerSupported, initWorker, detectFrame, resetWorker, reinitWorker, disposeWorker } = usePoseWorker();
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

  // Check if this is a first-time user (0 workouts) to show demo button
  useEffect(() => {
    getWorkoutCount().then(count => {
      if (count === 0) setIsFirstTime(true);
    }).catch(() => {});
  }, []);
  const [errorMsg, setErrorMsg] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null); // { videoHash, frameCount, landmarkHash }
  const [dragOver, setDragOver] = useState(false);
  const [ffmpegStatus, setFfmpegStatus] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [suitabilityAssessment, setSuitabilityAssessment] = useState(null);
  const [progressiveDetection, setProgressiveDetection] = useState(null);
  const [cancelled, setCancelled] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const abortControllerRef = useRef(null);
  const blobUrlRef = useRef(null);
  const audioFeedbackRef = useRef(null);
  const detectorRef = useRef(null);
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
  const [crashRecoveryMsg, setCrashRecoveryMsg] = useState(null);

  // On mount, check for breadcrumb from a previous crashed analysis
  useEffect(() => {
    try {
      const raw = localStorage.getItem('wv_analysis_stage');
      if (raw) {
        const breadcrumb = JSON.parse(raw);
        // Only show if the breadcrumb is less than 10 minutes old
        if (breadcrumb.ts && Date.now() - breadcrumb.ts < 10 * 60 * 1000) {
          setCrashRecoveryMsg(t('crash_recovery', { file: breadcrumb.file || '?' }));
        }
        localStorage.removeItem('wv_analysis_stage');
      }
    } catch {}
  }, []);

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
    const stopTiming = trackTiming('analysis', { fileName: queueItem.name });

    // Breadcrumb: write analysis stage to localStorage so we can detect crashes
    try { localStorage.setItem('wv_analysis_stage', JSON.stringify({ file: queueItem.name, stage: 'started', ts: Date.now() })); } catch {}

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
        reinit: reinitWorker,
      },
      onProgress: (pct) => {
        setProgress(pct);
        setFfmpegStatus(pct < 95 ? `${t('phase_analyzing')}... ${pct}%` : '');
        setQueue(prev => prev.map(q =>
          q.id === queueItem.id ? { ...q, progress: pct } : q
        ));
      },
      onPhase: (phase) => {
        setAnalysisPhase(phase);
        const labelKeys = { hashing: 'phase_hashing_desc', model: 'phase_model_desc', extracting: 'phase_extracting_desc', analyzing: 'phase_analyzing_desc' };
        setFfmpegStatus(t(labelKeys[phase]) || '');
        if (phase === 'extracting') { setLiveReps(0); setProgressiveDetection(null); detectorRef.current = null; }
      },
      onLiveReps: (reps) => setLiveReps(reps),
      onExerciseDetected: (ex) => setExercise(ex),
      onSuitability: (assessment) => setSuitabilityAssessment(assessment),
      onProgressiveUpdate: (update) => setProgressiveDetection(update),
      signal,
      gymMode: userProfile?.gymMode || 'gym',
      detectorRef,
    });

    stopTiming();

    // Clear breadcrumb on completion (success or handled error)
    try { localStorage.removeItem('wv_analysis_stage'); } catch {}

    if (!result) {
      trackEvent('analysis_failed', { fileName: queueItem.name });
      setErrorMsg(`${t('no_poses')} ${queueItem.name}. ${t('try_different')}`);
      return { _failed: true, errorReason: 'No result returned' };
    }

    if (result.error === 'video_too_long') {
      trackEvent('analysis_failed', { fileName: queueItem.name, reason: 'video_too_long' });
      setErrorMsg(t('video_too_long', { duration: result.duration, max: result.maxDuration }));
      return { _failed: true, errorReason: 'video_too_long' };
    }

    if (result.error === 'analysis_timeout') {
      trackEvent('analysis_failed', { fileName: queueItem.name, reason: 'analysis_timeout' });
      setErrorMsg(t('analysis_timeout', { seconds: result.elapsed }));
      return { _failed: true, errorReason: 'analysis_timeout' };
    }

    if (result.error) {
      trackEvent('analysis_failed', { fileName: queueItem.name, reason: result.errorReason });
      setErrorMsg(result.errorReason || `Analysis failed. ${t('try_different')}`);
      return { _failed: true, errorReason: result.errorReason };
    }

    trackAnalysis(result);

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

    let videoIndex = 0;
    for (const item of pending) {
      if (controller.signal.aborted) break;

      // On iOS, pause between sequential videos to let the browser
      // release GPU memory and run garbage collection.
      if (IS_IOS && videoIndex > 0) {
        await new Promise(r => setTimeout(r, 1500));
      }
      videoIndex++;

      // Release previous blob URL before starting next analysis
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }

      setCurrentFile(item.name);
      setProgress(0);
      setQueue(prev => prev.map(q =>
        q.id === item.id ? { ...q, status: 'analyzing' } : q
      ));

      try {
        const result = await analyzeVideo(item, controller.signal);

        if (result?._failed) {
          setQueue(prev => prev.map(q =>
            q.id === item.id ? { ...q, status: 'error', progress: 0, errorReason: result.errorReason } : q
          ));
        } else if (result && !result.aborted) {
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
          q.id === item.id ? { ...q, status: 'error', progress: 0, errorReason: err.message || 'Unknown error' } : q
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

  const loadDemo = useCallback(async () => {
    setDemoLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/demo-result.json`);
      const demo = await res.json();
      setResults([demo]);
      setIsFirstTime(false);
    } catch (err) {
      console.error('[VideoUpload] Failed to load demo:', err);
      setErrorMsg('Failed to load demo data.');
    }
    setDemoLoading(false);
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
        coaching={replayResult.coaching}
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
            {t('filming_tip')}
          </p>
        </div>
      )}

      {crashRecoveryMsg && (
        <div className={s.iosWarningBanner} role="alert">
          <p className={s.iosWarningText}>{crashRecoveryMsg}</p>
          <button onClick={() => setCrashRecoveryMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '4px 8px' }}>✕</button>
        </div>
      )}

      {isFirstTime && queue.length === 0 && results.length === 0 && !analyzing && (
        <button
          className={`btn btn-ghost ${s.demoButton}`}
          onClick={loadDemo}
          disabled={demoLoading}
        >
          <span className={s.demoButtonText}>{t('try_demo')}</span>
          <span className={s.demoButtonDesc}>{t('demo_description')}</span>
        </button>
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

      {/* Live camera mode toggle */}
      {LIVE_CAMERA_ENABLED && onLiveMode && (
        <button
          className="btn btn-ghost"
          onClick={onLiveMode}
          style={{
            width: '100%', marginBottom: 12, minHeight: 44,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            border: '1px solid var(--border)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          {t('live_mode') || 'Live Camera Mode'}
        </button>
      )}

      {cancelled && !analyzing && (
        <div className={s.cancelledBanner}>
          <p className={s.cancelledText}>
            {t('analysis_cancelled')} {hasCancelled ? t('press_resume') : t('partial_results')}
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
                    {t('cancelled')}
                  </span>
                )}
                {q.status === 'error' && (
                  <span className={s.statusError}>
                    {q.errorReason || t('failed_try_different')}
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
              <ExerciseSelector
                value={exercise}
                onChange={(val) => {
                  setExercise(val);
                  if (val === '__auto__') {
                    setAutoDetect(true);
                    userChangedExercise.current = false;
                  } else {
                    setAutoDetect(false);
                    userChangedExercise.current = true;
                  }
                }}
                showAuto
              />
            </div>
            <div className={s.weightRow}>
              <input
                type="number"
                value={weight}
                onChange={(e) => { setWeight(e.target.value); weightRef.current = e.target.value; }}
                placeholder={t('placeholder_kg')}
                aria-label={t('weight_label')}
                className={s.weightInput}
              />
              <button
                className={`btn btn-ghost btn-sm ${audioEnabled ? 'active' : ''} ${s.audioToggle}`}
                style={{
                  opacity: audioEnabled ? 1 : 0.4,
                  background: audioEnabled ? 'rgba(212,167,106,0.15)' : 'transparent',
                }}
                onClick={() => setAudioEnabled(prev => !prev)}
                title={audioEnabled ? t('audio_on') : t('audio_off')}
              >
                {audioEnabled ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                )}
              </button>
              {hasCancelled && !hasQueued ? (
                <button
                  className={`btn btn-primary ${s.flexGrow}`}
                  onClick={() => { resumeAnalysis(); }}
                >
                  {t('resume')}
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
                    {isActive && (
                      <div className={`ai-orb ${s.phaseSpinner}`} style={{ width: 16, height: 16 }}>
                        <span />
                        <div className="ai-orb-ring" />
                      </div>
                    )}
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
            {progressiveDetection && !progressiveDetection.locked && progressiveDetection.candidates?.length > 0 && (
              <ExercisePicker
                detectorState={progressiveDetection}
                temporalFeatures={progressiveDetection?.temporalFeatures}
                onSelect={(exId) => {
                  if (detectorRef.current) {
                    detectorRef.current.lock(exId);
                    setProgressiveDetection(detectorRef.current.state);
                    setExercise(exId);
                  }
                }}
                compact
              />
            )}
            {progressiveDetection && progressiveDetection.locked && progressiveDetection.exercise && (
              <AutoLockBadge
                exercise={progressiveDetection.exercise}
                confidence={progressiveDetection.confidence}
                onUnlock={() => {
                  if (detectorRef.current) {
                    detectorRef.current.reset();
                    setProgressiveDetection(detectorRef.current.state);
                  }
                }}
              />
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
          {r.isDemo && (
            <div className={s.demoBadge}>{t('demo_badge')}</div>
          )}
          <ResultCard result={r} onReplay={() => setReplayResult(r)} />
          {!r.isDemo && <FeedbackPanel result={r} />}
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

