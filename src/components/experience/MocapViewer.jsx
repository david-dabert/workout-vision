import { useEffect, useRef, useState, useMemo } from 'react';
import { RGB, rgba } from './palette';
import { liftDefinition } from '../../lib/counting/core';
import { stabilizeMotionSequence } from '../../lib/kinesiology/groundContact';
import './MocapViewer.css';

/**
 * 33 MediaPipe Pose Landmark indices:
 * 0: nose, 11: left_shoulder, 12: right_shoulder, 13: left_elbow, 14: right_elbow,
 * 15: left_wrist, 16: right_wrist, 23: left_hip, 24: right_hip,
 * 25: left_knee, 26: right_knee, 27: left_ankle, 28: right_ankle,
 * 29: left_heel, 30: right_heel, 31: left_foot_index, 32: right_foot_index
 */
const BONES = [
  // Torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Left arm
  [11, 13], [13, 15],
  // Right arm
  [12, 14], [14, 16],
  // Left leg
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31],
  // Right leg
  [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
];

/**
 * Generate 30 frames of synthetic 3D kinematic motion when raw 3D landmarks are unavailable.
 */
function generateSyntheticMotion(lift = 'squat') {
  const frames = [];
  const count = 30;
  const def = liftDefinition(lift);
  const isKnee = def?.joint === 'knee';
  const isElbow = def?.joint === 'elbow';
  const isShoulder = def?.joint === 'shoulder';

  for (let i = 0; i < count; i++) {
    // 0 -> 1 -> 0 sinusoidal cycle
    const phase = 0.5 * (1 - Math.cos((2 * Math.PI * i) / count));
    const lms = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0.95 }));

    // Hips
    const hipY = isKnee ? 0.15 + phase * 0.35 : 0.15;
    const hipZ = isKnee ? -phase * 0.15 : 0;
    lms[23] = { x: -0.12, y: hipY, z: hipZ, visibility: 0.95 };
    lms[24] = { x: 0.12, y: hipY, z: hipZ, visibility: 0.95 };

    // Spine & Shoulders
    const trunkTilt = isKnee ? phase * 0.25 : 0;
    const shoulderY = hipY - 0.52 * Math.cos(trunkTilt);
    const shoulderZ = hipZ + 0.52 * Math.sin(trunkTilt);
    lms[11] = { x: -0.20, y: shoulderY, z: shoulderZ, visibility: 0.95 };
    lms[12] = { x: 0.20, y: shoulderY, z: shoulderZ, visibility: 0.95 };

    // Head
    lms[0] = { x: 0, y: shoulderY - 0.20, z: shoulderZ + 0.05, visibility: 0.95 };

    // Legs
    if (isKnee) {
      // Squat: knees push forward and out, ankles stay locked to ground
      const kneeY = hipY + 0.22;
      const kneeZ = hipZ + 0.20 + phase * 0.10;
      lms[25] = { x: -0.15, y: kneeY, z: kneeZ, visibility: 0.95 };
      lms[26] = { x: 0.15, y: kneeY, z: kneeZ, visibility: 0.95 };
    } else {
      lms[25] = { x: -0.12, y: 0.50, z: 0, visibility: 0.95 };
      lms[26] = { x: 0.12, y: 0.50, z: 0, visibility: 0.95 };
    }
    // Feet locked at ground level
    lms[27] = { x: -0.14, y: 0.88, z: 0, visibility: 0.95 };
    lms[28] = { x: 0.14, y: 0.88, z: 0, visibility: 0.95 };
    lms[29] = { x: -0.14, y: 0.90, z: -0.06, visibility: 0.95 };
    lms[30] = { x: 0.14, y: 0.90, z: -0.06, visibility: 0.95 };
    lms[31] = { x: -0.14, y: 0.92, z: 0.12, visibility: 0.95 };
    lms[32] = { x: 0.14, y: 0.92, z: 0.12, visibility: 0.95 };

    // Arms
    if (isElbow) {
      // Curl or Press
      const curlAngle = 0.6 + phase * 1.8;
      lms[13] = { x: -0.22, y: shoulderY + 0.28, z: 0.02, visibility: 0.95 };
      lms[14] = { x: 0.22, y: shoulderY + 0.28, z: 0.02, visibility: 0.95 };
      lms[15] = { x: -0.20, y: shoulderY + 0.28 - 0.25 * Math.sin(curlAngle), z: 0.02 + 0.25 * Math.cos(curlAngle), visibility: 0.95 };
      lms[16] = { x: 0.20, y: shoulderY + 0.28 - 0.25 * Math.sin(curlAngle), z: 0.02 + 0.25 * Math.cos(curlAngle), visibility: 0.95 };
    } else if (isShoulder) {
      // Lateral raise
      const raiseAngle = 0.2 + phase * 1.4;
      lms[13] = { x: -0.20 - 0.26 * Math.sin(raiseAngle), y: shoulderY + 0.26 * Math.cos(raiseAngle), z: 0, visibility: 0.95 };
      lms[14] = { x: 0.20 + 0.26 * Math.sin(raiseAngle), y: shoulderY + 0.26 * Math.cos(raiseAngle), z: 0, visibility: 0.95 };
      lms[15] = { x: -0.20 - 0.52 * Math.sin(raiseAngle), y: shoulderY + 0.52 * Math.cos(raiseAngle), z: 0, visibility: 0.95 };
      lms[16] = { x: 0.20 + 0.52 * Math.sin(raiseAngle), y: shoulderY + 0.52 * Math.cos(raiseAngle), z: 0, visibility: 0.95 };
    } else {
      // Squat / Default arms counterbalancing
      lms[13] = { x: -0.20, y: shoulderY + 0.22, z: 0.15 + phase * 0.1, visibility: 0.95 };
      lms[14] = { x: 0.20, y: shoulderY + 0.22, z: 0.15 + phase * 0.1, visibility: 0.95 };
      lms[15] = { x: -0.10, y: shoulderY + 0.10, z: 0.30 + phase * 0.15, visibility: 0.95 };
      lms[16] = { x: 0.10, y: shoulderY + 0.10, z: 0.30 + phase * 0.15, visibility: 0.95 };
    }

    frames.push(lms);
  }
  return frames;
}

