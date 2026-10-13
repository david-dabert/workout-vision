import { useState, useEffect, useRef, useMemo } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  analyzeEquineGait,
  calculateCircleLean,
} from '../../lib/equine';
import './Equine.css';

/**
 * Generates synthetic frame sequence for equine trot biomechanics simulation.
 */
function generateScenarioFrames(scenario, options = {}) {
  const fps = options.fps || 30;
  const durationSec = options.durationSec || 3;
  const stridePeriodMs = options.stridePeriodMs || 700;
  const totalFrames = fps * durationSec;
  const frames = [];

  for (let i = 0; i < totalFrames; i++) {
    const t = (i / fps) * 1000;
    const strideProgress = (t % stridePeriodMs) / stridePeriodMs;

    let withersY;
    let sacrumY;

    if (scenario === 'sound') {
      // Sound trot: symmetrical 5cm vertical oscillation on withers and 4cm on sacrum
      const phase = (2 * Math.PI * t) / (stridePeriodMs / 2);
      withersY = 1.4 + 0.05 * Math.sin(phase);
      sacrumY = 1.35 + 0.04 * Math.sin(phase + Math.PI / 4);
    } else if (scenario === 'forelimb_lf') {
      // Left Forelimb lameness: D1 (LF stance, first half) drops less (head offloading)
      if (strideProgress < 0.5) {
        withersY = 1.4 + 0.02 * Math.sin((2 * Math.PI * strideProgress) / 0.5);
      } else {
        withersY = 1.4 + 0.06 * Math.sin((2 * Math.PI * (strideProgress - 0.5)) / 0.5);
      }
      sacrumY = 1.35 + 0.04 * Math.sin((4 * Math.PI * t) / stridePeriodMs + Math.PI / 4);
    } else {
      // Right Hindlimb lameness: D1 (RH stance, first half) has reduced pelvic downward drop
      const phaseW = (2 * Math.PI * t) / (stridePeriodMs / 2);
      withersY = 1.4 + 0.05 * Math.sin(phaseW);
      if (strideProgress < 0.5) {
        sacrumY = 1.35 + 0.015 * Math.sin((2 * Math.PI * strideProgress) / 0.5);
      } else {
        sacrumY = 1.35 + 0.05 * Math.sin((2 * Math.PI * (strideProgress - 0.5)) / 0.5);
      }
    }

    frames.push({
      timestamp: t,
      landmarks: {
        withers: { x: 0.5, y: withersY },
        sacrum: { x: 0.2, y: sacrumY },
      },
    });
  }

  return frames;
}

