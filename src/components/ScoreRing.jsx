import { useMemo } from 'react';
import useCountUp from '../lib/useCountUp';
import s from './ScoreRing.module.css';

/**
 * ScoreRing — Apple Watch-inspired 270-degree arc gauge for form scores (0-100).
 *
 * SVG-based with animated fill, count-up number, and color-coded by score.
 * Uses design tokens from _tokens.css for semantic colors.
 *
 * @param {object} props
 * @param {number} props.score - Score value, 0 to 100.
 * @param {number} [props.size=120] - Diameter in pixels.
 * @param {string} [props.label] - Optional label below the number (e.g., "Form Score").
 */
export default function ScoreRing({ score = 0, size = 120, label }) {
  const clamped = Math.min(100, Math.max(0, score));
  const displayScore = useCountUp(clamped, { duration: 1000 });

  // Color based on score thresholds, using token names
  const color = useMemo(() => {
    if (clamped >= 80) return 'var(--accent-2)';
    if (clamped >= 60) return 'var(--yellow)';
    return 'var(--red)';
  }, [clamped]);

  // Arc geometry: 270-degree arc with gap at the bottom
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // 270 degrees = 3/4 of a full circle
  // Gap at the bottom: arc runs from 135 degrees (bottom-left) clockwise to 45 degrees (bottom-right)
  // In SVG coordinates (0 = 3 o'clock, clockwise):
  //   start angle: 135 degrees (bottom-left of gap)
  //   end angle:   45 degrees (bottom-right of gap)
  //   total sweep:  270 degrees
  const totalAngleDeg = 270;
  const totalAngleRad = (totalAngleDeg * Math.PI) / 180;
  const startAngleDeg = 135; // bottom-left of gap
  const startAngleRad = (startAngleDeg * Math.PI) / 180;

  // Circumference of the full circle, and the arc portion
  const fullCircumference = 2 * Math.PI * radius;
  const arcLength = (totalAngleDeg / 360) * fullCircumference;
  const gapLength = fullCircumference - arcLength;

  // Progress dashoffset: from fully hidden to fully revealed
  const progressOffset = arcLength * (1 - clamped / 100);

  // Start point of the arc (for rotate transform)
  // SVG circle starts at 3 o'clock (0 degrees). We want to start at 135 degrees.
  const rotationDeg = startAngleDeg;

  // Font size scales with ring size
  const fontSize = Math.round(size * 0.28);

  return (
    <div className={s.ring} style={{ width: size, height: size }}>
      <svg
        className={s.svg}
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Score: ${clamped} out of 100${label ? `, ${label}` : ''}`}
      >
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${gapLength}`}
          transform={`rotate(${rotationDeg} ${cx} ${cy})`}
        />

        {/* Glow layer (wider, blurred, behind the fill) */}
        <circle
          className={s.arcGlow}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 6}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${gapLength}`}
          strokeDashoffset={progressOffset}
          transform={`rotate(${rotationDeg} ${cx} ${cy})`}
          opacity="0.15"
          style={{ filter: 'blur(4px)' }}
        />

        {/* Active arc fill */}
        <circle
          className={s.arcFill}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${gapLength}`}
          strokeDashoffset={progressOffset}
          transform={`rotate(${rotationDeg} ${cx} ${cy})`}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>

      {/* Centered score display */}
      <div className={s.center}>
        <span className={s.score} style={{ fontSize, color }}>
          {displayScore}
          <span className={s.unit}>/100</span>
        </span>
        {label && <span className={s.label}>{label}</span>}
      </div>
    </div>
  );
}
