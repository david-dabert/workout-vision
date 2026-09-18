import { useState, useRef, useEffect, useCallback } from 'react';
import { drawPose } from '../lib/poseAnalysis';
import { gradeClass } from '../lib/utils';
import { useT, tModule } from '../lib/LanguageContext';
import { AudioFeedback } from '../lib/AudioFeedback';
import { drawCanvasIcon } from '../lib/icons';

/**
 * Binary search for the closest frame to a given timestamp.
 * Assumes frames is sorted by timestamp (ascending).
 */
function findClosestFrame(frames, time) {
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].timestamp < time) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(frames[lo - 1].timestamp - time) < Math.abs(frames[lo].timestamp - time)) {
    return frames[lo - 1];
  }
  return frames[lo];
}

// Map coaching detection categories to the skeleton segments they affect
const COACHING_SEGMENT_MAP = {
  knee_valgus: [[23, 25], [25, 27], [24, 26], [26, 28]], // hip-knee-ankle both sides
  depth:       [[23, 25], [24, 26]],                       // hip-knee
  squat_depth: [[23, 25], [24, 26]],
  trunk_lean:  [[11, 23], [12, 24], [11, 12], [23, 24]],  // shoulders-hips
  elbow_flare: [[11, 13], [13, 15], [12, 14], [14, 16]],  // shoulders-elbows-wrists
  lockout:     [[13, 15], [14, 16], [25, 27], [26, 28]],  // elbows-wrists or knees-ankles
  bar_path:    [[13, 15], [14, 16]],                       // wrists
  balance:     [[23, 24], [23, 25], [24, 26]],             // hips-knees
};

const COACHING_SEVERITY_COLOR = {
  warning:    '#ff4466',
  correction: '#ffaa22',
  info:       '#66aaff',
  positive:   '#00f5d4',
};

function buildCoachingHighlights(coaching, repIndex, pulsePhase) {
  if (!coaching?.feedback) return null;
  const segments = new Map();

  for (const fb of coaching.feedback) {
    const cat = fb.category;
    const color = COACHING_SEVERITY_COLOR[fb.severity] || '#ffaa22';
    const segs = COACHING_SEGMENT_MAP[cat];
    if (!segs) continue;

    // Check per-rep detection if available
    const metric = coaching.metrics?.[cat];
    if (metric?.perRep && repIndex >= 0 && repIndex < metric.perRep.length) {
      const repData = metric.perRep[repIndex];
      // Only highlight if the issue is active for this rep
      if (repData && (repData.valgusDetected === false || repData.excessive === false ||
          repData.belowParallel === true || repData.fullLockout === true)) continue;
    }

    for (const [i, j] of segs) {
      const key = `${Math.min(i, j)}-${Math.max(i, j)}`;
      segments.set(key, color);
    }
  }

  if (segments.size === 0) return null;
  return { segments, pulseAlpha: 0.7 + 0.3 * Math.sin(pulsePhase) };
}

