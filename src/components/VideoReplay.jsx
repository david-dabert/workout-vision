import { useState, useRef, useEffect, useCallback } from 'react';
import { drawPose } from '../lib/poseAnalysis';

/**
 * Replays a video with skeleton overlay drawn from stored landmark frames.
 * Includes recording capability to export as shareable video.
 */
export default function VideoReplay({ videoUrl, frames, exerciseName, reps, formScore, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [progress, setProgress] = useState(0);

  // Draw composite frame: video + skeleton + stats overlay
  const drawFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.paused) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Draw video frame
    ctx.drawImage(video, 0, 0, w, h);

    // Find the closest landmark frame to current video time
    const t = video.currentTime;
    let closest = null;
    let minDist = Infinity;
    for (const f of frames) {
      const d = Math.abs(f.timestamp - t);
      if (d < minDist) { minDist = d; closest = f; }
    }

    // Draw skeleton overlay
    if (closest && closest.landmarks) {
      drawPose(ctx, closest.landmarks, w, h);
    }

    // Stats overlay (top-left)
    const pad = 16;
    const boxH = 70;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, boxH);

    ctx.fillStyle = '#00FF88';
    ctx.font = `bold ${Math.round(w / 20)}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(exerciseName, pad, boxH / 2);

    // Reps + form on right side
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(w / 22)}px -apple-system, system-ui, sans-serif`;
    ctx.fillText(`${reps} reps  Form: ${formScore}`, w - pad, boxH / 2);

    // Branding (bottom)
    const brandH = 36;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, h - brandH, w, brandH);
    ctx.fillStyle = '#00FF88';
    ctx.font = `bold ${Math.round(w / 30)}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WorkoutVision', w / 2, h - brandH / 2);

    // Progress
    setProgress(video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0);

    rafRef.current = requestAnimationFrame(drawFrame);
  }, [frames, exerciseName, reps, formScore]);

  // Setup video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;
    video.src = videoUrl;
    video.load();

    // Draw first frame when metadata loads
    const onLoaded = () => {
      const canvas = canvasRef.current;
      if (canvas && video.videoWidth > 0) {
        // Size canvas to video, capped for performance
        const scale = Math.min(1, 720 / video.videoWidth);
        canvas.width = Math.round(video.videoWidth * scale);
        canvas.height = Math.round(video.videoHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Draw first skeleton frame
        if (frames.length > 0 && frames[0].landmarks) {
          drawPose(ctx, frames[0].landmarks, canvas.width, canvas.height);
        }
      }
    };
    video.addEventListener('loadeddata', onLoaded, { once: true });

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    };
  }, [videoUrl, frames]);

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
      if (recording) stopRecording();
    };
    video.addEventListener('ended', onEnd);
    return () => video.removeEventListener('ended', onEnd);
  }, [recording]);

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    // Reset video to start
    video.currentTime = 0;
    setRecordedUrl(null);
    chunksRef.current = [];

    const stream = canvas.captureStream(30);

    // Try to add audio from video if available
    try {
      if (video.captureStream) {
        const videoStream = video.captureStream();
        const audioTracks = videoStream.getAudioTracks();
        audioTracks.forEach(t => stream.addTrack(t));
      }
    } catch (e) { /* no audio, fine */ }

    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];
    let mime = '';
    for (const m of mimeTypes) {
      if (MediaRecorder.isTypeSupported(m)) { mime = m; break; }
    }

    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime || 'video/webm' });
      setRecordedUrl(URL.createObjectURL(blob));
      setRecording(false);
    };

    recorderRef.current = recorder;
    recorder.start(100);
    setRecording(true);

    // Play video + draw overlay
    video.play();
    setPlaying(true);
    rafRef.current = requestAnimationFrame(drawFrame);
  }, [drawFrame]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    const video = videoRef.current;
    if (video) video.pause();
    setPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const shareRecording = useCallback(async () => {
    if (!recordedUrl) return;
    const blob = await (await fetch(recordedUrl)).blob();
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([blob], `workout-${exerciseName.replace(/\s+/g, '-')}.${ext}`, { type: blob.type });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${exerciseName} - Form: ${formScore}`,
          text: `${reps} reps analyzed by WorkoutVision`,
        });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }

    // Fallback: download
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = file.name;
    a.click();
  }, [recordedUrl, exerciseName, reps, formScore]);

  return (
    <div className="replay-page">
      <div className="replay-header">
        <button className="btn btn-ghost btn-sm" onClick={onClose}>&larr; Back</button>
        <h3>AI Overlay</h3>
        <div style={{ width: 60 }} />
      </div>

      <div className="replay-view">
        <video ref={videoRef} style={{ display: 'none' }} muted playsInline preload="auto" />
        <canvas
          ref={canvasRef}
          className="replay-canvas"
          onClick={togglePlay}
        />
        {!playing && (
          <div className="replay-play-btn" onClick={togglePlay}>
            <span>&#9654;</span>
          </div>
        )}
        <div className="replay-progress">
          <div className="replay-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="replay-actions">
        {!recording && !recordedUrl && (
          <button className="btn btn-primary replay-btn" onClick={startRecording}>
            Record with AI Overlay
          </button>
        )}
        {recording && (
          <button className="btn btn-primary replay-btn rec-on" onClick={stopRecording}>
            Stop Recording
          </button>
        )}
        {recordedUrl && (
          <>
            <button className="btn btn-primary replay-btn" onClick={shareRecording}>
              Share Video
            </button>
            <button className="btn btn-ghost replay-btn" onClick={startRecording}>
              Re-record
            </button>
          </>
        )}
      </div>
    </div>
  );
}
