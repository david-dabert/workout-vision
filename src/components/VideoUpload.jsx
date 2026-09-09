import { useState, useRef, useCallback, useEffect } from 'react';
import { disposeAllLandmarkers } from '../lib/poseAnalysis';
import { EXERCISES, EXERCISE_GROUPS, getExerciseIllustration, getExerciseTier } from '../lib/exercises';
import { useProfile } from '../lib/ProfileContext';
import { useT } from '../lib/LanguageContext';
import { INJURY_MAP, INJURY_LABELS, loadInjuries, saveInjuries } from '../lib/injuries';
import { VideoSuitabilityDetector } from '../lib/videoSuitability';
import { AnalysisDiagnostics } from '../lib/analysisDiagnostics';
import { detectViewpointFromFrames } from '../lib/cameraViewpoint';
import VideoReplay from './VideoReplay';
import ResultCard from './ResultCard';
import CameraPrivacyModal, { usePrivacyGate } from './CameraPrivacyModal';
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
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const abortRef = useRef(false);
  const blobUrlRef = useRef(null);
  const audioFeedbackRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(false);

  useEffect(() => {
    // Pre-initialize worker in background (model downloads while user picks video)
    if (workerSupported) initWorker().catch(() => {});
    return () => {
      abortRef.current = true;
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

  const analyzeVideo = useCallback(async (queueItem) => {
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
        if (phase === 'extracting') setLiveReps(0);
      },
      onLiveReps: (reps) => setLiveReps(reps),
      onExerciseDetected: (ex) => setExercise(ex),
      onSuitability: (assessment) => setSuitabilityAssessment(assessment),
    });

    if (!result) {
      setErrorMsg(`${t('no_poses')} ${queueItem.name}. ${t('try_different')}`);
      return null;
    }

    setDebugInfo(result.debug);
    setFfmpegStatus('');

    // Create blob URL for replay
    const url = URL.createObjectURL(queueItem.file);
    blobUrlRef.current = url;

    return { ...result, videoUrl: url };
  }, [exercise, autoDetect, weight, userInjuries, userProfile, workerReady, workerSupported, initWorker, detectFrame, resetWorker]);

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

      {queue.length === 0 && results.length === 0 && (
        <div style={{
          padding: '10px 14px', marginBottom: 12, borderRadius: 10,
          background: 'rgba(0,224,255,0.04)', border: '1px solid rgba(0,224,255,0.1)',
        }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            📐 {t('filming_tip')}
          </p>
        </div>
      )}

      {iosWarning && (
        <div style={{
          padding: '10px 14px', marginBottom: 12, borderRadius: 10,
          background: 'rgba(255,170,0,0.08)', border: '1px solid rgba(255,170,0,0.2)',
        }}>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,200,100,0.9)', margin: 0, lineHeight: 1.5 }}>
            {iosWarning}
          </p>
        </div>
      )}

      <div
        className={`upload-zone${dragOver ? ' dragover' : ''}`}
        onClick={() => fileInputRef.current?.click()}
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
            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <input
                type="number"
                value={weight}
                onChange={(e) => { setWeight(e.target.value); weightRef.current = e.target.value; }}
                placeholder="kg"
                style={{ width: 64, padding: '10px 8px', fontSize: '0.82rem', textAlign: 'center' }}
              />
              <button
                className={`btn btn-ghost btn-sm ${audioEnabled ? 'active' : ''}`}
                style={{
                  padding: '10px 12px', fontSize: '1.1rem',
                  opacity: audioEnabled ? 1 : 0.4,
                  background: audioEnabled ? 'rgba(0,245,212,0.15)' : 'transparent',
                  borderRadius: 8,
                }}
                onClick={() => setAudioEnabled(prev => !prev)}
                title={audioEnabled ? 'Audio feedback ON' : 'Audio feedback OFF'}
              >
                {audioEnabled ? '\u{1F50A}' : '\u{1F507}'}
              </button>
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
          <div className="analysis-progress-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {currentFile}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => { abortRef.current = true; }}>{t('stop')}</button>
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
                  <div key={phase.key} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                    opacity: isDone ? 0.4 : isActive ? 1 : 0.25,
                    transition: 'opacity 0.3s ease',
                  }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                      background: isDone ? 'var(--bio-cyan)' : isActive ? 'rgba(0,224,255,0.2)' : 'rgba(255,255,255,0.05)',
                      color: isDone ? 'var(--void)' : isActive ? 'var(--bio-cyan)' : 'var(--text-secondary)',
                      border: isActive ? '1.5px solid var(--bio-cyan)' : '1.5px solid transparent',
                    }}>
                      {isDone ? '\u2713' : i + 1}
                    </span>
                    <span style={{
                      fontSize: '0.78rem', fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}>
                      {phase.label}
                    </span>
                    {isActive && <div className="spinner-sm" style={{ width: 14, height: 14, marginLeft: 'auto' }} />}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: `${progress}%`, height: '100%', background: 'var(--bio-cyan)',
                  borderRadius: 2, transition: 'width 0.15s linear',
                }} />
              </div>
              {ffmpegStatus && (
                <span style={{ display: 'block', fontSize: '0.68rem', color: 'var(--muted)', marginTop: 4 }}>
                  {ffmpegStatus}
                </span>
              )}
            </div>
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
          <div style={{ marginTop: 8, padding: '0 4px' }}>
            {suitabilityAssessment && suitabilityAssessment.suitable !== 'good' && (
              <VideoSuitabilityBanner assessment={suitabilityAssessment} compact />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: 'var(--bio-cyan)', fontSize: 20, fontWeight: 800 }}>{liveReps} {t('reps').toLowerCase()}</span>
              <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--bio-cyan)',
                  borderRadius: 2, transition: 'width 0.1s linear' }} />
              </div>
              <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>{progress}%</span>
            </div>
          </div>
        )}
      </div>

      {results.map((r, idx) => (
        <ResultCard key={idx} result={r} onReplay={() => setReplayResult(r)} />
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

