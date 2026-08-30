import { useState, useEffect, useRef, useCallback } from 'react';
import { loadModelWithRetry, detectPoseVideo, drawPose, drawOverlayMessage, resetTimestamp, disposeAllLandmarkers, selectSubjectPose } from '../lib/poseAnalysis';
import { initCamera as initCameraUtil, stopCamera } from '../lib/camera';
import { logEvent } from '../lib/telemetry';
import { EXERCISES, EXERCISE_GROUPS } from '../lib/exercises';
import { RepCounter } from '../lib/repCounter';
import { ExerciseAutoDetector } from '../lib/exerciseDetector';
import { saveWorkout } from '../lib/storage';
import { useProfile } from '../lib/ProfileContext';
import { repCompleteSound, setCompleteSound, warmUpAudio } from '../lib/audio';
import { sonicEngine } from '../lib/SonicEngine';
import { estimateCaloriesBurned } from '../lib/nutrition';
import { useT, tModule } from '../lib/LanguageContext';

const TARGET_FPS = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 15 : 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;
const REST_PRESETS = [30, 60, 90, 120, 180];

// Voice coaching via Web Speech API — uses session-locked language
const prefersReducedMotion = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function speak(text, lang) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'fr' ? 'fr-FR' : 'en-US';
  u.rate = prefersReducedMotion ? 0.9 : 1.1;
  u.pitch = prefersReducedMotion ? 1.0 : 0.9;
  u.volume = 0.8;
  speechSynthesis.speak(u);
}

