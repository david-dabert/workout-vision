/**
 * Coach report PDF generator.
 *
 * Generates a professional, branded PDF report from workout analysis data.
 * Uses jsPDF for client-side PDF generation.
 */

import { jsPDF } from 'jspdf';
import { EXERCISES } from './exercises';

// Color palette matching the app's design tokens
const COLORS = {
  primary: [30, 30, 36],       // dark background text
  accent: [212, 167, 106],     // gold accent
  text: [30, 30, 36],
  textLight: [100, 100, 110],
  success: [76, 175, 80],
  warning: [255, 152, 0],
  danger: [244, 67, 54],
  white: [255, 255, 255],
  bgLight: [245, 245, 248],
};

/**
 * Generate a coach report PDF.
 *
 * @param {Object} params
 * @param {Object} params.coach - Coach profile (name, credentials, gym, email, phone)
 * @param {Object} params.client - Client info (name, age, sex, weight, level, goals)
 * @param {Object} params.workout - Workout record (WorkoutRecord from storage)
 * @param {Object} [params.coachNotes] - Additional notes the coach typed
 * @param {Function} params.t - i18n translation function
 * @param {Function} params.tExercise - exercise name translation
 * @returns {jsPDF} The generated PDF document
 */
export function generateCoachReportPDF({ coach, client, workout, coachNotes, coachingData, t, tExercise }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Header with coach branding ──
  y = _drawHeader(doc, coach, y, margin, contentW, pageW);

  // ── Client info section ──
  y = _drawClientInfo(doc, client, y, margin, contentW, t);

  // ── Session summary ──
  y = _drawSessionSummary(doc, workout, y, margin, contentW, t, tExercise);

  // ── Rep-by-rep breakdown ──
  if (workout.repHistory && workout.repHistory.length > 0) {
    y = _checkPageBreak(doc, y, 60, pageH, margin);
    y = _drawRepBreakdown(doc, workout, y, margin, contentW, t);
  }

  // ── Form analysis ──
  if (workout.bioAnalysis) {
    y = _checkPageBreak(doc, y, 50, pageH, margin);
    y = _drawBioAnalysis(doc, workout, y, margin, contentW, t);
  }

  // ── Coaching feedback ──
  if (workout.report) {
    y = _checkPageBreak(doc, y, 40, pageH, margin);
    y = _drawCoachingFeedback(doc, workout, y, margin, contentW, t);
  }

  // ── Coaching intelligence ──
  if (coachingData && (coachingData.oneRM || coachingData.strengthLevel || coachingData.workloadRatio || coachingData.trainingRecommendation)) {
    y = _checkPageBreak(doc, y, 50, pageH, margin);
    y = _drawCoachingIntelligence(doc, coachingData, y, margin, contentW, t);
  }

  // ── Coach notes ──
  if (coachNotes) {
    y = _checkPageBreak(doc, y, 30, pageH, margin);
    y = _drawCoachNotes(doc, coachNotes, y, margin, contentW, t);
  }

  // ── Footer ──
  _drawFooter(doc, coach, pageW, pageH, margin);

  return doc;
}

function _drawHeader(doc, coach, y, margin, contentW, pageW) {
  // Accent bar at top
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 0, pageW, 3, 'F');

  y = 12;

  // Coach name / gym
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.text);
  const title = coach.gym || coach.name || 'Workout Vision';
  doc.text(title, margin, y);

  // "Session Report" subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.textLight);
  doc.text('Session Report', margin, y + 6);

  // Coach info on the right
  if (coach.name || coach.credentials) {
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textLight);
    const rightInfo = [];
    if (coach.name && coach.gym) rightInfo.push(`Coach: ${coach.name}`);
    if (coach.credentials) rightInfo.push(coach.credentials);
    if (coach.email) rightInfo.push(coach.email);
    if (coach.phone) rightInfo.push(coach.phone);
    for (let i = 0; i < rightInfo.length; i++) {
      doc.text(rightInfo[i], pageW - margin, y - 2 + i * 4, { align: 'right' });
    }
  }

  // Separator line
  y += 12;
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + contentW, y);
  y += 6;

  return y;
}

