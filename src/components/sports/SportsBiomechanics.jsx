import { useState, useRef, useEffect, useMemo } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  calculateGolfXFactor,
  calculateGolfTempo,
  estimateGolfClubheadSpeed,
  calculateTennisTrophyPose,
  calculatePadelBandeja,
  calculateBikeFitKneeAngle,
} from '../../lib/sports/kinematics';
import { hapticLight } from '../../lib/haptics';
import './SportsBiomechanics.css';

export default function SportsBiomechanics({ onClose, onOpenEquine }) {
  const { lang } = useT();
  const fr = lang === 'fr';

  const [activeSport, setActiveSport] = useState('golf'); // 'golf' | 'tennis' | 'padel' | 'cycling'
  const [copied, setCopied] = useState(false);

  // Golf State
  const [shoulderTurn, setShoulderTurn] = useState(92);
  const [pelvisTurn, setPelvisTurn] = useState(45);
  const [backswingMs, setBackswingMs] = useState(750);
  const [downswingMs, setDownswingMs] = useState(250);

  // Tennis State
  const [tennisShoulderTilt, setTennisShoulderTilt] = useState(28);
  const [tennisKneeFlexion, setTennisKneeFlexion] = useState(115);

  // Padel State
  const [padelContactHeight, setPadelContactHeight] = useState(2.15);
  const [padelShoulderTilt, setPadelShoulderTilt] = useState(18);

  // Cycling State
  const [bdcKneeAngle, setBdcKneeAngle] = useState(30);

  const canvasRef = useRef(null);

  // Calculations
  const golfXFactor = useMemo(() => calculateGolfXFactor(shoulderTurn, pelvisTurn), [shoulderTurn, pelvisTurn]);
  const golfTempo = useMemo(() => calculateGolfTempo(backswingMs, downswingMs), [backswingMs, downswingMs]);
  const golfClubSpeed = useMemo(() => estimateGolfClubheadSpeed(1850), []);

  const tennisTrophy = useMemo(() => calculateTennisTrophyPose(tennisShoulderTilt, tennisKneeFlexion), [tennisShoulderTilt, tennisKneeFlexion]);
  const padelBandeja = useMemo(() => calculatePadelBandeja(padelContactHeight, padelShoulderTilt), [padelContactHeight, padelShoulderTilt]);
  const bikeFit = useMemo(() => calculateBikeFitKneeAngle(bdcKneeAngle), [bdcKneeAngle]);

  // Canvas visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 360;
    const height = canvas.clientHeight || 220;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#08080b';
    ctx.fillRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;

    if (activeSport === 'golf') {
      // Draw X-Factor Pelvis and Shoulder vectors
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 70, 0, Math.PI * 2);
      ctx.stroke();

      // Pelvis Line (Bio Green)
      const radP = (pelvisTurn * Math.PI) / 180;
      ctx.strokeStyle = '#5DB87A';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX - 60 * Math.cos(radP), centerY - 60 * Math.sin(radP));
      ctx.lineTo(centerX + 60 * Math.cos(radP), centerY + 60 * Math.sin(radP));
      ctx.stroke();

      // Shoulder Line (Amber)
      const radS = (shoulderTurn * Math.PI) / 180;
      ctx.strokeStyle = '#D4A76A';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX - 75 * Math.cos(radS), centerY - 75 * Math.sin(radS));
      ctx.lineTo(centerX + 75 * Math.cos(radS), centerY + 75 * Math.sin(radS));
      ctx.stroke();

      // Center pivot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = 'rgba(232, 230, 225, 0.7)';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.fillText(`X-Factor Separation: ${golfXFactor.xFactorDeg}°`, 20, 25);
    } else if (activeSport === 'tennis') {
      // Draw Trophy Pose shoulder tilt vector
      const tiltRad = (tennisShoulderTilt * Math.PI) / 180;
      ctx.strokeStyle = '#4E95D4';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX - 70, centerY + 70 * Math.sin(tiltRad));
      ctx.lineTo(centerX + 70, centerY - 70 * Math.sin(tiltRad));
      ctx.stroke();

      // Knee angle arc
      ctx.strokeStyle = '#5DB87A';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX - 30, centerY + 50, 35, 0, (tennisKneeFlexion * Math.PI) / 180);
      ctx.stroke();

      ctx.fillStyle = 'rgba(232, 230, 225, 0.7)';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.fillText(`Shoulder Tilt: ${tennisShoulderTilt}° | Knee Flexion: ${tennisKneeFlexion}°`, 20, 25);
    } else if (activeSport === 'padel') {
      // Draw Bandeja contact height and slice trajectory
      ctx.strokeStyle = '#D4A76A';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX - 80, centerY - 30);
      ctx.lineTo(centerX + 80, centerY - 30 + (padelShoulderTilt * 1.5));
      ctx.stroke();

      ctx.fillStyle = '#5DB87A';
      ctx.beginPath();
      ctx.arc(centerX - 20, centerY - 30, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(232, 230, 225, 0.7)';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.fillText(`Bandeja Contact: ${padelContactHeight}m (${padelBandeja.reboundSuppressionIndex}% Glass Suppression)`, 20, 25);
    } else {
      // Cycling BDC Knee Angle
      const kneeRad = (bdcKneeAngle * Math.PI) / 180;
      ctx.strokeStyle = bikeFit.saddleHeightVerdict === 'optimal' ? '#5DB87A' : '#D4A76A';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX - 40, centerY - 50);
      ctx.lineTo(centerX, centerY + 20);
      ctx.lineTo(centerX + 50 * Math.cos(kneeRad), centerY + 20 + 50 * Math.sin(kneeRad));
      ctx.stroke();

      ctx.fillStyle = 'rgba(232, 230, 225, 0.7)';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.fillText(`BDC Knee Extension: ${bdcKneeAngle}° (${bikeFit.saddleHeightVerdict})`, 20, 25);
    }
  }, [activeSport, golfXFactor, tennisShoulderTilt, tennisKneeFlexion, padelContactHeight, padelShoulderTilt, padelBandeja, bdcKneeAngle, bikeFit, pelvisTurn, shoulderTurn]);

  const handleCopyReport = () => {
    hapticLight();
    const text = `=== WorkoutVision Precision Sports Biomechanics ===\n` +
      `Sport: ${activeSport.toUpperCase()}\n` +
      (activeSport === 'golf' ? `X-Factor: ${golfXFactor.xFactorDeg}° (${golfXFactor.xFactorRating}) | Tempo: ${golfTempo.tempoRatio}:1 (${golfTempo.tempoRating}) | Est. Speed: ${golfClubSpeed} mph\n` : '') +
      (activeSport === 'tennis' ? `Trophy Pose: ${tennisTrophy.isTrophyPoseSound ? 'Sound' : 'Asymmetric'} | Shoulder Tilt: ${tennisTrophy.shoulderTiltDeg}° | Knee Flexion: ${tennisTrophy.rearKneeFlexionDeg}°\n` : '') +
      (activeSport === 'padel' ? `Bandeja Contact: ${padelBandeja.contactHeightMeters}m | Rating: ${padelBandeja.verdict} | Glass Suppression: ${padelBandeja.reboundSuppressionIndex}%\n` : '') +
      (activeSport === 'cycling' ? `Bike Fit BDC Knee: ${bikeFit.bdcKneeAngleDeg}° | Verdict: ${bikeFit.saddleHeightVerdict}\n` : '') +
      `Processing: 100% On-Device Neural Vision | Zero Telemetry Leaks.`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="sports-container" data-testid="sports-biomechanics-screen">
      {/* Topbar */}
      <div className="sports-topbar">
        <button
          type="button"
          className="sports-back-btn press"
          onClick={() => {
            hapticLight();
            if (onClose) onClose();
            else window.location.hash = '';
          }}
          data-testid="sports-back-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {fr ? 'Retour' : 'Back'}
        </button>
        <div className="sports-topbar-title">
          <span>{fr ? 'Sports de Précision' : 'Precision Sports Lab'}</span>
          <span className="sports-badge">Tour AI</span>
        </div>
        <button
          type="button"
          className="sports-back-btn press"
          onClick={handleCopyReport}
          data-testid="sports-copy-report"
        >
          {copied ? (fr ? '✓ Copié' : '✓ Copied') : (fr ? 'Copier Bilan' : 'Copy Report')}
        </button>
      </div>

      <div className="sports-content">
        {/* Hero */}
        <div className="sports-hero">
          <h1>{fr ? 'Cinématique Avancée pour Sports de Haut Niveau' : 'High-Performance Sports Biomechanics Studio'}</h1>
          <p>
            {fr
              ? 'Analyse cinématique sur l’appareil pour le golf, le tennis, le padel et le cyclisme. Mesurez l’angle X-Factor, le ratio de tempo 3:1, la pose trophée et l’ajustement postural avec votre caméra sans matériel supplémentaire.'
              : 'On-device kinematic analysis for golf, tennis, padel, and cycling. Quantify Tour-standard X-Factor stretch, 3:1 tempo ratio, serve kinetic sequencing, and bike fit with pure computer vision.'}
          </p>
        </div>

        {/* High Willingness-to-Pay / Hardware Replacement Banner */}
        <div className="market-value-card">
          <h3>{fr ? '🎯 Alternative Portable aux Radars & Systèmes à 20\u00A0000\u00A0€' : '🎯 Portable Alternative to $20,000 Hardware Launch Monitors'}</h3>
          <p>
            {fr
              ? 'Les moniteurs de lancement (TrackMan, GCQuad) et les laboratoires 3D coûtent des dizaines de milliers d’euros. WorkoutVision apporte l’analyse cinématique de grade Tour directement sur votre smartphone en local.'
              : 'Dedicated launch monitors (TrackMan, GCQuad) and motion-capture rigs cost upwards of $20,000. WorkoutVision provides Tour-grade swing and kinetic chain analysis on your phone with zero extra hardware.'}
          </p>
        </div>

        {/* Sports Category Tabs */}
        <div className="sports-tabs">
          <button
            type="button"
            className={`sports-tab-btn ${activeSport === 'golf' ? 'active' : ''}`}
            onClick={() => { hapticLight(); setActiveSport('golf'); }}
            data-testid="tab-golf"
          >
            ⛳ {fr ? 'Golf (X-Factor & Tempo 3:1)' : 'Golf (X-Factor & 3:1 Tempo)'}
          </button>
          <button
            type="button"
            className={`sports-tab-btn ${activeSport === 'tennis' ? 'active' : ''}`}
            onClick={() => { hapticLight(); setActiveSport('tennis'); }}
            data-testid="tab-tennis"
          >
            🎾 {fr ? 'Tennis (Pose Trophée & Service)' : 'Tennis (Trophy Pose & Serve)'}
          </button>
          <button
            type="button"
            className={`sports-tab-btn ${activeSport === 'padel' ? 'active' : ''}`}
            onClick={() => { hapticLight(); setActiveSport('padel'); }}
            data-testid="tab-padel"
          >
            🏸 {fr ? 'Padel (Bandeja & Rebond Vitre)' : 'Padel (Bandeja & Glass Rebound)'}
          </button>
          <button
            type="button"
            className={`sports-tab-btn ${activeSport === 'cycling' ? 'active' : ''}`}
            onClick={() => { hapticLight(); setActiveSport('cycling'); }}
            data-testid="tab-cycling"
          >
            🚴 {fr ? 'Cyclisme (Bike Fit & Genou PMB)' : 'Cycling (Bike Fit & BDC Knee)'}
          </button>
          {onOpenEquine && (
            <button
              type="button"
              className="sports-tab-btn"
              onClick={() => { hapticLight(); onOpenEquine(); }}
              data-testid="tab-equine-link"
            >
              🐎 {fr ? 'Équitation (EquiVision)' : 'Equestrian (EquiVision)'}
            </button>
          )}
        </div>

        {/* Dynamic Canvas Angle Visualizer */}
        <div className="sports-canvas-container">
          <canvas ref={canvasRef} className="sports-canvas" />
        </div>

        {/* Sport Specific Metric Cards and Controls */}
        {activeSport === 'golf' && (
          <div className="sports-card" data-testid="card-golf-metrics">
            <div className="sports-card-header">
              <h2>⛳ {fr ? 'Indicateurs PGA Tour' : 'PGA Tour Kinematic Markers'}</h2>
              <span className="metric-tag optimal">Tour Model</span>
            </div>

            <div className="sports-metrics-grid">
              <div className="metric-box">
                <div className="metric-label">X-Factor Stretch</div>
                <div className="metric-val">
                  {golfXFactor.xFactorDeg}°
                  <span className={`metric-tag ${golfXFactor.xFactorRating === 'optimal_tour' ? 'optimal' : 'warning'}`}>
                    {golfXFactor.xFactorRating}
                  </span>
                </div>
              </div>
              <div className="metric-box">
                <div className="metric-label">{fr ? 'Ratio de Tempo' : 'Swing Tempo'}</div>
                <div className="metric-val">
                  {golfTempo.tempoRatio}:1
                  <span className={`metric-tag ${golfTempo.tempoRating === 'tour_tempo' ? 'optimal' : 'warning'}`}>
                    {golfTempo.tempoRating}
                  </span>
                </div>
              </div>
              <div className="metric-box">
                <div className="metric-label">{fr ? 'Vitesse Club Estimée' : 'Est. Clubhead Speed'}</div>
                <div className="metric-val">
                  {golfClubSpeed} mph
                  <span className="metric-tag optimal">Tour Driver</span>
                </div>
              </div>
            </div>

            {/* Interactive Sliders */}
            <div className="controls-grid">
              <div className="control-item">
                <label>
                  <span>{fr ? 'Rotation Épaules' : 'Shoulder Turn'}:</span>
                  <strong>{shoulderTurn}°</strong>
                </label>
                <input
                  type="range"
                  min="60"
                  max="120"
                  value={shoulderTurn}
                  onChange={(e) => setShoulderTurn(Number(e.target.value))}
                  className="control-slider"
                />
              </div>
              <div className="control-item">
                <label>
                  <span>{fr ? 'Rotation Bassin' : 'Pelvis Turn'}:</span>
                  <strong>{pelvisTurn}°</strong>
                </label>
                <input
                  type="range"
                  min="25"
                  max="65"
                  value={pelvisTurn}
                  onChange={(e) => setPelvisTurn(Number(e.target.value))}
                  className="control-slider"
                />
              </div>
              <div className="control-item">
                <label>
                  <span>{fr ? 'Durée Backswing' : 'Backswing Time'}:</span>
                  <strong>{backswingMs} ms</strong>
                </label>
                <input
                  type="range"
                  min="400"
                  max="1000"
                  step="25"
                  value={backswingMs}
                  onChange={(e) => setBackswingMs(Number(e.target.value))}
                  className="control-slider"
                />
              </div>
              <div className="control-item">
                <label>
                  <span>{fr ? 'Durée Downswing' : 'Downswing Time'}:</span>
                  <strong>{downswingMs} ms</strong>
                </label>
                <input
                  type="range"
                  min="180"
                  max="350"
                  step="10"
                  value={downswingMs}
                  onChange={(e) => setDownswingMs(Number(e.target.value))}
                  className="control-slider"
                />
              </div>
            </div>
          </div>
        )}

        {activeSport === 'tennis' && (
          <div className="sports-card" data-testid="card-tennis-metrics">
            <div className="sports-card-header">
              <h2>🎾 {fr ? 'Service & Chaîne Cinétique' : 'Serve Kinetic Chain & Trophy Pose'}</h2>
              <span className={`metric-tag ${tennisTrophy.isTrophyPoseSound ? 'optimal' : 'warning'}`}>
                {tennisTrophy.isTrophyPoseSound ? 'Sound Pose' : 'Sub-Optimal'}
              </span>
            </div>

            <div className="sports-metrics-grid">
              <div className="metric-box">
                <div className="metric-label">{fr ? 'Inclinaison Épaules' : 'Shoulder Tilt'}</div>
                <div className="metric-val">{tennisTrophy.shoulderTiltDeg}°</div>
              </div>
              <div className="metric-box">
                <div className="metric-label">{fr ? 'Flexion Genou Arrière' : 'Rear Knee Flexion'}</div>
                <div className="metric-val">{tennisTrophy.rearKneeFlexionDeg}°</div>
              </div>
            </div>

            <div className="controls-grid">
              <div className="control-item">
                <label>
                  <span>{fr ? 'Inclinaison Épaules' : 'Shoulder Tilt'}:</span>
                  <strong>{tennisShoulderTilt}°</strong>
                </label>
                <input
                  type="range"
                  min="10"
                  max="45"
                  value={tennisShoulderTilt}
                  onChange={(e) => setTennisShoulderTilt(Number(e.target.value))}
                  className="control-slider"
                />
              </div>
              <div className="control-item">
                <label>
                  <span>{fr ? 'Flexion Genou Arrière' : 'Rear Knee Flexion'}:</span>
                  <strong>{tennisKneeFlexion}°</strong>
                </label>
                <input
                  type="range"
                  min="80"
                  max="140"
                  value={tennisKneeFlexion}
                  onChange={(e) => setTennisKneeFlexion(Number(e.target.value))}
                  className="control-slider"
                />
              </div>
            </div>
          </div>
        )}

        {activeSport === 'padel' && (
          <div className="sports-card" data-testid="card-padel-metrics">
            <div className="sports-card-header">
              <h2>🏸 {fr ? 'Bandeja & Contrôle de Rebond' : 'Bandeja Mechanics & Rebound Suppression'}</h2>
              <span className="metric-tag optimal">{padelBandeja.verdict}</span>
            </div>

            <div className="sports-metrics-grid">
              <div className="metric-box">
                <div className="metric-label">{fr ? 'Hauteur d’Impact' : 'Contact Height'}</div>
                <div className="metric-val">{padelBandeja.contactHeightMeters} m</div>
              </div>
              <div className="metric-box">
                <div className="metric-label">{fr ? 'Suppression Rebond Vitre' : 'Glass Rebound Control'}</div>
                <div className="metric-val">{padelBandeja.reboundSuppressionIndex}%</div>
              </div>
            </div>

            <div className="controls-grid">
              <div className="control-item">
                <label>
                  <span>{fr ? 'Hauteur d’Impact' : 'Contact Height'}:</span>
                  <strong>{padelContactHeight} m</strong>
                </label>
                <input
                  type="range"
                  min="1.60"
                  max="2.70"
                  step="0.05"
                  value={padelContactHeight}
                  onChange={(e) => setPadelContactHeight(Number(e.target.value))}
                  className="control-slider"
                />
              </div>
              <div className="control-item">
                <label>
                  <span>{fr ? 'Inclinaison Latérale' : 'Lateral Tilt'}:</span>
                  <strong>{padelShoulderTilt}°</strong>
                </label>
                <input
                  type="range"
                  min="5"
                  max="35"
                  value={padelShoulderTilt}
                  onChange={(e) => setPadelShoulderTilt(Number(e.target.value))}
                  className="control-slider"
                />
              </div>
            </div>
          </div>
        )}

        {activeSport === 'cycling' && (
          <div className="sports-card" data-testid="card-cycling-metrics">
            <div className="sports-card-header">
              <h2>🚴 {fr ? 'Étude Posturale Bike Fit' : 'Bike Fit & Knee Kinematics'}</h2>
              <span className={`metric-tag ${bikeFit.saddleHeightVerdict === 'optimal' ? 'optimal' : 'warning'}`}>
                {bikeFit.saddleHeightVerdict}
              </span>
            </div>

            <div className="sports-metrics-grid">
              <div className="metric-box">
                <div className="metric-label">{fr ? 'Angle Genou au PMB' : 'BDC Knee Extension'}</div>
                <div className="metric-val">{bikeFit.bdcKneeAngleDeg}°</div>
              </div>
              <div className="metric-box">
                <div className="metric-label">{fr ? 'Diagnostic Selle' : 'Saddle Diagnosis'}</div>
                <div className="metric-val">{bikeFit.saddleHeightVerdict}</div>
              </div>
            </div>

            <div className="controls-grid">
              <div className="control-item">
                <label>
                  <span>{fr ? 'Angle Genou PMB' : 'BDC Knee Angle'}:</span>
                  <strong>{bdcKneeAngle}°</strong>
                </label>
                <input
                  type="range"
                  min="15"
                  max="48"
                  value={bdcKneeAngle}
                  onChange={(e) => setBdcKneeAngle(Number(e.target.value))}
                  className="control-slider"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
