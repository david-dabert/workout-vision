import { useState, useEffect } from 'react';
import { getAllWorkouts } from '../lib/storage';
import { useT } from '../lib/LanguageContext';

export default function Dashboard({ profile, modelStatus, onNavigate }) {
  const { t, lang, setLang } = useT();
  const [recentWorkouts, setRecentWorkouts] = useState([]);

  const statusDot = modelStatus === 'ready' ? 'ready'
    : modelStatus === 'error' ? 'err' : 'pulse';
  const statusText = modelStatus === 'ready' ? t('ai_engine_ready')
    : modelStatus === 'error' ? t('engine_failed') : t('loading_ai');

  useEffect(() => {
    getAllWorkouts().then(all => setRecentWorkouts(all.slice(0, 5)));
  }, []);

  return (
    <div className="home">
      <div className="home-top">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="logo">Workout<span>Vision</span></h1>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`btn btn-sm ${lang === 'en' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setLang('en')}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >EN</button>
            <button
              className={`btn btn-sm ${lang === 'fr' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setLang('fr')}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >FR</button>
          </div>
        </div>
        <p className="tagline">{t('tagline')}</p>
        <div className="model-status">
          <span className={`dot ${statusDot}`} />
          {statusText}
        </div>
      </div>

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

      {recentWorkouts.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <h3>{t('recent')}</h3>
          {recentWorkouts.map(w => (
            <div key={w.id} className="card card-row">
              <div>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.88rem' }}>
                  {w.exerciseName || w.exercise}
                </span>
                <br />
                <span className="text-xs text-muted">
                  {new Date(w.date || w.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ color: '#fff', fontWeight: 700 }}>{w.reps} {t('reps').toLowerCase()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
