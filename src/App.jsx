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
import Stage from './components/experience/Stage';
import ScreenFade from './components/experience/ScreenFade';

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

// A lazily loaded screen that can be warmed in advance. Once its code is
// loaded it renders directly: React.lazy would otherwise suspend on first
// render and hold the screen back behind a blank fallback.
function lazyScreen(load) {
  let Mod = null, pending = null;
  const warm = () => (pending ||= load().then(m => { Mod = m.default; return m; }));
  const Lazy = safeLazy(warm);
  function Screen(props) { const C = useRef(Mod || Lazy).current; return <C {...props} />; }
  Screen.warm = () => warm().catch(() => {});
  return Screen;
}

// Core path
const Analyze = lazyScreen(() => import('./components/CoreUpload'));
const ExerciseGuide = lazyScreen(() => import('./components/experience/Guide'));
const ExperienceFilm = lazyScreen(() => import('./components/experience/Film'));

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


// While a screen's code loads, show the void itself, never a placeholder of another app.
const LazyFallback = <div className="wv-experience" aria-busy="true" />;

function AppInner() {
  const { profile, saveProfile, profileLoading } = useProfile();
  const [page, setPage] = useHashRouter();
  const [selectedLift, setSelectedLift] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const fileSerial = useRef(0);
  // Run storage schema migration on mount
  useEffect(() => {
    checkAndMigrateSchema().catch(err => console.error('[App] Schema migration error:', err));
  }, []);

  // Warm the next screens while the visitor reads, so none waits on a download.
  useEffect(() => {
    const a = setTimeout(() => { ExperienceFilm.warm(); Analyze.warm(); }, 1200);
    const b = setTimeout(() => ExerciseGuide.warm(), 3000);
    return () => { clearTimeout(a); clearTimeout(b); };
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

  // The profile is created in the background; no screen waits for it.
  const chooseLift = lift => {
    setSelectedLift(lift);
    setVideoFile(null);
    // On-demand fetch enters the service worker's model cache; inference stays in the existing worker.
    fetch(`${import.meta.env.BASE_URL}mediapipe/pose_landmarker_full.task`).catch(() => {});
    setPage('film');
  };
  const backToChoice = () => { setSelectedLift(''); setVideoFile(null); setPage('dashboard'); };
  const backToFilm = () => { setVideoFile(null); setPage('film'); };

  let key, screen;
  if (page === 'film' && selectedLift) {
    key = `film:${selectedLift}`;
    screen = <ExperienceFilm lift={selectedLift} onBack={backToChoice} onFile={f => { fileSerial.current += 1; setVideoFile(f); setPage('analyze'); }} />;
  } else if (page === 'analyze' && selectedLift && videoFile) {
    key = `analyze:${fileSerial.current}`;
    screen = <Analyze initialLift={selectedLift} initialFile={videoFile} onClose={backToChoice} onRefilm={backToFilm} />;
  } else if (page === 'exercises') {
    key = 'guide';
    screen = <ExerciseGuide onClose={() => setPage('dashboard')} onChoose={chooseLift} />;
  } else {
    // Hidden, not deleted: history, rest, profile, validate, weekly, prs, coach, log,
    // live and the dashboard. Every other page falls through to the choice of lift.
    key = 'choice';
    screen = <Choice onChoose={chooseLift} onGuide={() => setPage('exercises')} />;
  }

  return <>
    <Stage />
    <ScreenFade screenKey={key}>
      <ErrorBoundary>
        <Suspense fallback={LazyFallback}>{screen}</Suspense>
      </ErrorBoundary>
    </ScreenFade>
  </>;
}

function EntryGate({ children }) {
  const [showEntry, setShowEntry] = useState(shouldShowEntry);
  return <ScreenFade screenKey={showEntry ? 'entry' : 'app'}>
    {showEntry ? <Entry onEnter={() => setShowEntry(false)} /> : children}
  </ScreenFade>;
}

function App() {
  // Hidden: ?validate URL param entry point
  return (
    <ErrorBoundary>
      <LanguageProvider>
        {/* The profile loads during the entry, so nothing waits for it after. */}
        <ProfileProvider>
          <EntryGate>
            <ErrorBoundary>
              <AppInner />
            </ErrorBoundary>
          </EntryGate>
        </ProfileProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
