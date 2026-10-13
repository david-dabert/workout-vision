/**
 * Gym Buddy & Training Partner Matchmaker Engine
 *
 * Connects lifters by training facility, workout split, preferred schedule,
 * and strength parity for mutual spotting and shared progression.
 *
 * 100% on-device matching logic.
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
  facility: string; // e.g. "Fitness Park République"
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
  strengthParityPct: number; // 0 - 100% (100 = identical working weights)
  totalScore: number; // 0 - 100
}

export interface BuddyMatchResult {
  buddy: BuddyProfile;
  score: BuddyMatchScore;
}

/**
 * Calculates strength parity between two lifters based on working compound weights.
 * Working weights within 20% give 100 parity; large differences drop down to allow
 * safe, convenient spotting without constant plate stripping.
 */
export function calculateStrengthParity(c1: CompoundStats, c2: CompoundStats): number {
  const benchDiff = Math.abs(c1.benchPressKg - c2.benchPressKg) / Math.max(c1.benchPressKg, c2.benchPressKg, 1);
  const squatDiff = Math.abs(c1.squatKg - c2.squatKg) / Math.max(c1.squatKg, c2.squatKg, 1);
  const meanDiff = (benchDiff + squatDiff) / 2;

  // If within 15%, 100%; decays smoothly beyond that
  if (meanDiff <= 0.15) return 100;
  return Math.max(20, Math.round((1 - meanDiff) * 100));
}

export const ACTIVE_BUDDIES_POOL: BuddyProfile[] = [
  {
    id: 'buddy-01',
    name: 'Antoine D.',
    age: 26,
    facility: 'Fitness Park République',
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
  },
  {
    id: 'buddy-02',
    name: 'Léa M.',
    age: 24,
    facility: 'Fitness Park République',
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
  },
  {
    id: 'buddy-03',
    name: 'Lucas B.',
    age: 29,
    facility: 'Basic-Fit Bastille',
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
  },
  {
    id: 'buddy-04',
    name: 'Sam T.',
    age: 27,
    facility: 'Gymbox Bank',
    city: 'London',
    split: 'ppl',
    timeWindow: 'evening',
    trainingDaysPerWeek: 5,
    compounds: { benchPressKg: 95, squatKg: 125, deadliftKg: 155 },
    experienceYears: 3,
    bioEn: 'After-work training partner needed for chest and leg days. High intensity, RPE 9-10.',
    bioFr: 'Cherche partenaire après le travail pour séances pecs et jambes. Haute intensité.',
    canSpotHeavy: true,
    isLookingForPartner: true,
  },
  {
    id: 'buddy-05',
    name: 'Emma W.',
    age: 25,
    facility: 'Equinox Nomad',
    city: 'New York',
    split: 'upper_lower',
    timeWindow: 'morning',
    trainingDaysPerWeek: 4,
    compounds: { benchPressKg: 60, squatKg: 90, deadliftKg: 110 },
    experienceYears: 4,
    bioEn: 'Morning lifter (6:30 AM). Consistency and proper form first. Looking for motivation buddy.',
    bioFr: 'Entraînement matinal (6h30). Priorité à la régularité et à la forme stricte.',
    canSpotHeavy: true,
    isLookingForPartner: true,
  },
];

/**
 * Matches lifters with compatible gym buddies based on facility, schedule, split, and strength parity.
 */
export function findCompatibleBuddies(
  criteria: BuddySearchCriteria,
  pool: BuddyProfile[] = ACTIVE_BUDDIES_POOL
): BuddyMatchResult[] {
  const { facility, city, split, timeWindow, userCompounds } = criteria;
  const results: BuddyMatchResult[] = [];

  for (const buddy of pool) {
    if (!buddy.isLookingForPartner) continue;
    if (city && buddy.city.toLowerCase() !== city.toLowerCase()) continue;

    const facilityMatch = facility ? buddy.facility.toLowerCase().includes(facility.toLowerCase()) : true;
    const scheduleMatch = timeWindow ? buddy.timeWindow === timeWindow : true;
    const splitMatch = split ? buddy.split === split : true;

    let strengthParityPct = 80; // default baseline if user hasn't specified
    if (userCompounds) {
      strengthParityPct = calculateStrengthParity(userCompounds, buddy.compounds);
    }

    // Weighting:
    // Facility (35%), Schedule (30%), Split (20%), Strength Parity (15%)
    let score = 0;
    if (facilityMatch) score += 35;
    if (scheduleMatch) score += 30;
    if (splitMatch) score += 20;
    score += (strengthParityPct / 100) * 15;

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
