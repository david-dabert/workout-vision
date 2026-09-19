import { useState, useRef, useCallback, useEffect } from 'react';
import { useT } from '../lib/LanguageContext';
import usePoseWorker from '../lib/usePoseWorker';
import { HierarchicalDetector } from '../lib/hierarchicalDetector';
import { detectViewpoint } from '../lib/cameraViewpoint';
import { EXERCISES } from '../lib/exercises';
import ExercisePicker, { AutoLockBadge } from './ExercisePicker';

// Dynamically import RepCounter (TypeScript module)
let _RepCounter = null;
const getRepCounter = async () => {
  if (!_RepCounter) {
    const mod = await import('../lib/repCounter/index.ts');
    _RepCounter = mod.RepCounter;
  }
  return _RepCounter;
};

const CAPTURE_FPS = 15; // inference budget — balance accuracy vs battery
const FRAME_INTERVAL = 1000 / CAPTURE_FPS;
// Re-detect viewpoint every N frames (cheap but no need every frame)
const VIEWPOINT_INTERVAL = 30;

export default function LiveCapture({ onClose, profile }) {
  const { t, tExercise } = useT();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const frameIndexRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const repCounterRef = useRef(null);
  const detectorRef = useRef(null);
  const activeRef = useRef(false);
  const exerciseRef = useRef(null);
  const viewpointRef = useRef('unknown');

  const { isReady, isSupported, initWorker, detectFrame, resetWorker, disposeWorker } = usePoseWorker();

  const [status, setStatus] = useState('idle'); // idle | requesting | loading | ready | running | error
  const [error, setError] = useState(null);
  const [reps, setReps] = useState(0);
  const [exercise, setExercise] = useState(null);
  const [detectorState, setDetectorState] = useState(null);
  const [phase, setPhase] = useState('setup');
  const [formFeedback, setFormFeedback] = useState([]);
  const [inferenceMs, setInferenceMs] = useState(0);
  const [facingMode, setFacingMode] = useState('user');
  const [repBurst, setRepBurst] = useState(false);
  const prevRepsRef = useRef(0);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      disposeWorker();
    };
  }, [disposeWorker]);

  const startCamera = useCallback(async () => {
    setStatus('requesting');
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      // Stop any previous stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      streamRef.current = stream;

      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      // Init canvas to match video dimensions
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      // Init worker
      setStatus('loading');
      if (isSupported) {
        await initWorker();
      }

      // Init hierarchical detector (same as video mode)
      detectorRef.current = new HierarchicalDetector({ fps: CAPTURE_FPS });

      setStatus('ready');
    } catch (err) {
      console.error('[LiveCapture] Camera error:', err);
      setError(err.name === 'NotAllowedError' ? t('camera_denied') || 'Camera access denied' : err.message);
      setStatus('error');
    }
  }, [facingMode, isSupported, initWorker, t]);

  const startSession = useCallback(async () => {
    if (status !== 'ready' || !isReady) return;

    // Don't create RepCounter yet — wait for the detector to identify
    // the exercise first. This prevents wrong form checks from firing
    // against a hardcoded default exercise.
    repCounterRef.current = null;

    setReps(0);
    setExercise(null);
    setDetectorState(null);
    setPhase('setup');
    setFormFeedback([]);
    frameIndexRef.current = 0;
    lastFrameTimeRef.current = 0;
    prevRepsRef.current = 0;
    exerciseRef.current = null;
    viewpointRef.current = 'unknown';
    activeRef.current = true;
    setStatus('running');

    // Reset detector for fresh session
    if (detectorRef.current) {
      detectorRef.current.reset();
    }

    // Start the frame loop
    processFrame();
  }, [status, isReady, profile]);

  // Create or switch RepCounter for a given exercise
  const initCounterForExercise = useCallback(async (exerciseKey) => {
    const RC = await getRepCounter();
    const counter = new RC(exerciseKey, {
      mode: 'live',
      fps: CAPTURE_FPS,
      userInjuries: profile?.injuries,
      weightKg: profile?.weight,
    });
    counter.setViewpoint(viewpointRef.current);
    repCounterRef.current = counter;
    exerciseRef.current = exerciseKey;
    setExercise(exerciseKey);
    setReps(0);
    prevRepsRef.current = 0;
    setPhase('setup');
    setFormFeedback([]);
  }, [profile]);

  // Handle user exercise selection from ExercisePicker chips
  const handleExerciseSelect = useCallback((exerciseKey) => {
    const detector = detectorRef.current;
    if (detector) {
      detector.lock(exerciseKey);
      setDetectorState({ ...detector.state });
    }
    initCounterForExercise(exerciseKey);
  }, [initCounterForExercise]);

  // Handle unlock from AutoLockBadge
  const handleUnlock = useCallback(() => {
    const detector = detectorRef.current;
    if (detector) {
      detector.reset();
      setDetectorState({ ...detector.state });
    }
    // Keep current counter running — detector will re-identify
  }, []);

  const processFrame = useCallback(() => {
    if (!activeRef.current) return;

    const now = performance.now();
    if (now - lastFrameTimeRef.current < FRAME_INTERVAL) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }
    lastFrameTimeRef.current = now;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Draw current frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const frameIndex = frameIndexRef.current++;
    const timestamp = frameIndex * FRAME_INTERVAL; // deterministic for MediaPipe VIDEO mode

    // Run inference (async, non-blocking)
    detectFrame(canvas, timestamp, frameIndex).then(result => {
      if (!activeRef.current || !result?.landmarks) return;

      // Periodic viewpoint detection — updates form check filtering
      if (frameIndex % VIEWPOINT_INTERVAL === 0) {
        const vp = detectViewpoint(result.landmarks);
        viewpointRef.current = vp.angle;
        if (repCounterRef.current) {
          repCounterRef.current.setViewpoint(vp.angle);
        }
      }

      // Exercise detection via HierarchicalDetector
      const detector = detectorRef.current;
      if (detector) {
        const state = detector.update({
          landmarks: result.landmarks,
          timestampMs: timestamp,
        });
        setDetectorState({ ...state });

        // When the detected exercise changes, switch the counter
        if (state.exercise && state.exercise !== exerciseRef.current) {
          initCounterForExercise(state.exercise);
        }
      }

      // Update rep counter (only if one exists — before detection, it's null)
      const counter = repCounterRef.current;
      if (counter) {
        const repResult = counter.update(result.landmarks, timestamp);
        if (repResult) {
          // Trigger rep burst when count increases — the number doesn't just change, it HITS
          if (repResult.reps > prevRepsRef.current) {
            prevRepsRef.current = repResult.reps;
            setRepBurst(true);
            setTimeout(() => setRepBurst(false), 600);
          }
          setReps(repResult.reps);
          setPhase(repResult.phase || 'setup');
          if (repResult.formFeedback?.length) {
            // Only show failed checks — passed checks are noise in the overlay
            const failed = repResult.formFeedback.filter(fb => !fb.passed);
            setFormFeedback(failed.slice(0, 3));
          } else {
            setFormFeedback([]);
          }
        }
      }

      setInferenceMs(result.inferenceMs || 0);

      // Draw skeleton overlay
      drawSkeleton(result.landmarks);
    });

    rafRef.current = requestAnimationFrame(processFrame);
  }, [detectFrame, profile, initCounterForExercise]);

  const drawSkeleton = useCallback((landmarks) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    const w = overlay.width;
    const h = overlay.height;
    ctx.clearRect(0, 0, w, h);

    // Connection pairs for pose skeleton
    const connections = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
      [11, 23], [12, 24], [23, 24], [23, 25], [24, 26],
      [25, 27], [26, 28],
    ];

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
    ctx.lineWidth = 2;

    for (const [a, b] of connections) {
      const la = landmarks[a];
      const lb = landmarks[b];
      if (!la || !lb || (la.visibility || 0) < 0.5 || (lb.visibility || 0) < 0.5) continue;
      ctx.beginPath();
      // Mirror x for front-facing camera
      ctx.moveTo((1 - la.x) * w, la.y * h);
      ctx.lineTo((1 - lb.x) * w, lb.y * h);
      ctx.stroke();
    }

    // Draw joint dots
    ctx.fillStyle = 'rgba(0, 240, 255, 0.9)';
    for (let i = 11; i <= 28; i++) {
      const lm = landmarks[i];
      if (!lm || (lm.visibility || 0) < 0.5) continue;
      ctx.beginPath();
      ctx.arc((1 - lm.x) * w, lm.y * h, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  const stopSession = useCallback(() => {
    activeRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setStatus('ready');
  }, []);

  const flipCamera = useCallback(() => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    // Restart camera with new facing mode
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setStatus('idle');
  }, [facingMode]);

  const handleClose = useCallback(() => {
    activeRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    resetWorker();
    onClose();
  }, [onClose, resetWorker]);

  // Phase color mapping
  const phaseColor = {
    setup: 'var(--text-tertiary)',
    eccentric: 'var(--yellow)',
    isometric: 'var(--aurora-violet)',
    concentric: 'var(--bio-cyan)',
    lockout: 'var(--bio-green)',
  }[phase] || 'var(--text-tertiary)';

  return (
    <div className="page page-full" style={{ background: 'var(--void)', position: 'relative', overflow: 'hidden' }}>
      {/* Video + overlay stack */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#000' }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
          }}
        />
        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
        />
        <canvas
          ref={overlayRef}
          width={640}
          height={480}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none',
          }}
        />

        {/* Top bar: close + flip + fps */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
        }}>
          <button
            onClick={handleClose}
            className="btn btn-ghost btn-sm"
            aria-label={t('close')}
            style={{ color: '#fff', minWidth: 44, minHeight: 44 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          {status === 'running' && (
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>
              {inferenceMs}ms
            </span>
          )}
          <button
            onClick={flipCamera}
            className="btn btn-ghost btn-sm"
            aria-label={t('flip_camera') || 'Flip camera'}
            style={{ color: '#fff', minWidth: 44, minHeight: 44 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M11 19H4a2 2 0 01-2-2V7a2 2 0 012-2h5" />
              <path d="M13 5h7a2 2 0 012 2v10a2 2 0 01-2 2h-5" />
              <polyline points="16 3 19 6 16 9" />
              <polyline points="8 15 5 18 8 21" />
            </svg>
          </button>
        </div>

        {/* Phase environment glow — the whole frame responds to movement phase */}
        {status === 'running' && (
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse 120% 80% at 50% 100%, ${phaseColor}22 0%, transparent 60%)`,
            pointerEvents: 'none',
            transition: 'background 0.4s ease',
            opacity: phase === 'setup' ? 0 : 1,
          }} />
        )}

        {/* Exercise detection chips — same UX as video mode */}
        {status === 'running' && detectorState && !detectorState.locked && detectorState.candidates?.length > 0 && (
          <div style={{
            position: 'absolute', top: 60, left: 0, right: 0,
            display: 'flex', justifyContent: 'center',
            pointerEvents: 'auto',
          }}>
            <ExercisePicker
              detectorState={detectorState}
              temporalFeatures={detectorState?.temporalFeatures}
              onSelect={handleExerciseSelect}
              compact
            />
          </div>
        )}

        {/* Auto-lock badge — shows locked exercise with unlock option */}
        {status === 'running' && detectorState?.locked && detectorState.exercise && (
          <div style={{
            position: 'absolute', top: 60, left: 0, right: 0,
            display: 'flex', justifyContent: 'center',
            pointerEvents: 'auto',
          }}>
            <AutoLockBadge
              exercise={detectorState.exercise}
              confidence={detectorState.confidence}
              onUnlock={handleUnlock}
            />
          </div>
        )}

        {/* Rep counter overlay (bottom of video) */}
        {status === 'running' && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
            padding: '40px 20px 20px',
            paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          }}>
            {/* Rep count — the number doesn't just change, it HITS */}
            <div style={{ textAlign: 'center' }}>
              <div aria-live="polite" style={{
                fontSize: '3.5rem', fontWeight: 900, color: '#fff',
                fontFamily: 'var(--font-display)',
                lineHeight: 1,
                textShadow: `0 0 30px ${phaseColor}, 0 0 60px ${phaseColor}44`,
                animation: repBurst ? 'repBurst 0.6s cubic-bezier(0.16, 1, 0.3, 1) 1' : 'none',
              }}>
                {reps}
              </div>
              <div style={{
                fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: phaseColor,
                marginTop: 4,
                transition: 'color 0.3s ease',
              }}>
                {phase}
              </div>
            </div>

            {/* Exercise + form feedback */}
            <div style={{ textAlign: 'right', maxWidth: '60%' }}>
              {exercise && (
                <div style={{
                  fontSize: '0.85rem', fontWeight: 700, color: '#fff',
                  marginBottom: 6,
                }}>
                  {tExercise(exercise, EXERCISES[exercise]?.name)}
                </div>
              )}
              {formFeedback.map((fb, i) => (
                <div key={i} style={{
                  fontSize: '0.72rem', color: fb.severity === 'major' ? 'var(--red)' : 'var(--yellow)',
                  marginBottom: 2,
                }}>
                  {fb.text || fb.bad || fb.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls below video */}
      <div style={{
        padding: '20px 16px',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {status === 'idle' && (
          <button className="btn btn-primary" onClick={startCamera} style={{ minHeight: 48 }}>
            {t('start_camera') || 'Start Camera'}
          </button>
        )}

        {status === 'requesting' && (
          <p className="text-sm text-muted" style={{ textAlign: 'center' }}>
            {t('requesting_camera') || 'Requesting camera access...'}
          </p>
        )}

        {status === 'loading' && (
          <p className="text-sm text-muted" style={{ textAlign: 'center' }}>
            {t('loading_model') || 'Loading pose detection model...'}
          </p>
        )}

        {status === 'ready' && (
          <button className="btn btn-primary btn-heartbeat" onClick={startSession} style={{ minHeight: 48 }}>
            {t('start_workout') || 'Start Workout'}
          </button>
        )}

        {status === 'running' && (
          <button className="btn btn-ghost" onClick={stopSession} style={{ minHeight: 48 }}>
            {t('stop') || 'Stop'}
          </button>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 12 }}>{error}</p>
            <button className="btn btn-primary" onClick={startCamera} style={{ minHeight: 48 }}>
              {t('retry')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
