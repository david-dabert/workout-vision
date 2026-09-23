import { useT } from '../../lib/LanguageContext';
import { translateMuscle } from '../../lib/utils';
import { estimateOneRepMax } from '../../lib/coach';
import s from './DeepDataSection.module.css';

export default function DeepDataSection({
  result, recalData, repHistory, report, displayReps,
}) {
  const { t, tExercise, tFormCheck, lang } = useT();

  return (
    <div id="result-deep-data">
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

      {/* 1RM Estimation */}
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
    </div>
  );
}
