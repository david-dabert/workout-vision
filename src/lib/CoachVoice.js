/**
 * CoachVoice — Template-based natural language coaching feedback.
 *
 * Transforms structured analysis data (form scores, rep counts, fatigue,
 * ROM consistency) into human-readable coaching cues. Templates are
 * parameterized and randomly varied to avoid repetition.
 *
 * No LLM or TTS — pure string templates for lightweight real-time feedback.
 */

// ---------------------------------------------------------------------------
// Template pools (multiple variants per cue to avoid monotony)
// ---------------------------------------------------------------------------

const TEMPLATES = {
  rep_complete: [
    'Rep {rep} — {score} form.',
    '{rep} down. {score} quality.',
    'That\'s {rep}. {score}.',
  ],
  depth_fail: [
    'Go deeper on the next one.',
    'A bit more depth — break parallel.',
    'Push through the bottom range.',
  ],
  depth_pass: [
    'Good depth.',
    'Full range — nice.',
    'Below parallel, solid.',
  ],
  trunk_lean: [
    'Keep your chest up.',
    'Too much forward lean — brace your core.',
    'Torso collapsing. Tighten up.',
  ],
  knee_valgus: [
    'Push your knees out.',
    'Knee cave — drive knees over toes.',
    'Knees tracking in. Spread the floor.',
  ],
  fatigue_warning: [
    'Velocity dropping — {decay}% fatigue detected. Consider racking.',
    'You\'re slowing down. {decay}% velocity loss across the set.',
    'Fatigue alert: {decay}% speed decline. Last rep or two.',
  ],
  rom_inconsistent: [
    'ROM varies rep to rep. Aim for the same depth every time.',
    'Range inconsistent — standardize your bottom position.',
    'Some reps deeper than others. Lock in your range.',
  ],
  set_complete_good: [
    '{reps} reps, grade {grade}. Strong set.',
    'Set done. {reps} reps at {grade} quality.',
    '{grade} grade across {reps} reps. Well executed.',
  ],
  set_complete_needs_work: [
    '{reps} reps, grade {grade}. Review form on the flagged cues.',
    'Set complete. {grade} — room for improvement on form.',
    '{reps} reps done. {grade} quality. Focus areas flagged.',
  ],
  eccentric_fast: [
    'Slow down the lowering phase — control the eccentric.',
    'Too fast on the way down. 2-3 seconds eccentric.',
    'Eccentric too quick. Time under tension matters.',
  ],
  asymmetry: [
    'Left-right imbalance detected. Even out the load.',
    'Asymmetric movement. Concentrate on bilateral symmetry.',
  ],
  lumbar_flexion: [
    'Spine rounding detected — brace harder.',
    'Keep a neutral back. Don\'t let the lower back round.',
    'Lumbar flexion — reduce weight or reset position.',
  ],
};

// ---------------------------------------------------------------------------
// Template engine
// ---------------------------------------------------------------------------

function pick(templates) {
  return templates[Math.floor(Math.random() * templates.length)];
}

function fill(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, key) => params[key] ?? key);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a coaching cue for a completed rep.
 * @param {{ repNumber: number, score: number, issues: string[] }} repData
 * @returns {string}
 */
export function cueForRep(repData) {
  const { repNumber, score, issues } = repData;
  const scoreLabel = score >= 85 ? 'great' : score >= 70 ? 'good' : score >= 55 ? 'fair' : 'needs work';
  const lines = [fill(pick(TEMPLATES.rep_complete), { rep: repNumber, score: scoreLabel })];

  for (const issue of (issues || [])) {
    const lower = issue.toLowerCase();
    if (lower.includes('depth') || lower.includes('parallel') || lower.includes('deeper')) {
      lines.push(pick(TEMPLATES.depth_fail));
    } else if (lower.includes('knee') && (lower.includes('cave') || lower.includes('valgus'))) {
      lines.push(pick(TEMPLATES.knee_valgus));
    } else if (lower.includes('forward lean') || lower.includes('torso') || lower.includes('trunk')) {
      lines.push(pick(TEMPLATES.trunk_lean));
    } else if (lower.includes('lumbar') || lower.includes('rounding') || lower.includes('spine')) {
      lines.push(pick(TEMPLATES.lumbar_flexion));
    }
  }

  return lines.join(' ');
}

/**
 * Generate a coaching cue for set completion.
 * @param {{ reps: number, grade: string, fatigue?: { detected: boolean, decay: number }, romConsistency?: number }} setData
 * @returns {string}
 */
export function cueForSet(setData) {
  const { reps, grade, fatigue, romConsistency } = setData;
  const isGood = ['A+', 'A', 'B+', 'B'].includes(grade);
  const lines = [fill(pick(isGood ? TEMPLATES.set_complete_good : TEMPLATES.set_complete_needs_work), { reps, grade })];

  if (fatigue && fatigue.detected) {
    const decay = Math.round(fatigue.decay * 100);
    lines.push(fill(pick(TEMPLATES.fatigue_warning), { decay }));
  }

  if (romConsistency != null && romConsistency < 70) {
    lines.push(pick(TEMPLATES.rom_inconsistent));
  }

  return lines.join(' ');
}

/**
 * Generate a single-line cue for real-time live feedback.
 * @param {{ phase: string, formFeedback: Array<{ passed: boolean, text: string, severity: string }> }} frameData
 * @returns {string|null}
 */
export function cueForFrame(frameData) {
  const { formFeedback } = frameData;
  if (!formFeedback) return null;

  const majorFail = formFeedback.find(f => !f.passed && f.severity === 'major');
  if (majorFail) {
    const lower = majorFail.text.toLowerCase();
    if (lower.includes('depth')) return pick(TEMPLATES.depth_fail);
    if (lower.includes('knee')) return pick(TEMPLATES.knee_valgus);
    if (lower.includes('lean') || lower.includes('torso')) return pick(TEMPLATES.trunk_lean);
    if (lower.includes('lumbar') || lower.includes('rounding')) return pick(TEMPLATES.lumbar_flexion);
    return majorFail.text;
  }

  return null;
}
