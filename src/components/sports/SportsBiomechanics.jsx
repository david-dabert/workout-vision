import { useState, useRef, useEffect, useMemo } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  calculateGolfXFactor,
  calculateGolfTempo,
  estimateGolfClubheadSpeed,
  calculateTennisTrophyPose,
  calculatePadelBandeja,
  calculateBikeFitKneeAngle,
  calculateBaseballPitchMechanics,
  calculateRowingRhythm,
  calculateSkiingAngulation,
  calculateSwimmingEvf,
} from '../../lib/sports/kinematics';
import {
  drawSportsBiomechanicsSkeleton,
  getLandmarkPresetsForSport,
  extractGolfKinematicsFromLandmarks,
  extractTennisKinematicsFromLandmarks,
  extractBikeFitKinematicsFromLandmarks,
  extractBaseballPitchFromLandmarks,
} from '../../lib/sports/landmarkKinematics';
import { hapticLight } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { RGB, HEX, rgba } from '../experience/palette';
import { Topbar, DemoTag, Verdict, GroupHead, Metric, Range } from '../experience/Showcase';
import { num, frText, reducedMotion, NBSP } from '../experience/showcase-text';
// The screen's own styles. Their import had been replaced by the icons below in d39e945 (13 October), so the screen
// showed unstyled; it now sits in the experience's wrapper and takes its tokens (Showcase.css, design/SYSTEM.md).
import './SportsBiomechanics.css';
const SvgVideo = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;
const SvgCheck = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>;
const SvgSkeleton = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="4" r="2"/><circle cx="6" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/><line x1="12" y1="6" x2="12" y2="15"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="12" y1="15" x2="8" y2="22"/><line x1="12" y1="15" x2="16" y2="22"/></svg>;
const SvgAngle = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 21H3V3"/><path d="M19 5l-16 16"/><path d="M8 21a5 5 0 0 1 5-5"/></svg>;
const SvgDownload = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const SvgLayers = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>;

const BASE_URL = import.meta.env.BASE_URL || '/';

