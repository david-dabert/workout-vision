/**
 * biomechanicalXRay.ts
 *
 * Biomechanical X-Ray Progression Exporter.
 * Formats high-contrast, verifiable before/after kinematic progression comparisons.
 * Powers social proof, patient rehabilitation visual reports, and viral reels.
 */

export interface XRaySessionData {
  sessionId: string;
  date: string;
  label: string; // e.g. "Day 1 (Initial Assessment)" vs "Day 30 (Rehabilitation Progress)"
  romDegrees: number;
  symmetryPct: number;
  compensationCount: number; // e.g. shrug signs or knee valgus incidents
  keyframeJoints: {
    jointName: string;
    angle: number;
    status: 'optimal' | 'compromised' | 'warning';
  }[];
}

export interface XRayComparisonReport {
  exerciseNameEn: string;
  exerciseNameFr: string;
  baseline: XRaySessionData;
  progress: XRaySessionData;
  deltaRomDegrees: number;
  deltaSymmetryPct: number;
  compensationsEliminated: number;
  highlightBadgeEn: string;
  highlightBadgeFr: string;
  socialSharePayload: {
    headline: string;
    subheadline: string;
    metricCallouts: { label: string; value: string }[];
  };
}

export function generateXRayComparison(
  exerciseNameEn: string,
  exerciseNameFr: string,
  baseline: XRaySessionData,
  progress: XRaySessionData
): XRayComparisonReport {
  const deltaRom = Math.round(progress.romDegrees - baseline.romDegrees);
  const deltaSymmetry = Math.round(progress.symmetryPct - baseline.symmetryPct);
  const compensationsEliminated = Math.max(0, baseline.compensationCount - progress.compensationCount);

  const badgeFr = deltaRom >= 15
    ? `Mobilité +${deltaRom}\u00B0 | Symétrie +${deltaSymmetry}%`
    : `Stabilisation articulaire validée`;
  const badgeEn = deltaRom >= 15
    ? `Mobility +${deltaRom}\u00B0 | Symmetry +${deltaSymmetry}%`
    : `Joint stabilization verified`;

  const headline = `${exerciseNameFr} \u2014 Évolution Biomécanique`;
  const subheadline = `Mesures cinématiques objectives par Workout Vision`;

  const metricCallouts = [
    { label: 'Gain d\u2019amplitude', value: `+${deltaRom}\u00B0` },
    { label: 'Indice de symétrie', value: `${progress.symmetryPct}% (+${deltaSymmetry}%)` },
    { label: 'Compensations éliminées', value: `${compensationsEliminated}` },
  ];

  return {
    exerciseNameEn,
    exerciseNameFr,
    baseline,
    progress,
    deltaRomDegrees: deltaRom,
    deltaSymmetryPct: deltaSymmetry,
    compensationsEliminated,
    highlightBadgeEn: badgeEn,
    highlightBadgeFr: badgeFr,
    socialSharePayload: {
      headline,
      subheadline,
      metricCallouts,
    },
  };
}