function drawOverlay(ctx, w, h, frames, time, exerciseName, reps, formScore, repHistory, coaching, pulsePhase) {
  // Find current rep for form feedback and coaching
  let currentFeedback = null;
  let currentRepIndex = -1;
  if (repHistory && repHistory.length > 0) {
    const idx = repHistory.findIndex(r => time >= r.startTime && time <= r.endTime);
    if (idx >= 0) {
      currentFeedback = repHistory[idx].feedback;
      currentRepIndex = idx;
    }
  }

  // Build coaching skeleton highlights for the current rep
  const coachingHighlights = buildCoachingHighlights(coaching, currentRepIndex, pulsePhase || 0);

  const closest = frames.length > 0 ? findClosestFrame(frames, time) : null;
  if (closest && closest.landmarks) {
    drawPose(ctx, closest.landmarks, w, h, 1.0, currentFeedback, coachingHighlights);
  }

  // Stats overlay (top) - scale proportionally to resolution
  const scale = w / 480;
  const pad = Math.round(16 * scale);
  const boxH = Math.round(70 * scale);

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, boxH);

  ctx.fillStyle = '#00f5d4';
  ctx.font = `bold ${Math.round(24 * scale)}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(exerciseName, pad, boxH / 2);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#f0f0f5';
  ctx.font = `bold ${Math.round(22 * scale)}px -apple-system, system-ui, sans-serif`;
  ctx.fillText(`${reps} ${tModule('reps')}`, w - pad, boxH / 2);

  // ═══ Coaching annotation banner (shows during the rep where the issue is detected) ═══
  if (coaching?.feedback?.length > 0 && currentRepIndex >= 0) {
    // Find the top-priority feedback that applies to this rep
    const topFb = coaching.feedback[0]; // already sorted by priority
    if (topFb) {
      // Truncate message to fit
      const maxChars = Math.floor(w / (9 * scale));
      let msg = topFb.messageKey ? tModule(topFb.messageKey, topFb.messageParams) : topFb.message;
      if (msg.length > maxChars) msg = msg.substring(0, maxChars - 1) + '…';

      const bannerH = Math.round(44 * scale);
      const bannerY = boxH + Math.round(8 * scale);
      const bannerColor = COACHING_SEVERITY_COLOR[topFb.severity] || '#ffaa22';

      // Semi-transparent banner
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      const bannerR = Math.round(8 * scale);
      const bx = pad;
      const bw = w - pad * 2;
      ctx.beginPath();
      ctx.roundRect(bx, bannerY, bw, bannerH, bannerR);
      ctx.fill();

      // Left accent bar
      ctx.fillStyle = bannerColor;
      ctx.beginPath();
      ctx.roundRect(bx, bannerY, Math.round(4 * scale), bannerH, [bannerR, 0, 0, bannerR]);
      ctx.fill();

      // Icon
      const iconX = bx + Math.round(14 * scale);
      const iconY = bannerY + bannerH / 2;
      ctx.font = `${Math.round(14 * scale)}px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = bannerColor;
      const canvasIconName = topFb.severity === 'warning' ? 'warning' : topFb.severity === 'correction' ? 'arrowRight' : 'check';
      drawCanvasIcon(ctx, canvasIconName, iconX + Math.round(7 * scale), iconY, Math.round(12 * scale), bannerColor);

      // Message text
      ctx.font = `${Math.round(11 * scale)}px -apple-system, system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(msg, iconX + Math.round(18 * scale), iconY);
    }
  }

  // Branding (bottom)
  const brandH = Math.round(36 * scale);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, h - brandH, w, brandH);

  ctx.fillStyle = '#00f5d4';
  ctx.font = `bold ${Math.round(16 * scale)}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('WorkoutVision', w / 2, h - brandH / 2);
}

function getBestMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  const mimeTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  for (const m of mimeTypes) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

// Check if video export is supported (needs MediaRecorder + captureStream)
function canExportVideo() {
  if (typeof MediaRecorder === 'undefined') return false;
  const testCanvas = document.createElement('canvas');
  return typeof testCanvas.captureStream === 'function';
}

/**
 * Replays a video with skeleton overlay drawn from stored landmark frames.
 * HD download via one-tap auto-record at original video resolution.
 */
