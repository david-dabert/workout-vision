/**
 * Generate a shareable summary card image from workout analysis results.
 * Renders to an offscreen canvas and returns a data URL or triggers download.
 *
 * Card dimensions: 1080x1920 (Instagram Stories 9:16 ratio).
 */

import { tModule } from './LanguageContext';
import { gradeFromScore, getRecorderMimeType } from './utils';


const APP_URL = 'david-dabert.github.io/workout-vision';

function resolveText(item) {
  if (typeof item === 'string') return item;
  if (item && item.key) return tModule(item.key, item);
  return String(item);
}

const W = 1080;
const H = 1920;
const PAD = 60;
const ACCENT = '#00f5d4';
const ACCENT2 = '#00e676';
const BG = '#000000';
const CARD_BG = 'rgba(255,255,255,0.012)';
const CARD_BORDER = 'rgba(255,255,255,0.05)';
const TEXT = '#f0f0f5';
const MUTED = '#6B6B82';
const RED = '#FF3B5C';
const YELLOW = '#FFB836';

function gradeColor(score) {
  if (score >= 80) return ACCENT;
  if (score >= 60) return YELLOW;
  return RED;
}

function gradeMotivation(grade) {
  if (grade === 'A+') return 'Perfect Form 🔥';
  if (grade === 'A')  return 'Elite Level 🏆';
  if (grade === 'B+') return 'Almost Perfect ⚡';
  if (grade === 'B')  return 'Strong Set 💪';
  if (grade === 'C+') return 'Keep Pushing 📈';
  if (grade === 'C')  return 'Room to Grow 🎯';
  return 'Never Stop 🔄';
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

  // ── Background ──────────────────────────────────────────────────────────
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Radial glow top-center (grade badge area)
  const glowTop = ctx.createRadialGradient(W / 2, H * 0.18, 0, W / 2, H * 0.18, W * 0.55);
  glowTop.addColorStop(0, 'rgba(0,245,212,0.07)');
  glowTop.addColorStop(1, 'transparent');
  ctx.fillStyle = glowTop;
  ctx.fillRect(0, 0, W, H);

  // Radial glow bottom-right
  const glow2 = ctx.createRadialGradient(W * 0.8, H * 0.85, 0, W * 0.8, H * 0.85, W * 0.45);
  glow2.addColorStop(0, 'rgba(0,212,255,0.04)');
  glow2.addColorStop(1, 'transparent');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  const grade = gradeFromScore(result.formScore);
  const gc = gradeColor(result.formScore);

  // ── Video thumbnail strip (optional, capped at 400px) ───────────────────
  let thumbH = 0;
  if (videoEl && videoEl.videoWidth > 0) {
    try {
      const aspect = videoEl.videoWidth / videoEl.videoHeight;
      const drawH = Math.min(W / aspect, 400);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, drawH);
      ctx.clip();
      ctx.drawImage(videoEl, 0, 0, W, drawH);
      const grad = ctx.createLinearGradient(0, drawH - 120, 0, drawH);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, drawH - 120, W, 120);
      ctx.restore();
      thumbH = drawH;
    } catch (e) {
      thumbH = 0;
    }
  }

  // ── Grade badge — large, centered, glowing ──────────────────────────────
  const badgeSize = 200;
  const badgeY = thumbH + 60;
  const badgeCX = W / 2;
  const badgeCY = badgeY + badgeSize / 2;

  // Outer glow ring
  ctx.save();
  ctx.shadowColor = gc;
  ctx.shadowBlur = 60;
  roundRect(ctx, badgeCX - badgeSize / 2, badgeY, badgeSize, badgeSize, 36);
  ctx.fillStyle = gc;
  ctx.fill();
  ctx.restore();

  // Badge face
  roundRect(ctx, badgeCX - badgeSize / 2, badgeY, badgeSize, badgeSize, 36);
  ctx.fillStyle = gc;
  ctx.fill();

  // Grade letter
  ctx.fillStyle = BG;
  ctx.font = 'bold 100px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(grade, badgeCX, badgeCY);

  // ── Motivational one-liner ───────────────────────────────────────────────
  const motto = gradeMotivation(grade);
  ctx.fillStyle = gc;
  ctx.font = 'bold 44px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(motto, W / 2, badgeY + badgeSize + 28);

  // ── Exercise name + duration ─────────────────────────────────────────────
  let y = badgeY + badgeSize + 110;

  ctx.fillStyle = TEXT;
  ctx.font = 'bold 62px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(result.exerciseName, W / 2, y);
  y += 80;

  ctx.fillStyle = MUTED;
  ctx.font = '32px -apple-system, system-ui, sans-serif';
  ctx.fillText(formatTime(result.duration), W / 2, y);
  y += 70;

  // ── Stats card — big, bold ───────────────────────────────────────────────
  const weight = result.weight || 0;
  const volume = weight > 0 ? `${weight * result.reps}kg` : `${result.reps}`;
  const stats = [
    { value: `${result.reps}`, label: 'REPS' },
    { value: result.formScore != null ? `${result.formScore}` : '--', label: 'FORM' },
    { value: volume, label: 'VOLUME' },
  ];
  if (result.bioAnalysis?.asymmetry?.score != null) {
    stats.push({ value: `${Math.round(result.bioAnalysis.asymmetry.score)}%`, label: 'SYMMETRY' });
  }

  const statsCardH = 200;
  roundRect(ctx, PAD, y, W - PAD * 2, statsCardH, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fill();
  roundRect(ctx, PAD, y, W - PAD * 2, statsCardH, 24);
  ctx.strokeStyle = 'rgba(0,245,212,0.15)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const statW = (W - PAD * 2) / stats.length;
  stats.forEach((s, i) => {
    const cx = PAD + statW * i + statW / 2;
    ctx.fillStyle = ACCENT;
    ctx.font = 'bold 72px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(s.value, cx, y + 34);
    ctx.fillStyle = MUTED;
    ctx.font = '600 24px -apple-system, system-ui, sans-serif';
    ctx.fillText(s.label, cx, y + 130);
  });
  y += statsCardH + 40;

  // ── Per-rep quality bars ─────────────────────────────────────────────────
  if (result.repHistory && result.repHistory.length > 0) {
    ctx.fillStyle = TEXT;
    ctx.font = 'bold 34px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Rep Quality', PAD, y);
    y += 52;

    const barsH = 200;
    roundRect(ctx, PAD, y, W - PAD * 2, barsH, 18);
    ctx.fillStyle = CARD_BG;
    ctx.fill();

    const barPad = 22;
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
      ctx.fillStyle = MUTED;
      ctx.font = '18px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, bx + barW / 2, y + barPad + barAreaH + 6);
    });
    y += barsH + 36;
  }

  // ── Form notes ───────────────────────────────────────────────────────────
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
      ctx.font = 'bold 34px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('Form Notes', PAD, y);
      y += 52;
      sorted.forEach(([issue, count]) => {
        ctx.fillStyle = YELLOW;
        ctx.font = '28px -apple-system, system-ui, sans-serif';
        ctx.fillText(`! ${issue} (${count}/${result.repHistory.length} reps)`, PAD + 10, y);
        y += 42;
      });
      y += 12;
    }
  }

  // ── Highlights ───────────────────────────────────────────────────────────
  if (result.report?.highlights?.length > 0) {
    ctx.fillStyle = TEXT;
    ctx.font = 'bold 34px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('Highlights', PAD, y);
    y += 52;
    result.report.highlights.slice(0, 2).forEach(h => {
      ctx.fillStyle = ACCENT;
      ctx.font = '28px -apple-system, system-ui, sans-serif';
      wrapText(ctx, `> ${resolveText(h)}`, PAD + 10, y, W - PAD * 2 - 20, 38);
      y += 46;
    });
    y += 12;
  }

  // ── QR + CTA ─────────────────────────────────────────────────────────────
  // Pin the CTA block to 200px above footer, pushing up only if content hasn't reached there
  const ctaBlockH = 280; // challenge text + qr + scan label
  const footerH = 120;
  const ctaY = Math.max(y + 20, H - footerH - ctaBlockH - 20);

  ctx.fillStyle = TEXT;
  ctx.font = 'bold 38px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Can you beat my form? 💪', W / 2, ctaY);

  // QR code removed — was a fake pattern generator, not a real encoder.
  // Replace with a real QR library when share-card linking is needed.

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = H - footerH;
  const sepGrad = ctx.createLinearGradient(PAD * 2, 0, W - PAD * 2, 0);
  sepGrad.addColorStop(0, 'transparent');
  sepGrad.addColorStop(0.2, 'rgba(0,245,212,0.35)');
  sepGrad.addColorStop(0.8, 'rgba(0,212,255,0.35)');
  sepGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = sepGrad;
  ctx.fillRect(PAD * 2, footerY - 2, W - PAD * 4, 1.5);

  ctx.fillStyle = ACCENT;
  ctx.font = '800 40px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('WorkoutVision', W / 2, footerY + 10);

  ctx.fillStyle = MUTED;
  ctx.font = '500 24px -apple-system, system-ui, sans-serif';
  ctx.fillText(APP_URL, W / 2, footerY + 60);

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
 * Generate a challenge share text for virality.
 */
