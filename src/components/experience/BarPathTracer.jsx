import React, { useMemo } from 'react';
import './BarPathTracer.css';

/**
 * Computes 2D/3D bar path metrics from landmark frames (wrist midpoint).
 *
 * @param {Array<Array<{x: number, y: number, z?: number, visibility?: number}>>} frames
 * @param {number[]} [timestamps]
 * @returns {object|null}
 */
export function computeBarPathMetrics(frames, timestamps) {
  if (!Array.isArray(frames) || frames.length < 5) {
    return null;
  }

  const times = Array.isArray(timestamps) && timestamps.length === frames.length
    ? timestamps
    : frames.map((_, i) => i / 30);

  const points = [];
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (!frame) continue;

    const leftWrist = frame[15];
    const rightWrist = frame[16];

    let bx = null;
    let by = null;
    let bz = null;

    const leftValid = leftWrist && (leftWrist.visibility ?? 1) >= 0.3;
    const rightValid = rightWrist && (rightWrist.visibility ?? 1) >= 0.3;

    if (leftValid && rightValid) {
      bx = (leftWrist.x + rightWrist.x) / 2;
      by = (leftWrist.y + rightWrist.y) / 2;
      bz = ((leftWrist.z ?? 0) + (rightWrist.z ?? 0)) / 2;
    } else if (leftValid) {
      bx = leftWrist.x;
      by = leftWrist.y;
      bz = leftWrist.z ?? 0;
    } else if (rightValid) {
      bx = rightWrist.x;
      by = rightWrist.y;
      bz = rightWrist.z ?? 0;
    }

    if (bx !== null && by !== null) {
      points.push({ x: bx, y: by, z: bz ?? 0, timestamp: times[i] });
      if (bx < minX) minX = bx;
      if (bx > maxX) maxX = bx;
      if (by < minY) minY = by;
      if (by > maxY) maxY = by;
    }
  }

  if (points.length < 5 || minX === Infinity || minY === Infinity) {
    return null;
  }

  const deltaX = maxX - minX;
  const deltaY = maxY - minY;

  // Efficiency ratio: 100 * (1 - (drift / displacement))
  const rawRatio = deltaY > 0.02
    ? 100 * (1 - (deltaX / deltaY))
    : 80;
  const verticalEfficiency = Math.max(0, Math.min(100, Math.round(rawRatio)));
  const isOptimal = verticalEfficiency >= 80;

  const cueFr = isOptimal
    ? `Trajectoire axiale optimale (${verticalEfficiency}\u00A0%)\u00A0: dérive sagittale minimale.`
    : `Dérive sagittale mesurée (${verticalEfficiency}\u00A0%)\u00A0: recentrez la charge sur l'axe vertical.`;

  const cueEn = isOptimal
    ? `Optimal axial bar path (${verticalEfficiency}%): minimal sagittal drift.`
    : `Sagittal drift measured (${verticalEfficiency}%): realign bar over midfoot.`;

  return {
    points,
    horizontalDriftNorm: Math.round(deltaX * 1000) / 1000,
    verticalDisplacementNorm: Math.round(deltaY * 1000) / 1000,
    verticalEfficiency,
    isOptimal,
    cueFr,
    cueEn,
  };
}

export default function BarPathTracer({
  frames = null,
  timestamps = null,
  currentTime = undefined,
  active = true,
  lang = 'fr',
}) {
  const metrics = useMemo(() => computeBarPathMetrics(frames, timestamps), [frames, timestamps]);

  if (!active || !metrics || metrics.points.length < 2) {
    return null;
  }

  const { points, verticalEfficiency, isOptimal } = metrics;

  // Build SVG path data (coordinates normalized 0..100)
  const pathD = points.reduce((acc, pt, idx) => {
    const px = Math.round(pt.x * 1000) / 10;
    const py = Math.round(pt.y * 1000) / 10;
    return idx === 0 ? `M ${px} ${py}` : `${acc} L ${px} ${py}`;
  }, '');

  // Find point closest to currentTime if specified
  let currentPt = null;
  if (typeof currentTime === 'number') {
    let closestDist = Infinity;
    for (const pt of points) {
      const dist = Math.abs(pt.timestamp - currentTime);
      if (dist < closestDist) {
        closestDist = dist;
        currentPt = pt;
      }
    }
  }

  const badgeText = lang === 'fr'
    ? `Axe vertical\u00A0: ${verticalEfficiency}\u00A0%`
    : `Vertical path: ${verticalEfficiency}%`;

  return (
    <div className="bar-path-overlay-container" data-testid="bar-path-overlay">
      <svg
        className="bar-path-svg-canvas"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={pathD}
          className={`bar-path-trail ${isOptimal ? 'is-optimal' : 'is-drift'}`}
        />
        {currentPt && (
          <circle
            cx={Math.round(currentPt.x * 1000) / 10}
            cy={Math.round(currentPt.y * 1000) / 10}
            r="1.8"
            className="bar-path-point-current"
          />
        )}
      </svg>
      <div className={`bar-path-telemetry-badge ${isOptimal ? 'is-optimal' : 'is-drift'}`}>
        {badgeText}
      </div>
    </div>
  );
}
