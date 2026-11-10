import { describe, it, expect } from 'vitest';
import {
  validateClinicalMetric,
  CLINICAL_EVIDENCE_REGISTRY,
} from '../clinicalEvidenceValidator';

describe('clinicalEvidenceValidator', () => {
  it('registers peer-reviewed clinical citations for all 6 specialized poles', () => {
    expect(CLINICAL_EVIDENCE_REGISTRY.kiblerDyskinesis.author).toContain('Kibler');
    expect(CLINICAL_EVIDENCE_REGISTRY.dynamicKneeValgus.author).toContain('Hewett');
    expect(CLINICAL_EVIDENCE_REGISTRY.limbSymmetryIndex.author).toContain('Noyes');
    expect(CLINICAL_EVIDENCE_REGISTRY.lumbopelvicRhythm.author).toContain('Esola');
    expect(CLINICAL_EVIDENCE_REGISTRY.trendelenburgDrop.author).toContain('Hardcastle');
    expect(CLINICAL_EVIDENCE_REGISTRY.fadirHipImpingement.author).toContain('Ganz');
    expect(CLINICAL_EVIDENCE_REGISTRY.wbltAnkleDorsiflexion.author).toContain('Bennell');
    expect(CLINICAL_EVIDENCE_REGISTRY.cranioVertebralAngle.author).toContain('Yip');
  });

  it('validates a normal dynamic knee valgus angle', () => {
    const res = validateClinicalMetric('dynamicKneeValgus', 5.2, 0.95, 0.90);
    expect(res.isWithinNorm).toBe(true);
    expect(res.isValidForClinicalReport).toBe(true);
    expect(res.confidenceScore).toBeGreaterThanOrEqual(0.70);
    expect(res.refusalReason).toBeUndefined();
  });

  it('flags pathological dynamic knee valgus exceeding 8.0 degrees threshold', () => {
    const res = validateClinicalMetric('dynamicKneeValgus', 11.4, 0.92, 0.95);
    expect(res.isWithinNorm).toBe(false);
    expect(res.isValidForClinicalReport).toBe(true);
    expect(res.clinicalReference.author).toContain('Hewett');
  });

  it('refuses low confidence landmarks from clinical reporting', () => {
    const res = validateClinicalMetric('dynamicKneeValgus', 5.0, 0.50, 0.60);
    expect(res.isValidForClinicalReport).toBe(false);
    expect(res.refusalReason).toContain('Optical confidence');
  });

  it('validates Limb Symmetry Index (LSI) return to sport threshold', () => {
    const rtpPassed = validateClinicalMetric('limbSymmetryIndex', 94.0, 0.95);
    expect(rtpPassed.isWithinNorm).toBe(true);

    const rtpFailed = validateClinicalMetric('limbSymmetryIndex', 82.5, 0.95);
    expect(rtpFailed.isWithinNorm).toBe(false);
  });
});
