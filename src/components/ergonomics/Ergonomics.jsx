import { useState, useMemo, useRef, useEffect } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  calculateNioshLifting,
  extractNioshParametersFromLandmarks,
} from '../../lib/ergonomics';
import { hapticLight } from '../../lib/haptics';
import './Ergonomics.css';

const INDUSTRIAL_PRESETS = [
  {
    id: 'floor_lift',
    labelEn: 'Floor Squat Lift',
    labelFr: 'Prise au Sol (Squat)',
    load: 20,
    H: 38,
    V: 22,
    D: 65,
    A: 0,
  },
  {
    id: 'conveyor_reach',
    labelEn: 'Conveyor Extended Reach',
    labelFr: 'Convoyeur Portée Éloignée',
    load: 14,
    H: 52,
    V: 85,
    D: 30,
    A: 10,
  },
  {
    id: 'overhead_shelf',
    labelEn: 'Overhead Pallet Stacking',
    labelFr: 'Empilage Rayonnage Haut',
    load: 12,
    H: 42,
    V: 140,
    D: 45,
    A: 5,
  },
  {
    id: 'twist_pallet',
    labelEn: 'Asymmetric Palletizing Twist',
    labelFr: 'Torsion de Palettisation',
    load: 18,
    H: 45,
    V: 70,
    D: 40,
    A: 45,
  },
];

