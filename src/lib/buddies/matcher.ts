/**
 * Gym Buddy (GymBuddy.jsx): a demo of partner matching, with fictional profiles in fictional gyms.
 *
 * Honesty pass of 14 October 2026 (BUD-1 to BUD-3 and the missed filter item): the profiles were placed at real,
 * named clubs (Fitness Park République, Basic-Fit Bastille, Gymbox Bank, Equinox Nomad), and the screen promised a
 * roll-out with those chains; they now train at "Salle exemple A" and the like, and are tagged as fictional. A split
 * chosen now filters (a different split only lost points before). The parity comment said 20 %; the code uses 15 %.
 * Nobody is put in touch with anybody: there is no such service. French of the profiles awaiting David's approval (R10).
 */

export type TrainingSplit = 'ppl' | 'upper_lower' | 'bro_split' | 'full_body' | 'powerlifting';
export type TimeWindow = 'morning' | 'lunch' | 'evening' | 'night';

export interface CompoundStats {
  benchPressKg: number;
  squatKg: number;
  deadliftKg?: number;
}

export interface BuddyProfile {
  id: string;
  name: string;
  age: number;
  facility: string; // a fictional gym, "Salle exemple A"
  city: string;
  split: TrainingSplit;
  timeWindow: TimeWindow;
  trainingDaysPerWeek: number;
  compounds: CompoundStats;
  experienceYears: number;
  bioEn: string;
  bioFr: string;
  canSpotHeavy: boolean;
  isLookingForPartner: boolean;
  /** Always true: no profile here is a real person. */
  fictional: true;
}

export interface BuddySearchCriteria {
  facility?: string;
  city?: string;
  split?: TrainingSplit;
  timeWindow?: TimeWindow;
  userCompounds?: CompoundStats;
}

export interface BuddyMatchScore {
  facilityMatch: boolean;
  scheduleMatch: boolean;
  splitMatch: boolean;
  strengthParityPct: number | null; // 20 - 100 % (100 = within 15 %); null without the person's weights
  totalScore: number; // 0 - 100
}

export interface BuddyMatchResult {
  buddy: BuddyProfile;
  score: BuddyMatchScore;
}

/**
 * Strength parity between two lifters' working weights (bench and squat): 100 when their mean relative difference is
 * within 15 %, then 100 × (1 − difference), never under 20. Status: convention (UNSOURCED; a comparison of two typed
 * values, not a measure).
 */
export function calculateStrengthParity(c1: CompoundStats, c2: CompoundStats): number {
  const benchDiff = Math.abs(c1.benchPressKg - c2.benchPressKg) / Math.max(c1.benchPressKg, c2.benchPressKg, 1);
  const squatDiff = Math.abs(c1.squatKg - c2.squatKg) / Math.max(c1.squatKg, c2.squatKg, 1);
  const meanDiff = (benchDiff + squatDiff) / 2;

  // If within 15%, 100%; decays smoothly beyond that
  if (meanDiff <= 0.15) return 100;
  return Math.max(20, Math.round((1 - meanDiff) * 100));
}