function _drawClientInfo(doc, client, y, margin, contentW, t) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.text);
  doc.text(t('coach_client_info') || 'Client Information', margin, y);
  y += 6;

  // Client details in a card
  doc.setFillColor(...COLORS.bgLight);
  const cardH = 20;
  doc.roundedRect(margin, y, contentW, cardH, 2, 2, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.text);

  const col1x = margin + 4;
  const col2x = margin + contentW / 3;
  const col3x = margin + (contentW * 2) / 3;

  doc.setFont('helvetica', 'bold');
  doc.text(client.name || '—', col1x, y + 6);
  doc.setFont('helvetica', 'normal');

  const details = [];
  if (client.age) details.push(`${t('age') || 'Age'}: ${client.age}`);
  if (client.sex) details.push(`${t('sex') || 'Sex'}: ${client.sex}`);
  if (client.weight) details.push(`${t('weight') || 'Weight'}: ${client.weight}`);
  if (client.level) details.push(`${t('experience') || 'Level'}: ${client.level}`);
  if (client.goals) details.push(`${t('goals') || 'Goals'}: ${client.goals}`);

  const colItems = [details.slice(0, 2), details.slice(2, 4), details.slice(4)];
  const cols = [col1x, col2x, col3x];
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < colItems[c].length; i++) {
      doc.text(colItems[c][i], cols[c], y + 12 + i * 4);
    }
  }

  y += cardH + 6;
  return y;
}

function _drawSessionSummary(doc, workout, y, margin, contentW, t, tExercise) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.text);
  doc.text(t('coach_session_summary') || 'Session Summary', margin, y);
  y += 6;

  const exerciseKey = workout.exerciseKey || workout.exercise || '';
  const exerciseName = tExercise
    ? tExercise(exerciseKey, workout.exerciseName || exerciseKey)
    : (workout.exerciseName || exerciseKey);
  const date = workout.date || workout.createdAt
    ? new Date(workout.date || workout.createdAt).toLocaleDateString()
    : '—';

  // Summary cards row
  const cardW = (contentW - 6) / 4;
  const cards = [
    { label: t('exercise') || 'Exercise', value: exerciseName },
    { label: t('reps') || 'Reps', value: String(workout.reps || 0) },
    { label: t('form_score') || 'Form', value: workout.formScore != null ? `${workout.formScore}/100` : '—' },
    { label: t('date') || 'Date', value: date },
  ];

  for (let i = 0; i < cards.length; i++) {
    const x = margin + i * (cardW + 2);
    doc.setFillColor(...COLORS.bgLight);
    doc.roundedRect(x, y, cardW, 18, 2, 2, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textLight);
    doc.text(cards[i].label, x + cardW / 2, y + 5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.text);
    // Truncate long exercise names
    const val = cards[i].value.length > 15 ? cards[i].value.slice(0, 14) + '...' : cards[i].value;
    doc.text(val, x + cardW / 2, y + 13, { align: 'center' });
  }

  y += 24;

  // Weight and duration row if available
  if (workout.weight > 0 || workout.duration > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.textLight);
    const extras = [];
    if (workout.weight > 0) extras.push(`${t('weight') || 'Weight'}: ${workout.weight} kg`);
    if (workout.duration > 0) extras.push(`${t('duration') || 'Duration'}: ${Math.round(workout.duration)}s`);
    if (workout.volume > 0) extras.push(`${t('volume') || 'Volume'}: ${workout.volume} kg`);
    doc.text(extras.join('   |   '), margin, y);
    y += 6;
  }

  return y;
}

function _drawRepBreakdown(doc, workout, y, margin, contentW, t) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.text);
  doc.text(t('coach_rep_breakdown') || 'Rep-by-Rep Analysis', margin, y);
  y += 6;

  const reps = workout.repHistory;
  const maxReps = Math.min(reps.length, 20); // cap at 20 for space

  // Table header
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(margin, y, contentW, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.white);

  const cols = [margin + 4, margin + 20, margin + 50, margin + 80, margin + 110, margin + 140];
  const headers = ['Rep #', t('score') || 'Score', 'ROM', t('duration') || 'Duration', t('tempo') || 'Tempo', t('notes') || 'Notes'];
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], cols[i], y + 4.5);
  }
  y += 7;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  for (let i = 0; i < maxReps; i++) {
    const rep = reps[i];
    const rowY = y + i * 5;

    // Alternate row bg
    if (i % 2 === 0) {
      doc.setFillColor(...COLORS.bgLight);
      doc.rect(margin, rowY - 1, contentW, 5, 'F');
    }

    // Score color
    const score = rep.score != null ? rep.score : null;
    if (score != null) {
      doc.setTextColor(...(score >= 80 ? COLORS.success : score >= 60 ? COLORS.warning : COLORS.danger));
    } else {
      doc.setTextColor(...COLORS.textLight);
    }

    doc.text(String(i + 1), cols[0], rowY + 3);
    doc.text(score != null ? `${Math.round(score)}` : '—', cols[1], rowY + 3);

    doc.setTextColor(...COLORS.text);
    doc.text(rep.rom != null ? `${Math.round(rep.rom)}°` : '—', cols[2], rowY + 3);
    doc.text(rep.duration != null ? `${rep.duration.toFixed(1)}s` : '—', cols[3], rowY + 3);
    doc.text(rep.tempoLabel || '—', cols[4], rowY + 3);

    // Notes (truncated)
    if (rep.notes && rep.notes.length > 0) {
      doc.setTextColor(...COLORS.textLight);
      const noteText = Array.isArray(rep.notes) ? rep.notes[0] : String(rep.notes);
      doc.text(noteText.slice(0, 25), cols[5], rowY + 3);
    }
  }

  y += maxReps * 5 + 4;
  return y;
}

