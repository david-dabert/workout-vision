// The words that tell the reps the app detected from the count the user saved. After a correction
// (7 detected, 8 saved) the detected marks are never called the set's reps, and the saved count is
// never drawn as marks (review of 1 October 2026). One formatter for the result, the replay and the
// replay video, so the three say the same. Wording proposed by the review; David approves it (R10).

/** True when the user saved a count other than the app's. */
export const isCorrected = (saved, detected) => Number.isInteger(saved) && Number.isInteger(detected) && saved !== detected;

/** A mark's position: "Répétition 3 sur 7", or after a correction "Repère détecté 3 sur 7". */
export function markLabel({ index, total, fr, corrected }) {
  if (corrected) return fr ? `Repère détecté ${index} sur ${total}` : `Detected mark ${index} of ${total}`;
  return fr ? `Répétition ${index} sur ${total}` : `Rep ${index} of ${total}`;
}

/** The marks as a group: "Répétitions, une par marque", or after a correction "Repères détectés par l'app". */
export function marksLabel({ fr, corrected }) {
  if (corrected) return fr ? 'Repères détectés par l’app' : 'Marks the app detected';
  return fr ? 'Répétitions, une par marque' : 'Reps, one per mark';
}

/** After a correction: "L'app a détecté 7 répétitions. Vous avez enregistré 8."; otherwise ''. */
export function provenance({ detected, saved, fr }) {
  if (!isCorrected(saved, detected)) return '';
  const reps = n => (fr ? `${n} répétition${n > 1 ? 's' : ''}` : `${n} rep${n === 1 ? '' : 's'}`);
  return fr ? `L’app a détecté ${reps(detected)}. Vous avez enregistré ${saved}.` : `The app detected ${reps(detected)}. You saved ${saved}.`;
}

/**
 * What the replay video draws over the set: "3 / 7", and after a correction a second line that makes
 * the video explain itself away from the app.
 */
export function overlayLines({ begun, total, detected, saved, fr }) {
  const lines = [`${begun} / ${total}`];
  const note = provenance({ detected, saved, fr });
  if (note) lines.push(note);
  return lines;
}
