// Per-lift camera placement and framing (card 041), shown on the filming screen and in the guide.
// The angle comes from each lift's filmView ('front' or 'side', exercise-info.js); the framing from its counting joint.
// Source: test/real-phone/synth/synth.txt, rendered bodies filmed at 0 and 90 degrees for lateral_raise, overhead_press,
// bicep_curl and squat. Status: experimental (R9). Rendered bodies validate nothing (measures.js), so the screens give
// the advice and no figure (card 042, 15 November 2026, R8).
import { liftDefinition } from '../../lib/counting/core';
import { filmView } from './exercise-info';

/**
 * Returns camera placement and framing for a lift key.
 * @param {string} key
 * @param {boolean} fr
 * @returns {{ view: 'front'|'side', angleLabel: string, framingLabel: string }}
 */
export function filmingGuideFor(key, fr = true) {
  const def = liftDefinition(key);
  const countingKey = def?.key || key;
  const view = filmView(key) || filmView(countingKey) || 'side';
  const wholeBody = ['knee', 'hip'].includes(def?.joint);

  const angleLabel = view === 'front'
    ? (fr ? 'De face (0°)' : 'Front (0°)')
    : (fr ? 'De profil (90°)' : 'Side (90°)');

  const framingLabel = wholeBody
    ? (fr ? 'corps entier, pieds compris' : 'whole body, feet included')
    : view === 'side'
    ? (fr ? 'bras qui travaille face à l’objectif, tête aux hanches' : 'working arm facing the lens, head to hips')
    : (fr ? 'tête aux hanches, deux bras visibles' : 'head to hips, both arms in frame');

  return { view, angleLabel, framingLabel };
}