function _drawBioAnalysis(doc, workout, y, margin, contentW, t) {
  const bio = workout.bioAnalysis;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.text);
  doc.text(t('coach_biomechanics') || 'Biomechanical Analysis', margin, y);
  y += 6;

  const metrics = [];

  if (bio.velocity) {
    if (bio.velocity.meanConcentric != null) metrics.push({ label: t('coach_mean_concentric') || 'Mean Concentric Velocity', value: `${bio.velocity.meanConcentric.toFixed(2)} m/s` });
    if (bio.velocity.meanEccentric != null) metrics.push({ label: t('coach_mean_eccentric') || 'Mean Eccentric Velocity', value: `${bio.velocity.meanEccentric.toFixed(2)} m/s` });
  }
  if (bio.timeUnderTension) {
    if (bio.timeUnderTension.total != null) metrics.push({ label: t('coach_tut_total') || 'Time Under Tension', value: `${bio.timeUnderTension.total.toFixed(1)}s` });
    if (bio.timeUnderTension.perRep != null) metrics.push({ label: t('coach_tut_per_rep') || 'TUT per Rep', value: `${bio.timeUnderTension.perRep.toFixed(1)}s` });
  }
  if (bio.rom) {
    if (bio.rom.mean != null) metrics.push({ label: t('coach_rom_mean') || 'Average ROM', value: `${Math.round(bio.rom.mean)}°` });
    if (bio.rom.consistency != null) metrics.push({ label: t('coach_rom_consistency') || 'ROM Consistency', value: `${Math.round(bio.rom.consistency)}%` });
  }
  if (bio.asymmetry) {
    metrics.push({ label: t('coach_asymmetry') || 'Asymmetry Index', value: `${Math.round(bio.asymmetry.index || 0)}%` });
  }
  if (bio.fatigue) {
    metrics.push({ label: t('coach_fatigue') || 'Fatigue Index', value: `${Math.round(bio.fatigue.index || 0)}%` });
  }

  // Render metrics in 2-column grid
  const colW = (contentW - 4) / 2;
  for (let i = 0; i < metrics.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = margin + col * (colW + 4);
    const my = y + row * 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.textLight);
    doc.text(metrics[i].label, x, my);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.text);
    doc.text(metrics[i].value, x + 60, my);
  }

  y += Math.ceil(metrics.length / 2) * 8 + 4;
  return y;
}

function _drawCoachingFeedback(doc, workout, y, margin, contentW, t) {
  const report = workout.report;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.text);
  doc.text(t('coach_feedback') || 'Coaching Feedback', margin, y);
  y += 6;

  // Grade badge
  if (report.grade) {
    const gradeColor = report.grade.startsWith('A') ? COLORS.success
      : report.grade === 'B' ? COLORS.warning
      : COLORS.danger;

    doc.setFillColor(...gradeColor);
    doc.circle(margin + 6, y + 3, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.white);
    doc.text(report.grade, margin + 6, y + 4.5, { align: 'center' });

    doc.setTextColor(...COLORS.text);
    doc.setFontSize(9);
    doc.text(report.zone || '', margin + 14, y + 4.5);
    y += 12;
  }

  // Highlights
  if (report.highlights && report.highlights.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.success);
    doc.text(t('coach_highlights') || 'Highlights', margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.text);
    for (const h of report.highlights.slice(0, 5)) {
      const text = typeof h === 'string' ? h : (h.key || JSON.stringify(h));
      doc.text(`+ ${text}`, margin + 4, y);
      y += 4;
    }
    y += 2;
  }

  // Suggestions
  if (report.suggestions && report.suggestions.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.warning);
    doc.text(t('coach_suggestions') || 'Areas for Improvement', margin, y);
    y += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.text);
    for (const s of report.suggestions.slice(0, 5)) {
      const text = typeof s === 'string' ? s : (s.key || JSON.stringify(s));
      const lines = doc.splitTextToSize(`- ${text}`, contentW - 8);
      for (const line of lines) {
        doc.text(line, margin + 4, y);
        y += 4;
      }
    }
  }

  y += 4;
  return y;
}

