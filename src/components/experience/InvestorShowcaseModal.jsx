import React, { useState, useEffect, useRef } from 'react';
import { InvestorShowcaseEngine } from '../../lib/investorShowcase';
import { formatShareText } from '../../lib/biomechanicalShareCard';
import './InvestorShowcaseModal.css';

export default function InvestorShowcaseModal({ isOpen, onClose }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'running' | 'completed'
  const [frame, setFrame] = useState(null);
  const [summary, setSummary] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const engineRef = useRef(null);

  const toggleQr = async () => {
    if (!qrDataUrl) {
      try {
        const QRCode = (await import('qrcode')).default;
        const url = await QRCode.toDataURL('https://david-dabert.github.io/workout-vision/#demo', {
          margin: 1,
          width: 240,
        });
        setQrDataUrl(url);
      } catch {
        // Fallback
      }
    }
    setShowQr((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) {
      if (engineRef.current) {
        engineRef.current.stop();
      }
      setStatus('idle');
      setFrame(null);
      setSummary(null);
      setCopyFeedback(false);
      setShowQr(false);
    }
  }, [isOpen]);

  const handleStart = () => {
    setStatus('running');
    setSummary(null);
    setCopyFeedback(false);

    const engine = new InvestorShowcaseEngine({
      exerciseName: 'Squat avec barre',
      targetReps: 9,
      playbackSpeed: 1.2,
      enableAudio: true,
      onFrame: (f) => setFrame(f),
      onComplete: (res) => {
        setSummary(res);
        setStatus('completed');
      },
    });

    engineRef.current = engine;
    engine.start();
  };

  const handleStop = () => {
    if (engineRef.current) {
      engineRef.current.stop();
    }
    setStatus('idle');
  };

  const handleCopy = async () => {
    if (!summary) return;
    const text = formatShareText(summary);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2500);
      }
    } catch {
      // Fallback
    }
  };

  const handleShare = async () => {
    if (!summary) return;
    const text = formatShareText(summary);
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'WorkoutVision : Rapport Biomécanique',
          text,
          url: 'https://david-dabert.github.io/workout-vision/',
        });
      } catch {
        // User cancelled or unsupported
      }
    } else {
      handleCopy();
    }
  };

  if (!isOpen) return null;

  // Dynamic numeral font size based on simulated distance (1.8m to 3.2m)
  const numeralRem = frame ? Math.max(4.5, Math.min(8.5, 4.5 + (frame.distanceMeters - 1.8) * 2.8)) : 5.0;

  return (
    <div className="showcase-overlay" role="dialog" aria-modal="true" aria-label="Démonstration investisseur">
      <div className="showcase-card">
        <div className="showcase-header">
          <span className="showcase-badge">DÉMONSTRATION INVESTISSEUR</span>
          <button className="showcase-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        {status === 'idle' && (
          <div>
            <h2 className="title">Showcase Biomécanique en Direct</h2>
            <p className="pro-sub">
              Démonstration instantanée sans caméra ni téléchargement. Simule un set complet de squat (9 répétitions)
              avec calcul de vitesse, HUD haute visibilité et synthèse audio psychoacoustique.
            </p>
            <div className="showcase-sovereign-tag">
              🔒 100&nbsp;% sur l’appareil • La vidéo reste sur votre téléphone
            </div>
            {showQr && qrDataUrl && (
              <div className="showcase-qr-box">
                <img src={qrDataUrl} alt="QR Code Démo WorkoutVision" className="showcase-qr-img" />
                <p className="pro-sub" style={{ margin: '4px 0 0', fontSize: '13px' }}>
                  Pointez l’appareil photo de votre smartphone pour ouvrir la démo en direct.
                </p>
              </div>
            )}
            <div className="showcase-actions">
              <button className="primary-btn" onClick={handleStart}>
                Lancer la démonstration (Squat 9 reps)
              </button>
              <button className="secondary-btn" onClick={toggleQr}>
                {showQr ? 'Masquer le QR code' : 'Tester sur votre smartphone (QR code)'}
              </button>
              <button className="text-btn" onClick={onClose}>
                Fermer
              </button>
            </div>
          </div>
        )}

        {status === 'running' && frame && (
          <div>
            <div className="showcase-hud">
              <span className="showcase-phase">
                {frame.phase === 'eccentric'
                  ? 'Descente excentrique'
                  : frame.phase === 'turnaround'
                  ? 'Point d’inflexion'
                  : frame.phase === 'concentric'
                  ? 'Montée concentrique'
                  : 'Verrouillage'}
              </span>
              <div
                className="showcase-numeral"
                style={{ fontSize: `${numeralRem}rem` }}
              >
                {frame.repCount}
              </div>
            </div>

            <div className="showcase-metrics-grid">
              <div className="showcase-metric">
                <span className="showcase-metric-label">VITESSE</span>
                <span className="showcase-metric-val">{frame.instantaneousVelocityMps.toFixed(2)} m/s</span>
              </div>
              <div className="showcase-metric">
                <span className="showcase-metric-label">ANGLE GENOU</span>
                <span className="showcase-metric-val">{frame.kneeAngleDeg.toFixed(0)}°</span>
              </div>
              <div className="showcase-metric">
                <span className="showcase-metric-label">DISTANCE HUD</span>
                <span className="showcase-metric-val">{frame.distanceMeters.toFixed(1)} m</span>
              </div>
            </div>

            <div className="showcase-actions">
              <button className="secondary-btn" onClick={handleStop}>
                Arrêter la démonstration
              </button>
            </div>
          </div>
        )}

        {status === 'completed' && summary && (
          <div>
            <div className="showcase-result-hero">
              <span className="showcase-badge">SET VALIDÉ PAR COMPUTER VISION</span>
              <h2 className="title" style={{ marginTop: '8px' }}>
                {summary.exerciseName}&nbsp;: {summary.totalReps} Répétitions
              </h2>
              <p className="pro-sub">
                Profondeur complète validée • Régularité&nbsp;: {summary.romConsistencyScore}/100
              </p>
            </div>

            <div className="showcase-metrics-grid">
              <div className="showcase-metric">
                <span className="showcase-metric-label">VITESSE MAX</span>
                <span className="showcase-metric-val">{summary.peakVelocityMps.toFixed(2)} m/s</span>
              </div>
              <div className="showcase-metric">
                <span className="showcase-metric-label">PERTE VITESSE</span>
                <span className="showcase-metric-val">{summary.velocityLossPercent.toFixed(1)}&nbsp;%</span>
              </div>
              <div className="showcase-metric">
                <span className="showcase-metric-label">SYMÉTRIE D/G</span>
                <span className="showcase-metric-val">{summary.bilateralSymmetryPercent.toFixed(1)}&nbsp;%</span>
              </div>
            </div>

            <div className="showcase-sovereign-tag">
              🔒 Analysé 100&nbsp;% en WebAssembly/WebGPU sur l'appareil • Zéro fuite cloud
            </div>
            {showQr && qrDataUrl && (
              <div className="showcase-qr-box">
                <img src={qrDataUrl} alt="QR Code Démo WorkoutVision" className="showcase-qr-img" />
                <p className="pro-sub" style={{ margin: '4px 0 0', fontSize: '13px' }}>
                  Pointez l’appareil photo de votre smartphone pour ouvrir la démo en direct.
                </p>
              </div>
            )}
            <div className="showcase-actions">
              <button className="primary-btn" onClick={handleShare}>
                {copyFeedback ? '✓ Résumé copié dans le presse-papier' : 'Partager la carte biomécanique'}
              </button>
              <button className="secondary-btn" onClick={toggleQr}>
                {showQr ? 'Masquer le QR code' : 'Afficher le QR code pour un invité'}
              </button>
              <button className="secondary-btn" onClick={handleStart}>
                Relancer la démonstration
              </button>
              <button className="text-btn" onClick={onClose}>
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
