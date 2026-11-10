import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import BarPathTracer, { computeBarPathMetrics } from '../BarPathTracer';

describe('BarPathTracer & computeBarPathMetrics', () => {
  it('returns null for empty or insufficient landmark frames', () => {
    expect(computeBarPathMetrics(null)).toBeNull();
    expect(computeBarPathMetrics([])).toBeNull();
    expect(computeBarPathMetrics([[{ x: 0.5, y: 0.5 }]])).toBeNull();
  });

  it('computes vertical efficiency for purely vertical bar travel', () => {
    const frames = [];
    const timestamps = [];

    for (let i = 0; i < 20; i++) {
      timestamps.push(i / 20);
      const frame = Array(33).fill(null).map(() => ({ x: 0, y: 0, visibility: 0.9 }));

      // Left wrist (15) and Right wrist (16) traveling strictly up/down at x=0.5
      // y descends from 0.7 to 0.3
      const y = 0.7 - (i / 19) * 0.4;
      frame[15] = { x: 0.45, y, visibility: 0.95 };
      frame[16] = { x: 0.55, y, visibility: 0.95 };

      frames.push(frame);
    }

    const metrics = computeBarPathMetrics(frames, timestamps);
    expect(metrics).not.toBeNull();
    expect(metrics?.horizontalDriftNorm).toBe(0);
    expect(metrics?.verticalDisplacementNorm).toBeCloseTo(0.4, 2);
    expect(metrics?.verticalEfficiency).toBe(100);
    expect(metrics?.isOptimal).toBe(true);
    expect(metrics?.cueFr).toContain('Trajectoire axiale optimale (100\u00A0%)\u00A0:');
    expect(metrics?.cueEn).toContain('Optimal axial bar path (100%):');
  });

  it('detects excessive sagittal horizontal drift and marks non-optimal', () => {
    const frames = [];
    const timestamps = [];

    for (let i = 0; i < 20; i++) {
      timestamps.push(i / 20);
      const frame = Array(33).fill(null).map(() => ({ x: 0, y: 0, visibility: 0.9 }));

      // Large horizontal drift (x shifts by 0.2 while y moves 0.3)
      const y = 0.7 - (i / 19) * 0.3;
      const x = 0.5 + (i / 19) * 0.2;
      frame[15] = { x: x - 0.05, y, visibility: 0.95 };
      frame[16] = { x: x + 0.05, y, visibility: 0.95 };

      frames.push(frame);
    }

    const metrics = computeBarPathMetrics(frames, timestamps);
    expect(metrics).not.toBeNull();
    expect(metrics?.verticalEfficiency).toBeLessThan(80);
    expect(metrics?.isOptimal).toBe(false);
    expect(metrics?.cueFr).toContain('Dérive sagittale mesurée');
    expect(metrics?.cueFr).toContain('\u00A0:');
  });

  it('renders SVG overlay markup with current scrubber position and telemetry badge', () => {
    const frames = [];
    const timestamps = [];

    for (let i = 0; i < 10; i++) {
      timestamps.push(i / 10);
      const frame = Array(33).fill(null).map(() => ({ x: 0, y: 0, visibility: 0.9 }));
      frame[15] = { x: 0.5, y: 0.5 + i * 0.02, visibility: 0.95 };
      frame[16] = { x: 0.5, y: 0.5 + i * 0.02, visibility: 0.95 };
      frames.push(frame);
    }

    const html = renderToStaticMarkup(
      <BarPathTracer
        frames={frames}
        timestamps={timestamps}
        currentTime={0.5}
        active={true}
        lang="fr"
      />
    );

    expect(html).toContain('bar-path-overlay-container');
    expect(html).toContain('bar-path-svg-canvas');
    expect(html).toContain('bar-path-trail');
    expect(html).toContain('bar-path-point-current');
    expect(html).toContain('Axe vertical');
  });
});
