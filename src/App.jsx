import { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from 'react';
import { flushSync } from 'react-dom';
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
import PerfOverlay from './components/PerfOverlay';
import { perfRequested } from './lib/perfFlag';
import { isTest } from './lib/fitness-tests';
import Choice from './components/experience/Choice';
import Entry, { shouldShowEntry } from './components/experience/Entry';
import Stage from './components/experience/Stage';
import ScreenFade from './components/experience/ScreenFade';
import { loadSets, knownSets } from './components/experience/sets';
import { levelView, readLevel } from './components/experience/level';
import { whenQuiet } from './lib/whenQuiet';
import { warmPoseFiles } from './lib/pose-files';

// Frosted glass (backdrop-filter) is left off on the older, smaller iPhones (pixel ratio 2 and a
// screen under 812 points). No WebGL context is made to decide it: making one held up the first
// frame of every visit, and on an iPhone the renderer it reports is only "Apple GPU".
(() => {
  try {
    const isOldiOS = /iPad|iPhone/.test(navigator.userAgent) && window.devicePixelRatio <= 2 && screen.height < 812;
    if (isOldiOS) document.documentElement.classList.add('no-glass');
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
const LAZY = { film: ExperienceFilm, analyze: Analyze, exercises: ExerciseGuide, history: History };

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
  const [page, setPage, browserMoves, browserPending] = useHashRouter();
  const [selectedLift, setSelectedLift] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  // The page a View Transition brought in; its screen change needs no fade of its own.
  const [transitionPage, setTransitionPage] = useState(null);
  const fileSerial = useRef(0);
  // Run storage schema migration on mount
  // The saved sets are read once the records are migrated, while the entry plays,
  // so the choice of lift never waits for them.
  useEffect(() => {
    checkAndMigrateSchema().catch(err => console.error('[App] Schema migration error:', err)).then(() => loadSets()).catch(() => {});
  }, []);

  // Warm the next screens while the visitor reads, so none waits on a download: one at a time,
  // and only in a pause of 700 ms without a touch or a scroll, never in the middle of a swipe.
  // Filming first, then the analysis, the guide and the saved sets.
  useEffect(() => whenQuiet([ExperienceFilm.warm, Analyze.warm, ExerciseGuide.warm, History.warm]), []);

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
      // A storage that refuses the write is recorded by the context (storageError); not left unhandled (audit of 2 October).
      saveProfile(defaultProfile).catch(() => {});
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
    // A navigation by the browser changes the address at once and is rendered later. Any such move
    // after the tap, announced or not, even back to the same page, cancels the change still waiting.
    const ticket = ++waiting.current, from = pageRef.current, moves = browserMoves();
    // A tap made while the browser's own move is not yet rendered gives way to that move.
    if (browserPending()) return;
    const stale = () => ticket !== waiting.current || pageRef.current !== from || browserMoves() !== moves;
    const show = () => {
      if (stale()) return;
      // Into the filming screen, the chosen card grows into its frame where the browser has
      // View Transitions (Safari 18, Chrome 111); elsewhere, and under Reduce Motion, the fade.
      if (next === 'film' && document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        // The update runs a frame later: if a tap or the browser moved the page meanwhile, it changes nothing.
        document.startViewTransition(() => {
          if (stale()) return;
          flushSync(() => { apply?.(); setTransitionPage(next); setPage(next); });
        });
        return;
      }
      apply?.();
      setTransitionPage(null);
      setPage(next);
    };
    const target = LAZY[next];
    // A screen whose code failed to load is shown all the same: its error screen
    // offers Reload, where staying put would leave a tap that does nothing.
    if (!target || target.loaded()) show(); else target.warm().then(show);
  };

  // The profile is created in the background; no screen waits for it.
  // A beginner sees the guide's page of the exercise before filming, until three sets are saved (level.js);
  // from that page, "Filmer cet exercice" goes on to the filming screen.
  const [guideLift, setGuideLift] = useState('');
  const chooseLift = (lift, guided = false) => {
    // The model and the pose library's WASM enter the service worker's caches now, so a first analysis made offline
    // can start (pose-files.js); inference stays in the existing worker.
    warmPoseFiles(import.meta.env.BASE_URL);
    // A fitness test has no guide page of its own: its protocol is on the filming screen (fitness-tests.js).
    if (!guided && !isTest(lift) && levelView(readLevel(), { saved: knownSets()?.length ?? null }).guideFirst) {
      go('exercises', () => setGuideLift(lift));
      return;
    }
    go('film', () => { setSelectedLift(lift); setVideoFile(null); setGuideLift(''); });
  };
  const backToChoice = () => go('dashboard', () => { setSelectedLift(''); setVideoFile(null); });
  const backToFilm = () => go('film', () => setVideoFile(null));

  let key, screen;
  if (page === 'film' && selectedLift) {
    key = `film:${selectedLift}`;
    screen = <ExperienceFilm lift={selectedLift} hero={transitionPage === 'film'} onBack={backToChoice} onFile={f => go('analyze', () => { fileSerial.current += 1; setVideoFile(f); })} />;
  } else if (page === 'analyze' && selectedLift && videoFile) {
    key = `analyze:${fileSerial.current}`;
    screen = <Analyze initialLift={selectedLift} initialFile={videoFile} onClose={backToChoice} onRefilm={backToFilm} />;
  } else if (page === 'exercises') {
    key = guideLift ? `guide:${guideLift}` : 'guide';
    screen = <ExerciseGuide lift={guideLift} onClose={() => go('dashboard', () => setGuideLift(''))} onChoose={l => chooseLift(l, true)} />;
  } else if (page === 'history') {
    key = 'history';
    screen = <History onClose={() => go('dashboard')} />;
  } else {
    // Hidden, not deleted: rest, profile, validate, weekly, prs, coach, log,
    // live and the dashboard. Every other page falls through to the choice of lift.
    key = 'choice';
    screen = <Choice onChoose={l => chooseLift(l)} onGuide={() => go('exercises', () => setGuideLift(''))} onHistory={() => go('history')} />;
  }

  return <>
    <Stage />
    <ScreenFade screenKey={key} viaTransition={transitionPage === page}>
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

// The on-device instrument, only with ?perf=1 (read once at start; nothing is sent).
const SHOW_PERF = perfRequested();

function App() {
  // Hidden: ?validate URL param entry point
  return (
    <>
      {SHOW_PERF && <PerfOverlay />}
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
    </>
  );
}

export default App;
