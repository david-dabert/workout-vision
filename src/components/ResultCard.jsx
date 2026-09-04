import { useState, useEffect } from 'react';
import { EXERCISES, getExerciseIllustration } from '../lib/exercises';
import MuscleMap from './MuscleMap';
import { shareCard, challengeShare } from '../lib/shareCard';
import { useT } from '../lib/LanguageContext';
import { gradeFromScore, gradeClass } from '../lib/utils';

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

  if (bioAnalysis?.fatigue?.velocityDropoff > 25) {
    return t('insight_fatigue', { drop: Math.round(bioAnalysis.fatigue.velocityDropoff) });
  }

  if (bioAnalysis?.asymmetry?.score > 15) {
    return t('insight_asymmetry', { score: Math.round(bioAnalysis.asymmetry.score) });
  }

  if (bioAnalysis?.velocity?.perRep) {
    const avgVel = bioAnalysis.velocity.perRep.reduce((a, b) => a + b, 0) / bioAnalysis.velocity.perRep.length;
    if (avgVel > 0.8) return t('insight_too_fast');
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

export default function ResultCard({ result, onReplay }) {
  const { t, tExercise, tFormCheck } = useT();
  const {
    fileName, exerciseName, reps, duration,
    formScore, bioAnalysis, report, repHistory, progression, baselineComparison,
  } = result;

  const grade = gradeFromScore(formScore);
  const cls = gradeClass(formScore);
  const displayName = tExercise(result.exercise, exerciseName);
  const exerciseDef = EXERCISES[result.exercise];
  const muscles = exerciseDef?.muscles;

  const coachingInsight = generateCoachingInsight(repHistory, bioAnalysis, t);
  const progressionNote = generateProgressionNote(progression, t);

  const [showDetails, setShowDetails] = useState(false);
  const [showDeepData, setShowDeepData] = useState(false);
  const [challengeStatus, setChallengeStatus] = useState(null);

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
    <div className="card result-card" style={{ marginTop: 14 }}>
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
                {result.autoDetected && (
                  <span style={{
                    fontSize: '0.6rem', padding: '1px 6px', borderRadius: 4,
                    background: 'rgba(0,245,212,0.12)', color: 'var(--accent)', fontWeight: 600,
                  }}>{t('auto_detected')}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <span className={`score-badge ${cls}`} style={{ fontSize: '1.1rem', padding: '8px 16px', position: 'relative', overflow: 'hidden' }}>
          {grade}
          {grade === 'A' && (
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
        <div className="stat-card">
          <span className="stat-card-label">{t('reps').toUpperCase()}</span>
          <span className="stat-card-value">{reps}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">{t('duration').toUpperCase()}</span>
          <span className="stat-card-value">{formatTime(duration)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">{t('form_score_label')}</span>
          <span className="stat-card-value">
            <span style={{ color: formScore >= 80 ? 'var(--accent)' : formScore >= 60 ? 'var(--yellow)' : 'var(--red)' }}>
              {displayScore}
            </span>
            <span style={{ fontSize: '0.7em', color: 'var(--muted)', marginLeft: 2 }}>/100</span>
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">{t('quality').toUpperCase()}</span>
          <span className="stat-card-value">
            {bioAnalysis?.movementQuality != null ? Math.round(bioAnalysis.movementQuality) : '--'}
            <span style={{ fontSize: '0.7em', color: 'var(--muted)', marginLeft: 2 }}>%</span>
          </span>
        </div>
      </div>

      {baselineComparison?.overallForm?.isPersonalBest && (
        <div style={{
          textAlign: 'center', padding: '12px 0', marginBottom: 8,
          background: 'linear-gradient(135deg, rgba(255,107,157,0.08), rgba(196,181,253,0.08))',
          borderRadius: 12, border: '1px solid rgba(255,107,157,0.15)',
        }}>
          <span style={{ fontSize: 24, display: 'block', marginBottom: 4 }}>&#10024;</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#ff6b9d', letterSpacing: 1, textTransform: 'uppercase' }}>New Personal Best!</span>
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
            <span className="text-xs text-muted">Personal Baseline ({baselineComparison.sessionsTracked} sessions)</span>
            {baselineComparison.overallForm.isPersonalBest && (
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--bio-cyan, #22d3ee)', textTransform: 'uppercase', letterSpacing: 1 }}>New PB!</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <span>Avg: <strong>{baselineComparison.overallForm.personalMean}</strong></span>
            <span>Best: <strong>{baselineComparison.overallForm.personalBest}</strong></span>
            <span style={{ color: baselineComparison.overallForm.deviation >= 0 ? 'var(--bio-green, #4ade80)' : 'var(--danger, #ef4444)' }}>
              {baselineComparison.overallForm.deviation >= 0 ? '+' : ''}{baselineComparison.overallForm.deviation} vs avg
            </span>
          </div>
          {baselineComparison.improvingChecks.length > 0 && (
            <p className="text-xs" style={{ margin: '6px 0 0', color: 'var(--bio-green, #4ade80)' }}>Improving: {baselineComparison.improvingChecks.join(', ')}</p>
          )}
          {baselineComparison.decliningChecks.length > 0 && (
            <p className="text-xs" style={{ margin: '4px 0 0', color: 'var(--yellow, #facc15)' }}>Watch: {baselineComparison.decliningChecks.join(', ')}</p>
          )}
        </div>
      )}

      {/* Layer 2: Details toggle */}
      <button
        className="btn btn-ghost btn-sm"
        style={{ width: '100%', marginTop: 14, padding: '8px 0', fontSize: '0.8rem', fontWeight: 600, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        onClick={() => setShowDetails(d => !d)}
      >
        {showDetails ? 'Hide Details' : 'Show Details'}
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

      {bioAnalysis?.velocity?.perRep && bioAnalysis.velocity.perRep.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h4>{t('velocity_per_rep')}</h4>
          <div className="rep-bars">
            {bioAnalysis.velocity.perRep.map((v, i) => {
              const max = Math.max(...bioAnalysis.velocity.perRep, 1);
              const pct = (v / max) * 100;
              const declining = i > 0 && v < bioAnalysis.velocity.perRep[i - 1];
              return (
                <div key={i} className="rep-bar-col">
                  <div className="rep-bar-wrap">
                    <div className="rep-bar" style={{
                      height: `${Math.max(pct, 5)}%`,
                      background: declining ? 'var(--yellow)' : 'var(--accent)',
                    }} />
                  </div>
                  <span className="rep-num">{i + 1}</span>
                </div>
              );
            })}
          </div>
          {bioAnalysis.velocity.trend && (
            <p className="text-xs text-muted" style={{ marginTop: 4 }}>
              {t('trend')}: {t(bioAnalysis.velocity.trend)}
            </p>
          )}
        </div>
      )}

      {repHistory && repHistory.length >= 2 && repHistory[0]?.rom != null && (
        <div style={{ marginTop: 14 }}>
          <h4>Range of Motion</h4>
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
                  Rep {repHistory.length} was {drop}% shallower than rep 1
                </p>
              );
            }
            if (first?.rom && last?.rom && last.romPercent != null && last.romPercent >= 95) {
              return (
                <p className="text-xs" style={{ marginTop: 4, color: 'var(--accent)' }}>
                  Consistent depth maintained across the set
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
          <h4>{t('eccentric_tempo') || 'Eccentric Tempo'}</h4>
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
                      background: isGood ? 'var(--accent)' : isSlow ? 'var(--yellow)' : 'var(--danger, #ef4444)',
                    }} />
                  </div>
                  <span className="rep-num" title={`Ecc: ${ecc}s / Con: ${con}s / Ratio: ${ratio}`}>{i + 1}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted" style={{ marginTop: 4 }}>
            {t('eccentric_tempo_target') || 'Target: 2-4s eccentric for hypertrophy (green = in range)'}
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
        {showDeepData ? 'Hide Deep Data' : 'Show Deep Data'}
        <span style={{ fontSize: '0.7rem', transition: 'transform 0.2s', transform: showDeepData ? 'rotate(180deg)' : 'rotate(0deg)' }}>&#9660;</span>
      </button>

      {showDeepData && (<>
      {result.diagnostics?.progression && result.diagnostics.progression.score > 0 && (() => {
        const prog = result.diagnostics.progression;
        const gradeColor = prog.score >= 750 ? 'var(--accent)' : prog.score >= 500 ? 'var(--yellow)' : 'var(--red)';
        return (
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'linear-gradient(135deg, rgba(0,245,212,0.06), rgba(0,245,212,0.02))', borderRadius: 10, border: '1px solid rgba(0,245,212,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Progression Score</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 800, color: gradeColor }}>{prog.score}</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: gradeColor }}>{prog.grade.label}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{prog.grade.title}</span>
              <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>Top {100 - prog.percentile}%</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
              {[
                { label: 'Form', val: prog.components.form, max: 250 },
                { label: 'Consistency', val: prog.components.consistency, max: 200 },
                { label: 'Tempo', val: prog.components.tempo, max: 150 },
                { label: 'Power', val: prog.components.power, max: 150 },
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

      {result.diagnostics?.velocity && (() => {
        const vel = result.diagnostics.velocity;
        return (
          <div className="stats-grid-2x2" style={{ marginTop: 10 }}>
            {vel.fatigue && (
              <div className="stat-card">
                <span className="stat-card-label">FATIGUE</span>
                <span className="stat-card-value" style={{ color: vel.fatigue.detected ? 'var(--red)' : 'var(--accent)' }}>
                  {vel.fatigue.detected ? `${Math.round(vel.fatigue.decay * 100)}%` : 'OK'}
                </span>
              </div>
            )}
            {vel.power && vel.power.peakW > 0 && (
              <div className="stat-card">
                <span className="stat-card-label">PEAK POWER</span>
                <span className="stat-card-value">{vel.power.peakW}<span style={{ fontSize: '0.6em', color: 'var(--muted)', marginLeft: 2 }}>W</span></span>
              </div>
            )}
            {vel.power && vel.power.meanW > 0 && (
              <div className="stat-card">
                <span className="stat-card-label">AVG POWER</span>
                <span className="stat-card-value">{vel.power.meanW}<span style={{ fontSize: '0.6em', color: 'var(--muted)', marginLeft: 2 }}>W</span></span>
              </div>
            )}
            {vel.smoothness != null && (
              <div className="stat-card">
                <span className="stat-card-label">SMOOTHNESS</span>
                <span className="stat-card-value">{Math.round(vel.smoothness * 100)}<span style={{ fontSize: '0.6em', color: 'var(--muted)', marginLeft: 2 }}>%</span></span>
              </div>
            )}
          </div>
        );
      })()}

      {bioAnalysis?.fatigue && (
        <div style={{ marginTop: 14 }}>
          <h4>{t('fatigue')}</h4>
          <div className="result-stats" style={{ marginBottom: 6 }}>
            <div className="stat">
              <span className="stat-value">{Math.round(bioAnalysis.fatigue.index || 0)}%</span>
              <span className="stat-label">{t('fatigue_index')}</span>
            </div>
            {bioAnalysis.fatigue.velocityDropoff != null && (
              <div className="stat">
                <span className="stat-value">{Math.round(bioAnalysis.fatigue.velocityDropoff)}%</span>
                <span className="stat-label">{t('velocity_dropoff')}</span>
              </div>
            )}
          </div>
          {bioAnalysis.fatigue.curve && bioAnalysis.fatigue.curve.length > 0 && (
            <div className="rep-bars">
              {bioAnalysis.fatigue.curve.map((v, i) => {
                const max = Math.max(...bioAnalysis.fatigue.curve, 1);
                const pct = (v / max) * 100;
                return (
                  <div key={i} className="rep-bar-col">
                    <div className="rep-bar-wrap">
                      <div className="rep-bar" style={{
                        height: `${Math.max(pct, 5)}%`,
                        background: pct < 60 ? 'var(--red)' : pct < 80 ? 'var(--yellow)' : 'var(--accent)',
                      }} />
                    </div>
                    <span className="rep-num">{i + 1}</span>
                  </div>
                );
              })}
            </div>
          )}
          {bioAnalysis.fatigue.recommendation && (
            <p className="text-xs text-muted" style={{ marginTop: 4 }}>
              {t(bioAnalysis.fatigue.recommendation)}
            </p>
          )}
        </div>
      )}

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
          onClick={() => shareCard(result)}
        >
          {t('share_card')}
        </button>
        <button
          className="btn btn-primary"
          style={{ flex: 1, padding: '12px 0', fontSize: '0.9rem', fontWeight: 800,
            background: 'linear-gradient(135deg, #ff6b9d, #ffb088)', border: 'none', color: '#000' }}
          onClick={async () => {
            const outcome = await challengeShare(result);
            if (outcome === 'copied') {
              setChallengeStatus('copied');
              setTimeout(() => setChallengeStatus(null), 2000);
            }
          }}
        >
          {challengeStatus === 'copied' ? (t('copied') || 'Copied!') : '💪 Challenge'}
        </button>
      </div>
    </div>
  );
}
