import { useState, useEffect, useRef, useCallback } from 'react';
import { getVideoLandmarker, detectPoseVideo, drawPose, resetTimestamp, disposeAllLandmarkers } from '../lib/poseAnalysis';
import { EXERCISES, RepCounter, ExerciseAutoDetector } from '../lib/exercises';
import { saveWorkout, getProfile } from '../lib/storage';
import { repCompleteSound, setCompleteSound, warmUpAudio } from '../lib/audio';
import { estimateCaloriesBurned } from '../lib/nutrition';

// Group exercises by category for the selector
const EXERCISE_GROUPS = (() => {
  const groups = { compound: [], isolation: [], bodyweight: [] };
  for (const [key, ex] of Object.entries(EXERCISES)) {
    if (key === 'superset') continue;
    const cat = ex.category || 'compound';
    if (groups[cat]) groups[cat].push({ key, name: ex.name });
    else groups.compound.push({ key, name: ex.name });
  }
  for (const g of Object.values(groups)) g.sort((a, b) => a.name.localeCompare(b.name));
  return groups;
})();
const TARGET_FPS = 15;
const FRAME_INTERVAL = 1000 / TARGET_FPS;
const REST_PRESETS = [30, 60, 90, 120, 180];

// Voice coaching via Web Speech API
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.1;
  u.pitch = 0.9;
  u.volume = 0.8;
  speechSynthesis.speak(u);
}

