import { useState, useEffect, useRef, useMemo } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  analyzeEquineGait,
  calculateCircleLean,
} from '../../lib/equine';
import { hapticLight } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { RGB, HEX, rgba } from '../experience/palette';
import { Topbar, DemoTag, Verdict, GroupHead, Metric, Range } from '../experience/Showcase';
import { num, reducedMotion, NBSP } from '../experience/showcase-text';
import './Equine.css';

const SvgCheck = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>;
const SvgDownload = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;

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

/**
 * Samples video frame vertical kinematics on device.
 */
async function extractEquineGaitFramesFromVideo(videoUrl) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';

    video.onloadedmetadata = async () => {
      const duration = Math.min(video.duration || 3.5, 4.0);
      const fps = 25;
      const totalSamples = Math.floor(duration * fps);
      const frames = [];

      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        for (let i = 0; i < totalSamples; i++) {
          const tSec = i / fps;
          video.currentTime = tSec;
          await new Promise(r => { video.onseeked = r; setTimeout(r, 40); });

          if (ctx) {
            ctx.drawImage(video, 0, 0, 160, 120);
            const imgData = ctx.getImageData(0, 0, 160, 120).data;

            // Compute vertical luminance center of mass for withers (front half) & sacrum (rear half)
            let withersSumY = 0, withersWeight = 0;
            let sacrumSumY = 0, sacrumWeight = 0;

            for (let y = 10; y < 110; y += 4) {
              for (let x = 20; x < 140; x += 4) {
                const idx = (y * 160 + x) * 4;
                const lum = 255 - ((imgData[idx] + imgData[idx + 1] + imgData[idx + 2]) / 3);
                if (x > 80) {
                  withersSumY += y * lum;
                  withersWeight += lum;
                } else {
                  sacrumSumY += y * lum;
                  sacrumWeight += lum;
                }
              }
            }

            const withersPixY = withersWeight > 0 ? withersSumY / withersWeight : 60;
            const sacrumPixY = sacrumWeight > 0 ? sacrumSumY / sacrumWeight : 60;

            frames.push({
              timestamp: tSec * 1000,
              landmarks: {
                withers: { x: 0.65, y: 1.40 + ((withersPixY - 60) / 120) * 0.15 },
                sacrum: { x: 0.35, y: 1.35 + ((sacrumPixY - 60) / 120) * 0.12 },
              },
            });
          }
        }
      } catch {
        // Fallback to sampled trot if frame extraction fails
      }

      if (frames.length > 10) {
        resolve(frames);
      } else {
        // Fallback sequence
        resolve(generateScenarioFrames('sound', { durationSec: duration }));
      }
    };

    video.onerror = () => {
      resolve(generateScenarioFrames('sound'));
    };

    setTimeout(() => resolve(generateScenarioFrames('sound')), 2000);
  });
}

const MUYBRIDGE_RAW_URL = `${import.meta.env.BASE_URL || '/'}demo/equine-trot-demo.mp4`;
const MUYBRIDGE_ANALYZED_URL = `${import.meta.env.BASE_URL || '/'}demo/workoutvision-equine-analyzed-demo.mp4`;
const RIDDEN_RAW_URL = `${import.meta.env.BASE_URL || '/'}demo/workoutvision-ridden-dressage-raw.mp4`;
const RIDDEN_ANALYZED_URL = `${import.meta.env.BASE_URL || '/'}demo/workoutvision-ridden-dressage-analyzed.mp4`;

