import { useState, useEffect, useLayoutEffect, useRef, Suspense } from 'react';
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
import { track } from './lib/events';
import { liveBuild } from './lib/buildFlags';
import { payloadOf, resultsPayloadOf } from './components/experience/programme';
import { draftFromResults } from './components/experience/programme-store';
import { markCrash } from './lib/crashLog';
import { lazyScreen } from './lib/lazyScreen';

// Frosted glass (backdrop-filter) is left off on the older, smaller iPhones (pixel ratio 2 and a
// screen under 812 points). No WebGL context is made to decide it: making one held up the first
// frame of every visit, and on an iPhone the renderer it reports is only "Apple GPU".
(() => {
  try {
    const isOldiOS = /iPad|iPhone/.test(navigator.userAgent) && window.devicePixelRatio <= 2 && screen.height < 812;
    if (isOldiOS) document.documentElement.classList.add('no-glass');
  } catch { /* silent fallback: keep glass */ }
})();

// Core path
const Analyze = lazyScreen(() => import('./components/CoreUpload'));
const ExerciseGuide = lazyScreen(() => import('./components/experience/Guide'));
const ExperienceFilm = lazyScreen(() => import('./components/experience/Film'));
const History = lazyScreen(() => import('./components/experience/History'));
// "À propos": why the app exists, reached from the foot of the choice.
const About = lazyScreen(() => import('./components/experience/About'));
// The WorkoutVision Manifesto: The Science, History, and Mechanics of Optimal Lifting
const Manifesto = lazyScreen(() => import('./components/experience/Manifesto'));
// Live counting (Film screen, "En direct"): the camera, the count as the set goes, then the same result.
const LiveSession = lazyScreen(() => import('./components/LiveSession'));
// Espace pro (6 October): the coach's programme builder, reached from the foot of the choice; and the client's
// programme, opened from the coach's link (#programme=…) or from the choice once kept on the phone.
const Pro = lazyScreen(() => import('./components/experience/Pro'));
const Programme = lazyScreen(() => import('./components/experience/Programme.jsx'));
// A client's results, opened on the coach's phone from the link the client sent (#resultats=…, 9 October).
const Results = lazyScreen(() => import('./components/experience/Results'));
const Equine = lazyScreen(() => import('./components/equine/Equine.jsx'));
const SportsBiomechanics = lazyScreen(() => import('./components/sports/SportsBiomechanics.jsx'));
const CoachFinder = lazyScreen(() => import('./components/coaches/CoachFinder.jsx'));
const GymBuddy = lazyScreen(() => import('./components/buddies/GymBuddy.jsx'));
const Ergonomics = lazyScreen(() => import('./components/ergonomics/Ergonomics.jsx'));
const Chat = lazyScreen(() => import('./components/chat/Chat.jsx'));
// The activity engine's screen (docs/VISION.md): volleyball on synthetic jumps, opened from the sports rail.
const Activity = lazyScreen(() => import('./components/activity/ActivityScreen.jsx'));
const LAZY = { film: ExperienceFilm, analyze: Analyze, exercises: ExerciseGuide, history: History, live: LiveSession, about: About, pro: Pro, programme: Programme, resultats: Results, manifesto: Manifesto, science: Manifesto, equine: Equine, veterinary: Equine, sports: SportsBiomechanics, golf: SportsBiomechanics, tennis: SportsBiomechanics, padel: SportsBiomechanics, cycling: SportsBiomechanics, baseball: SportsBiomechanics, rowing: SportsBiomechanics, skiing: SportsBiomechanics, swimming: SportsBiomechanics, coaches: CoachFinder, coach: CoachFinder, physio: CoachFinder, buddies: GymBuddy, buddy: GymBuddy, ergonomics: Ergonomics, workplace: Ergonomics, chat: Chat, volleyball: Activity };

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
  // The coach's target of the exercise being filmed, when it was started from a programme (programme.js, plannedOf):
  // the set is saved with it, and closing the filming or the result goes back to the programme.
  const [planned, setPlanned] = useState(null);
  // The draft Espace pro opens at once, when a client's results lead to it (programme-store.js, draftFromResults).
  const [proStart, setProStart] = useState(null);
  // A programme opened in this visit that the phone could not keep (storage refused: Safari with every cookie blocked):
  // held here for the visit, so the return from filming, or the choice, finds it (Programme.jsx, onHold).
  const [heldProgramme, setHeldProgramme] = useState(null);
  // For one visit: a browser back then forward to Espace pro opens its list, never a start draft since deleted.
  useEffect(() => { if (page !== 'pro') setProStart(null); }, [page]);
  // Run storage schema migration on mount
  // The saved sets are read once the records are migrated, while the entry plays,
  // so the choice of lift never waits for them.
  useEffect(() => {
    checkAndMigrateSchema().catch(err => console.error('[App] Schema migration error:', err)).then(() => loadSets()).catch(() => {});
  }, []);

  // Warm the next screens while the visitor reads, so none waits on a download: one at a time,
  // and only in a pause of 700 ms without a touch or a scroll, never in the middle of a swipe.
  // Filming first, then the analysis, the guide and the saved sets.
  // The live screen only in a build that offers it (buildFlags.js).
  useEffect(() => whenQuiet([ExperienceFilm.warm, Analyze.warm, ExerciseGuide.warm, History.warm, ...(liveBuild() ? [LiveSession.warm] : [])]), []);

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
    // A beginner's lift goes through its guide page first: its "Filmer cet exercice" is the same choice, counted once.
    if (!(guided && guideLift === lift)) track('choose_lift', { lift });
    // A fitness test has no guide page of its own: its protocol is on the filming screen (fitness-tests.js).
    if (!guided && !isTest(lift) && levelView(readLevel(), { saved: knownSets()?.length ?? null }).guideFirst) {
      go('exercises', () => setGuideLift(lift));
      return;
    }
    // The model and the pose library's WASM (about 24 MB) enter the service worker's caches now, on the way to filming,
    // so a first analysis made offline can start (pose-files.js); inference stays in the existing worker. Not before the
    // guide page: a beginner who only reads it spends no mobile data on them (live-app audit, 10 October 2026).
    warmPoseFiles(import.meta.env.BASE_URL);
    go('film', () => { setSelectedLift(lift); setVideoFile(null); setGuideLift(''); });
  };
  // A target holds only for its own exercise: one left from an earlier tap never reaches another set (excellence hunt,
  // 9 October 2026). A target kept before it carried its exercise (no key) stands as it did.
  const target = planned && (planned.key === undefined || planned.key === selectedLift) ? planned : null;
  const backToChoice = () => (target
    ? go('programme', () => { setSelectedLift(''); setVideoFile(null); setPlanned(null); })
    : go('dashboard', () => { setSelectedLift(''); setVideoFile(null); }));
  const backToFilm = () => go('film', () => setVideoFile(null));

  let key, screen;
  if (page === 'film' && selectedLift) {
    key = `film:${selectedLift}`;
    screen = <ExperienceFilm lift={selectedLift} hero={transitionPage === 'film'} onBack={backToChoice} onFile={f => { track('film_start', { lift: selectedLift }); go('analyze', () => { fileSerial.current += 1; setVideoFile(f); }); }}
      onLive={liveBuild() ? () => { track('film_start', { lift: selectedLift }); go('live', () => { fileSerial.current += 1; }); } : undefined} />;
  } else if (page === 'live' && selectedLift && liveBuild()) {
    key = `live:${fileSerial.current}`;
    screen = <LiveSession lift={selectedLift} planned={target} onClose={backToChoice} onRecord={backToFilm} />;
  } else if (page === 'analyze' && selectedLift && videoFile) {
    key = `analyze:${fileSerial.current}`;
    screen = <Analyze initialLift={selectedLift} initialFile={videoFile} planned={target} onClose={backToChoice} onRefilm={backToFilm} onNewSet={backToFilm} />;
  } else if (page === 'exercises') {
    key = guideLift ? `guide:${guideLift}` : 'guide';
    screen = <ExerciseGuide lift={guideLift} onClose={() => (planned && guideLift ? go('programme', () => { setGuideLift(''); setPlanned(null); }) : go('dashboard', () => setGuideLift('')))} onChoose={l => chooseLift(l, true)} />;
  } else if (page === 'history') {
    key = 'history';
    screen = <History onClose={() => go('dashboard')} />;
  } else if (page === 'pro') {
    key = proStart ? `pro:${proStart.draft.id}` : 'pro';
    screen = <Pro start={proStart} onClose={() => go('dashboard', () => setProStart(null))} />;
  } else if (page === 'programme') {
    key = 'programme';
    // The link's payload as typed (the router lowercases the page); null once the programme is kept and the address
    // cleared (Programme.jsx), or when the programme is opened from the choice.
    screen = <Programme payload={payloadOf(window.location.hash)} held={heldProgramme} onHold={setHeldProgramme} onClose={() => go('dashboard', () => setPlanned(null))} onStart={(lift, target) => { setPlanned(target); chooseLift(lift); }} />;
  } else if (page === 'resultats') {
    // The link's payload as typed; a results screen with no payload says the link does not open. One screen per link:
    // another client's link opened over this one is read afresh.
    const results = resultsPayloadOf(window.location.hash);
    key = `resultats:${results ?? ''}`;
    screen = <Results payload={results} onClose={() => go('dashboard')} onAdjust={r => { const start = draftFromResults(r); go('pro', () => setProStart(start)); }} />;
  } else if (page === 'manifesto' || page === 'science') {
    key = 'manifesto';
    screen = <Manifesto onClose={() => go('dashboard')} onChoose={l => chooseLift(l)} />;
  } else if (page === 'about') {
    key = 'about';
    screen = <About onClose={() => go('dashboard')} onManifesto={() => go('manifesto')} />;
  } else if (page === 'equine' || page === 'veterinary') {
    key = 'equine';
    screen = <Equine onClose={() => go('dashboard')} />;
  } else if (page === 'sports' || page === 'golf' || page === 'tennis' || page === 'padel' || page === 'cycling' || page === 'baseball' || page === 'rowing' || page === 'skiing' || page === 'swimming') {
    // A sport's own address opens on that sport (#rowing opens rowing); a new address is a new screen.
    key = page === 'sports' ? 'sports' : `sports:${page}`;
    screen = <SportsBiomechanics sport={page} onClose={() => go('dashboard')} onOpenEquine={() => go('equine')} onOpenVolleyball={() => go('volleyball')} />;
  } else if (page === 'volleyball') {
    key = 'volleyball';
    screen = <Activity activity="volleyball" onClose={() => go('sports')} />;
  } else if (page === 'coaches' || page === 'coach' || page === 'physio') {
    key = 'coaches';
    screen = <CoachFinder onClose={() => go('dashboard')} onHistory={() => go('history')} />;
  } else if (page === 'buddies' || page === 'buddy') {
    key = 'buddies';
    screen = <GymBuddy onClose={() => go('dashboard')} />;
  } else if (page === 'ergonomics' || page === 'workplace') {
    key = 'ergonomics';
    screen = <Ergonomics onClose={() => go('dashboard')} />;
  } else if (page === 'chat') {
    key = 'chat';
    screen = <Chat onClose={() => go('dashboard')} onHistory={() => go('history')} />;
  } else {
    // Hidden, not deleted: rest, profile, validate, weekly, prs, coach, log,
    // the old live capture (LiveCapture.jsx) and the dashboard; "live" without a lift, or in a build without VITE_LIVE, too. Every other page falls through to the choice of lift.
    key = 'choice';
    screen = <Choice held={heldProgramme} onChoose={l => { setPlanned(null); chooseLift(l); }} onPro={() => go('pro', () => setProStart(null))} onProgramme={() => go('programme')} onGuide={() => { track('guide_open'); go('exercises', () => { setGuideLift(''); setPlanned(null); }); }} onHistory={() => { track('history_open'); go('history'); }} onAbout={() => go('about')} onManifesto={() => go('manifesto')} onEquine={() => go('equine')} onSports={() => go('sports')} onCoaches={() => go('coaches')} onBuddies={() => go('buddies')} onErgonomics={() => go('ergonomics')} onChat={() => go('chat')} />;
  }

  // The screen on show, a breadcrumb of the crash log on the phone (crashLog.js); the analysis marks its phases itself.
  const screenName = key.split(':')[0];
  useEffect(() => { markCrash({ screen: screenName, lift: selectedLift || null }); }, [screenName, selectedLift]);

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