function _drawCoachingIntelligence(doc, data, y, margin, contentW, t) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.text);
  doc.text(t('coach_intelligence') || 'Performance Analysis', margin, y);
  y += 6;

  const metrics = [];

  if (data.oneRM != null) {
    metrics.push({
      label: t('coach_1rm') || 'Estimated 1RM',
      value: `${data.oneRM} kg`,
    });
  }

  if (data.strengthLevel) {
    const levelLabel = data.strengthLevel.charAt(0).toUpperCase() + data.strengthLevel.slice(1);
    metrics.push({
      label: t('coach_strength_level') || 'Strength Level',
      value: levelLabel,
    });
  }

  if (data.workloadRatio && data.workloadRatio.ratio > 0) {
    const zoneLabel = data.workloadRatio.zone.charAt(0).toUpperCase() + data.workloadRatio.zone.slice(1);
    metrics.push({
      label: t('coach_workload') || 'Training Load',
      value: `${data.workloadRatio.ratio} (${zoneLabel})`,
    });
  }

  // Render metrics in 2-column grid
  if (metrics.length > 0) {
    doc.setFillColor(...COLORS.bgLight);
    const gridH = Math.ceil(metrics.length / 2) * 8 + 4;
    doc.roundedRect(margin, y, contentW, gridH, 2, 2, 'F');

    const colW = (contentW - 4) / 2;
    for (let i = 0; i < metrics.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = margin + 4 + col * (colW + 4);
      const my = y + 5 + row * 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.textLight);
      doc.text(metrics[i].label, x, my);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.text);
      doc.text(metrics[i].value, x + 55, my);
    }

    y += gridH + 4;
  }

  // Training recommendations
  if (data.trainingRecommendation) {
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.accent);
    doc.text(t('coach_training_recs') || 'Training Recommendations', margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.text);
    const recText = typeof data.trainingRecommendation === 'string'
      ? data.trainingRecommendation
      : String(data.trainingRecommendation);
    const lines = doc.splitTextToSize(recText, contentW - 8);
    for (const line of lines) {
      doc.text(line, margin + 4, y);
      y += 4;
    }
    y += 2;
  }

  y += 4;
  return y;
}

function _drawCoachNotes(doc, notes, y, margin, contentW, t) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.text);
  doc.text(t('coach_notes') || 'Coach Notes', margin, y);
  y += 6;

  doc.setFillColor(...COLORS.bgLight);
  const lines = doc.splitTextToSize(notes, contentW - 8);
  const boxH = Math.max(12, lines.length * 4 + 6);
  doc.roundedRect(margin, y, contentW, boxH, 2, 2, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.text);
  for (let i = 0; i < lines.length; i++) {
    doc.text(lines[i], margin + 4, y + 5 + i * 4);
  }

  y += boxH + 4;
  return y;
}

function _drawFooter(doc, coach, pageW, pageH, margin) {
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Bottom accent line
    doc.setDrawColor(...COLORS.accent);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);

    // Footer text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textLight);

    const leftText = `Generated by Workout Vision${coach.gym ? ` for ${coach.gym}` : ''}`;
    doc.text(leftText, margin, pageH - 8);

    doc.text(`Page ${p}/${totalPages}`, pageW - margin, pageH - 8, { align: 'right' });

    const dateStr = new Date().toLocaleDateString();
    doc.text(dateStr, pageW / 2, pageH - 8, { align: 'center' });
  }
}

function _checkPageBreak(doc, y, needed, pageH, margin) {
  if (y + needed > pageH - 20) {
    doc.addPage();
    return margin;
  }
  return y;
}