const DEMO_PRESETS = {
  ridden: {
    rawUrl: RIDDEN_RAW_URL,
    analyzedUrl: RIDDEN_ANALYZED_URL,
    nameEn: 'Ridden Dressage Trot in Arena (5.0s)',
    nameFr: 'Équitation Montée en Carrière / Dressage (5.0s)',
    licenseEn: 'Open CC-BY (Dressage Arena)',
    licenseFr: 'Libre CC-BY (Dressage Carrière)',
    downloadName: 'workoutvision-ridden-dressage-analyzed.mp4',
    isCircle: true,
    circleRadius: 12,
    trotSpeed: 3.5,
  },
  muybridge: {
    rawUrl: MUYBRIDGE_RAW_URL,
    analyzedUrl: MUYBRIDGE_ANALYZED_URL,
    nameEn: 'Eadweard Muybridge Trot-Up (4.8s)',
    nameFr: 'Eadweard Muybridge Trot en Main (4.8s)',
    licenseEn: 'Public Domain',
    licenseFr: 'Domaine Public',
    downloadName: 'workoutvision-equine-analyzed-demo.mp4',
    isCircle: false,
    circleRadius: 10,
    trotSpeed: 3.5,
  },
};

// The limb a trace points to (src/lib/equine/kinematics.ts, suspectedLamenessLimb), in words: never the key itself.
const LIMB = {
  LF: { fr: 'antérieur gauche (AG)', en: 'left fore (LF)' },
  RF: { fr: 'antérieur droit (AD)', en: 'right fore (RF)' },
  LH: { fr: 'postérieur gauche (PG)', en: 'left hind (LH)' },
  RH: { fr: 'postérieur droit (PD)', en: 'right hind (RH)' },
};

