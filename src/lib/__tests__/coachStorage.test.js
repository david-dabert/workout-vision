import { describe, it, expect, vi, beforeEach } from 'vitest';

// localforage in memory: one Map per store, as the app's stores are.
const stores = new Map();
vi.mock('localforage', () => ({
  default: {
    createInstance: ({ storeName }) => {
      if (!stores.has(storeName)) stores.set(storeName, new Map());
      const m = stores.get(storeName);
      return {
        getItem: async k => (m.has(k) ? structuredClone(m.get(k)) : null),
        setItem: async (k, v) => { m.set(k, structuredClone(v)); return v; },
        removeItem: async k => { m.delete(k); },
        iterate: async fn => { for (const [k, v] of m) fn(structuredClone(v), k); },
      };
    },
  },
}));

const S = await import('../coachStorage');
beforeEach(() => { for (const m of stores.values()) m.clear(); });

// Second review of 14 October 2026: numbering that cannot repeat, and a credit note that cancels an unpaid invoice.
describe('invoice numbers', () => {
  it('follow each other, and a lost counter restarts after the highest number kept, never at 0001', async () => {
    expect(await S.issueInvoiceNumber(2026)).toBe('F-2026-0001');
    await S.saveIssuedInvoice({ number: 'F-2026-0001', total: 50 });
    expect(await S.issueInvoiceNumber(2026)).toBe('F-2026-0002');
    await S.saveIssuedInvoice({ number: 'F-2026-0002', total: 50 });
    stores.get('coach').clear(); // the counter alone is lost
    expect(await S.issueInvoiceNumber(2026)).toBe('F-2026-0003');
    expect(await S.issueInvoiceNumber(2027)).toBe('F-2027-0001');
  });
  it('credit notes have their own sequence, and cancel only an unpaid invoice', async () => {
    await S.saveIssuedInvoice({ number: 'F-2026-0001', total: 50 });
    await S.saveIssuedInvoice({ number: 'F-2026-0002', total: 80, paid: { paidOn: '2026-10-14', mode: 'virement' } });
    const a = await S.issueCreditNoteNumber(2026);
    expect(a).toBe('A-2026-0001');
    expect(await S.markInvoiceCancelled('F-2026-0001', a)).toMatchObject({ number: 'F-2026-0001', cancelledBy: 'A-2026-0001' });
    expect(await S.markInvoiceCancelled('F-2026-0002', 'A-2026-0002')).toBeNull();
    expect(await S.issueInvoiceNumber(2026)).toBe('F-2026-0003');
  });
});