export function getChallengeText(result) {
  const grade = gradeFromScore(result.formScore);
  return `I just scored ${result.formScore}/100 (${grade}) on ${result.exerciseName} (${result.reps} reps). Can you beat my form? 💪 Try WorkoutVision → ${APP_URL}`;
}

/**
 * Share a challenge via Web Share API or clipboard fallback.
 * Returns 'shared' | 'copied' | 'failed'.
 */
export async function challengeShare(result, videoEl) {
  const text = getChallengeText(result);

  // Try Web Share API with image
  if (navigator.share) {
    try {
      const dataUrl = await generateShareCard(result, videoEl);
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `workout-challenge-${result.exerciseName.replace(/\s+/g, '-')}.png`, { type: 'image/png' });

      const shareData = { text, title: `WorkoutVision Challenge: ${result.exerciseName}` };
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        shareData.files = [file];
      }
      await navigator.share(shareData);
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'failed';
      // Fall through to clipboard
    }
  }

  // Clipboard fallback
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
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
  glow1.addColorStop(0, 'rgba(0,245,212,0.04)');
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
  // Respect prefers-reduced-motion: fall back to static card
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return generateShareCard(result);
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const FPS = 30;
  const DURATION = 3.5;
  const TOTAL_FRAMES = Math.round(DURATION * FPS);

  const stream = canvas.captureStream(FPS);
  const mimeType = getRecorderMimeType();
  if (!mimeType) return generateShareCard(result);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: mimeType.includes('mp4') ? 6_000_000 : 4_000_000,
  });

  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const grade = gradeFromScore(result.formScore);
  const gc = gradeColor(result.formScore);
  const repHistory = result.repHistory || [];
  const cWeight = result.weight || 0;
  const cVolume = cWeight > 0 ? `${cWeight * result.reps}kg` : `${result.reps}`;
  const stats = [
    { value: `${result.reps}`, label: 'REPS' },
    { value: result.formScore != null ? `${result.formScore}` : '--', label: 'FORM' },
    { value: cVolume, label: 'VOLUME' },
  ];

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
      sepGrad.addColorStop(0.2, 'rgba(0,245,212,0.3)');
      sepGrad.addColorStop(0.8, 'rgba(0,212,255,0.3)');
      sepGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sepGrad;
      ctx.fillRect(PAD * 3, footerY - 30 + footerOffset, W - PAD * 6, 1.5);
      // Brand
      ctx.fillStyle = ACCENT;
      ctx.font = '800 40px -apple-system, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WorkoutVision', W / 2, footerY + footerOffset);
      ctx.fillStyle = MUTED;
      ctx.font = '500 24px -apple-system, system-ui, sans-serif';
      ctx.fillText(APP_URL, W / 2, footerY + 48 + footerOffset);
      ctx.globalAlpha = 1;
    }

    // Yield to browser every 5 frames so spinner repaints
    if (i % 5 === 0) {
      if (onProgress) onProgress(Math.round((i / TOTAL_FRAMES) * 100));
      await new Promise(r => setTimeout(r, 0));
    } else {
      await new Promise(r => requestAnimationFrame(r));
    }
  }

  recorder.stop();

  return new Promise((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: mimeType }));
    };
  });
}

