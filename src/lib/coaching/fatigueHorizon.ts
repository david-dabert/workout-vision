/**
 * fatigueHorizon.ts: Longitudinal Set-to-Set Fatigue Horizon & Optimal Rest Predictor.
 *
 * Literature:
 * - Sanchez-Medina L, Gonzalez-Badillo JJ.
 *   "Velocity loss as an indicator of neuromuscular fatigue during resistance training".
 *   Med Sci Sports Exerc. 2011;43(9):1725-1734.
 * - Helms ER, Cronin J, Storey A, Zourdos MC.
 *   "Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training".
 *   Strength Cond J. 2016;38(4):42-49.
 * - De Salles BF, Simao R, Miranda F, et al.
 *   "Rest interval between sets in strength training".
 *   Sports Med. 2009;39(9):765-777.
 */

export interface HistoricalSetInput {
  setIndex: number;
  repsCount: number;
  velocityLossPercent?: number | null;
  durationSec?: number | null;
  restSecondsBefore?: number | null;
}

export interface FatigueHorizonTelemetry {
  currentFatigueTier: 'fresh' | 'moderate_fatigue' | 'high_fatigue' | 'exhausted';
  estimatedRemainingSets: number;
  recommendedRestSec: number;
  fatigueAccumulationPercent: number;
  cueFr: string;
  cueEn: string;
}

/**
 * Predicts remaining viable sets and dynamically prescribes optimal rest duration
 * based on cumulative neuromuscular fatigue and intra-set velocity loss telemetry.
 */
export function predictFatigueHorizon(
  historicalSets: HistoricalSetInput[] = [],
  currentVelocityLossPercent: number | null = null,
  lift = 'squat'
): FatigueHorizonTelemetry {
  const isCompound = /squat|deadlift|press|bench|clean|snatch|row/i.test(lift);
  const baseRestSec = isCompound ? 120 : 75;

  // Determine effective latest velocity loss
  let effectiveLoss = 0;
  if (typeof currentVelocityLossPercent === 'number' && !isNaN(currentVelocityLossPercent)) {
    effectiveLoss = Math.max(0, currentVelocityLossPercent);
  } else if (historicalSets.length > 0) {
    const last = historicalSets[historicalSets.length - 1];
    effectiveLoss = last.velocityLossPercent ?? 12;
  } else {
    effectiveLoss = 10;
  }

  // Calculate cumulative fatigue index from previous sets (3% per completed set baseline)
  const setVolumeFatigue = historicalSets.length * 3.5;
  const totalFatiguePercent = Math.min(100, Math.round(effectiveLoss + setVolumeFatigue));

  // Determine fatigue tier
  let tier: 'fresh' | 'moderate_fatigue' | 'high_fatigue' | 'exhausted';
  let estimatedRemainingSets: number;

  if (totalFatiguePercent < 18) {
    tier = 'fresh';
    estimatedRemainingSets = Math.max(1, 4 - historicalSets.length);
  } else if (totalFatiguePercent < 30) {
    tier = 'moderate_fatigue';
    estimatedRemainingSets = Math.max(1, 3 - Math.min(2, historicalSets.length));
  } else if (totalFatiguePercent < 42) {
    tier = 'high_fatigue';
    estimatedRemainingSets = 1;
  } else {
    tier = 'exhausted';
    estimatedRemainingSets = 0;
  }

  // Dynamic rest duration scaled to velocity loss: rest = base * (1 + loss / 40)
  const dynamicRest = baseRestSec * (1 + effectiveLoss / 40);
  const recommendedRestSec = Math.max(60, Math.min(240, Math.round(dynamicRest / 15) * 15));

  let cueFr: string;
  let cueEn: string;

  if (tier === 'fresh') {
    cueFr = `Fraîcheur neuromusculaire élevée\u00A0: repos conseillé de ${recommendedRestSec}\u00A0s avant la prochaine série.`;
    cueEn = `High neuromuscular freshness: recommended rest of ${recommendedRestSec}s before next set.`;
  } else if (tier === 'moderate_fatigue') {
    cueFr = `Fatigue neuromusculaire modérée\u00A0: prévoyez ${recommendedRestSec}\u00A0s de repos pour préserver le recrutement moteur.`;
    cueEn = `Moderate neuromuscular fatigue: plan ${recommendedRestSec}s of rest to preserve motor unit recruitment.`;
  } else if (tier === 'high_fatigue') {
    cueFr = `Accumulation de fatigue élevée (${totalFatiguePercent}\u00A0%)\u00A0: repos complet de ${recommendedRestSec}\u00A0s recommandé (dernière série viable).`;
    cueEn = `High fatigue accumulation (${totalFatiguePercent}%): full rest of ${recommendedRestSec}s recommended (final viable set).`;
  } else {
    cueFr = `Seuil de fatigue neuromusculaire atteint (${totalFatiguePercent}\u00A0%)\u00A0: terminez la séance ou réduisez la charge.`;
    cueEn = `Neuromuscular fatigue threshold reached (${totalFatiguePercent}%): end exercise or drop load.`;
  }

  return {
    currentFatigueTier: tier,
    estimatedRemainingSets,
    recommendedRestSec,
    fatigueAccumulationPercent: totalFatiguePercent,
    cueFr,
    cueEn,
  };
}
