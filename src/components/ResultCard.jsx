import { useState, useEffect, useCallback, memo } from 'react';
import { EXERCISES, getExerciseIllustration } from '../lib/exercises';
import MuscleMap from './MuscleMap';
import Confetti from './Confetti';
import { shareCard, challengeShare } from '../lib/shareCard';
import { shareChallenge } from '../lib/challenges';
import { useT } from '../lib/LanguageContext';
import { useProfile } from '../lib/ProfileContext';
import { gradeFromScore, gradeClass } from '../lib/utils';
import { updateWorkout } from '../lib/storage';
import { hapticTap, hapticPR, hapticLight } from '../lib/haptics';
import { detectPRs, detectFormRegression } from '../lib/prSystem';
import { estimateOneRepMax } from '../lib/coach';
import { recalibrateAnalysis } from '../lib/recalibrate';
import {
  requestNotificationPermission,
  scheduleWeeklyReminder,
  isNotificationEnabled,
  hasShownNotificationPrompt,
  markNotificationPromptShown,
} from '../lib/notifications';

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
  if (progression.currentScore < prevScore - 10) return t('prog_form_down', { date: dateStr });
  return t('prog_consistent', { date: dateStr });
}

function ResultCard({ result, onReplay }) {
  const { t, tExercise, tFormCheck } = useT();
  const { profile } = useProfile();
  const {
    fileName, exerciseName, reps, duration,
    formScore: origFormScore, bioAnalysis: origBioAnalysis,
    report: origReport, repHistory: origRepHistory,
    progression, baselineComparison,
  } = result;

  const [showDetails, setShowDetails] = useState(false);
  const [showDeepData, setShowDeepData] = useState(false);
  const [challengeStatus, setChallengeStatus] = useState(null);
  const [repOverride, setRepOverride] = useState(null);
  const [showRepEdit, setShowRepEdit] = useState(false);
  const [recalData, setRecalData] = useState(null);
  const [isRecalibrating, setIsRecalibrating] = useState(false);

  // Use recalibrated data when available, fall back to original
  const formScore = recalData?.formScore ?? origFormScore;
  const bioAnalysis = recalData?.bioAnalysis ?? origBioAnalysis;
  const report = recalData?.report ?? origReport;
  const repHistory = recalData?.repHistory ?? origRepHistory;

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
            recal.diagnostics.originalReps = result.machineReps ?? reps;
            setRecalData(recal);
            // Persist recalibrated data to IndexedDB
            if (result.workoutId) {
              updateWorkout(result.workoutId, {
                reps: clamped,
                repsOverridden: true,
                machineReps: result.machineReps ?? reps,
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
          machineReps: result.machineReps ?? reps,
          volume: w * clamped,
        }).catch(() => {});
      }
    } else {
      // No frames available, just update the count
      if (result.workoutId) {
        updateWorkout(result.workoutId, {
          reps: clamped,
          repsOverridden: true,
          machineReps: result.machineReps ?? reps,
          volume: w * clamped,
        }).catch(() => {});
      }
    }
  }, [result.workoutId, reps, result.machineReps, result.weight, result.frames, result.exercise, result.fps, profile]);

  // Score reveal animation: count up from 0
  const [displayScore, setDisplayScore] = useState(0);
  useEffect(() => {
    if (formScore == null) return;
    let start = 0;
    const duration = 800;
    const startTime = Date.now();
    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayScore(Math.round(eased * formScore));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [formScore]);

  return (
    <div className="card result-card" style={{ marginTop: 14, position: 'relative' }}>
      <Confetti active={showConfetti} />
      {/* Header with grade badge */}
      <div className="result-header">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            {getExerciseIllustration(result.exercise) && (
              <img
                src={getExerciseIllustration(result.exercise, 2)}
                alt=""
                style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6,
                  background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <div>
              <h3 style={{ marginBottom: 0, fontSize: '1.1rem' }}>{displayName}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="text-xs text-muted">{fileName}</span>
                {result.autoDetected === true && (
                  <span style={{
                    fontSize: '0.6rem', padding: '1px 6px', borderRadius: 4,
                    background: 'rgba(0,245,212,0.12)', color: 'var(--accent)', fontWeight: 600,
                  }}>{t('auto_detected')}</span>
                )}
                {result.detectionFailed && (
                  <span style={{
                    fontSize: '0.6rem', padding: '1px 6px', borderRadius: 4,
                    background: 'rgba(255,183,54,0.15)', color: 'var(--yellow)', fontWeight: 600,
                  }}>{t('detection_failed')}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <span
          className={`score-badge ${cls} ${revealed ? 'result-badge-reveal' : ''}`}
          style={{ fontSize: '1.1rem', padding: '8px 16px', position: 'relative', overflow: 'hidden' }}
        >
          {grade}
          {(grade === 'A' || grade === 'A+') && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 'inherit',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s ease-in-out infinite',
            }} />
          )}
        </span>
      </div>

      {muscles && <MuscleMap muscles={muscles} size={90} />}

      <div className="stats-grid-2x2">
        <div className={`stat-card ${revealed ? 'result-stat-reveal' : ''}`} style={{ cursor: 'pointer', position: 'relative', animationDelay: '0ms' }} onClick={() => { setShowRepEdit(!showRepEdit); hapticLight(); }}>
          <span className="stat-card-label">{t('reps').toUpperCase()}</span>
          {showRepEdit ? (
            <span className="stat-card-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={(e) => { e.stopPropagation(); handleRepChange(displayReps - 1); }}
                style={{
                  width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--muted)',
                  background: 'rgba(255,255,255,0.06)', color: 'var(--text)', fontSize: '1.1rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1, padding: 0,
                }}
              >−</button>
              <span style={{ minWidth: 24, textAlign: 'center' }}>{displayReps}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleRepChange(displayReps + 1); }}
                style={{
                  width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--muted)',
                  background: 'rgba(255,255,255,0.06)', color: 'var(--text)', fontSize: '1.1rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1, padding: 0,
                }}
              >+</button>
            </span>
          ) : (
            <span className="stat-card-value">
              {displayReps}
              {repWasOverridden && (
                <span style={{ fontSize: '0.55em', color: 'var(--muted)', marginLeft: 4 }}>
                  (AI: {reps})
                </span>
              )}
            </span>
          )}
          {!showRepEdit && (
            <span style={{
              fontSize: '0.55rem', color: 'var(--accent)', position: 'absolute',
              bottom: 4, left: '50%', transform: 'translateX(-50%)', opacity: 0.7,
            }}>{t('tap_to_edit')}</span>
          )}
        </div>
        <div className={`stat-card ${revealed ? 'result-stat-reveal' : ''}`} style={{ animationDelay: '100ms' }}>
          <span className="stat-card-label">{t('duration').toUpperCase()}</span>
          <span className="stat-card-value">{formatTime(duration)}</span>
        </div>
        <div className={`stat-card ${revealed ? 'result-stat-reveal' : ''}`} style={{ animationDelay: '200ms' }}>
          <span className="stat-card-label">{t('form_score_label')}</span>
          <span className="stat-card-value">
            {formScore == null ? (
              <span style={{ color: 'var(--muted)', fontSize: '0.85em' }} title={t('form_na_tooltip')}>N/A</span>
            ) : (
              <>
                <span style={{ color: formScore >= 80 ? 'var(--accent)' : formScore >= 60 ? 'var(--yellow)' : 'var(--red)' }}>
                  {displayScore}
                </span>
                <span style={{ fontSize: '0.7em', color: 'var(--muted)', marginLeft: 2 }}>/100</span>
              </>
            )}
          </span>
        </div>
        <div className={`stat-card ${revealed ? 'result-stat-reveal' : ''}`} style={{ animationDelay: '300ms' }}>
          <span className="stat-card-label">{t('volume').toUpperCase()}</span>
          <span className="stat-card-value">
            {result.weight > 0 ? `${result.weight * displayReps}` : displayReps}
            <span style={{ fontSize: '0.7em', color: 'var(--muted)', marginLeft: 2 }}>{result.weight > 0 ? 'kg' : t('reps')}</span>
          </span>
        </div>
      </div>

      {/* Recalibration indicator */}
      {isRecalibrating && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '8px 0', fontSize: '0.75rem', color: 'var(--accent)',
        }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          {t('recalibrating')}
        </div>
      )}
      {recalData && !isRecalibrating && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '6px 0', marginBottom: 4, fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 600,
        }}>
          <span style={{ fontSize: '0.8rem' }}>&#x2713;</span>
          {t('recalibrated_notice')}
        </div>
      )}

      {/* Analysis confidence indicator */}
      {result.confidence && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '4px 0', marginBottom: 6, fontSize: '0.65rem', color: 'var(--muted)',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: result.confidence.level === 'high' ? 'var(--accent)' :
              result.confidence.level === 'medium' ? 'var(--yellow)' : 'var(--red)',
          }} />
          {result.confidence.level === 'high' ? t('confidence_high') :
           result.confidence.level === 'medium' ? t('confidence_medium') :
           t('confidence_low')}
          {repWasOverridden && (
            <span style={{ marginLeft: 8, color: 'var(--accent)', fontWeight: 600 }}>
              {t('user_corrected')}
            </span>
          )}
        </div>
      )}

      {baselineComparison?.overallForm?.isPersonalBest && (
        <div style={{
          textAlign: 'center', padding: '12px 0', marginBottom: 8,
          background: 'linear-gradient(135deg, rgba(255,107,157,0.08), rgba(196,181,253,0.08))',
          borderRadius: 12, border: '1px solid rgba(255,107,157,0.15)',
        }}>
          <span style={{ fontSize: 24, display: 'block', marginBottom: 4 }}>&#10024;</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#ff6b9d', letterSpacing: 1, textTransform: 'uppercase' }}>{t('new_personal_best')}</span>
        </div>
      )}

      {/* PR Banner — golden accent, lists all PR types achieved */}
      {achievedPRs.length > 0 && (
        <div style={{
          textAlign: 'center', padding: '14px 16px', marginBottom: 8,
          background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,165,0,0.08))',
          borderRadius: 12, border: '1px solid rgba(255,215,0,0.3)',
        }}>
          <span style={{ fontSize: 28, display: 'block', marginBottom: 6 }}>&#127942;</span>
          <span style={{
            fontSize: 14, fontWeight: 800, color: '#ffd700', letterSpacing: 1.5,
            textTransform: 'uppercase', display: 'block', marginBottom: 8,
          }}>{t('pr_banner_title')}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
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
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 8,
                  background: 'rgba(255,215,0,0.15)', color: '#ffd700',
                  fontSize: '0.75rem', fontWeight: 700,
                  border: '1px solid rgba(255,215,0,0.25)',
                }}>
                  {prLabels[pr.type] || pr.type}
                  <span style={{ color: 'rgba(255,215,0,0.7)', fontSize: '0.65rem' }}>
                    {pr.value}{pr.unit !== 'pts' ? pr.unit : ''}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Form Regression Warning — loss aversion trigger */}
      {formRegression && (
        <div style={{
          padding: '12px 14px', marginBottom: 8,
          background: 'linear-gradient(135deg, rgba(251,191,36,0.1), rgba(245,158,11,0.06))',
          borderRadius: 12, border: '1px solid rgba(251,191,36,0.3)',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>&#9888;</span>
          <div>
            <span style={{
              fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24',
              textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4,
            }}>{t('form_regression_title')}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {t('form_regression_msg', { drop: formRegression.drop })}
            </span>
            <span style={{
              display: 'block', marginTop: 6, fontSize: '0.7rem', color: 'var(--muted)',
            }}>
              {t('form_score_label')}: {formRegression.currentScore} (avg: {formRegression.averageScore})
            </span>
          </div>
        </div>
      )}

      {coachingInsight && (
        <div className="coaching-card" style={{ background: 'linear-gradient(135deg, rgba(0,245,212,0.06) 0%, rgba(196,181,253,0.03) 100%)' }}>
          <div className="coaching-icon">AI</div>
          <p className="coaching-text">{coachingInsight}</p>
        </div>
      )}

      {progressionNote && (
        <div className="progression-card">
          <span className="progression-icon">&#x2191;</span>
          <p className="text-sm" style={{ margin: 0, color: 'var(--text-secondary)' }}>{progressionNote}</p>
        </div>
      )}

      {baselineComparison && (
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="text-xs text-muted">{t('personal_baseline')} ({baselineComparison.sessionsTracked} {t('sessions_count', { count: baselineComparison.sessionsTracked }).replace(/^\d+ /, '')})</span>
            {baselineComparison.overallForm.isPersonalBest && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--bio-cyan, #22d3ee)', textTransform: 'uppercase', letterSpacing: 1 }}>{t('new_pb')}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span>{t('avg_label')}: <strong>{baselineComparison.overallForm.personalMean}</strong></span>
            <span>{t('best_label')}: <strong>{baselineComparison.overallForm.personalBest}</strong></span>
            <span style={{ color: baselineComparison.overallForm.deviation >= 0 ? 'var(--bio-green, #4ade80)' : 'var(--red)' }}>
              {baselineComparison.overallForm.deviation >= 0 ? '+' : ''}{baselineComparison.overallForm.deviation} {t('vs_avg')}
            </span>
          </div>
          {baselineComparison.improvingChecks.length > 0 && (
            <p className="text-xs" style={{ margin: '6px 0 0', color: 'var(--bio-green, #4ade80)' }}>{t('improving_label')}: {baselineComparison.improvingChecks.join(', ')}</p>
          )}
          {baselineComparison.decliningChecks.length > 0 && (
            <p className="text-xs" style={{ margin: '4px 0 0', color: 'var(--yellow, #facc15)' }}>{t('watch_label')}: {baselineComparison.decliningChecks.join(', ')}</p>
          )}
        </div>
      )}

      {/* Layer 2: Details toggle */}
      <button
        className="btn btn-ghost btn-sm"
        style={{ width: '100%', marginTop: 14, padding: '8px 0', fontSize: '0.8rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        onClick={() => setShowDetails(d => !d)}
      >
        {showDetails ? t('hide_details') : t('show_details')}
        <span style={{ fontSize: '0.7rem', transition: 'transform 0.2s', transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)' }}>&#9660;</span>
      </button>

      {showDetails && (<>
      {report?.summary && (
        <p className="text-sm" style={{ marginTop: 12, marginBottom: 6, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          {typeof report.summary === 'string' ? report.summary : t(report.summary.key, report.summary)}
        </p>
      )}

      {repHistory && repHistory.length > 0 && (
        <div className="rep-quality" style={{ marginTop: 14 }}>
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
                      boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.2), 0 0 4px rgba(0,245,212,0.1)',
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
        <div style={{ marginTop: 14 }}>
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
                  <span className="rep-num" style={{ fontSize: '0.6rem' }}>
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
                <p className="text-xs" style={{ marginTop: 4, color: 'var(--yellow)' }}>
                  {t('rep_shallower', { rep: repHistory.length, drop })}
                </p>
              );
            }
            if (first?.rom && last?.rom && last.romPercent != null && last.romPercent >= 95) {
              return (
                <p className="text-xs" style={{ marginTop: 4, color: 'var(--accent)' }}>
                  {t('consistent_depth')}
                </p>
              );
            }
            return null;
          })()}
        </div>
      )}

      {bioAnalysis?.timeUnderTension?.perRep && bioAnalysis.timeUnderTension.perRep.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4>{t('time_under_tension')}</h4>
          <div className="result-stats" style={{ marginBottom: 6 }}>
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
        <div style={{ marginTop: 14 }}>
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
          <p className="text-xs text-muted" style={{ marginTop: 4 }}>
            {t('eccentric_tempo_target')}
          </p>
        </div>
      )}

      {bioAnalysis?.rangeOfMotion && (
        <div style={{ marginTop: 14 }}>
          <h4>{t('range_of_motion')}</h4>
          <div className="result-stats" style={{ marginBottom: 6 }}>
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
        <div style={{ marginTop: 14 }}>
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
            <div style={{ marginTop: 6 }}>
              {Object.entries(bioAnalysis.asymmetry.details).map(([key, val]) => (
                <p key={key} className="text-xs text-muted" style={{ padding: '2px 0' }}>
                  {t(`joint_${key.toLowerCase()}`) || key}: {typeof val === 'number' ? `${Math.round(val)}%` : String(val)}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
      </>)}

      {/* Layer 3: Deep Data toggle */}
      <button
        className="btn btn-ghost btn-sm"
        style={{ width: '100%', marginTop: 10, padding: '8px 0', fontSize: '0.8rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        onClick={() => setShowDeepData(d => !d)}
      >
        {showDeepData ? t('hide_deep_data') : t('show_deep_data')}
        <span style={{ fontSize: '0.7rem', transition: 'transform 0.2s', transform: showDeepData ? 'rotate(180deg)' : 'rotate(0deg)' }}>&#9660;</span>
      </button>

      {showDeepData && (<>
      {(recalData?.diagnostics?.progression || result.diagnostics?.progression)?.score > 0 && (() => {
        const prog = recalData?.diagnostics?.progression || result.diagnostics.progression;
        const gradeColor = prog.score >= 750 ? 'var(--accent)' : prog.score >= 500 ? 'var(--yellow)' : 'var(--red)';
        return (
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'linear-gradient(135deg, rgba(0,245,212,0.06), rgba(0,245,212,0.02))', borderRadius: 10, border: '1px solid rgba(0,245,212,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>{t('progression_score')}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: gradeColor }}>{prog.score}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: gradeColor }}>{prog.grade.label}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{prog.grade.title}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {[
                { label: t('form_label'), val: prog.components.form, max: 250 },
                { label: t('consistency_label'), val: prog.components.consistency, max: 200 },
                { label: t('tempo_label'), val: prog.components.tempo, max: 150 },
              ].map(c => (
                <div key={c.label} style={{ textAlign: 'center' }}>
                  <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.08)', marginBottom: 3 }}>
                    <div style={{ width: `${(c.val / c.max) * 100}%`, height: '100%', borderRadius: 2, background: gradeColor, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontSize: '0.55rem', color: 'var(--muted)' }}>{c.label}</span>
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
          <div className="stats-grid-2x2" style={{ marginTop: 10 }}>
            <div className="stat-card" style={{ gridColumn: '1 / -1' }}>
              <span className="stat-card-label">{t('estimated_1rm')}</span>
              <span className="stat-card-value">
                {oneRM}<span style={{ fontSize: '0.6em', color: 'var(--muted)', marginLeft: 2 }}>kg</span>
              </span>
              <span style={{ fontSize: '0.6rem', color: 'var(--muted)', marginTop: 2 }}>
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
          <div className="form-notes" style={{ marginTop: 14 }}>
            <h4>{t('form_notes')}</h4>
            {sorted.map(([issue, count]) => (
              <div key={issue} className="note-item">
                {tFormCheck(issue)} ({count}/{repHistory.length} reps)
              </div>
            ))}
          </div>
        );
      })()}

      {report?.highlights && report.highlights.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4>{t('highlights')}</h4>
          {report.highlights.map((h, i) => {
            const params = h.exercise ? { ...h, exerciseName: tExercise(h.exercise, h.exerciseName) } : h;
            return (
              <p key={i} className="text-sm" style={{ color: 'var(--accent)', padding: '2px 0' }}>
                {'> '}{typeof h === 'string' ? h : t(params.key, params)}
              </p>
            );
          })}
        </div>
      )}

      {report?.improvements && report.improvements.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4>{t('next_steps')}</h4>
          {report.improvements.map((imp, i) => {
            const params = imp.exercise ? { ...imp, exerciseName: tExercise(imp.exercise, imp.exerciseName) } : imp;
            return (
              <p key={i} className="text-sm text-muted" style={{ padding: '2px 0' }}>
                {i + 1}. {typeof imp === 'string' ? imp : t(params.key, params)}
              </p>
            );
          })}
        </div>
      )}
      </>)}

      {/* Weekly reminder prompt — shown once, after first successful analysis */}
      {showNotifPrompt && !notifGranted && (
        <div style={{
          marginTop: 14, padding: '12px 16px',
          background: 'rgba(0,245,212,0.06)',
          borderRadius: 12, border: '1px solid rgba(0,245,212,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', display: 'block', marginBottom: 2 }}>
              {t('notif_prompt_title')}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
              {t('notif_prompt_desc')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.75rem', padding: '6px 12px' }}
              onClick={() => {
                markNotificationPromptShown();
                setShowNotifPrompt(false);
              }}
            >
              {t('no_thanks')}
            </button>
            <button
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.75rem', padding: '6px 14px', background: '#00f5d4', color: '#000' }}
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
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 16, padding: '14px 0', fontSize: '1rem', fontWeight: 700 }}
          onClick={onReplay}
        >
          {t('watch_overlay')}
        </button>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          className="btn btn-ghost"
          style={{ flex: 1, padding: '12px 0', fontSize: '0.9rem', fontWeight: 600 }}
          onClick={() => { hapticLight(); shareCard(result); }}
        >
          {t('share_card')}
        </button>
        <button
          className="btn btn-primary"
          style={{ flex: 1, padding: '12px 0', fontSize: '0.9rem', fontWeight: 800,
            background: 'linear-gradient(135deg, #ff6b9d, #ffb088)', border: 'none', color: '#000' }}
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
    </div>
  );
}

export default memo(ResultCard);
