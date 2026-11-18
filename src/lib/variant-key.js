// A variant of an exercise carries its base in its key (David, 18 November 2026: "How many exercises and variations that
// people do in a commercial gyms add them in the exercises list and we need just one exercises list not two"): the
// variant "bicep_curl--cable" is the guide's bicep_curl done at a cable. Its names, equipment and figure are its own
// catalogue entry (guide-catalog.json); how it is counted, filmed and checked is its base's. The base read from the key
// keeps the tables that load with the first screen (guide-patterns.json, guide-keys.json, offer.js) free of variants: the
// first screen stays under its budget (scripts/check-entry-budget.mjs) whatever the number of variants.
// A variant earns no tier of its own from its base: Beta is evidence on that exercise, so every variant is experimental.

export const VARIANT_SEP = '--';
const SUFFIX = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

/** The exercise a key is counted as: its base for a variant ("bicep_curl--cable" -> "bicep_curl"), else the key itself. */
export function baseKey(key) {
  if (typeof key !== 'string') return key;
  const i = key.indexOf(VARIANT_SEP);
  return i > 0 ? key.slice(0, i) : key;
}

/** Whether the key is a variant's: a base, the separator, and a suffix in lower snake case. */
export function isVariantKey(key) {
  if (typeof key !== 'string') return false;
  const i = key.indexOf(VARIANT_SEP);
  return i > 0 && SUFFIX.test(key.slice(i + VARIANT_SEP.length));
}
