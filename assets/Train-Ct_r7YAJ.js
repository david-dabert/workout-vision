import { u as useT, a as useProfile, r as reactExports, E as EXERCISES, t as tModule, s as saveWorkout, j as jsxRuntimeExports, b as EXERCISE_GROUPS } from "./index-CHfJrAfb.js";
import { detectPoseVideo, selectSubjectPose, drawPose, drawOverlayMessage, loadModelWithRetry, resetTimestamp, disposeAllLandmarkers } from "./poseAnalysis-C-iMbmma.js";
import { l as logEvent } from "./telemetry-DzSBVjfT.js";
import { R as RepCounter, E as ExerciseAutoDetector } from "./exerciseDetector-DVoyIjvg.js";
const EXERCISE_METS = {
  // Compound lifts (high intensity)
  squat: 6,
  front_squat: 6,
  deadlift: 6,
  romanian_deadlift: 5.5,
  bench_press: 5,
  overhead_press: 5,
  clean_and_press: 8,
  thruster: 8,
  man_maker: 8,
  turkish_get_up: 6,
  // Compound bodyweight
  pull_up: 5.5,
  chin_up: 5.5,
  commando_pull_up: 6,
  muscle_up: 7,
  dip: 5,
  push_up: 4,
  diamond_push_up: 4.5,
  pike_push_up: 4.5,
  inverted_row: 4,
  renegade_row: 6,
  burpee: 8,
  bear_crawl: 8,
  // Lower body compound
  lunge: 5,
  bulgarian_split_squat: 5.5,
  goblet_squat: 5.5,
  pistol_squat: 6,
  step_up: 5,
  leg_press: 5,
  hip_thrust: 5,
  glute_bridge: 3.5,
  // Isolation
  bicep_curl: 3.5,
  tricep_extension: 3.5,
  lateral_raise: 3,
  leg_extension: 3.5,
  leg_curl: 3.5,
  standing_leg_extension: 3,
  calf_raise: 3,
  crunch: 3,
  // Machine / cable
  lat_pulldown: 4,
  seated_row: 4,
  chest_supported_row: 4,
  bent_over_row: 5,
  machine_chest_press: 4,
  kettlebell_swing: 6,
  face_pull: 3,
  incline_bench_press: 5,
  sumo_deadlift: 6,
  nordic_curl: 4,
  seated_calf_raise: 3,
  hanging_leg_raise: 3.5,
  // Plyometric / cardio hybrid
  box_jump: 7,
  jump_squat: 7,
  jumping_jack: 7,
  mountain_climber: 8,
  skater_jump: 7,
  squat_jump_to_lunge: 7.5,
  // Isometric
  plank: 3,
  wall_sit: 3,
  // Adaptive
  superset: 5.5
};
function estimateCaloriesBurned(exerciseKey, bodyWeightKg, durationSeconds) {
  const met = EXERCISE_METS[exerciseKey] || 4;
  const hours = durationSeconds / 3600;
  return Math.round(met * bodyWeightKg * hours);
}
class CameraError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "CameraError";
    this.code = code;
  }
}
async function initCamera(videoRef, facingMode = "user") {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    videoRef.srcObject = stream;
    await videoRef.play();
    return stream;
  } catch (err) {
    if (err.name === "NotAllowedError") {
      throw new CameraError(
        "Camera permission denied. Please allow camera access in your browser settings, then tap Retry.",
        "PERMISSION_DENIED"
      );
    } else if (err.name === "NotFoundError") {
      throw new CameraError(
        "No camera found. Please connect a camera or use Manual Log mode.",
        "NO_CAMERA"
      );
    } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
      throw new CameraError(
        "Camera is in use by another app. Close other apps and try again.",
        "CAMERA_IN_USE"
      );
    } else {
      throw new CameraError(`Camera error: ${err.message}`, "UNKNOWN");
    }
  }
}
function stopCamera(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {
    });
  }
  return audioCtx;
}
function beep(freq, duration = 0.08, volume = 0.3) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(1e-3, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
  }
}
function vibrate(pattern = 50) {
  try {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch (e) {
  }
}
function repCompleteSound() {
  beep(880, 0.06, 0.25);
  setTimeout(() => beep(1100, 0.06, 0.2), 70);
  vibrate(40);
}
function setCompleteSound() {
  beep(660, 0.08, 0.25);
  setTimeout(() => beep(880, 0.08, 0.25), 100);
  setTimeout(() => beep(1100, 0.1, 0.3), 200);
  vibrate([50, 30, 50, 30, 80]);
}
function warmUpAudio() {
  getAudioContext();
}
const TARGET_FPS = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? 15 : 30;
const FRAME_INTERVAL = 1e3 / TARGET_FPS;
const REST_PRESETS = [30, 60, 90, 120, 180];
const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function speak(text, lang) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === "fr" ? "fr-FR" : "en-US";
  u.rate = prefersReducedMotion ? 0.9 : 1.1;
  u.pitch = prefersReducedMotion ? 1 : 0.9;
  u.volume = 0.8;
  speechSynthesis.speak(u);
}
function LiveCamera({ onClose }) {
  const { t, tExercise, lang } = useT();
  const { profile: userProfile } = useProfile();
  const videoRef = reactExports.useRef(null);
  const canvasRef = reactExports.useRef(null);
  const ctxRef = reactExports.useRef(null);
  const landmarkerRef = reactExports.useRef(null);
  const rafRef = reactExports.useRef(null);
  const repCounterRef = reactExports.useRef(null);
  const autoDetectorRef = reactExports.useRef(null);
  const streamRef = reactExports.useRef(null);
  const startTimeRef = reactExports.useRef(null);
  const lastFrameTimeRef = reactExports.useRef(0);
  const lastVoiceCueRef = reactExports.useRef(0);
  const sessionLangRef = reactExports.useRef(lang);
  const [status, setStatus] = reactExports.useState("loading");
  const [loadingProgress, setLoadingProgress] = reactExports.useState(0);
  const [loadingMessage, setLoadingMessage] = reactExports.useState("");
  const [errorMessage, setErrorMessage] = reactExports.useState("");
  const lastValidPoseRef = reactExports.useRef(null);
  const confidenceDecayRef = reactExports.useRef(1);
  const detectionNullFiredRef = reactExports.useRef(false);
  const wakeLockRef = reactExports.useRef(null);
  const fpsWindowRef = reactExports.useRef([]);
  const slowFpsWarnedRef = reactExports.useRef(false);
  const [exercise, setExercise] = reactExports.useState("__auto__");
  const [weight, setWeight] = reactExports.useState("");
  const [autoDetect, setAutoDetect] = reactExports.useState(true);
  const [detectedName, setDetectedName] = reactExports.useState("");
  const [voiceCoach, setVoiceCoach] = reactExports.useState(false);
  const [recording, setRecording] = reactExports.useState(false);
  const [facingMode, setFacingMode] = reactExports.useState("environment");
  const [reps, setReps] = reactExports.useState(0);
  const [phase, setPhase] = reactExports.useState("");
  const [angle, setAngle] = reactExports.useState(0);
  const [feedback, setFeedback] = reactExports.useState([]);
  const [repBars, setRepBars] = reactExports.useState([]);
  const [bodyWeight, setBodyWeight] = reactExports.useState(70);
  const [setCount, setSetCount] = reactExports.useState(0);
  const [restTimer, setRestTimer] = reactExports.useState(0);
  const [restDuration, setRestDuration] = reactExports.useState(90);
  const [resting, setResting] = reactExports.useState(false);
  const [totalCalories, setTotalCalories] = reactExports.useState(0);
  const [liteMode, setLiteMode] = reactExports.useState(false);
  const [slowBanner, setSlowBanner] = reactExports.useState(false);
  const restIntervalRef = reactExports.useRef(null);
  const requestWakeLock = reactExports.useCallback(async () => {
    if ("wakeLock" in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch (_) {
      }
    }
  }, []);
  const releaseWakeLock = reactExports.useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {
      });
      wakeLockRef.current = null;
    }
  }, []);
  const setupCamera = reactExports.useCallback(async (facing) => {
    try {
      stopCamera(streamRef.current);
      const stream = await initCamera(videoRef.current, facing);
      streamRef.current = stream;
      logEvent("camera_permission", { granted: true });
    } catch (err) {
      logEvent("camera_permission", { granted: false, error: err.code || err.message });
      throw err;
    }
  }, []);
  reactExports.useEffect(() => {
    let cancelled = false;
    async function setup() {
      try {
        setLoadingMessage(t("downloading_model"));
        const startMs = performance.now();
        const lm = await loadModelWithRetry((progress, message) => {
          if (!cancelled) {
            setLoadingProgress(progress);
            setLoadingMessage(message);
          }
        });
        logEvent("model_load_success", { durationMs: Math.round(performance.now() - startMs) });
        if (cancelled) return;
        landmarkerRef.current = lm;
        autoDetectorRef.current = new ExerciseAutoDetector();
        if (userProfile?.weight) setBodyWeight(parseFloat(userProfile.weight) || 70);
        setLoadingMessage(t("starting_camera"));
        await setupCamera(facingMode);
        if (!cancelled) {
          setStatus("ready");
          lastFrameTimeRef.current = 0;
          rafRef.current = requestAnimationFrame(processFrame);
        }
      } catch (err) {
        console.error("Setup error:", err);
        if (!cancelled) {
          setErrorMessage(err.message || "Camera or model failed to load.");
          setStatus("error");
        }
      }
    }
    setup();
    const handleVisibility = async () => {
      if (document.visibilityState === "visible") {
        const stream = streamRef.current;
        if (!stream || stream.getTracks().some((tr) => tr.readyState === "ended")) {
          try {
            await setupCamera(facingMode);
          } catch (_) {
          }
        } else if (videoRef.current && videoRef.current.paused) {
          videoRef.current.play().catch(() => {
          });
        }
        if (wakeLockRef.current === null) requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopCamera(streamRef.current);
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
      releaseWakeLock();
      disposeAllLandmarkers();
    };
  }, []);
  const processFrame = reactExports.useCallback((now) => {
    if (now - lastFrameTimeRef.current < FRAME_INTERVAL) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }
    lastFrameTimeRef.current = now;
    fpsWindowRef.current.push(now);
    if (fpsWindowRef.current.length > 10) fpsWindowRef.current.shift();
    if (fpsWindowRef.current.length === 10) {
      const elapsed = fpsWindowRef.current[9] - fpsWindowRef.current[0];
      const effectiveFps = 9 / elapsed * 1e3;
      if (effectiveFps < 5 && !slowFpsWarnedRef.current) {
        slowFpsWarnedRef.current = true;
        setSlowBanner(true);
        setLiteMode(true);
        logEvent("slow_inference", { fps: Math.round(effectiveFps), tier: 3 });
      } else if (effectiveFps < 10 && !liteMode && !slowFpsWarnedRef.current) {
        setLiteMode(true);
        setSlowBanner(true);
        logEvent("slow_inference", { fps: Math.round(effectiveFps), tier: 2 });
      }
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctxRef.current = canvas.getContext("2d");
    }
    if (!ctxRef.current) {
      ctxRef.current = canvas.getContext("2d");
    }
    const ctx = ctxRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const ts = performance.now();
    const result = detectPoseVideo(landmarker, video, ts);
    if (result && result.landmarks && result.landmarks.length > 0) {
      const landmarks = selectSubjectPose(result.landmarks);
      lastValidPoseRef.current = landmarks;
      confidenceDecayRef.current = 1;
      if (!liteMode) {
        drawPose(ctx, landmarks, canvas.width, canvas.height, 1);
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
          setPhase(state.phase || "");
          setAngle(Math.round(state.angle || 0));
          if (state.formFeedback) setFeedback(state.formFeedback);
          if (state.repCompleted && state.repHistory) {
            repCompleteSound();
            const latest = state.repHistory[state.repHistory.length - 1];
            setRepBars((prev) => [...prev, latest?.score ?? null]);
            if (voiceCoach) speak(`${state.reps}`, sessionLangRef.current);
          }
          if (voiceCoach && state.formFeedback && now - lastVoiceCueRef.current > 5e3) {
            const issue = state.formFeedback.find((f) => !f.passed);
            if (issue) {
              const txt = issue.key ? tModule(issue.key, issue) : issue.text;
              speak(txt, sessionLangRef.current);
              lastVoiceCueRef.current = now;
            }
          }
        }
      }
    } else if (lastValidPoseRef.current) {
      confidenceDecayRef.current *= 0.95;
      if (confidenceDecayRef.current > 0.1) {
        drawPose(ctx, lastValidPoseRef.current, canvas.width, canvas.height, confidenceDecayRef.current);
      } else {
        drawOverlayMessage(ctx, t("move_into_frame"), t("no_pose_detected"));
        if (!detectionNullFiredRef.current) {
          detectionNullFiredRef.current = true;
          logEvent("detection_null", { timestamp: Date.now() });
        }
      }
    }
    rafRef.current = requestAnimationFrame(processFrame);
  }, [exercise, autoDetect, t, liteMode]);
  const startSet = reactExports.useCallback(() => {
    warmUpAudio();
    requestWakeLock();
    const activeExercise = exercise === "__auto__" ? detectedName ? Object.keys(EXERCISES).find((k) => EXERCISES[k].name === detectedName) || "squat" : "squat" : exercise;
    repCounterRef.current = new RepCounter(activeExercise);
    resetTimestamp();
    setReps(0);
    setPhase("");
    setAngle(0);
    setFeedback([]);
    setRepBars([]);
    setRecording(true);
    startTimeRef.current = Date.now();
    lastFrameTimeRef.current = 0;
  }, [exercise, detectedName, processFrame]);
  const startRestTimer = reactExports.useCallback(() => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setResting(true);
    setRestTimer(restDuration);
    if (voiceCoach) speak(tModule("voice_rest", { seconds: restDuration }), sessionLangRef.current);
    restIntervalRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (prev <= 1) {
          clearInterval(restIntervalRef.current);
          restIntervalRef.current = null;
          setResting(false);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          speak(tModule("voice_next_set"), sessionLangRef.current);
          return 0;
        }
        if (prev === 4) speak("3, 2, 1", sessionLangRef.current);
        return prev - 1;
      });
    }, 1e3);
  }, [restDuration, voiceCoach]);
  const skipRest = reactExports.useCallback(() => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setResting(false);
    setRestTimer(0);
  }, []);
  const stopSet = reactExports.useCallback(async () => {
    setRecording(false);
    releaseWakeLock();
    const counter = repCounterRef.current;
    if (counter && reps > 0) {
      setCompleteSound();
      const duration = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1e3) : 0;
      const repHistory = counter.repHistory || [];
      const avgScore = repHistory.length > 0 ? Math.round(repHistory.reduce((s, r) => s + (r.score || 0), 0) / repHistory.length) : 0;
      const w = parseFloat(weight) || 0;
      const savedExercise = exercise === "__auto__" ? detectedName ? Object.keys(EXERCISES).find((k) => EXERCISES[k].name === detectedName) || "squat" : "squat" : exercise;
      const cal = estimateCaloriesBurned(savedExercise, bodyWeight, duration);
      setTotalCalories((prev) => prev + cal);
      setSetCount((prev) => prev + 1);
      const workout = {
        id: Date.now().toString(),
        date: (/* @__PURE__ */ new Date()).toISOString(),
        exercise: savedExercise,
        exerciseName: EXERCISES[savedExercise]?.name || savedExercise,
        reps,
        duration,
        formScore: avgScore,
        repHistory,
        weight: w,
        volume: w * reps,
        caloriesBurned: cal,
        source: "live"
      };
      try {
        await saveWorkout(workout);
        logEvent("session_complete", { exercise: savedExercise, reps, source: "live" });
        if (voiceCoach) {
          speak(tModule("voice_set_complete", { reps, score: avgScore, cal }), sessionLangRef.current);
        }
      } catch (err) {
        console.error("Failed to save workout:", err);
      }
      startRestTimer();
    }
  }, [exercise, reps, weight, bodyWeight, voiceCoach, startRestTimer]);
  const flipCamera = reactExports.useCallback(async () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    await setupCamera(next);
  }, [facingMode, setupCamera]);
  const handleClose = () => {
    if (recording || setCount > 0) {
      if (!window.confirm(t("exit_session"))) return;
    }
    onClose();
  };
  const handleExerciseChange = (e) => {
    const key = e.target.value;
    if (key === "__auto__") {
      setExercise("__auto__");
      setAutoDetect(true);
      setDetectedName("");
      autoDetectorRef.current = new ExerciseAutoDetector();
    } else {
      setExercise(key);
      setAutoDetect(false);
      setDetectedName("");
      if (recording) {
        repCounterRef.current = new RepCounter(key);
        setReps(0);
        setRepBars([]);
      }
    }
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "live-page", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "cam-container", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("video", { ref: videoRef, className: "cam-video", playsInline: true, muted: true }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("canvas", { ref: canvasRef, className: "cam-overlay" }),
      status === "loading" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "cam-loading", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { width: "80%", maxWidth: 260, marginBottom: 12 }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }, children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { width: `${loadingProgress}%`, height: "100%", background: "var(--accent)", transition: "width 0.3s" } }) }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm", style: { textAlign: "center" }, children: loadingMessage || t("init_camera") })
      ] }),
      status === "error" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "cam-loading", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { style: { color: "var(--red)", marginBottom: 12, textAlign: "center", padding: "0 16px" }, children: errorMessage || t("camera_failed") }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-primary", onClick: () => window.location.reload(), children: t("retry") }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-ghost", onClick: onClose, children: t("log_workout") })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "cam-top", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "cam-btn", onClick: handleClose, "aria-label": t("close"), children: "←" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "cam-exercise-label", children: exercise === "__auto__" ? detectedName ? tExercise(Object.keys(EXERCISES).find((k) => EXERCISES[k].name === detectedName) || "", detectedName) : t("detecting") : tExercise(exercise, EXERCISES[exercise]?.name || exercise) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "cam-btn", onClick: flipCamera, "aria-label": t("flip_camera"), children: "↺" })
      ] }),
      recording && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "cam-bottom", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "cam-reps", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "cam-reps-num", children: reps }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "cam-reps-label", children: reps === 1 ? t("rep") : t("reps") })
      ] }) }),
      resting && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rest-overlay", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rest-content", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rest-label", children: t("rest_label") }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rest-time", children: restTimer }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rest-label", children: t("seconds") }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 8, marginTop: 12 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-primary btn-sm", onClick: skipRest, children: t("skip_rest") }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-ghost btn-sm", onClick: startSet, children: t("next_set") })
        ] })
      ] }) }),
      slowBanner && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(0,0,0,0.85)",
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        zIndex: 20
      }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm", style: { flex: 1, color: "var(--yellow)" }, children: t("slow_device_banner") }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-ghost btn-sm", onClick: () => setSlowBanner(false), style: { minWidth: "auto", padding: "4px 8px" }, children: "×" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn btn-primary btn-sm", onClick: onClose, style: { minWidth: "auto" }, children: t("switch_manual") })
      ] })
    ] }),
    setCount > 0 && !recording && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "session-stats", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "session-stat", children: [
        t("sets_colon"),
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { children: setCount })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "session-stat", children: [
        t("burned_colon"),
        " ",
        /* @__PURE__ */ jsxRuntimeExports.jsxs("strong", { children: [
          totalCalories,
          " kcal"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "cam-controls", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { className: "cam-select", value: exercise, onChange: handleExerciseChange, style: { fontSize: 16 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "__auto__", children: t("automatic") }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("optgroup", { label: t("compound"), children: EXERCISE_GROUPS.compound.map((e) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: e.key, children: tExercise(e.key, e.name) }, e.key)) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("optgroup", { label: t("isolation"), children: EXERCISE_GROUPS.isolation.map((e) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: e.key, children: tExercise(e.key, e.name) }, e.key)) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("optgroup", { label: t("bodyweight"), children: EXERCISE_GROUPS.bodyweight.map((e) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: e.key, children: tExercise(e.key, e.name) }, e.key)) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("optgroup", { label: t("other"), children: /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "superset", children: t("superset_other") }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          type: "number",
          value: weight,
          onChange: (e) => setWeight(e.target.value),
          placeholder: "kg",
          style: { width: 56, padding: "8px 6px", fontSize: 16, textAlign: "center" }
        }
      ),
      !recording ? /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          className: "btn-record",
          onClick: startSet,
          disabled: status !== "ready",
          children: t("start_set")
        }
      ) : /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: "btn-record rec-on", onClick: stopSet, children: t("stop_set") })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "cam-controls-secondary", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "cam-auto", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: voiceCoach, onChange: (e) => setVoiceCoach(e.target.checked), style: { width: "auto", marginRight: 4 } }),
        t("voice_coach")
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "select",
        {
          value: restDuration,
          onChange: (e) => setRestDuration(parseInt(e.target.value)),
          style: { width: "auto", padding: "4px 24px 4px 6px", fontSize: "0.72rem" },
          children: REST_PRESETS.map((s) => /* @__PURE__ */ jsxRuntimeExports.jsxs("option", { value: s, children: [
            t("rest_x_s"),
            " ",
            s,
            "s"
          ] }, s))
        }
      )
    ] })
  ] });
}
export {
  LiveCamera as default
};
