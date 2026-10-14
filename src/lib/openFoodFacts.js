/**
 * A packaged product's values per 100 g, looked up by its barcode on Open Food Facts (CoachNutrition.jsx, Code-barres).
 * Honesty pass of 14 October 2026 (NUT-2, NUT-3, NUT-4 and the missed policy item): the hand-written "offline cache"
 * is gone (three of its six barcodes failed the EAN check digit, and its products and Nutri-Scores were invented under
 * real brands); the page's Content-Security-Policy now allows this one origin (index.html, connect-src), so the lookup
 * can work at all; only the barcode is sent; the values are shown per 100 g as Open Food Facts gives them, no portion
 * is guessed; not found, offline, too many lookups and an error each say so.
 *
 * Open Food Facts is a collaborative database (data under the Open Database License, ODbL): the screen credits it and
 * says to check the label. API v2, product by barcode, with the fields we read only. Its usage rules ask for a
 * User-Agent naming the app and a contact; the contact is left for David to set (CONTACT below). A browser may refuse
 * to send that header or ask the server first (a CORS preflight): when the request fails that way while the phone is
 * online, it is tried once more without it. Status of the 15 lookups a minute: convention (the limit David set for
 * this app, under the API's published allowance; not measured by us).
 */
import { appVersion } from './reportLinks';

export const OFF_ORIGIN = 'https://world.openfoodfacts.org';
// The contact Open Food Facts asks for: to be set by David before release (an address he reads).
export const CONTACT = 'contact-to-be-set-by-David';
export const OFF_USER_AGENT = `WorkoutVision/${(appVersion() || '0.0.0').split(' ')[0]} (${CONTACT})`;
export const OFF_FIELDS = 'code,product_name,product_name_fr,brands,nutriments,nutriscore_grade';
export const RATE_LIMIT = Object.freeze({ max: 15, windowMs: 60_000 });

/** Whether a code is a well-formed GTIN (EAN-8, UPC-A, EAN-13 or GTIN-14): digits only, its check digit right. */
export function isValidGtin(raw) {
  const s = String(raw || '').replace(/\s+/g, '');
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(s)) return false;
  const digits = [...s].map(Number);
  const check = digits.pop();
  let sum = 0;
  digits.reverse().forEach((d, i) => { sum += d * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === check;
}

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** The product as the screen shows it, from Open Food Facts' answer: every value per 100 g, null where it gives none. */
export function productFromOff(json, code) {
  const p = json?.product;
  if (!p) return null;
  const n = p.nutriments || {};
  const grade = typeof p.nutriscore_grade === 'string' && /^[a-e]$/.test(p.nutriscore_grade) ? p.nutriscore_grade.toUpperCase() : null;
  return {
    code,
    name: (p.product_name_fr || p.product_name || '').trim(),
    brand: String(p.brands || '').split(',')[0].trim(),
    nutriScore: grade,
    per100: {
      kcal: num(n['energy-kcal_100g']),
      kj: num(n['energy-kj_100g']),
      proteins: num(n.proteins_100g),
      carbs: num(n.carbohydrates_100g),
      fat: num(n.fat_100g),
    },
    url: `${OFF_ORIGIN}/product/${code}`,
  };
}

/**
 * A lookup with its own limit: 15 a minute, counted by this lookup. Returns { status, product?, retryInMs? }, status
 * one of 'found', 'not-found', 'invalid', 'offline', 'rate-limited', 'error'. A product found is kept by the lookup,
 * so a second look at it sends nothing. The screen uses the one shared lookup below (offLookup).
 */
export function createOffLookup({ fetchImpl = (...a) => fetch(...a), now = () => Date.now(), online = () => typeof navigator === 'undefined' || navigator.onLine !== false } = {}) {
  const sent = [];
  const found = new Map();
  return async function lookup(raw) {
    const code = String(raw || '').replace(/\s+/g, '');
    if (!isValidGtin(code)) return { status: 'invalid' };
    if (found.has(code)) return { status: 'found', product: found.get(code) };
    if (!online()) return { status: 'offline' };
    // Every request sent counts, the second try without the User-Agent included (final check of 14 October 2026).
    const take = () => {
      const t = now();
      while (sent.length && t - sent[0] >= RATE_LIMIT.windowMs) sent.shift();
      if (sent.length >= RATE_LIMIT.max) return { status: 'rate-limited', retryInMs: RATE_LIMIT.windowMs - (t - sent[0]) };
      sent.push(t);
      return null;
    };
    const busy = take();
    if (busy) return busy;
    const url = `${OFF_ORIGIN}/api/v2/product/${code}.json?fields=${OFF_FIELDS}`;
    let res;
    try {
      res = await fetchImpl(url, { headers: { 'User-Agent': OFF_USER_AGENT }, credentials: 'omit', referrerPolicy: 'no-referrer' });
    } catch {
      if (!online()) return { status: 'offline' };
      const again = take();
      if (again) return again;
      try { res = await fetchImpl(url, { credentials: 'omit', referrerPolicy: 'no-referrer' }); } catch { return { status: online() ? 'error' : 'offline' }; }
    }
    if (res.status === 404) return { status: 'not-found' };
    if (!res.ok) return { status: 'error' };
    let json;
    try { json = await res.json(); } catch { return { status: 'error' }; }
    if (json?.status !== 1 && json?.status !== 'success') return { status: 'not-found' };
    const product = productFromOff(json, code);
    if (!product) return { status: 'not-found' };
    found.set(code, product);
    return { status: 'found', product };
  };
}

// The app's one lookup, made at its first use and kept until the page reloads: the 15 a minute and the products found
// hold across the nutrition tab's modes and the office's tabs (second review of 14 October 2026: a lookup made inside
// the barcode panel started afresh, limit and all, each time the panel was opened again).
let shared = null;
/** Look a barcode up through the app's one shared lookup (createOffLookup's limit and memory). */
export function offLookup(code) {
  shared ??= createOffLookup();
  return shared(code);
}

/** What a typed quantity of a product holds, from its values per 100 g: arithmetic on Open Food Facts' figures and
 *  the grams the coach typed, nothing estimated. A value the database lacks stays null. */
export function forGrams(per100, grams) {
  const g = Number(grams);
  if (!(g > 0)) return null;
  const k = g / 100;
  const at = (v, d = 1) => (v == null ? null : Math.round(v * k * 10 ** d) / 10 ** d);
  return { kcal: at(per100.kcal, 0), proteins: at(per100.proteins), carbs: at(per100.carbs), fat: at(per100.fat) };
}
