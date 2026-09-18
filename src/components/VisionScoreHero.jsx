import { useMemo } from 'react';
import { useT } from '../lib/LanguageContext';

/**
 * Grade thresholds matching ProgressionScore.js (0-100 scale).
 */
const GRADES = [
  { min: 90, label: 'A', color: 'var(--bio-cyan)' },
  { min: 75, label: 'B', color: 'var(--bio-green)' },
  { min: 60, label: 'C', color: 'var(--yellow)' },
  { min: 40, label: 'D', color: 'var(--yellow)' },
  { min: 0,  label: 'F', color: 'var(--red)' },
];

function getVisionGrade(score) {
  for (const g of GRADES) {
    if (score >= g.min) return g;
  }
  return GRADES[GRADES.length - 1];
}

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

    // Use progressionScore when available (now 0-100), fall back to formScore (already 0-100)
    const scores = recent
      .map(w => {
        if (w.progressionScore != null && w.progressionScore > 0) {
          // Handle legacy 0-1000 scores from old data: rescale to 0-100
          return w.progressionScore > 100 ? Math.round(w.progressionScore / 10) : w.progressionScore;
        }
        if (w.formScore != null && w.formScore > 0) return w.formScore;
        return null;
      })
      .filter(s => s !== null);

    if (scores.length === 0) return null;

    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const clamped = Math.min(100, Math.max(0, avg));
    const grade = getVisionGrade(clamped);

    return { score: clamped, grade, workoutCount: recent.length };
  }, [workouts]);

  // Arc geometry for the semi-circular gauge
  const radius = 72;
  const strokeWidth = 10;
  const cx = 90;
  const cy = 85;
  const startAngle = Math.PI * 0.8;
  const endAngle = Math.PI * 0.2;
  const totalAngle = 2 * Math.PI - (startAngle - endAngle);
  const progress = visionData ? visionData.score / 100 : 0;
  const currentAngle = startAngle - progress * totalAngle;

  const arcPath = (r, start, end) => {
    const x1 = cx + r * Math.cos(start);
    const y1 = cy - r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy - r * Math.sin(end);
    let span = start - end;
    if (span < 0) span += 2 * Math.PI;
    const largeArc = span > Math.PI ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const bgArc = arcPath(radius, startAngle, endAngle);
  const progressArc = visionData ? arcPath(radius, startAngle, currentAngle) : '';
  const gradeColor = visionData ? visionData.grade.color : 'var(--text-tertiary)';

  return (
    <div className="vision-score-hero">
      <div className="vision-score-gauge">
        <svg width="180" height="120" viewBox="0 0 180 120">
          <path
            d={bgArc}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {visionData && (
            <path
              d={progressArc}
              fill="none"
              stroke={gradeColor}
              strokeWidth={strokeWidth + 6}
              strokeLinecap="round"
              opacity="0.15"
              style={{ filter: 'blur(4px)' }}
            />
          )}
          {visionData && (
            <path
              d={progressArc}
              fill="none"
              stroke={gradeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 8px ${gradeColor})`,
              }}
            />
          )}
        </svg>
        <div className="vision-score-value">
          <span className="vision-score-number" style={{ color: gradeColor }}>
            {visionData ? visionData.score : '--'}
          </span>
          {visionData && (
            <span className="vision-score-grade" style={{ color: gradeColor }}>
              /100
            </span>
          )}
        </div>
      </div>
      <span className="vision-score-label">{t('movement_quality')}</span>
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
