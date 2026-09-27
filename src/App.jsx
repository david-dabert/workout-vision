import { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from 'react';
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
import { loadSets } from './components/experience/sets';
import { COUNTING_PAUSED } from './lib/countingPause';

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
  Screen.loaded = () => Mod !== null;
  return Screen;
}

// Core path
const Analyze = lazyScreen(() => import('./components/CoreUpload'));
const ExerciseGuide = lazyScreen(() => import('./components/experience/Guide'));
const ExperienceFilm = lazyScreen(() => import('./components/experience/Film'));
const History = lazyScreen(() => import('./components/experience/History'));
const LAZY = { film: ExperienceFilm, analyze: COUNTING_PAUSED ? null : Analyze, exercises: ExerciseGuide, history: History };

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
  // The saved sets are read once the records are migrated, while the entry plays,
  // so the choice of lift never waits for them.
  useEffect(() => {
    checkAndMigrateSchema().catch(err => console.error('[App] Schema migration error:', err)).then(() => loadSets()).catch(() => {});
  }, []);

  // Warm the next screens while the visitor reads, so none waits on a download.
  useEffect(() => {
    const a = setTimeout(() => { ExperienceFilm.warm(); if (!COUNTING_PAUSED) Analyze.warm(); }, 1200);
    const b = setTimeout(() => { ExerciseGuide.warm(); History.warm(); }, 3000);
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

  // A tap changes the screen only once the next screen's code is in; until then
  // the current screen stays. A screen still loading shows only LazyFallback,
  // and Reduce Motion removes the leaving screen at once: the stage would be empty.
  // A later tap, or a change of page by the browser, cancels a change still waiting.
  const pageRef = useRef(page);
  useLayoutEffect(() => { pageRef.current = page; }, [page]);
  const waiting = useRef(0);
  const go = (next, apply) => {
    const ticket = ++waiting.current, from = pageRef.current;
    const show = () => {
      if (ticket !== waiting.current || pageRef.current !== from) return;
      apply?.();
      setPage(next);
    };
    const target = LAZY[next];
    // A screen whose code failed to load is shown all the same: its error screen
    // offers Reload, where staying put would leave a tap that does nothing.
    if (!target || target.loaded()) show(); else target.warm().then(show);
  };

  // The profile is created in the background; no screen waits for it.
  const chooseLift = lift => {
    // On-demand fetch enters the service worker's model cache; inference stays in the existing worker.
    if (!COUNTING_PAUSED) fetch(`${import.meta.env.BASE_URL}mediapipe/pose_landmarker_full.task`).catch(() => {});
    go('film', () => { setSelectedLift(lift); setVideoFile(null); });
  };
  const backToChoice = () => go('dashboard', () => { setSelectedLift(''); setVideoFile(null); });
  const backToFilm = () => go('film', () => setVideoFile(null));

  let key, screen;
  if (page === 'film' && selectedLift) {
    key = `film:${selectedLift}`;
    screen = <ExperienceFilm lift={selectedLift} onBack={backToChoice} onGuide={() => go('exercises')} onFile={f => go('analyze', () => { fileSerial.current += 1; setVideoFile(f); })} />;
  } else if (page === 'analyze' && selectedLift && videoFile && !COUNTING_PAUSED) {
    key = `analyze:${fileSerial.current}`;
    screen = <Analyze initialLift={selectedLift} initialFile={videoFile} onClose={backToChoice} onRefilm={backToFilm} />;
  } else if (page === 'exercises') {
    key = 'guide';
    screen = <ExerciseGuide onClose={() => go('dashboard')} onChoose={chooseLift} />;
  } else if (page === 'history') {
    key = 'history';
    screen = <History onClose={() => go('dashboard')} />;
  } else {
    // Hidden, not deleted: rest, profile, validate, weekly, prs, coach, log,
    // live and the dashboard. Every other page falls through to the choice of lift.
    key = 'choice';
    screen = <Choice onChoose={chooseLift} onGuide={() => go('exercises')} onHistory={() => go('history')} />;
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
