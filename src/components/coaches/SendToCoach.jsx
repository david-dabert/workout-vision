import { useT } from '../../lib/LanguageContext';
import { useSets } from '../experience/sets';
import { hapticLight } from '../../lib/haptics';
import { lastSetLine } from './last-set';

// What works today to send a set to one's coach (honesty pass of 14 October 2026, FND-4, CHT-1, CHT-4): the session
// report of "Vos séries" (History.jsx, Report.jsx), shared through the phone's share sheet. The old "Contacter",
// "Partager mon profil", "Lien d'invitation" and "Proposer une séance" opened the home screen or a link the app refused.
// French awaiting David's approval (R10).
const COPY = {
  fr: {
    head: 'Envoyer une série à votre coach',
    how: 'Ouvrez «\u00A0Vos séries\u00A0», touchez une série, puis «\u00A0Rapport de séance\u00A0»\u00A0: vous l’envoyez par message ou par e-mail.',
    last: line => `Dernière série sur ce téléphone\u00A0: ${line}.`,
    none: 'Aucune série sur ce téléphone pour l’instant.',
    open: 'Ouvrir vos séries',
  },
  en: {
    head: 'Send a set to your coach',
    how: 'Open "Your sets", tap a set, then "Session report": you send it by message or email.',
    last: line => `Last set on this phone: ${line}.`,
    none: 'No set on this phone yet.',
    open: 'Open your sets',
  },
};

export default function SendToCoach({ onHistory }) {
  const { lang } = useT();
  const c = COPY[lang === 'fr' ? 'fr' : 'en'];
  const sets = useSets();
  const line = lastSetLine(sets, lang);
  return (
    <div className="sc-card send-coach" data-testid="send-to-coach">
      <p className="sc-name send-coach-head">{c.head}</p>
      <p className="sc-text send-coach-how">{c.how}</p>
      <p className="sc-caption" data-testid="last-set-line">{line ? c.last(line) : c.none}</p>
      <button
        type="button"
        className="btn-line press"
        onClick={() => { hapticLight(); if (onHistory) onHistory(); else window.location.hash = '#history'; }}
        data-testid="open-history"
      >
        {c.open}
      </button>
    </div>
  );
}