const SPORTS_DEMO_DATA = {
  golf: {
    nameFr: 'Golf PGA Tour (X-Factor & Tempo 3:1)',
    nameEn: 'PGA Tour Golf (X-Factor & 3:1 Tempo)',
    analyzedUrl: `${BASE_URL}demo/sports/golf-demo-analyzed.mp4`,
    rawUrl: `${BASE_URL}demo/sports/golf-demo-raw.mp4`,
    posterUrl: `${BASE_URL}demo/sports/golf-demo-poster.jpg`,
    license: 'CC-BY Tour Slow-Mo',
    metrics: [
      { labelFr: 'X-Factor Stretch', labelEn: 'X-Factor Stretch', val: '43.1°', verdict: 'optimal' },
      { labelFr: 'Ratio Tempo', labelEn: 'Tempo Ratio', val: '3.0:1 (Tour)', verdict: 'optimal' },
      { labelFr: 'Vitesse Club Estimée', labelEn: 'Est. Clubhead Speed', val: '116.4 mph', verdict: 'optimal' },
      { labelFr: 'Rotation Bassin', labelEn: 'Pelvis Turn', val: '41.3°', verdict: 'optimal' },
    ],
    summaryFr: 'Capture cinématique ralenti haute définition : séparation épaule-bassin (X-Factor) de 43.1° et tempo Tour optimal 3.0:1 sur swing complet.',
    summaryEn: 'High-definition slow-motion tracking: shoulder-pelvis separation (X-Factor) of 43.1° and optimal Tour 3.0:1 tempo through full release.',
  },
  tennis: {
    nameFr: 'Service ATP World Tour (Pose Trophée & Chaîne Cinétique)',
    nameEn: 'ATP World Tour Serve (Trophy Pose & Kinetic Chain)',
    analyzedUrl: `${BASE_URL}demo/sports/tennis-demo-analyzed.mp4`,
    rawUrl: `${BASE_URL}demo/sports/tennis-demo-raw.mp4`,
    posterUrl: `${BASE_URL}demo/sports/tennis-demo-poster.jpg`,
    license: 'CC-BY Roddick Model',
    metrics: [
      { labelFr: 'Pose Trophée', labelEn: 'Trophy Pose', val: 'Conforme Tour', valEn: 'Tour Standard', verdict: 'optimal' },
      { labelFr: 'Inclinaison Épaules', labelEn: 'Shoulder Tilt', val: '31.6°', verdict: 'optimal' },
      { labelFr: 'Flexion Genou Arrière', labelEn: 'Rear Knee Flexion', val: '167.1°', verdict: 'optimal' },
      { labelFr: 'Séquençage', labelEn: 'Kinetic Sequencing', val: 'Jambes > Buste > Bras', valEn: 'Legs > Trunk > Arm', verdict: 'optimal' },
    ],
    summaryFr: 'Chaîne cinématique du service d’Andy Roddick : axe d’épaule incliné à 31.6° et flexion du genou arrière synchronisée pour une restitution maximale de puissance.',
    summaryEn: 'Kinetic chain analysis of Andy Roddick service motion: 31.6° shoulder tilt and rear knee flexion synchronized for maximum ground force transfer.',
  },
  padel: {
    nameFr: 'Padel Pro Tour (Bandeja & Suppression de Rebond)',
    nameEn: 'Padel Pro Tour (Bandeja & Glass Rebound Suppression)',
    analyzedUrl: `${BASE_URL}demo/sports/padel-demo-analyzed.mp4`,
    rawUrl: `${BASE_URL}demo/sports/padel-demo-raw.mp4`,
    posterUrl: `${BASE_URL}demo/sports/padel-demo-poster.jpg`,
    license: 'CC-BY Navarro Model',
    metrics: [
      { labelFr: 'Hauteur Contact', labelEn: 'Contact Height', val: '2.21 m', verdict: 'optimal' },
      { labelFr: 'Suppression Rebond', labelEn: 'Glass Suppression', val: '89% (Élite)', valEn: '89% (Elite)', verdict: 'optimal' },
      { labelFr: 'Inclinaison Épaule', labelEn: 'Shoulder Tilt', val: '17.5°', verdict: 'optimal' },
      { labelFr: 'Classification', labelEn: 'Stroke Rating', val: 'Tour Gold Slice', verdict: 'optimal' },
    ],
    summaryFr: 'Bandeja tranchée de Carolina Navarro en fond de court : impact à 2.21 m et écrasement de 89% sur le rebond de vitre pour empêcher la relance adverse.',
    summaryEn: 'Carolina Navarro overhead bandeja slice: 2.21m contact plane height with 89% glass rebound suppression to prevent opponent counters.',
  },
  baseball: {
    nameFr: 'Lancer MLB (Protection Valgus UCL & Normes ASMI)',
    nameEn: 'MLB Pitching (ASMI UCL Valgus Safety)',
    analyzedUrl: `${BASE_URL}demo/sports/baseball-demo-analyzed.mp4`,
    rawUrl: `${BASE_URL}demo/sports/baseball-demo-raw.mp4`,
    posterUrl: `${BASE_URL}demo/sports/baseball-demo-poster.jpg`,
    license: 'CC-BY Bauer Mound',
    metrics: [
      { labelFr: 'Couple UCL Estimé', labelEn: 'Est. UCL Torque', val: '58 Nm (Sécuritaire)', valEn: '58 Nm (Safe)', verdict: 'optimal' },
      { labelFr: 'Flexion Coude', labelEn: 'Elbow Flexion', val: '130.3°', verdict: 'optimal' },
      { labelFr: 'Abduction Épaule', labelEn: 'Shoulder Abduction', val: '16.7°', verdict: 'optimal' },
      { labelFr: 'Profil de Risque', labelEn: 'Risk Profile', val: 'Faible Contrainte Valgus', valEn: 'Low Valgus Stress', verdict: 'optimal' },
    ],
    summaryFr: 'Dynamique de lancer depuis le monticule : contrainte sur le ligament collatéral médial mesurée à 58 Nm, sous la zone de rupture critique ASMI (64 Nm).',
    summaryEn: 'Mound pitching mechanics: medial collateral ligament load tracked at 58 Nm, safely under the critical ASMI injury limit (64 Nm).',
  },
  cycling: {
    nameFr: 'Cyclisme & Étude Posturale 3D (Protocole Holmes PMB)',
    nameEn: '3D Bike Fit Studio (Holmes Protocol BDC Knee)',
    analyzedUrl: `${BASE_URL}demo/sports/cycling-demo-analyzed.mp4`,
    rawUrl: `${BASE_URL}demo/sports/cycling-demo-raw.mp4`,
    posterUrl: `${BASE_URL}demo/sports/cycling-demo-poster.jpg`,
    license: 'CC-BY Tacx Studio',
    metrics: [
      { labelFr: 'Extension Genou PMB', labelEn: 'BDC Knee Extension', val: '115.3°', verdict: 'optimal' },
      { labelFr: 'Hauteur de Selle', labelEn: 'Saddle Height', val: 'Optimale (30° Holmes)', valEn: 'Optimal (30° Holmes)', verdict: 'optimal' },
      { labelFr: 'Buste Aérodynamique', labelEn: 'Aero Trunk Drop', val: '25.3°', verdict: 'optimal' },
      { labelFr: 'Axe de Pédale', labelEn: 'Pedal Spindle', val: 'Verrouillé / Sans Hyperext.', valEn: 'Locked / No Hyperext.', verdict: 'optimal' },
    ],
    summaryFr: 'Session ergonomique en laboratoire sagittal 90° : angle d’extension au point mort bas (115.3° total, 30° Holmes) garantissant puissance maximale et prévention rotulienne.',
    summaryEn: 'Laboratory 90° sagittal bike fit: bottom dead center knee extension (115.3° / 30° Holmes) balancing aerodynamic drag and patellar tendon safety.',
  },
  rowing: {
    nameFr: 'Aviron & Rameur Indoor (Ratio Propulsion/Retour 1:2)',
    nameEn: 'Rowing Ergometer (1:2 Drive-to-Recovery Rhythm)',
    analyzedUrl: `${BASE_URL}demo/sports/rowing-demo-analyzed.mp4`,
    rawUrl: `${BASE_URL}demo/sports/rowing-demo-raw.mp4`,
    posterUrl: `${BASE_URL}demo/sports/rowing-demo-poster.jpg`,
    license: 'CC-BY Ergometer Lab',
    metrics: [
      { labelFr: 'Ratio Rythmique', labelEn: 'Rhythm Ratio', val: '1:2.0 (Or Olympique)', valEn: '1:2.0 (Olympic Gold)', verdict: 'optimal' },
      { labelFr: 'Attaque / Finition', labelEn: 'Catch / Finish Lean', val: '73.6°', verdict: 'optimal' },
      { labelFr: 'Extension Genou', labelEn: 'Knee Extension', val: '52.9°', verdict: 'optimal' },
      { labelFr: 'Phase de Coup', labelEn: 'Stroke Phase', val: 'Attaque (Compression)', valEn: 'Catch (Compression)', verdict: 'optimal' },
    ],
    summaryFr: 'Analyse de cadence sur ergomètre : respect strict du ratio 1:2 entre phase de tirage explosive et phase de récupération fluide.',
    summaryEn: 'Ergometer cadence tracking: strict 1:2 ratio between explosive drive phase and relaxed, controlled recovery slide.',
  },
  skiing: {
    nameFr: 'Ski Alpin & Laboratoire Carving (Angle de Carre & Angulation)',
    nameEn: 'Alpine Skiing Carving Lab (Edge Angle & Knee Angulation)',
    analyzedUrl: `${BASE_URL}demo/sports/skiing-demo-analyzed.mp4`,
    rawUrl: `${BASE_URL}demo/sports/skiing-demo-raw.mp4`,
    posterUrl: `${BASE_URL}demo/sports/skiing-demo-poster.jpg`,
    license: 'CC-BY Slalom Dynamics',
    metrics: [
      { labelFr: 'Angle de Carre', labelEn: 'Ski Edge Angle', val: '54.2°', verdict: 'optimal' },
      { labelFr: 'Angulation Genoux', labelEn: 'Knee Angulation', val: '7.2°', verdict: 'optimal' },
      { labelFr: 'Charge Centrifuge', labelEn: 'Centripetal Load', val: '4.62 G', verdict: 'optimal' },
      { labelFr: 'Modèle Virage', labelEn: 'Turn Carve Model', val: 'Coupe du Monde Optimal', valEn: 'World Cup Optimal', verdict: 'optimal' },
    ],
    summaryFr: 'Descente sur piste en carving de Coupe du Monde : prise de carre incisive à 54.2° soutenant une accélération radiale de 4.62 G sans dérapage.',
    summaryEn: 'World Cup carving dynamics: 54.2° aggressive edge angle sustaining 4.62 G radial acceleration without edge slip.',
  },
  swimming: {
    nameFr: 'Natation Nage Libre & Hydrodynamique (Prise d’Appui EVF)',
    nameEn: 'Freestyle Hydrodynamics (Early Vertical Forearm Catch)',
    analyzedUrl: `${BASE_URL}demo/sports/swimming-demo-analyzed.mp4`,
    rawUrl: `${BASE_URL}demo/sports/swimming-demo-raw.mp4`,
    posterUrl: `${BASE_URL}demo/sports/swimming-demo-poster.jpg`,
    license: 'CC-BY Hydro Dynamics',
    metrics: [
      { labelFr: 'Angle Coude Haut (EVF)', labelEn: 'EVF Catch Angle', val: '162.6°', verdict: 'optimal' },
      { labelFr: 'Roulis Axial Buste', labelEn: 'Axial Body Roll', val: '71.1°', verdict: 'optimal' },
      { labelFr: 'Score Propulsion', labelEn: 'Propulsion Score', val: '94 / 100', verdict: 'optimal' },
      { labelFr: 'Efficacité Traction', labelEn: 'Pull Efficiency', val: 'Coude Haut Or', valEn: 'Gold High Elbow', verdict: 'optimal' },
    ],
    summaryFr: 'Prise d’appui en coude haut (Early Vertical Forearm) à 162.6° et roulis longitudinal coordonné à 71.1° pour une propulsion maximale dans l’axe.',
    summaryEn: 'Early Vertical Forearm (EVF) paddle lock at 162.6° with coordinated 71.1° axial body roll optimizing continuous forward propulsion.',
  },
};

