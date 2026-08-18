import { useState, useEffect } from 'react';
import { getProfile } from './lib/storage';
import { preloadModel } from './lib/poseAnalysis';
import { Home, TrendingUp, User, Apple } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Train from './components/Train';
import Analyze from './components/Analyze';
import Progress from './components/Progress';
import Profile from './components/Profile';
import Nutrition from './components/Nutrition';
import MachineIdentifier from './components/MachineIdentifier';
import './index.css';

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
  if (page === 'train') return <Train onClose={() => setPage('dashboard')} />;
  if (page === 'analyze') return <Analyze onClose={() => setPage('dashboard')} preSelectedExercise={preSelectedExercise} />;
  if (page === 'identify') return (
    <MachineIdentifier
      onClose={() => setPage('dashboard')}
      onSelectExercise={(key) => {
        setPreSelectedExercise(key);
        setPage('analyze');
      }}
    />
  );

  // Pages with tab bar
  const renderPage = () => {
    switch (page) {
      case 'nutrition':
        return <Nutrition />;
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