export default function LiveCamera({ onClose }) {
  const { t, tExercise, lang } = useT();
  const { profile: userProfile } = useProfile();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const repCounterRef = useRef(null);
  const autoDetectorRef = useRef(null);
  const streamRef = useRef(null);
  const startTimeRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const lastVoiceCueRef = useRef(0);
  // Lock language at session mount — prevents bilingual voice cues mid-workout
  const sessionLangRef = useRef(lang);
  const aiLockOnFiredRef = useRef(false);
  const prevPhaseRef = useRef('');

  const [status, setStatus] = useState('loading');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const lastValidPoseRef = useRef(null);
  const confidenceDecayRef = useRef(1.0);
  const detectionNullFiredRef = useRef(false);
  const wakeLockRef = useRef(null);
  const fpsWindowRef = useRef([]);
  const slowFpsWarnedRef = useRef(false);
  const [exercise, setExercise] = useState('__auto__');
  const [weight, setWeight] = useState('');
  const [autoDetect, setAutoDetect] = useState(true);
  const [detectedName, setDetectedName] = useState('');
  const [voiceCoach, setVoiceCoach] = useState(false);
  const [recording, setRecording] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [reps, setReps] = useState(0);
  const [phase, setPhase] = useState('');
  const [angle, setAngle] = useState(0);
  const [feedback, setFeedback] = useState([]);
  const [repBars, setRepBars] = useState([]);
  const [bodyWeight, setBodyWeight] = useState(70);
  const [setCount, setSetCount] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [restDuration, setRestDuration] = useState(90);
  const [resting, setResting] = useState(false);
  const [totalCalories, setTotalCalories] = useState(0);
  const [liteMode, setLiteMode] = useState(false);
  const [slowBanner, setSlowBanner] = useState(false);
  const restIntervalRef = useRef(null);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (_) {}
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  const setupCamera = useCallback(async (facing) => {
    try {
      stopCamera(streamRef.current);
      const stream = await initCameraUtil(videoRef.current, facing);
      streamRef.current = stream;
      logEvent('camera_permission', { granted: true });
    } catch (err) {
      logEvent('camera_permission', { granted: false, error: err.code || err.message });
      throw err;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        // Step 1: Load model with progress and retry
        setLoadingMessage(t('downloading_model'));
        const startMs = performance.now();
        const lm = await loadModelWithRetry((progress, message) => {
          if (!cancelled) {
            setLoadingProgress(progress);
            setLoadingMessage(message);
          }
        });
        logEvent('model_load_success', { durationMs: Math.round(performance.now() - startMs) });
        if (cancelled) return;
        landmarkerRef.current = lm;
        autoDetectorRef.current = new ExerciseAutoDetector();
        if (userProfile?.weight) setBodyWeight(parseFloat(userProfile.weight) || 70);

        // Step 2: Init camera
        setLoadingMessage(t('starting_camera'));
        await setupCamera(facingMode);
        if (!cancelled) {
          setStatus('ready');
          lastFrameTimeRef.current = 0;
          rafRef.current = requestAnimationFrame(processFrame);
        }
      } catch (err) {
        console.error('Setup error:', err);
        if (!cancelled) {
          setErrorMessage(err.message || 'Camera or model failed to load.');
          setStatus('error');
        }
      }
    }

    setup();

    // iOS background tab recovery
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        const stream = streamRef.current;
        if (!stream || stream.getTracks().some(tr => tr.readyState === 'ended')) {
          try { await setupCamera(facingMode); } catch (_) {}
        } else if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        }
        // Re-acquire wake lock (iOS releases on background)
        if (wakeLockRef.current === null) requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopCamera(streamRef.current);
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
      releaseWakeLock();
      disposeAllLandmarkers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processFrame = useCallback((now) => {
    // Throttle to TARGET_FPS to prevent RAF queue buildup on slow devices
    if (now - lastFrameTimeRef.current < FRAME_INTERVAL) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }
    lastFrameTimeRef.current = now;

    // Three-tier slow device degradation
    fpsWindowRef.current.push(now);
    if (fpsWindowRef.current.length > 10) fpsWindowRef.current.shift();
    if (fpsWindowRef.current.length === 10) {
      const elapsed = fpsWindowRef.current[9] - fpsWindowRef.current[0];
      const effectiveFps = (9 / elapsed) * 1000;
      if (effectiveFps < 5 && !slowFpsWarnedRef.current) {
        // Tier 3: offer Manual Log fallback
        slowFpsWarnedRef.current = true;
        setSlowBanner(true);
        setLiteMode(true);
        logEvent('slow_inference', { fps: Math.round(effectiveFps), tier: 3 });
      } else if (effectiveFps < 10 && !liteMode && !slowFpsWarnedRef.current) {
        // Tier 2: lite mode (skip skeleton drawing, keep rep counting)
        setLiteMode(true);
        setSlowBanner(true);
        logEvent('slow_inference', { fps: Math.round(effectiveFps), tier: 2 });
      }
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !canvas || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Set canvas dimensions only when they change (avoids resetting context every frame)
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      // Re-cache context after dimension change (context state is reset on resize)
      ctxRef.current = canvas.getContext('2d');
    }
    if (!ctxRef.current) {
      ctxRef.current = canvas.getContext('2d');
    }
    const ctx = ctxRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const ts = performance.now();
    const result = detectPoseVideo(landmarker, video, ts);

    if (result && result.landmarks && result.landmarks.length > 0) {
      const landmarks = selectSubjectPose(result.landmarks);
      lastValidPoseRef.current = landmarks;
      confidenceDecayRef.current = 1.0;
      // AI lock-on sound: fires once when first skeleton is detected
      if (!aiLockOnFiredRef.current) {
        aiLockOnFiredRef.current = true;
        sonicEngine.aiLockOn();
      }
      // Lite mode: skip skeleton drawing to save GPU, keep rep counting
      if (!liteMode) {
        drawPose(ctx, landmarks, canvas.width, canvas.height, 1.0);
      }

      if (autoDetect && autoDetectorRef.current) {
        const detected = autoDetectorRef.current.update(landmarks);
        if (detected && detected !== exercise) {
          setExercise(detected);
          setDetectedName(EXERCISES[detected]?.name || detected);
          repCounterRef.current = new RepCounter(detected);
          setReps(0);
          setRepBars([]);
        }
      }

      if (repCounterRef.current) {
        const state = repCounterRef.current.update(landmarks);
        if (state) {
          setReps(state.reps);
          setPhase(state.phase || '');
          setAngle(Math.round(state.angle || 0));
          if (state.formFeedback) setFeedback(state.formFeedback);

          // Sonic: phase transition sounds
          if (state.phase && state.phase !== prevPhaseRef.current) {
            if (state.phase === 'concentric' || state.phase === 'up') {
              sonicEngine.concentricStart();
            } else if (state.phase === 'eccentric' || state.phase === 'down') {
              sonicEngine.eccentricStart();
            }
            prevPhaseRef.current = state.phase;
          }

          if (state.repCompleted && state.repHistory) {
            // Sonic: rep complete with escalating pitch
            sonicEngine.repComplete(state.reps);
            repCompleteSound(); // Keep legacy sound as fallback
            const latest = state.repHistory[state.repHistory.length - 1];
            setRepBars(prev => [...prev, latest?.score ?? null]);

            // Sonic: milestone every 5 reps
            if (state.reps > 0 && state.reps % 5 === 0) {
              sonicEngine.milestone(state.reps);
            }

            // Sonic: form quality feedback
            if (latest?.score != null) {
              if (latest.score >= 80) {
                sonicEngine.formGood();
              } else if (latest.score < 50) {
                sonicEngine.formWarning();
              }
            }

            if (voiceCoach) speak(`${state.reps}`, sessionLangRef.current);
          }

          // Voice coaching: announce form issues (throttled to once per 5s)
          if (voiceCoach && state.formFeedback && now - lastVoiceCueRef.current > 5000) {
            const issue = state.formFeedback.find(f => !f.passed);
            if (issue) {
              const txt = issue.key ? tModule(issue.key, issue) : issue.text;
              speak(txt, sessionLangRef.current);
              lastVoiceCueRef.current = now;
            }
          }
        }
      }
    } else if (lastValidPoseRef.current) {
      // No detection this frame — show ghost pose with decay
      confidenceDecayRef.current *= 0.95;
      if (confidenceDecayRef.current > 0.1) {
        drawPose(ctx, lastValidPoseRef.current, canvas.width, canvas.height, confidenceDecayRef.current);
      } else {
        drawOverlayMessage(ctx, t('move_into_frame'), t('no_pose_detected'));
        if (!detectionNullFiredRef.current) {
          detectionNullFiredRef.current = true;
          logEvent('detection_null', { timestamp: Date.now() });
        }
      }
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [exercise, autoDetect, t, liteMode]);

  const startSet = useCallback(() => {
    warmUpAudio();
    requestWakeLock();
    // If auto-detect already identified an exercise during passive mode, use it
    const activeExercise = exercise === '__auto__'
      ? (detectedName ? Object.keys(EXERCISES).find(k => EXERCISES[k].name === detectedName) || 'squat' : 'squat')
      : exercise;
    repCounterRef.current = new RepCounter(activeExercise);
    if (exercise === '__auto__') {
      // Don't reset auto-detector -- keep its accumulated vote history
      // so it can refine or change detection during the set
    }
    resetTimestamp();
    setReps(0);
    setPhase('');
    setAngle(0);
    setFeedback([]);
    setRepBars([]);
    setRecording(true);
    startTimeRef.current = Date.now();
    lastFrameTimeRef.current = 0;
    // RAF loop is already running from setup; no need to restart
  }, [exercise, detectedName, processFrame]);

  const startRestTimer = useCallback(() => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setResting(true);
    setRestTimer(restDuration);
    if (voiceCoach) speak(tModule('voice_rest', { seconds: restDuration }), sessionLangRef.current);
    restIntervalRef.current = setInterval(() => {
      setRestTimer(prev => {
        if (prev <= 1) {
          clearInterval(restIntervalRef.current);
          restIntervalRef.current = null;
          setResting(false);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          speak(tModule('voice_next_set'), sessionLangRef.current);
          return 0;
        }
        if (prev === 4) speak('3, 2, 1', sessionLangRef.current);
        return prev - 1;
      });
    }, 1000);
  }, [restDuration, voiceCoach]);

  const skipRest = useCallback(() => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setResting(false);
    setRestTimer(0);
  }, []);

  const stopSet = useCallback(async () => {
    setRecording(false);
    releaseWakeLock();
    // Do NOT cancel RAF here -- keep pose detection running for passive auto-detect
    // between sets. The processFrame callback checks `recording` state to decide
    // whether to count reps or just detect.

    const counter = repCounterRef.current;
    if (counter && reps > 0) {
      sonicEngine.setComplete();
      sonicEngine.resetSet();
      setCompleteSound();
      const duration = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : 0;
      const repHistory = counter.repHistory || [];
      const avgScore = repHistory.length > 0
        ? Math.round(repHistory.reduce((s, r) => s + (r.score || 0), 0) / repHistory.length)
        : 0;

      const w = parseFloat(weight) || 0;
      const savedExercise = exercise === '__auto__' ? (detectedName ? Object.keys(EXERCISES).find(k => EXERCISES[k].name === detectedName) || 'squat' : 'squat') : exercise;
      const cal = estimateCaloriesBurned(savedExercise, bodyWeight, duration);
      setTotalCalories(prev => prev + cal);
      setSetCount(prev => prev + 1);

      const workout = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        exercise: savedExercise,
        exerciseName: EXERCISES[savedExercise]?.name || savedExercise,
        reps,
        duration,
        formScore: avgScore,
        repHistory,
        weight: w,
        volume: w * reps,
        caloriesBurned: cal,
        source: 'live',
      };

      try {
        await saveWorkout(workout);
        logEvent('session_complete', { exercise: savedExercise, reps, source: 'live' });
        if (voiceCoach) {
          speak(tModule('voice_set_complete', { reps, score: avgScore, cal }), sessionLangRef.current);
        }
      } catch (err) {
        console.error('Failed to save workout:', err);
      }

      // Auto-start rest timer
      startRestTimer();
    }
  }, [exercise, reps, weight, bodyWeight, voiceCoach, startRestTimer]);

  const flipCamera = useCallback(async () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    await setupCamera(next);
  }, [facingMode, setupCamera]);

  const handleClose = () => {
    if (recording || setCount > 0) {
      if (!window.confirm(t('exit_session'))) return;
    }
    onClose();
  };

  const handleExerciseChange = (e) => {
    const key = e.target.value;
    if (key === '__auto__') {
      setExercise('__auto__');
      setAutoDetect(true);
      setDetectedName('');
      autoDetectorRef.current = new ExerciseAutoDetector();
    } else {
      setExercise(key);
      setAutoDetect(false);
      setDetectedName('');
      if (recording) {
        repCounterRef.current = new RepCounter(key);
        setReps(0);
        setRepBars([]);
      }
    }
  };

  return (
    <div className="live-page">
      <div className="cam-container">
        <video ref={videoRef} className="cam-video" playsInline muted />
        <canvas ref={canvasRef} className="cam-overlay" />

        {status === 'loading' && (
          <div className="cam-loading">
            <div style={{ width: '80%', maxWidth: 260, marginBottom: 12 }}>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ width: `${loadingProgress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s' }} />
              </div>
            </div>
            <p className="text-sm" style={{ textAlign: 'center' }}>{loadingMessage || t('init_camera')}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="cam-loading">
            <p style={{ color: 'var(--red)', marginBottom: 12, textAlign: 'center', padding: '0 16px' }}>
              {errorMessage || t('camera_failed')}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                {t('retry')}
              </button>
              <button className="btn btn-ghost" onClick={onClose}>
                {t('log_workout')}
              </button>
            </div>
          </div>
        )}

        <div className="cam-top">
          <button className="cam-btn" onClick={handleClose} aria-label={t('close')}>&larr;</button>
          <span className="cam-exercise-label">
            {exercise === '__auto__'
              ? (detectedName ? tExercise(Object.keys(EXERCISES).find(k => EXERCISES[k].name === detectedName) || '', detectedName) : t('detecting'))
              : tExercise(exercise, EXERCISES[exercise]?.name || exercise)}
          </span>
          <button className="cam-btn" onClick={flipCamera} aria-label={t('flip_camera')}>&#8634;</button>
        </div>

        {recording && (
          <div className="cam-bottom">
            <div className="cam-reps">
              <span className="cam-reps-num">{reps}</span>
              <span className="cam-reps-label">{reps === 1 ? t('rep') : t('reps')}</span>
            </div>
          </div>
        )}

        {/* Rest timer overlay */}
        {resting && (
          <div className="rest-overlay">
            <div className="rest-content">
              <span className="rest-label">{t('rest_label')}</span>
              <span className="rest-time">{restTimer}</span>
              <span className="rest-label">{t('seconds')}</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={skipRest}>{t('skip_rest')}</button>
                <button className="btn btn-ghost btn-sm" onClick={startSet}>{t('next_set')}</button>
              </div>
            </div>
          </div>
        )}

        {/* Slow device banner */}
        {slowBanner && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'rgba(0,0,0,0.85)', padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10, zIndex: 20,
          }}>
            <span className="text-sm" style={{ flex: 1, color: 'var(--yellow)' }}>
              {t('slow_device_banner')}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setSlowBanner(false)} style={{ minWidth: 'auto', padding: '4px 8px' }}>
              &times;
            </button>
            <button className="btn btn-primary btn-sm" onClick={onClose} style={{ minWidth: 'auto' }}>
              {t('switch_manual')}
            </button>
          </div>
        )}
      </div>


      {/* Session stats bar */}
      {setCount > 0 && !recording && (
        <div className="session-stats">
          <span className="session-stat">{t('sets_colon')} <strong>{setCount}</strong></span>
          <span className="session-stat">{t('burned_colon')} <strong>{totalCalories} kcal</strong></span>
        </div>
      )}

      <div className="cam-controls">
        <select className="cam-select" value={exercise} onChange={handleExerciseChange} style={{ fontSize: 16 }}>
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
            <option value="superset">{t('superset_other')}</option>
          </optgroup>
        </select>

        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="kg"
          style={{ width: 56, padding: '8px 6px', fontSize: 16, textAlign: 'center' }}
        />

        {!recording ? (
          <button
            className="btn-record"
            onClick={startSet}
            disabled={status !== 'ready'}
          >
            {t('start_set')}
          </button>
        ) : (
          <button className="btn-record rec-on" onClick={stopSet}>
            {t('stop_set')}
          </button>
        )}
      </div>

      {/* Secondary controls */}
      <div className="cam-controls-secondary">
        <label className="cam-auto">
          <input type="checkbox" checked={voiceCoach} onChange={(e) => setVoiceCoach(e.target.checked)} style={{ width: 'auto', marginRight: 4 }} />
          {t('voice_coach')}
        </label>
        <select
          value={restDuration}
          onChange={(e) => setRestDuration(parseInt(e.target.value))}
          style={{ width: 'auto', padding: '4px 24px 4px 6px', fontSize: '0.72rem' }}
        >
          {REST_PRESETS.map(s => (
            <option key={s} value={s}>{t('rest_x_s')} {s}s</option>
          ))}
        </select>
      </div>
    </div>
  );
}
