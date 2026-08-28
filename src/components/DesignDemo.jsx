import { useState, useEffect, useCallback } from 'react';
import ParticleSkeleton from './ParticleSkeleton';
import ROMChart from './ROMChart';

// ── SVG GRADIENT DEFS ──
const SvgDefs = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }}>
    <defs>
      <linearGradient id="bioGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00f5d4" />
        <stop offset="100%" stopColor="#00e676" />
      </linearGradient>
    </defs>
  </svg>
);

// ── SCREEN 1: THE DROP ──
const DropScreen = ({ onDrop }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 20, position: 'relative', zIndex: 10 }}>
      <div style={{ position: 'absolute', top: 20, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="nav-wordmark">Workout Vision</span>
        <div className="nav-pill">
          <button>EN</button>
          <button className="active">FR</button>
        </div>
      </div>

      <div className="gravitational-well" onClick={onDrop}>
        <div className="well-core" />
        <div className="well-ring" />
        <div className="well-ring" />
        <div className="well-ring" />
      </div>

      <div style={{ fontSize: 56, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 12, background: 'linear-gradient(135deg, #00f5d4, #00e676)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        DROP
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-tertiary)', marginBottom: 40 }}>Your video. Your body. Our vision.</div>
      <div className="t-data">MP4 · MOV · WEBM · MAX 60S</div>
    </div>
  );
};

// ── SCREEN 2: THE BODY ──
const BodyScreen = ({ reps, onRepIncrement }) => {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
      <div className="nav" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
        <span className="nav-wordmark">Analysis</span>
        <button className="nav-close">✕</button>
      </div>

      <div style={{ position: 'absolute', top: 80, left: 0, right: 0, height: '60%', zIndex: 1 }}>
        <ParticleSkeleton onRep={onRepIncrement} />
      </div>

      <div className="hud-rep-counter">
        <div className="hud-rep-number">{reps}</div>
        <div className="hud-rep-label">Repetitions</div>
      </div>

      <div className="hud-status">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 6 }}>
          <span className="hud-status-dot" />
          <span className="hud-status-text">Live</span>
        </div>
        <div className="t-data">Frame 1,247 · 29.97 FPS</div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 20px 28px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="glass" style={{ padding: '16px 18px' }}>
            <div className="text-bio" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>94</div>
            <div className="t-caption">Form Score</div>
          </div>
          <div className="glass" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4, color: 'var(--text-primary)' }}>3.2<span style={{ fontSize: 16, color: 'var(--text-tertiary)' }}>s</span></div>
            <div className="t-caption">Avg Tempo</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Knee', 'Hip', 'Lower Back', 'Shoulder', 'Ankle'].map(l => (
            <span key={l} className={`limit-chip ${['Knee', 'Hip'].includes(l) ? 'active' : ''}`}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── SCREEN 3: THE REPORT ──
const ReportScreen = () => {
  const [score, setScore] = useState(0);

  useEffect(() => {
    let s = 0;
    const interval = setInterval(() => {
      s += 2;
      if (s >= 94) { s = 94; clearInterval(interval); }
      setScore(s);
    }, 30);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: '100vh', padding: '20px 20px 100px', position: 'relative', zIndex: 10, overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="nav-wordmark">Session Report</span>
        <button className="nav-close">✕</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', margin: '24px 0 32px' }}>
        <div className="score-ring" style={{ alignSelf: 'center', marginBottom: 24 }}>
          <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="70" cy="70" r="60" fill="none" stroke="var(--depth-2)" strokeWidth="3" />
            <circle cx="70" cy="70" r="60" fill="none" stroke="url(#bioGradient)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray="377" strokeDashoffset={377 - (377 * score / 100)}
              style={{ filter: 'drop-shadow(0 0 8px rgba(0, 245, 212, 0.4))', transition: 'stroke-dashoffset 0.1s linear' }} />
          </svg>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
            <div className="text-bio" style={{ fontSize: 42, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>{score}</div>
            <div className="t-caption">Form</div>
          </div>
        </div>

        <div className="t-hero" style={{ marginBottom: 8 }}>Great work.</div>
        <div className="t-body">Your squat depth improved 12% compared to your last session.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 28 }}>
        {[{ n: '12', l: 'Reps' }, { n: '89°', l: 'Depth', accent: true }, { n: '1.8s', l: 'Eccentric' }].map(s => (
          <div key={s.l} className="glass" style={{ padding: '18px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6, color: s.accent ? 'var(--bio-cyan)' : 'var(--text-primary)' }}>{s.n}</div>
            <div className="t-caption">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="t-caption" style={{ marginBottom: 14 }}>Detected Exercise</div>
      <div className="glass exercise-card">
        <div className="exercise-icon">
          <svg viewBox="0 0 32 32"><path d="M16 4v8M10 8h12M12 12l-4 10M20 12l4 10M8 22l-2 6M24 22l2 6"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 2 }}>Barbell Squat</div>
          <div className="t-caption">Quadriceps · Barbell</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div className="text-bio" style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>12</div>
          <div className="t-caption">Reps</div>
        </div>
      </div>

      <div className="t-caption" style={{ margin: '28px 0 14px' }}>Range of Motion</div>
      <div className="glass" style={{ padding: 20 }}>
        <ROMChart />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span className="t-data">0s</span>
          <span className="t-data">12s</span>
          <span className="t-data">24s</span>
          <span className="t-data">36s</span>
        </div>
      </div>
    </div>
  );
};

// ── DESIGN DEMO APP ──
export default function DesignDemo({ onExit }) {
  const [screen, setScreen] = useState('drop');
  const [reps, setReps] = useState(0);

  const handleDrop = useCallback(() => setScreen('body'), []);
  const handleRep = useCallback(() => setReps(r => r + 1), []);

  // Auto-advance from body to report after 8 seconds
  useEffect(() => {
    if (screen === 'body') {
      const timer = setTimeout(() => setScreen('report'), 8000);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  return (
    <div className="app-universe">
      <SvgDefs />
      <div className="ambient-glow" />
      <div className="scanline" />
      {screen === 'drop' && <DropScreen onDrop={handleDrop} />}
      {screen === 'body' && <BodyScreen reps={reps} onRepIncrement={handleRep} />}
      {screen === 'report' && <ReportScreen />}
    </div>
  );
}
