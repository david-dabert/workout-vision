/**
 * Export landmark frames as a JSON artifact for offline replay.
 * Output format matches dump-landmarks.html / replay-full-pipeline.mjs.
 */
export function exportLandmarks(result) {
  const frames = (result.frames || []).map((f, i) => ({
    index: i,
    timestamp: f.timestamp ?? i / (result.fps || 10),
    landmarks: f.landmarks || f,
  }));
  const diag = result.diagnostics || {};
  const artifact = {
    version: 2,
    video: result.videoName || result.exercise || 'export',
    metadata: {
      exercise: result.exercise,
      fps: result.fps || 10,
      duration: result.duration || 0,
      reps: result.reps,
      machineReps: result.machineReps,
      exportDate: new Date().toISOString(),
      frameCount: frames.length,
    },
    diagnostics: {
      method: diag.method || null,
      observedRange: diag.observedRange || null,
      medianRepAmplitude: diag.medianRepAmplitude || null,
      measurementQuality: diag.measurementQuality || null,
      period: diag.period || null,
      adaptiveCandidates: diag.adaptiveCandidates || [],
      debugSignal: diag.debugSignal || [],
    },
    frames,
  };
  const json = JSON.stringify(artifact);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = (result.exercise || 'export').replace(/\s+/g, '_');
  a.download = `landmarks-${name}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Open a pre-filled GitHub Issue with debug diagnostics summary.
 * No token, no API, works on iOS Safari. User taps, reviews, submits.
 */
export function reportToGitHub(result) {
  const diag = result.diagnostics || {};
  const exercise = result.exercise || 'unknown';
  const reps = result.reps ?? '?';
  const method = diag.method || 'unknown';
  const period = diag.period || {};
  const candidates = (diag.adaptiveCandidates || [])
    .map(c => `  - ${c.name}: ${c.reps} reps, score=${c.score?.toFixed(2)}, consistency=${c.consistency?.toFixed(2)}`)
    .join('\n');

  const title = `Debug: ${exercise} — ${reps} reps (expected: ?)`;
  const body = [
    '## Debug Report',
    '',
    '**Répétitions réellement effectuées / Reps actually performed:**',
    '',
    `**Exercise:** ${exercise}`,
    `**Reps detected:** ${reps}`,
    `**Method:** ${method}`,
    `**Duration:** ${result.duration ? result.duration.toFixed(1) + 's' : '?'}`,
    `**FPS:** ${result.fps || '?'}`,
    '',
    '### Period analysis',
    period.periodSeconds ? `- Period: ${period.periodSeconds}s` : '- No period data',
    period.autocorrPeak != null ? `- ACF peak: ${period.autocorrPeak}` : '',
    period.periodReps != null ? `- Period reps: ${period.periodReps}` : '',
    period.valleyReps != null ? `- Valley reps: ${period.valleyReps}` : '',
    diag.hysteresisReps != null ? `- Hysteresis reps: ${diag.hysteresisReps}` : '',
    '',
    '### Signal candidates',
    candidates || '  (none)',
    '',
    `**Range:** ${diag.observedRange ?? '?'}°`,
    `**Median rep amplitude:** ${diag.medianRepAmplitude ?? '?'}°`,
    `**Quality:** ${diag.measurementQuality || '?'}`,
    '',
    '### Notes',
    "N'ajoutez pas de vidéo : cette page est publique. / Do not attach a video: this page is public.",
  ].filter(Boolean).join('\n');

  const url = `https://github.com/david-dabert/workout-vision/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=debug-report`;
  window.open(url, '_blank');
}

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function generateCoachingInsight(repHistory, bioAnalysis, t) {
  if (!repHistory || repHistory.length === 0) return null;

  const hasRepRom = repHistory.length >= 3 && repHistory[0]?.rom != null;
  if (hasRepRom) {
    const last = repHistory[repHistory.length - 1];
    if (last.romPercent != null && last.romPercent < 80) {
      const drop = 100 - last.romPercent;
      return t('insight_rom_drop', { drop });
    }
  } else if (bioAnalysis?.rangeOfMotion?.perRep && bioAnalysis.rangeOfMotion.perRep.length >= 3) {
    const roms = bioAnalysis.rangeOfMotion.perRep;
    const firstRom = roms[0];
    const lastRom = roms[roms.length - 1];
    if (firstRom > 0 && lastRom < firstRom * 0.8) {
      const drop = Math.round((1 - lastRom / firstRom) * 100);
      return t('insight_rom_drop', { drop });
    }
  }

  if (bioAnalysis?.asymmetry?.score > 15) {
    return t('insight_asymmetry', { score: Math.round(bioAnalysis.asymmetry.score) });
  }

  const scores = repHistory.map(r => r.score || 0);
  const variance = Math.max(...scores) - Math.min(...scores);
  if (variance < 15 && scores[0] >= 70) return t('insight_ready_progress');

  const best = repHistory.reduce((a, b, i) => (b.score || 0) > (a.score || 0) ? { ...b, num: i + 1 } : a, { ...repHistory[0], num: 1 });
  return t('insight_best_rep', { num: best.num });
}

export function generateProgressionNote(progression, t) {
  if (!progression) return null;
  const { prevScore, prevRom, prevDate } = progression;
  const daysSince = Math.round((Date.now() - new Date(prevDate).getTime()) / 86400000);
  const dateStr = daysSince <= 1 ? t('yesterday') : daysSince <= 7 ? t('days_ago', { n: daysSince }) : new Date(prevDate).toLocaleDateString();

  if (prevRom > 0 && progression.currentRom > 0) {
    const romChange = Math.round(progression.currentRom - prevRom);
    if (romChange > 5) return t('prog_rom_up', { change: romChange, date: dateStr });
    if (romChange < -5) return t('prog_rom_down', { change: romChange, date: dateStr });
  }
  if (progression.currentScore > prevScore + 5) return t('prog_form_up', { change: Math.round(progression.currentScore - prevScore), date: dateStr });
  if (progression.currentScore < prevScore - 5) return t('prog_form_down', { date: dateStr });
  return t('prog_consistent', { date: dateStr });
}
