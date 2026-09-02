import { useState, useEffect, lazy, Suspense } from 'react';
import { ProfileProvider, useProfile } from './lib/ProfileContext';
import { LanguageProvider } from './lib/LanguageContext';
import Dashboard from './components/Dashboard';
import Onboarding from './components/Onboarding';
import './index.css';

const Analyze = lazy(() => import('./components/Analyze'));
const ManualLog = lazy(() => import('./components/ManualLog'));
const WorkoutHistory = lazy(() => import('./components/WorkoutHistory'));
const RestTimer = lazy(() => import('./components/RestTimer'));
const ProfilePage = lazy(() => import('./components/Profile'));
const Validate = lazy(() => import('./components/Validate'));
const DesignDemo = lazy(() => import('./components/DesignDemo'));

const LazyFallback = (
  <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
    <div className="spinner" />
  </div>
);

function AppInner() {
  const { profile, saveProfile, profileLoading } = useProfile();
  const [page, setPage] = useState('dashboard');
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
    <Suspense fallback={LazyFallback}>
      <Analyze onClose={() => setPage('dashboard')} />
    </Suspense>
  );
  if (page === 'log') return (
    <Suspense fallback={LazyFallback}>
      <ManualLog onClose={() => setPage('dashboard')} />
    </Suspense>
  );
  if (page === 'history') return (
    <Suspense fallback={LazyFallback}>
      <WorkoutHistory onClose={() => setPage('dashboard')} />
    </Suspense>
  );
  if (page === 'rest') return (
    <Suspense fallback={LazyFallback}>
      <RestTimer onClose={() => setPage('dashboard')} />
    </Suspense>
  );
  if (page === 'profile') return (
    <Suspense fallback={LazyFallback}>
      <ProfilePage onClose={() => setPage('dashboard')} />
    </Suspense>
  );
  if (page === 'validate') return (
    <Suspense fallback={LazyFallback}>
      <Validate onClose={() => setPage('dashboard')} />
    </Suspense>
  );

  return (
    <Dashboard
      profile={profile}
      modelStatus={modelStatus}
      onNavigate={onNavigate}
    />
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);

  // Design demo mode: standalone prototype
  if (params.has('demo')) {
    return (
      <Suspense fallback={LazyFallback}>
        <DesignDemo onExit={() => { window.location.search = ''; }} />
      </Suspense>
    );
  }

  // Validate mode: render directly, skip all providers
  if (params.has('validate')) {
    return (
      <Suspense fallback={LazyFallback}>
        <Validate onClose={() => { window.location.search = ''; }} />
      </Suspense>
    );
  }

  return (
    <LanguageProvider>
      <ProfileProvider>
        <AppInner />
      </ProfileProvider>
    </LanguageProvider>
  );
}

export default App;
