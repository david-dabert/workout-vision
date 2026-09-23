import { useState, useEffect, useCallback, memo } from 'react';
import { EXERCISES } from '../lib/exercises';
import Confetti from './Confetti';
import { useT } from '../lib/LanguageContext';
import { useProfile } from '../lib/ProfileContext';
import { gradeFromScore, gradeClass } from '../lib/utils';
import { updateWorkout } from '../lib/storage';
import { hapticPR, hapticTap } from '../lib/haptics';
import { detectPRs, detectFormRegression } from '../lib/prSystem';
import { detectBadges } from '../lib/badges';
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
import {
  exportLandmarks,
  reportToGitHub,
  generateCoachingInsight,
  generateProgressionNote,
} from './resultcard/helpers';
import HeroSection from './resultcard/HeroSection';
import AchievementBanners from './resultcard/AchievementBanners';
import CoachingPanel from './resultcard/CoachingPanel';
import DetailsSection from './resultcard/DetailsSection';
import DeepDataSection from './resultcard/DeepDataSection';
import s from './ResultCard.module.css';

function ResultCard({ result, onReplay }) {
  const { t, tExercise } = useT();
  const { profile } = useProfile();
  const {
    fileName: _fileName, exerciseName, reps, duration,
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
    const t1 = requestAnimationFrame(() => setRevealed(true));
    if (isPR || isTopGrade) {
      const t2 = setTimeout(() => {
        setShowConfetti(true);
        if (isPR) hapticPR();
        else hapticTap();
      }, 400);
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

    if (result.frames && result.frames.length > 0 && clamped !== reps) {
      setIsRecalibrating(true);
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

  // Score reveal animation
  const displayScore = useCountUp(formScore ?? 0, { duration: 800, delay: 200 });

  // Insufficient footage: exclusive degraded state
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

      <HeroSection
        grade={grade}
        cls={cls}
        displayName={displayName}
        formScore={formScore}
        displayScore={displayScore}
        revealed={revealed}
        displayReps={displayReps}
        repWasOverridden={repWasOverridden}
        reps={reps}
        showRepEdit={showRepEdit}
        setShowRepEdit={setShowRepEdit}
        handleRepChange={handleRepChange}
        duration={duration}
        weight={result.weight}
        isRecalibrating={isRecalibrating}
        recalData={recalData}
        correctionToast={correctionToast}
        result={result}
        profile={profile}
        challengeStatus={challengeStatus}
        setChallengeStatus={setChallengeStatus}
      />

      <AchievementBanners
        baselineComparison={baselineComparison}
        achievedPRs={achievedPRs}
        earnedBadges={earnedBadges}
      />

      <CoachingPanel
        coaching={coaching}
        repHistory={repHistory}
        coachingInsight={coachingInsight}
      />

      {/* Details toggle */}
      <button
        className={`btn btn-ghost btn-sm ${s.detailsToggle}`}
        onClick={() => setShowDetails(d => !d)}
        aria-expanded={showDetails}
        aria-controls="result-details"
      >
        {showDetails ? t('hide_details') : t('show_details')}
        <span className={s.toggleChevron} style={{ transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)' }}>&#9660;</span>
      </button>

      {showDetails && (
        <DetailsSection
          result={result}
          muscles={muscles}
          formRegression={formRegression}
          coachingInsight={coachingInsight}
          progressionNote={progressionNote}
          baselineComparison={baselineComparison}
          report={report}
          repHistory={repHistory}
          bioAnalysis={bioAnalysis}
          repWasOverridden={repWasOverridden}
          formScore={formScore}
        />
      )}

      {/* Deep data toggle */}
      <button
        className={`btn btn-ghost btn-sm ${s.deepDataToggle}`}
        onClick={() => setShowDeepData(d => !d)}
        aria-expanded={showDeepData}
        aria-controls="result-deep-data"
      >
        {showDeepData ? t('hide_deep_data') : t('show_deep_data')}
        <span className={s.toggleChevron} style={{ transform: showDeepData ? 'rotate(180deg)' : 'rotate(0deg)' }}>&#9660;</span>
      </button>

      {showDeepData && (
        <DeepDataSection
          result={result}
          recalData={recalData}
          repHistory={repHistory}
          report={report}
          displayReps={displayReps}
        />
      )}

      {/* Weekly reminder prompt */}
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
        title={t('report_debug')}
      >
        🐛 Report
      </button>
    </div>
  );
}

export default memo(ResultCard);
