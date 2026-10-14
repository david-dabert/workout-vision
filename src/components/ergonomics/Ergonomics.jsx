import { useState, useMemo, useRef, useEffect } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  calculateNioshLifting,
  extractNioshParametersFromLandmarks,
} from '../../lib/ergonomics';
import { hapticLight } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { RGB, HEX, rgba } from '../experience/palette';
import { Topbar, DemoTag, Verdict, GroupHead, Metric, Range } from '../experience/Showcase';
import { num, frText } from '../experience/showcase-text';
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
  // The title condenses into the topbar as the page scrolls under it (topbar.js), as on Guide, History and Pro.
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);

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

    // The frame's well shows through (Showcase.css .sc-frame); the figure takes the app's palette (palette.js).
    ctx.clearRect(0, 0, width, height);

    // Floor Reference Line
    const floorY = height - 32;
    ctx.strokeStyle = rgba(RGB.bone, 0.12);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(20, floorY);
    ctx.lineTo(width - 20, floorY);
    ctx.stroke();

    // Floor Grid Hash marks
    ctx.fillStyle = rgba(RGB.bone, 0.2);
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
    ctx.strokeStyle = rgba(RGB.bone, 0.85); // Bone
    ctx.beginPath();
    ctx.moveTo(ankle.x, ankle.y);
    ctx.lineTo(knee.x, knee.y);
    ctx.lineTo(hip.x, hip.y);
    ctx.stroke();

    // Spine & Torso
    ctx.strokeStyle = HEX.lamp; // Lamp
    ctx.beginPath();
    ctx.moveTo(hip.x, hip.y);
    ctx.lineTo(l5s1.x, l5s1.y);
    ctx.lineTo(shoulder.x, shoulder.y);
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(head.x, head.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = rgba(RGB.lamp, 0.15);
    ctx.fill();
    ctx.stroke();

    // Arms
    ctx.strokeStyle = rgba(RGB.bone, 0.55);
    ctx.beginPath();
    ctx.moveTo(shoulder.x, shoulder.y);
    ctx.lineTo(elbow.x, elbow.y);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    // L5/S1 Vertebral Stress Indicator
    ctx.beginPath();
    ctx.arc(l5s1.x, l5s1.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = result.estimatedL5S1CompressionNewtons > 3400 ? HEX.lampHi : rgba(RGB.bone, 0.85);
    ctx.fill();
    ctx.strokeStyle = rgba(RGB.void, 0.9);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Load Box at Hands
    const boxSize = Math.max(22, Math.min(36, 16 + loadWeightKg * 0.7));
    // No red in the app: a safe load in bone, a moderate one in the lamp, a high one in the bright lamp.
    ctx.fillStyle = result.riskCategory === 'safe'
      ? rgba(RGB.bone, 0.16)
      : result.riskCategory === 'moderate'
      ? rgba(RGB.lamp, 0.3)
      : rgba(RGB.lampHi, 0.42);
    ctx.strokeStyle = result.riskCategory === 'safe'
      ? rgba(RGB.bone, 0.85)
      : result.riskCategory === 'moderate'
      ? HEX.lamp
      : HEX.lampHi;
    ctx.lineWidth = 2;
    ctx.fillRect(handX - 8, handY - boxSize / 2, boxSize, boxSize);
    ctx.strokeRect(handX - 8, handY - boxSize / 2, boxSize, boxSize);

    // Box weight label
    ctx.fillStyle = rgba(RGB.bone, 0.95);
    ctx.font = '600 11px Geist, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${loadWeightKg}\u00A0kg`, handX - 8 + boxSize / 2, handY + 4);

    // Moment Arm (H) Dimension Line
    ctx.strokeStyle = rgba(RGB.lamp, 0.8);
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(workerX, floorY - 12);
    ctx.lineTo(handX, floorY - 12);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = HEX.lamp;
    ctx.font = '10px "Geist Mono", ui-monospace, monospace';
    ctx.fillText(`H = ${horizontalDistanceCm}\u00A0cm`, (workerX + handX) / 2, floorY - 16);

    // Vertical Height (V) Dimension Line
    ctx.strokeStyle = rgba(RGB.bone, 0.6);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(handX + boxSize + 6, floorY);
    ctx.lineTo(handX + boxSize + 6, handY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = rgba(RGB.bone, 0.85);
    ctx.textAlign = 'left';
    ctx.fillText(`V = ${verticalOriginCm}\u00A0cm`, handX + boxSize + 10, (floorY + handY) / 2 + 3);

  }, [horizontalDistanceCm, verticalOriginCm, loadWeightKg, result]);

  // The values are the NIOSH equation's for the sliders' positions (src/lib/ergonomics), not a measure of a video: the
  // figures carry Demo. The equation's advice is written in English in the code; each sentence has its French here.
  const riskText = result.riskCategory === 'safe'
    ? fr ? 'Conforme / Risque Faible (LI ≤ 1.0)' : 'Safe / Low Risk (LI ≤ 1.0)'
    : result.riskCategory === 'moderate'
    ? fr ? 'Risque Modéré (1.0 < LI ≤ 3.0)' : 'Moderate Risk (1.0 < LI ≤ 3.0)'
    : fr ? 'Danger Ergonomique (LI > 3.0)' : 'High Ergonomic Risk (LI > 3.0)';
  const advice = (rec) => {
    if (!fr) return rec;
    if (rec.startsWith('Bring the load closer')) return 'Rapprochez la charge du corps pour réduire le bras de levier horizontal.';
    if (rec.startsWith('Elevate the origin height')) return 'Montez la hauteur de prise de la charge pour éviter une flexion profonde du tronc.';
    if (rec.startsWith('Eliminate rotational twist')) return 'Supprimez la torsion : placez les pieds face à la cible.';
    const split = rec.match(/^Split load into smaller batches: recommended threshold is ([\d.]+) kg\.$/);
    if (split) return `Fractionnez la charge en lots plus légers : seuil recommandé de ${num(split[1], fr)} kg.`;
    return rec;
  };

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen ergo-screen" data-testid="ergonomics-screen">
        <div className="wrap">
          <Topbar fr={fr} backTestId="ergo-back-btn" onBack={onClose || (() => { window.location.hash = ''; })}>
            <span className="pill">Enterprise Biomechanics</span>
          </Topbar>

          <p className="eyebrow" data-reveal style={{ '--i': 0 }}>{fr ? 'Ergonomie au Travail (NIOSH)' : 'Workplace Ergonomics (NIOSH)'}</p>
          <h1 className="title" data-reveal style={{ '--i': 0 }}>{fr ? 'Équation de Levage NIOSH & Risque Spinal L5/S1' : 'NIOSH Lifting Equation & Spinal L5/S1 Analysis'}</h1>
          <p className="sub" data-reveal style={{ '--i': 1 }}>
            {fr
              ? 'Évaluation objective des charges de manutention, calcul de la Charge Limite Recommandée (RWL) et de l’Indice de Levage (LI). 100 % sur l’appareil pour une conformité totale au RGPD.'
              : 'Objective occupational biomechanics, Recommended Weight Limit (RWL), and Lifting Index (LI). 100% on-device for total privacy and enterprise labor compliance.'}
          </p>

          {/* Enterprise Privacy */}
          <div className="sc-section" data-reveal style={{ '--i': 2 }}>
            <div className="sc-card ergo-privacy">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <div>
                <b>{fr ? 'Conformité Entreprise & Vie Privée des Salariés' : 'Enterprise Privacy & Labor Compliance'}</b>
                <p className="sc-caption">
                  {fr
                    ? 'Aucun visage, flux vidéo ou donnée biométrique n’est transmis au cloud. Tout le calcul squelettique reste confiné dans le navigateur de l’opérateur.'
                    : 'Zero facial data or video footage is uploaded to cloud servers. All skeletal calculations remain isolated within the device.'}
                </p>
              </div>
            </div>
          </div>

          {/* Mode, then the industrial presets */}
          <div className="sc-section ergo-modes" data-reveal style={{ '--i': 3 }}>
            <div className="sc-seg">
              <button type="button" className="press" aria-pressed={activeTab === 'vision'} onClick={() => { hapticLight(); setActiveTab('vision'); }} data-testid="tab-vision">
                {fr ? 'Simulation Squelettique & Vision' : 'Skeletal Vision Simulation'}
              </button>
              <button type="button" className="press" aria-pressed={activeTab === 'hud'} onClick={() => { hapticLight(); setActiveTab('hud'); }} data-testid="tab-hud">
                {fr ? 'Curseurs Manuels HUD' : 'Manual Multipliers HUD'}
              </button>
            </div>
            <div className="sc-rail" role="group" aria-label="NIOSH">
              {INDUSTRIAL_PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className="sc-chip press"
                  aria-pressed={activePreset === p.id}
                  onClick={() => handlePresetSelect(p)}
                  data-testid={`preset-${p.id}`}
                >
                  {fr ? p.labelFr : p.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* The figure, then the figures */}
          <section className="sc-section ergo-hero" data-reveal style={{ '--i': 4 }}>
            {activeTab === 'vision' && (
              <>
                <GroupHead title={fr ? 'Cinématique Squelettique du Manutentionnaire (Plan Sagittal)' : 'Operator Skeletal Sagittal Kinematics'}>
                  <span className="sc-tag ergo-l5s1">L5/S1{fr ? ' :' : ':'} {result.estimatedL5S1CompressionNewtons}{' '}N</span>
                </GroupHead>
                <div className="sc-frame ergo-frame">
                  <canvas ref={canvasRef} className="ergo-skeleton-canvas" />
                </div>
              </>
            )}

            <GroupHead title={fr ? 'Chiffres clés' : 'Key figures'}><DemoTag fr={fr} /></GroupHead>
            <div className="sc-metrics">
              <Metric label={fr ? 'Indice de Levage (LI)' : 'Lifting Index (LI)'} value={num(result.liftingIndexLI, fr)} testId="ergo-li-value">
                <Verdict ok={result.riskCategory === 'safe'}>{fr ? frText(riskText, true) : riskText}</Verdict>
              </Metric>
              <Metric
                label={fr ? 'Charge Max Recommandée (RWL)' : 'Recommended Weight (RWL)'}
                value={num(result.recommendedWeightLimitKg, fr)}
                unit="kg"
                sub={fr ? `Charge réelle : ${loadWeightKg} kg` : `Actual Load: ${loadWeightKg} kg`}
                testId="ergo-rwl-value"
              />
              <Metric
                wide
                label={fr ? 'Compression L5/S1 Estimée' : 'Est. L5/S1 Compression'}
                value={result.estimatedL5S1CompressionNewtons}
                unit="N"
                sub={fr ? 'Limite d’action NIOSH : 3 400 N' : 'NIOSH Action Limit: 3,400 N'}
              >
                <Verdict ok={result.estimatedL5S1CompressionNewtons <= 3400}>{result.estimatedL5S1CompressionNewtons > 3400 ? (fr ? 'Au-dessus de la limite' : 'Above the limit') : (fr ? 'Sous la limite' : 'Under the limit')}</Verdict>
              </Metric>
            </div>
          </section>

          {/* Interactive Sliders */}
          <section className="sc-section ergo-controls">
            <GroupHead title={fr ? 'Paramètres du Poste de Travail' : 'Workstation & Lift Parameters'} />
            <div className="sc-ranges">
              <Range
                label={fr ? 'Poids de la charge' : 'Load Weight'}
                display={`${loadWeightKg} kg`}
                min="5"
                max="45"
                step="1"
                value={loadWeightKg}
                onChange={e => {
                  hapticLight();
                  setLoadWeightKg(parseFloat(e.target.value));
                }}
                testId="slider-load"
              />
              <Range
                label={fr ? 'Portée horizontale (H)' : 'Horizontal Reach (H)'}
                display={`${horizontalDistanceCm} cm`}
                min="25"
                max="65"
                step="1"
                value={horizontalDistanceCm}
                onChange={e => {
                  hapticLight();
                  setHorizontalDistanceCm(parseFloat(e.target.value));
                }}
                testId="slider-h"
              />
              <Range
                label={fr ? 'Hauteur d’origine (V)' : 'Vertical Origin Height (V)'}
                display={`${verticalOriginCm} cm`}
                min="10"
                max="150"
                step="5"
                value={verticalOriginCm}
                onChange={e => {
                  hapticLight();
                  setVerticalOriginCm(parseFloat(e.target.value));
                }}
                testId="slider-v"
              />
              <Range
                label={fr ? 'Angle d’asymétrie / torsion (A)' : 'Twist / Asymmetry Angle (A)'}
                display={`${asymmetryAngleDeg}°`}
                min="0"
                max="90"
                step="5"
                value={asymmetryAngleDeg}
                onChange={e => {
                  hapticLight();
                  setAsymmetryAngleDeg(parseFloat(e.target.value));
                }}
                testId="slider-a"
              />
            </div>
          </section>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <section className="sc-section ergo-recommendations">
              <GroupHead title={fr ? 'Recommandations Ergonomiques Immédiates' : 'Immediate Ergonomic Recommendations'} />
              <ul className="ergo-rec-list">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="sc-text">{advice(rec)}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