export default function Ergonomics({ onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';

  const [activeTab, setActiveTab] = useState('vision'); // 'vision' | 'hud'
  const [loadWeightKg, setLoadWeightKg] = useState(18);
  const [horizontalDistanceCm, setHorizontalDistanceCm] = useState(38);
  const [verticalOriginCm, setVerticalOriginCm] = useState(65);
  const [verticalTravelDistanceCm, setVerticalTravelDistanceCm] = useState(40);
  const [asymmetryAngleDeg, setAsymmetryAngleDeg] = useState(15);
  const [activePreset, setActivePreset] = useState('twist_pallet');

  const canvasRef = useRef(null);

  const result = useMemo(() => {
    return calculateNioshLifting({
      loadWeightKg,
      horizontalDistanceCm,
      verticalOriginCm,
      verticalTravelDistanceCm,
      asymmetryAngleDeg,
    });
  }, [loadWeightKg, horizontalDistanceCm, verticalOriginCm, verticalTravelDistanceCm, asymmetryAngleDeg]);

  const handlePresetSelect = (preset) => {
    hapticLight();
    setActivePreset(preset.id);
    setLoadWeightKg(preset.load);
    setHorizontalDistanceCm(preset.H);
    setVerticalOriginCm(preset.V);
    setVerticalTravelDistanceCm(preset.D);
    setAsymmetryAngleDeg(preset.A);
  };

  const statusClass =
    result.riskCategory === 'safe'
      ? 'ergo-status-safe'
      : result.riskCategory === 'moderate'
      ? 'ergo-status-mod'
      : 'ergo-status-danger';

  // Biomechanical Sagittal Skeleton Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 360;
    const height = canvas.clientHeight || 260;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Dark Bioluminescent Background
    ctx.fillStyle = '#08080b';
    ctx.fillRect(0, 0, width, height);

    // Floor Reference Line
    const floorY = height - 32;
    ctx.strokeStyle = 'rgba(232, 230, 225, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(20, floorY);
    ctx.lineTo(width - 20, floorY);
    ctx.stroke();

    // Floor Grid Hash marks
    ctx.fillStyle = 'rgba(232, 230, 225, 0.2)';
    for (let x = 30; x < width - 20; x += 30) {
      ctx.fillRect(x, floorY, 1, 4);
    }

    // Coordinate Mapping (Worker centered at x = 110)
    const workerX = 110;
    const scaleY = (floorY - 40) / 175; // 175cm stature

    const ankle = { x: workerX, y: floorY - 8 };
    const knee = { x: workerX - 12, y: floorY - (48 * scaleY) };
    const hip = { x: workerX - 4, y: floorY - (90 * scaleY) };
    const l5s1 = { x: workerX, y: floorY - (98 * scaleY) };
    const shoulder = { x: workerX + 10, y: floorY - (142 * scaleY) };
    const head = { x: workerX + 12, y: floorY - (164 * scaleY) };

    // Hands and Load Position based on H and V
    const handX = workerX + (horizontalDistanceCm * 1.6);
    const handY = floorY - (verticalOriginCm * scaleY);
    const elbow = {
      x: (shoulder.x + handX) / 2 - 10,
      y: (shoulder.y + handY) / 2 + 10,
    };

    // Draw Skeletal Segments
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Legs
    ctx.strokeStyle = '#5DB87A'; // Emerald Bio-Green
    ctx.beginPath();
    ctx.moveTo(ankle.x, ankle.y);
    ctx.lineTo(knee.x, knee.y);
    ctx.lineTo(hip.x, hip.y);
    ctx.stroke();

    // Spine & Torso
    ctx.strokeStyle = '#D4A76A'; // Warm Golden Amber
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(l5s1.x, l5s1.y);
    ctx.lineTo(shoulder.x, shoulder.y);
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(head.x, head.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(212, 167, 106, 0.15)';
    ctx.fill();
    ctx.stroke();

    // Arms
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    // L5/S1 Vertebral Stress Indicator
    ctx.beginPath();
    ctx.arc(l5s1.x, l5s1.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = result.estimatedL5S1CompressionNewtons > 3400 ? '#D95B5B' : '#5DB87A';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Load Box at Hands
    const boxSize = Math.max(22, Math.min(36, 16 + loadWeightKg * 0.7));
    ctx.fillStyle = result.riskCategory === 'safe'
      ? 'rgba(93, 184, 122, 0.25)'
      : result.riskCategory === 'moderate'
      ? 'rgba(201, 160, 74, 0.35)'
      : 'rgba(217, 91, 91, 0.4)';
    ctx.strokeStyle = result.riskCategory === 'safe'
      ? '#5DB87A'
      : result.riskCategory === 'moderate'
      ? '#C9A04A'
      : '#D95B5B';
    ctx.lineWidth = 2;
    ctx.fillRect(handX - 8, handY - boxSize / 2, boxSize, boxSize);
    ctx.strokeRect(handX - 8, handY - boxSize / 2, boxSize, boxSize);

    // Box weight label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${loadWeightKg}kg`, handX - 8 + boxSize / 2, handY + 4);

    // Moment Arm (H) Dimension Line
    ctx.strokeStyle = 'rgba(212, 167, 106, 0.8)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(workerX, floorY - 12);
    ctx.lineTo(handX, floorY - 12);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#D4A76A';
    ctx.font = '10px monospace';
    ctx.fillText(`H = ${horizontalDistanceCm} cm`, (workerX + handX) / 2, floorY - 16);

    // Vertical Height (V) Dimension Line
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(handX + boxSize + 6, floorY);
    ctx.lineTo(handX + boxSize + 6, handY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'left';
    ctx.fillText(`V = ${verticalOriginCm} cm`, handX + boxSize + 10, (floorY + handY) / 2 + 3);

  }, [horizontalDistanceCm, verticalOriginCm, loadWeightKg, result]);

  return (
    <div className="ergo-container" data-testid="ergonomics-screen">
      {/* Topbar */}
      <div className="ergo-topbar">
        <button
          type="button"
          className="ergo-back-btn press"
          onClick={onClose || (() => { window.location.hash = ''; })}
          data-testid="ergo-back-btn"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {fr ? 'Retour' : 'Back'}
        </button>
        <div className="ergo-topbar-title">
          <span>{fr ? 'Ergonomie au Travail (NIOSH)' : 'Workplace Ergonomics (NIOSH)'}</span>
          <span className="ergo-badge">Enterprise Biomechanics</span>
        </div>
        <div style={{ width: '60px' }} />
      </div>

      <div className="ergo-content">
        {/* Hero */}
        <div className="ergo-hero">
          <h1>{fr ? 'Équation de Levage NIOSH & Risque Spinal L5/S1' : 'NIOSH Lifting Equation & Spinal L5/S1 Analysis'}</h1>
          <p>
            {fr
              ? 'Évaluation objective des charges de manutention, calcul de la Charge Limite Recommandée (RWL) et de l’Indice de Levage (LI). 100% sur l’appareil pour une conformité totale au RGPD.'
              : 'Objective occupational biomechanics, Recommended Weight Limit (RWL), and Lifting Index (LI). 100% on-device for total privacy and enterprise labor compliance.'}
          </p>
        </div>

        {/* Enterprise Privacy Banner */}
        <div className="ergo-privacy-card">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div>
            <b>{fr ? 'Conformité Entreprise & Vie Privée des Salariés' : 'Enterprise Privacy & Labor Compliance'}</b>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary, rgba(232, 230, 225, 0.55))', marginTop: '2px' }}>
              {fr
                ? 'Aucun visage, flux vidéo ou donnée biométrique n’est transmis au cloud. Tout le calcul squelettique reste confiné dans le navigateur de l’opérateur.'
                : 'Zero facial data or video footage is uploaded to cloud servers. All skeletal calculations remain isolated within the device.'}
            </div>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="ergo-tabs-bar">
          <button
            type="button"
            className={`ergo-tab-btn ${activeTab === 'vision' ? 'active' : ''}`}
            onClick={() => { hapticLight(); setActiveTab('vision'); }}
            data-testid="tab-vision"
          >
            {fr ? 'Simulation Squelettique & Vision' : 'Skeletal Vision Simulation'}
          </button>
          <button
            type="button"
            className={`ergo-tab-btn ${activeTab === 'hud' ? 'active' : ''}`}
            onClick={() => { hapticLight(); setActiveTab('hud'); }}
            data-testid="tab-hud"
          >
            {fr ? 'Curseurs Manuels HUD' : 'Manual Multipliers HUD'}
          </button>
        </div>

        {/* Industrial Presets Chips */}
        <div className="ergo-presets-row">
          {INDUSTRIAL_PRESETS.map(p => (
            <button
              key={p.id}
              type="button"
              className={`preset-chip ${activePreset === p.id ? 'active' : ''}`}
              onClick={() => handlePresetSelect(p)}
              data-testid={`preset-${p.id}`}
            >
              {fr ? p.labelFr : p.labelEn}
            </button>
          ))}
        </div>

        {/* Visual Biomechanical Canvas Card */}
        {activeTab === 'vision' && (
          <div className="ergo-canvas-card">
            <div className="canvas-header-row">
              <span className="canvas-title">
                {fr ? 'Cinématique Squelettique du Manutentionnaire (Plan Sagittal)' : 'Operator Skeletal Sagittal Kinematics'}
              </span>
              <span className="l5s1-badge">
                L5/S1: {result.estimatedL5S1CompressionNewtons} N
              </span>
            </div>
            <canvas ref={canvasRef} className="ergo-skeleton-canvas" />
          </div>
        )}

        {/* HUD Gauges */}
        <div className="ergo-dashboard">
          <div className="ergo-gauge-card">
            <span className="ergo-gauge-label">{fr ? 'Indice de Levage (LI)' : 'Lifting Index (LI)'}</span>
            <span className={`ergo-gauge-value ${statusClass}`} data-testid="ergo-li-value">
              {result.liftingIndexLI}
            </span>
            <span className="ergo-gauge-sub">
              {result.riskCategory === 'safe'
                ? fr ? 'Conforme / Risque Faible (LI ≤ 1.0)' : 'Safe / Low Risk (LI ≤ 1.0)'
                : result.riskCategory === 'moderate'
                ? fr ? 'Risque Modéré (1.0 < LI ≤ 3.0)' : 'Moderate Risk (1.0 < LI ≤ 3.0)'
                : fr ? 'Danger Ergonomique (LI > 3.0)' : 'High Ergonomic Risk (LI > 3.0)'}
            </span>
          </div>

          <div className="ergo-gauge-card">
            <span className="ergo-gauge-label">{fr ? 'Charge Max Recommandée (RWL)' : 'Recommended Weight (RWL)'}</span>
            <span className="ergo-gauge-value" style={{ color: '#D4A76A' }} data-testid="ergo-rwl-value">
              {result.recommendedWeightLimitKg} kg
            </span>
            <span className="ergo-gauge-sub">
              {fr ? `Charge réelle\u00A0: ${loadWeightKg} kg` : `Actual Load: ${loadWeightKg} kg`}
            </span>
          </div>

          <div className="ergo-gauge-card">
            <span className="ergo-gauge-label">{fr ? 'Compression L5/S1 Estimée' : 'Est. L5/S1 Compression'}</span>
            <span className={`ergo-gauge-value ${result.estimatedL5S1CompressionNewtons > 3400 ? 'ergo-status-danger' : 'ergo-status-safe'}`}>
              {result.estimatedL5S1CompressionNewtons} N
            </span>
            <span className="ergo-gauge-sub">
              {fr ? 'Limite d’action NIOSH\u00A0: 3 400 N' : 'NIOSH Action Limit: 3,400 N'}
            </span>
          </div>
        </div>

        {/* Interactive Sliders */}
        <div className="ergo-controls">
          <h3>{fr ? 'Paramètres du Poste de Travail' : 'Workstation & Lift Parameters'}</h3>
          <div className="ergo-slider-group">
            <div className="slider-row">
              <div className="slider-label">
                <span>{fr ? 'Poids de la charge' : 'Load Weight'}</span>
                <b>{loadWeightKg} kg</b>
              </div>
              <input
                type="range"
                min="5"
                max="45"
                step="1"
                value={loadWeightKg}
                onChange={e => {
                  hapticLight();
                  setLoadWeightKg(parseFloat(e.target.value));
                }}
                className="ergo-slider"
                data-testid="slider-load"
              />
            </div>

            <div className="slider-row">
              <div className="slider-label">
                <span>{fr ? 'Portée horizontale (H)' : 'Horizontal Reach (H)'}</span>
                <b>{horizontalDistanceCm} cm</b>
              </div>
              <input
                type="range"
                min="25"
                max="65"
                step="1"
                value={horizontalDistanceCm}
                onChange={e => {
                  hapticLight();
                  setHorizontalDistanceCm(parseFloat(e.target.value));
                }}
                className="ergo-slider"
                data-testid="slider-h"
              />
            </div>

            <div className="slider-row">
              <div className="slider-label">
                <span>{fr ? 'Hauteur d’origine (V)' : 'Vertical Origin Height (V)'}</span>
                <b>{verticalOriginCm} cm</b>
              </div>
              <input
                type="range"
                min="10"
                max="150"
                step="5"
                value={verticalOriginCm}
                onChange={e => {
                  hapticLight();
                  setVerticalOriginCm(parseFloat(e.target.value));
                }}
                className="ergo-slider"
                data-testid="slider-v"
              />
            </div>

            <div className="slider-row">
              <div className="slider-label">
                <span>{fr ? 'Angle d’asymétrie / torsion (A)' : 'Twist / Asymmetry Angle (A)'}</span>
                <b>{asymmetryAngleDeg}°</b>
              </div>
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={asymmetryAngleDeg}
                onChange={e => {
                  hapticLight();
                  setAsymmetryAngleDeg(parseFloat(e.target.value));
                }}
                className="ergo-slider"
                data-testid="slider-a"
              />
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {result.recommendations.length > 0 && (
          <div className="ergo-recommendations">
            <h3>{fr ? 'Recommandations Ergonomiques Immédiates' : 'Immediate Ergonomic Recommendations'}</h3>
            <ul className="rec-list">
              {result.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
