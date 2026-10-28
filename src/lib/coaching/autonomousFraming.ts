/**
 * Autonomous Camera Framing Assistant
 * 
 * Analyzes normalized pose landmark coordinates ([0, 1] x [0, 1]) in real-time
 * to determine whether the athlete is adequately framed for computer vision analysis.
 * Produces deterministic, non-spamming verbal coaching cues through earbuds to guide
 * athletes into the optimal lifting envelope without touching or looking at the phone.
 * 
 * Strict Invariants:
 * - 100% Client-side purity (zero server latency or dependency).
 * - French typography compliance: non-breaking space (\u00A0) before ':', ';', '?', '!'.
 */

export type FramingStatus = 
  | 'NO_PERSON'
  | 'TOO_CLOSE'
  | 'TOO_FAR'
  | 'FEET_CUT_OFF'
  | 'HEAD_CUT_OFF'
  | 'OFF_CENTER_LEFT'
  | 'OFF_CENTER_RIGHT'
  | 'OPTIMAL';

export interface FramingEvaluation {
  status: FramingStatus;
  isReadyToLift: boolean;
  cueFr: string;
  cueEn: string;
  athleteHeightRatio: number; // e.g. 0.65 of viewport
  centerOffset: number; // -0.5 (far left) to +0.5 (far right)
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

const MIN_VISIBILITY = 0.5;

/**
 * Evaluates athlete framing from MediaPipe pose landmarks.
 * 
 * @param landmarks Array of 33 pose landmarks
 * @param requiresWholeBody Whether the exercise requires full lower body tracking (e.g. squats, leg press)
 */
export function evaluateFraming(
  landmarks: LandmarkPoint[] | null | undefined,
  requiresWholeBody = true
): FramingEvaluation {
  if (!landmarks || landmarks.length < 33) {
    return {
      status: 'NO_PERSON',
      isReadyToLift: false,
      cueFr: 'Placez-vous face ou de profil à la caméra.',
      cueEn: 'Step in front of the camera.',
      athleteHeightRatio: 0,
      centerOffset: 0,
    };
  }

  const nose = landmarks[0];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  const hipVis = ((leftHip?.visibility ?? 0) + (rightHip?.visibility ?? 0)) / 2;
  const shoulderVis = ((leftShoulder?.visibility ?? 0) + (rightShoulder?.visibility ?? 0)) / 2;

  // Person not sufficiently visible
  if (hipVis < MIN_VISIBILITY && shoulderVis < MIN_VISIBILITY) {
    return {
      status: 'NO_PERSON',
      isReadyToLift: false,
      cueFr: 'Placez-vous face ou de profil à la caméra.',
      cueEn: 'Step in front of the camera.',
      athleteHeightRatio: 0,
      centerOffset: 0,
    };
  }

  const midHipX = ((leftHip?.x ?? 0.5) + (rightHip?.x ?? 0.5)) / 2;
  const midHipY = ((leftHip?.y ?? 0.5) + (rightHip?.y ?? 0.5)) / 2;
  const centerOffset = midHipX - 0.5;

  // Horizontal Centering Check (must be within [0.15, 0.85])
  if (midHipX < 0.15) {
    return {
      status: 'OFF_CENTER_LEFT',
      isReadyToLift: false,
      cueFr: 'Déplacez-vous légèrement vers la droite.',
      cueEn: 'Step slightly to your right.',
      athleteHeightRatio: 0.6,
      centerOffset,
    };
  }
  if (midHipX > 0.85) {
    return {
      status: 'OFF_CENTER_RIGHT',
      isReadyToLift: false,
      cueFr: 'Déplacez-vous légèrement vers la gauche.',
      cueEn: 'Step slightly to your left.',
      athleteHeightRatio: 0.6,
      centerOffset,
    };
  }

  // Head Cut-Off Check
  if (nose && (nose.visibility ?? 1) > MIN_VISIBILITY && nose.y < 0.04) {
    return {
      status: 'HEAD_CUT_OFF',
      isReadyToLift: false,
      cueFr: 'Inclinez légèrement le téléphone vers le haut.',
      cueEn: 'Tilt the phone slightly upward.',
      athleteHeightRatio: 0.7,
      centerOffset,
    };
  }

  if (requiresWholeBody) {
    const ankleVis = ((leftAnkle?.visibility ?? 0) + (rightAnkle?.visibility ?? 0)) / 2;
    const lowerY = Math.max(leftAnkle?.y ?? 0, rightAnkle?.y ?? 0);

    // Feet Cut-Off Check
    if (ankleVis < MIN_VISIBILITY || lowerY > 0.96) {
      return {
        status: 'FEET_CUT_OFF',
        isReadyToLift: false,
        cueFr: 'Reculez d’un pas pour cadrer les pieds.',
        cueEn: 'Step back to bring your feet into view.',
        athleteHeightRatio: 0.85,
        centerOffset,
      };
    }

    const topY = nose && (nose.visibility ?? 1) > MIN_VISIBILITY ? nose.y : Math.min(leftShoulder?.y ?? 0.2, rightShoulder?.y ?? 0.2);
    const heightRatio = Math.max(0.1, lowerY - topY);

    if (heightRatio < 0.38) {
      return {
        status: 'TOO_FAR',
        isReadyToLift: false,
        cueFr: 'Rapprochez-vous un peu de la caméra.',
        cueEn: 'Step slightly closer to the camera.',
        athleteHeightRatio: heightRatio,
        centerOffset,
      };
    }

    if (heightRatio > 0.92) {
      return {
        status: 'TOO_CLOSE',
        isReadyToLift: false,
        cueFr: 'Reculez d’un pas pour avoir plus de marge.',
        cueEn: 'Step back one pace for better framing.',
        athleteHeightRatio: heightRatio,
        centerOffset,
      };
    }

    return {
      status: 'OPTIMAL',
      isReadyToLift: true,
      cueFr: 'Cadrage optimal. Stabilisez-vous pour démarrer.',
      cueEn: 'Optimal framing. Hold still to begin.',
      athleteHeightRatio: heightRatio,
      centerOffset,
    };
  }

  // Upper-body exercise (e.g. curls, bench press, chest-supported row)
  const topY = nose && (nose.visibility ?? 1) > MIN_VISIBILITY ? nose.y : Math.min(leftShoulder?.y ?? 0.2, rightShoulder?.y ?? 0.2);
  const heightRatio = Math.max(0.1, midHipY - topY);

  if (heightRatio < 0.20) {
    return {
      status: 'TOO_FAR',
      isReadyToLift: false,
      cueFr: 'Rapprochez-vous de la caméra.',
      cueEn: 'Step closer to the camera.',
      athleteHeightRatio: heightRatio,
      centerOffset,
    };
  }

  return {
    status: 'OPTIMAL',
    isReadyToLift: true,
    cueFr: 'Cadrage optimal. Stabilisez-vous pour démarrer.',
    cueEn: 'Optimal framing. Hold still to begin.',
    athleteHeightRatio: heightRatio,
    centerOffset,
  };
}

/**
 * State machine managing verbal coaching announcements for framing.
 * Prevents rapid-fire speech spamming while guiding the lifter.
 */
export class AutonomousFramingCoach {
  private lastSpokenStatus: FramingStatus | null = null;
  private lastSpokenTimestamp = 0;
  private candidateStatus: FramingStatus | null = null;
  private candidateFirstSeenTimestamp = 0;

