import { useState, useEffect, useCallback, memo } from 'react';
import { EXERCISES } from '../lib/exercises';
import MuscleMap from './MuscleMap';
import Confetti from './Confetti';
import { shareCard } from '../lib/shareCard';
import { shareChallenge } from '../lib/challenges';
import { useT } from '../lib/LanguageContext';
import { useProfile } from '../lib/ProfileContext';
import { gradeFromScore, gradeClass, translateMuscle } from '../lib/utils';
import { updateWorkout } from '../lib/storage';
import { hapticTap, hapticPR, hapticLight } from '../lib/haptics';
import { detectPRs, detectFormRegression } from '../lib/prSystem';
import { detectBadges } from '../lib/badges';
import { Icon, SEVERITY_ICON_KEY } from '../lib/icons';
import { estimateOneRepMax } from '../lib/coach';
import { recalibrateAnalysis } from '../lib/recalibrate';
import { logCorrection } from '../lib/correctionLog';
import useCountUp from '../lib/useCountUp';
import {
  requestNotificationPermission,
  scheduleWeeklyReminder,
  isNotificationEnabled,
  hasShownNotificationPrompt,
  markNotificationPromptShown,
} from '../lib/notifications';
import s from './ResultCard.module.css';

/**
 * Export landmark frames as a JSON artifact for offline replay.
 * Output format matches dump-landmarks.html / replay-full-pipeline.mjs.
 */
