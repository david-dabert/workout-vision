import { useState, useEffect } from 'react';
import { getAllWorkouts, getFoodLog } from '../lib/storage';
import { getDailyTargets, estimateDailyBurn } from '../lib/nutrition';
import { analyzeProgression } from '../lib/progression';
import { t, getLang, setLang, onLangChange } from '../lib/i18n';
import { Flame, Dumbbell, Target, TrendingUp, AlertTriangle } from 'lucide-react';

export default function Dashboard({ profile, modelStatus, onNavigate }) {
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [todayStats, setTodayStats] = useState(null);
  const [progression, setProgression] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [, setLangTick] = useState(0);

  useEffect(() => onLangChange(() => setLangTick(n => n + 1)), []);

  useEffect(() => {
    const handler = () => setShowInstall(true);
    window.addEventListener('installpromptready', handler);
    if (window.getInstallPrompt && window.getInstallPrompt()) setShowInstall(true);
    return () => window.removeEventListener('installpromptready', handler);
  }, []);

  const handleInstall = async () => {
    const prompt = window.getInstallPrompt?.();
    if (prompt) {
      prompt.prompt();
      const result = await prompt.userChoice;
      if (result.outcome === 'accepted') setShowInstall(false);
    }
  };

  async function loadData() {
    const allWorkouts = await getAllWorkouts();
    setRecentWorkouts(allWorkouts.slice(0, 3));

    const today = new Date().toISOString().split('T')[0];
    const todayFood = await getFoodLog(today);

    const dayStart = new Date(today);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(today);
    dayEnd.setHours(23, 59, 59, 999);
    const todayWorkouts = allWorkouts.filter(w => {
      const t = w.createdAt || new Date(w.date).getTime();
      return t >= dayStart.getTime() && t <= dayEnd.getTime();
    });

    const targets = profile ? getDailyTargets(profile) : null;
    const caloriesEaten = todayFood.reduce((s, e) => s + (e.calories || 0), 0);
    const caloriesBurned = profile ? estimateDailyBurn(todayWorkouts, parseFloat(profile.weight) || 70) : 0;
    const proteinEaten = todayFood.reduce((s, e) => s + (e.protein || 0), 0);

    setTodayStats({
      workoutCount: todayWorkouts.length,
      totalReps: todayWorkouts.reduce((s, w) => s + (w.reps || 0), 0),
      caloriesEaten,
      caloriesBurned,
      proteinEaten,
      calorieTarget: targets?.calories || 0,
      proteinTarget: targets?.protein || 0,
    });

    if (allWorkouts.length >= 3) {
      setProgression(analyzeProgression(allWorkouts, profile));
    }
  }

  const statusDot = modelStatus === 'ready' ? 'ready'
    : modelStatus === 'error' ? 'err' : 'pulse';
  const statusText = modelStatus === 'ready' ? t('ai_engine_ready')
    : modelStatus === 'error' ? t('engine_failed') : t('loading_ai');

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="home">
      <div className="home-top">
        <h1 className="logo">Workout<span>Vision</span></h1>
        <p className="tagline">{t('tagline')}</p>
        <div className="model-status"><span className={`dot ${statusDot}`} />{statusText}</div>
      </div>
      <div className="card" style={{ height: 80, background: 'var(--card)', borderRadius: 'var(--radius)', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div className="nav-grid">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="nav-card" style={{ opacity: 0.4, minHeight: 90 }} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="home">
      <div className="home-top">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="logo">Workout<span>Vision</span></h1>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              className={`btn btn-sm ${getLang() === 'en' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setLang('en')}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >EN</button>
            <button
              className={`btn btn-sm ${getLang() === 'fr' ? 'btn-primary' : 'btn-ghost'}`}
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

      {showInstall && (
        <div className="install-banner">
          <div>
            <p>{t('install_app')}</p>
            <span className="text-xs text-muted">{t('install_desc')}</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleInstall}>{t('install')}</button>
        </div>
      )}

      {/* Today's snapshot */}
      {todayStats && (todayStats.workoutCount > 0 || todayStats.caloriesEaten > 0) && (
        <div className="card">
          <h4 style={{ marginBottom: 8 }}>{t('today')}</h4>
          <div className="today-stats">
            {todayStats.workoutCount > 0 && (
              <div className="today-stat">
                <Dumbbell size={16} style={{ color: 'var(--accent)' }} />
                <div>
                  <span className="today-stat-value">{todayStats.workoutCount} {t('sets')}</span>
                  <span className="today-stat-label">{todayStats.totalReps} {t('reps').toLowerCase()}</span>
                </div>
              </div>
            )}
            {todayStats.caloriesBurned > 0 && (
              <div className="today-stat">
                <Flame size={16} style={{ color: 'var(--red)' }} />
                <div>
                  <span className="today-stat-value">{todayStats.caloriesBurned} {t('kcal')}</span>
                  <span className="today-stat-label">{t('burned')}</span>
                </div>
              </div>
            )}
            {todayStats.caloriesEaten > 0 && todayStats.calorieTarget > 0 && (
              <div className="today-stat">
                <Target size={16} style={{ color: 'var(--blue)' }} />
                <div>
                  <span className="today-stat-value">{todayStats.caloriesEaten}/{todayStats.calorieTarget}</span>
                  <span className="today-stat-label">{t('kcal_eaten')}</span>
                </div>
              </div>
            )}
            {todayStats.proteinEaten > 0 && todayStats.proteinTarget > 0 && (
              <div className="today-stat">
                <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '0.75rem' }}>P</span>
                <div>
                  <span className="today-stat-value">{Math.round(todayStats.proteinEaten)}/{todayStats.proteinTarget}g</span>
                  <span className="today-stat-label">{t('protein')}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Streak and progression */}
      {progression && progression.overallTrend !== 'insufficient' && (
        <div className="card">
          <div className="progression-header">
            <div>
              <span className={`progression-badge ${progression.overallTrend}`}>
                {progression.overallTrend === 'progressing' ? t('progressing') :
                 progression.overallTrend === 'regressing' ? t('needs_attention') : t('plateau')}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              {progression.streakDays > 0 && (
                <span className="streak-badge">{progression.streakDays}{t('d_streak')}</span>
              )}
            </div>
          </div>
          {progression.deloadNeeded && (
            <div className="deload-warning">
              <AlertTriangle size={14} />
              <span>{t('deload_warning')}</span>
            </div>
          )}
          {progression.exerciseProgressions.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {progression.exerciseProgressions.slice(0, 2).map(p => (
                <div key={p.exercise} className="progression-item">
                  <div className="progression-item-header">
                    <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.82rem' }}>{p.name}</span>
                    <span className={`progression-trend ${p.trend}`}>
                      {p.trend === 'progressing' ? '↑' : p.trend === 'regressing' ? '↓' : '→'}
                    </span>
                  </div>
                  <p className="text-xs text-muted" style={{ marginTop: 2 }}>{p.recommendation}</p>
                </div>
              ))}
              {progression.exerciseProgressions.length > 2 && (
                <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 4 }} onClick={() => onNavigate('progress')}>
                  {t('view_all_progressions')}
                </button>
              )}
            </div>
          )}
        </div>
      )}

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
          onClick={() => onNavigate('identify')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('identify'); } }}
        >
          <span className="nav-icon">{t('nav_id')}</span>
          <span className="nav-title">{t('nav_id_title')}</span>
          <span className="nav-desc">{t('nav_id_desc')}</span>
        </div>
        <div
          className="nav-card"
          onClick={() => onNavigate('nutrition')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('nutrition'); } }}
        >
          <span className="nav-icon">{t('nav_food')}</span>
          <span className="nav-title">{t('nav_food_title')}</span>
          <span className="nav-desc">{t('nav_food_desc')}</span>
        </div>
        <div
          className="nav-card"
          onClick={() => onNavigate('plan')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('plan'); } }}
        >
          <span className="nav-icon">{t('nav_plan')}</span>
          <span className="nav-title">{t('nav_plan_title')}</span>
          <span className="nav-desc">{t('nav_plan_desc')}</span>
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
        <div
          className="nav-card"
          onClick={() => onNavigate('history')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('history'); } }}
        >
          <span className="nav-icon">{t('nav_prs')}</span>
          <span className="nav-title">{t('nav_prs_title')}</span>
          <span className="nav-desc">{t('nav_prs_desc')}</span>
        </div>
        <div
          className="nav-card"
          onClick={() => onNavigate('timer')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('timer'); } }}
        >
          <span className="nav-icon">{t('nav_rest')}</span>
          <span className="nav-title">{t('nav_rest_title')}</span>
          <span className="nav-desc">{t('nav_rest_desc')}</span>
        </div>
      </div>

      {!profile && (
        <div className="card card-cta card-welcome" onClick={() => onNavigate('profile')}>
          <h3>{t('setup_profile')}</h3>
          <p className="text-sm text-muted">
            {t('setup_profile_desc')}
          </p>
        </div>
      )}

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
                {w.formScore != null && (
                  <>
                    <br />
                    <span className="text-xs text-muted">{t('form_colon')} {w.formScore}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="home-info">
        <h3>{t('tagline')}</h3>
        <div className="steps">
          <div className="step-row">
            <span className="step-n">1</span>
            <span>{t('step_1_desc')}</span>
          </div>
          <div className="step-row">
            <span className="step-n">2</span>
            <span>{t('step_2_desc')}</span>
          </div>
          <div className="step-row">
            <span className="step-n">3</span>
            <span>{t('step_3_desc')}</span>
          </div>
        </div>

        <div className="science">
          <h4>{t('what_makes_different')}</h4>
          <ul>
            <li>{t('diff_1')}</li>
            <li>{t('diff_2')}</li>
            <li>{t('diff_3')}</li>
            <li>{t('diff_4')}</li>
            <li>{t('diff_5')}</li>
            <li>{t('diff_6')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
