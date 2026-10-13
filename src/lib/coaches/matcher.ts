/**
 * Coach & Physiotherapist Proximity Matchmaker Engine
 *
 * Implements privacy-first, local-side discovery matching lifters and rehabilitation
 * clients with verified coaches and licensed physical therapists.
 *
 * All matching logic runs 100% on-device in WebAssembly / JS. The user's coordinates
 * never leave the browser.
 */

export type CoachSpecialty =
  | 'rotator_cuff_shoulder'
  | 'lumbar_spine'
  | 'knee_acl_recovery'
  | 'hypertrophy_physique'
  | 'strength_powerlifting'
  | 'equine_veterinary'
  | 'posture_ergonomics'
  | 'olympic_weightlifting';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface CoachProfile {
  id: string;
  name: string;
  title: string; // e.g. "Doctor of Physical Therapy", "CSCS Strength Coach"
  organization?: string;
  avatarUrl?: string;
  credentials: ('DPT' | 'CSCS' | 'RAMP' | 'NAVP' | 'NASM' | 'FMS' | 'UKSCA' | 'FCCA')[];
  specialties: CoachSpecialty[];
  location: GeoPoint;
  city: string;
  country: string;
  hourlyRate: number; // in EUR or local currency
  currency: string;
  rating: number; // 1.0 - 5.0
  reviewCount: number;
  bioEn: string;
  bioFr: string;
  contactEmail?: string;
  isAvailable: boolean;
}

export interface SearchCriteria {
  userLocation: GeoPoint;
  maxDistanceKm?: number;
  requiredSpecialties?: CoachSpecialty[];
  credentialFilter?: string[];
  maxRate?: number;
  minRating?: number;
}

export interface MatchScoreBreakdown {
  distanceKm: number;
  distanceScore: number; // 0 - 100
  specialtyScore: number; // 0 - 100
  ratingScore: number; // 0 - 100
  credentialScore: number; // 0 - 100
  totalScore: number; // 0 - 100
}

export interface CoachMatchResult {
  coach: CoachProfile;
  score: MatchScoreBreakdown;
}

/**
 * Calculates Haversine great-circle distance between two geographic coordinates in kilometers.
 */
