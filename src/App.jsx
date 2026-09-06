import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { ProfileProvider, useProfile } from './lib/ProfileContext';
import { LanguageProvider, useT } from './lib/LanguageContext';
import useHashRouter from './lib/useHashRouter';
import { parseChallengeFromURL, parseResponseFromURL } from './lib/challenges';
import Dashboard from './components/Dashboard';
import Onboarding from './components/Onboarding';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Wrap lazy imports so chunk-load failures surface a readable error
// instead of an uncatchable rejected promise.
const safeLazy = (loader) => lazy(() =>
  loader().catch(err => {
    console.error('[Lazy load failed]', err);
    return { default: () => { throw err; } };
  })
);

const Analyze = safeLazy(() => import('./components/Analyze'));
const ManualLog = safeLazy(() => import('./components/ManualLog'));
const WorkoutHistory = safeLazy(() => import('./components/WorkoutHistory'));
const RestTimer = safeLazy(() => import('./components/RestTimer'));
const ProfilePage = safeLazy(() => import('./components/Profile'));
const Validate = safeLazy(() => import('./components/Validate'));
const DesignDemo = safeLazy(() => import('./components/DesignDemo'));
const LandingPage = safeLazy(() => import('./components/LandingPage'));
const WeeklyReport = safeLazy(() => import('./components/WeeklyReport'));

const LazyFallback = (
  <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
    <div className="spinner" />
  </div>
);

function AppInner() {
  const { profile, saveProfile, profileLoading } = useProfile();
  const { t } = useT();
  const [page, setPage] = useHashRouter();
  const [modelStatus, setModelStatus] = useState('loading');
  const [challenge, setChallenge] = useState(null);
  const [challengeResponse, setChallengeResponse] = useState(null);

  // Check for challenge or response URL on mount
  useEffect(() => {
    const parsed = parseChallengeFromURL();
    if (parsed) { setChallenge(parsed); return; }
    const resp = parseResponseFromURL();
    if (resp) setChallengeResponse(resp);
  }, []);

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

  // Auto-create default profile for first-time users and skip straight to dashboard
  const autoCreatedRef = useRef(false);
  useEffect(() => {
    if (!profileLoading && !profile && !autoCreatedRef.current) {
      autoCreatedRef.current = true;
      const defaultProfile = {
        name: '',
        age: '',
        sex: 'male',
        weight: '',
        height: '',
        experience: 'intermediate',
        goal: 'general',
        activityLevel: 'moderate',
        injuries: [],
        profileComplete: false,
      };
      saveProfile(defaultProfile).then(() => setPage('dashboard'));
    }
  }, [profileLoading, profile, saveProfile, setPage]);

  // Wait for profile check (and potential auto-create) before rendering
  if (profileLoading || !profile) return LazyFallback;

  // Full-screen pages (no tab bar) - wrapped with page transition
  if (page === 'analyze') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <div key="analyze" className="page-transition-enter">
          <Analyze onClose={() => setPage('dashboard')} />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
  if (page === 'log') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <div key="log" className="page-transition-enter">
          <ManualLog onClose={() => setPage('dashboard')} />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
  if (page === 'history') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <div key="history" className="page-transition-enter">
          <WorkoutHistory onClose={() => setPage('dashboard')} />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
  if (page === 'rest') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <div key="rest" className="page-transition-enter">
          <RestTimer onClose={() => setPage('dashboard')} />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
  if (page === 'profile') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <div key="profile" className="page-transition-enter">
          <ProfilePage onClose={() => setPage('dashboard')} />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
  if (page === 'validate') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <div key="validate" className="page-transition-enter">
          <Validate onClose={() => setPage('dashboard')} />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
  if (page === 'landing') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <div key="landing" className="page-transition-fade">
          <LandingPage onNavigate={onNavigate} />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
  if (page === 'weekly') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <div key="weekly" className="page-transition-enter">
          <WeeklyReport onClose={() => setPage('dashboard')} />
        </div>
      </Suspense>
    </ErrorBoundary>
  );

  return (
    <div className="app">
      <Dashboard
        profile={profile}
        modelStatus={modelStatus}
        onNavigate={onNavigate}
        challenge={challenge}
        challengeResponse={challengeResponse}
        onDismissResponse={() => setChallengeResponse(null)}
      />
      <nav className="tab-bar">
        <button className={`tab-item${page === 'dashboard' ? ' active' : ''}`} onClick={() => setPage('dashboard')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>{t('home')}</span>
        </button>
        <button className={`tab-item${page === 'analyze' ? ' active' : ''}`} onClick={() => onNavigate('analyze')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          <span>{t('analyze')}</span>
        </button>
        <button className={`tab-item${page === 'history' ? ' active' : ''}`} onClick={() => onNavigate('history')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span>{t('progress')}</span>
        </button>
        <button className={`tab-item${page === 'rest' ? ' active' : ''}`} onClick={() => onNavigate('rest')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{t('timer')}</span>
        </button>
        <button className={`tab-item${page === 'profile' ? ' active' : ''}`} onClick={() => onNavigate('profile')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>{t('profile')}</span>
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