function exportLandmarks(result) {
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
function reportToGitHub(result) {
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
    `**Exercise:** ${exercise}`,
    `**Reps detected:** ${reps}`,
    `**Expected reps:** <!-- fill in -->`,
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
    '<!-- Describe what happened, attach the video if possible -->',
  ].filter(Boolean).join('\n');

  const url = `https://github.com/david-dabert/workout-vision/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=debug-report`;
  window.open(url, '_blank');
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function generateCoachingInsight(repHistory, bioAnalysis, t) {
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


function generateProgressionNote(progression, t) {
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

function ResultCard({ result, onReplay }) {
  const { t, tExercise, tFormCheck, lang } = useT();
  const { profile } = useProfile();
  const {
    fileName: _fileName, exerciseName, reps, duration,
    formScore: origFormScore, bioAnalysis: origBioAnalysis,
    report: origReport, repHistory: origRepHistory,
    progression, baselineComparison,
  } = result;

  const [showDetails, setShowDetails] = useState(false);
  const [showDeepData, setShowDeepData] = useState(false);
  const [showAllCoaching, setShowAllCoaching] = useState(false);
  const [challengeStatus, setChallengeStatus] = useState(null);
  const [repOverride, setRepOverride] = useState(null);
  const [showRepEdit, setShowRepEdit] = useState(false);
  const [recalData, setRecalData] = useState(null);
  const [isRecalibrating, setIsRecalibrating] = useState(false);
  const [correctionToast, setCorrectionToast] = useState(null);

  // Use recalibrated data when available, fall back to original
  const formScore = recalData?.formScore ?? origFormScore;
  const bioAnalysis = recalData?.bioAnalysis ?? origBioAnalysis;
  const report = recalData?.report ?? origReport;
  const repHistory = recalData?.repHistory ?? origRepHistory;
  const coaching = recalData?.coaching ?? result.coaching;

  const grade = gradeFromScore(formScore);
  const cls = gradeClass(formScore);
  const displayName = tExercise(result.exercise, exerciseName);
  const exerciseDef = EXERCISES[result.exercise];
  const muscles = exerciseDef?.muscles;

  const coachingInsight = generateCoachingInsight(repHistory, bioAnalysis, t);
  const progressionNote = generateProgressionNote(progression, t);

  // Notification prompt: show once, after first successful analysis
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [notifGranted, setNotifGranted] = useState(isNotificationEnabled());

  const displayReps = repOverride != null ? repOverride : reps;
  const repWasOverridden = repOverride != null && repOverride !== reps;

  // PR detection state
  const [achievedPRs, setAchievedPRs] = useState([]);
  const [formRegression, setFormRegression] = useState(null);
  const [earnedBadges, setEarnedBadges] = useState([]);

  useEffect(() => {
    if (!result || !result.exercise) return;
    const workoutData = {
      id: result.workoutId,
      exercise: result.exercise,
      exerciseName: result.exerciseName || exerciseName,
      weight: result.weight || 0,
      reps: result.reps || reps,
      formScore: result.formScore || formScore,
      duration: result.duration || duration,
      date: result.date || new Date().toISOString(),
    };
    detectPRs(workoutData).then(prs => {
      if (prs && prs.length > 0) setAchievedPRs(prs);
    }).catch(() => {});
    detectFormRegression(workoutData).then(regression => {
      if (regression) setFormRegression(regression);
    }).catch(() => {});
    detectBadges(result).then(badges => {
      if (badges && badges.length > 0) setEarnedBadges(badges);
    }).catch(() => {});
  }, [result?.workoutId]);

  // Show notification prompt once after the first successful analysis result
  useEffect(() => {
    if (
      formScore != null &&
      formScore > 0 &&
      !isNotificationEnabled() &&
      !hasShownNotificationPrompt() &&
      'Notification' in window &&
      Notification.permission !== 'denied'
    ) {
      // Delay slightly so the result reveal animation completes first
      const timer = setTimeout(() => setShowNotifPrompt(true), 1800);
      return () => clearTimeout(timer);
    }
  }, [formScore]);

  // Reveal animation state
  const [revealed, setRevealed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const isPR = baselineComparison?.overallForm?.isPersonalBest;
  const isTopGrade = grade === 'A+' || grade === 'A';

  useEffect(() => {
    // Trigger reveal after mount
    const t1 = requestAnimationFrame(() => setRevealed(true));

    // Trigger confetti + haptic for PR or top grade
    if (isPR || isTopGrade) {
      const t2 = setTimeout(() => {
        setShowConfetti(true);
        if (isPR) hapticPR();
        else hapticTap();
      }, 400);
      // Auto-clean confetti
      const t3 = setTimeout(() => setShowConfetti(false), 2600);
      return () => { cancelAnimationFrame(t1); clearTimeout(t2); clearTimeout(t3); };
    }
    return () => cancelAnimationFrame(t1);
  }, [isPR, isTopGrade]);

  // Persist rep override and recalibrate full analysis pipeline
  const handleRepChange = useCallback((newReps) => {
    const clamped = Math.max(1, Math.min(99, newReps));
    setRepOverride(clamped);
    const w = result.weight || 0;
    const originalReps = result.machineReps ?? reps;

    // Log correction when rep count actually changes from AI-detected value
    if (clamped !== originalReps) {
      logCorrection({
        type: 'rep_count',
        workoutId: result.workoutId,
        exerciseKey: result.exercise,
        original: originalReps,
        corrected: clamped,
        confidence: result.confidence?.visibility,
        detectionConfidence: result.detectionConfidence,
        insufficientFootage: result.insufficientFootage,
        qualityGateReasons: result.qualityGateReasons,
        formScore,
      }).catch(() => {});
      setCorrectionToast('rep');
      setTimeout(() => setCorrectionToast(null), 2000);
    }

    // Run full recalibration if we have landmark frames
    if (result.frames && result.frames.length > 0 && clamped !== reps) {
      setIsRecalibrating(true);
      // Use requestAnimationFrame to let the UI update before heavy computation
      requestAnimationFrame(() => {
        try {
          const recal = recalibrateAnalysis({
            frames: result.frames,
            exerciseKey: result.exercise,
            targetReps: clamped,
            fps: result.fps || 10,
            profile,
            weightKg: w,
          });
          if (recal) {
            recal.diagnostics.originalReps = originalReps;
            setRecalData(recal);
            // Persist recalibrated data to IndexedDB
            if (result.workoutId) {
              updateWorkout(result.workoutId, {
                reps: clamped,
                repsOverridden: true,
                machineReps: originalReps,
                volume: w * clamped,
                formScore: recal.formScore,
                repHistory: recal.repHistory,
                bioAnalysis: recal.bioAnalysis,
                recalibrated: true,
              }).catch(() => {});
            }
          }
        } catch (e) {
          console.error('Recalibration failed:', e);
        }
        setIsRecalibrating(false);
      });
    } else if (clamped === reps) {
      // Reset to original analysis
      setRecalData(null);
      if (result.workoutId) {
        updateWorkout(result.workoutId, {
          reps: clamped,
          repsOverridden: false,
          machineReps: originalReps,
          volume: w * clamped,
        }).catch(() => {});
      }
    } else {
      // No frames available, just update the count
      if (result.workoutId) {
        updateWorkout(result.workoutId, {
          reps: clamped,
          repsOverridden: true,
          machineReps: originalReps,
          volume: w * clamped,
        }).catch(() => {});
      }
    }
  }, [result.workoutId, reps, result.machineReps, result.weight, result.frames, result.exercise, result.fps, result.confidence, profile]);

  // Score reveal animation: count up from 0 using shared hook
  const displayScore = useCountUp(formScore ?? 0, { duration: 800, delay: 200 });

  // Insufficient footage: exclusive degraded state — no grade, no coaching, no stats
  if (result.insufficientFootage) {
    return (
      <div className={`card result-card ${s.resultCard}`}>
        <div className={s.heroGrade}>
          <span className={`score-badge grade-na ${s.heroGradeBadge}`}>--</span>
          <h3 className={s.heroExerciseName}>{displayName}</h3>
        </div>
        <div className={s.insufficientFootageBanner}>
          <span className={s.insufficientFootageIcon}>&#9888;</span>
          <span className={s.insufficientFootageText}>{t('insufficient_footage')}</span>
        </div>
        <div className={s.filmingGuide}>
          <h4>{t('filming_tips_title')}</h4>
          <ul className={s.filmingGuideList}>
            <li>{t('filming_tip_light')}</li>
            <li>{t('filming_tip_angle')}</li>
            <li>{t('filming_tip_rom')}</li>
            <li>{t('filming_tip_stable')}</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className={`card result-card ${s.resultCard}`}>
      <Confetti active={showConfetti} />

      {/* ═══ HERO ZONE — above the fold, the "Instagram moment" ═══ */}

      {/* Centered grade badge — the first thing you see */}
      <div className={s.heroGrade}>
        <span
          className={`score-badge ${cls} ${revealed ? 'result-badge-reveal' : ''} ${s.heroGradeBadge}`}
        >
          {grade}
          {(grade === 'A' || grade === 'A+') && (
            <div className={s.shimmerOverlay} />
          )}
        </span>
        <h3 className={s.heroExerciseName}>{displayName}</h3>
        <div className={s.heroScoreLine}>
          {formScore != null && (
            <span className={s.heroScore}>
              <span className={formScore >= 80 ? s.scoreGood : formScore >= 60 ? s.scoreOk : s.scorePoor}>
                {displayScore}
              </span>
              <span className={s.heroScoreUnit}>/100</span>
            </span>
          )}
        </div>
      </div>

      {/* Compact stats row */}
      <div className={s.heroStatsRow}>
        <div className={s.heroStat} role="button" tabIndex={0} aria-label={t('tap_to_edit')} onClick={() => { setShowRepEdit(!showRepEdit); hapticLight(); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowRepEdit(!showRepEdit); hapticLight(); } }}>
          <span className={s.heroStatValue}>
            {showRepEdit ? (
              <span className={s.repEditControls}>
                <button onClick={(e) => { e.stopPropagation(); handleRepChange(displayReps - 1); }} className={s.repEditButton} aria-label={t('decrease_reps')}>−</button>
                <span className={s.repDisplayCount} aria-live="polite">{displayReps}</span>
                <button onClick={(e) => { e.stopPropagation(); handleRepChange(displayReps + 1); }} className={s.repEditButton} aria-label={t('increase_reps')}>+</button>
              </span>
            ) : (
              <>
                {displayReps}
                {repWasOverridden && <span className={s.aiRepIndicator}> (AI: {reps})</span>}
              </>
            )}
          </span>
          <span className={s.heroStatLabel}>{t('reps').toUpperCase()}</span>
        </div>
        <div className={s.heroStatDivider} />
        <div className={s.heroStat}>
          <span className={s.heroStatValue}>{formatTime(duration)}</span>
          <span className={s.heroStatLabel}>{t('duration').toUpperCase()}</span>
        </div>
        <div className={s.heroStatDivider} />
        <div className={s.heroStat}>
          <span className={s.heroStatValue}>
            {result.weight > 0
              ? <>{Math.round(result.weight)}<span className={s.volumeUnit}>kg</span></>
              : <>{result.weight || 0}<span className={s.volumeUnit}>kg</span></>
            }
          </span>
          <span className={s.heroStatLabel}>{t('weight_label') ? t('weight_label').toUpperCase() : 'WEIGHT'}</span>
        </div>
      </div>

      {/* Recalibration indicator */}
      {isRecalibrating && (
        <div className={s.recalibratingIndicator}>
          <span className={s.spinner} />
          {t('recalibrating')}
        </div>
      )}
      {recalData && !isRecalibrating && (
        <div className={s.recalibratedNotice}>
          <span className={s.recalibratedCheckmark}>&#x2713;</span>
          {t('recalibrated_notice')}
        </div>
      )}

      {/* Correction logged toast */}
      {correctionToast && (
        <div className={s.correctionToast}>
          <span className={s.correctionToastCheck}>&#x2713;</span>
          {t('correction_saved')}
        </div>
      )}

      {/* Personal Best / PR banners — these are celebration moments, keep above fold */}
      {baselineComparison?.overallForm?.isPersonalBest && (
        <div className={s.personalBestBanner}>
          <span className={s.personalBestIcon}><Icon name="star" size={16} /></span>
          <span className={s.personalBestLabel}>{t('new_personal_best')}</span>
        </div>
      )}

      {achievedPRs.length > 0 && (
        <div className={s.prBanner}>
          <span className={s.prBannerIcon}><Icon name="trophy" size={18} /></span>
          <span className={s.prBannerTitle}>{t('pr_banner_title')}</span>
          <div className={s.prTagList}>
            {achievedPRs.map((pr, i) => {
              const prLabels = {
                heaviest: t('pr_heaviest'),
                most_reps: t('pr_most_reps'),
                best_form: t('pr_best_form'),
                longest_set: t('pr_longest_set'),
                max_volume: t('pr_max_volume'),
                streak: t('pr_streak'),
              };
              return (
                <span key={i} className={s.prTag}>
                  {prLabels[pr.type] || pr.type}
                  <span className={s.prTagValue}>
                    {pr.value}{pr.unit !== 'pts' ? pr.unit : ''}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Session Badges — the shareable achievements */}
      {earnedBadges.length > 0 && (
        <div className={s.badgeSection}>
          <div className={s.badgeGrid}>
            {earnedBadges.map((badge) => (
              <div key={badge.id} className={`${s.badgeChip} ${s[`badgeTier_${badge.tier}`]}`}>
                <span className={s.badgeLabel}>{t(badge.id)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ TOP FORM CUES — surfaced from deep data ═══ */}
      {(() => {
        const topIssues = [];
        if (repHistory && repHistory.length > 0) {
          const allIssues = {};
          repHistory.forEach(r => {
            (r.issues || []).forEach(issue => {
              allIssues[issue] = (allIssues[issue] || 0) + 1;
            });
          });
          const sorted = Object.entries(allIssues).sort((a, b) => b[1] - a[1]);
          sorted.slice(0, 2).forEach(([issue, count]) => {
            topIssues.push({ text: tFormCheck(issue), count, total: repHistory.length });
          });
        }
        if (topIssues.length === 0 && coachingInsight) {
          return (
            <div className={s.surfacedCues}>
              <div className={`${s.surfacedCue} ${s.surfacedCueInsight}`}>
                <span className={s.surfacedCueIcon}><Icon name="info" size={14} /></span>
                <span>{coachingInsight}</span>
              </div>
            </div>
          );
        }
        if (topIssues.length === 0) return null;
        return (
          <div className={s.surfacedCues}>
            {topIssues.map((issue, i) => (
              <div key={i} className={`${s.surfacedCue} ${i === 0 ? s.surfacedCuePrimary : s.surfacedCueSecondary}`}>
                <span className={s.surfacedCueIcon}><Icon name={i === 0 ? 'warning' : 'info'} size={14} /></span>
                <span>{issue.text}</span>
                <span className={s.surfacedCueCount}>{issue.count}/{issue.total}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ═══ SHARE BUTTONS — immediately visible, the call to action ═══ */}
      <div className={s.heroActions}>
        <button
          className={`btn btn-ghost ${s.shareButton}`}
          onClick={() => { hapticLight(); shareCard(result); }}
        >
          {t('share_card')}
        </button>
        <button
          className={`btn btn-primary ${s.challengeButton}`}
          onClick={async () => {
            hapticLight();
            const outcome = await shareChallenge(result, profile);
            if (outcome === 'copied') {
              setChallengeStatus('copied');
              setTimeout(() => setChallengeStatus(null), 2000);
            }
          }}
        >
          {challengeStatus === 'copied' ? t('challenge_copied') : t('challenge_friend_btn')}
        </button>
      </div>

      {/* ═══ DETAILS ZONE — everything below the fold ═══ */}
      <button
        className={`btn btn-ghost btn-sm ${s.detailsToggle}`}
        onClick={() => setShowDetails(d => !d)}
        aria-expanded={showDetails}
        aria-controls="result-details"
      >
        {showDetails ? t('hide_details') : t('show_details')}
        <span className={s.toggleChevron} style={{ transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)' }}>&#9660;</span>
      </button>

      {showDetails && (<div id="result-details">
      {/* Analysis confidence indicator */}
      {result.confidence && (
        <div className={s.confidenceIndicator}>
          <span className={`${s.confidenceDot} ${s[`confidence_${result.confidence.level}`]}`} />
          {result.confidence.level === 'high' ? t('confidence_high') :
           result.confidence.level === 'medium' ? t('confidence_medium') :
           t('confidence_low')}
          {repWasOverridden && (
            <span className={s.userCorrectedLabel}>
              {t('user_corrected')}
            </span>
          )}
        </div>
      )}

      {muscles && <MuscleMap muscles={muscles} size={90} />}

      {/* Form Regression Warning */}
      {formRegression && (
        <div className={s.formRegressionBanner}>
          <span className={s.formRegressionIcon}><Icon name="warning" size={16} /></span>
          <div>
            <span className={s.formRegressionTitle}>{t('form_regression_title')}</span>
            <span className={s.formRegressionMessage}>
              {t('form_regression_msg', { drop: formRegression.drop })}
            </span>
            <span className={s.formRegressionScores}>
              {t('form_score_label')}: {formRegression.currentScore} (avg: {formRegression.averageScore})
            </span>
          </div>
        </div>
      )}

      {coachingInsight && (
        <div className={`coaching-card ${s.coachingCardBackground}`}>
          <div className="coaching-icon">AI</div>
          <p className="coaching-text">{coachingInsight}</p>
        </div>
      )}

      {/* ═══ Coaching Engine Panel ═══ */}
      {coaching && coaching.feedback && coaching.feedback.length > 0 && (
        <div className={s.coachingPanel}>
          <h4 className={s.coachingPanelTitle}>{t('coaching_analysis')}</h4>

          {/* Top coaching correction — single sentence, expandable */}
          {(() => {
            const allFb = coaching.feedback;
            const topFb = allFb[0];
            const rest = allFb.slice(1);
            return (
              <div className={s.coachingFeedbackList}>
                <div className={`${s.coachingFeedbackItem} ${s[`severity_${topFb.severity}`]} ${s.coachingTopItem}`}>
                  <span className={s.coachingFeedbackIcon}>
                    <Icon name={SEVERITY_ICON_KEY[topFb.severity] || 'info'} size={14} />
                  </span>
                  <p className={s.coachingFeedbackText}>{topFb.messageKey ? t(topFb.messageKey, topFb.messageParams) : topFb.message}</p>
                </div>
                {rest.length > 0 && !showAllCoaching && (
                  <button
                    className={s.coachingExpandBtn}
                    onClick={() => setShowAllCoaching(true)}
                  >
                    +{rest.length} {t('more_feedback')}
                  </button>
                )}
                {showAllCoaching && rest.map((fb, i) => (
                  <div key={i + 1} className={`${s.coachingFeedbackItem} ${s[`severity_${fb.severity}`]}`}>
                    <span className={s.coachingFeedbackIcon}>
                      <Icon name={SEVERITY_ICON_KEY[fb.severity] || 'info'} size={14} />
                    </span>
                    <p className={s.coachingFeedbackText}>{fb.messageKey ? t(fb.messageKey, fb.messageParams) : fb.message}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Metric cards row */}
          <div className={s.coachingMetricsRow}>
            {/* Smoothness (SPARC) */}
            {coaching.metrics?.smoothness && (
              <div className={s.coachingMetricCard}>
                <span className={s.coachingMetricValue}>
                  {coaching.metrics.smoothness.quality === 'very_smooth' ? 'A' :
                   coaching.metrics.smoothness.quality === 'normal' ? 'B' : 'C'}
                </span>
                <span className={s.coachingMetricLabel}>{t('smoothness_label')}</span>
                <span className={`${s.coachingMetricSub} ${
                  coaching.metrics.smoothness.quality === 'very_smooth' ? s.metricGood :
                  coaching.metrics.smoothness.quality === 'normal' ? s.metricOk : s.metricPoor
                }`}>
                  {t(`smoothness_${coaching.metrics.smoothness.quality}`) || coaching.metrics.smoothness.quality.replace('_', ' ')}
                </span>
              </div>
            )}

            {/* Rep consistency (DTW) */}
            {coaching.metrics?.repConsistency && (
              <div className={s.coachingMetricCard}>
                <span className={s.coachingMetricValue}>
                  {coaching.metrics.repConsistency.consistencyScore}<span className={s.coachingMetricUnit}>/100</span>
                </span>
                <span className={s.coachingMetricLabel}>{t('consistency_label')}</span>
              </div>
            )}

            {/* Fatigue */}
            {coaching.metrics?.fatigue && (
              <div className={s.coachingMetricCard}>
                <span className={`${s.coachingMetricValue} ${
                  coaching.metrics.fatigue.fatigueDetected ? s.metricPoor : s.metricGood
                }`}>
                  {coaching.metrics.fatigue.fatigueDetected
                    ? `−${Math.round(coaching.metrics.fatigue.romDecayPercent)}%`
                    : '✓'}
                </span>
                <span className={s.coachingMetricLabel}>{t('fatigue_label')}</span>
                {coaching.metrics.fatigue.fatigueDetected && (
                  <span className={s.coachingMetricSub}>
                    {t(`fatigue_${coaching.metrics.fatigue.severity}`) || coaching.metrics.fatigue.severity}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* SPARC per-rep bars */}
          {coaching.metrics?.smoothness?.perRep && coaching.metrics.smoothness.perRep.length > 1 && (
            <div className={s.coachingSparcSection}>
              <span className={s.coachingSubLabel}>{t('smoothness_per_rep')}</span>
              <div className="rep-bars">
                {coaching.metrics.smoothness.perRep.map((rep, i) => {
                  const sparc = rep.sparc;
                  // Normalize SPARC: -1 is best, -7 is worst → map to 0-100%
                  const pct = Math.max(5, Math.min(100, ((sparc + 7) / 6) * 100));
                  const color = sparc > -1.5 ? 'var(--accent)' : sparc > -3 ? 'var(--yellow)' : 'var(--red)';
                  return (
                    <div key={i} className="rep-bar-col">
                      <div className="rep-bar-wrap">
                        <div className="rep-bar" style={{ height: `${pct}%`, background: color }} />
                      </div>
                      <span className="rep-num">{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form detection badges */}
          {(() => {
            const m = coaching.metrics;
            const detections = [];
            if (m?.squatDepth) {
              detections.push({
                label: t('squat_depth'),
                good: m.squatDepth.allBelowParallel,
                detail: m.squatDepth.allBelowParallel
                  ? t('all_below_parallel')
                  : `${Math.round(m.squatDepth.avgBelowParallel * 100)}% ${t('below_parallel')}`,
              });
            }
            if (m?.kneeValgus) {
              detections.push({
                label: t('knee_valgus'),
                good: !m.kneeValgus.detected,
                detail: m.kneeValgus.detected
                  ? `${Math.round(m.kneeValgus.valgusRate * 100)}% ${t('of_reps')}`
                  : t('none_detected'),
              });
            }
            if (m?.trunkLean) {
              detections.push({
                label: t('trunk_lean'),
                good: m.trunkLean.excessiveRate < 0.3,
                detail: `${m.trunkLean.avgLean}°`,
              });
            }
            if (m?.lockout) {
              detections.push({
                label: t('lockout'),
                good: m.lockout.lockoutRate >= 0.8,
                detail: `${Math.round(m.lockout.lockoutRate * 100)}%`,
              });
            }
            if (m?.elbowFlare) {
              detections.push({
                label: t('elbow_flare'),
                good: m.elbowFlare.excessiveRate < 0.3,
                detail: m.elbowFlare.excessiveRate >= 0.3
                  ? `${Math.round(m.elbowFlare.excessiveRate * 100)}% ${t('of_reps')}`
                  : t('within_range'),
              });
            }
            if (detections.length === 0) return null;
            return (
              <div className={s.coachingDetections}>
                {detections.map((d, i) => (
                  <div key={i} className={`${s.coachingDetectionBadge} ${d.good ? s.detectionGood : s.detectionWarn}`}>
                    <span className={s.detectionIcon}>{d.good ? '✓' : '!'}</span>
                    <div>
                      <span className={s.detectionLabel}>{d.label}</span>
                      <span className={s.detectionDetail}>{d.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {progressionNote && (
        <div className="progression-card">
          <span className="progression-icon">&#x2191;</span>
          <p className={`text-sm ${s.progressionText}`}>{progressionNote}</p>
        </div>
      )}

      {baselineComparison && (
        <div className={s.baselineSection}>
          <div className={s.baselineHeader}>
            <span className="text-xs text-muted">{t('personal_baseline')} ({baselineComparison.sessionsTracked} {t('sessions_count', { count: baselineComparison.sessionsTracked }).replace(/^\d+ /, '')})</span>
            {baselineComparison.overallForm.isPersonalBest && (
              <span className={s.personalBestInline}>{t('new_pb')}</span>
            )}
          </div>
          <div className={s.baselineStats}>
            <span>{t('avg_label')}: <strong>{baselineComparison.overallForm.personalMean}</strong></span>
            <span>{t('best_label')}: <strong>{baselineComparison.overallForm.personalBest}</strong></span>
            <span className={baselineComparison.overallForm.deviation >= 0 ? s.deviationPositive : s.deviationNegative}>
              {baselineComparison.overallForm.deviation >= 0 ? '+' : ''}{baselineComparison.overallForm.deviation} {t('vs_avg')}
            </span>
          </div>
          {baselineComparison.improvingChecks.length > 0 && (
            <p className={`text-xs ${s.improvingChecks}`}>{t('improving_label')}: {baselineComparison.improvingChecks.join(', ')}</p>
          )}
          {baselineComparison.decliningChecks.length > 0 && (
            <p className={`text-xs ${s.decliningChecks}`}>{t('watch_label')}: {baselineComparison.decliningChecks.join(', ')}</p>
          )}
        </div>
      )}

      {report?.summary && (
        <p className={`text-sm ${s.summaryText}`}>
          {typeof report.summary === 'string' ? report.summary : t(report.summary.key, report.summary)}
        </p>
      )}

      {repHistory && repHistory.length > 0 && (
        <div className={`rep-quality ${s.repQualitySection}`}>
          <h4>{t('per_rep_quality')}</h4>
          <div className="rep-bars">
            {repHistory.map((r, i) => {
              const score = r.score || 0;
              return (
                <div key={i} className="rep-bar-col">
                  <div className="rep-bar-wrap">
                    <div className="rep-bar" style={{
                      height: `${Math.max(score, 5)}%`,
                      background: score >= 80 ? 'var(--accent)' : score >= 50 ? 'var(--yellow)' : 'var(--red)',
                      boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.2), 0 0 4px rgba(212,167,106,0.1)',
                      borderRadius: '4px 4px 1px 1px',
                    }} />
                  </div>
                  <span className="rep-num">{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {repHistory && repHistory.length >= 2 && repHistory[0]?.rom != null && (
        <div className={s.romSection}>
          <h4>{t('rom_per_rep')}</h4>
          <div className="rep-bars">
            {repHistory.map((r, i) => {
              const maxRom = Math.max(...repHistory.map(h => h.rom || 0), 1);
              const pct = ((r.rom || 0) / maxRom) * 100;
              const degraded = r.romPercent != null && r.romPercent < 85;
              return (
                <div key={i} className="rep-bar-col">
                  <div className="rep-bar-wrap">
                    <div className="rep-bar" style={{
                      height: `${Math.max(pct, 5)}%`,
                      background: degraded ? 'var(--yellow)' : 'var(--accent)',
                    }} />
                  </div>
                  <span className={`rep-num ${s.romRepNum}`}>
                    {r.romPercent != null ? `${r.romPercent}%` : (i + 1)}
                  </span>
                </div>
              );
            })}
          </div>
          {(() => {
            const first = repHistory[0];
            const last = repHistory[repHistory.length - 1];
            if (first?.rom && last?.rom && last.romPercent != null && last.romPercent < 90) {
              const drop = 100 - last.romPercent;
              return (
                <p className={`text-xs ${s.romHint}`} style={{ color: 'var(--yellow)' }}>
                  {t('rep_shallower', { rep: repHistory.length, drop })}
                </p>
              );
            }
            if (first?.rom && last?.rom && last.romPercent != null && last.romPercent >= 95) {
              return (
                <p className={`text-xs ${s.romHint}`} style={{ color: 'var(--accent)' }}>
                  {t('consistent_depth')}
                </p>
              );
            }
            return null;
          })()}
        </div>
      )}

      {bioAnalysis?.timeUnderTension?.perRep && bioAnalysis.timeUnderTension.perRep.length > 0 && (
        <div className={s.tutSection}>
          <h4>{t('time_under_tension')}</h4>
          <div className={`result-stats ${s.tutStatsSpacing}`}>
            <div className="stat">
              <span className="stat-value">{bioAnalysis.timeUnderTension.eccentric?.toFixed(1)}s</span>
              <span className="stat-label">{t('eccentric')}</span>
            </div>
            <div className="stat">
              <span className="stat-value">{bioAnalysis.timeUnderTension.concentric?.toFixed(1)}s</span>
              <span className="stat-label">{t('concentric')}</span>
            </div>
            <div className="stat">
              <span className="stat-value">{bioAnalysis.timeUnderTension.total?.toFixed(1)}s</span>
              <span className="stat-label">{t('total')}</span>
            </div>
          </div>
          <div className="rep-bars">
            {bioAnalysis.timeUnderTension.perRep.map((tut, i) => {
              const ecc = tut.eccentric || tut.down || 0;
              const con = tut.concentric || tut.up || 0;
              const total = ecc + con || 1;
              const maxTut = Math.max(
                ...bioAnalysis.timeUnderTension.perRep.map(r =>
                  (r.eccentric || r.down || 0) + (r.concentric || r.up || 0)),
                1);
              const pct = (total / maxTut) * 100;
              return (
                <div key={i} className="rep-bar-col">
                  <div className="rep-bar-wrap">
                    <div className="rep-bar" style={{
                      height: `${Math.max(pct, 5)}%`,
                      background: `linear-gradient(to top, var(--accent) ${(con / total) * 100}%, var(--yellow) 0%)`,
                    }} />
                  </div>
                  <span className="rep-num">{i + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Eccentric tempo per rep */}
      {repHistory && repHistory.length > 0 && repHistory.some(r => r.velocity?.eccentricTime > 0) && (
        <div className={s.eccentricTempoSection}>
          <h4>{t('eccentric_tempo')}</h4>
          <div className="rep-bars">
            {repHistory.map((rep, i) => {
              const vel = rep.velocity;
              if (!vel) return null;
              const ecc = vel.eccentricTime || 0;
              const con = vel.concentricTime || 0;
              const ratio = vel.tempoRatio || 0;
              const maxEcc = Math.max(...repHistory.map(r => r.velocity?.eccentricTime || 0), 0.1);
              const pct = (ecc / maxEcc) * 100;
              // Target: eccentric should be 2-4s for hypertrophy (Schoenfeld 2015)
              const isGood = ecc >= 2.0 && ecc <= 4.0;
              const isSlow = ecc > 4.0;
              return (
                <div key={i} className="rep-bar-col">
                  <div className="rep-bar-wrap">
                    <div className="rep-bar" style={{
                      height: `${Math.max(pct, 5)}%`,
                      background: isGood ? 'var(--accent)' : isSlow ? 'var(--yellow)' : 'var(--red)',
                    }} />
                  </div>
                  <span className="rep-num" title={`Ecc: ${ecc}s / Con: ${con}s / Ratio: ${ratio}`}>{i + 1}</span>
                </div>
              );
            })}
          </div>
          <p className={`text-xs text-muted ${s.eccentricTempoHint}`}>
            {t('eccentric_tempo_target')}
          </p>
        </div>
      )}

      {bioAnalysis?.rangeOfMotion && (
        <div className={s.rangeOfMotionSection}>
          <h4>{t('range_of_motion')}</h4>
          <div className={`result-stats ${s.rangeOfMotionStatsSpacing}`}>
            <div className="stat">
              <span className="stat-value">{Math.round(bioAnalysis.rangeOfMotion.avgDegrees)}&deg;</span>
              <span className="stat-label">{t('avg_rom')}</span>
            </div>
            <div className="stat">
              <span className="stat-value">{Math.round(bioAnalysis.rangeOfMotion.consistency || 0)}%</span>
              <span className="stat-label">{t('consistency')}</span>
            </div>
          </div>
          {bioAnalysis.rangeOfMotion.perRep && bioAnalysis.rangeOfMotion.perRep.length > 0 && (
            <div className="rep-bars">
              {bioAnalysis.rangeOfMotion.perRep.map((rom, i) => {
                const maxRom = Math.max(...bioAnalysis.rangeOfMotion.perRep, 1);
                const pct = (rom / maxRom) * 100;
                return (
                  <div key={i} className="rep-bar-col">
                    <div className="rep-bar-wrap">
                      <div className="rep-bar" style={{
                        height: `${Math.max(pct, 5)}%`, background: 'var(--accent)',
                      }} />
                    </div>
                    <span className="rep-num">{i + 1}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {bioAnalysis?.asymmetry && (
        <div className={s.asymmetrySection}>
          <h4>{t('asymmetry')}</h4>
          <div className="result-stats">
            <div className="stat">
              <span className="stat-value">
                <span className={`score-badge ${bioAnalysis.asymmetry.score <= 10 ? 'good' : bioAnalysis.asymmetry.score <= 20 ? 'ok' : 'poor'}`}>
                  {Math.round(bioAnalysis.asymmetry.score)}%
                </span>
              </span>
              <span className="stat-label">{t('imbalance')}</span>
            </div>
          </div>
          {bioAnalysis.asymmetry.details && typeof bioAnalysis.asymmetry.details === 'object' && (
            <div className={s.asymmetryDetails}>
              {Object.entries(bioAnalysis.asymmetry.details).map(([key, val]) => (
                <p key={key} className={`text-xs text-muted ${s.asymmetryDetailRow}`}>
                  {t(`joint_${key.toLowerCase()}`) || key}: {typeof val === 'number' ? `${Math.round(val)}%` : String(val)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
      </div>)}

      {/* Layer 3: Deep Data toggle */}
      <button
        className={`btn btn-ghost btn-sm ${s.deepDataToggle}`}
        onClick={() => setShowDeepData(d => !d)}
        aria-expanded={showDeepData}
        aria-controls="result-deep-data"
      >
        {showDeepData ? t('hide_deep_data') : t('show_deep_data')}
        <span className={s.toggleChevron} style={{ transform: showDeepData ? 'rotate(180deg)' : 'rotate(0deg)' }}>&#9660;</span>
      </button>

      {showDeepData && (<div id="result-deep-data">
      {(recalData?.diagnostics?.progression || result.diagnostics?.progression)?.score > 0 && (() => {
        const prog = recalData?.diagnostics?.progression || result.diagnostics.progression;
        const gradeColor = prog.score >= 75 ? 'var(--accent)' : prog.score >= 60 ? 'var(--yellow)' : 'var(--red)';
        return (
          <div className={s.progressionScoreCard}>
            <div className={s.progressionScoreHeader}>
              <span className={s.progressionScoreLabel}>{t('movement_quality')}</span>
              <div className={s.progressionScoreValueGroup}>
                <span className={s.progressionScoreValue} style={{ color: gradeColor }}>{prog.score}</span>
                <span className={s.progressionGradeLabel} style={{ color: gradeColor, fontSize: '0.7rem' }}>/100</span>
              </div>
            </div>
            <div className={s.progressionGradeTitle}>
              <span className={s.progressionGradeTitleText}>{t(prog.grade.title)}</span>
            </div>
            <div className={s.progressionComponentGrid}>
              {[
                { label: t('form_label'), val: prog.components.form, max: 100 },
                { label: t('steadiness_label'), val: prog.components.consistency, max: 100 },
                { label: t('tempo_label'), val: prog.components.tempo, max: 100 },
              ].map(c => (
                <div key={c.label} className={s.progressionComponentCell}>
                  <div className={s.progressionComponentBarTrack}>
                    <div className={s.progressionComponentBarFill} style={{ width: `${(c.val / c.max) * 100}%`, background: gradeColor }} />
                  </div>
                  <span className={s.progressionComponentLabel}>{c.label} {c.val}/100</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 1RM Estimation (VBT zones removed: monocular 2D pose cannot produce real absolute velocity) */}
      {(() => {
        const weight = result.weight || 0;
        const oneRM = weight > 0 && displayReps > 0 ? estimateOneRepMax(weight, displayReps) : null;

        if (!oneRM) return null;
        return (
          <div className={`stats-grid-2x2 ${s.oneRmGrid}`}>
            <div className={`stat-card ${s.oneRmCard}`}>
              <span className="stat-card-label">{t('estimated_1rm')}</span>
              <span className="stat-card-value">
                {oneRM}<span className={s.oneRmUnit}>kg</span>
              </span>
              <span className={s.oneRmMethod}>
                Brzycki {displayReps <= 10 ? '' : '(Epley)'}
              </span>
            </div>
          </div>
        );
      })()}


      {repHistory && repHistory.length > 0 && (() => {
        const allIssues = {};
        repHistory.forEach(r => {
          (r.issues || []).forEach(issue => {
            allIssues[issue] = (allIssues[issue] || 0) + 1;
          });
        });
        const sorted = Object.entries(allIssues).sort((a, b) => b[1] - a[1]);
        if (sorted.length === 0) return null;
        return (
          <div className={`form-notes ${s.formNotesSection}`}>
            <h4>{t('form_notes')}</h4>
            {sorted.map(([issue, count]) => (
              <div key={issue} className="note-item">
                {tFormCheck(issue)} ({count}/{repHistory.length} {t('reps')})
              </div>
            ))}
          </div>
        );
      })()}

      {report?.highlights && report.highlights.length > 0 && (
        <div className={s.highlightsSection}>
          <h4>{t('highlights')}</h4>
          {report.highlights.map((h, i) => {
            const params = h.exercise ? { ...h, exerciseName: tExercise(h.exercise, h.exerciseName) } : { ...h };
            if (params.muscle) params.muscle = translateMuscle(params.muscle, lang);
            return (
              <p key={i} className={`text-sm ${s.highlightItem}`}>
                {'> '}{typeof h === 'string' ? h : t(params.key, params)}
              </p>
            );
          })}
        </div>
      )}

      {report?.improvements && report.improvements.length > 0 && (
        <div className={s.nextStepsSection}>
          <h4>{t('next_steps')}</h4>
          {report.improvements.map((imp, i) => {
            const params = imp.exercise ? { ...imp, exerciseName: tExercise(imp.exercise, imp.exerciseName) } : imp;
            return (
              <p key={i} className={`text-sm text-muted ${s.improvementItem}`}>
                {i + 1}. {typeof imp === 'string' ? imp : t(params.key, params)}
              </p>
            );
          })}
        </div>
      )}
      </div>)}

      {/* Weekly reminder prompt — shown once, after first successful analysis */}
      {showNotifPrompt && !notifGranted && (
        <div className={s.notificationPrompt}>
          <div className={s.notificationPromptContent}>
            <span className={s.notificationPromptTitle}>
              {t('notif_prompt_title')}
            </span>
            <span className={s.notificationPromptDesc}>
              {t('notif_prompt_desc')}
            </span>
          </div>
          <div className={s.notificationPromptActions}>
            <button
              className={`btn btn-ghost btn-sm ${s.notifDismissBtn}`}
              onClick={() => {
                markNotificationPromptShown();
                setShowNotifPrompt(false);
              }}
            >
              {t('no_thanks')}
            </button>
            <button
              className={`btn btn-primary btn-sm ${s.notifEnableBtn}`}
              onClick={async () => {
                markNotificationPromptShown();
                setShowNotifPrompt(false);
                const granted = await requestNotificationPermission();
                if (granted) {
                  await scheduleWeeklyReminder();
                  setNotifGranted(true);
                }
              }}
            >
              {t('enable')}
            </button>
          </div>
        </div>
      )}

      {result.videoUrl && result.frames && (
        <button
          className={`btn btn-primary ${s.replayButton}`}
          onClick={onReplay}
        >
          {t('watch_overlay')}
        </button>
      )}
      {result.frames && result.frames.length > 0 && (
        <button
          className={`btn btn-ghost ${s.exportButton}`}
          onClick={() => exportLandmarks(result)}
        >
          {t('export_landmarks')}
        </button>
      )}
      <button
        className={`btn btn-ghost ${s.exportButton}`}
        onClick={() => reportToGitHub(result)}
        title="Report debug data to GitHub"
      >
        🐛 Report
      </button>
    </div>
  );
}

export default memo(ResultCard);