export function calculateHaversineDistanceKm(p1: GeoPoint, p2: GeoPoint): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;

  const lat1 = (p1.latitude * Math.PI) / 180;
  const lat2 = (p2.latitude * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Distance decay score: 1 / (1 + (d / d0)^gamma).
 * At d = 0 -> 100%, at d = 10km -> 50%, at d = 30km -> ~16%.
 */
export function calculateDistanceScore(distanceKm: number, d0 = 10, gamma = 1.5): number {
  if (distanceKm <= 0) return 100;
  const decay = 1 / (1 + Math.pow(distanceKm / d0, gamma));
  return decay * 100;
}

/**
 * Jaccard similarity across specialties: |Intersection| / |Union|.
 */
export function calculateSpecialtyScore(
  coachSpecialties: CoachSpecialty[],
  requiredSpecialties: CoachSpecialty[]
): number {
  if (!requiredSpecialties || requiredSpecialties.length === 0) return 80; // Baseline match
  const coachSet = new Set(coachSpecialties);
  const reqSet = new Set(requiredSpecialties);

  let intersection = 0;
  for (const s of reqSet) {
    if (coachSet.has(s)) intersection++;
  }

  const union = new Set([...coachSpecialties, ...requiredSpecialties]).size;
  if (union === 0) return 0;
  return (intersection / union) * 100;
}

/**
 * Default verified registry of practitioners across metropolitan clusters.
 */
export const VERIFIED_COACH_REGISTRY: CoachProfile[] = [
  {
    id: 'coach-fr-01',
    name: 'Julien Mercier, DPT',
    title: 'Docteur en Kinésithérapie du Sport & Préparateur CSCS',
    organization: 'Clinique République Performance',
    credentials: ['DPT', 'CSCS'],
    specialties: ['rotator_cuff_shoulder', 'knee_acl_recovery', 'hypertrophy_physique'],
    location: { latitude: 48.8672, longitude: 2.3638 }, // Paris République
    city: 'Paris',
    country: 'France',
    hourlyRate: 85,
    currency: 'EUR',
    rating: 4.96,
    reviewCount: 48,
    bioEn: 'Specialist in biomechanical rehab for competitive lifters, rotator cuff impaction, and ACL return-to-sport protocols.',
    bioFr: 'Spécialiste de la rééducation biomécanique pour athlètes de force, conflit sous-acromial et retour au sport post-LCA.',
    isAvailable: true,
  },
  {
    id: 'coach-fr-02',
    name: 'Camille Laurent',
    title: 'Entraîneur Haltérophilie & Hypertrophie Scientifique',
    organization: 'Barbell Club Bastille',
    credentials: ['CSCS', 'FMS'],
    specialties: ['hypertrophy_physique', 'strength_powerlifting', 'olympic_weightlifting'],
    location: { latitude: 48.8532, longitude: 2.3698 }, // Paris Bastille
    city: 'Paris',
    country: 'France',
    hourlyRate: 70,
    currency: 'EUR',
    rating: 4.92,
    reviewCount: 37,
    bioEn: 'Evidence-based physique and barbell coach focusing on lengthened partials, eccentric overload, and technical mastery.',
    bioFr: 'Coach haltérophilie et hypertrophie axé sur les partielles étirées, la surcharge excentrique et la maîtrise technique.',
    isAvailable: true,
  },
  {
    id: 'coach-uk-01',
    name: 'Dr. Alistair Vance, DPT MSc',
    title: 'Consultant Sports Physiotherapist & Spine Specialist',
    organization: 'London Orthopaedic & Movement Centre',
    credentials: ['DPT', 'UKSCA'],
    specialties: ['lumbar_spine', 'posture_ergonomics', 'rotator_cuff_shoulder'],
    location: { latitude: 51.5154, longitude: -0.1419 }, // London Marylebone
    city: 'London',
    country: 'United Kingdom',
    hourlyRate: 110,
    currency: 'GBP',
    rating: 4.98,
    reviewCount: 62,
    bioEn: 'Clinical lead in lumbar disc herniation rehabilitation, pelvic symmetry restoration, and workstation ergonomics.',
    bioFr: 'Consultant en réhabilitation discale lombaire, correction des asymétries du bassin et ergonomie du poste de travail.',
    isAvailable: true,
  },
  {
    id: 'coach-vet-01',
    name: 'Sarah Smith, MSc',
    title: 'Equine & Canine Veterinary Physiotherapist',
    organization: 'EquiMotion Biomechanics Clinic',
    credentials: ['RAMP', 'NAVP', 'FCCA'],
    specialties: ['equine_veterinary', 'posture_ergonomics'],
    location: { latitude: 52.2053, longitude: 0.1218 }, // Cambridge / Newmarket
    city: 'Cambridge',
    country: 'United Kingdom',
    hourlyRate: 95,
    currency: 'GBP',
    rating: 4.99,
    reviewCount: 84,
    bioEn: 'Pioneer in objective trot-up kinematics, circle lunge symmetry, and veterinary rehabilitation monitoring for sport horses.',
    bioFr: 'Experte en cinématique objective au trot, asymétrie en longe et suivi de rééducation vétérinaire pour chevaux de sport.',
    isAvailable: true,
  },
  {
    id: 'coach-us-01',
    name: 'Marcus Brody, CSCS',
    title: 'Director of Strength & Conditioning',
    organization: 'Flatiron Athletic Lab',
    credentials: ['CSCS', 'NASM', 'FMS'],
    specialties: ['strength_powerlifting', 'hypertrophy_physique', 'knee_acl_recovery'],
    location: { latitude: 40.7411, longitude: -73.9897 }, // New York Flatiron
    city: 'New York',
    country: 'United States',
    hourlyRate: 125,
    currency: 'USD',
    rating: 4.95,
    reviewCount: 53,
    bioEn: 'Coach to collegiate powerlifters and physique athletes. Precision load periodization and velocity-based training.',
    bioFr: 'Entraîneur d’athlètes de force et culturistes. Périodisation précise et entraînement basé sur la vitesse (VBT).',
    isAvailable: true,
  },
  {
    id: 'coach-de-01',
    name: 'Felix Weber, PT MSc',
    title: 'Physiotherapeut & Biomechanik-Experte',
    organization: 'Berlin Reha-Zentrum Mitte',
    credentials: ['DPT', 'FMS'],
    specialties: ['rotator_cuff_shoulder', 'lumbar_spine', 'posture_ergonomics'],
    location: { latitude: 52.52, longitude: 13.405 }, // Berlin Mitte
    city: 'Berlin',
    country: 'Germany',
    hourlyRate: 80,
    currency: 'EUR',
    rating: 4.89,
    reviewCount: 29,
    bioEn: 'Integrative physical therapy specializing in upper crossed syndrome, scapular dyskinesis, and spine stability.',
    bioFr: 'Kinésithérapie intégrative spécialisée dans la dyskinésie scapulaire et la stabilité vertébrale.',
    isAvailable: true,
  },
];

/**
 * Searches and ranks nearest coaches using multi-objective scoring:
 * Total = w_dist * Distance + w_spec * Specialty + w_rate * Rating + w_cred * Credentials.
 */
export function findNearestCoaches(
  criteria: SearchCriteria,
  registry: CoachProfile[] = VERIFIED_COACH_REGISTRY
): CoachMatchResult[] {
  const {
    userLocation,
    maxDistanceKm = 500,
    requiredSpecialties = [],
    credentialFilter = [],
    maxRate,
    minRating = 0,
  } = criteria;

  const results: CoachMatchResult[] = [];

  for (const coach of registry) {
    if (!coach.isAvailable) continue;
    if (minRating > 0 && coach.rating < minRating) continue;
    if (maxRate && coach.hourlyRate > maxRate) continue;
    if (
      credentialFilter.length > 0 &&
      !credentialFilter.some(c => coach.credentials.includes(c as any))
    ) {
      continue;
    }

    const distanceKm = calculateHaversineDistanceKm(userLocation, coach.location);
    if (distanceKm > maxDistanceKm) continue;

    const distanceScore = calculateDistanceScore(distanceKm);
    const specialtyScore = calculateSpecialtyScore(coach.specialties, requiredSpecialties);
    const ratingScore = Math.min(100, (coach.rating / 5.0) * 100);
    const credentialScore = Math.min(100, coach.credentials.length * 35);

    // Multi-objective weighting:
    // Distance (35%), Specialty (30%), Rating (20%), Credentials (15%)
    const totalScore =
      0.35 * distanceScore +
      0.30 * specialtyScore +
      0.20 * ratingScore +
      0.15 * credentialScore;

    results.push({
      coach,
      score: {
        distanceKm,
        distanceScore,
        specialtyScore,
        ratingScore,
        credentialScore,
        totalScore,
      },
    });
  }

  // Sort descending by total score
  results.sort((a, b) => b.score.totalScore - a.score.totalScore);
  return results;
}
