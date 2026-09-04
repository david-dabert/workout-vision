import { useState, useEffect, lazy, Suspense } from 'react';
import { ProfileProvider, useProfile } from './lib/ProfileContext';
import { LanguageProvider } from './lib/LanguageContext';
import useHashRouter from './lib/useHashRouter';
import Dashboard from './components/Dashboard';
import Onboarding from './components/Onboarding';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

const Analyze = lazy(() => import('./components/Analyze'));
const ManualLog = lazy(() => import('./components/ManualLog'));
const WorkoutHistory = lazy(() => import('./components/WorkoutHistory'));
const RestTimer = lazy(() => import('./components/RestTimer'));
const ProfilePage = lazy(() => import('./components/Profile'));
const Validate = lazy(() => import('./components/Validate'));
const DesignDemo = lazy(() => import('./components/DesignDemo'));
const LandingPage = lazy(() => import('./components/LandingPage'));

const LazyFallback = (
  <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
    <div className="spinner" />
  </div>
);

function AppInner() {
  const { profile, saveProfile, profileLoading } = useProfile();
  const [page, setPage] = useHashRouter();
  const [modelStatus, setModelStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) setModelStatus('error');
    }, 15000);
    // Dynamic import: MediaPipe WASM must not execute at bundle parse time.
    // It crashes Safari if the WASM environment isn't ready. Lazy-loading
    // lets React mount first, then loads the AI engine in the background.
    import('./lib/poseAnalysis')
      .then((mod) => mod.preloadModel())
      .then((ok) => { if (!cancelled) setModelStatus(ok ? 'ready' : 'error'); })
      .catch(() => { if (!cancelled) setModelStatus('error'); });
    return () => { cancelled = true; clearTimeout(timeout); };
  }, []);

  const onNavigate = (p) => setPage(p);

  // Wait for profile check before rendering
  if (profileLoading) return LazyFallback;

  // First-time user: show onboarding
  if (!profile) {
    return (
      <Onboarding onComplete={async (p) => {
        await saveProfile(p);
        setPage('dashboard');
      }} />
    );
  }

  // Full-screen pages (no tab bar)
  if (page === 'analyze') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <Analyze onClose={() => setPage('dashboard')} />
      </Suspense>
    </ErrorBoundary>
  );
  if (page === 'log') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <ManualLog onClose={() => setPage('dashboard')} />
      </Suspense>
    </ErrorBoundary>
  );
  if (page === 'history') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <WorkoutHistory onClose={() => setPage('dashboard')} />
      </Suspense>
    </ErrorBoundary>
  );
  if (page === 'rest') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <RestTimer onClose={() => setPage('dashboard')} />
      </Suspense>
    </ErrorBoundary>
  );
  if (page === 'profile') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <ProfilePage onClose={() => setPage('dashboard')} />
      </Suspense>
    </ErrorBoundary>
  );
  if (page === 'validate') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <Validate onClose={() => setPage('dashboard')} />
      </Suspense>
    </ErrorBoundary>
  );
  if (page === 'landing') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <LandingPage onNavigate={onNavigate} />
      </Suspense>
    </ErrorBoundary>
  );

  return (
    <div className="app">
      <Dashboard
        profile={profile}
        modelStatus={modelStatus}
        onNavigate={onNavigate}
      />
      <nav className="tab-bar">
        <button className={`tab-item${page === 'dashboard' ? ' active' : ''}`} onClick={() => setPage('dashboard')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Home</span>
        </button>
        <button className={`tab-item${page === 'analyze' ? ' active' : ''}`} onClick={() => onNavigate('analyze')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <span>Analyze</span>
        </button>
        <button className={`tab-item${page === 'history' ? ' active' : ''}`} onClick={() => onNavigate('history')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span>Progress</span>
        </button>
        <button className={`tab-item${page === 'rest' ? ' active' : ''}`} onClick={() => onNavigate('rest')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>Timer</span>
        </button>
        <button className={`tab-item${page === 'profile' ? ' active' : ''}`} onClick={() => onNavigate('profile')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>Profile</span>
        </button>
      </nav>
    </div>
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);

  // Design demo mode: standalone prototype
  if (params.has('demo')) {
    return (
      <ErrorBoundary>
        <Suspense fallback={LazyFallback}>
          <DesignDemo onExit={() => { window.location.search = ''; }} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Validate mode: render directly, skip all providers
  if (params.has('validate')) {
    return (
      <ErrorBoundary>
        <Suspense fallback={LazyFallback}>
          <Validate onClose={() => { window.location.search = ''; }} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <LanguageProvider>
      <ProfileProvider>
        <ErrorBoundary>
          <AppInner />
        </ErrorBoundary>
      </ProfileProvider>
    </LanguageProvider>
  );
}

export default App;
