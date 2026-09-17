import { useState, useRef, useCallback, useEffect } from 'react';
import { useT } from '../lib/LanguageContext';
import usePoseWorker from '../lib/usePoseWorker';
import { ExerciseAutoDetector } from '../lib/exerciseDetector';
import { EXERCISES } from '../lib/exercises';

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

  const { isReady, isSupported, initWorker, detectFrame, resetWorker, disposeWorker } = usePoseWorker();

  const [status, setStatus] = useState('idle'); // idle | requesting | loading | ready | running | error
  const [error, setError] = useState(null);
  const [reps, setReps] = useState(0);
  const [exercise, setExercise] = useState(null);
  const [exerciseConfidence, setExerciseConfidence] = useState(0);
  const [phase, setPhase] = useState('setup');
  const [formFeedback, setFormFeedback] = useState([]);
  const [inferenceMs, setInferenceMs] = useState(0);
  const [facingMode, setFacingMode] = useState('user');

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

      // Init exercise detector
      detectorRef.current = new ExerciseAutoDetector({ fps: CAPTURE_FPS });

      setStatus('ready');
    } catch (err) {
      console.error('[LiveCapture] Camera error:', err);
      setError(err.name === 'NotAllowedError' ? t('camera_denied') || 'Camera access denied' : err.message);
      setStatus('error');
    }
  }, [facingMode, isSupported, initWorker, t]);

  const startSession = useCallback(async () => {
    if (status !== 'ready' || !isReady) return;

    const RC = await getRepCounter();
    repCounterRef.current = new RC('squat', {
      mode: 'live',
      fps: CAPTURE_FPS,
      userInjuries: profile?.injuries,
      weightKg: profile?.weight,
    });

    setReps(0);
    setExercise(null);
    setPhase('setup');
    setFormFeedback([]);
    frameIndexRef.current = 0;
    lastFrameTimeRef.current = 0;
    activeRef.current = true;
    setStatus('running');

    // Start the frame loop
    processFrame();
  }, [status, isReady, profile]);

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

      // Exercise auto-detection
      const detector = detectorRef.current;
      if (detector) {
        const detected = detector.update(result.landmarks);
        if (detected) {
          const info = detector.getDetectionInfo();
          setExerciseConfidence(info.confidence);

          // Switch rep counter when exercise changes
          if (detected !== exerciseRef.current) {
            exerciseRef.current = detected;
            setExercise(detected);
            getRepCounter().then(RC => {
              repCounterRef.current = new RC(detected, {
                mode: 'live',
                fps: CAPTURE_FPS,
                userInjuries: profile?.injuries,
                weightKg: profile?.weight,
              });
              setReps(0);
              setPhase('setup');
            });
          }
        }
      }

      // Update rep counter
      const counter = repCounterRef.current;
      if (counter) {
        const repResult = counter.update(result.landmarks, timestamp);
        if (repResult) {
          setReps(repResult.reps);
          setPhase(repResult.phase || 'setup');
          if (repResult.formFeedback?.length) {
            setFormFeedback(repResult.formFeedback.slice(0, 3));
          }
        }
      }

      setInferenceMs(result.inferenceMs || 0);

      // Draw skeleton overlay
      drawSkeleton(result.landmarks);
    });

    rafRef.current = requestAnimationFrame(processFrame);
  }, [detectFrame, profile]);

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

        {/* Rep counter overlay (bottom of video) */}
        {status === 'running' && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
            padding: '40px 20px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
          }}>
            {/* Rep count */}
            <div style={{ textAlign: 'center' }}>
              <div aria-live="polite" style={{
                fontSize: '3.5rem', fontWeight: 900, color: '#fff',
                fontFamily: 'var(--font-display)',
                lineHeight: 1,
                textShadow: `0 0 30px ${phaseColor}`,
              }}>
                {reps}
              </div>
              <div style={{
                fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: phaseColor,
                marginTop: 4,
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
                  {exerciseConfidence < 0.7 && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--yellow)', marginLeft: 6 }}>?</span>
                  )}
                </div>
              )}
              {formFeedback.map((fb, i) => (
                <div key={i} style={{
                  fontSize: '0.72rem', color: fb.severity === 'major' ? 'var(--red)' : 'var(--yellow)',
                  marginBottom: 2,
                }}>
                  {fb.bad || fb.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Controls below video */}
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
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
          <button className="btn btn-primary" onClick={startSession} style={{ minHeight: 48 }}>
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
