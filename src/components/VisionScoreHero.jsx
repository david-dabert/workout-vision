import { useMemo } from 'react';
import { useT } from '../lib/LanguageContext';

/**
 * Grade thresholds matching ProgressionScore.js (0-1000 scale).
 */
const GRADES = [
  { min: 930, label: 'S',  color: '#a855f7' },
  { min: 850, label: 'A+', color: '#6e8efb' },
  { min: 750, label: 'A',  color: 'var(--bio-cyan)' },
  { min: 650, label: 'B+', color: 'var(--bio-green)' },
  { min: 500, label: 'B',  color: 'var(--bio-green)' },
  { min: 350, label: 'C',  color: 'var(--yellow)' },
  { min: 200, label: 'D',  color: 'var(--yellow)' },
  { min: 0,   label: 'F',  color: 'var(--red)' },
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

    // Use progressionScore (0-1000) when available, fall back to formScore scaled to 0-1000
    const scores = recent
      .map(w => {
        if (w.progressionScore != null && w.progressionScore > 0) return w.progressionScore;
        if (w.formScore != null && w.formScore > 0) return w.formScore * 10;
        return null;
      })
      .filter(s => s !== null);

    if (scores.length === 0) return null;

    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const clamped = Math.min(1000, Math.max(0, avg));
    const grade = getVisionGrade(clamped);

    return { score: clamped, grade, workoutCount: recent.length };
  }, [workouts]);

  // Arc geometry for the semi-circular gauge
  const radius = 72;
  const strokeWidth = 8;
  const cx = 90;
  const cy = 85;
  const startAngle = Math.PI * 0.8;
  const endAngle = Math.PI * 0.2;
  const totalAngle = 2 * Math.PI - (startAngle - endAngle);
  const progress = visionData ? visionData.score / 1000 : 0;
  const currentAngle = startAngle - progress * totalAngle;

  const arcPath = (r, start, end) => {
    const x1 = cx + r * Math.cos(start);
    const y1 = cy - r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy - r * Math.sin(end);
    // In SVG with y-down, going clockwise (sweep=1),
    // large-arc-flag depends on the angular span of THIS arc
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
          {/* Background arc */}
          <path
            d={bgArc}
            fill="none"
            stroke="var(--glass-border)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Progress arc */}
          {visionData && (
            <path
              d={progressArc}
              fill="none"
              stroke={gradeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 6px ${gradeColor})`,
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
              {visionData.grade.label}
            </span>
          )}
        </div>
      </div>
      <span className="vision-score-label">VisionScore</span>
      {!visionData && workouts && workouts.length === 0 && (
        <span className="vision-score-prompt">
          {t('no_workouts_yet') || 'Analyze your first workout to get your score'}
        </span>
      )}
      {visionData && (
        <span className="vision-score-meta">
          {visionData.workoutCount} {visionData.workoutCount === 1 ? 'workout' : 'workouts'} · 30d
        </span>
      )}
    </div>
  );
}
