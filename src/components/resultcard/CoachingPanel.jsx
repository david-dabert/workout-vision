import { useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { Icon, SEVERITY_ICON_KEY } from '../../lib/icons';
import s from './CoachingPanel.module.css';

export default function CoachingPanel({ coaching, repHistory, coachingInsight }) {
  const { t, tFormCheck } = useT();
  const [showAllCoaching, setShowAllCoaching] = useState(false);

  return (
    <>
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
    </>
  );
}
