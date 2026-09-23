import { useT } from '../../lib/LanguageContext';
import { Icon } from '../../lib/icons';
import { translateMuscle } from '../../lib/utils';
import MuscleMap from '../MuscleMap';
import s from './DetailsSection.module.css';

export default function DetailsSection({
  result, muscles, formRegression, coachingInsight,
  progressionNote, baselineComparison, report,
  repHistory, bioAnalysis, repWasOverridden,
  formScore,
}) {
  const { t, tFormCheck, lang } = useT();

  return (
    <div id="result-details">
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
                  <span className="rep-num" title={`Ecc: ${ecc}s / Con: ${vel.concentricTime || 0}s / Ratio: ${vel.tempoRatio || 0}`}>{i + 1}</span>
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
    </div>
  );
}
