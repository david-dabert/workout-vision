/**
 * The coach and physiotherapist directory (CoachFinder.jsx): a demo until real sign-ups.
 *
 * Honesty pass of 14 October 2026 (FND-1, FND-2 and the missed filter item). The list used to be named
 * VERIFIED_COACH_REGISTRY and held six invented practitioners with real registers (RAMP, NAVP), an accountancy
 * fellowship (FCCA) given to a physiotherapist, a French title that does not exist ("Docteur en Kinésithérapie du
 * Sport"), clinic names, prices, star ratings and review counts. Nobody was verified. They are replaced by
 * DEMO_COACH_PROFILES: clearly fictional placeholders, "Coach exemple A", with no credential, register, organisation,
 * price, rating or review. A specialty chosen now filters (a non-matching profile only lost points before), and the
 * search stays within the chosen city.
 * The real directory: coaches sign up, their carte professionnelle is checked against the Ministry of Sports' public
 * lookup, physiotherapists by their RPPS number; both need a backend and consent (not built).
 * French copy of the profiles: awaiting David's approval (R10).
 */

export type CoachSpecialty = 'rehab' | 'hypertrophy' | 'strength';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface DemoCoachProfile {
  id: string;
  /** A placeholder that reads as one: "Coach exemple A". */
  name: string;
  roleFr: string;
  roleEn: string;
  specialties: CoachSpecialty[];
  city: string;
  bioFr: string;
  bioEn: string;
  /** Always true: no profile here is a real person. */
  fictional: true;
}

/** The cities the demo offers, chosen by the person (the phone's location is never read). */
export const DEMO_CITIES: { name: string; coords: GeoPoint }[] = [
  { name: 'Paris', coords: { latitude: 48.8566, longitude: 2.3522 } },
  { name: 'Lyon', coords: { latitude: 45.764, longitude: 4.8357 } },
  { name: 'Marseille', coords: { latitude: 43.2965, longitude: 5.3698 } },
  { name: 'Bordeaux', coords: { latitude: 44.8378, longitude: -0.5792 } },
  { name: 'Lille', coords: { latitude: 50.6292, longitude: 3.0573 } },
];

const COACH = { roleFr: 'Coach de musculation', roleEn: 'Strength coach' };
const PHYSIO = { roleFr: 'Kinésithérapeute', roleEn: 'Physiotherapist' };
const PREP = { roleFr: 'Préparateur physique', roleEn: 'Strength and conditioning coach' };
const BIO = {
  coach: { bioFr: 'Exemple de présentation\u00A0: séances au plateau, suivi de la technique et de la progression.', bioEn: 'Sample profile: gym sessions, technique and progress follow-up.' },
  physio: { bioFr: 'Exemple de présentation\u00A0: reprise de l’entraînement après une blessure, en lien avec le médecin.', bioEn: 'Sample profile: return to training after an injury, with the doctor.' },
  prep: { bioFr: 'Exemple de présentation\u00A0: force et préparation physique pour la compétition.', bioEn: 'Sample profile: strength and conditioning for competition.' },
};

/** Fictional placeholders, two or three a city, so the demo shows what the directory will look like. */
export const DEMO_COACH_PROFILES: DemoCoachProfile[] = [
  { id: 'demo-paris-a', name: 'Coach exemple A', ...COACH, ...BIO.coach, specialties: ['hypertrophy', 'strength'], city: 'Paris', fictional: true },
  { id: 'demo-paris-b', name: 'Kiné exemple B', ...PHYSIO, ...BIO.physio, specialties: ['rehab'], city: 'Paris', fictional: true },
  { id: 'demo-paris-c', name: 'Préparateur exemple C', ...PREP, ...BIO.prep, specialties: ['strength'], city: 'Paris', fictional: true },
  { id: 'demo-lyon-a', name: 'Coach exemple D', ...COACH, ...BIO.coach, specialties: ['hypertrophy'], city: 'Lyon', fictional: true },
  { id: 'demo-lyon-b', name: 'Kiné exemple E', ...PHYSIO, ...BIO.physio, specialties: ['rehab'], city: 'Lyon', fictional: true },
  { id: 'demo-marseille-a', name: 'Coach exemple F', ...COACH, ...BIO.coach, specialties: ['hypertrophy', 'strength'], city: 'Marseille', fictional: true },
  { id: 'demo-marseille-b', name: 'Kiné exemple G', ...PHYSIO, ...BIO.physio, specialties: ['rehab'], city: 'Marseille', fictional: true },
  { id: 'demo-bordeaux-a', name: 'Préparateur exemple H', ...PREP, ...BIO.prep, specialties: ['strength'], city: 'Bordeaux', fictional: true },
  { id: 'demo-bordeaux-b', name: 'Kiné exemple I', ...PHYSIO, ...BIO.physio, specialties: ['rehab'], city: 'Bordeaux', fictional: true },
  { id: 'demo-lille-a', name: 'Coach exemple J', ...COACH, ...BIO.coach, specialties: ['hypertrophy'], city: 'Lille', fictional: true },
  { id: 'demo-lille-b', name: 'Kiné exemple K', ...PHYSIO, ...BIO.physio, specialties: ['rehab'], city: 'Lille', fictional: true },
];

/** The profiles of a city, those of a specialty only when one is chosen; [] when none matches. */
export function demoProfilesFor(city: string, specialty: CoachSpecialty | 'all' = 'all', profiles: DemoCoachProfile[] = DEMO_COACH_PROFILES): DemoCoachProfile[] {
  return profiles.filter(p => p.city === city && (specialty === 'all' || p.specialties.includes(specialty)));
}

/**
 * Haversine great-circle distance between two points in kilometres (mean Earth radius 6371 km). Kept for the real
 * directory; the demo shows no distance, its profiles having no address.
 */
export function calculateHaversineDistanceKm(p1: GeoPoint, p2: GeoPoint): number {
  const R = 6371;
  const dLat = ((p2.latitude - p1.latitude) * Math.PI) / 180;
  const dLon = ((p2.longitude - p1.longitude) * Math.PI) / 180;
  const lat1 = (p1.latitude * Math.PI) / 180;
  const lat2 = (p2.latitude * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