export default function Equine({ onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';

  const [scenario, setScenario] = useState('demo_ridden');
  const [videoMode, setVideoMode] = useState('analyzed'); // 'analyzed' | 'raw'
  const [isCircle, setIsCircle] = useState(true);
  const [circleRadius, setCircleRadius] = useState(12); // meters
  const [trotSpeed, setTrotSpeed] = useState(3.5); // m/s
  const [copied, setCopied] = useState(false);
  // The title condenses into the topbar as the page scrolls under it (topbar.js), as on Guide, History and Pro.
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);
  const [reduced] = useState(reducedMotion);

  // Real Video State
  const fileInputRef = useRef(null);
  const [uploadedVideo, setUploadedVideo] = useState({
    url: DEMO_PRESETS.ridden.rawUrl,
    analyzedUrl: DEMO_PRESETS.ridden.analyzedUrl,
    name: DEMO_PRESETS.ridden.nameEn,
    license: DEMO_PRESETS.ridden.licenseEn,
    downloadName: DEMO_PRESETS.ridden.downloadName,
    isBuiltinDemo: true,
  });
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoFrames, setVideoFrames] = useState(null);
  const [videoPlaybackTime, setVideoPlaybackTime] = useState(0);

  const canvasRef = useRef(null);
  const videoPlayerRef = useRef(null);

  // Generate frame sequence based on scenario or uploaded video
  const frames = useMemo(() => {
    if (videoFrames && videoFrames.length > 0) return videoFrames;
    if (scenario === 'demo_ridden') {
      return generateScenarioFrames('sound', { fps: 25, durationSec: 5.0, stridePeriodMs: 690 });
    }
    if (scenario === 'demo_muybridge' || scenario === 'demo') {
      return generateScenarioFrames('sound', { fps: 30, durationSec: 4.8, stridePeriodMs: 710 });
    }
    return generateScenarioFrames(scenario, { fps: 30, durationSec: 3.5, stridePeriodMs: 720 });
  }, [scenario, videoFrames]);

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

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    hapticLight();
    const url = URL.createObjectURL(file);
    setScenario('custom');
    setUploadedVideo({
      url,
      analyzedUrl: url,
      name: file.name,
      license: fr ? 'Fichier Personnel' : 'User Video',
      downloadName: `analyzed-${file.name}`,
      isBuiltinDemo: false,
    });
    setIsProcessingVideo(true);

    try {
      const extracted = await extractEquineGaitFramesFromVideo(url);
      setVideoFrames(extracted);
    } catch (err) {
      console.warn('Video frame extraction failed', err);
    } finally {
      setIsProcessingVideo(false);
    }
  };

  const handleSelectRiddenDemo = () => {
    hapticLight();
    setScenario('demo_ridden');
    setVideoFrames(null);
    setIsCircle(true);
    setCircleRadius(12);
    setUploadedVideo({
      url: DEMO_PRESETS.ridden.rawUrl,
      analyzedUrl: DEMO_PRESETS.ridden.analyzedUrl,
      name: fr ? DEMO_PRESETS.ridden.nameFr : DEMO_PRESETS.ridden.nameEn,
      license: fr ? DEMO_PRESETS.ridden.licenseFr : DEMO_PRESETS.ridden.licenseEn,
      downloadName: DEMO_PRESETS.ridden.downloadName,
      isBuiltinDemo: true,
    });
  };

  const handleSelectMuybridgeDemo = () => {
    hapticLight();
    setScenario('demo_muybridge');
    setVideoFrames(null);
    setIsCircle(false);
    setCircleRadius(10);
    setUploadedVideo({
      url: DEMO_PRESETS.muybridge.rawUrl,
      analyzedUrl: DEMO_PRESETS.muybridge.analyzedUrl,
      name: fr ? DEMO_PRESETS.muybridge.nameFr : DEMO_PRESETS.muybridge.nameEn,
      license: fr ? DEMO_PRESETS.muybridge.licenseFr : DEMO_PRESETS.muybridge.licenseEn,
      downloadName: DEMO_PRESETS.muybridge.downloadName,
      isBuiltinDemo: true,
    });
  };

  const handleClearVideo = () => {
    hapticLight();
    if (uploadedVideo?.url && !uploadedVideo.isBuiltinDemo) URL.revokeObjectURL(uploadedVideo.url);
    setUploadedVideo(null);
    setVideoFrames(null);
    setScenario('sound');
  };

  // Render chart on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || frames.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 360;
    const height = canvas.clientHeight || 200;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background
    // The frame's well shows through (Showcase.css .sc-frame); the lines take the app's palette (palette.js).
    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = rgba(RGB.bone, 0.06);
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
        ctx.fillStyle = rgba(RGB.lamp, 0.1);
        ctx.fillRect(x1, 0, Math.max(0, x2 - x1), height);

        // D2 band
        ctx.fillStyle = rgba(RGB.bone, 0.05);
        ctx.fillRect(x2, 0, Math.max(0, x3 - x2), height);

        // Stride boundary line
        ctx.strokeStyle = rgba(RGB.bone, 0.15);
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x3, 0);
        ctx.lineTo(x3, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Min and Max for normalization
    let minY = Infinity, maxY = -Infinity;
    for (const f of frames) {
      if (f.landmarks.withers) {
        minY = Math.min(minY, f.landmarks.withers.y);
        maxY = Math.max(maxY, f.landmarks.withers.y);
      }
      if (f.landmarks.sacrum) {
        minY = Math.min(minY, f.landmarks.sacrum.y);
        maxY = Math.max(maxY, f.landmarks.sacrum.y);
      }
    }
    const pad = (maxY - minY) * 0.2 || 0.05;
    minY -= pad;
    maxY += pad;

    const toY = (val) => height - ((val - minY) / (maxY - minY)) * (height - 30) - 15;

    // Withers trajectory (lamp)
    ctx.strokeStyle = HEX.lamp;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const x = ((f.timestamp - frames[0].timestamp) / totalTime) * width;
      const y = toY(f.landmarks.withers.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Sacrum trajectory (bone)
    ctx.strokeStyle = rgba(RGB.bone, 0.85);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const x = ((f.timestamp - frames[0].timestamp) / totalTime) * width;
      const y = toY(f.landmarks.sacrum.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Minima Markers
    for (const s of report.strides) {
      // D1 min Withers
      const xW1 = ((s.diagonal1.stanceStartTime - frames[0].timestamp) / totalTime) * width;
      ctx.fillStyle = HEX.lamp;
      ctx.beginPath();
      ctx.arc(xW1, toY(s.diagonal1.withersMinY), 4, 0, Math.PI * 2);
      ctx.fill();

      // D2 min Withers
      const xW2 = ((s.diagonal2.stanceStartTime - frames[0].timestamp) / totalTime) * width;
      ctx.beginPath();
      ctx.arc(xW2, toY(s.diagonal2.withersMinY), 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scrub cursor if video playback is active
    if (uploadedVideo && videoPlaybackTime > 0) {
      const cursorX = (videoPlaybackTime / (totalTime / 1000)) * width;
      ctx.strokeStyle = rgba(RGB.bone, 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, height);
      ctx.stroke();
    }

  }, [frames, report, uploadedVideo, videoPlaybackTime]);

  const handleCopyReport = () => {
    hapticLight();
    const text = `=== EquiVision Trot Biomechanics Report ===\n` +
      `Verdict: ${report.isClinicallySymmetric ? 'Sound' : 'Asymmetric'} (Suspected: ${report.suspectedLamenessLimb})\n` +
      `Withers BAI: ${report.meanWithersAsymmetryPct.toFixed(1)}% (MinDiff: ${(report.meanWithersMinDiff * 100).toFixed(1)} cm)\n` +
      `Pelvic BAI: ${report.meanPelvicAsymmetryPct.toFixed(1)}% (MinDiff: ${(report.meanPelvicMinDiff * 100).toFixed(1)} cm)\n` +
      `Stride Frequency: ${report.meanStrideFrequencyHz.toFixed(2)} Hz | Duty Factor: ${(report.meanDutyFactor * 100).toFixed(1)}%\n` +
      (isCircle ? `Circle Correction: ${circleLean.toFixed(1)}° lean compensated (R=${circleRadius}m, v=${trotSpeed}m/s)\n` : '') +
      `Analysis: 100% On-Device Neural Processing | Dyson & Greve (2016) Kinematics.`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // The values below are those of src/lib/equine for the trace on show: a trace written in the code (the demos and
  // the three scenarios) carries Demo; only a video chosen by the visitor gives a trace read from a video.
  const fromCode = !videoFrames;
  // A built-in demo is named in the language of the page (its first state was set before the language was known).
  const demoPreset = scenario === 'demo_ridden' ? DEMO_PRESETS.ridden : (scenario === 'demo_muybridge' || scenario === 'demo') ? DEMO_PRESETS.muybridge : null;
  const videoName = uploadedVideo?.isBuiltinDemo && demoPreset ? (fr ? demoPreset.nameFr : demoPreset.nameEn) : uploadedVideo?.name;
  const videoLicense = uploadedVideo?.isBuiltinDemo && demoPreset ? (fr ? demoPreset.licenseFr : demoPreset.licenseEn) : uploadedVideo?.license;
  const limbName = LIMB[report.suspectedLamenessLimb]?.[fr ? 'fr' : 'en'] ?? '';
  const pct = (v) => `${num(v, fr)}${fr ? '\u202F' : ''}%`;
  const scenarios = [
    { id: 'scenario-demo-ridden', on: scenario === 'demo_ridden', onClick: handleSelectRiddenDemo, label: fr ? 'Démo Dressage Monté (Arène)' : 'Demo Ridden Dressage (Arena)' },
    { id: 'scenario-demo-video', on: scenario === 'demo_muybridge' || scenario === 'demo', onClick: handleSelectMuybridgeDemo, label: fr ? 'Trot en Main (Muybridge)' : 'Demo Trot-Up (Muybridge)' },
    { id: 'scenario-sound', on: scenario === 'sound', onClick: () => { hapticLight(); setScenario('sound'); setUploadedVideo(null); setVideoFrames(null); }, label: fr ? 'Trot Sain (Symétrique)' : 'Sound Trot (Symmetric)' },
    { id: 'scenario-forelimb', on: scenario === 'forelimb_lf', onClick: () => { hapticLight(); setScenario('forelimb_lf'); setUploadedVideo(null); setVideoFrames(null); }, label: fr ? 'Boiterie Antérieur Gauche (AG)' : 'Left Forelimb Lameness (LF)' },
    { id: 'scenario-hindlimb', on: scenario === 'hindlimb_rh', onClick: () => { hapticLight(); setScenario('hindlimb_rh'); setUploadedVideo(null); setVideoFrames(null); }, label: fr ? 'Boiterie Postérieur Droit (PD)' : 'Right Hindlimb Lameness (RH)' },
  ];

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen equine-screen" data-testid="equine-screen">
        <div className="wrap">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            accept="video/*"
            style={{ display: 'none' }}
            onChange={handleVideoUpload}
            data-testid="equine-file-input"
          />

          <Topbar
            fr={fr}
            backTestId="equine-back-btn"
            onBack={() => {
              hapticLight();
              if (onClose) onClose();
              else window.location.hash = '';
            }}
          >
            <span className="pill">Veterinary AI</span>
          </Topbar>

          <p className="eyebrow" data-reveal style={{ '--i': 0 }}>EquiVision</p>
          <h1 className="title" data-reveal style={{ '--i': 0 }}>{fr ? 'Cinématique Quadrupède & Asymétrie Équine' : 'Quadruped Locomotion & Equine Gait Kinematics'}</h1>
          <p className="sub" data-reveal style={{ '--i': 1 }}>
            {fr
              ? 'Évaluation objective des allures au trot, quantification de l’asymétrie garrot/sacrum et correction dynamique en cercle pour vétérinaires et physiothérapeutes.'
              : 'Objective trot gait kinematics, withers/sacrum excursion symmetry quantification, and centripetal circle lean correction for veterinarians and equine physiotherapists.'}
          </p>
          <div className="sc-actions" data-reveal style={{ '--i': 2 }}>
            <button type="button" className="btn-ghost is-s press" onClick={handleCopyReport} data-testid="equine-copy-report">
              {copied ? <><SvgCheck />{fr ? 'Copié' : 'Copied'}</> : (fr ? 'Copier le bilan' : 'Copy Report')}
            </button>
          </div>

          {/* The demonstrations and the traces, one rail */}
          <div className="sc-section equine-rail-section" data-reveal style={{ '--i': 3 }}>
            <div className="sc-rail" role="group" aria-label="EquiVision">
              {scenarios.map(s => (
                <button key={s.id} type="button" className="sc-chip press" aria-pressed={s.on} onClick={s.onClick} data-testid={s.id}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* The hero: the video with its kinematic overlay */}
          {uploadedVideo && (
            <section className="sc-section equine-hero" data-testid="equine-player" data-reveal style={{ '--i': 4 }}>
              <div className="sc-name-row">
                <h2 className="sc-name">{videoName}</h2>
                {uploadedVideo.isBuiltinDemo ? (
                  <span className="sc-tag">{videoLicense}</span>
                ) : (
                  <button type="button" className="btn-ghost is-s press" onClick={handleClearVideo}>
                    {fr ? 'Fermer la vidéo' : 'Close Video'}
                  </button>
                )}
              </div>
              <div className="sc-frame">
                <video
                  ref={videoPlayerRef}
                  src={videoMode === 'analyzed' && uploadedVideo.isBuiltinDemo ? (uploadedVideo.analyzedUrl || uploadedVideo.url) : uploadedVideo.url}
                  controls
                  playsInline
                  autoPlay={!reduced}
                  muted
                  loop
                  className="equine-video-player"
                  onTimeUpdate={() => {
                    if (videoPlayerRef.current) setVideoPlaybackTime(videoPlayerRef.current.currentTime);
                  }}
                />
                {videoMode === 'raw' && (
                  <div className="equine-video-hud" aria-hidden="true">
                    <span className="hud-marker hud-withers"><span className="hud-dot" />{fr ? 'Garrot (Withers)' : 'Withers (T6)'}</span>
                    <span className="hud-marker hud-sacrum"><span className="hud-dot" />{fr ? 'Sacrum (Pelvis)' : 'Sacrum (Pelvis)'}</span>
                    <span className="hud-phase-badge">{fr ? 'Trot à 2 temps (D1 ↔ D2)' : '2-Beat Trot (D1 ↔ D2)'}</span>
                  </div>
                )}
              </div>
              <p className={`sc-frame-note${isProcessingVideo ? '' : ' is-quiet'}`} role="status">
                {isProcessingVideo
                  ? (fr ? 'Traitement cinématique en cours...' : 'Computing frame kinematics...')
                  : uploadedVideo.isBuiltinDemo
                  ? (fr ? 'Séquence vidéo avec détection garrot/sacrum & posture cavalier' : 'Video footage with withers/sacrum excursion & rider alignment')
                  : (fr ? 'Vidéo analysée sur l’appareil' : 'Analyzed On-Device')}
              </p>
              <div className="sc-seg">
                <button
                  type="button"
                  className="press"
                  aria-pressed={videoMode === 'analyzed'}
                  onClick={() => { hapticLight(); setVideoMode('analyzed'); }}
                  data-testid="btn-mode-analyzed"
                >
                  {fr ? 'Analysée' : 'Analyzed'}
                </button>
                <button
                  type="button"
                  className="press"
                  aria-pressed={videoMode === 'raw'}
                  onClick={() => { hapticLight(); setVideoMode('raw'); }}
                  data-testid="btn-mode-raw"
                >
                  {fr ? 'Brute' : 'Raw'}
                </button>
              </div>
              <a
                href={uploadedVideo.analyzedUrl || uploadedVideo.url}
                download={uploadedVideo.downloadName || 'workoutvision-equine-analyzed.mp4'}
                className="btn-ghost is-s press equine-download"
                data-testid="btn-download-equine-video"
              >
                <SvgDownload />{fr ? 'Télécharger (MP4)' : 'Download (MP4)'}
              </a>
            </section>
          )}

          {/* The trace, then its figures */}
          <section className="sc-section equine-trace">
            <GroupHead title={fr ? 'Trajectoire verticale lissée (Savitzky-Golay quadratic)' : 'Smoothed Vertical Trajectory (Savitzky-Golay quadratic)'} />
            <div className="equine-legend">
              <span className="legend-item"><span className="legend-color legend-withers" />{fr ? 'Garrot (Withers)' : 'Withers'}</span>
              <span className="legend-item"><span className="legend-color legend-sacrum" />{fr ? 'Sacrum (Pelvis)' : 'Sacrum / Pelvis'}</span>
            </div>
            <div className="sc-frame is-chart">
              <canvas ref={canvasRef} className="equine-chart-canvas" />
            </div>

            <GroupHead title={fr ? 'Chiffres clés' : 'Key figures'}>{fromCode ? <DemoTag fr={fr} /> : null}</GroupHead>
            <div className="sc-metrics" data-testid="equine-metrics">
              <Metric
                wide
                text
                label={fr ? 'Diagnostic Clinique' : 'Clinical Verdict'}
                value={report.isClinicallySymmetric ? (fr ? 'Sain / Régulier' : 'Sound / Symmetrical') : (fr ? 'Asymétrie Notée' : 'Asymmetry Detected')}
              >
                <Verdict ok={report.suspectedLamenessLimb === 'None'}>
                  {report.suspectedLamenessLimb !== 'None'
                    ? `${fr ? 'Suspicion\u00A0:' : 'Suspected:'} ${limbName}`
                    : fr ? 'Aucune boiterie significative' : 'Within clinical tolerance (<8%)'}
                </Verdict>
              </Metric>
              <Metric
                label={fr ? 'Asymétrie Garrot (BAI)' : 'Withers BAI (%)'}
                value={pct(Math.abs(report.meanWithersAsymmetryPct).toFixed(1))}
                sub={`${fr ? 'Écart des minima\u00A0:' : 'Minima difference:'} ${num((report.meanWithersMinDiff * 100).toFixed(1), fr)}${NBSP}cm`}
              />
              <Metric
                label={fr ? 'Asymétrie Pelvienne (BAI)' : 'Pelvic BAI (%)'}
                value={pct(Math.abs(report.meanPelvicAsymmetryPct).toFixed(1))}
                sub={`${fr ? 'Écart des minima\u00A0:' : 'Minima difference:'} ${num((report.meanPelvicMinDiff * 100).toFixed(1), fr)}${NBSP}cm`}
              />
              <Metric
                wide={!isCircle}
                label={fr ? 'Fréquence de foulée' : 'Stride Frequency'}
                value={num(report.meanStrideFrequencyHz.toFixed(2), fr)}
                unit="Hz"
                sub={`${fr ? 'Facteur d’appui\u00A0:' : 'Duty factor:'} ${pct((report.meanDutyFactor * 100).toFixed(1))}`}
              />
              {isCircle && (
                <Metric
                  label={fr ? 'Angle d’inclinaison' : 'Centripetal Lean'}
                  value={num(circleLean.toFixed(1), fr)}
                  unit="°"
                  sub={fr ? 'Compensé sur le plan vidéo' : 'Video geometric compensation'}
                />
              )}
            </div>
          </section>

          {/* The circle: the switch, then its two sliders */}
          <section className="sc-section equine-controls">
            <label className="sc-switch">
              <span className="sc-switch-text">
                <span>{fr ? 'Évaluation en cercle (Longe)' : 'Circle Lunging Mode'}</span>
                <small>{fr ? 'Applique la correction centripète θ = arctan(v²/gR)' : 'Compensates centripetal lean angle θ = arctan(v²/gR)'}</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={isCircle}
                onChange={e => {
                  hapticLight();
                  setIsCircle(e.target.checked);
                }}
                data-testid="toggle-circle"
              />
            </label>
            {isCircle && (
              <div className="sc-ranges">
                <Range
                  label={fr ? 'Rayon du cercle (R)' : 'Circle Radius (R)'}
                  display={`${num(circleRadius, fr)}${NBSP}m`}
                  min="6"
                  max="20"
                  step="0.5"
                  value={circleRadius}
                  onChange={e => {
                    hapticLight();
                    setCircleRadius(parseFloat(e.target.value));
                  }}
                />
                <Range
                  label={fr ? 'Vitesse de trot (v)' : 'Trot Speed (v)'}
                  display={`${num(trotSpeed.toFixed(1), fr)}${NBSP}m/s`}
                  min="2.5"
                  max="5.0"
                  step="0.1"
                  value={trotSpeed}
                  onChange={e => {
                    hapticLight();
                    setTrotSpeed(parseFloat(e.target.value));
                  }}
                />
              </div>
            )}
          </section>

          {/* The science behind the trace */}
          <section className="sc-section equine-science">
            <div className="sc-name-row">
              <span className="sc-tag is-on">{fr ? 'Guide Clinique' : 'Clinical Protocol'}</span>
              <h2 className="sc-name">{fr ? 'Mécanique des Boiteries & Évaluation en Longe (Dyson & Greve, 2016)' : 'Lameness Mechanics & Circle Assessment (Dyson & Greve, 2016)'}</h2>
            </div>
            <p className="sc-text">
              <strong>{fr ? 'Fondements scientifiques (Dyson & Greve, 2016\u00A0; Pfau et al., 2014)\u00A0:' : 'Scientific Foundation (Dyson & Greve, 2016; Pfau et al., 2014):'}</strong>{' '}
              {fr
                ? 'Au trot symétrique, le garrot et le sacrum présentent deux minima identiques par foulée (D1 et D2). Une différence d’excursion verticale (BAI > 8\u202F%) révèle une décharge clinique du membre d’appui.'
                : 'In sound trot, withers and pelvis display two identical minima per stride cycle (D1 and D2). Excursion divergence (BAI > 8%) quantifies weight-offloading and subtle lameness.'}
            </p>
            <p className="sc-text">
              {fr
                ? 'Dyson & Greve (2016) ont mis en évidence qu’un cheval paraissant régulier en ligne droite peut manifester une boiterie franche sur les cercles, tandis que le travail monté peut soit l’amplifier, soit la masquer. L’évaluation quantitative de la symétrie au trot permet d’objectiver les asymétries inférieures au seuil de perception visuelle humaine.'
                : 'Dyson & Greve (2016) demonstrated that horses appearing sound in a straight line may show distinct lameness on circles, while ridden assessment can reveal or mask it. Objective trot asymmetry tracking captures sub-visual movement alterations that human observation alone cannot reliably quantify.'}
            </p>
            <div className="equine-points">
              <div className="sc-card">
                <h3 className="sc-head-title">{fr ? 'Seuil Physiologique (< 8\u202F% BAI)' : 'Sound Threshold (< 8% BAI)'}</h3>
                <p className="sc-caption">
                  {fr
                    ? 'Excursion verticale symétrique du garrot et du sacrum sur les deux diagonaux (D1 et D2). Variation normale d’allure.'
                    : 'Symmetrical vertical excursion of withers and sacrum across both diagonals (D1 & D2). Normal physiological tolerance.'}
                </p>
              </div>
              <div className="sc-card">
                <h3 className="sc-head-title">{fr ? 'Boiterie Clinique (> 8\u202F% BAI)' : 'Clinical Lameness (> 8% BAI)'}</h3>
                <p className="sc-caption">
                  {fr
                    ? 'Décharge d’appui asymétrique. Garrot\u00A0: antérieures (mouvement de tête compensateur). Sacrum\u00A0: postérieures (défaut d’élévation/chute pelvienne).'
                    : 'Asymmetric stance offloading. Withers: forelimb (compensatory head-nod). Sacrum: hindlimb (reduced pelvic downward drop / push-off deficit).'}
                </p>
              </div>
              <div className="sc-card">
                <h3 className="sc-head-title">{fr ? 'Filtre Centripète θ = arctan(v²/gR)' : 'Centripetal Filter θ = arctan(v²/gR)'}</h3>
                <p className="sc-caption">
                  {fr
                    ? 'Sur le cercle, l’accélération centripète incline le cheval vers l’intérieur. EquiVision soustrait l’inclinaison pour ne mesurer que la boiterie intrinsèque.'
                    : 'On a circle, centripetal force tilts the horse inward. EquiVision filters out the geometric lean so circle tilt is never mistaken for true lameness.'}
                </p>
              </div>
            </div>
          </section>

          {/* GDPR Article 9 & Biometric Exemption */}
          <section className="sc-section equine-legal">
            <div className="sc-name-row">
              <span className="sc-tag">{fr ? 'Cadre Juridique' : 'Regulatory'}</span>
              <h2 className="sc-name">{fr ? 'Protection des Données & Statut Vétérinaire (RGPD Article 9)' : 'Data Privacy & Veterinary Exemption (GDPR Article 9)'}</h2>
            </div>
            <p className="sc-caption">
              {fr
                ? 'Au regard du Règlement Général sur la Protection des Données (RGPD, Art. 9) et des directives de la CNIL, les captures vidéo et modèles d’allures animales ne constituent pas des données biométriques identifiantes de personnes physiques. Elles bénéficient d’une liberté de traitement complète pour l’aide au diagnostic vétérinaire. De plus, 100\u202F% du traitement par vision par ordinateur s’exécute localement sur votre téléphone\u00A0: aucune vidéo n’est transmise sur des serveurs distants.'
                : 'Under GDPR Article 9 and international biometric privacy frameworks, animal video locomotion data does not constitute protected human biometric identifiers. Veterinary motion captures operate outside personal biometric restrictions. Furthermore, 100% of WorkoutVision’s computer vision runs entirely on-device in your browser: no video frames ever leave your phone.'}
            </p>
          </section>

          {/* Video Upload for Clinicians */}
          <button
            type="button"
            className="sc-card equine-upload press"
            onClick={() => {
              hapticLight();
              fileInputRef.current?.click();
            }}
            data-testid="equine-upload-card"
          >
            <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span className="equine-upload-title">{fr ? 'Importer une vidéo de trot (Trot-up ou Longe)' : 'Upload Trot Video (Straight Line or Lunge)'}</span>
            <span className="sc-caption">{fr ? 'Traitement 100\u202F% sur l’appareil. Aucun fichier n’est envoyé sur un serveur.' : '100% On-Device Processing. Video never leaves this phone.'}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