/** Fictional profiles in fictional gyms, for the demo. */
export const DEMO_BUDDY_PROFILES: BuddyProfile[] = [
  {
    id: 'buddy-01',
    name: 'Antoine D.',
    age: 26,
    facility: 'Salle exemple A',
    city: 'Paris',
    split: 'ppl',
    timeWindow: 'evening',
    trainingDaysPerWeek: 5,
    compounds: { benchPressKg: 100, squatKg: 130, deadliftKg: 160 },
    experienceYears: 4,
    bioEn: 'PPL lifter training at 6:30 PM. Looking for a reliable spotter on heavy bench & squat working sets.',
    bioFr: 'Pratiquant PPL s’entraînant à 18h30. Cherche un partenaire régulier pour parer sur les séries lourdes.',
    canSpotHeavy: true,
    isLookingForPartner: true,
    fictional: true,
  },
  {
    id: 'buddy-02',
    name: 'Léa M.',
    age: 24,
    facility: 'Salle exemple A',
    city: 'Paris',
    split: 'upper_lower',
    timeWindow: 'evening',
    trainingDaysPerWeek: 4,
    compounds: { benchPressKg: 55, squatKg: 85, deadliftKg: 105 },
    experienceYears: 3,
    bioEn: 'Hypertrophy focused Upper/Lower split. Big emphasis on lengthened partials and tempo control.',
    bioFr: 'Format Haut/Bas orienté hypertrophie. Focus sur les partielles étirées et le contrôle du tempo.',
    canSpotHeavy: true,
    isLookingForPartner: true,
    fictional: true,
  },
  {
    id: 'buddy-03',
    name: 'Lucas B.',
    age: 29,
    facility: 'Salle exemple B',
    city: 'Paris',
    split: 'powerlifting',
    timeWindow: 'morning',
    trainingDaysPerWeek: 4,
    compounds: { benchPressKg: 120, squatKg: 160, deadliftKg: 200 },
    experienceYears: 6,
    bioEn: 'Early morning powerlifter (7:00 AM). RPE tracking and technical barbell work.',
    bioFr: 'Powerlifter matinal (7h00). Travail technique à la barre et suivi RPE.',
    canSpotHeavy: true,
    isLookingForPartner: true,
    fictional: true,
  },
  {
    id: 'buddy-04',
    name: 'Sam T.',
    age: 27,
    facility: 'Salle exemple C',
    city: 'Lyon',
    split: 'ppl',
    timeWindow: 'evening',
    trainingDaysPerWeek: 5,
    compounds: { benchPressKg: 95, squatKg: 125, deadliftKg: 155 },
    experienceYears: 3,
    bioEn: 'After-work training partner needed for chest and leg days. High intensity, RPE 9-10.',
    bioFr: 'Cherche partenaire après le travail pour séances pecs et jambes. Haute intensité.',
    canSpotHeavy: true,
    isLookingForPartner: true,
    fictional: true,
  },
  {
    id: 'buddy-05',
    name: 'Emma W.',
    age: 25,
    facility: 'Salle exemple D',
    city: 'Lyon',
    split: 'upper_lower',
    timeWindow: 'morning',
    trainingDaysPerWeek: 4,
    compounds: { benchPressKg: 60, squatKg: 90, deadliftKg: 110 },
    experienceYears: 4,
    bioEn: 'Morning lifter (6:30 AM). Consistency and strict technique first. Looking for a motivation buddy.',
    bioFr: 'Entraînement matinal (6\u00A0h\u00A030). Priorité à la régularité et à une technique stricte.',
    canSpotHeavy: true,
    isLookingForPartner: true,
    fictional: true,
  },
];

/**
 * Matches lifters with compatible gym buddies based on facility, schedule, split, and strength parity.
 */
export function findCompatibleBuddies(
  criteria: BuddySearchCriteria,
  pool: BuddyProfile[] = DEMO_BUDDY_PROFILES
): BuddyMatchResult[] {
  const { facility, city, split, timeWindow, userCompounds } = criteria;
  const results: BuddyMatchResult[] = [];

  for (const buddy of pool) {
    if (!buddy.isLookingForPartner) continue;
    if (city && buddy.city.toLowerCase() !== city.toLowerCase()) continue;

    const facilityMatch = facility ? buddy.facility.toLowerCase().includes(facility.toLowerCase()) : true;
    const scheduleMatch = timeWindow ? buddy.timeWindow === timeWindow : true;
    const splitMatch = split ? buddy.split === split : true;
    // A split chosen filters: a partner on another split is not listed (the missed item of 14 October 2026).
    if (!splitMatch) continue;

    // No parity without the person's own working weights: nothing is assumed for them.
    const strengthParityPct = userCompounds ? calculateStrengthParity(userCompounds, buddy.compounds) : null;

    // Weighting:
    // Facility (35%), Schedule (30%), Split (20%), Strength Parity (15%)
    let score = 0;
    if (facilityMatch) score += 35;
    if (scheduleMatch) score += 30;
    if (splitMatch) score += 20;
    score += ((strengthParityPct ?? 0) / 100) * 15;

    results.push({
      buddy,
      score: {
        facilityMatch,
        scheduleMatch,
        splitMatch,
        strengthParityPct,
        totalScore: Math.round(score),
      },
    });
  }

  results.sort((a, b) => b.score.totalScore - a.score.totalScore);
  return results;
}
