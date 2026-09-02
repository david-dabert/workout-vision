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

  const stats = useMemo(() => {
    if (recentWorkouts.length === 0) return null;
    const totalReps = recentWorkouts.reduce((s, w) => s + (w.reps || 0), 0);
    const totalSets = recentWorkouts.length;
    const avgScore = Math.round(recentWorkouts.reduce((s, w) => s + (w.formScore || 0), 0) / recentWorkouts.length);
    const totalVolume = recentWorkouts.reduce((s, w) => s + (w.volume || 0), 0);
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
      {/* ── Hero section ── */}
      <div className="home-hero">
        <div className="home-hero-bg" />
        <div className="home-hero-content">
          <div className="home-header">
            <h1 className="logo">
              <span className="logo-w">W</span>orkout
              <span className="logo-accent">Vision</span>
            </h1>
            <div className="lang-toggle">
              <button
                className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
                aria-label="English"
              >EN</button>
              <button
                className={`lang-btn ${lang === 'fr' ? 'active' : ''}`}
                onClick={() => setLang('fr')}
                aria-label="Français"
              >FR</button>
            </div>
          </div>
          <p className="tagline">{t('tagline')}</p>
          <div className={`engine-status engine-${statusDot}`}>
            <span className={`engine-dot ${statusDot}`} />
            <span>{statusText}</span>
          </div>
        </div>
      </div>

      {/* ── Primary action: Analyze Video ── */}
      <div className="action-cards">
        <button
          className="action-primary"
          onClick={() => onNavigate('analyze')}
          aria-label={t('nav_video_title')}
        >
          <div className="action-primary-glow" />
          <div className="action-primary-content">
            <div className="action-primary-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <div className="action-primary-text">
              <span className="action-label">{t('nav_video_title')}</span>
              <span className="action-desc">{t('nav_video_desc')}</span>
            </div>
            <svg className="action-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </button>

        <button
          className="action-secondary"
          onClick={() => onNavigate('log')}
          aria-label={t('nav_log_title')}
        >
          <div className="action-secondary-content">
            <div className="action-secondary-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <span className="action-label">{t('nav_log_title')}</span>
            <svg className="action-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </button>
      </div>

      {/* ── Stats summary ── */}
      {stats && stats.muscles.primary.length > 0 && (
        <div className="stats-section">
          <h3 className="section-title">{t('recent')}</h3>
          <div className="stats-hero-card">
            <MuscleMap muscles={stats.muscles} size={90} />
            <div className="stats-numbers">
              <div className="stat-item">
                <span className="stat-value">{stats.totalReps}</span>
                <span className="stat-label">REPS</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.totalSets}</span>
                <span className="stat-label">SETS</span>
              </div>
              <div className="stat-item">
                <span className="stat-value" style={{
                  color: stats.avgScore >= 80 ? 'var(--accent)' : stats.avgScore >= 60 ? 'var(--yellow)' : 'var(--red)'
                }}>{stats.avgScore}</span>
                <span className="stat-label">FORM</span>
              </div>
              {stats.totalVolume > 0 && (
                <div className="stat-item">
                  <span className="stat-value">{Math.round(stats.totalVolume)}<span className="stat-unit">kg</span></span>
                  <span className="stat-label">VOL</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Recent workouts ── */}
      {recentWorkouts.length > 0 && (
        <div className="recent-section">
          {!stats && <h3 className="section-title">{t('recent')}</h3>}
          <div className="workout-list">
            {recentWorkouts.slice(0, 5).map(w => {
              const score = w.formScore || 0;
              const gradeColor = score >= 80 ? 'var(--accent)' : score >= 60 ? 'var(--yellow)' : 'var(--red)';
              return (
                <div key={w.id} className="workout-row">
                  <div className="workout-grade" style={{ '--grade-color': gradeColor }}>
                    {gradeFromScore(score)}
                  </div>
                  <div className="workout-info">
                    <span className="workout-name">{w.exerciseName || w.exercise}</span>
                    <span className="workout-meta">
                      {new Date(w.date || w.createdAt).toLocaleDateString()} &middot; {w.reps} {t('reps').toLowerCase()}
                      {w.weight > 0 && ` \u00B7 ${w.weight}kg`}
                    </span>
                  </div>
                  <div className="workout-reps">
                    <span className="workout-reps-num">{w.reps}</span>
                    <span className="workout-reps-label">reps</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="home-footer">
        <span className="home-footer-text">100% on-device analysis</span>
        <span className="home-footer-dot">&middot;</span>
        <span className="home-footer-text">No data leaves your phone</span>
      </div>
    </div>
  );
}
