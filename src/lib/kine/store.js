// What stays on the physiotherapist's and the patient's phones (localStorage): the practitioner's identity for the
// documents, the next invoice number, and the patient's attempts. Every read and write survives a blocked storage
// (private browsing): the screens work, and simply forget. Status: convention.
const PROFILE = 'wv_kine_profile', INVOICE_SEQ = 'wv_kine_invoice_seq', ATTEMPTS = 'wv_kine_attempts';

const read = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ } };

export const EMPTY_PROFILE = Object.freeze({ name: '', title: 'Masseur-kinésithérapeute', address: '', phone: '', email: '', rpps: '', siret: '', fee: 0 });
export const readProfile = () => ({ ...EMPTY_PROFILE, ...read(PROFILE, {}) });
export const saveProfile = p => write(PROFILE, p);

/** The next invoice number, year and sequence ("2026-0007"); the sequence restarts each year. */
export function nextInvoiceNumber(now = new Date()) {
  const year = now.getFullYear();
  const seq = read(INVOICE_SEQ, { year, n: 0 });
  const n = seq.year === year ? seq.n + 1 : 1;
  write(INVOICE_SEQ, { year, n });
  return `${year}-${String(n).padStart(4, '0')}`;
}

/** The patient's attempts of a programme's exercises: { [programmeId]: [{ id, date, verdict }] }, the last 200. */
export function logAttempt(programmeId, entry) {
  const all = read(ATTEMPTS, {});
  all[programmeId] = [...(all[programmeId] || []), entry].slice(-200);
  write(ATTEMPTS, all);
}
export const attemptsOf = programmeId => read(ATTEMPTS, {})[programmeId] || [];
