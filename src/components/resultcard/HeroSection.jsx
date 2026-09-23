import { useT } from '../../lib/LanguageContext';
import { hapticLight } from '../../lib/haptics';
import { shareCard } from '../../lib/shareCard';
import { shareChallenge } from '../../lib/challenges';
import { formatTime } from './helpers';
import s from './HeroSection.module.css';

export default function HeroSection({
  grade, cls, displayName, formScore, displayScore,
  revealed, displayReps, repWasOverridden, reps,
  showRepEdit, setShowRepEdit, handleRepChange,
  duration, weight, isRecalibrating, recalData,
  correctionToast, result, profile,
  challengeStatus, setChallengeStatus,
}) {
  const { t } = useT();

  return (
    <>
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
            {weight > 0
              ? <>{Math.round(weight)}<span className={s.volumeUnit}>kg</span></>
              : <>{weight || 0}<span className={s.volumeUnit}>kg</span></>
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
    </>
  );
}