  // Minimal time a framing condition must persist before speaking (ms)
  private readonly persistenceMs: number;
  // Minimal cooldown between two verbal utterances (ms)
  private readonly cooldownMs: number;

  constructor(persistenceMs = 800, cooldownMs = 3500) {
    this.persistenceMs = persistenceMs;
    this.cooldownMs = cooldownMs;
  }

  /**
   * Evaluates current framing and returns a phrase to speak if warranted.
   * Returns null if no speech is warranted (cooldown, not persisted, or already spoken).
   */
  public update(evaluation: FramingEvaluation, nowMs = Date.now()): string | null {
    const currentStatus = evaluation.status;

    // Track stability of candidate status
    if (this.candidateStatus !== currentStatus) {
      this.candidateStatus = currentStatus;
      this.candidateFirstSeenTimestamp = nowMs;
      return null;
    }

    const durationInState = nowMs - this.candidateFirstSeenTimestamp;
    if (durationInState < this.persistenceMs) {
      return null;
    }

    const timeSinceLastSpoken = nowMs - this.lastSpokenTimestamp;

    // If already spoken this status and under cooldown, suppress
    if (this.lastSpokenStatus === currentStatus) {
      // Re-prompt only if user stays stuck in an error state for > 8s
      if (currentStatus !== 'OPTIMAL' && timeSinceLastSpoken > 8000) {
        this.lastSpokenTimestamp = nowMs;
        return evaluation.cueFr;
      }
      return null;
    }

    // New persisted status, check minimal utterance cooldown
    if (this.lastSpokenTimestamp > 0 && timeSinceLastSpoken < this.cooldownMs) {
      return null;
    }

    this.lastSpokenStatus = currentStatus;
    this.lastSpokenTimestamp = nowMs;
    return evaluation.cueFr;
  }

  public reset(): void {
    this.lastSpokenStatus = null;
    this.lastSpokenTimestamp = 0;
    this.candidateStatus = null;
    this.candidateFirstSeenTimestamp = 0;
  }
}
