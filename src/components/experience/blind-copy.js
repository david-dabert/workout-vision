// The words of the blind question on the analysis screen (BlindAsk.jsx, blind.js; 9 October 2026), register vous
// (R10). The question itself is the result screen's, approved by David on 9 October 2026 (result-copy.js howMany).
// Status of the other lines: written 9 October 2026, awaiting David's approval (R10;
// test/real-phone/swarm/copy-blind.md). Only a phone carrying the #collecte flag shows them.
const NB = ' ';

export const BLIND = {
  fr: {
    question: `Combien en avez-vous fait${NB}?`,
    after: 'L’appli affiche son compte après votre réponse.',
    ok: 'Valider',
    unsure: 'Je ne sais pas',
    field: 'Nombre de répétitions',
    empty: 'Aucun nombre choisi',
    fewer: 'Une de moins',
    more: 'Une de plus',
  },
  en: {
    question: 'How many did you do?',
    after: 'The app shows its count after your answer.',
    ok: 'Done',
    unsure: 'I don’t know',
    field: 'Number of reps',
    empty: 'No number chosen',
    fewer: 'One fewer',
    more: 'One more',
  },
};
