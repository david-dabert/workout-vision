/**
 * DirectCanvasRenderer — bypass React's render cycle for high-frequency canvas updates.
 *
 * During live pose analysis, landmark coordinates arrive at 15-30Hz. Pushing these
 * through React state (setState → reconciliation → commit → paint) adds 5-15ms of
 * overhead per frame and causes cascading re-renders of the component tree.
 *
 * This renderer writes directly to a canvas DOM node using requestAnimationFrame,
 * decoupling the visual overlay from React's lifecycle entirely.
 *
 * Usage:
 *   const renderer = new DirectCanvasRenderer(canvasElement);
 *   renderer.updateFrame(landmarks, formFeedback);  // called from analysis loop
 *   renderer.start();  // begins rAF loop
 *   renderer.stop();   // stops loop
 *   renderer.dispose(); // cleanup
 */

const CONNECTIONS = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [28, 30], [30, 32],
];

function qualityToColor(q) {
  const cq = Math.max(0, Math.min(1, q));
  let hue;
  if (cq <= 0.5) {
    hue = cq * 2 * 50;
  } else {
    hue = 50 + (cq - 0.5) * 2 * (168 - 50);
  }
  return `hsl(${Math.round(hue)}, 100%, 50%)`;
}

export class DirectCanvasRenderer {
  constructor(canvas) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._landmarks = null;
    this._formFeedback = null;
    this._repCount = 0;
    this._exerciseName = '';
    this._running = false;
    this._rafId = null;
    this._dirty = false;
    this._videoSource = null;
  }

  /**
   * Update the current frame data. Called from the analysis loop at detection frequency.
   * Does NOT trigger a draw — the rAF loop handles that at display refresh rate.
   */
  updateFrame(landmarks, formFeedback = null) {
    this._landmarks = landmarks;
    this._formFeedback = formFeedback;
    this._dirty = true;
  }

  updateRepCount(count) {
    this._repCount = count;
    this._dirty = true;
  }

  updateExerciseName(name) {
    this._exerciseName = name;
    this._dirty = true;
  }

  /**
   * Set a video element to draw as background before the skeleton overlay.
   */
  setVideoSource(videoElement) {
    this._videoSource = videoElement;
  }

  /**
   * Resize the canvas to match its CSS dimensions (fixes HiDPI blur).
   */
  resize(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._canvas.width = width * dpr;
    this._canvas.height = height * dpr;
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._dirty = true;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._tick();
  }

  stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  dispose() {
    this.stop();
    this._canvas = null;
    this._ctx = null;
    this._landmarks = null;
    this._formFeedback = null;
    this._videoSource = null;
  }

  _tick() {
    if (!this._running) return;
    if (this._dirty && this._ctx) {
      this._draw();
      this._dirty = false;
    }
    this._rafId = requestAnimationFrame(() => this._tick());
  }

  _draw() {
    const ctx = this._ctx;
    const w = this._canvas.width / (Math.min(window.devicePixelRatio || 1, 2));
    const h = this._canvas.height / (Math.min(window.devicePixelRatio || 1, 2));

    ctx.clearRect(0, 0, w, h);

    // Draw video background if available
    if (this._videoSource && this._videoSource.readyState >= 2) {
      ctx.drawImage(this._videoSource, 0, 0, w, h);
    }

    // Draw skeleton overlay
    const landmarks = this._landmarks;
    if (!landmarks || landmarks.length === 0) return;

    const ok = (lm) => lm != null && (lm.visibility == null || lm.visibility > 0.15);
    const lw = Math.max(4, Math.round(w / 60));

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Black outline for contrast
    ctx.lineWidth = lw + 3;
    ctx.strokeStyle = '#000000';
    for (const [i, j] of CONNECTIONS) {
      if (!ok(landmarks[i]) || !ok(landmarks[j])) continue;
      ctx.beginPath();
      ctx.moveTo(landmarks[i].x * w, landmarks[i].y * h);
      ctx.lineTo(landmarks[j].x * w, landmarks[j].y * h);
      ctx.stroke();
    }

    // Colored skeleton
    ctx.lineWidth = lw;
    const defaultColor = '#00f5d4';
    for (const [i, j] of CONNECTIONS) {
      if (!ok(landmarks[i]) || !ok(landmarks[j])) continue;
      ctx.strokeStyle = this._formFeedback ? this._getSegmentColor(i, j) : defaultColor;
      ctx.beginPath();
      ctx.moveTo(landmarks[i].x * w, landmarks[i].y * h);
      ctx.lineTo(landmarks[j].x * w, landmarks[j].y * h);
      ctx.stroke();
    }

    // Joint dots
    const dotR = Math.max(3, Math.round(w / 90));
    for (let k = 11; k < Math.min(landmarks.length, 33); k++) {
      if (!ok(landmarks[k])) continue;
      ctx.fillStyle = this._formFeedback ? this._getSegmentColor(k, k) : defaultColor;
      ctx.beginPath();
      ctx.arc(landmarks[k].x * w, landmarks[k].y * h, dotR, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Rep counter overlay (top-left)
    if (this._repCount > 0) {
      ctx.font = `bold ${Math.round(w / 12)}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(8, 8, ctx.measureText(`${this._repCount}`).width + 24, Math.round(w / 10));
      ctx.fillStyle = '#00f5d4';
      ctx.textBaseline = 'top';
      ctx.fillText(`${this._repCount}`, 20, 14);
    }

    ctx.restore();
  }

  _getSegmentColor(i, j) {
    if (!this._formFeedback || this._formFeedback.length === 0) return '#00f5d4';
    let minQ = 1.0;
    for (const f of this._formFeedback) {
      const q = typeof f.quality === 'number' ? f.quality : (f.passed ? 1.0 : 0.0);
      if (q < minQ) minQ = q;
    }
    return qualityToColor(minQ);
  }
}