export default function MocapViewer({ worldLandmarks = null, lift = 'squat', fr = false }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // 3D Motion Frames
  const frames = useMemo(() => {
    if (Array.isArray(worldLandmarks) && worldLandmarks.length > 2 && Array.isArray(worldLandmarks[0])) {
      return stabilizeMotionSequence(worldLandmarks);
    }
    return generateSyntheticMotion(lift);
  }, [worldLandmarks, lift]);

  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  // Camera Orbit State
  const cameraRef = useRef({
    yaw: 0.65,      // ~37 degrees isometric angle
    pitch: 0.18,    // ~10 degrees elevation
    distance: 2.4,  // camera zoom
    dragging: false,
    lastX: 0,
    lastY: 0,
    autoRotate: true,
  });

  // Animation Loop
  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const interval = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % frames.length);
    }, 1000 / 25);
    return () => clearInterval(interval);
  }, [playing, frames.length]);

  // Touch & Mouse Orbit Interaction
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = e => {
      cameraRef.current.dragging = true;
      cameraRef.current.autoRotate = false;
      cameraRef.current.lastX = e.clientX || e.touches?.[0]?.clientX || 0;
      cameraRef.current.lastY = e.clientY || e.touches?.[0]?.clientY || 0;
    };

    const onPointerMove = e => {
      if (!cameraRef.current.dragging) return;
      const x = e.clientX || e.touches?.[0]?.clientX || 0;
      const y = e.clientY || e.touches?.[0]?.clientY || 0;
      const dx = x - cameraRef.current.lastX;
      const dy = y - cameraRef.current.lastY;
      cameraRef.current.lastX = x;
      cameraRef.current.lastY = y;

      cameraRef.current.yaw += dx * 0.012;
      cameraRef.current.pitch = Math.max(-1.2, Math.min(1.2, cameraRef.current.pitch - dy * 0.012));
    };

    const onPointerUp = () => {
      cameraRef.current.dragging = false;
    };

    canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);

    return () => {
      canvas.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);

      canvas.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
    };
  }, []);

  // 3D Canvas Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId;
    const render = () => {
      const width = canvas.clientWidth || 320;
      const height = canvas.clientHeight || 300;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cam = cameraRef.current;
      if (cam.autoRotate && !cam.dragging) {
        cam.yaw += 0.003;
      }

      const lms = frames[frameIndex % frames.length];
      if (!lms || lms.length < 33) {
        ctx.restore();
        animId = requestAnimationFrame(render);
        return;
      }

      // Hip midpoint as origin center
      const hipMidX = ((lms[23]?.x ?? 0) + (lms[24]?.x ?? 0)) / 2;
      const hipMidY = ((lms[23]?.y ?? 0) + (lms[24]?.y ?? 0)) / 2;
      const hipMidZ = ((lms[23]?.z ?? 0) + (lms[24]?.z ?? 0)) / 2;

      const cx = width / 2;
      const cy = height / 2 + 15;
      const scale = Math.min(width, height) * 0.75;
      const D = cam.distance;

      const cosY = Math.cos(cam.yaw);
      const sinY = Math.sin(cam.yaw);
      const cosP = Math.cos(cam.pitch);
      const sinP = Math.sin(cam.pitch);

      // Project 3D point to 2D canvas
      const project = (x, y, z) => {
        const rx = x - hipMidX;
        const ry = y - hipMidY;
        const rz = z - hipMidZ;

        // Yaw (Y-axis)
        const x1 = rx * cosY + rz * sinY;
        const z1 = -rx * sinY + rz * cosY;

        // Pitch (X-axis)
        const y2 = ry * cosP - z1 * sinP;
        const z2 = ry * sinP + z1 * cosP;

        const f = D / (D + z2);
        return {
          x: cx + x1 * scale * f,
          y: cy + y2 * scale * f,
          z: z2,
          f,
        };
      };

      // 1. Draw 3D Perspective Ground Grid at Foot Level
      const footY = Math.max(lms[27]?.y ?? 0.8, lms[28]?.y ?? 0.8);
      const gridSize = 1.0;
      const gridSteps = 6;
      const stepSize = (gridSize * 2) / gridSteps;

      ctx.beginPath();
      ctx.strokeStyle = rgba(RGB.bone, 0.08);
      ctx.lineWidth = 1;

      for (let i = -gridSteps / 2; i <= gridSteps / 2; i++) {
        const p1 = project(-gridSize, footY, i * stepSize);
        const p2 = project(gridSize, footY, i * stepSize);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);

        const p3 = project(i * stepSize, footY, -gridSize);
        const p4 = project(i * stepSize, footY, gridSize);
        ctx.moveTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
      }
      ctx.stroke();

      // Center crosshair in gold
      ctx.beginPath();
      ctx.strokeStyle = rgba(RGB.lamp, 0.25);
      const c1 = project(-0.25, footY, 0);
      const c2 = project(0.25, footY, 0);
      const c3 = project(0, footY, -0.25);
      const c4 = project(0, footY, 0.25);
      ctx.moveTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.moveTo(c3.x, c3.y);
      ctx.lineTo(c4.x, c4.y);
      ctx.stroke();

      // Project all landmarks
      const projected = lms.map(p => (p ? project(p.x, p.y, p.z) : null));

      // 2. Draw Kinematic Bones
      const def = liftDefinition(lift);
      const isKnee = def?.joint === 'knee';
      const isElbow = def?.joint === 'elbow';
      const isShoulder = def?.joint === 'shoulder';

      for (const [a, b] of BONES) {
        const pa = projected[a];
        const pb = projected[b];
        if (!pa || !pb) continue;

        // Is this bone the primary tracked lift segment?
        const isLiftBone =
          (isKnee && ((a === 23 && b === 25) || (a === 25 && b === 27) || (a === 24 && b === 26) || (a === 26 && b === 28))) ||
          (isElbow && ((a === 11 && b === 13) || (a === 13 && b === 15) || (a === 12 && b === 14) || (a === 14 && b === 16))) ||
          (isShoulder && ((a === 11 && b === 13) || (a === 12 && b === 14)));

        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        const avgF = (pa.f + pb.f) / 2;

        if (isLiftBone) {
          ctx.strokeStyle = rgba(RGB.lamp, 0.95);
          ctx.lineWidth = Math.max(2, 4 * avgF);
        } else {
          ctx.strokeStyle = rgba(RGB.bone, 0.7);
          ctx.lineWidth = Math.max(1.5, 2.5 * avgF);
        }
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Head connector (neck to nose)
      const midShoulder = projected[11] && projected[12]
        ? { x: (projected[11].x + projected[12].x) / 2, y: (projected[11].y + projected[12].y) / 2 }
        : null;
      if (midShoulder && projected[0]) {
        ctx.beginPath();
        ctx.moveTo(midShoulder.x, midShoulder.y);
        ctx.lineTo(projected[0].x, projected[0].y);
        ctx.strokeStyle = rgba(RGB.bone, 0.6);
        ctx.lineWidth = 2;
        ctx.stroke();

        // Head joint
        ctx.beginPath();
        ctx.arc(projected[0].x, projected[0].y, 5 * projected[0].f, 0, 2 * Math.PI);
        ctx.fillStyle = rgba(RGB.spark, 0.9);
        ctx.fill();
      }

      // 3. Draw Joint Spheres
      const KEY_JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
      for (const idx of KEY_JOINTS) {
        const p = projected[idx];
        if (!p) continue;
        const isTargetJoint =
          (isKnee && (idx === 25 || idx === 26)) ||
          (isElbow && (idx === 13 || idx === 14)) ||
          (isShoulder && (idx === 11 || idx === 12));

        ctx.beginPath();
        const r = isTargetJoint ? 5 * p.f : 3 * p.f;
        ctx.arc(p.x, p.y, Math.max(2, r), 0, 2 * Math.PI);

        if (isTargetJoint) {
          ctx.fillStyle = rgba(RGB.lampHi, 1.0);
          ctx.shadowColor = rgba(RGB.lamp, 0.8);
          ctx.shadowBlur = 8;
        } else {
          ctx.fillStyle = rgba(RGB.bone, 0.85);
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [frames, frameIndex, lift]);

  const resetView = () => {
    cameraRef.current.yaw = 0.65;
    cameraRef.current.pitch = 0.18;
    cameraRef.current.autoRotate = true;
  };

  return (
    <div className="mocap-card" ref={containerRef} data-testid="mocap-3d-viewer">
      <div className="mocap-head">
        <div className="mocap-titles">
          <span className="mocap-kicker">{fr ? 'Mocap 3D Interactif' : 'Interactive 3D Mocap'}</span>
          <h4 className="mocap-title">{fr ? 'Cinématique spatiale 360°' : '360° Spatial Kinematics'}</h4>
        </div>
        <div className="mocap-badges">
          <span className="mocap-badge">{fr ? 'Faites glisser' : 'Drag to spin'}</span>
          <button
            type="button"
            className="mocap-reset-btn press"
            onClick={resetView}
            title={fr ? 'Réinitialiser la vue' : 'Reset view'}
            aria-label={fr ? 'Réinitialiser la vue' : 'Reset view'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mocap-canvas-wrap">
        <canvas ref={canvasRef} className="mocap-canvas" aria-label={fr ? 'Vue cinématique 3D' : '3D Kinematic View'} />
        <div className="mocap-compass" aria-hidden="true">
          <span>3D</span>
        </div>
      </div>

      <div className="mocap-controls">
        <button
          type="button"
          className="mocap-play-btn press"
          onClick={() => setPlaying(p => !p)}
          aria-label={playing ? (fr ? 'Pause' : 'Pause') : (fr ? 'Lecture' : 'Play')}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6,4 20,12 6,20" /></svg>
          )}
        </button>

        <input
          type="range"
          min="0"
          max={Math.max(0, frames.length - 1)}
          value={frameIndex}
          onChange={e => {
            setPlaying(false);
            setFrameIndex(Number(e.target.value));
          }}
          className="mocap-scrubber"
          aria-label={fr ? 'Position temporelle' : 'Timeline position'}
        />

        <span className="mocap-frame-num">
          {frameIndex + 1}/{frames.length}
        </span>
      </div>
    </div>
  );
}
