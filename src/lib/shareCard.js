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
const BG = '#0D0D0F';
const CARD_BG = '#1A1A1E';
const TEXT = '#FFFFFF';
const MUTED = '#8A8A9A';
const RED = '#FF3355';
const YELLOW = '#FFD93D';

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

  // Background
  ctx.fillStyle = BG;
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

  // Stats card
  const statsCardH = 160;
  roundRect(ctx, PAD, y, W - PAD * 2, statsCardH, 20);
  ctx.fillStyle = CARD_BG;
  ctx.fill();

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

  // Branding footer
  const footerY = H - 80;
  ctx.fillStyle = ACCENT;
  ctx.font = 'bold 36px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WorkoutVision', W / 2, footerY);
  ctx.fillStyle = MUTED;
  ctx.font = '22px -apple-system, system-ui, sans-serif';
  ctx.fillText('AI-Powered Form Analysis', W / 2, footerY + 42);

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