// The sports in the order of the rail; Equitation, a link to its own screen, closes it.
const SPORT_TABS = [
  { key: 'golf', fr: 'Golf (X-Factor & 3:1)', en: 'Golf (X-Factor & 3:1)' },
  { key: 'tennis', fr: 'Tennis (Pose Trophée)', en: 'Tennis (Trophy Pose)' },
  { key: 'padel', fr: 'Padel (Bandeja)', en: 'Padel (Bandeja)' },
  { key: 'baseball', fr: 'Baseball (Stress UCL)', en: 'Baseball (UCL Stress)' },
  { key: 'cycling', fr: 'Cyclisme (Bike Fit)', en: 'Cycling (Bike Fit)' },
  { key: 'rowing', fr: 'Aviron (Ratio 1:2)', en: 'Rowing (1:2 Ratio)' },
  { key: 'skiing', fr: 'Ski Alpin (Carving)', en: 'Alpine Skiing (Carving)' },
  { key: 'swimming', fr: 'Natation (EVF Coude Haut)', en: 'Swimming (EVF Catch)' },
];
const SPORT_NAME = {
  golf: { fr: 'Golf', en: 'Golf' }, tennis: { fr: 'Tennis', en: 'Tennis' }, padel: { fr: 'Padel', en: 'Padel' },
  baseball: { fr: 'Baseball', en: 'Baseball' }, cycling: { fr: 'Cyclisme', en: 'Cycling' }, rowing: { fr: 'Aviron', en: 'Rowing' },
  skiing: { fr: 'Ski alpin', en: 'Alpine skiing' }, swimming: { fr: 'Natation', en: 'Swimming' },
};
// The words for each verdict key of src/lib/sports/kinematics.ts, sport by sport (two sports share 'dropped_elbow'
// and 'too_low' with another meaning): a key is never shown as it is written in the code.
const VERDICT = {
  golf: {
    optimal_tour: { fr: 'Niveau Tour', en: 'Tour level' },
    restricted: { fr: 'Dissociation limitée', en: 'Restricted' },
    excessive: { fr: 'Dissociation excessive', en: 'Excessive' },
    tour_tempo: { fr: 'Tempo Tour', en: 'Tour tempo' },
    quick_rush: { fr: 'Tempo trop rapide', en: 'Tempo too quick' },
    slow_lag: { fr: 'Tempo trop lent', en: 'Tempo too slow' },
  },
  padel: {
    optimal_bandeja: { fr: 'Bandeja maîtrisée', en: 'Sound bandeja' },
    too_high_smash: { fr: 'Trop haut, plutôt un smash', en: 'Too high, closer to a smash' },
    too_low: { fr: 'Impact trop bas', en: 'Contact too low' },
  },
  cycling: {
    optimal: { fr: 'Hauteur correcte', en: 'Height correct' },
    too_high: { fr: 'Selle trop haute', en: 'Saddle too high' },
    too_low: { fr: 'Selle trop basse', en: 'Saddle too low' },
  },
  baseball: {
    optimal_safe: { fr: 'Charge du coude maîtrisée', en: 'Elbow load in range' },
    high_valgus_torque: { fr: 'Contrainte en valgus élevée', en: 'High valgus torque' },
    dropped_elbow: { fr: 'Coude trop bas', en: 'Dropped elbow' },
  },
  rowing: {
    optimal_ratio: { fr: 'Ratio 1:2 respecté', en: 'On the 1:2 ratio' },
    rushed_slide: { fr: 'Retour trop rapide', en: 'Rushed slide' },
    slow_hands: { fr: 'Mains trop lentes', en: 'Slow hands' },
  },
  skiing: {
    optimal_carve: { fr: 'Carving maîtrisé', en: 'Clean carve' },
    under_angulated: { fr: 'Pas assez angulé', en: 'Under-angulated' },
    excessive_banking: { fr: 'Trop incliné', en: 'Over-banked' },
  },
  swimming: {
    optimal_evf: { fr: 'Coude haut en place', en: 'Early vertical forearm' },
    dropped_elbow: { fr: 'Coude qui tombe', en: 'Dropped elbow' },
    flat_roll: { fr: 'Roulis à corriger', en: 'Body roll off' },
  },
};
/** The words of a verdict key in the language asked; an unknown key shows nothing rather than itself. */
const verdictOf = (sport, key, fr) => VERDICT[sport]?.[key]?.[fr ? 'fr' : 'en'] ?? '';
// The comparison of launch monitors, row by row (the words of the table as it was, in French and English).
const MARKET_ROWS = [
  { name: 'TrackMan 4', cost: { fr: '21\u202F995\u00A0€', en: '€21,995' }, sub: { fr: '1\u202F400\u00A0€ / an', en: '€1,400 / year' }, carry: { fr: 'Radar trépied (lourd)', en: 'Tripod radar (heavy)' } },
  { name: 'Foresight GCQuad', cost: { fr: '18\u202F500\u00A0€', en: '€18,500' }, sub: { fr: '1\u202F100\u00A0€ / an', en: '€1,100 / year' }, carry: { fr: 'Bloc 4 caméras', en: '4-camera unit' } },
  { name: 'WorkoutVision Tour', on: true, cost: { fr: '0\u00A0€ (Smartphone)', en: '€0 (Smartphone)' }, sub: { fr: '490\u00A0€ / an (ou 49\u00A0€/mois)', en: '€490 / year (or €49/month)' }, carry: { fr: '100\u202F% Mobile & En Poche', en: '100% Mobile & In Your Pocket' } },
];
const ArrowIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>;

