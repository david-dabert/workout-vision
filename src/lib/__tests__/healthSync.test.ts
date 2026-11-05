import { describe, it, expect } from 'vitest';
import {
  parseAppleHealthXml,
  parseGoogleFitDailyCsv,
  computeRecoveryReadiness,
} from '../healthSync';

describe('healthSync', () => {
  const sampleAppleHealthXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ELEMENT HealthData (ExportDate,Me,Record*,Workout*)>
]>
<HealthData locale="fr_FR">
  <ExportDate value="2026-11-05 10:00:00 +0100"/>
  <Me HKCharacteristicTypeIdentifierDateOfBirth="1995-05-15" HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexMale"/>

  <!-- Step Count Records -->
  <Record type="HKQuantityTypeIdentifierStepCount" unit="count" value="452" startDate="2026-11-04 08:00:00 +0100" endDate="2026-11-04 08:30:00 +0100"/>
  <Record type="HKQuantityTypeIdentifierStepCount" unit="count" value="1250" startDate="2026-11-04 09:00:00 +0100" endDate="2026-11-04 10:00:00 +0100"/>

  <!-- Active Calories -->
  <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" unit="kcal" value="85.5" startDate="2026-11-04 08:00:00 +0100" endDate="2026-11-04 08:30:00 +0100"/>
  <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" unit="kcal" value="214.5" startDate="2026-11-04 09:00:00 +0100" endDate="2026-11-04 10:00:00 +0100"/>

  <!-- Heart Rate Records -->
  <Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" value="62" startDate="2026-11-04 07:30:00 +0100" endDate="2026-11-04 07:30:05 +0100"/>
  <Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" value="145" startDate="2026-11-04 09:30:00 +0100" endDate="2026-11-04 09:30:05 +0100"/>
  <Record type="HKQuantityTypeIdentifierHeartRate" unit="count/min" value="110" startDate="2026-11-04 09:45:00 +0100" endDate="2026-11-04 09:45:05 +0100"/>

  <!-- Resting Heart Rate -->
  <Record type="HKQuantityTypeIdentifierRestingHeartRate" unit="count/min" value="52" startDate="2026-11-04 07:00:00 +0100" endDate="2026-11-04 07:00:00 +0100"/>

  <!-- Sleep Analysis (8 hours = 480 mins) -->
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepCore" startDate="2026-11-04 00:00:00 +0100" endDate="2026-11-04 05:00:00 +0100"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepDeep" startDate="2026-11-04 05:00:00 +0100" endDate="2026-11-04 07:00:00 +0100"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepREM" startDate="2026-11-04 07:00:00 +0100" endDate="2026-11-04 08:00:00 +0100"/>

  <!-- Workout Record -->
  <Workout workoutActivityType="HKWorkoutActivityTypeTraditionalStrengthTraining" duration="60.0" durationUnit="min" totalEnergyBurned="380" totalEnergyBurnedUnit="kcal" startDate="2026-11-04 09:00:00 +0100" endDate="2026-11-04 10:00:00 +0100"/>
</HealthData>`;

  it('parses Apple Health export XML accurately without server calls', () => {
    const summary = parseAppleHealthXml(sampleAppleHealthXml);

    expect(summary.source).toBe('apple_health');
    expect(summary.totalSteps).toBe(1702); // 452 + 1250
    expect(summary.totalActiveCaloriesKcal).toBe(300); // 85.5 + 214.5 = 300

    // Heart rate metrics
    expect(summary.heartRate.samplesCount).toBe(3);
    expect(summary.heartRate.minBpm).toBe(62);
    expect(summary.heartRate.maxBpm).toBe(145);
    expect(summary.heartRate.avgBpm).toBe(105.7); // (62 + 145 + 110) / 3 = 105.666...
    expect(summary.heartRate.restingBpm).toBe(52);

    // Sleep analysis: 5h (300m) + 2h (120m) + 1h (60m) = 480m (8 hours)
    expect(summary.sleep.totalAsleepMinutes).toBe(480);
    expect(summary.sleep.deepAsleepMinutes).toBe(120);
    expect(summary.sleep.remAsleepMinutes).toBe(60);

    // Workout parsing
    expect(summary.workouts).toHaveLength(1);
    expect(summary.workouts[0].type).toBe('TraditionalStrengthTraining');
    expect(summary.workouts[0].durationMinutes).toBe(60);
    expect(summary.workouts[0].caloriesBurnedKcal).toBe(380);
  });

  it('handles empty or malformed Apple Health XML gracefully', () => {
    const emptySummary = parseAppleHealthXml('');
    expect(emptySummary.totalSteps).toBe(0);
    expect(emptySummary.heartRate.samplesCount).toBe(0);
    expect(emptySummary.workouts).toHaveLength(0);
  });

  it('parses Google Fit daily summary CSV', () => {
    const sampleCsv = `Date,Step count,Calories (kcal),Average heart rate (bpm)
2026-11-03,8420,2100,68
2026-11-04,11250,2450,72`;

    const summary = parseGoogleFitDailyCsv(sampleCsv);
    expect(summary.source).toBe('google_fit');
    expect(summary.totalSteps).toBe(19670);
    expect(summary.totalActiveCaloriesKcal).toBe(4550);
    expect(summary.heartRate.samplesCount).toBe(2);
    expect(summary.heartRate.minBpm).toBe(68);
    expect(summary.heartRate.maxBpm).toBe(72);
    expect(summary.heartRate.avgBpm).toBe(70);
  });

  it('computes recovery readiness scores from sleep and resting HR', () => {
    const optimalHealth = parseAppleHealthXml(sampleAppleHealthXml);
    const readiness = computeRecoveryReadiness(optimalHealth);

    expect(readiness.score).toBeGreaterThanOrEqual(85);
    expect(readiness.readinessLevel).toBe('optimal');
    expect(readiness.insight).toContain('Récupération');
  });
});
