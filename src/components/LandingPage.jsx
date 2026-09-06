import { useCallback } from 'react';

export default function LandingPage({ onNavigate }) {
  const handleGetStarted = useCallback(() => {
    onNavigate('dashboard');
  }, [onNavigate]);

  return (
    <div className="landing-page">
      {/* ── Hero ── */}
      <section className="landing-hero">
        <div className="landing-hero-glow" />
        <h1 className="landing-title">
          Workout<span className="landing-title-accent">Vision</span>
        </h1>
        <p className="landing-tagline" style={{ fontSize: '1.15rem', maxWidth: 340, margin: '0 auto 20px', lineHeight: 1.5 }}>
          AI-powered form coaching that runs entirely on your device. Free. Private. No account needed.
        </p>
        <button className="btn btn-primary btn-lg landing-cta" onClick={handleGetStarted}
          style={{ padding: '14px 48px', fontSize: '1rem', fontWeight: 700, borderRadius: 14 }}>
          Start Training
        </button>
        <div className="landing-badge" style={{ marginTop: 16 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Zero uploads. Your videos never leave your phone.
        </div>
      </section>

      {/* ── Key numbers ── */}
      <section style={{
        display: 'flex', justifyContent: 'center', gap: 32, padding: '24px 20px',
        margin: '0 auto', maxWidth: 400,
      }}>
        {[
          { value: '264', label: 'Exercises' },
          { value: '33', label: 'AI Landmarks' },
          { value: '100%', label: 'On-Device' },
        ].map((stat, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--accent)' }}>{stat.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{stat.label}</div>
          </div>
        ))}
      </section>

      {/* ── Features ── */}
      <section className="landing-section">
        <h2 className="landing-section-title">What it does</h2>
        <div className="landing-grid">
          {[
            {
              icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
              title: 'Real-Time Form Analysis',
              desc: 'AI tracks 33 body landmarks to score your form on every rep, in real time.',
            },
            {
              icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
              title: 'Injury Risk Prediction',
              desc: 'Detects overtraining, asymmetry growth, and form degradation before they become injuries.',
            },
            {
              icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
              title: 'Privacy-First',
              desc: 'No accounts. No cloud. No uploads. Everything runs in your browser using on-device AI.',
            },
            {
              icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
              title: 'Challenge Friends',
              desc: 'Share challenges via URL. No app install needed. Compare form scores head to head.',
            },
          ].map((feature, i) => (
            <div key={i} className="card landing-feature-card" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {feature.icon}
              </div>
              <h3 className="landing-feature-title" style={{ fontSize: '0.95rem' }}>{feature.title}</h3>
              <p className="landing-feature-desc" style={{ fontSize: '0.82rem', lineHeight: 1.5 }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="landing-section">
        <h2 className="landing-section-title">Three steps</h2>
        <div className="landing-grid" style={{ gap: 16 }}>
          {[
            { num: '1', title: 'Record', desc: 'Film your set with your phone camera or upload a video.' },
            { num: '2', title: 'Analyze', desc: 'AI detects the exercise, counts reps, and scores your form.' },
            { num: '3', title: 'Improve', desc: 'Get specific coaching cues and track progress over time.' },
          ].map((step, i) => (
            <div key={i} className="card landing-step-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent-gradient)', color: '#000',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '1rem',
              }}>{step.num}</div>
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 2 }}>{step.title}</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Social proof placeholder ── */}
      <section className="landing-section" style={{ textAlign: 'center' }}>
        <h2 className="landing-section-title">Built on Science</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: 340, margin: '0 auto 16px', lineHeight: 1.6 }}>
          Form checks based on Schoenfeld (2017), McGill (2010), Fry (2003). Injury prediction using Gabbett ACWR (2016). Volume thresholds from Israetel MRV guidelines.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
          {['MediaPipe', 'React 19', 'IndexedDB', 'Web Speech API'].map(tech => (
            <span key={tech} style={{
              padding: '4px 12px', borderRadius: 20,
              background: 'var(--surface-elevated)', border: '1px solid var(--border)',
              fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500,
            }}>{tech}</span>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ textAlign: 'center', padding: '32px 20px' }}>
        <button className="btn btn-primary btn-lg landing-cta" onClick={handleGetStarted}
          style={{ padding: '14px 48px', fontSize: '1rem', fontWeight: 700, borderRadius: 14 }}>
          Start Training Free
        </button>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <p>Open source. Built with AI.</p>
      </footer>
    </div>
  );
}
