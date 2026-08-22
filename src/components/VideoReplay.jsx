import { useState, useRef, useEffect, useCallback } from 'react';
import { drawPose } from '../lib/poseAnalysis';
import { useT } from '../lib/LanguageContext';

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

function drawOverlay(ctx, w, h, frames, time, exerciseName, reps, formScore) {
  const closest = frames.length > 0 ? findClosestFrame(frames, time) : null;
  if (closest && closest.landmarks) {
    drawPose(ctx, closest.landmarks, w, h);
  }

  // Stats overlay (top) - scale proportionally to resolution
  const scale = w / 480;
  const pad = Math.round(16 * scale);
  const boxH = Math.round(70 * scale);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, boxH);

  ctx.fillStyle = '#00FF88';
  ctx.font = `bold ${Math.round(24 * scale)}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(exerciseName, pad, boxH / 2);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.round(22 * scale)}px -apple-system, system-ui, sans-serif`;
  ctx.fillText(`${reps} reps  Form: ${formScore}`, w - pad, boxH / 2);

  // Branding (bottom)
  const brandH = Math.round(36 * scale);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, h - brandH, w, brandH);
  ctx.fillStyle = '#00FF88';
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
export default function VideoReplay({ videoUrl, frames, exerciseName, reps, formScore, onClose }) {
  const { t } = useT();
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
      drawOverlay(ctx, w, h, frames, video.currentTime, exerciseName, reps, formScore);
      // Throttle setProgress to every 5th frame to reduce React re-renders
      progressFrameRef.current++;
      if (progressFrameRef.current % 5 === 0) {
        setProgress(video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0);
      }
    } catch (e) {
      console.warn('Draw frame error:', e);
    }
    rafRef.current = requestAnimationFrame(drawFrame);
  }, [frames, exerciseName, reps, formScore]);

  // Setup video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    video.src = videoUrl;
    video.load();

    const onLoaded = () => {
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
          drawOverlay(ctx, canvas.width, canvas.height, frames, 0, exerciseName, reps, formScore);
        }
      }
    };
    video.addEventListener('loadeddata', onLoaded, { once: true });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (hdRafRef.current) cancelAnimationFrame(hdRafRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      // Release video decoder memory (blob URL owned by parent VideoUpload)
      video.removeAttribute('src');
      video.load();
    };
  }, [videoUrl, frames, exerciseName, reps, formScore]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
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
      const fileName = `WorkoutVision-${exerciseName.replace(/\s+/g, '-')}-${reps}reps.${ext}`;

      // Try native share first (mobile), fallback to download
      const file = new File([blob], fileName, { type: blob.type });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: `${exerciseName} - Form: ${formScore}`,
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
  }, [frames, exerciseName, reps, formScore, exporting]);

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
    drawOverlay(ctx, hdCanvas.width, hdCanvas.height, frames, video.currentTime, exerciseName, reps, formScore);

    hdCanvas.toBlob((blob) => {
      if (!blob) return;
      const fileName = `WorkoutVision-${exerciseName.replace(/\s+/g, '-')}-${reps}reps.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: `${exerciseName} - Form: ${formScore}` }).catch(() => {});
      } else {
        triggerDownload(blob, fileName);
      }
    }, 'image/png');
  }, [frames, exerciseName, reps, formScore]);

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
        <div className="replay-progress">
          <div className="replay-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="replay-actions">
        {!exporting ? (
          <>
            {supportsVideoExport ? (
              <button className="btn btn-primary replay-btn" onClick={exportHD}>
                {t('download_hd')}
              </button>
            ) : (
              <button className="btn btn-primary replay-btn" onClick={saveScreenshot}>
                {t('save_screenshot')}
              </button>
            )}
          </>
        ) : (
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3 }}>
                <div style={{
                  width: `${exportProgress}%`, height: '100%',
                  background: 'var(--accent)', borderRadius: 3,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', minWidth: 40 }}>
                {exportProgress}%
              </span>
            </div>
            <button className="btn btn-ghost replay-btn" onClick={cancelExport}>
              {t('cancel_export')}
            </button>
          </div>
        )}
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
