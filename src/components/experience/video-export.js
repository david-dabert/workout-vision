// Step 4: the set's video with its overlay, recorded on the phone and offered through the share sheet.
// The video is played once, muted, into a canvas where each frame is drawn with the skeleton the pose
// model tracked and the reps counted so far; the canvas is recorded as it plays (MediaRecorder, which
// Safari on iPhone offers from iOS 14.5, in MP4 with H.264). Nothing is sent anywhere: the file goes
// to the share sheet only when the user taps it there.
import { liftDefinition } from '../../lib/counting/core';
import { poseAt } from './replay-track';
import { drawSkeleton, litSides, LAMP } from './replay-draw';
import { overlayLines } from './replay-labels';

const MIMES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];

/** The first format the browser records, MP4 first; '' when it records none. */
export function pickMime(supported) {
  return MIMES.find(m => { try { return supported(m); } catch { return false; } }) || '';
}

/**
 * Whether a share that did not end well failed: a cancel (AbortError) or a second sheet asked while one is open
 * (InvalidStateError) did not; anything else did, and the video is then offered to save (Astra's audit: a failed
 * share said nothing).
 */
export const shareFailed = e => e?.name !== 'AbortError' && e?.name !== 'InvalidStateError';

export const exportFileName = (lift, mime) => `workoutvision-${String(lift).replace(/_/g, '-')}.${mime.startsWith('video/mp4') ? 'mp4' : 'webm'}`;

/** The recorded size: the picture's proportions, at most 1280 px on the long side, in even pixels. */
export function exportSize(w, h) {
  const k = Math.min(1, 1280 / Math.max(w, h)), even = x => Math.max(2, Math.floor((x * k) / 2) * 2);
  return [even(w), even(h)];
}

export const canExport = () => typeof MediaRecorder !== 'undefined'
  && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype
  && pickMime(m => MediaRecorder.isTypeSupported(m)) !== '';

/**
 * Records the set. onProgress(0..1) follows the video; signal aborts it. Resolves with the File; rejects
 * when the video pauses before its end ('interrupted': the screen locked, the app was left), stops
 * advancing for five seconds ('stalled'), cannot play, or the recorder fails; the recorder and its
 * capture are stopped on every path (review 01 of step 4). Call it inside the tap: the video starts
 * playing there, since Safari on iPhone may load nothing, and may refuse to play, outside a tap.
 */
export function exportSetVideo({ file, result, lift, fr = false, saved = null, onProgress, signal }) {
  return new Promise((resolve, reject) => {
    const mime = pickMime(m => MediaRecorder.isTypeSupported(m));
    if (!mime) { reject(new Error('no-format')); return; }
    const def = liftDefinition(lift), sides = litSides(def, result.arm);
    const frames = result.imageLandmarks || [], times = result.timestamps || [];
    const reps = (!result.refused && result.reps) || [];
    const url = URL.createObjectURL(file);
    // Safari decodes a video only while it is in the page; this one is there, out of sight.
    const video = Object.assign(document.createElement('video'), { src: url, muted: true, playsInline: true, preload: 'auto' });
    video.setAttribute('playsinline', '');
    Object.assign(video.style, { position: 'fixed', left: '0', top: '0', width: '2px', height: '2px', opacity: '0', pointerEvents: 'none' });
    document.body.appendChild(video);
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    let recorder = null, stream = null, vfc = 0, raf = 0, watch = 0, done = false, lastT = -1, lastMove = Date.now();
    const chunks = [];
    const finish = (err, out) => {
      if (done) return;
      done = true;
      clearInterval(watch);
      if (vfc && 'cancelVideoFrameCallback' in video) video.cancelVideoFrameCallback(vfc);
      cancelAnimationFrame(raf);
      if (recorder && recorder.state === 'recording') { recorder.onstop = null; recorder.ondataavailable = null; try { recorder.stop(); } catch { /* already stopping */ } }
      stream?.getTracks().forEach(t => t.stop());
      chunks.length = err ? 0 : chunks.length;
      video.pause(); video.remove(); URL.revokeObjectURL(url);
      if (err) reject(err); else resolve(out);
    };
    signal?.addEventListener('abort', () => finish(new DOMException('aborted', 'AbortError')));

    const draw = t => {
      const W = canvas.width, H = canvas.height, u = W / 390;
      ctx.drawImage(video, 0, 0, W, H);
      const lm = poseAt(frames, times, t);
      if (lm) drawSkeleton(ctx, lm, { ox: 0, oy: 0, w: W, h: H }, sides, def, u);
      if (reps.length) {
        // The reps begun so far, as the replay's chip shows them: "3 / 8"; after a correction, a second
        // line says both counts, so the video explains itself away from the app (replay-labels.js).
        const begun = reps.filter(r => r.startTime <= t).length, pad = 16 * u;
        const [label, note] = overlayLines({ begun, total: reps.length, detected: result.count, saved, fr });
        ctx.font = `${Math.round(30 * u)}px Georgia, serif`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(8, 7, 6, 0.55)';
        const w = ctx.measureText(label).width;
        ctx.fillRect(pad - 10 * u, pad - 8 * u, w + 20 * u, 46 * u);
        ctx.fillStyle = LAMP;
        ctx.fillText(label, pad, pad);
        if (note) {
          ctx.font = `${Math.round(13 * u)}px system-ui, sans-serif`;
          const nw = Math.min(ctx.measureText(note).width, W - 2 * pad);
          ctx.fillStyle = 'rgba(8, 7, 6, 0.55)';
          ctx.fillRect(pad - 10 * u, pad + 46 * u, nw + 20 * u, 26 * u);
          ctx.fillStyle = LAMP;
          ctx.fillText(note, pad, pad + 52 * u, W - 2 * pad);
        }
      }
      onProgress?.(video.duration ? Math.min(1, t / video.duration) : 0);
    };
    const onFrame = (_, m) => { if (done) return; draw(m?.mediaTime ?? video.currentTime); vfc = video.requestVideoFrameCallback(onFrame); };
    const loop = () => { if (done) return; draw(video.currentTime); raf = requestAnimationFrame(loop); };

    video.addEventListener('error', () => finish(new Error('unreadable')), { once: true });
    // At the end the browser pauses, then ends: a pause before the end is an interruption.
    video.addEventListener('pause', () => { if (!video.ended) finish(new Error('interrupted')); });
    video.addEventListener('ended', () => {
      draw(video.duration || video.currentTime); onProgress?.(1);
      setTimeout(() => { if (!done && recorder?.state === 'recording') recorder.stop(); }, 120);
    }, { once: true });
    video.addEventListener('playing', () => {
      if (done || recorder) return;
      try {
        [canvas.width, canvas.height] = exportSize(video.videoWidth || 720, video.videoHeight || 1280);
        draw(video.currentTime);
        stream = canvas.captureStream(30);
        recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
        recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
        recorder.onerror = e => finish(e.error || new Error('recorder'));
        recorder.onstop = () => finish(null, new File(chunks, exportFileName(lift, mime), { type: mime.split(';')[0] }));
        recorder.start(1000);
      } catch (e) { finish(e); return; }
      if ('requestVideoFrameCallback' in video) vfc = video.requestVideoFrameCallback(onFrame); else raf = requestAnimationFrame(loop);
      watch = setInterval(() => {
        if (video.currentTime !== lastT) { lastT = video.currentTime; lastMove = Date.now(); }
        else if (Date.now() - lastMove > 5000) finish(new Error('stalled'));
      }, 1000);
    });
    // Played here, inside the tap that called this.
    try { video.play()?.catch(e => finish(e)); } catch (e) { finish(e); }
  });
}
