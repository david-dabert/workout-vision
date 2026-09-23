import { useT } from '../../lib/LanguageContext';
import { Icon } from '../../lib/icons';
import s from './AchievementBanners.module.css';

export default function AchievementBanners({
  baselineComparison, achievedPRs, earnedBadges,
}) {
  const { t } = useT();

  const showPB = baselineComparison?.overallForm?.isPersonalBest;
  const showPRs = achievedPRs.length > 0;
  const showBadges = earnedBadges.length > 0;

  if (!showPB && !showPRs && !showBadges) return null;

  return (
    <>
      {/* Personal Best banner */}
      {showPB && (
        <div className={s.personalBestBanner}>
          <span className={s.personalBestIcon}><Icon name="star" size={16} /></span>
          <span className={s.personalBestLabel}>{t('new_personal_best')}</span>
        </div>
      )}

      {/* PR banner */}
      {showPRs && (
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

      {/* Session Badges */}
      {showBadges && (
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
    </>
  );
}
