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

/**
 * A client file once the coach saves the body values on screen (final check of 14 October 2026). `shown` holds the
 * fields on screen as they read when the coach saved: each is stored exactly so, an emptied one as empty. Before, an
 * emptied field was dropped and the old file's value kept, so an erased pre-filled 75 kg came back marked as typed.
 * bodyTyped then holds: every body value left in the file was typed or confirmed by the coach, on screen; a value
 * left empty is asked for again, and no estimate is made without it.
 */
export function bodyAsShown(client, shown) {
  const body = Object.fromEntries(Object.entries(shown).map(([k, v]) => [k, String(v ?? '').trim()]));
  return { ...client, ...body, bodyTyped: true };
}

/** What a field of an old file shows to confirm: its value, and no sex the form cannot show. */
export const shownBodyValue = (client, k) => (k === 'sex' && !['male', 'female'].includes(client?.sex) ? '' : String(client?.[k] ?? ''));
