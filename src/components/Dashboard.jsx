import { useState, useEffect, useMemo } from 'react';
import { getAllWorkouts } from '../lib/storage';
import { EXERCISES } from '../lib/exercises';
import MuscleMap from './MuscleMap';
import { useT } from '../lib/LanguageContext';

function gradeFromScore(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C+';
  if (score >= 60) return 'C';
  return 'D';
}

export default function Dashboard({ profile, modelStatus, onNavigate }) {
  const { t, lang, setLang } = useT();
  const [recentWorkouts, setRecentWorkouts] = useState([]);

  const statusDot = modelStatus === 'ready' ? 'ready'
    : modelStatus === 'error' ? 'err' : 'pulse';
  const statusText = modelStatus === 'ready' ? t('ai_engine_ready')
    : modelStatus === 'error' ? t('engine_failed') : t('loading_ai');

  useEffect(() => {
    getAllWorkouts().then(all => setRecentWorkouts(all.slice(0, 10)));
  }, []);

  // Aggregate stats from recent workouts
  const stats = useMemo(() => {
    if (recentWorkouts.length === 0) return null;
    const totalReps = recentWorkouts.reduce((s, w) => s + (w.reps || 0), 0);
    const totalSets = recentWorkouts.length;
    const avgScore = Math.round(recentWorkouts.reduce((s, w) => s + (w.formScore || 0), 0) / recentWorkouts.length);
    const totalVolume = recentWorkouts.reduce((s, w) => s + (w.volume || 0), 0);

    // Aggregate muscles worked
    const primarySet = new Set();
    const secondarySet = new Set();
    for (const w of recentWorkouts) {
      const ex = EXERCISES[w.exercise];
      if (ex?.muscles) {
        (ex.muscles.primary || []).forEach(m => primarySet.add(m));
        (ex.muscles.secondary || []).forEach(m => secondarySet.add(m));
      }
    }

    return { totalReps, totalSets, avgScore, totalVolume,
      muscles: { primary: [...primarySet], secondary: [...secondarySet] } };
  }, [recentWorkouts]);

  return (
    <div className="home">
      <div className="home-top">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="logo">Workout<span>Vision</span></h1>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              className={`btn btn-sm ${lang === 'en' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setLang('en')}
              style={{ padding: '4px 10px', fontSize: '0.75rem', minHeight: 32 }}
            >EN</button>
            <button
              className={`btn btn-sm ${lang === 'fr' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setLang('fr')}
              style={{ padding: '4px 10px', fontSize: '0.75rem', minHeight: 32 }}
            >FR</button>
          </div>
        </div>
        <p className="tagline">{t('tagline')}</p>
        <div className="model-status">
          <span className={`dot ${statusDot}`} />
          {statusText}
        </div>
      </div>

      {/* Muscle Map Summary — shows all muscles worked from recent workouts */}
      {stats && stats.muscles.primary.length > 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
          <MuscleMap muscles={stats.muscles} size={100} />
          <div className="stats-grid-2x2" style={{ marginTop: 12, marginBottom: 0 }}>
            <div className="stat-card">
              <span className="stat-card-label">TOTAL REPS</span>
              <span className="stat-card-value">{stats.totalReps}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">TOTAL SETS</span>
              <span className="stat-card-value">{stats.totalSets}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">AVG FORM</span>
              <span className="stat-card-value">
                <span style={{ color: stats.avgScore >= 80 ? 'var(--accent)' : stats.avgScore >= 60 ? 'var(--yellow)' : 'var(--red)' }}>
                  {stats.avgScore}
                </span>
                <span style={{ fontSize: '0.6em', color: 'var(--muted)' }}>/100</span>
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-card-label">VOLUME</span>
              <span className="stat-card-value">
                {stats.totalVolume > 0 ? `${Math.round(stats.totalVolume)}` : '--'}
                {stats.totalVolume > 0 && <span style={{ fontSize: '0.5em', color: 'var(--muted)', marginLeft: 2 }}>kg</span>}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Action Cards */}
      <div className="nav-grid">
        <div
          className="nav-card nav-accent"
          onClick={() => onNavigate('train')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('train'); } }}
        >
          <span className="nav-icon">{t('nav_live')}</span>
          <span className="nav-title">{t('nav_live_title')}</span>
          <span className="nav-desc">{t('nav_live_desc')}</span>
        </div>
        <div
          className="nav-card"
          onClick={() => onNavigate('analyze')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('analyze'); } }}
        >
          <span className="nav-icon">{t('nav_video')}</span>
          <span className="nav-title">{t('nav_video_title')}</span>
          <span className="nav-desc">{t('nav_video_desc')}</span>
        </div>
        <div
          className="nav-card"
          onClick={() => onNavigate('log')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('log'); } }}
        >
          <span className="nav-icon">{t('nav_log')}</span>
          <span className="nav-title">{t('nav_log_title')}</span>
          <span className="nav-desc">{t('nav_log_desc')}</span>
        </div>
      </div>

      {/* Recent Workouts */}
      {recentWorkouts.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <h3 style={{ marginBottom: 10 }}>{t('recent')}</h3>
          {recentWorkouts.slice(0, 5).map(w => {
            const score = w.formScore || 0;
            return (
              <div key={w.id} className="card" style={{ padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: 10,
                  background: score >= 80 ? 'var(--accent-glow-strong)' : score >= 60 ? 'var(--yellow-glow)' : 'var(--red-glow)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  border: `1px solid ${score >= 80 ? 'rgba(0,245,212,0.2)' : score >= 60 ? 'rgba(255,184,54,0.2)' : 'rgba(255,59,92,0.2)'}`,
                }}>
                  <span style={{
                    fontSize: '0.82rem', fontWeight: 800,
                    color: score >= 80 ? 'var(--accent)' : score >= 60 ? 'var(--yellow)' : 'var(--red)',
                  }}>{gradeFromScore(score)}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.88rem', display: 'block' }}>
                    {w.exerciseName || w.exercise}
                  </span>
                  <span className="text-xs text-muted">
                    {new Date(w.date || w.createdAt).toLocaleDateString()} &middot; {w.reps} {t('reps').toLowerCase()}
                    {w.weight > 0 && ` &middot; ${w.weight}kg`}
                  </span>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.1rem' }}>{w.reps}</span>
                  <span style={{ display: 'block', fontSize: '0.6rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>reps</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
