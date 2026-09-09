import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { ProfileProvider, useProfile } from './lib/ProfileContext';
import { LanguageProvider, useT } from './lib/LanguageContext';
import useHashRouter from './lib/useHashRouter';
import { parseChallengeFromURL, parseResponseFromURL } from './lib/challenges';
import { checkAndMigrateSchema } from './lib/storage';
import Dashboard from './components/Dashboard';

import ErrorBoundary from './components/ErrorBoundary';

// Dynamic GPU capability detection: disable backdrop-filter on weak devices
(() => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) { document.documentElement.classList.add('no-glass'); return; }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
    // Detect low-end mobile GPUs that choke on backdrop-filter compositing
    const isLowEnd = /SwiftShader|llvmpipe|Software|Mali-4|Adreno\s[23]\d{2}/i.test(renderer);
    // Also detect iOS devices with < 4GB RAM (approximation via device pixel ratio + screen)
    const isOldiOS = /iPad|iPhone/.test(navigator.userAgent) && window.devicePixelRatio <= 2 && screen.height < 812;
    if (isLowEnd || isOldiOS) {
      document.documentElement.classList.add('no-glass');
    }
    // Clean up GL context
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  } catch { /* silent fallback: keep glass */ }
})();

// Wrap lazy imports so chunk-load failures surface a readable error
// instead of an uncatchable rejected promise.
const safeLazy = (loader) => lazy(() =>
  loader().catch(err => {
    console.error('[Lazy load failed]', err);
    return { default: () => { throw err; } };
  })
);

const Analyze = safeLazy(() => import('./components/VideoUpload'));
const ManualLog = safeLazy(() => import('./components/ManualLog'));
const WorkoutHistory = safeLazy(() => import('./components/WorkoutHistory'));
const RestTimer = safeLazy(() => import('./components/RestTimer'));
const ProfilePage = safeLazy(() => import('./components/Profile'));
const Validate = safeLazy(() => import('./components/Validate'));
const WeeklyReport = safeLazy(() => import('./components/WeeklyReport'));

const LazyFallback = (
  <div className="page" style={{ padding: '1rem', maxWidth: 480, margin: '0 auto' }}>
    <div className="skeleton" style={{ width: '60%', height: 24, borderRadius: 8, marginBottom: 16 }} />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
      <div className="skeleton" style={{ height: 72, borderRadius: 12 }} />
      <div className="skeleton" style={{ height: 72, borderRadius: 12 }} />
      <div className="skeleton" style={{ height: 72, borderRadius: 12 }} />
      <div className="skeleton" style={{ height: 72, borderRadius: 12 }} />
    </div>
    <div className="skeleton" style={{ height: 120, borderRadius: 14, marginBottom: 12 }} />
    <div className="skeleton" style={{ height: 80, borderRadius: 14 }} />
  </div>
);

function AppInner() {
  const { profile, saveProfile, profileLoading } = useProfile();
  const { t } = useT();
  const [page, setPage] = useHashRouter();
  const [modelStatus, setModelStatus] = useState('loading');
  const [challenge, setChallenge] = useState(null);
  const [challengeResponse, setChallengeResponse] = useState(null);

  // Run storage schema migration on mount
  useEffect(() => {
    checkAndMigrateSchema().catch(err => console.error('[App] Schema migration error:', err));
  }, []);

  // Check for challenge or response URL on mount
  useEffect(() => {
    const parsed = parseChallengeFromURL();
    if (parsed) { setChallenge(parsed); return; }
    const resp = parseResponseFromURL();
    if (resp) setChallengeResponse(resp);
  }, []);

  const loadModelRef = useRef(null);
  loadModelRef.current = () => {
    setModelStatus('loading');
    const timeout = setTimeout(() => setModelStatus('error'), 45000);
    import('./lib/poseAnalysis')
      .then((mod) => mod.preloadModel())
      .then((ok) => { clearTimeout(timeout); setModelStatus(ok ? 'ready' : 'error'); })
      .catch(() => { clearTimeout(timeout); setModelStatus('error'); });
  };

  useEffect(() => { loadModelRef.current(); }, []);

  const retryModel = () => loadModelRef.current();

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
        onRetryModel={retryModel}
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
    <ErrorBoundary>
      <LanguageProvider>
        <ProfileProvider>
          <ErrorBoundary>
            <AppInner />
          </ErrorBoundary>
        </ProfileProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
