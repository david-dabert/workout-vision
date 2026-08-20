import { useState, useEffect } from 'react';
import { getAllWorkouts, getFoodLog, getProfile } from '../lib/storage';
import { getDailyTargets, estimateDailyBurn } from '../lib/nutrition';
import { analyzeProgression } from '../lib/progression';
import { Flame, Dumbbell, Target, TrendingUp, AlertTriangle } from 'lucide-react';

export default function Dashboard({ profile, modelStatus, onNavigate }) {
  const [recentWorkouts, setRecentWorkouts] = useState([]);
  const [todayStats, setTodayStats] = useState(null);
  const [progression, setProgression] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    const handler = () => setShowInstall(true);
    window.addEventListener('installpromptready', handler);
    // Check if already available
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
    const p = await getProfile();

    const dayStart = new Date(today);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(today);
    dayEnd.setHours(23, 59, 59, 999);
    const todayWorkouts = allWorkouts.filter(w => {
      const t = w.createdAt || new Date(w.date).getTime();
      return t >= dayStart.getTime() && t <= dayEnd.getTime();
    });

    const targets = p ? getDailyTargets(p) : null;
    const caloriesEaten = todayFood.reduce((s, e) => s + (e.calories || 0), 0);
    const caloriesBurned = p ? estimateDailyBurn(todayWorkouts, parseFloat(p.weight) || 70) : 0;
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
      setProgression(analyzeProgression(allWorkouts, p));
    }
  }

  const statusDot = modelStatus === 'ready' ? 'ready'
    : modelStatus === 'error' ? 'err' : 'pulse';
  const statusText = modelStatus === 'ready' ? 'AI Engine Ready'
    : modelStatus === 'error' ? 'Engine Failed' : 'Loading AI...';

  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="home">
      <div className="home-top">
        <h1 className="logo">Workout<span>Vision</span></h1>
        <p className="tagline">Your AI Gym Companion</p>
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
        <h1 className="logo">Workout<span>Vision</span></h1>
        <p className="tagline">Your AI Gym Companion</p>
        <div className="model-status">
          <span className={`dot ${statusDot}`} />
          {statusText}
        </div>
      </div>

      {showInstall && (
        <div className="install-banner">
          <div>
            <p>Install WorkoutVision</p>
            <span className="text-xs text-muted">Add to home screen for full app experience</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleInstall}>Install</button>
        </div>
      )}

      {/* Today's snapshot */}
      {todayStats && (todayStats.workoutCount > 0 || todayStats.caloriesEaten > 0) && (
        <div className="card">
          <h4 style={{ marginBottom: 8 }}>Today</h4>
          <div className="today-stats">
            {todayStats.workoutCount > 0 && (
              <div className="today-stat">
                <Dumbbell size={16} style={{ color: 'var(--accent)' }} />
                <div>
                  <span className="today-stat-value">{todayStats.workoutCount} sets</span>
                  <span className="today-stat-label">{todayStats.totalReps} reps</span>
                </div>
              </div>
            )}
            {todayStats.caloriesBurned > 0 && (
              <div className="today-stat">
                <Flame size={16} style={{ color: 'var(--red)' }} />
                <div>
                  <span className="today-stat-value">{todayStats.caloriesBurned} kcal</span>
                  <span className="today-stat-label">burned</span>
                </div>
              </div>
            )}
            {todayStats.caloriesEaten > 0 && todayStats.calorieTarget > 0 && (
              <div className="today-stat">
                <Target size={16} style={{ color: 'var(--blue)' }} />
                <div>
                  <span className="today-stat-value">{todayStats.caloriesEaten}/{todayStats.calorieTarget}</span>
                  <span className="today-stat-label">kcal eaten</span>
                </div>
              </div>
            )}
            {todayStats.proteinEaten > 0 && todayStats.proteinTarget > 0 && (
              <div className="today-stat">
                <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '0.75rem' }}>P</span>
                <div>
                  <span className="today-stat-value">{Math.round(todayStats.proteinEaten)}/{todayStats.proteinTarget}g</span>
                  <span className="today-stat-label">protein</span>
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
                {progression.overallTrend === 'progressing' ? 'Progressing' :
                 progression.overallTrend === 'regressing' ? 'Needs attention' : 'Plateau'}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              {progression.streakDays > 0 && (
                <span className="streak-badge">{progression.streakDays}d streak</span>
              )}
            </div>
          </div>
          {progression.deloadNeeded && (
            <div className="deload-warning">
              <AlertTriangle size={14} />
              <span>Consider a deload week. Form scores declining over 4 weeks.</span>
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
                  View all progressions
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
          <span className="nav-icon">LIVE</span>
          <span className="nav-title">Live Training</span>
          <span className="nav-desc">Real-time form coaching with camera</span>
        </div>
        <div
          className="nav-card"
          onClick={() => onNavigate('analyze')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('analyze'); } }}
        >
          <span className="nav-icon">VIDEO</span>
          <span className="nav-title">Analyze Video</span>
          <span className="nav-desc">Upload and analyze recordings</span>
        </div>
        <div
          className="nav-card"
          onClick={() => onNavigate('identify')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('identify'); } }}
        >
          <span className="nav-icon">ID</span>
          <span className="nav-title">Identify Machine</span>
          <span className="nav-desc">Photo a machine to find the exercise</span>
        </div>
        <div
          className="nav-card"
          onClick={() => onNavigate('nutrition')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('nutrition'); } }}
        >
          <span className="nav-icon">FOOD</span>
          <span className="nav-title">Log Nutrition</span>
          <span className="nav-desc">Scan barcode or photo your plate</span>
        </div>
        <div
          className="nav-card"
          onClick={() => onNavigate('plan')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('plan'); } }}
        >
          <span className="nav-icon">PLAN</span>
          <span className="nav-title">My Plan</span>
          <span className="nav-desc">Personalized workout plan & body analysis</span>
        </div>
        <div
          className="nav-card"
          onClick={() => onNavigate('log')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('log'); } }}
        >
          <span className="nav-icon">LOG</span>
          <span className="nav-title">Manual Log</span>
          <span className="nav-desc">Log sets without camera</span>
        </div>
        <div
          className="nav-card"
          onClick={() => onNavigate('history')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('history'); } }}
        >
          <span className="nav-icon">PRs</span>
          <span className="nav-title">Exercise History</span>
          <span className="nav-desc">All sets, PRs, and progress per exercise</span>
        </div>
      </div>

      {!profile && (
        <div className="card card-cta card-welcome" onClick={() => onNavigate('profile')}>
          <h3>Set up your profile</h3>
          <p className="text-sm text-muted">
            Add your weight, height, age for personalized calories and macro targets
          </p>
        </div>
      )}

      {recentWorkouts.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <h3>Recent</h3>
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
                <span style={{ color: '#fff', fontWeight: 700 }}>{w.reps} reps</span>
                {w.formScore != null && (
                  <>
                    <br />
                    <span className="text-xs text-muted">Form: {w.formScore}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="home-info">
        <h3>Your AI Gym Companion</h3>
        <div className="steps">
          <div className="step-row">
            <span className="step-n">1</span>
            <span>Real-time pose detection with form coaching and voice cues</span>
          </div>
          <div className="step-row">
            <span className="step-n">2</span>
            <span>Track nutrition: scan barcodes, photo plates, search 100+ foods</span>
          </div>
          <div className="step-row">
            <span className="step-n">3</span>
            <span>Get science-backed progression and periodization recommendations</span>
          </div>
        </div>

        <div className="science">
          <h4>What makes it different</h4>
          <ul>
            <li>Real-time pose detection with 33 body landmarks</li>
            <li>Per-rep form scoring and voice coaching</li>
            <li>Velocity tracking for fatigue detection</li>
            <li>55+ exercises with form analysis</li>
            <li>Personalized nutrition and macro targets</li>
            <li>Periodized workout plans adapted to your goals</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
