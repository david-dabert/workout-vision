import { describe, it, expect } from 'vitest';
import { isValidGtin, createOffLookup, productFromOff, forGrams, OFF_USER_AGENT, OFF_ORIGIN, RATE_LIMIT } from '../openFoodFacts';

// Honesty pass of 14 October 2026 (NUT-2, NUT-3, NUT-4): a real lookup, only the barcode sent, values per 100 g as
// Open Food Facts gives them, every failure said.
const answer = { status: 1, product: { product_name_fr: 'Skyr nature', brands: 'Marque, Autre', nutriscore_grade: 'a', nutriments: { 'energy-kcal_100g': 63, proteins_100g: 11, carbohydrates_100g: 4, fat_100g: 0.2 } } };
const ok = (json) => ({ ok: true, status: 200, json: async () => json });

describe('barcodes', () => {
  it('checks the check digit: the old hand-written codes fail, real-shaped ones pass', () => {
    for (const bad of ['3033491484085', '5060746500000', '3250390001421', '123', 'abcdefghijklm']) expect(isValidGtin(bad)).toBe(false);
    for (const good of ['3017620422003', '3228857000166', '3045320001570', '96385074']) expect(isValidGtin(good)).toBe(true);
  });
});

describe('the lookup', () => {
  it('sends the barcode only, to Open Food Facts’ API v2, with the app’s User-Agent', async () => {
    const calls = [];
    const lookup = createOffLookup({ fetchImpl: async (url, init) => { calls.push({ url, init }); return ok(answer); }, online: () => true });
    const r = await lookup('3017620422003');
    expect(r.status).toBe('found');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${OFF_ORIGIN}/api/v2/product/3017620422003.json?fields=code,product_name,product_name_fr,brands,nutriments,nutriscore_grade`);
    expect(calls[0].init.headers['User-Agent']).toBe(OFF_USER_AGENT);
    expect(OFF_USER_AGENT).toMatch(/^WorkoutVision\/[\d.]+ \(contact-to-be-set-by-David\)$/);
    expect(calls[0].init.credentials).toBe('omit');
    expect(r.product).toMatchObject({ name: 'Skyr nature', brand: 'Marque', nutriScore: 'A', per100: { kcal: 63, proteins: 11, carbs: 4, fat: 0.2, kj: null } });
    // A second look at the same product sends nothing.
    await lookup('3017620422003');
    expect(calls).toHaveLength(1);
  });
  it('says not found, invalid, offline, too many and error, and sends nothing for an invalid code', async () => {
    let n = 0;
    const notFound = createOffLookup({ fetchImpl: async () => { n++; return ok({ status: 0 }); }, online: () => true });
    expect((await notFound('3228857000166')).status).toBe('not-found');
    expect((await notFound('5060746500000')).status).toBe('invalid');
    expect(n).toBe(1);
    expect((await createOffLookup({ fetchImpl: async () => ({ ok: false, status: 404 }), online: () => true })('3228857000166')).status).toBe('not-found');
    expect((await createOffLookup({ fetchImpl: async () => ({ ok: false, status: 503 }), online: () => true })('3228857000166')).status).toBe('error');
    expect((await createOffLookup({ fetchImpl: async () => ok(answer), online: () => false })('3228857000166')).status).toBe('offline');
  });
  it('tries once more without the User-Agent when the browser refuses the request', async () => {
    const seen = [];
    const lookup = createOffLookup({ fetchImpl: async (url, init) => { seen.push(init.headers); if (init.headers) throw new TypeError('Failed to fetch'); return ok(answer); }, online: () => true });
    expect((await lookup('3017620422003')).status).toBe('found');
    expect(seen).toEqual([{ 'User-Agent': OFF_USER_AGENT }, undefined]);
  });
  it('keeps to 15 lookups a minute', async () => {
    let t = 0;
    const lookup = createOffLookup({ fetchImpl: async () => ok({ status: 0 }), online: () => true, now: () => t });
    const codes = ['3017620422003', '3228857000166', '3045320001570', '96385074'];
    for (let i = 0; i < RATE_LIMIT.max; i++) expect((await lookup(codes[i % codes.length])).status).toBe('not-found');
    const limited = await lookup('3017620422003');
    expect(limited.status).toBe('rate-limited');
    t = RATE_LIMIT.windowMs;
    expect((await lookup('3017620422003')).status).toBe('not-found');
  });
});

describe('values', () => {
  it('stay null where Open Food Facts gives none, and a typed quantity is plain arithmetic', () => {
    const p = productFromOff({ product: { product_name: 'X', nutriments: { proteins_100g: '10' } } }, '96385074');
    expect(p.per100).toEqual({ kcal: null, kj: null, proteins: 10, carbs: null, fat: null });
    expect(forGrams({ kcal: 63, proteins: 11, carbs: 4, fat: 0.2 }, 150)).toEqual({ kcal: 95, proteins: 16.5, carbs: 6, fat: 0.3 });
    expect(forGrams({ kcal: null, proteins: 10, carbs: null, fat: null }, 50)).toEqual({ kcal: null, proteins: 5, carbs: null, fat: null });
    expect(forGrams({ kcal: 1 }, 0)).toBeNull();
  });
});
