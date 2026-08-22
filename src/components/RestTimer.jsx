import { useState, useEffect, useRef, useCallback } from 'react';
import { useT } from '../lib/LanguageContext';

const PRESETS = [30, 60, 90, 120, 180, 300];

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.value = 0.3;

    osc.start();
    // Three short beeps
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.setValueAtTime(0, now + 0.15);
    gain.gain.setValueAtTime(0.3, now + 0.25);
    gain.gain.setValueAtTime(0, now + 0.4);
    gain.gain.setValueAtTime(0.3, now + 0.5);
    gain.gain.setValueAtTime(0, now + 0.65);
    osc.stop(now + 0.7);
  } catch (e) {
    // Web Audio not available
  }
}

function vibrate() {
  try {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
  } catch (e) {
    // Vibration not available
  }
}

export default function RestTimer({ onClose }) {
  const { t } = useT();
  const [totalSeconds, setTotalSeconds] = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [customInput, setCustomInput] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const intervalRef = useRef(null);
  const wakeLockRef = useRef(null);

  // Wake Lock
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      }
    } catch (e) {
      // Wake lock not available or denied
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  // Countdown logic
  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            setCompleted(c => c + 1);
            playBeep();
            vibrate();
            releaseWakeLock();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, remaining, releaseWakeLock]);

  // Re-acquire wake lock on visibility change
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && running) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [running, requestWakeLock]);

  // Cleanup wake lock on unmount
  useEffect(() => releaseWakeLock, [releaseWakeLock]);

  const selectPreset = (sec) => {
    setTotalSeconds(sec);
    setRemaining(sec);
    setRunning(false);
    setShowCustom(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    releaseWakeLock();
  };

  const handleStart = () => {
    if (remaining <= 0) {
      setRemaining(totalSeconds);
    }
    setRunning(true);
    requestWakeLock();
  };

  const handlePause = () => {
    setRunning(false);
    releaseWakeLock();
  };

  const handleReset = () => {
    setRunning(false);
    setRemaining(totalSeconds);
    if (intervalRef.current) clearInterval(intervalRef.current);
    releaseWakeLock();
  };

  const handleCustomSubmit = () => {
    const val = parseInt(customInput, 10);
    if (val > 0 && val <= 600) {
      selectPreset(val);
      setCustomInput('');
    }
  };

  const progress = totalSeconds > 0 ? remaining / totalSeconds : 0;
  const circumference = 2 * Math.PI * 120;
  const strokeOffset = circumference * (1 - progress);
  const isComplete = remaining === 0 && !running;

  return (
    <div className="rest-timer-page">
      <div className="rest-timer-header">
        <button className="btn-icon" onClick={onClose} aria-label="Close">
          &#x2715;
        </button>
        <h2>{t('rest_timer_title')}</h2>
        <div className="rest-timer-completed">
          <span className="rest-completed-count">{completed}</span>
          <span className="rest-completed-label">{t('rests')}</span>
        </div>
      </div>

      {/* Circular display */}
      <div className="rest-timer-circle-wrap">
        <svg className="rest-timer-svg" viewBox="0 0 260 260">
          <circle
            cx="130" cy="130" r="120"
            fill="none"
            stroke="var(--border)"
            strokeWidth="6"
          />
          <circle
            cx="130" cy="130" r="120"
            fill="none"
            stroke={isComplete ? 'var(--accent)' : 'var(--accent)'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            transform="rotate(-90 130 130)"
            className="rest-timer-progress-ring"
          />
        </svg>
        <div className="rest-timer-time">
          <span className={`rest-timer-digits ${isComplete ? 'rest-timer-done' : ''}`}>
            {formatTime(remaining)}
          </span>
          {isComplete && <span className="rest-timer-done-label">{t('ready')}</span>}
          {!isComplete && !running && remaining === totalSeconds && (
            <span className="rest-timer-ready-label">{t('ready')}</span>
          )}
        </div>
      </div>

      {/* Preset buttons */}
      <div className="rest-timer-presets">
        {PRESETS.map(sec => (
          <button
            key={sec}
            className={`rest-preset-btn ${totalSeconds === sec && !showCustom ? 'active' : ''}`}
            onClick={() => selectPreset(sec)}
            disabled={running}
          >
            {sec < 60 ? `${sec}s` : `${sec / 60}m`}
          </button>
        ))}
        <button
          className={`rest-preset-btn ${showCustom ? 'active' : ''}`}
          onClick={() => setShowCustom(true)}
          disabled={running}
        >
          {t('custom')}
        </button>
      </div>

      {/* Custom input */}
      {showCustom && !running && (
        <div className="rest-timer-custom">
          <input
            type="number"
            placeholder={t('seconds_max_600')}
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            min="1"
            max="600"
            autoFocus
          />
          <button className="btn btn-primary btn-sm" onClick={handleCustomSubmit}>{t('set')}</button>
        </div>
      )}

      {/* Controls */}
      <div className="rest-timer-controls">
        <button className="btn btn-ghost btn-lg" onClick={handleReset} disabled={remaining === totalSeconds && !running}>
          {t('reset')}
        </button>
        {running ? (
          <button className="btn btn-primary btn-lg rest-timer-main-btn" onClick={handlePause}>
            {t('pause')}
          </button>
        ) : (
          <button className="btn btn-primary btn-lg rest-timer-main-btn" onClick={handleStart}>
            {isComplete ? t('restart') : t('start')}
          </button>
        )}
      </div>
    </div>
  );
}
