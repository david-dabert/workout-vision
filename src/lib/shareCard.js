/**
 * Generate a shareable summary card image from workout analysis results.
 * Renders to an offscreen canvas and returns a data URL or triggers download.
 *
 * Card dimensions: 1080x1350 (Instagram feed 4:5 ratio).
 */

import { tModule } from './LanguageContext';

function resolveText(item) {
  if (typeof item === 'string') return item;
  if (item && item.key) return tModule(item.key, item);
  return String(item);
}

const W = 1080;
const H = 1350;
const PAD = 60;
const ACCENT = '#00FF88';
const ACCENT2 = '#00D4FF';
const BG = '#06060A';
const CARD_BG = 'rgba(255,255,255,0.04)';
const CARD_BORDER = 'rgba(255,255,255,0.06)';
const TEXT = '#E8E8EF';
const MUTED = '#6B6B82';
const RED = '#FF3B5C';
const YELLOW = '#FFB836';

function gradeFromScore(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function gradeColor(score) {
  if (score >= 80) return ACCENT;
  if (score >= 60) return YELLOW;
  return RED;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * @param {object} result - analysis result from VideoUpload
 * @param {HTMLVideoElement} [videoEl] - optional video element to grab a thumbnail
 * @returns {Promise<string>} data URL of the PNG image
 */
export async function generateShareCard(result, videoEl) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background — premium gradient mesh
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  // Subtle radial accent glow top-left
  const glow1 = ctx.createRadialGradient(W * 0.2, H * 0.15, 0, W * 0.2, H * 0.15, W * 0.5);
  glow1.addColorStop(0, 'rgba(0,255,136,0.04)');
  glow1.addColorStop(1, 'transparent');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, W, H);
  // Subtle radial accent glow bottom-right
  const glow2 = ctx.createRadialGradient(W * 0.8, H * 0.85, 0, W * 0.8, H * 0.85, W * 0.4);
  glow2.addColorStop(0, 'rgba(0,212,255,0.03)');
  glow2.addColorStop(1, 'transparent');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // Video thumbnail (top section)
  let thumbH = 500;
  if (videoEl && videoEl.videoWidth > 0) {
    try {
      const vw = videoEl.videoWidth;
      const vh = videoEl.videoHeight;
      const aspect = vw / vh;
      const drawW = W;
      const drawH = W / aspect;
      thumbH = Math.min(drawH, 500);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, thumbH);
      ctx.clip();
      ctx.drawImage(videoEl, 0, 0, drawW, drawH);
      // Dark gradient overlay
      const grad = ctx.createLinearGradient(0, thumbH - 150, 0, thumbH);
      grad.addColorStop(0, 'rgba(13,13,15,0)');
      grad.addColorStop(1, 'rgba(13,13,15,1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, thumbH - 150, W, 150);
      ctx.restore();
    } catch (e) {
      thumbH = 0;
    }
  } else {
    thumbH = 0;
  }

  let y = Math.max(thumbH, 40);

  // Grade badge (top right)
  const grade = gradeFromScore(result.formScore);
  const gc = gradeColor(result.formScore);
  const badgeSize = 100;
  const bx = W - PAD - badgeSize;
  const by = y + 10;
  roundRect(ctx, bx, by, badgeSize, badgeSize, 20);
  ctx.fillStyle = gc;
  ctx.fill();
  ctx.fillStyle = BG;
  ctx.font = 'bold 48px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(grade, bx + badgeSize / 2, by + badgeSize / 2);

  // Exercise name
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 56px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(result.exerciseName, PAD, y + 20);

  // Duration subtitle
  ctx.fillStyle = MUTED;
  ctx.font = '28px -apple-system, system-ui, sans-serif';
  ctx.fillText(formatTime(result.duration), PAD, y + 88);

  y += 150;

  // Stats row
  const stats = [
    { value: `${result.reps}`, label: 'REPS' },
    { value: `${result.formScore}`, label: 'FORM' },
    { value: result.bioAnalysis?.movementQuality != null ? `${Math.round(result.bioAnalysis.movementQuality)}` : '--', label: 'QUALITY' },
  ];

  if (result.bioAnalysis?.asymmetry?.score != null) {
    stats.push({ value: `${Math.round(result.bioAnalysis.asymmetry.score)}%`, label: 'SYMMETRY' });
  }

  // Stats card — glass effect with border
  const statsCardH = 160;
  roundRect(ctx, PAD, y, W - PAD * 2, statsCardH, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  ctx.fill();
  roundRect(ctx, PAD, y, W - PAD * 2, statsCardH, 20);
  ctx.strokeStyle = CARD_BORDER;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const statW = (W - PAD * 2) / stats.length;
  stats.forEach((s, i) => {
    const cx = PAD + statW * i + statW / 2;
    ctx.fillStyle = ACCENT;
    ctx.font = 'bold 52px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(s.value, cx, y + 30);

    ctx.fillStyle = MUTED;
    ctx.font = '600 22px -apple-system, system-ui, sans-serif';
    ctx.fillText(s.label, cx, y + 100);
  });

  y += statsCardH + 30;

  // Per-rep quality bars
  if (result.repHistory && result.repHistory.length > 0) {
    ctx.fillStyle = TEXT;
    ctx.font = 'bold 32px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Rep Quality', PAD, y);
    y += 50;

    const barsH = 180;
    roundRect(ctx, PAD, y, W - PAD * 2, barsH, 16);
    ctx.fillStyle = CARD_BG;
    ctx.fill();

    const barPad = 20;
    const barAreaW = W - PAD * 2 - barPad * 2;
    const barAreaH = barsH - barPad * 2 - 30;
    const gap = 6;
    const barW = Math.max(8, (barAreaW - gap * (result.repHistory.length - 1)) / result.repHistory.length);

    result.repHistory.forEach((r, i) => {
      const score = r.score || 0;
      const barH = Math.max(4, (score / 100) * barAreaH);
      const bx = PAD + barPad + i * (barW + gap);
      const by = y + barPad + barAreaH - barH;

      roundRect(ctx, bx, by, barW, barH, 3);
      ctx.fillStyle = score >= 80 ? ACCENT : score >= 50 ? YELLOW : RED;
      ctx.fill();

      // Rep number
      ctx.fillStyle = MUTED;
      ctx.font = '18px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, bx + barW / 2, y + barPad + barAreaH + 6);
    });

    y += barsH + 30;
  }

  // Form notes (top 3 issues)
  if (result.repHistory && result.repHistory.length > 0) {
    const allIssues = {};
    result.repHistory.forEach(r => {
      (r.issues || []).forEach(issue => {
        allIssues[issue] = (allIssues[issue] || 0) + 1;
      });
    });
    const sorted = Object.entries(allIssues).sort((a, b) => b[1] - a[1]).slice(0, 3);
    if (sorted.length > 0) {
      ctx.fillStyle = TEXT;
      ctx.font = 'bold 32px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Form Notes', PAD, y);
      y += 50;

      sorted.forEach(([issue, count]) => {
        ctx.fillStyle = YELLOW;
        ctx.font = '26px -apple-system, system-ui, sans-serif';
        ctx.fillText(`! ${issue} (${count}/${result.repHistory.length} reps)`, PAD + 10, y);
        y += 40;
      });
      y += 10;
    }
  }

  // Highlights
  if (result.report?.highlights?.length > 0) {
    ctx.fillStyle = TEXT;
    ctx.font = 'bold 32px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Highlights', PAD, y);
    y += 50;

    result.report.highlights.slice(0, 2).forEach(h => {
      ctx.fillStyle = ACCENT;
      ctx.font = '26px -apple-system, system-ui, sans-serif';
      const maxW = W - PAD * 2 - 20;
      wrapText(ctx, `> ${resolveText(h)}`, PAD + 10, y, maxW, 36);
      y += 44;
    });
    y += 10;
  }

  // Branding footer — gradient text effect via overlay
  const footerY = H - 90;
  // Accent gradient line separator
  const sepGrad = ctx.createLinearGradient(PAD * 3, 0, W - PAD * 3, 0);
  sepGrad.addColorStop(0, 'transparent');
  sepGrad.addColorStop(0.2, 'rgba(0,255,136,0.3)');
  sepGrad.addColorStop(0.8, 'rgba(0,212,255,0.3)');
  sepGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = sepGrad;
  ctx.fillRect(PAD * 3, footerY - 20, W - PAD * 6, 1.5);
  // Brand name
  ctx.fillStyle = ACCENT;
  ctx.font = '800 38px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WorkoutVision', W / 2, footerY + 10);
  ctx.fillStyle = MUTED;
  ctx.font = '500 22px -apple-system, system-ui, sans-serif';
  ctx.fillText('AI-Powered Form Analysis', W / 2, footerY + 52);

  return canvas.toDataURL('image/png');
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, y);
      line = word + ' ';
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, y);
}

