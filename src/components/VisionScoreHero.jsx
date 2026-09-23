import { useMemo } from 'react';
import { useT } from '../lib/LanguageContext';
import ScoreRing from './ScoreRing';

export default function VisionScoreHero({ workouts }) {
  const { t } = useT();

  const visionData = useMemo(() => {
    if (!workouts || workouts.length === 0) return null;

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = workouts.filter(w => {
      const ts = w.createdAt || new Date(w.date).getTime();
      return ts >= thirtyDaysAgo;
    });

    if (recent.length === 0) return null;

    const scores = recent
      .map(w => {
        if (w.progressionScore != null && w.progressionScore > 0) {
          return w.progressionScore > 100 ? Math.round(w.progressionScore / 10) : w.progressionScore;
        }
        if (w.formScore != null && w.formScore > 0) return w.formScore;
        return null;
      })
      .filter(s => s !== null);

    if (scores.length === 0) return null;

    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const clamped = Math.min(100, Math.max(0, avg));
    return { score: clamped, workoutCount: recent.length };
  }, [workouts]);

  return (
    <div className="vision-score-hero">
      <ScoreRing
        score={visionData ? visionData.score : 0}
        size={160}
        label={t('movement_quality')}
      />
      <span className="vision-score-subtitle">
        {t('vision_score_subtitle')}
      </span>
      {!visionData && workouts && workouts.length === 0 && (
        <span className="vision-score-prompt">
          {t('no_workouts_yet')}
        </span>
      )}
      {visionData && (
        <span className="vision-score-meta">
          {visionData.workoutCount === 1
            ? t('vision_score_workouts', { count: visionData.workoutCount })
            : t('vision_score_workouts_plural', { count: visionData.workoutCount })}
        </span>
      )}
    </div>
  );
}