export default function VideoReplay({ videoUrl, frames, exerciseName, exerciseKey, reps, formScore, repHistory, coaching, onClose, audioEnabled, duration: durationProp }) {
  const { t, tExercise } = useT();
  // Translate exercise name for overlay display
  const displayExerciseName = exerciseKey ? tExercise(exerciseKey, exerciseName) : exerciseName;
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null); // cached 2d context
  const hdCanvasRef = useRef(null);
  const hdRafRef = useRef(null); // HD export RAF stored in ref for cleanup
  const rafRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const progressFrameRef = useRef(0); // throttle setProgress

  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [progress, setProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState(durationProp || 0);
  const [hoverRep, setHoverRep] = useState(null); // { repIndex, score, left }
  const scrubberRef = useRef(null);
  const isDraggingRef = useRef(false);

  // Audio feedback: track which reps have already triggered sound
  const audioRef = useRef(null);
  const playedRepsRef = useRef(new Set());

  useEffect(() => {
    if (audioEnabled) {
      audioRef.current = new AudioFeedback();
      audioRef.current.start();
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.dispose();
        audioRef.current = null;
      }
    };
  }, [audioEnabled]);

  // Seek video to a time derived from scrubber interaction
  const seekTo = useCallback((clientX) => {
    const video = videoRef.current;
    const bar = scrubberRef.current;
    if (!video || !bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const dur = video.duration || videoDuration;
    if (!dur) return;
    video.currentTime = ratio * dur;
    setProgress(ratio * 100);
    // Redraw the canvas at the new position
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = ctxRef.current || canvas.getContext('2d');
      ctxRef.current = ctx;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      drawOverlay(ctx, canvas.width, canvas.height, frames, video.currentTime, displayExerciseName, reps, formScore, repHistory, coaching, 0);
    }
  }, [frames, displayExerciseName, reps, formScore, repHistory, coaching, videoDuration]);

  const handleScrubberDown = useCallback((e) => {
    if (exporting) return;
    isDraggingRef.current = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    seekTo(clientX);
  }, [seekTo, exporting]);

  const handleScrubberMove = useCallback((e) => {
    const bar = scrubberRef.current;
    if (!bar) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    if (isDraggingRef.current) {
      seekTo(clientX);
    }
    // Hover rep detection
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const video = videoRef.current;
    const dur = video ? (video.duration || videoDuration) : videoDuration;
    if (!dur || !repHistory || repHistory.length === 0) { setHoverRep(null); return; }
    const hoverTime = ratio * dur;
    const idx = repHistory.findIndex(r => hoverTime >= r.startTime && hoverTime <= r.endTime);
    if (idx >= 0) {
      setHoverRep({ repIndex: idx, score: repHistory[idx].score, left: ((clientX - rect.left) / rect.width) * 100 });
    } else {
      setHoverRep(null);
    }
  }, [seekTo, repHistory, videoDuration]);

  const handleScrubberUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleScrubberLeave = useCallback(() => {
    isDraggingRef.current = false;
    setHoverRep(null);
  }, []);

  // Attach window-level mouseup/touchend so dragging outside the bar still releases
  useEffect(() => {
    const up = () => { isDraggingRef.current = false; };
    window.addEventListener('mouseup', up);
    window.addEventListener('touchend', up);
    return () => { window.removeEventListener('mouseup', up); window.removeEventListener('touchend', up); };
  }, []);

  // Helper: get color for a rep score
  const repColor = (score) => {
    const gc = gradeClass(score);
    if (gc === 'grade-a') return 'var(--bio-cyan)';
    if (gc === 'grade-b') return 'var(--blue)';
    if (gc === 'grade-c') return 'var(--yellow)';
    return 'var(--red)';
  };

  // Detect iOS for resolution caps
  const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Draw composite frame on the playback canvas.
  // Throttled to ~15 FPS on mobile to reduce memory pressure.
  const lastDrawRef = useRef(0);
  const DRAW_INTERVAL = IS_IOS ? 66 : 33; // 15fps iOS, 30fps desktop

  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused) return;

    const now = performance.now();
    if (now - lastDrawRef.current < DRAW_INTERVAL) {
      rafRef.current = requestAnimationFrame(drawFrame);
      return;
    }
    lastDrawRef.current = now;

    try {
      const ctx = ctxRef.current || canvas.getContext('2d');
      ctxRef.current = ctx;
      const w = canvas.width;
      const h = canvas.height;
      ctx.drawImage(video, 0, 0, w, h);
      const pulsePhase = (now / 400) % (2 * Math.PI); // smooth pulse for coaching highlights
      drawOverlay(ctx, w, h, frames, video.currentTime, displayExerciseName, reps, formScore, repHistory, coaching, pulsePhase);

      // Audio feedback: play rep-complete sound when crossing rep boundaries
      if (audioRef.current && repHistory) {
        const t = video.currentTime;
        for (let i = 0; i < repHistory.length; i++) {
          const r = repHistory[i];
          if (r.endTime && t >= r.endTime && !playedRepsRef.current.has(i)) {
            playedRepsRef.current.add(i);
            audioRef.current.playRepComplete();
            if (r.issues && r.issues.length > 0) {
              const hasMajor = r.feedback && r.feedback.some(f => !f.passed && f.severity === 'major');
              audioRef.current.playFormWarning(hasMajor ? 'major' : 'minor');
            }
          }
        }
      }

      // Throttle setProgress to every 5th frame to reduce React re-renders
      progressFrameRef.current++;
      if (progressFrameRef.current % 5 === 0) {
        setProgress(video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0);
      }
    } catch (e) {
      console.warn('Draw frame error:', e);
    }
    rafRef.current = requestAnimationFrame(drawFrame);
  }, [frames, displayExerciseName, reps, formScore, repHistory, coaching]);

  // Setup video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    video.src = videoUrl;
    video.load();

    const onLoaded = () => {
      if (video.duration && isFinite(video.duration)) setVideoDuration(video.duration);
      const canvas = canvasRef.current;
      if (canvas && video.videoWidth > 0) {
        // Playback canvas: cap at 480px on iOS (memory), 720px on desktop
        const maxWidth = IS_IOS ? 480 : 720;
        const displayScale = Math.min(1, maxWidth / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * displayScale);
        canvas.height = Math.round(video.videoHeight * displayScale);
        const ctx = canvas.getContext('2d');
        ctxRef.current = ctx;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        if (frames.length > 0 && frames[0].landmarks) {
          drawOverlay(ctx, canvas.width, canvas.height, frames, 0, displayExerciseName, reps, formScore, repHistory, coaching, 0);
        }
      }
    };

    const onError = () => {
      console.error('[VideoReplay] Video failed to load:', video.error?.message);
      // Draw an error state on the canvas so it's not just a black screen
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        canvas.width = 480;
        canvas.height = 360;
        ctx.fillStyle = '#07070a';
        ctx.fillRect(0, 0, 480, 360);
        ctx.fillStyle = '#ff3b5c';
        ctx.font = 'bold 16px -apple-system, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tModule('video_load_error') || 'Video failed to load', 240, 170);
        ctx.fillStyle = '#888';
        ctx.font = '13px -apple-system, system-ui, sans-serif';
        ctx.fillText(tModule('try_different') || 'Try a different video', 240, 200);
      }
    };

    video.addEventListener('loadeddata', onLoaded, { once: true });
    video.addEventListener('error', onError, { once: true });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (hdRafRef.current) cancelAnimationFrame(hdRafRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      video.removeEventListener('error', onError);
      // Release video decoder memory (blob URL owned by parent VideoUpload)
      video.removeAttribute('src');
      video.load();
    };
  }, [videoUrl, frames, displayExerciseName, reps, formScore, repHistory, coaching]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      playedRepsRef.current.clear();
      video.play();
      setPlaying(true);
      rafRef.current = requestAnimationFrame(drawFrame);
    } else {
      video.pause();
      setPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
  }, [drawFrame]);

  // Handle video end
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnd = () => {
      setPlaying(false);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    video.addEventListener('ended', onEnd);
    return () => video.removeEventListener('ended', onEnd);
  }, []);

  // One-tap HD export: plays video at normal speed on a full-resolution offscreen canvas,
  // records via MediaRecorder, then triggers download automatically.
  const exportHD = useCallback(() => {
    const video = videoRef.current;
    if (!video || exporting) return;

    // Stop playback RAF before starting export to avoid double draw loops
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    setPlaying(false);

    // Create HD canvas. Cap at 1080p on iOS to avoid memory crash (33MB at 4K).
    const maxExportWidth = IS_IOS ? 1080 : video.videoWidth;
    const exportScale = Math.min(1, maxExportWidth / video.videoWidth);
    const hdCanvas = document.createElement('canvas');
    hdCanvas.width = Math.round(video.videoWidth * exportScale);
    hdCanvas.height = Math.round(video.videoHeight * exportScale);
    hdCanvasRef.current = hdCanvas;
    const hdCtx = hdCanvas.getContext('2d');

    video.currentTime = 0;
    setExporting(true);
    setExportProgress(0);
    chunksRef.current = [];

    const mime = getBestMime();
    const stream = hdCanvas.captureStream(30);

    // Try to capture audio from the source video
    try {
      if (video.captureStream) {
        const videoStream = video.captureStream();
        videoStream.getAudioTracks().forEach(t => stream.addTrack(t));
      }
    } catch (e) { /* no audio is fine */ }

    const recorder = new MediaRecorder(stream, {
      mimeType: mime || undefined,
      videoBitsPerSecond: 8_000_000, // 8 Mbps for HD quality
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime || 'video/webm' });
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const fileName = `WorkoutVision-${displayExerciseName.replace(/\s+/g, '-')}-${reps}reps.${ext}`;

      // Try native share first (mobile), fallback to download
      const file = new File([blob], fileName, { type: blob.type });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: `${displayExerciseName} - Form: ${formScore}`,
          text: `${reps} reps analyzed by WorkoutVision`,
        }).catch(() => {
          // User cancelled share, download instead
          triggerDownload(blob, fileName);
        });
      } else {
        triggerDownload(blob, fileName);
      }

      setExporting(false);
      setExportProgress(0);
      hdCanvasRef.current = null;
    };

    recorderRef.current = recorder;
    recorder.start(100);

    // Draw loop on the HD canvas while the video plays
    const drawHDFrame = () => {
      if (video.paused || video.ended) return;
      const w = hdCanvas.width;
      const h = hdCanvas.height;
      hdCtx.drawImage(video, 0, 0, w, h);
      drawOverlay(hdCtx, w, h, frames, video.currentTime, displayExerciseName, reps, formScore, repHistory, coaching, 0);
      setExportProgress(video.duration > 0 ? Math.round((video.currentTime / video.duration) * 100) : 0);
      hdRafRef.current = requestAnimationFrame(drawHDFrame);
    };

    const onExportEnd = () => {
      if (hdRafRef.current) { cancelAnimationFrame(hdRafRef.current); hdRafRef.current = null; }
      if (recorder.state !== 'inactive') recorder.stop();
      video.removeEventListener('ended', onExportEnd);
      video.muted = true;
    };
    video.addEventListener('ended', onExportEnd);

    // Play at normal speed for proper recording
    video.muted = true;
    video.play();
    hdRafRef.current = requestAnimationFrame(drawHDFrame);
  }, [frames, displayExerciseName, reps, formScore, repHistory, coaching, exporting]);

  const cancelExport = useCallback(() => {
    const video = videoRef.current;
    if (video) video.pause();
    if (hdRafRef.current) { cancelAnimationFrame(hdRafRef.current); hdRafRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setExporting(false);
    setExportProgress(0);
    chunksRef.current = [];
  }, []);

  // Fallback for iOS Safari: save current frame as HD screenshot
  const saveScreenshot = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const hdCanvas = document.createElement('canvas');
    hdCanvas.width = video.videoWidth;
    hdCanvas.height = video.videoHeight;
    const ctx = hdCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0, hdCanvas.width, hdCanvas.height);
    drawOverlay(ctx, hdCanvas.width, hdCanvas.height, frames, video.currentTime, displayExerciseName, reps, formScore, repHistory, coaching, 0);

    hdCanvas.toBlob((blob) => {
      if (!blob) return;
      const fileName = `WorkoutVision-${displayExerciseName.replace(/\s+/g, '-')}-${reps}reps.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: `${displayExerciseName} - Form: ${formScore}` }).catch(() => {});
      } else {
        triggerDownload(blob, fileName);
      }
    }, 'image/png');
  }, [frames, displayExerciseName, reps, formScore, repHistory, coaching]);

  const supportsVideoExport = canExportVideo();

  return (
    <div className="replay-page">
      <div className="replay-header">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>&larr; {t('back')}</button>
        <h3>{t('ai_overlay')}</h3>
        <div style={{ width: 60 }} />
      </div>

      <div className="replay-view">
        {/* iOS Safari needs meaningful video dimensions for hardware HEVC decode.
            1x1 or display:none forces software decode (8-10x memory). Use full
            size but clip with overflow:hidden on parent + opacity near-zero. */}
        <video ref={videoRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.01, pointerEvents: 'none', zIndex: -1 }} muted playsInline preload="auto" />
        <canvas
          ref={canvasRef}
          className="replay-canvas"
          onClick={!exporting ? togglePlay : undefined}
        />
        {!playing && !exporting && (
          <div className="replay-play-btn" onClick={togglePlay}>
            <span>&#9654;</span>
          </div>
        )}
      </div>

      {/* Timeline scrubber with per-rep form overlay */}
      <div
        className="timeline-scrubber"
        ref={scrubberRef}
        onMouseDown={handleScrubberDown}
        onMouseMove={handleScrubberMove}
        onMouseUp={handleScrubberUp}
        onMouseLeave={handleScrubberLeave}
        onTouchStart={handleScrubberDown}
        onTouchMove={handleScrubberMove}
        onTouchEnd={handleScrubberUp}
      >
        {/* Background track */}
        <div className="timeline-track">
          {/* Rep segments */}
          {repHistory && videoDuration > 0 && repHistory.map((rep, i) => {
            const left = (rep.startTime / videoDuration) * 100;
            const width = ((rep.endTime - rep.startTime) / videoDuration) * 100;
            return (
              <div
                key={i}
                className="timeline-rep-segment"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: repColor(rep.score),
                  opacity: 0.5,
                }}
              />
            );
          })}
          {/* Progress fill */}
          <div className="timeline-progress" style={{ width: `${progress}%` }} />
        </div>
        {/* Draggable thumb */}
        <div
          className="timeline-thumb"
          style={{ left: `${progress}%` }}
        />
        {/* Hover tooltip */}
        {hoverRep !== null && (
          <div
            className="timeline-tooltip"
            style={{ left: `${hoverRep.left}%` }}
          >
            {t('rep')} {hoverRep.repIndex + 1} &middot; {Math.round(hoverRep.score)}%
          </div>
        )}
      </div>

      {exporting && (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 6 }}>
            {t('exporting')}... {exportProgress}%
          </div>
          <div className="replay-progress" style={{ margin: '0 20px' }}>
            <div className="replay-progress-fill" style={{ width: `${exportProgress}%` }} />
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={cancelExport}>
            {t('cancel')}
          </button>
        </div>
      )}

      <div className="replay-actions">
        {supportsVideoExport ? (
          <button
            className="btn btn-primary replay-btn"
            onClick={exportHD}
            disabled={exporting}
            style={{ flex: 1 }}
          >
            {t('download_hd')}
          </button>
        ) : (
          <button
            className="btn btn-primary replay-btn"
            onClick={saveScreenshot}
            style={{ flex: 1 }}
          >
            {t('save_screenshot')}
          </button>
        )}
        <button className="btn btn-ghost replay-btn" onClick={onClose}>
          {t('back')}
        </button>
      </div>
    </div>
  );
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  // iOS Safari ignores the download attribute, so try share first
  if (navigator.share) {
    const file = new File([blob], fileName, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch(() => {
        fallbackDownload(url, fileName);
      });
      return;
    }
  }
  fallbackDownload(url, fileName);
}

function fallbackDownload(url, fileName) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