export default function SportsBiomechanics({ onClose, onOpenEquine }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  // The title condenses into the topbar as the page scrolls under it (topbar.js), as on Guide, History and Pro.
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);
  const [reduced] = useState(reducedMotion);

  const [activeSport, setActiveSport] = useState('golf'); // 'golf' | 'tennis' | 'padel' | 'cycling' | 'baseball' | 'rowing' | 'skiing' | 'swimming'
  const [analysisMode, setAnalysisMode] = useState('landmarks'); // 'landmarks' | 'simulation'
  const [selectedPresetId, setSelectedPresetId] = useState('golf_tour_optimal');
  const [copied, setCopied] = useState(false);
  const [demoVideoLayer, setDemoVideoLayer] = useState('analyzed'); // 'analyzed' | 'raw'
  const demoVideoRef = useRef(null);

  const currentDemo = useMemo(() => SPORTS_DEMO_DATA[activeSport] || null, [activeSport]);

  const availablePresets = useMemo(() => getLandmarkPresetsForSport(activeSport), [activeSport]);
  const currentPreset = useMemo(() => {
    return availablePresets.find(p => p.id === selectedPresetId) || availablePresets[0] || null;
  }, [availablePresets, selectedPresetId]);

  useEffect(() => {
    const presets = getLandmarkPresetsForSport(activeSport);
    if (presets.length > 0) {
      setSelectedPresetId(presets[0].id);
    }
  }, [activeSport]);

  // Real Video Upload State
  const fileInputRef = useRef(null);
  const [uploadedVideo, setUploadedVideo] = useState(null);

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

  // Baseball State
  const [baseballShoulderAbduction, setBaseballShoulderAbduction] = useState(92);
  const [baseballElbowFlexion, setBaseballElbowFlexion] = useState(90);

  // Rowing State
  const [rowingDriveMs, setRowingDriveMs] = useState(600);
  const [rowingRecoveryMs, setRowingRecoveryMs] = useState(1200);

  // Skiing State
  const [skiEdgeAngle, setSkiEdgeAngle] = useState(54);
  const [skiKneeAngulation, setSkiKneeAngulation] = useState(24);

  // Swimming State
  const [swimElbowCatch, setSwimElbowCatch] = useState(115);
  const [swimBodyRoll, setSwimBodyRoll] = useState(42);

  const canvasRef = useRef(null);

  // Calculations
  const golfXFactor = useMemo(() => calculateGolfXFactor(shoulderTurn, pelvisTurn), [shoulderTurn, pelvisTurn]);
  const golfTempo = useMemo(() => calculateGolfTempo(backswingMs, downswingMs), [backswingMs, downswingMs]);
  const golfClubSpeed = useMemo(() => estimateGolfClubheadSpeed(1850), []);

  const tennisTrophy = useMemo(() => calculateTennisTrophyPose(tennisShoulderTilt, tennisKneeFlexion), [tennisShoulderTilt, tennisKneeFlexion]);
  const padelBandeja = useMemo(() => calculatePadelBandeja(padelContactHeight, padelShoulderTilt), [padelContactHeight, padelShoulderTilt]);
  const bikeFit = useMemo(() => calculateBikeFitKneeAngle(bdcKneeAngle), [bdcKneeAngle]);
  const baseballPitch = useMemo(() => calculateBaseballPitchMechanics(baseballShoulderAbduction, baseballElbowFlexion), [baseballShoulderAbduction, baseballElbowFlexion]);
  const rowingRhythm = useMemo(() => calculateRowingRhythm(rowingDriveMs, rowingRecoveryMs), [rowingDriveMs, rowingRecoveryMs]);
  const skiing = useMemo(() => calculateSkiingAngulation(skiEdgeAngle, skiKneeAngulation), [skiEdgeAngle, skiKneeAngulation]);
  const swimming = useMemo(() => calculateSwimmingEvf(swimElbowCatch, swimBodyRoll), [swimElbowCatch, swimBodyRoll]);

  const handleVideoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    hapticLight();
    const url = URL.createObjectURL(file);
    setUploadedVideo({ url, name: file.name });
  };

  const handleClearVideo = () => {
    hapticLight();
    if (uploadedVideo?.url) URL.revokeObjectURL(uploadedVideo.url);
    setUploadedVideo(null);
  };

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

    // The frame's well shows through (Showcase.css .sc-frame); the drawing takes the app's palette (palette.js).
    ctx.clearRect(0, 0, width, height);
    const caption = (text) => {
      ctx.fillStyle = rgba(RGB.bone, 0.72);
      ctx.font = '500 12px Geist, system-ui, sans-serif';
      ctx.fillText(text, 16, 24, width - 32);
    };
    const C = fr ? '\u00A0:' : ':';

    if (analysisMode === 'landmarks' && currentPreset) {
      drawSportsBiomechanicsSkeleton(ctx, currentPreset.landmarks, activeSport, width, height);
      return;
    }

    const centerX = width / 2;
    const centerY = height / 2;

    if (activeSport === 'golf') {
      ctx.strokeStyle = rgba(RGB.bone, 0.1);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 70, 0, Math.PI * 2);
      ctx.stroke();

      // Pelvis line (bone)
      const radP = (pelvisTurn * Math.PI) / 180;
      ctx.strokeStyle = rgba(RGB.bone, 0.85);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX - 60 * Math.cos(radP), centerY - 60 * Math.sin(radP));
      ctx.lineTo(centerX + 60 * Math.cos(radP), centerY + 60 * Math.sin(radP));
      ctx.stroke();

      // Shoulder line (lamp)
      const radS = (shoulderTurn * Math.PI) / 180;
      ctx.strokeStyle = HEX.lamp;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX - 75 * Math.cos(radS), centerY - 75 * Math.sin(radS));
      ctx.lineTo(centerX + 75 * Math.cos(radS), centerY + 75 * Math.sin(radS));
      ctx.stroke();

      ctx.fillStyle = HEX.lampHi;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
      ctx.fill();

      caption(fr ? `Séparation X-Factor${C} ${num(golfXFactor.xFactorDeg, fr)}°` : `X-Factor Separation${C} ${golfXFactor.xFactorDeg}°`);
    } else if (activeSport === 'tennis') {
      const tiltRad = (tennisShoulderTilt * Math.PI) / 180;
      ctx.strokeStyle = HEX.lamp;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX - 70, centerY + 70 * Math.sin(tiltRad));
      ctx.lineTo(centerX + 70, centerY - 70 * Math.sin(tiltRad));
      ctx.stroke();

      ctx.strokeStyle = rgba(RGB.bone, 0.85);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX - 30, centerY + 50, 35, 0, (tennisKneeFlexion * Math.PI) / 180);
      ctx.stroke();

      caption(fr ? `Inclinaison des épaules${C} ${tennisShoulderTilt}° · flexion du genou${C} ${tennisKneeFlexion}°` : `Shoulder Tilt${C} ${tennisShoulderTilt}° · Knee Flexion${C} ${tennisKneeFlexion}°`);
    } else if (activeSport === 'padel') {
      ctx.strokeStyle = HEX.lamp;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(centerX - 80, centerY - 30);
      ctx.lineTo(centerX + 80, centerY - 30 + (padelShoulderTilt * 1.5));
      ctx.stroke();

      ctx.fillStyle = rgba(RGB.bone, 0.9);
      ctx.beginPath();
      ctx.arc(centerX - 20, centerY - 30, 8, 0, Math.PI * 2);
      ctx.fill();

      caption(fr ? `Impact${C} ${num(padelContactHeight, fr)}\u00A0m · suppression du rebond${C} ${padelBandeja.reboundSuppressionIndex}\u202F%` : `Bandeja Contact${C} ${padelContactHeight}\u00A0m (${padelBandeja.reboundSuppressionIndex}% Glass Suppression)`);
    } else if (activeSport === 'cycling') {
      const kneeRad = (bdcKneeAngle * Math.PI) / 180;
      ctx.strokeStyle = bikeFit.saddleHeightVerdict === 'optimal' ? rgba(RGB.bone, 0.85) : HEX.lamp;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX - 40, centerY - 50);
      ctx.lineTo(centerX, centerY + 20);
      ctx.lineTo(centerX + 50 * Math.cos(kneeRad), centerY + 20 + 50 * Math.sin(kneeRad));
      ctx.stroke();

      caption(fr ? `Angle du genou au PMB${C} ${bdcKneeAngle}° (${verdictOf('cycling', bikeFit.saddleHeightVerdict, fr)})` : `BDC Knee Extension${C} ${bdcKneeAngle}° (${verdictOf('cycling', bikeFit.saddleHeightVerdict, fr)})`);
    } else if (activeSport === 'baseball') {
      // Draw Pitching arm valgus vector
      ctx.strokeStyle = baseballPitch.uclSafetyVerdict === 'optimal_safe' ? rgba(RGB.bone, 0.85) : HEX.lamp;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX - 50, centerY + 20);
      ctx.lineTo(centerX, centerY - 30);
      const elbowRad = (baseballPitch.elbowFlexionDeg * Math.PI) / 180;
      ctx.lineTo(centerX + 60 * Math.cos(elbowRad), centerY - 30 - 60 * Math.sin(elbowRad));
      ctx.stroke();

      caption(fr ? `Épaule${C} ${num(baseballPitch.shoulderAbductionDeg, fr)}° · coude${C} ${num(baseballPitch.elbowFlexionDeg, fr)}° (UCL${C} ${num(baseballPitch.estimatedUclStressNm, fr)}\u00A0Nm)` : `Shoulder${C} ${baseballPitch.shoulderAbductionDeg}° · Elbow${C} ${baseballPitch.elbowFlexionDeg}° (UCL${C} ${baseballPitch.estimatedUclStressNm}\u00A0Nm)`);
    } else if (activeSport === 'skiing') {
      // Ski Carving Angulation vector
      ctx.strokeStyle = skiing.verdict === 'optimal_carve' ? rgba(RGB.bone, 0.85) : HEX.lamp;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 50);
      const kneeRad = ((90 - skiKneeAngulation) * Math.PI) / 180;
      ctx.lineTo(centerX + 35 * Math.cos(kneeRad), centerY + 15);
      const edgeRad = ((90 - skiEdgeAngle) * Math.PI) / 180;
      ctx.lineTo(centerX + 35 * Math.cos(kneeRad) + 50 * Math.cos(edgeRad), centerY + 15 + 50 * Math.sin(edgeRad));
      ctx.stroke();

      caption(fr ? `Carving${C} carre à ${skiEdgeAngle}° · ${num(skiing.gForceEst, fr)}\u00A0G (${verdictOf('skiing', skiing.verdict, fr)})` : `Ski Carving${C} ${skiEdgeAngle}° edge · ${skiing.gForceEst}\u00A0G (${verdictOf('skiing', skiing.verdict, fr)})`);
    } else if (activeSport === 'swimming') {
      // Swimming EVF Catch vector
      ctx.strokeStyle = swimming.verdict === 'optimal_evf' ? rgba(RGB.bone, 0.85) : HEX.lamp;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(centerX - 60, centerY - 10);
      ctx.lineTo(centerX, centerY - 25);
      const catchRad = (swimming.elbowCatchAngleDeg * Math.PI) / 180;
      ctx.lineTo(centerX + 45 * Math.sin(catchRad), centerY - 25 + 45 * Math.cos(catchRad));
      ctx.stroke();

      caption(fr ? `EVF${C} coude à ${swimElbowCatch}° · roulis${C} ${swimBodyRoll}° (${verdictOf('swimming', swimming.verdict, fr)})` : `Swimming EVF${C} ${swimElbowCatch}° elbow · Roll${C} ${swimBodyRoll}° (${verdictOf('swimming', swimming.verdict, fr)})`);
    } else {
      // Rowing Drive / Recovery bar
      const totalCycle = (rowingDriveMs + rowingRecoveryMs) || 1;
      const driveW = (rowingDriveMs / totalCycle) * (width - 40);
      const recovW = (rowingRecoveryMs / totalCycle) * (width - 40);

      ctx.fillStyle = HEX.lamp;
      ctx.fillRect(20, centerY - 20, driveW, 40);
      ctx.fillStyle = rgba(RGB.bone, 0.28);
      ctx.fillRect(20 + driveW, centerY - 20, recovW, 40);

      ctx.font = '600 11px Geist, system-ui, sans-serif';
      ctx.fillStyle = rgba(RGB.void, 0.9);
      ctx.fillText(fr ? `Propulsion ${rowingDriveMs}\u00A0ms` : `Drive ${rowingDriveMs}\u00A0ms`, 25, centerY + 5, Math.max(0, driveW - 10));
      ctx.fillStyle = rgba(RGB.bone, 0.95);
      ctx.fillText(fr ? `Retour ${rowingRecoveryMs}\u00A0ms` : `Recovery ${rowingRecoveryMs}\u00A0ms`, 25 + driveW + 10, centerY + 5, Math.max(0, recovW - 20));

      caption(fr ? `Rythme${C} 1:${num(rowingRhythm.rhythmRatio, fr)} (${verdictOf('rowing', rowingRhythm.verdict, fr)})` : `Rowing Rhythm${C} 1:${rowingRhythm.rhythmRatio} (${verdictOf('rowing', rowingRhythm.verdict, fr)})`);
    }
  }, [fr, analysisMode, currentPreset, activeSport, golfXFactor, tennisShoulderTilt, tennisKneeFlexion, padelContactHeight, padelShoulderTilt, padelBandeja, bdcKneeAngle, bikeFit, pelvisTurn, shoulderTurn, baseballPitch, rowingRhythm, rowingDriveMs, rowingRecoveryMs, skiing, swimming, skiEdgeAngle, skiKneeAngulation, swimElbowCatch, swimBodyRoll]);

  const handleCopyReport = () => {
    hapticLight();
    const text = `=== WorkoutVision Precision Sports Biomechanics ===\n` +
      `Sport: ${activeSport.toUpperCase()}\n` +
      (activeSport === 'golf' ? `X-Factor: ${golfXFactor.xFactorDeg}° (${verdictOf('golf', golfXFactor.xFactorRating, false)}) | Tempo: ${golfTempo.tempoRatio}:1 (${verdictOf('golf', golfTempo.tempoRating, false)}) | Est. Speed: ${golfClubSpeed} mph\n` : '') +
      (activeSport === 'tennis' ? `Trophy Pose: ${tennisTrophy.isTrophyPoseSound ? 'Sound' : 'Asymmetric'} | Shoulder Tilt: ${tennisTrophy.shoulderTiltDeg}° | Knee Flexion: ${tennisTrophy.rearKneeFlexionDeg}°\n` : '') +
      (activeSport === 'padel' ? `Bandeja Contact: ${padelBandeja.contactHeightMeters}m | Rating: ${verdictOf('padel', padelBandeja.verdict, false)} | Glass Suppression: ${padelBandeja.reboundSuppressionIndex}%\n` : '') +
      (activeSport === 'cycling' ? `Bike Fit BDC Knee: ${bikeFit.bdcKneeAngleDeg}° | Verdict: ${verdictOf('cycling', bikeFit.saddleHeightVerdict, false)}\n` : '') +
      (activeSport === 'baseball' ? `Pitching UCL Safety: ${verdictOf('baseball', baseballPitch.uclSafetyVerdict, false)} | Shoulder: ${baseballPitch.shoulderAbductionDeg}° | Elbow: ${baseballPitch.elbowFlexionDeg}° | Stress: ${baseballPitch.estimatedUclStressNm} Nm\n` : '') +
      (activeSport === 'rowing' ? `Rowing Rhythm: 1:${rowingRhythm.rhythmRatio} (${verdictOf('rowing', rowingRhythm.verdict, false)}) | Drive: ${rowingDriveMs}ms | Recovery: ${rowingRecoveryMs}ms\n` : '') +
      (activeSport === 'skiing' ? `Ski Carving: ${skiing.edgeAngleDeg}° edge | Angulation: ${skiing.kneeAngulationDeg}° | G-Force: ${skiing.gForceEst}G (${verdictOf('skiing', skiing.verdict, false)})\n` : '') +
      (activeSport === 'swimming' ? `Swimming EVF: ${swimming.elbowCatchAngleDeg}° catch | Roll: ${swimming.bodyRollDeg}° | Propulsion: ${swimming.propulsionScore}/100 (${verdictOf('swimming', swimming.verdict, false)})\n` : '') +
      `Processing: 100% On-Device Neural Vision | Zero Telemetry Leaks.`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // The simulator of the sport on show: its group's name and tags, its values and its sliders. The values are those
  // of src/lib/sports/kinematics.ts for the sliders' positions, never of the person's video: the group carries Demo.
  const deg = (v) => num(v, fr);
  const pct = (v) => `${num(v, fr)}${fr ? '\u202F' : ''}%`;
  const ms = (v) => `${v}${NBSP}ms`;
  const sim = {
    golf: {
      testId: 'card-golf-metrics',
      title: fr ? 'Indicateurs PGA Tour' : 'PGA Tour Kinematic Markers',
      tag: <span className="sc-tag is-on">Tour Model</span>,
      metrics: [
        { label: 'X-Factor Stretch', value: deg(golfXFactor.xFactorDeg), unit: '°', verdict: { ok: golfXFactor.xFactorRating === 'optimal_tour', text: verdictOf('golf', golfXFactor.xFactorRating, fr) } },
        { label: fr ? 'Ratio de Tempo' : 'Swing Tempo', value: `${num(golfTempo.tempoRatio, fr)}:1`, verdict: { ok: golfTempo.tempoRating === 'tour_tempo', text: verdictOf('golf', golfTempo.tempoRating, fr) } },
        { label: fr ? 'Vitesse Club Estimée' : 'Est. Clubhead Speed', value: num(golfClubSpeed, fr), unit: 'mph', verdict: { ok: true, text: fr ? 'Driver niveau Tour' : 'Tour Driver' } },
      ],
      ranges: [
        { label: fr ? 'Rotation Épaules' : 'Shoulder Turn', display: `${shoulderTurn}°`, min: 60, max: 120, value: shoulderTurn, set: setShoulderTurn },
        { label: fr ? 'Rotation Bassin' : 'Pelvis Turn', display: `${pelvisTurn}°`, min: 25, max: 65, value: pelvisTurn, set: setPelvisTurn },
        { label: fr ? 'Durée Backswing' : 'Backswing Time', display: ms(backswingMs), min: 400, max: 1000, step: 25, value: backswingMs, set: setBackswingMs },
        { label: fr ? 'Durée Downswing' : 'Downswing Time', display: ms(downswingMs), min: 180, max: 350, step: 10, value: downswingMs, set: setDownswingMs },
      ],
    },
    tennis: {
      testId: 'card-tennis-metrics',
      title: fr ? 'Service & Chaîne Cinétique' : 'Serve Kinetic Chain & Trophy Pose',
      tag: <Verdict ok={tennisTrophy.isTrophyPoseSound}>{tennisTrophy.isTrophyPoseSound ? (fr ? 'Pose trophée solide' : 'Sound Pose') : (fr ? 'Pose trophée à revoir' : 'Sub-Optimal')}</Verdict>,
      metrics: [
        { label: fr ? 'Inclinaison Épaules' : 'Shoulder Tilt', value: deg(tennisTrophy.shoulderTiltDeg), unit: '°' },
        { label: fr ? 'Flexion Genou Arrière' : 'Rear Knee Flexion', value: deg(tennisTrophy.rearKneeFlexionDeg), unit: '°' },
      ],
      ranges: [
        { label: fr ? 'Inclinaison Épaules' : 'Shoulder Tilt', display: `${tennisShoulderTilt}°`, min: 10, max: 45, value: tennisShoulderTilt, set: setTennisShoulderTilt },
        { label: fr ? 'Flexion Genou Arrière' : 'Rear Knee Flexion', display: `${tennisKneeFlexion}°`, min: 80, max: 140, value: tennisKneeFlexion, set: setTennisKneeFlexion },
      ],
    },
    padel: {
      testId: 'card-padel-metrics',
      title: fr ? 'Bandeja & Contrôle de Rebond' : 'Bandeja Mechanics & Rebound Suppression',
      tag: <Verdict ok={padelBandeja.verdict === 'optimal_bandeja'}>{verdictOf('padel', padelBandeja.verdict, fr)}</Verdict>,
      metrics: [
        { label: fr ? 'Hauteur d’Impact' : 'Contact Height', value: num(padelBandeja.contactHeightMeters, fr), unit: 'm' },
        { label: fr ? 'Suppression Rebond Vitre' : 'Glass Rebound Control', value: pct(padelBandeja.reboundSuppressionIndex) },
      ],
      ranges: [
        { label: fr ? 'Hauteur d’Impact' : 'Contact Height', display: `${num(padelContactHeight, fr)}${NBSP}m`, min: 1.6, max: 2.7, step: 0.05, value: padelContactHeight, set: setPadelContactHeight },
        { label: fr ? 'Inclinaison Latérale' : 'Lateral Tilt', display: `${padelShoulderTilt}°`, min: 5, max: 35, value: padelShoulderTilt, set: setPadelShoulderTilt },
      ],
    },
    baseball: {
      testId: 'card-baseball-metrics',
      title: fr ? 'Lancer & Prévention Valgus UCL' : 'Pitching Mechanics & UCL Torque Protection',
      tag: <Verdict ok={baseballPitch.uclSafetyVerdict === 'optimal_safe'}>{verdictOf('baseball', baseballPitch.uclSafetyVerdict, fr)}</Verdict>,
      metrics: [
        { label: fr ? 'Abduction Épaule' : 'Shoulder Abduction', value: deg(baseballPitch.shoulderAbductionDeg), unit: '°' },
        { label: fr ? 'Flexion Coude' : 'Elbow Flexion', value: deg(baseballPitch.elbowFlexionDeg), unit: '°' },
        { label: fr ? 'Torque UCL Estimé' : 'Est. UCL Torque', value: num(baseballPitch.estimatedUclStressNm, fr), unit: 'Nm' },
      ],
      ranges: [
        { label: fr ? 'Abduction Épaule' : 'Shoulder Abduction', display: `${baseballShoulderAbduction}°`, min: 65, max: 115, value: baseballShoulderAbduction, set: setBaseballShoulderAbduction },
        { label: fr ? 'Flexion Coude' : 'Elbow Flexion', display: `${baseballElbowFlexion}°`, min: 60, max: 125, value: baseballElbowFlexion, set: setBaseballElbowFlexion },
      ],
    },
    cycling: {
      testId: 'card-cycling-metrics',
      title: fr ? 'Étude Posturale Bike Fit' : 'Bike Fit & Knee Kinematics',
      tag: <Verdict ok={bikeFit.saddleHeightVerdict === 'optimal'}>{verdictOf('cycling', bikeFit.saddleHeightVerdict, fr)}</Verdict>,
      metrics: [
        { label: fr ? 'Angle Genou au PMB' : 'BDC Knee Extension', value: deg(bikeFit.bdcKneeAngleDeg), unit: '°' },
        { label: fr ? 'Diagnostic Selle' : 'Saddle Diagnosis', value: verdictOf('cycling', bikeFit.saddleHeightVerdict, fr), text: true },
      ],
      ranges: [
        { label: fr ? 'Angle Genou PMB' : 'BDC Knee Angle', display: `${bdcKneeAngle}°`, min: 15, max: 48, value: bdcKneeAngle, set: setBdcKneeAngle },
      ],
    },
    rowing: {
      testId: 'card-rowing-metrics',
      title: fr ? 'Régularité & Cadence Aviron' : 'Rowing Ergometer Rhythm Ratio',
      tag: <Verdict ok={rowingRhythm.verdict === 'optimal_ratio'}>{verdictOf('rowing', rowingRhythm.verdict, fr)}</Verdict>,
      metrics: [
        { label: fr ? 'Ratio Rythme' : 'Rhythm Ratio', value: `1:${num(rowingRhythm.rhythmRatio, fr)}` },
        { label: fr ? 'Temps Propulsion' : 'Drive Time', value: rowingDriveMs, unit: 'ms' },
        { label: fr ? 'Temps Retour' : 'Recovery Time', value: rowingRecoveryMs, unit: 'ms' },
      ],
      ranges: [
        { label: fr ? 'Durée Propulsion' : 'Drive Duration', display: ms(rowingDriveMs), min: 400, max: 900, step: 25, value: rowingDriveMs, set: setRowingDriveMs },
        { label: fr ? 'Durée Retour' : 'Recovery Duration', display: ms(rowingRecoveryMs), min: 800, max: 1800, step: 50, value: rowingRecoveryMs, set: setRowingRecoveryMs },
      ],
    },
    skiing: {
      testId: 'card-skiing-metrics',
      title: fr ? 'Cinématique Carving & Angulation Ski' : 'Alpine Skiing Carving & Angulation',
      tag: <Verdict ok={skiing.verdict === 'optimal_carve'}>{verdictOf('skiing', skiing.verdict, fr)}</Verdict>,
      metrics: [
        { label: fr ? 'Angle de Carres' : 'Edge Angle', value: deg(skiing.edgeAngleDeg), unit: '°' },
        { label: fr ? 'Angulation Genoux' : 'Knee Angulation', value: deg(skiing.kneeAngulationDeg), unit: '°' },
        { label: fr ? 'Force G Estimée' : 'Est. G-Force', value: num(skiing.gForceEst, fr), unit: 'G' },
      ],
      ranges: [
        { label: fr ? 'Angle de Carres' : 'Edge Angle', display: `${skiEdgeAngle}°`, min: 25, max: 72, value: skiEdgeAngle, set: setSkiEdgeAngle },
        { label: fr ? 'Angulation Genoux' : 'Knee Angulation', display: `${skiKneeAngulation}°`, min: 10, max: 35, value: skiKneeAngulation, set: setSkiKneeAngulation },
      ],
    },
    swimming: {
      testId: 'card-swimming-metrics',
      title: fr ? 'Hydrodynamique & Prise d’Appui EVF' : 'Swimming Hydrodynamics & EVF Catch',
      tag: <Verdict ok={swimming.verdict === 'optimal_evf'}>{verdictOf('swimming', swimming.verdict, fr)}</Verdict>,
      metrics: [
        { label: fr ? 'Angle Coude Haut (EVF)' : 'EVF Catch Angle', value: deg(swimming.elbowCatchAngleDeg), unit: '°' },
        { label: fr ? 'Roulis Axial du Corps' : 'Body Roll Angle', value: deg(swimming.bodyRollDeg), unit: '°' },
        { label: fr ? 'Score Propulsion' : 'Propulsion Score', value: `${swimming.propulsionScore}/100` },
      ],
      ranges: [
        { label: fr ? 'Flexion Coude EVF' : 'EVF Elbow Angle', display: `${swimElbowCatch}°`, min: 85, max: 140, value: swimElbowCatch, set: setSwimElbowCatch },
        { label: fr ? 'Roulis du Corps' : 'Body Roll', display: `${swimBodyRoll}°`, min: 20, max: 65, value: swimBodyRoll, set: setSwimBodyRoll },
      ],
    },
  }[activeSport];

  const presetLabel = (v) => (v === 'optimal'
    ? (fr ? 'Modèle Optimal Tour' : 'Tour Gold Standard')
    : v === 'warning'
    ? (fr ? 'Risque d’Inefficacité' : 'Sub-optimal Mechanics')
    : (fr ? 'Risque Lésionnel Élevé' : 'High Injury Risk'));
  const dotOf = (v) => (v === 'optimal' ? 'is-good' : v === 'warning' ? 'is-warn' : 'is-alert');
  const sportName = SPORT_NAME[activeSport]?.[fr ? 'fr' : 'en'] ?? '';
  const head = { system: fr ? 'Solution' : 'System', cost: fr ? 'Coût Matériel' : 'Hardware Cost', sub: fr ? 'Abonnement / An' : 'Software / Year', carry: fr ? 'Portabilité' : 'Portability' };

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen sports-screen" data-testid="sports-biomechanics-screen">
        <div className="wrap">
          {/* Hidden File Input for Real Athlete Video Upload */}
          <input
            type="file"
            ref={fileInputRef}
            accept="video/*"
            style={{ display: 'none' }}
            onChange={handleVideoUpload}
            data-testid="sports-video-input"
          />

          <Topbar
            fr={fr}
            backTestId="sports-back-btn"
            onBack={() => {
              hapticLight();
              if (onClose) onClose();
              else window.location.hash = '';
            }}
          >
            <span className="pill">Tour AI</span>
          </Topbar>

          <p className="eyebrow" data-reveal style={{ '--i': 0 }}>{fr ? 'Sports de Précision' : 'Precision Sports Lab'}</p>
          <h1 className="title" data-reveal style={{ '--i': 0 }}>{fr ? 'Cinématique Avancée pour Sports de Haut Niveau' : 'High-Performance Sports Biomechanics Studio'}</h1>
          <p className="sub" data-reveal style={{ '--i': 1 }}>
            {fr
              ? 'Analyse cinématique sur l’appareil pour le golf, le tennis, le padel, le baseball et le cyclisme. Mesurez l’angle X-Factor, le ratio de tempo 3:1, la pose trophée et le stress du coude UCL avec votre caméra sans matériel supplémentaire.'
              : 'On-device kinematic analysis for golf, tennis, padel, baseball, and cycling. Quantify Tour-standard X-Factor stretch, 3:1 tempo ratio, serve kinetic sequencing, and UCL valgus protection with pure computer vision.'}
          </p>
          <div className="sc-actions" data-reveal style={{ '--i': 2 }}>
            <button type="button" className="btn-ghost is-s press" onClick={() => fileInputRef.current?.click()} data-testid="sports-upload-btn">
              <SvgVideo />{fr ? 'Analyser Vidéo' : 'Analyze Video'}
            </button>
            <button type="button" className="btn-ghost is-s press" onClick={handleCopyReport} data-testid="sports-copy-report">
              {copied ? <><SvgCheck />{fr ? 'Copié' : 'Copied'}</> : (fr ? 'Copier Bilan' : 'Copy Report')}
            </button>
          </div>

          {/* The visitor's own video, played as it is */}
          {uploadedVideo && (
            <div className="sc-section" data-testid="sports-uploaded-card">
              <div className="sc-file">
                <span className="sc-file-name"><SvgVideo /><span>{uploadedVideo.name}</span></span>
                <button type="button" className="btn-ghost is-s press" onClick={handleClearVideo}>
                  {fr ? 'Fermer la vidéo' : 'Close Video'}
                </button>
              </div>
              <div className="sc-frame">
                <video src={uploadedVideo.url} controls playsInline />
              </div>
            </div>
          )}

          {/* The sports, one rail */}
          <div className="sc-section sports-rail-section" data-reveal style={{ '--i': 3 }}>
            <div className="sc-rail" role="group" aria-label="Sports">
              {SPORT_TABS.map(t => (
                <button
                  key={t.key}
                  type="button"
                  className="sc-chip press"
                  aria-pressed={activeSport === t.key}
                  onClick={() => { hapticLight(); setActiveSport(t.key); }}
                  data-testid={`tab-${t.key}`}
                >
                  {fr ? t.fr : t.en}
                </button>
              ))}
              {onOpenEquine && (
                <button
                  type="button"
                  className="sc-chip press"
                  onClick={() => { hapticLight(); onOpenEquine(); }}
                  data-testid="tab-equine-link"
                >
                  {fr ? 'Équitation (EquiVision)' : 'Equestrian (EquiVision)'}<ArrowIcon />
                </button>
              )}
            </div>
          </div>

          {/* The sport's hero: its demonstration video, then its figures */}
          {currentDemo && (
            <section className="sc-section sports-hero" data-testid="sports-demo-player-card" data-reveal style={{ '--i': 4 }}>
              <div className="sc-name-row">
                <h2 className="sc-name">{fr ? currentDemo.nameFr : currentDemo.nameEn}</h2>
                <span className="sc-tag">{currentDemo.license}</span>
              </div>
              <div className="sc-frame">
                <video
                  key={`${activeSport}-${demoVideoLayer}`}
                  ref={demoVideoRef}
                  src={demoVideoLayer === 'analyzed' ? currentDemo.analyzedUrl : currentDemo.rawUrl}
                  poster={currentDemo.posterUrl}
                  controls
                  playsInline
                  autoPlay={!reduced}
                  muted
                  loop
                  className="sports-demo-video"
                  data-testid="sports-demo-player"
                />
              </div>
              <p className={`sc-frame-note${demoVideoLayer === 'raw' ? ' is-quiet' : ''}`}>
                {demoVideoLayer === 'analyzed'
                  ? frText(fr ? 'Biométrie HUD IA · 100% Sur l’Appareil' : 'Tour HUD Biometrics · 100% On-Device', fr)
                  : (fr ? 'Vidéo Source Réelle HD' : 'Real HD Source Footage')}
              </p>
              <div className="sc-seg">
                <button
                  type="button"
                  className="press"
                  aria-pressed={demoVideoLayer === 'analyzed'}
                  onClick={() => { hapticLight(); setDemoVideoLayer('analyzed'); }}
                  data-testid="sports-demo-mode-analyzed"
                >
                  <SvgLayers />{fr ? 'IA HUD Tour (Overlay)' : 'Tour HUD AI (Overlay)'}
                </button>
                <button
                  type="button"
                  className="press"
                  aria-pressed={demoVideoLayer === 'raw'}
                  onClick={() => { hapticLight(); setDemoVideoLayer('raw'); }}
                  data-testid="sports-demo-mode-raw"
                >
                  {fr ? 'Vidéo Brute HD' : 'Raw HD Video'}
                </button>
              </div>
              <p className="sc-caption">{fr ? frText(currentDemo.summaryFr, true) : currentDemo.summaryEn}</p>
              <a
                href={demoVideoLayer === 'analyzed' ? currentDemo.analyzedUrl : currentDemo.rawUrl}
                download={`workoutvision-${activeSport}-${demoVideoLayer}.mp4`}
                className="btn-ghost is-s press sports-download"
                data-testid="demo-download-btn"
              >
                <SvgDownload />{fr ? 'Télécharger MP4' : 'Download MP4'}
              </a>

              <GroupHead title={fr ? 'Chiffres clés' : 'Key figures'}><DemoTag fr={fr} /></GroupHead>
              <div className="sc-metrics" data-testid="demo-telemetry-strip">
                {currentDemo.metrics.map((m, idx) => {
                  const value = fr ? frText(m.val, true) : (m.valEn || m.val);
                  return <Metric key={idx} label={fr ? m.labelFr : m.labelEn} value={value} text={!/^\d/.test(value)} />;
                })}
              </div>
            </section>
          )}

          {/* The simulator: the skeleton or the angles, the values, the sliders */}
          {sim && (
            <section className="sc-section sports-sim" data-testid={sim.testId}>
              <GroupHead title={sim.title}>{sim.tag}<DemoTag fr={fr} /></GroupHead>

              {availablePresets.length > 0 && (
                <div className="sc-seg" data-testid="sports-mode-bar">
                  <button
                    type="button"
                    className="press"
                    aria-pressed={analysisMode === 'landmarks'}
                    onClick={() => { hapticLight(); setAnalysisMode('landmarks'); }}
                    data-testid="mode-landmarks"
                  >
                    <SvgSkeleton />{fr ? 'Squelette Vectoriel 3D' : '3D Vector Skeleton'}
                  </button>
                  <button
                    type="button"
                    className="press"
                    aria-pressed={analysisMode === 'simulation'}
                    onClick={() => { hapticLight(); setAnalysisMode('simulation'); }}
                    data-testid="mode-simulation"
                  >
                    <SvgAngle />{fr ? 'Simulateur d’Angles' : 'Angle Simulator'}
                  </button>
                </div>
              )}

              <div className="sc-frame is-chart">
                <canvas ref={canvasRef} className="sports-canvas" />
              </div>

              {analysisMode === 'landmarks' && availablePresets.length > 0 && currentPreset && (
                <div className="sports-presets" data-testid="sports-preset-section">
                  <div className="sc-chips">
                    {availablePresets.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        className="sc-chip press"
                        aria-pressed={selectedPresetId === preset.id}
                        onClick={() => { hapticLight(); setSelectedPresetId(preset.id); }}
                        data-testid={`preset-${preset.id}`}
                      >
                        <span className={`sc-dot ${dotOf(preset.verdict)}`} />
                        {fr ? preset.nameFr : preset.nameEn}
                      </button>
                    ))}
                  </div>
                  <div className={`sc-card${currentPreset.verdict === 'optimal' ? '' : ' is-on'}`}>
                    <div className="sc-card-top">
                      <Verdict ok={currentPreset.verdict === 'optimal'}>{presetLabel(currentPreset.verdict)}</Verdict>
                      <span className="sc-frame-note is-quiet">{fr ? `${sportName} · cinématique 3D` : `${sportName} · 3D kinematics`}</span>
                    </div>
                    <p className="sc-caption">{fr ? currentPreset.descriptionFr : currentPreset.descriptionEn}</p>
                  </div>
                </div>
              )}

              <div className="sc-metrics">
                {sim.metrics.map((m, i, all) => (
                  <Metric key={m.label} label={m.label} value={m.value} unit={m.unit} text={m.text} wide={i === all.length - 1 && all.length % 2 === 1}>
                    {m.verdict ? <Verdict ok={m.verdict.ok}>{m.verdict.text}</Verdict> : null}
                  </Metric>
                ))}
              </div>

              <div className="sc-ranges">
                {sim.ranges.map(r => (
                  <Range
                    key={r.label}
                    label={r.label}
                    display={r.display}
                    min={r.min}
                    max={r.max}
                    step={r.step}
                    value={r.value}
                    onChange={(e) => r.set(Number(e.target.value))}
                  />
                ))}
              </div>
            </section>
          )}

          {/* What it replaces: the launch monitors, compared */}
          <section className="sc-section sports-market">
            <h2 className="sc-name">{fr ? 'Alternative Portable aux Radars & Systèmes à 20\u00A0000\u00A0€' : 'Portable Alternative to $20,000 Hardware Launch Monitors'}</h2>
            <p className="sc-text">
              {fr
                ? 'Les moniteurs de lancement (TrackMan, GCQuad) et les laboratoires 3D coûtent des dizaines de milliers d’euros. WorkoutVision apporte l’analyse cinématique de grade Tour directement sur votre smartphone en local.'
                : 'Dedicated launch monitors (TrackMan, GCQuad) and motion-capture rigs cost upwards of $20,000. WorkoutVision provides Tour-grade swing and kinetic chain analysis on your phone with zero extra hardware.'}
            </p>
            <table className="sc-table">
              <thead>
                <tr>
                  <th scope="col">{head.system}</th>
                  <th scope="col">{head.cost}</th>
                  <th scope="col">{head.sub}</th>
                  <th scope="col">{head.carry}</th>
                </tr>
              </thead>
              <tbody>
                {MARKET_ROWS.map(r => {
                  const l = fr ? 'fr' : 'en';
                  return (
                    <tr key={r.name} className={r.on ? 'is-on' : undefined}>
                      <td data-label={head.system}>{r.name}</td>
                      <td data-label={head.cost}>{r.cost[l]}</td>
                      <td data-label={head.sub}>{r.sub[l]}</td>
                      <td data-label={head.carry}>{r.carry[l]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
      </section>
    </div>
  );
}