/**
 * Download the share card as a PNG.
 */
export async function downloadShareCard(result, videoEl) {
  const dataUrl = await generateShareCard(result, videoEl);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `workout-${result.exerciseName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.png`;
  a.click();
}

/**
 * Share via Web Share API if available, otherwise download.
 */
export async function shareCard(result, videoEl) {
  const dataUrl = await generateShareCard(result, videoEl);

  if (navigator.share && navigator.canShare) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `workout-${result.exerciseName.replace(/\s+/g, '-')}.png`, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${result.exerciseName} - ${gradeFromScore(result.formScore)}`,
          text: `${result.reps} reps, Form: ${result.formScore}/100`,
        });
        return;
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  // Fallback: download
  downloadShareCard(result, videoEl);
}


/* ══════════════════════════════════════════════════════════════════════
   ANIMATED SHARE CARD — 3.5s MP4 Reel for Instagram/TikTok virality
   Spring-animated bars, grade badge drop, staggered reveals.
   ══════════════════════════════════════════════════════════════════════ */

function springEase(t) {
  // Attempt spring curve: overshoot then settle
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c4 = (2 * Math.PI) / 3;
  return 1 + Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) * -1;
}

function easeOut(t) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function drawAnimatedBackground(ctx, w, h) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  const glow1 = ctx.createRadialGradient(w * 0.2, h * 0.15, 0, w * 0.2, h * 0.15, w * 0.5);
  glow1.addColorStop(0, 'rgba(0,255,136,0.04)');
  glow1.addColorStop(1, 'transparent');
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, w, h);
  const glow2 = ctx.createRadialGradient(w * 0.8, h * 0.85, 0, w * 0.8, h * 0.85, w * 0.4);
  glow2.addColorStop(0, 'rgba(0,212,255,0.03)');
  glow2.addColorStop(1, 'transparent');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Generate an animated share card as a WebM video blob.
 * 3.5s at 30fps with spring-animated reveals.
 * @param {object} result - analysis result
 * @param {function} [onProgress] - (0-100) progress callback
 * @returns {Promise<Blob>} WebM video blob
 */
export async function generateAnimatedShareCard(result, onProgress) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const FPS = 30;
  const DURATION = 3.5;
  const TOTAL_FRAMES = Math.round(DURATION * FPS);

  const stream = canvas.captureStream(FPS);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_000_000,
  });

  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const grade = gradeFromScore(result.formScore);
  const gc = gradeColor(result.formScore);
  const repHistory = result.repHistory || [];
  const stats = [
    { value: `${result.reps}`, label: 'REPS' },
    { value: `${result.formScore}`, label: 'FORM' },
  ];
  if (result.bioAnalysis?.movementQuality != null) {
    stats.push({ value: `${Math.round(result.bioAnalysis.movementQuality)}`, label: 'QUALITY' });
  }

  recorder.start();

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const t = i / FPS; // seconds elapsed

    // Clear and draw background
    drawAnimatedBackground(ctx, W, H);

    // ─── Exercise name (appears at 0.2s) ───
    const nameProgress = easeOut((t - 0.2) / 0.4);
    if (nameProgress > 0) {
      const nameOffset = lerp(30, 0, nameProgress);
      ctx.globalAlpha = nameProgress;
      ctx.fillStyle = TEXT;
      ctx.font = 'bold 56px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(result.exerciseName, PAD, 80 + nameOffset);
      // Duration
      ctx.fillStyle = MUTED;
      ctx.font = '28px -apple-system, system-ui, sans-serif';
      ctx.fillText(formatTime(result.duration), PAD, 148 + nameOffset);
      ctx.globalAlpha = 1;
    }

    // ─── Rep quality bars (staggered from 0.5s) ───
    if (repHistory.length > 0 && t > 0.5) {
      const barsY = 220;
      const barsH = 280;
      // Card background
      const cardAlpha = easeOut((t - 0.45) / 0.3);
      ctx.globalAlpha = cardAlpha;
      roundRect(ctx, PAD, barsY, W - PAD * 2, barsH, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.fill();
      roundRect(ctx, PAD, barsY, W - PAD * 2, barsH, 20);
      ctx.strokeStyle = CARD_BORDER;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Label
      if (t > 0.55) {
        const labelAlpha = easeOut((t - 0.55) / 0.3);
        ctx.globalAlpha = labelAlpha;
        ctx.fillStyle = TEXT;
        ctx.font = 'bold 28px -apple-system, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Rep Quality', PAD + 24, barsY + 40);
        ctx.globalAlpha = 1;
      }

      // Bars
      const barPad = 24;
      const barAreaW = W - PAD * 2 - barPad * 2;
      const barAreaH = barsH - 80;
      const barTop = barsY + 60;
      const gap = 8;
      const barW = Math.max(12, (barAreaW - gap * (repHistory.length - 1)) / repHistory.length);

      repHistory.forEach((r, idx) => {
        const barStart = 0.6 + idx * 0.08;
        const barProgress = springEase((t - barStart) / 0.5);
        if (barProgress <= 0) return;

        const score = r.score || 0;
        const maxBarH = (score / 100) * barAreaH;
        const barH = Math.max(4, maxBarH * barProgress);
        const bx = PAD + barPad + idx * (barW + gap);
        const by = barTop + barAreaH - barH;

        roundRect(ctx, bx, by, barW, barH, 4);
        ctx.fillStyle = score >= 80 ? ACCENT : score >= 50 ? YELLOW : RED;
        ctx.fill();

        // Rep number
        if (barProgress > 0.5) {
          ctx.globalAlpha = Math.min(1, (barProgress - 0.5) * 2);
          ctx.fillStyle = MUTED;
          ctx.font = '20px -apple-system, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${idx + 1}`, bx + barW / 2, barTop + barAreaH + 24);
          ctx.globalAlpha = 1;
        }
      });
    }

    // ─── Grade badge (appears at 1.4s with spring overshoot) ───
    const badgeStart = 1.4;
    const badgeProgress = springEase((t - badgeStart) / 0.45);
    if (badgeProgress > 0) {
      const badgeSize = 120;
      const bx = W - PAD - badgeSize;
      const by = 70;
      const scale = badgeProgress;
      ctx.save();
      ctx.translate(bx + badgeSize / 2, by + badgeSize / 2);
      ctx.scale(scale, scale);
      roundRect(ctx, -badgeSize / 2, -badgeSize / 2, badgeSize, badgeSize, 24);
      ctx.fillStyle = gc;
      ctx.fill();
      // Shadow glow
      ctx.shadowColor = gc;
      ctx.shadowBlur = 30 * badgeProgress;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = BG;
      ctx.font = 'bold 52px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(grade, 0, 0);
      ctx.restore();
    }

    // ─── Stats row (appears at 2.0s) ───
    const statsProgress = easeOut((t - 2.0) / 0.4);
    if (statsProgress > 0) {
      const statsY = 560;
      const statsCardH = 140;
      ctx.globalAlpha = statsProgress;
      roundRect(ctx, PAD, statsY, W - PAD * 2, statsCardH, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.fill();
      roundRect(ctx, PAD, statsY, W - PAD * 2, statsCardH, 20);
      ctx.strokeStyle = CARD_BORDER;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const statW = (W - PAD * 2) / stats.length;
      stats.forEach((s, i) => {
        const cx = PAD + statW * i + statW / 2;
        ctx.fillStyle = ACCENT;
        ctx.font = 'bold 52px -apple-system, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(s.value, cx, statsY + 25);
        ctx.fillStyle = MUTED;
        ctx.font = '600 22px -apple-system, system-ui, sans-serif';
        ctx.fillText(s.label, cx, statsY + 90);
      });
      ctx.globalAlpha = 1;
    }

    // ─── Footer (appears at 2.5s) ───
    const footerProgress = easeOut((t - 2.5) / 0.4);
    if (footerProgress > 0) {
      const footerY = H - 100;
      const footerOffset = lerp(20, 0, footerProgress);
      ctx.globalAlpha = footerProgress;
      // Gradient separator
      const sepGrad = ctx.createLinearGradient(PAD * 3, 0, W - PAD * 3, 0);
      sepGrad.addColorStop(0, 'transparent');
      sepGrad.addColorStop(0.2, 'rgba(0,255,136,0.3)');
      sepGrad.addColorStop(0.8, 'rgba(0,212,255,0.3)');
      sepGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sepGrad;
      ctx.fillRect(PAD * 3, footerY - 30 + footerOffset, W - PAD * 6, 1.5);
      // Brand
      ctx.fillStyle = ACCENT;
      ctx.font = '800 38px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WorkoutVision', W / 2, footerY + footerOffset);
      ctx.fillStyle = MUTED;
      ctx.font = '500 22px -apple-system, system-ui, sans-serif';
      ctx.fillText('AI-Powered Form Analysis', W / 2, footerY + 42 + footerOffset);
      ctx.globalAlpha = 1;
    }

    // Wait for next frame
    await new Promise(r => requestAnimationFrame(r));
    if (onProgress) onProgress(Math.round((i / TOTAL_FRAMES) * 100));
  }

  recorder.stop();

  return new Promise((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
  });
}

/**
 * Share animated card as a Reel/video.
 * Falls back to static image if MediaRecorder is unavailable.
 */
export async function shareAnimatedCard(result, onProgress) {
  // Check MediaRecorder + captureStream support
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) {
    return shareCard(result, null);
  }

  const blob = await generateAnimatedShareCard(result, onProgress);
  const file = new File(
    [blob],
    `workout-${result.exerciseName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.webm`,
    { type: blob.type }
  );

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${result.exerciseName} - ${gradeFromScore(result.formScore)}`,
        text: `${result.reps} reps, Form: ${result.formScore}/100`,
      });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  // Fallback: download the video
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
