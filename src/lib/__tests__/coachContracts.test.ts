import { describe, it, expect } from 'vitest';
import { generateCoachingContract, contractMissing } from '../coachContracts';
import { isValidSiret } from '../accounting';

const COACH = { name: 'Camille Martin', siret: '12345678901237', address: '1 rue de l’Exemple, 69001 Lyon', cartePro: '06912ED0001', mediator: 'Médiateur exemple, mediateur.example' };
const DATA = { issueDate: '2026-10-14', coach: COACH, client: { name: 'Alex Durand' }, packageType: 'carnet' as const, sessionsCount: 10, totalPrice: 500, validityMonths: 6 };

describe('the coaching contract model (honesty pass of 14 October 2026, CTR-1)', () => {
  it('says what is missing and makes no text before', () => {
    expect(contractMissing({ ...DATA, coach: {}, client: {}, totalPrice: 0 }, isValidSiret)).toEqual(['coachName', 'siret', 'coachAddress', 'cartePro', 'mediator', 'clientName', 'totalPrice']);
    expect(contractMissing(DATA, isValidSiret)).toEqual([]);
  });
  it('prints what the coach typed, the franchise line, the mediator, and no jurisdiction clause, claim or em dash', () => {
    const { text } = generateCoachingContract(DATA);
    expect(text).toContain('EI Camille Martin');
    expect(text).toContain('SIRET\u00A0: 123 456 789 01237');
    expect(text).toContain('Carnet de 10 séances');
    expect(text).toContain('500,00 €');
    expect(text).toContain('TVA non applicable, art. 293 B du CGI');
    expect(text).toContain('Médiateur exemple');
    expect(text).toContain('24 heures');
    expect(text).not.toMatch(/tribunaux|Conforme|QS-Sport|WorkoutVision™|TTC|L321-1|Basic-Fit|MACSF/);
    expect(text).not.toContain('—');
    expect(text).not.toContain('Assurance'); // not typed, not printed
  });
});
