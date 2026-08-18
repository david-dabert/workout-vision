import { useState, useEffect, lazy, Suspense } from 'react';
import { getProfile } from './lib/storage';
import { preloadModel } from './lib/poseAnalysis';
import { Home, TrendingUp, User, Apple } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Progress from './components/Progress';
import Profile from './components/Profile';
import './index.css';

const Train = lazy(() => import('./components/Train'));
const Analyze = lazy(() => import('./components/Analyze'));
const Nutrition = lazy(() => import('./components/Nutrition'));
const MachineIdentifier = lazy(() => import('./components/MachineIdentifier'));

const LazyFallback = (
  <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
    <div className="spinner" />
  </div>
);

function App() {
  const [page, setPage] = useState('dashboard');
  const [profile, setProfile] = useState(null);
  const [modelStatus, setModelStatus] = useState('loading');
  const [preSelectedExercise, setPreSelectedExercise] = useState(null);

  useEffect(() => {
    getProfile().then(setProfile);
    preloadModel()
      .then((ok) => setModelStatus(ok ? 'ready' : 'error'))
      .catch(() => setModelStatus('error'));
  }, []);

  const onNavigate = (p) => setPage(p);

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
      <nav className="tab-bar">
        <button
          className={`tab ${page === 'dashboard' ? 'active' : ''}`}
          onClick={() => setPage('dashboard')}
        >
          <Home size={18} />
          <span className="tab-label">Home</span>
        </button>
        <button
          className={`tab ${page === 'nutrition' ? 'active' : ''}`}
          onClick={() => setPage('nutrition')}
        >
          <Apple size={18} />
          <span className="tab-label">Nutrition</span>
        </button>
        <button
          className={`tab ${page === 'progress' ? 'active' : ''}`}
          onClick={() => setPage('progress')}
        >
          <TrendingUp size={18} />
          <span className="tab-label">Progress</span>
        </button>
        <button
          className={`tab ${page === 'profile' ? 'active' : ''}`}
          onClick={() => setPage('profile')}
        >
          <User size={18} />
          <span className="tab-label">Profile</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
