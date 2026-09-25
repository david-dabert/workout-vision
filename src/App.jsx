import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { ProfileProvider, useProfile } from './lib/ProfileContext';
import { LanguageProvider, useT } from './lib/LanguageContext';
import useHashRouter from './lib/useHashRouter';
import { parseChallengeFromURL, parseResponseFromURL } from './lib/challenges';
import { checkAndMigrateSchema } from './lib/storage';
import Dashboard from './components/Dashboard';
import TabBar from './components/TabBar';

import ErrorBoundary from './components/ErrorBoundary';
import Choice from './components/experience/Choice';
import Entry, { shouldShowEntry } from './components/experience/Entry';

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

const Analyze = safeLazy(() => import('./components/CoreUpload'));
const ManualLog = safeLazy(() => import('./components/ManualLog'));
const WorkoutHistory = safeLazy(() => import('./components/WorkoutHistory'));
const RestTimer = safeLazy(() => import('./components/RestTimer'));
const ProfilePage = safeLazy(() => import('./components/Profile'));
const Validate = safeLazy(() => import('./components/Validate'));
const WeeklyReport = safeLazy(() => import('./components/WeeklyReport'));
const Onboarding = safeLazy(() => import('./components/Onboarding'));
const PersonalRecords = safeLazy(() => import('./components/PersonalRecords'));
const LiveCapture = safeLazy(() => import('./components/LiveCapture'));
const ExerciseGuide = safeLazy(() => import('./components/ExerciseGuide'));
const CoachReport = safeLazy(() => import('./components/CoachReport'));


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
  const [selectedLift, setSelectedLift] = useState('');
  const [modelStatus, setModelStatus] = useState('idle');
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

  // Model loading begins only after a lift is chosen, never on arrival.

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
      saveProfile(defaultProfile);
    }
  }, [profileLoading, profile, saveProfile, setPage]);

  // Wait for profile check (and potential auto-create) before rendering
  if (profileLoading || !profile) return LazyFallback;

  // Onboarding for first-time users
  if (page === 'onboarding') {
    return (
      <ErrorBoundary>
        <Suspense fallback={LazyFallback}>
          <Onboarding
            profile={profile}
            onComplete={async (updates, navigateTo) => {
              await saveProfile({ ...profile, ...updates });
              setPage(navigateTo || 'dashboard');
            }}
          />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (page === 'dashboard' || (page === 'analyze' && !selectedLift)) return <Choice
    onChoose={lift => {
      setSelectedLift(lift);
      // On-demand fetch enters the service worker's model cache; inference stays in the existing worker.
      fetch(`${import.meta.env.BASE_URL}mediapipe/pose_landmarker_full.task`).catch(() => {});
      setPage('analyze');
    }}
    onGuide={() => setPage('exercises')}
  />;

  // Full-screen pages (no tab bar)
  const fullScreenPages = ['analyze', 'live', 'log'];
  const showTabBar = !fullScreenPages.includes(page);

  if (page === 'analyze') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <div key="analyze" className="page-transition-enter">
          <Analyze initialLift={selectedLift} onClose={() => { setSelectedLift(''); setPage('dashboard'); }} onLiveMode={() => setPage('live')} />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
  if (page === 'live') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <div key="live" className="page-transition-enter">
          <LiveCapture onClose={() => setPage('dashboard')} profile={profile} />
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

  // Pages with tab bar visible
  let pageContent = null;

  if (page === 'history') {
    pageContent = (
      <Suspense fallback={LazyFallback}>
        <div key="history" className="page-transition-enter">
          <WorkoutHistory onClose={() => setPage('dashboard')} />
        </div>
      </Suspense>
    );
  } else if (page === 'rest') {
    pageContent = (
      <Suspense fallback={LazyFallback}>
        <div key="rest" className="page-transition-enter">
          <RestTimer onClose={() => setPage('dashboard')} />
        </div>
      </Suspense>
    );
  } else if (page === 'profile') {
    pageContent = (
      <Suspense fallback={LazyFallback}>
        <div key="profile" className="page-transition-enter">
          <ProfilePage onClose={() => setPage('dashboard')} />
        </div>
      </Suspense>
    );
  } else if (page === 'validate') {
    pageContent = (
      <Suspense fallback={LazyFallback}>
        <div key="validate" className="page-transition-enter">
          <Validate onClose={() => setPage('dashboard')} />
        </div>
      </Suspense>
    );
  } else if (page === 'weekly') {
    pageContent = (
      <Suspense fallback={LazyFallback}>
        <div key="weekly" className="page-transition-enter">
          <WeeklyReport onClose={() => setPage('dashboard')} />
        </div>
      </Suspense>
    );
  } else if (page === 'prs') {
    pageContent = (
      <Suspense fallback={LazyFallback}>
        <div key="prs" className="page-transition-enter">
          <PersonalRecords onClose={() => setPage('dashboard')} />
        </div>
      </Suspense>
    );
  } else if (page === 'exercises') {
    pageContent = (
      <Suspense fallback={LazyFallback}>
        <div key="exercises" className="page-transition-enter">
          <ExerciseGuide onClose={() => setPage('dashboard')} />
        </div>
      </Suspense>
    );
  } else if (page === 'coach') {
    pageContent = (
      <Suspense fallback={LazyFallback}>
        <div key="coach" className="page-transition-enter">
          <CoachReport onClose={() => setPage('dashboard')} />
        </div>
      </Suspense>
    );
  }

  // Dashboard (default)
  if (!pageContent) {
    pageContent = (
      <>
        <Dashboard
          profile={profile}
          modelStatus={modelStatus}
          onRetryModel={retryModel}
          onNavigate={onNavigate}
          challenge={challenge}
          challengeResponse={challengeResponse}
          onDismissResponse={() => setChallengeResponse(null)}
        />
        <footer style={{
          textAlign: 'center', padding: '8px 0 4px', fontSize: '0.6rem',
          color: 'rgba(255,255,255,0.25)', letterSpacing: '0.02em',
        }}>
          Workout Vision v{__APP_VERSION__} &bull; {new Date(__BUILD_TIME__).toLocaleDateString()}
        </footer>
      </>
    );
  }

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">{t('skip_to_content') || 'Skip to content'}</a>
      <main id="main-content">
        <ErrorBoundary>
          {pageContent}
        </ErrorBoundary>
      </main>
      {showTabBar && <TabBar page={page} onNavigate={onNavigate} />}
    </div>
  );
}

function EntryGate({ children }) {
  const [showEntry, setShowEntry] = useState(shouldShowEntry);
  return showEntry ? <Entry onEnter={() => setShowEntry(false)} /> : children;
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
        <EntryGate>
        <ProfileProvider>
          <ErrorBoundary>
            <AppInner />
          </ErrorBoundary>
        </ProfileProvider>
        </EntryGate>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
