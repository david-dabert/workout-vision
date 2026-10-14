import { describe, it, expect } from 'vitest';
import { generateCoachingContract, contractMissing } from '../coachContracts';
import { isValidSiret } from '../accounting';

const COACH = { name: 'Camille Martin', siret: '12345678901237', address: '1 rue de l’Exemple, 69001 Lyon', cartePro: '06912ED0001', mediator: 'Médiateur exemple, mediateur.example' };
const DATA = { issueDate: '2026-10-14', coach: COACH, client: { name: 'Alex Durand' }, packageType: 'carnet' as const, sessionsCount: 10, totalPrice: 500, validityMonths: 6 };

describe('the coaching contract model (honesty pass of 14 October 2026, CTR-1)', () => {
  it('says what is missing and makes no text before', () => {
    expect(contractMissing({ ...DATA, coach: {}, client: {}, totalPrice: 0 }, isValidSiret)).toEqual(['coachName', 'siret', 'coachAddress', 'cartePro', 'mediator', 'clientName', 'totalPrice']);
    // Nothing is filled in for the coach: an empty pack form lacks its count, price and validity.
    expect(contractMissing({ ...DATA, sessionsCount: 0, totalPrice: 0, validityMonths: 0 }, isValidSiret)).toEqual(['sessions', 'totalPrice', 'validity']);
    expect(contractMissing(DATA, isValidSiret)).toEqual([]);
  });
  it('prints what the coach typed, the franchise line, the mediator, and no jurisdiction clause, claim or em dash', () => {
    const { text } = generateCoachingContract(DATA);
    expect(text).toContain('EI Camille Martin');
    expect(text).toContain('SIRET\u00A0: 123 456 789 01237');
    expect(text).toContain('un carnet de 10 séances d’entraînement personnalisées, en coaching individuel.');
    expect(text).not.toMatch(/\(10 séances\)/);
    expect(text).toContain('Les séances sont à utiliser dans les 6\u00A0mois qui suivent la signature.');
    expect(text).toContain('Signature\u00A0:');
    expect(text).not.toMatch(/Signature :/);
    expect(text).toContain('500,00 €');
    expect(text).toContain('TVA non applicable, art. 293 B du CGI');
    expect(text).toContain('Médiateur exemple');
    expect(text).toContain('24 heures');
    expect(text).not.toMatch(/tribunaux|Conforme|QS-Sport|WorkoutVision™|TTC|L321-1|Basic-Fit|MACSF/);
    expect(text).not.toContain('—');
    expect(text).not.toContain('Assurance'); // not typed, not printed
  });

  // Second review of 14 October 2026: a monthly follow-up was printed as "Suivi mensuel (1 séance)", to use "dans les
  // 6 mois", and a single session carried the same validity clause.
  it('a monthly follow-up says its sessions a month, its months, its price a month and how it ends', () => {
    const monthly = { ...DATA, packageType: 'monthly' as const, sessionsCount: undefined, totalPrice: undefined, validityMonths: undefined, sessionsPerMonth: 4, months: 3, monthlyPrice: 200 };
    expect(contractMissing({ ...monthly, sessionsPerMonth: 0, months: 0, monthlyPrice: 0 }, isValidSiret)).toEqual(['sessionsPerMonth', 'months', 'monthlyPrice']);
    expect(contractMissing(monthly, isValidSiret)).toEqual([]);
    const { text } = generateCoachingContract(monthly);
    expect(text).toContain('Le Coach fournit au Client un suivi de 4 séances d’entraînement personnalisées par mois, pendant 3\u00A0mois.');
    expect(text).toContain('Le prix est de 200,00\u00A0€ par mois, soit 600,00\u00A0€ pour les 3\u00A0mois. TVA non applicable, art. 293 B du CGI.');
    expect(text).toContain('prend fin au bout des 3\u00A0mois, sans reconduction tacite.');
    expect(text).not.toMatch(/1 séance\)|à utiliser dans|Suivi mensuel \(/);
  });
  it('a single session has its price and no validity clause', () => {
    const single = { ...DATA, packageType: 'single_session' as const, sessionsCount: undefined, validityMonths: undefined, totalPrice: 60 };
    expect(contractMissing({ ...single, totalPrice: 0 }, isValidSiret)).toEqual(['totalPrice']);
    expect(contractMissing(single, isValidSiret)).toEqual([]);
    const { text } = generateCoachingContract(single);
    expect(text).toContain('Le Coach fournit au Client une séance d’entraînement personnalisée, en coaching individuel.');
    expect(text).toContain('Le prix de la séance est de 60,00\u00A0€.');
    expect(text).not.toMatch(/à utiliser dans|\(1 séance\)|mois/);
  });
});