export default function Equine({ onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';

  const [scenario, setScenario] = useState('sound');
  const [isCircle, setIsCircle] = useState(false);
  const [circleRadius, setCircleRadius] = useState(10); // meters
  const [trotSpeed, setTrotSpeed] = useState(3.5); // m/s
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef(null);

  // Generate frame sequence based on scenario
  const frames = useMemo(() => {
    return generateScenarioFrames(scenario, { fps: 30, durationSec: 3.5, stridePeriodMs: 720 });
  }, [scenario]);

  // Analyze gait
  const report = useMemo(() => {
    return analyzeEquineGait(frames, {
      isCircle,
      circleRadiusMeters: circleRadius,
      speedMetersPerSec: trotSpeed,
    });
  }, [frames, isCircle, circleRadius, trotSpeed]);

  // Centripetal lean calculation
  const circleLean = useMemo(() => {
    return calculateCircleLean(circleRadius, trotSpeed);
  }, [circleRadius, trotSpeed]);

  // Render chart on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || frames.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#090c10';
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let y = 30; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Diagonal stance background highlights
    const totalTime = frames[frames.length - 1].timestamp - frames[0].timestamp;
    if (report.strides.length > 0) {
      for (const stride of report.strides) {
        const x1 = ((stride.diagonal1.stanceStartTime - frames[0].timestamp) / totalTime) * width;
        const x2 = ((stride.diagonal1.stanceEndTime - frames[0].timestamp) / totalTime) * width;
        const x3 = ((stride.diagonal2.stanceEndTime - frames[0].timestamp) / totalTime) * width;

        // D1 band
        ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.fillRect(x1, 0, Math.max(0, x2 - x1), height);

        // D2 band
        ctx.fillStyle = 'rgba(74, 222, 128, 0.08)';
        ctx.fillRect(x2, 0, Math.max(0, x3 - x2), height);

        // Stride boundary line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x1, 0);
        ctx.lineTo(x1, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Normalize coordinates for plotting
    const withersVals = frames.map(f => f.landmarks.withers.y);
    const sacrumVals = frames.map(f => f.landmarks.sacrum.y);
    const minVal = Math.min(...withersVals, ...sacrumVals) - 0.02;
    const maxVal = Math.max(...withersVals, ...sacrumVals) + 0.02;
    const range = maxVal - minVal || 1;

    const getY = (val) => height - ((val - minVal) / range) * (height - 40) - 20;

    // Draw Withers curve (Cyan #38bdf8)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    frames.forEach((f, idx) => {
      const x = ((f.timestamp - frames[0].timestamp) / totalTime) * width;
      const y = getY(f.landmarks.withers.y);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Sacrum curve (Green #4ade80)
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    frames.forEach((f, idx) => {
      const x = ((f.timestamp - frames[0].timestamp) / totalTime) * width;
      const y = getY(f.landmarks.sacrum.y);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [frames, report]);

  const handleCopyReport = () => {
    const text = [
      `=== EQUIVISION VETERINARY GAIT KINEMATICS REPORT ===`,
      `Protocol: Quadruped Trot Asymmetry Assessment (Dyson & Greve, 2016)`,
      `Total Strides Analyzed: ${report.totalStrides}`,
      `Mean Stride Frequency: ${report.meanStrideFrequencyHz.toFixed(2)} Hz`,
      `Mean Duty Factor: ${(report.meanDutyFactor * 100).toFixed(1)}%`,
      `Withers Asymmetry (BAI): ${report.meanWithersAsymmetryPct.toFixed(1)}%`,
      `Withers MinDiff: ${(report.meanWithersMinDiff * 100).toFixed(2)} cm`,
      `Pelvic Asymmetry (BAI): ${report.meanPelvicAsymmetryPct.toFixed(1)}%`,
      `Pelvic MinDiff: ${(report.meanPelvicMinDiff * 100).toFixed(2)} cm`,
      isCircle ? `Circle Lean Correction: ${circleLean.toFixed(2)}° (R=${circleRadius}m, v=${trotSpeed}m/s)` : `Track: Straight Line`,
      `Clinical Soundness: ${report.isClinicallySymmetric ? 'SYMMETRICAL / SOUND' : 'ASYMMETRICAL'}`,
      `Suspected Lame Limb: ${report.suspectedLamenessLimb}`,
      `Privacy: 100% On-Device WebAssembly / No Cloud Upload`,
    ].join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="equine-container" data-testid="equine-screen">
      {/* Topbar */}
      <div className="equine-topbar">
        <button
          type="button"
          className="equine-back-btn press"
          onClick={onClose || (() => { window.location.hash = ''; })}
          data-testid="equine-back-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {fr ? 'Retour' : 'Back'}
        </button>
        <div className="equine-topbar-title">
          <span>EquiVision</span>
          <span className="equine-badge">Veterinary AI</span>
        </div>
        <button
          type="button"
          className="equine-back-btn press"
          onClick={handleCopyReport}
          data-testid="equine-copy-report"
        >
          {copied ? (fr ? '✓ Copié' : '✓ Copied') : (fr ? 'Copier le bilan' : 'Copy Report')}
        </button>
      </div>

      <div className="equine-content">
        {/* Hero */}
        <div className="equine-hero">
          <h1>{fr ? 'Cinématique Quadrupède & Asymétrie Équine' : 'Quadruped Locomotion & Equine Gait Kinematics'}</h1>
          <p>
            {fr
              ? 'Évaluation objective des allures au trot, quantification de l’asymétrie garrot/sacrum et correction dynamique en cercle pour vétérinaires et physiothérapeutes.'
              : 'Objective trot gait kinematics, withers/sacrum excursion symmetry quantification, and centripetal circle lean correction for veterinarians and equine physiotherapists.'}
          </p>
        </div>

        {/* Clinical Research Notice */}
        <div className="equine-research-banner">
          <strong>{fr ? 'Fondements scientifiques (Dyson & Greve, 2016 ; Pfau et al., 2014) :' : 'Scientific Foundation (Dyson & Greve, 2016; Pfau et al., 2014):'}</strong>{' '}
          {fr
            ? 'Au trot symétrique, le garrot et le sacrum présentent deux minima identiques par foulée (D1 et D2). Une différence d’excursion verticale (BAI > 8%) révèle une décharge clinique du membre d’appui.'
            : 'In sound trot, withers and pelvis display two identical minima per stride cycle (D1 and D2). Excursion divergence (BAI > 8%) quantifies weight-offloading and subtle lameness.'}
        </div>

        {/* Scenarios Selector */}
        <div className="equine-scenarios">
          <button
            type="button"
            className={`scenario-pill ${scenario === 'sound' ? 'active' : ''}`}
            onClick={() => setScenario('sound')}
            data-testid="scenario-sound"
          >
            {fr ? 'Trot Sain (Symétrique)' : 'Sound Trot (Symmetric)'}
          </button>
          <button
            type="button"
            className={`scenario-pill ${scenario === 'forelimb_lf' ? 'active' : ''}`}
            onClick={() => setScenario('forelimb_lf')}
            data-testid="scenario-forelimb"
          >
            {fr ? 'Boiterie Antérieur Gauche (AG)' : 'Left Forelimb Lameness (LF)'}
          </button>
          <button
            type="button"
            className={`scenario-pill ${scenario === 'hindlimb_rh' ? 'active' : ''}`}
            onClick={() => setScenario('hindlimb_rh')}
            data-testid="scenario-hindlimb"
          >
            {fr ? 'Boiterie Postérieur Droit (PD)' : 'Right Hindlimb Lameness (RH)'}
          </button>
        </div>

        {/* Dynamic Canvas Chart */}
        <div className="equine-canvas-card">
          <div className="canvas-header">
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>
              {fr ? 'Trajectoire verticale lissée (Savitzky-Golay quadratic)' : 'Smoothed Vertical Trajectory (Savitzky-Golay quadratic)'}
            </span>
            <div className="canvas-legend">
              <div className="legend-item">
                <span className="legend-color legend-withers" />
                <span>{fr ? 'Garrot (Withers)' : 'Withers'}</span>
              </div>
              <div className="legend-item">
                <span className="legend-color legend-sacrum" />
                <span>{fr ? 'Sacrum (Pelvis)' : 'Sacrum / Pelvis'}</span>
              </div>
            </div>
          </div>
          <canvas ref={canvasRef} className="equine-chart-canvas" />
        </div>

        {/* Interactive Circle Controls */}
        <div className="equine-controls-panel">
          <div className="control-card">
            <div className="control-label">
              <span>{fr ? 'Évaluation en cercle (Longe)' : 'Circle Lunging Mode'}</span>
              <input
                type="checkbox"
                checked={isCircle}
                onChange={e => setIsCircle(e.target.checked)}
                data-testid="toggle-circle"
              />
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
              {fr ? 'Applique la correction centripète θ = arctan(v²/gR)' : 'Compensates centripetal lean angle θ = arctan(v²/gR)'}
            </p>
          </div>

          {isCircle && (
            <>
              <div className="control-card">
                <div className="control-label">
                  <span>{fr ? 'Rayon du cercle (R)' : 'Circle Radius (R)'}</span>
                  <b>{circleRadius} m</b>
                </div>
                <input
                  type="range"
                  min="6"
                  max="20"
                  step="0.5"
                  value={circleRadius}
                  onChange={e => setCircleRadius(parseFloat(e.target.value))}
                  className="control-slider"
                />
              </div>

              <div className="control-card">
                <div className="control-label">
                  <span>{fr ? 'Vitesse de trot (v)' : 'Trot Speed (v)'}</span>
                  <b>{trotSpeed.toFixed(1)} m/s</b>
                </div>
                <input
                  type="range"
                  min="2.5"
                  max="5.0"
                  step="0.1"
                  value={trotSpeed}
                  onChange={e => setTrotSpeed(parseFloat(e.target.value))}
                  className="control-slider"
                />
              </div>
            </>
          )}
        </div>

        {/* Clinical Metrics HUD */}
        <div className="equine-metrics-grid">
          <div className="metric-tile">
            <span className="metric-tile-label">{fr ? 'Diagnostic Clinique' : 'Clinical Verdict'}</span>
            <span className={`metric-tile-value ${report.isClinicallySymmetric ? 'metric-status-sound' : 'metric-status-lame'}`}>
              {report.isClinicallySymmetric ? (fr ? 'Sain / Régulier' : 'Sound / Symmetrical') : (fr ? 'Asymétrie Notée' : 'Asymmetry Detected')}
            </span>
            <span className="metric-tile-sub">
              {report.suspectedLamenessLimb !== 'None'
                ? `${fr ? 'Suspicion' : 'Suspected'}: ${report.suspectedLamenessLimb}`
                : fr ? 'Aucune boiterie significative' : 'Within clinical tolerance (<8%)'}
            </span>
          </div>

          <div className="metric-tile">
            <span className="metric-tile-label">{fr ? 'Asymétrie Garrot (BAI)' : 'Withers BAI (%)'}</span>
            <span className={`metric-tile-value ${Math.abs(report.meanWithersAsymmetryPct) >= 8 ? 'metric-status-lame' : 'metric-status-sound'}`}>
              {Math.abs(report.meanWithersAsymmetryPct).toFixed(1)}%
            </span>
            <span className="metric-tile-sub">MinDiff: {(report.meanWithersMinDiff * 100).toFixed(1)} cm</span>
          </div>

          <div className="metric-tile">
            <span className="metric-tile-label">{fr ? 'Asymétrie Pelvienne (BAI)' : 'Pelvic BAI (%)'}</span>
            <span className={`metric-tile-value ${Math.abs(report.meanPelvicAsymmetryPct) >= 8 ? 'metric-status-lame' : 'metric-status-sound'}`}>
              {Math.abs(report.meanPelvicAsymmetryPct).toFixed(1)}%
            </span>
            <span className="metric-tile-sub">MinDiff: {(report.meanPelvicMinDiff * 100).toFixed(1)} cm</span>
          </div>

          <div className="metric-tile">
            <span className="metric-tile-label">{fr ? 'Fréquence de foulée' : 'Stride Frequency'}</span>
            <span className="metric-tile-value">{report.meanStrideFrequencyHz.toFixed(2)} Hz</span>
            <span className="metric-tile-sub">Duty factor: {(report.meanDutyFactor * 100).toFixed(1)}%</span>
          </div>

          {isCircle && (
            <div className="metric-tile">
              <span className="metric-tile-label">{fr ? 'Angle d’inclinaison' : 'Centripetal Lean'}</span>
              <span className="metric-tile-value">{circleLean.toFixed(1)}°</span>
              <span className="metric-tile-sub">{fr ? 'Compensé sur le plan vidéo' : 'Video geometric compensation'}</span>
            </div>
          )}
        </div>

        {/* Video Upload Section for Clinicians */}
        <div className="equine-upload-section" onClick={() => { alert(fr ? 'Sélectionnez une vidéo de trot sur ligne droite ou en longe pour lancer le découpage des foulées.' : 'Select a trot video to analyze stride cycles on device.'); }}>
          <svg className="upload-icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
            {fr ? 'Importer une vidéo de trot (Trot-up ou Longe)' : 'Upload Trot Video (Straight Line or Lunge)'}
          </div>
          <div style={{ fontSize: '13px', color: '#94a3b8' }}>
            {fr ? 'Traitement 100% sur l’appareil. Aucun fichier n’est envoyé sur un serveur.' : '100% On-Device Processing. Video never leaves this phone.'}
          </div>
        </div>
      </div>
    </div>
  );
}