/* ══════════════════════════════════════════════════════════════════════
   FORM CARD — 1080x1920 Instagram Stories card with circular gauge.
   Canvas-only, no external deps. Exported as the primary Change-7 API.
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Draw a circular arc gauge.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {number} score - 0..100
 */
function drawFormGauge(ctx, cx, cy, r, score) {
  const startAngle = Math.PI * 0.75;
  const fullSweep = Math.PI * 1.5;
  const fillAngle = startAngle + (score / 100) * fullSweep;
  const endAngle = startAngle + fullSweep;

  // Track
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 28;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Fill
  const color = score >= 80 ? ACCENT : score >= 60 ? YELLOW : RED;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, fillAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = 28;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Score text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.font = `bold ${r * 0.72}px -apple-system, system-ui, sans-serif`;
  ctx.fillText(String(Math.round(score)), cx, cy);

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `${r * 0.25}px -apple-system, system-ui, sans-serif`;
  ctx.fillText('/100', cx, cy + r * 0.48);
}

/**
 * Draw per-rep quality bars.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} totalW
 * @param {number} totalH
 * @param {Array<{score:number}>} repHistory
 */
function drawFormRepBars(ctx, x, y, totalW, totalH, repHistory) {
  if (!repHistory || repHistory.length === 0) return;
  const slotW = totalW / repHistory.length;
  const gap = Math.max(2, slotW * 0.12);
  repHistory.forEach((rep, i) => {
    const score = rep.score || 0;
    const barColor = score >= 80 ? ACCENT : score >= 60 ? YELLOW : RED;
    const barH = Math.max(totalH * 0.15, (score / 100) * totalH);
    const bx = x + i * slotW + gap / 2;
    const bw = slotW - gap;
    const by = y + totalH - barH;
    roundRect(ctx, bx, by, bw, barH, 4);
    ctx.fillStyle = barColor;
    ctx.fill();
  });
}

