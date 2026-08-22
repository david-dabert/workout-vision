import { useState, useEffect, lazy, Suspense } from 'react';
import { preloadModel } from './lib/poseAnalysis';
import { ProfileProvider, useProfile } from './lib/ProfileContext';
import { LanguageProvider, useT } from './lib/LanguageContext';
import { Home, TrendingUp, User, Apple } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Progress from './components/Progress';
import Profile from './components/Profile';
import Onboarding from './components/Onboarding';
import './index.css';

const Train = lazy(() => import('./components/Train'));
const Analyze = lazy(() => import('./components/Analyze'));
const Nutrition = lazy(() => import('./components/Nutrition'));
const MachineIdentifier = lazy(() => import('./components/MachineIdentifier'));
const WorkoutPlan = lazy(() => import('./components/WorkoutPlan'));
const ManualLog = lazy(() => import('./components/ManualLog'));
const ExerciseHistory = lazy(() => import('./components/ExerciseHistory'));
const RestTimer = lazy(() => import('./components/RestTimer'));

const LazyFallback = (
  <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
    <div className="spinner" />
  </div>
);

function AppInner() {
  const { profile, saveProfile, profileLoading } = useProfile();
  const { t } = useT();
  const [page, setPage] = useState('dashboard');
  const [modelStatus, setModelStatus] = useState('loading');
  const [preSelectedExercise, setPreSelectedExercise] = useState(null);

  useEffect(() => {
    preloadModel()
      .then((ok) => setModelStatus(ok ? 'ready' : 'error'))
      .catch(() => setModelStatus('error'));
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
  if (page === 'train') return (
    <Suspense fallback={LazyFallback}>
      <Train onClose={() => setPage('dashboard')} />
    </Suspense>
  );
  if (page === 'analyze') return (
    <Suspense fallback={LazyFallback}>
      <Analyze onClose={() => setPage('dashboard')} preSelectedExercise={preSelectedExercise} />
    </Suspense>
  );
  if (page === 'identify') return (
    <Suspense fallback={LazyFallback}>
      <MachineIdentifier
        onClose={() => setPage('dashboard')}
        onSelectExercise={(key) => {
          setPreSelectedExercise(key);
          setPage('analyze');
        }}
      />
    </Suspense>
  );
  if (page === 'plan') return (
    <Suspense fallback={LazyFallback}>
      <WorkoutPlan onClose={() => setPage('dashboard')} />
    </Suspense>
  );
  if (page === 'log') return (
    <Suspense fallback={LazyFallback}>
      <ManualLog onClose={() => setPage('dashboard')} />
    </Suspense>
  );
  if (page === 'history') return (
    <Suspense fallback={LazyFallback}>
      <ExerciseHistory onClose={() => setPage('dashboard')} />
    </Suspense>
  );
  if (page === 'timer') return (
    <Suspense fallback={LazyFallback}>
      <RestTimer onClose={() => setPage('dashboard')} />
    </Suspense>
  );

  // Pages with tab bar
  const renderPage = () => {
    switch (page) {
      case 'nutrition':
        return (
          <Suspense fallback={LazyFallback}>
            <Nutrition />
          </Suspense>
        );
      case 'progress':
        return <Progress onClose={() => setPage('dashboard')} />;
      case 'profile':
        return <Profile onClose={() => setPage('dashboard')} />;
      default:
        return (
          <Dashboard
            profile={profile}
            modelStatus={modelStatus}
            onNavigate={onNavigate}
          />
        );
    }
  };

  return (
    <div className="app">
      {renderPage()}
      <nav className="tab-bar" aria-label="Main navigation">
        <button
          className={`tab ${page === 'dashboard' ? 'active' : ''}`}
          onClick={() => setPage('dashboard')}
          aria-label={t('home')}
          aria-current={page === 'dashboard' ? 'page' : undefined}
        >
          <Home size={18} />
          <span className="tab-label">{t('home')}</span>
        </button>
        <button
          className={`tab ${page === 'nutrition' ? 'active' : ''}`}
          onClick={() => setPage('nutrition')}
          aria-label={t('nutrition')}
          aria-current={page === 'nutrition' ? 'page' : undefined}
        >
          <Apple size={18} />
          <span className="tab-label">{t('nutrition')}</span>
        </button>
        <button
          className={`tab ${page === 'progress' ? 'active' : ''}`}
          onClick={() => setPage('progress')}
          aria-label={t('progress')}
          aria-current={page === 'progress' ? 'page' : undefined}
        >
          <TrendingUp size={18} />
          <span className="tab-label">{t('progress')}</span>
        </button>
        <button
          className={`tab ${page === 'profile' ? 'active' : ''}`}
          onClick={() => setPage('profile')}
          aria-label={t('profile')}
          aria-current={page === 'profile' ? 'page' : undefined}
        >
          <User size={18} />
          <span className="tab-label">{t('profile')}</span>
        </button>
      </nav>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <ProfileProvider>
        <AppInner />
      </ProfileProvider>
    </LanguageProvider>
  );
}

export default App;