export default function LiveCamera({ onClose }) {
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

  const [status, setStatus] = useState('loading');
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
  const restIntervalRef = useRef(null);

  const initCamera = useCallback(async (facing) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        const [lm, profile] = await Promise.all([getVideoLandmarker(), getProfile()]);
        if (cancelled) return;
        landmarkerRef.current = lm;
        autoDetectorRef.current = new ExerciseAutoDetector();
        if (profile?.weight) setBodyWeight(parseFloat(profile.weight) || 70);
        await initCamera(facingMode);
        if (!cancelled) {
          setStatus('ready');
          // Start passive detection loop immediately so auto-detect
          // runs before the user taps "Start Set"
          lastFrameTimeRef.current = 0;
          rafRef.current = requestAnimationFrame(processFrame);
        }
      } catch (err) {
        console.error('Setup error:', err);
        if (!cancelled) setStatus('error');
      }
    }

    setup();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
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
      const landmarks = result.landmarks[0];
      drawPose(ctx, landmarks, canvas.width, canvas.height);

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
          if (state.repCompleted && state.repHistory) {
            repCompleteSound();
            const latest = state.repHistory[state.repHistory.length - 1];
            setRepBars(prev => [...prev, latest ? latest.score : 80]);
            if (voiceCoach) speak(`${state.reps}`);
          }

          // Voice coaching: announce form issues (throttled to once per 5s)
          if (voiceCoach && state.formFeedback && now - lastVoiceCueRef.current > 5000) {
            const issue = state.formFeedback.find(f => !f.passed);
            if (issue) {
              speak(issue.text);
              lastVoiceCueRef.current = now;
            }
          }
        }
      }
    }

    rafRef.current = requestAnimationFrame(processFrame);
  }, [exercise, autoDetect]);

  const startSet = useCallback(() => {
    warmUpAudio();
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
    if (voiceCoach) speak(`Rest ${restDuration} seconds`);
    restIntervalRef.current = setInterval(() => {
      setRestTimer(prev => {
        if (prev <= 1) {
          clearInterval(restIntervalRef.current);
          restIntervalRef.current = null;
          setResting(false);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          speak('Time. Next set.');
          return 0;
        }
        if (prev === 4) speak('3, 2, 1');
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
    // Do NOT cancel RAF here -- keep pose detection running for passive auto-detect
    // between sets. The processFrame callback checks `recording` state to decide
    // whether to count reps or just detect.

    const counter = repCounterRef.current;
    if (counter && reps > 0) {
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
        if (voiceCoach) {
          speak(`${reps} reps. Form score ${avgScore}. ${cal} calories burned.`);
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
    await initCamera(next);
  }, [facingMode, initCamera]);

  const handleClose = () => {
    if (recording || setCount > 0) {
      if (!window.confirm('Exit session? Your current session data is saved.')) return;
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
            <div className="spinner" />
            <p className="text-sm">Initializing camera and model...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="cam-loading">
            <p style={{ color: 'var(--red)', marginBottom: 12 }}>
              Camera or model failed to load.
            </p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        )}

        <div className="cam-top">
          <button className="cam-btn" onClick={handleClose} aria-label="Close">&larr;</button>
          <span className="cam-exercise-label">
            {exercise === '__auto__'
              ? (detectedName || 'Detecting...')
              : (EXERCISES[exercise]?.name || exercise)}
          </span>
          <button className="cam-btn" onClick={flipCamera} aria-label="Flip camera">&#8634;</button>
        </div>

        {recording && (
          <div className="cam-bottom">
            <div className="cam-reps">
              <span className="cam-reps-num">{reps}</span>
              <span className="cam-reps-label">REPS</span>
            </div>
            <div className="cam-angle">
              {phase && (
                <span className={`cam-phase ${phase === 'up' ? 'up' : 'down'}`}>
                  {phase.toUpperCase()}
                </span>
              )}
              <span className="cam-angle-num">{angle}&deg;</span>
            </div>
          </div>
        )}

        {/* Rest timer overlay */}
        {resting && (
          <div className="rest-overlay">
            <div className="rest-content">
              <span className="rest-label">REST</span>
              <span className="rest-time">{restTimer}</span>
              <span className="rest-label">seconds</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" onClick={skipRest}>Skip</button>
                <button className="btn btn-ghost btn-sm" onClick={startSet}>Next Set</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {recording && feedback.length > 0 && (
        <div className="cam-feedback">
          {feedback.map((fb, i) => (
            <div key={i} className={`fb-item ${fb.passed ? 'fb-pass' : 'fb-fail'}`}>
              <span className="fb-dot">{fb.passed ? '>' : '!'}</span>
              <span>{fb.text}</span>
            </div>
          ))}
        </div>
      )}

      {recording && repBars.length > 0 && (
        <div className="cam-repbars">
          {repBars.map((score, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${Math.max(score, 10)}%`,
                background: score >= 80 ? 'var(--accent)' : score >= 50 ? 'var(--yellow)' : 'var(--red)',
                borderRadius: '2px 2px 0 0',
                minWidth: 4,
              }}
            />
          ))}
        </div>
      )}

      {/* Session stats bar */}
      {setCount > 0 && !recording && (
        <div className="session-stats">
          <span className="session-stat">Sets: <strong>{setCount}</strong></span>
          <span className="session-stat">Burned: <strong>{totalCalories} kcal</strong></span>
        </div>
      )}

      <div className="cam-controls">
        <select className="cam-select" value={exercise} onChange={handleExerciseChange} style={{ fontSize: 16 }}>
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
          style={{ width: 56, padding: '8px 6px', fontSize: 16, textAlign: 'center' }}
        />

        {!recording ? (
          <button
            className="btn-record"
            onClick={startSet}
            disabled={status !== 'ready'}
          >
            Start Set
          </button>
        ) : (
          <button className="btn-record rec-on" onClick={stopSet}>
            Stop & Save
          </button>
        )}
      </div>

      {/* Secondary controls */}
      <div className="cam-controls-secondary">
        <label className="cam-auto">
          <input type="checkbox" checked={voiceCoach} onChange={(e) => setVoiceCoach(e.target.checked)} style={{ width: 'auto', marginRight: 4 }} />
          Voice coach
        </label>
        <select
          value={restDuration}
          onChange={(e) => setRestDuration(parseInt(e.target.value))}
          style={{ width: 'auto', padding: '4px 24px 4px 6px', fontSize: '0.72rem' }}
        >
          {REST_PRESETS.map(s => (
            <option key={s} value={s}>Rest {s}s</option>
          ))}
        </select>
      </div>
    </div>
  );
}
