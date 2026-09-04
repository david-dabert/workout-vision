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
        <p className="landing-tagline">
          AI-Powered Form Analysis. 100% On-Device.
        </p>
        <button className="btn btn-primary btn-lg landing-cta" onClick={handleGetStarted}>
          Get Started
        </button>
        <div className="landing-badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          No cloud. No uploads. Your data stays on your device.
        </div>
      </section>

      {/* ── Features ── */}
      <section className="landing-section">
        <h2 className="landing-section-title">Features</h2>
        <div className="landing-grid">
          <div className="card landing-feature-card">
            <div className="landing-feature-icon">📐</div>
            <h3 className="landing-feature-title">Real-Time Form Analysis</h3>
            <p className="landing-feature-desc">
              AI pose detection gives instant feedback on your movement quality as you train.
            </p>
          </div>
          <div className="card landing-feature-card">
            <div className="landing-feature-icon">📊</div>
            <h3 className="landing-feature-title">Personal Baselines</h3>
            <p className="landing-feature-desc">
              Learn your patterns, track improvement over time, and see how consistency compounds.
            </p>
          </div>
          <div className="card landing-feature-card">
            <div className="landing-feature-icon">🔒</div>
            <h3 className="landing-feature-title">Privacy-First</h3>
            <p className="landing-feature-desc">
              Everything runs locally in your browser. Zero data leaves your device.
            </p>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="landing-section">
        <h2 className="landing-section-title">How It Works</h2>
        <div className="landing-grid">
          <div className="card landing-step-card">
            <div className="landing-step-number">1</div>
            <h3 className="landing-feature-title">Record</h3>
            <p className="landing-feature-desc">
              Film your workout or use live camera feed directly in the browser.
            </p>
          </div>
          <div className="card landing-step-card">
            <div className="landing-step-number">2</div>
            <h3 className="landing-feature-title">Analyze</h3>
            <p className="landing-feature-desc">
              AI detects your movement and scores form in real time.
            </p>
          </div>
          <div className="card landing-step-card">
            <div className="landing-step-number">3</div>
            <h3 className="landing-feature-title">Improve</h3>
            <p className="landing-feature-desc">
              Get coaching insights and track your progress over time.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <p>Built with MediaPipe &amp; React</p>
        <p className="landing-footer-sub">Open Source</p>
      </footer>
    </div>
  );
}
