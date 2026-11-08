/**
 * Schema and validation for testers' blind count records.
 * Phase 6 of David's order of 6 November 2026 (PLAN.md).
 */

export interface BlindCountRecord {
  version?: number;
  videoSha256: string;
  lift: string;
  testerCount: number;
  appCount: number | null;
  appRefused?: boolean;
  timestamp: string | number;
  sessionId: string;
  worldLandmarks?: any[] | null;
  timestamps?: number[] | null;
  imageLandmarks?: any[] | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateBlindRecord(data: unknown): ValidationResult {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Record must be a non-null object'] };
  }

  const r = data as Partial<BlindCountRecord>;

  if (typeof r.videoSha256 !== 'string' || !/^[0-9a-fA-F]{8,64}$/.test(r.videoSha256)) {
    errors.push('videoSha256 must be a valid hex string (at least 8 chars)');
  }

  if (typeof r.lift !== 'string' || !r.lift.trim()) {
    errors.push('lift must be a non-empty string naming the exercise');
  }

  if (!Number.isInteger(r.testerCount) || (r.testerCount as number) < 1) {
    errors.push('testerCount must be an integer >= 1 (the tester’s blind label)');
  }

  if (r.appCount !== null && !Number.isInteger(r.appCount) && r.appCount !== 'refused' as any) {
    errors.push('appCount must be an integer, null, or "refused"');
  }

  if (r.timestamp === undefined || r.timestamp === null || (typeof r.timestamp !== 'string' && typeof r.timestamp !== 'number')) {
    errors.push('timestamp must be a non-empty string or number');
  }

  if (typeof r.sessionId !== 'string' || !r.sessionId.trim()) {
    errors.push('sessionId must be a non-empty string');
  }

  if (r.worldLandmarks !== undefined && r.worldLandmarks !== null) {
    if (!Array.isArray(r.worldLandmarks)) {
      errors.push('worldLandmarks must be an array when present');
    }
  }

  if (r.timestamps !== undefined && r.timestamps !== null) {
    if (!Array.isArray(r.timestamps)) {
      errors.push('timestamps must be an array when present');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function parseBlindRecord(jsonString: string): BlindCountRecord {
  const data = JSON.parse(jsonString);
  const { valid, errors } = validateBlindRecord(data);
  if (!valid) {
    throw new Error(`Invalid blind count record: ${errors.join('; ')}`);
  }
  return data as BlindCountRecord;
}
