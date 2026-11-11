/**
 * WorkoutVision : Biomechanical Share Card & Summary Generator
 *
 * Generates Strava/Whoop-style high-impact biomechanical summary cards
 * and text payloads for investor demos, social sharing, and client delivery.
 *
 * Invariants:
 * - 100% Client-Side: Zero backend generation or network dependencies.
 * - French typography compliance: non-breaking spaces before colons/percents.
 * - Highlights local-first privacy: '100% On-Device AI • Zero Cloud'.
 */

export interface BiomechanicalSummary {
  exerciseName: string;
  totalReps: number;
  completedAt: string; // ISO string or human date
  peakVelocityMps: number;
  averageVelocityMps: number;
  velocityLossPercent: number;
  eccentricCadenceSec: number;
  concentricCadenceSec: number;
  bilateralSymmetryPercent: number;
  romConsistencyScore: number; // 0 to 100
  depthQuality: 'full' | 'parallel' | 'partial';
}

/**
 * Formats a clean, high-impact text message suitable for WhatsApp, iMessage, or clipboard.
 */
export function formatShareText(summary: BiomechanicalSummary): string {
  const depthLabel =
    summary.depthQuality === 'full'
      ? 'Profondeur complète'
      : summary.depthQuality === 'parallel'
      ? 'Parallèle validée'
      : 'Profondeur partielle';

  const fatigueLabel =
    summary.velocityLossPercent < 10
      ? 'Excellente réserve'
      : summary.velocityLossPercent < 20
      ? 'Fatigue modérée'
      : 'Proche de l’échec';

  return [
    '🏋️ WorkoutVision\u00A0: Analyse Biomécanique',
    `Exercice\u00A0: ${summary.exerciseName}`,
    `Répétitions\u00A0: ${summary.totalReps} (${depthLabel})`,
    '',
    `• Vitesse concentrique max\u00A0: ${summary.peakVelocityMps.toFixed(2)} m/s`,
    `• Perte de vitesse\u00A0: ${summary.velocityLossPercent.toFixed(1)}\u00A0% (${fatigueLabel})`,
    `• Cadence\u00A0: ${summary.eccentricCadenceSec.toFixed(1)}s excentrique / ${summary.concentricCadenceSec.toFixed(1)}s concentrique`,
    `• Symétrie bilatérale\u00A0: ${summary.bilateralSymmetryPercent.toFixed(1)}\u00A0%`,
    `• Régularité d'amplitude\u00A0: ${summary.romConsistencyScore.toFixed(0)}/100`,
    '',
    '🔒 100\u00A0% sur l’appareil • Zéro cloud • Confidentialité totale',
    'Tester l’application\u00A0: https://david-dabert.github.io/workout-vision/',
  ].join('\n');
}

/**
 * Generates an SVG visual share card with high-contrast athletic dark aesthetic.
 */
export function generateShareCardSvg(summary: BiomechanicalSummary): string {
  const width = 640;
  const height = 480;

  const depthColor = summary.depthQuality === 'full' ? '#22c55e' : '#f59e0b';
  const symmetryColor = summary.bilateralSymmetryPercent >= 95 ? '#22c55e' : '#eab308';

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0a0c" />
      <stop offset="100%" stop-color="#18181f" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#22c55e" />
      <stop offset="100%" stop-color="#3b82f6" />
    </linearGradient>
  </defs>

  <!-- Background Card -->
  <rect width="${width}" height="${height}" rx="24" fill="url(#bgGrad)" stroke="#272732" stroke-width="2" />

  <!-- Header Accent Line -->
  <rect x="32" y="32" width="6" height="36" rx="3" fill="url(#accentGrad)" />
  <text x="50" y="58" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="800" fill="#ffffff" letter-spacing="0.5">WorkoutVision</text>
  <text x="50" y="80" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="600" fill="#9ca3af" letter-spacing="1">RAPPORT BIOMÉCANIQUE EN DIRECT</text>

  <!-- Exercise & Big Reps Display -->
  <rect x="32" y="104" width="576" height="88" rx="16" fill="#14141a" stroke="#262633" />
  <text x="56" y="142" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="700" fill="#f3f4f6">${summary.exerciseName}</text>
  <text x="56" y="168" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#9ca3af">${summary.completedAt} • Validé par Computer Vision</text>

  <text x="520" y="162" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="900" fill="#ffffff" text-anchor="end">${summary.totalReps}</text>
  <text x="528" y="144" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" fill="#22c55e">REPS</text>

  <!-- 4-Grid Biomechanical Metrics -->
  <!-- 1. Peak Velocity -->
  <rect x="32" y="208" width="136" height="110" rx="14" fill="#14141a" stroke="#262633" />
  <text x="48" y="234" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600" fill="#9ca3af">VITESSE MAX</text>
  <text x="48" y="278" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="26" font-weight="800" fill="#ffffff">${summary.peakVelocityMps.toFixed(2)}</text>
  <text x="48" y="298" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="500" fill="#6b7280">m/s concentrique</text>

  <!-- 2. Velocity Loss -->
  <rect x="178" y="208" width="136" height="110" rx="14" fill="#14141a" stroke="#262633" />
  <text x="194" y="234" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600" fill="#9ca3af">PERTE VITESSE</text>
  <text x="194" y="278" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="26" font-weight="800" fill="#38bdf8">${summary.velocityLossPercent.toFixed(1)}%</text>
  <text x="194" y="298" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="500" fill="#6b7280">Fatigue estimée</text>

  <!-- 3. Cadence Ratio -->
  <rect x="324" y="208" width="136" height="110" rx="14" fill="#14141a" stroke="#262633" />
  <text x="340" y="234" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600" fill="#9ca3af">CADENCE</text>
  <text x="340" y="278" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="22" font-weight="800" fill="#ffffff">${summary.eccentricCadenceSec.toFixed(1)}s / ${summary.concentricCadenceSec.toFixed(1)}s</text>
  <text x="340" y="298" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="500" fill="#6b7280">Excentrique / Conc.</text>

  <!-- 4. Bilateral Symmetry -->
  <rect x="470" y="208" width="138" height="110" rx="14" fill="#14141a" stroke="#262633" />
  <text x="486" y="234" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="600" fill="#9ca3af">SYMÉTRIE</text>
  <text x="486" y="278" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="26" font-weight="800" fill="${symmetryColor}">${summary.bilateralSymmetryPercent.toFixed(1)}%</text>
  <text x="486" y="298" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="500" fill="#6b7280">Équilibre D/G</text>

  <!-- Quality Badges Row -->
  <rect x="32" y="334" width="576" height="54" rx="12" fill="#14141a" stroke="#262633" />
  <circle cx="56" cy="361" r="5" fill="${depthColor}" />
  <text x="70" y="366" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="600" fill="#ffffff">Profondeur validée (${summary.depthQuality.toUpperCase()})</text>

  <circle cx="280" cy="361" r="5" fill="#22c55e" />
  <text x="294" y="366" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="600" fill="#ffffff">Régularité ROM : ${summary.romConsistencyScore.toFixed(0)}/100</text>

  <text x="580" y="366" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600" fill="#38bdf8" text-anchor="end">WASM 60 FPS</text>

  <!-- Footer Zero-Server Sovereign Badge -->
  <rect x="32" y="404" width="576" height="44" rx="10" fill="#0f172a" stroke="#1e293b" />
  <text x="56" y="432" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="700" fill="#38bdf8">🔒 100% On-Device AI • Zero Cloud • 100% Private</text>
  <text x="580" y="432" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600" fill="#94a3b8" text-anchor="end">david-dabert.github.io/workout-vision</text>
</svg>
`.trim();
}
