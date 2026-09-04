/**
 * Local storage layer using IndexedDB (via localforage) for all user data.
 * Everything stays on device.
 */

import localforage from 'localforage';
import { calculateBMR, ACTIVITY_MULTIPLIERS } from './nutrition';

const profileStore = localforage.createInstance({ name: 'workoutVision', storeName: 'profile' });
const workoutStore = localforage.createInstance({ name: 'workoutVision', storeName: 'workouts' });
const medicalStore = localforage.createInstance({ name: 'workoutVision', storeName: 'medical' });
const foodStore = localforage.createInstance({ name: 'workoutVision', storeName: 'food' });
const milestoneStore = localforage.createInstance({ name: 'workoutVision', storeName: 'milestones' });

// User profile
export async function saveProfile(profile) {
  await profileStore.setItem('userProfile', {
    ...profile,
    updatedAt: Date.now(),
  });
}

export async function getProfile() {
  return await profileStore.getItem('userProfile');
}

// Workouts
export async function saveWorkout(workout) {
  const id = `workout_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry = {
    id,
    ...workout,
    createdAt: Date.now(),
  };
  await workoutStore.setItem(id, entry);
  return id;
}

export async function getWorkout(id) {
  return await workoutStore.getItem(id);
}

export async function getAllWorkouts() {
  const workouts = [];
  await workoutStore.iterate((value) => {
    workouts.push(value);
  });
  return workouts.sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateWorkout(id, updates) {
  const existing = await workoutStore.getItem(id);
  if (!existing) return;
  const updated = { ...existing, ...updates, updatedAt: Date.now() };
  await workoutStore.setItem(id, updated);
  return updated;
}

export async function deleteWorkout(id) {
  await workoutStore.removeItem(id);
}

// Medical records
export async function saveMedicalRecord(record) {
  const id = `medical_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry = {
    id,
    ...record,
    uploadedAt: Date.now(),
  };
  await medicalStore.setItem(id, entry);
  return id;
}

export async function getMedicalRecords() {
  const records = [];
  await medicalStore.iterate((value) => {
    records.push(value);
  });
  return records.sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export async function deleteMedicalRecord(id) {
  await medicalStore.removeItem(id);
}

// Food log
export async function saveFoodEntry(entry) {
  const id = `food_${Date.now()}`;
  const record = {
    id,
    ...entry,
    loggedAt: Date.now(),
  };
  await foodStore.setItem(id, record);
  return id;
}

export async function getFoodLog(dateStr) {
  const entries = [];
  await foodStore.iterate((value) => {
    entries.push(value);
  });
  if (dateStr) {
    const dayStart = new Date(dateStr);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateStr);
    dayEnd.setHours(23, 59, 59, 999);
    return entries
      .filter(e => e.loggedAt >= dayStart.getTime() && e.loggedAt <= dayEnd.getTime())
      .sort((a, b) => b.loggedAt - a.loggedAt);
  }
  return entries.sort((a, b) => b.loggedAt - a.loggedAt);
}

export async function deleteFoodEntry(id) {
  await foodStore.removeItem(id);
}

/**
 * Calculate physiological baselines from profile.
 * Based on validated equations from exercise physiology literature.
 */
export function calculateBaselines(profile) {
  if (!profile) return null;

  const { weight, height, age, sex, ethnicity } = profile;
  const weightKg = parseFloat(weight);
  let heightCm = parseFloat(height);
  const ageYears = parseFloat(age);

  if (!weightKg || !heightCm || !ageYears) return null;

  // Auto-detect meters vs cm: if height < 3, user entered meters (e.g. 1.89)
  if (heightCm > 0 && heightCm < 3) heightCm = heightCm * 100;

  // Sanity: reject clearly impossible values
  if (weightKg < 20 || weightKg > 300 || heightCm < 80 || heightCm > 260 || ageYears < 5 || ageYears > 120) return null;

  // BMI
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  // BMR using Mifflin-St Jeor (1990) — single source in nutrition.js
  const bmr = calculateBMR(weightKg, heightCm, ageYears, sex);

  // Body fat estimation (Deurenberg 1991, BMI-based; SEE 4-5%)
  let estimatedBF;
  if (sex === 'male') {
    estimatedBF = 1.2 * bmi + 0.23 * ageYears - 16.2;
  } else {
    estimatedBF = 1.2 * bmi + 0.23 * ageYears - 5.4;
  }

  // Max heart rate (Tanaka 2001: more accurate than 220-age)
  const maxHR = 208 - 0.7 * ageYears;

  // Training zones (Karvonen method)
  const restHR = parseFloat(profile.restingHR) || 70;
  const zones = {
    warmup: { min: Math.round(restHR + 0.5 * (maxHR - restHR)), max: Math.round(restHR + 0.6 * (maxHR - restHR)) },
    fatBurn: { min: Math.round(restHR + 0.6 * (maxHR - restHR)), max: Math.round(restHR + 0.7 * (maxHR - restHR)) },
    cardio: { min: Math.round(restHR + 0.7 * (maxHR - restHR)), max: Math.round(restHR + 0.8 * (maxHR - restHR)) },
    peak: { min: Math.round(restHR + 0.8 * (maxHR - restHR)), max: Math.round(restHR + 0.9 * (maxHR - restHR)) },
  };

  // 1RM estimation ranges by exercise (Brzycki 1993 inspired, population-adjusted)
  // These are rough population baselines, not prescriptions
  const strengthBaselines = getStrengthBaselines(weightKg, ageYears, sex, ethnicity);

  return {
    bmi: Math.round(bmi * 10) / 10,
    bmr: Math.round(bmr),
    estimatedBF: Math.round(estimatedBF * 10) / 10,
    maxHR: Math.round(maxHR),
    zones,
    strengthBaselines,
    tdeeMultipliers: Object.fromEntries(
      Object.entries(ACTIVITY_MULTIPLIERS).map(([k, v]) => [k, Math.round(bmr * v)])
    ),
  };
}

function getStrengthBaselines(weightKg, age, sex, ethnicity) {
  // Population-level strength standards (Lon Kilgore et al., Practical Programming)
  // Expressed as multipliers of bodyweight for untrained individuals
  const baselines = sex === 'male'
    ? { squat: 0.75, deadlift: 1.0, benchPress: 0.65, overheadPress: 0.4 }
    : { squat: 0.5, deadlift: 0.65, benchPress: 0.35, overheadPress: 0.25 };

  // Age adjustment (strength peaks ~25-35, declines ~1% per year after 40)
  let ageMultiplier = 1;
  if (age > 40) ageMultiplier = 1 - (age - 40) * 0.01;
  if (age < 20) ageMultiplier = 0.85;

  return {
    squat: Math.round(weightKg * baselines.squat * ageMultiplier),
    deadlift: Math.round(weightKg * baselines.deadlift * ageMultiplier),
    benchPress: Math.round(weightKg * baselines.benchPress * ageMultiplier),
    overheadPress: Math.round(weightKg * baselines.overheadPress * ageMultiplier),
    note: 'Untrained baseline estimates (kg). Actual capacity varies by training history.',
  };
}

// Milestones
export async function getMilestones() {
  return (await milestoneStore.getItem('achieved')) || {};
}

export async function saveMilestones(milestones) {
  await milestoneStore.setItem('achieved', milestones);
}
