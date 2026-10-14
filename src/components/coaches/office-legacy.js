// What the first version of the coach's office left on the phone that the screens must not show as true (second review
// of the honesty pass, 14 October 2026): meals whose numbers were invented, and client files whose body values the old
// form filled in by itself. Read by CoachNutrition.jsx and CoachSuite.jsx; kept apart so both import it.

/**
 * A meal whose numbers were never true, or null. 'photo': logged by the plate photo before 14 October 2026 (RGB sorting
 * and a grams formula). 'barcode': logged by barcode before then, from the hand-written cache; such a meal has no
 * grams, which every barcode meal logged since has. Both are kept and shown without a number.
 */
export function legacyMeal(m) {
  if (m?.source === 'vision_plate') return 'photo';
  if (m?.source === 'barcode' && m.grams == null) return 'barcode';
  return null;
}

/** A client file saved before 14 October 2026, whose sex, weight and height the old form may have filled in. */
export const bodyToCheck = (client) => !!client && !client.bodyTyped;