/**
 * Generate a 1080x1920 Form Card PNG and return it as a Blob.
 * @param {object} result - workout analysis result
 * @returns {Promise<Blob>}
 */
export async function generateFormCard(result) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Radial glow
  const glow = ctx.createRadialGradient(W / 2, 900, 0, W / 2, 900, 600);
  glow.addColorStop(0, 'rgba(0,245,212,0.06)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // App logo
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = 'bold 72px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = ACCENT;
  ctx.fillText('WorkoutVision', W / 2, 160);

  // Accent line
  ctx.beginPath();
  ctx.moveTo(W / 2 - 200, 185);
  ctx.lineTo(W / 2 + 200, 185);
  ctx.strokeStyle = 'rgba(0,245,212,0.30)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Exercise name
  const exerciseName = result.exerciseName || result.exercise || 'Workout';
  let nameFontSize = 100;
  ctx.font = `bold ${nameFontSize}px -apple-system, system-ui, sans-serif`;
  while (ctx.measureText(exerciseName).width > W - 120 && nameFontSize > 50) {
    nameFontSize -= 4;
    ctx.font = `bold ${nameFontSize}px -apple-system, system-ui, sans-serif`;
  }
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(exerciseName, W / 2, 340);

  // Form score label
  ctx.font = '48px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.50)';
  ctx.fillText('FORM SCORE', W / 2, 450);

  // Gauge
  const score = result.formScore ?? 0;
  drawFormGauge(ctx, W / 2, 720, 230, score);

  // Stats row
  const statsY = 1020;
  const statCols = [
    { label: 'REPS', value: String(result.reps ?? 0) },
    { label: 'DURATION', value: (() => { const d = result.duration ?? 0; const m = Math.floor(d / 60); const s = Math.round(d % 60); return m > 0 ? `${m}m ${s}s` : `${s}s`; })() },
  ];
  const colW = W / statCols.length;
  statCols.forEach((col, i) => {
    const cx = colW * i + colW / 2;
    roundRect(ctx, cx - 180, statsY - 20, 360, 180, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fill();
    roundRect(ctx, cx - 180, statsY - 20, 360, 180, 18);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 96px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(col.value, cx, statsY + 120);
    ctx.font = '40px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(col.label, cx, statsY + 160);
  });

  // Rep quality breakdown
  const barSectionY = 1280;
  ctx.font = '44px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('REP QUALITY', W / 2, barSectionY);

  if (result.repHistory && result.repHistory.length > 0) {
    drawFormRepBars(ctx, PAD, barSectionY + 20, W - PAD * 2, 240, result.repHistory);
  } else {
    // Solid bar for overall score
    const bColor = score >= 80 ? ACCENT : score >= 60 ? YELLOW : RED;
    const bW = ((W - PAD * 2) * score) / 100;
    roundRect(ctx, PAD, barSectionY + 100, W - PAD * 2, 80, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    roundRect(ctx, PAD, barSectionY + 100, bW, 80, 8);
    ctx.fillStyle = bColor;
    ctx.fill();
  }

  // Footer
  const footerY = 1780;
  ctx.beginPath();
  ctx.moveTo(PAD, footerY - 40);
  ctx.lineTo(W - PAD, footerY - 40);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '42px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(`Analyze your form free → ${APP_URL}`, W / 2, footerY + 20);

  ctx.beginPath();
  ctx.arc(W / 2, footerY + 60, 6, 0, Math.PI * 2);
  ctx.fillStyle = ACCENT;
  ctx.fill();

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Share or download the Form Card PNG.
 * Uses navigator.share({ files }) when available; falls back to download.
 * @param {object} result - workout analysis result
 * @returns {Promise<void>}
 */
export async function shareFormCard(result) {
  const blob = await generateFormCard(result);
  if (!blob) return;

  const file = new File([blob], 'form-card.png', { type: 'image/png' });
  if (
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title: 'WorkoutVision Form Card',
        text: `${result.exerciseName || result.exercise || 'Workout'} — ${result.formScore ?? 0}/100 form`,
        files: [file],
      });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  // Download fallback
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'workout-vision-form-card.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
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
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  const file = new File(
    [blob],
    `workout-${result.exerciseName.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.${ext}`,
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
