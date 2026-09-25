import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { ProfileProvider, useProfile } from './lib/ProfileContext';
import { LanguageProvider } from './lib/LanguageContext';
import useHashRouter from './lib/useHashRouter';
// Hidden: challenges are not part of core path
// import { parseChallengeFromURL, parseResponseFromURL } from './lib/challenges';
import { checkAndMigrateSchema } from './lib/storage';
// Hidden, not deleted: Dashboard and TabBar are not rendered during 3b
// import Dashboard from './components/Dashboard';
// import TabBar from './components/TabBar';

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

// Core path
const Analyze = safeLazy(() => import('./components/CoreUpload'));
const ExerciseGuide = safeLazy(() => import('./components/experience/Guide'));
const ExperienceFilm = safeLazy(() => import('./components/experience/Film'));

// Hidden, not deleted: lazy imports for features outside the core path
// const ManualLog = safeLazy(() => import('./components/ManualLog'));
// const WorkoutHistory = safeLazy(() => import('./components/WorkoutHistory'));
// const RestTimer = safeLazy(() => import('./components/RestTimer'));
// const ProfilePage = safeLazy(() => import('./components/Profile'));
// const Validate = safeLazy(() => import('./components/Validate'));
// const WeeklyReport = safeLazy(() => import('./components/WeeklyReport'));
// const Onboarding = safeLazy(() => import('./components/Onboarding'));
// const PersonalRecords = safeLazy(() => import('./components/PersonalRecords'));
// const LiveCapture = safeLazy(() => import('./components/LiveCapture'));
// const CoachReport = safeLazy(() => import('./components/CoachReport'));


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
  const [page, setPage] = useHashRouter();
  const [selectedLift, setSelectedLift] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  // Run storage schema migration on mount
  useEffect(() => {
    checkAndMigrateSchema().catch(err => console.error('[App] Schema migration error:', err));
  }, []);

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

  // Hidden: Onboarding — profiles are auto-created, no questions before first analysis

  if (page === 'dashboard' || (page === 'analyze' && !selectedLift && !videoFile)) return <Choice
    onChoose={lift => {
      setSelectedLift(lift);
      setVideoFile(null);
      // On-demand fetch enters the service worker's model cache; inference stays in the existing worker.
      fetch(`${import.meta.env.BASE_URL}mediapipe/pose_landmarker_full.task`).catch(() => {});
      setPage('film');
    }}
    onGuide={() => setPage('exercises')}
  />;

  if (page === 'film' && selectedLift) return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <ExperienceFilm lift={selectedLift} onBack={() => { setSelectedLift(''); setVideoFile(null); setPage('dashboard'); }} onFile={f => { setVideoFile(f); setPage('analyze'); }} />
      </Suspense>
    </ErrorBoundary>
  );
  if (page === 'analyze') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <div key="analyze" className="page-transition-enter">
          <Analyze initialLift={selectedLift} initialFile={videoFile} onClose={() => { setSelectedLift(''); setVideoFile(null); setPage('dashboard'); }} onLiveMode={() => setPage('live')} />
        </div>
      </Suspense>
    </ErrorBoundary>
  );
  // Hidden: live (LiveCapture) and log (ManualLog) — fall through to Choice

  // Exercise guide (core path)
  if (page === 'exercises') return (
    <ErrorBoundary>
      <Suspense fallback={LazyFallback}>
        <div key="exercises" className="page-transition-enter">
          <ExerciseGuide onClose={() => setPage('dashboard')} onChoose={lift => { setSelectedLift(lift); setVideoFile(null); fetch(`${import.meta.env.BASE_URL}mediapipe/pose_landmarker_full.task`).catch(() => {}); setPage('film'); }} />
        </div>
      </Suspense>
    </ErrorBoundary>
  );

  // ── Hidden features (not deleted, just unreachable) ──
  // The following pages are hidden during 3b but their code remains:
  //   history (WorkoutHistory), rest (RestTimer), profile (ProfilePage),
  //   validate (Validate), weekly (WeeklyReport), prs (PersonalRecords),
  //   coach (CoachReport standalone), log (ManualLog), live (LiveCapture),
  //   Dashboard (challenges, badges, confetti, injury risk, streak).
  // TabBar is also hidden. All fall through to Choice below.

  // Fallback: any unknown page renders Choice (the core path entry)
  return <Choice
    onChoose={lift => {
      setSelectedLift(lift);
      setVideoFile(null);
      fetch(`${import.meta.env.BASE_URL}mediapipe/pose_landmarker_full.task`).catch(() => {});
      setPage('film');
    }}
    onGuide={() => setPage('exercises')}
  />;
}

function EntryGate({ children }) {
  const [showEntry, setShowEntry] = useState(shouldShowEntry);
  return showEntry ? <Entry onEnter={() => setShowEntry(false)} /> : children;
}

function App() {
  // Hidden: ?validate URL param entry point
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
