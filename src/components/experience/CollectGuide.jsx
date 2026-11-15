import { useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { collectOn } from '../../lib/phoneCollect';
import './CollectGuide.css';

const NB = '\u00A0';

const COPY = {
  fr: {
    back: 'Retour',
    kicker: 'Collecte · guide',
    title: 'Envoyer vos séries de test.',
    lead: 'Quatre gestes simples sur votre téléphone pour aider à mesurer et améliorer le comptage sur vos propres vidéos.',
    active: 'La collecte (#collecte) est déjà activée sur ce téléphone.',
    inactive: 'La collecte n’est pas encore activée sur ce téléphone.',
    enable: 'Activer la collecte sur ce téléphone',
    openApp: 'Ouvrir l’appli avec #collecte',
    copyLink: 'Copier le lien du guide',
    copied: 'Lien copié.',
    privacy: `Rappel${NB}: aucune vidéo ne quitte votre téléphone. Seuls les fichiers de repères (.json.gz) et votre compte sont préparés pour votre partage.`,
    steps: [
      {
        kicker: 'Étape 1',
        title: `Activer #collecte`,
        body: `Ouvrez l’appli avec #collecte (ou touchez le bouton ci-dessus). Le bandeau «${NB}Collecte activée sur ce téléphone${NB}» apparaît à l’accueil. Une seule fois suffit.`,
      },
      {
        kicker: 'Étape 2',
        title: `Filmer et charger («${NB}Choisir une vidéo${NB}»)`,
        body: `Choisissez un exercice, posez le téléphone comme montré par l’appli et filmez la série entière, du repos au repos. Touchez «${NB}Choisir une vidéo${NB}».`,
      },
      {
        kicker: 'Étape 3',
        title: 'Donner votre compte à l’aveugle',
        body: `Avant d’afficher son résultat, l’appli vous demande combien de répétitions vous avez faites. Indiquez votre compte honnêtement${NB}: cette réponse avant résultat sert de vérité terrain.`,
      },
      {
        kicker: 'Étape 4',
        title: `Partager depuis «${NB}Vos séries${NB}»`,
        body: `Ouvrez «${NB}Vos séries${NB}» puis descendez tout en bas pour toucher «${NB}Envoyer les séries collectées${NB}» et envoyer les fichiers .json.gz.`,
      },
    ],
  },
  en: {
    back: 'Back',
    kicker: 'Collection · guide',
    title: 'Send your test sets.',
    lead: 'Four quick steps on your phone to help measure and improve rep counting on your own videos.',
    active: 'Collection (#collecte) is already enabled on this phone.',
    inactive: 'Collection is not enabled on this phone yet.',
    enable: 'Enable collection on this phone',
    openApp: 'Open the app with #collecte',
    copyLink: 'Copy guide link',
    copied: 'Link copied.',
    privacy: 'Reminder: no video ever leaves your phone. Only landmark files (.json.gz) and your count are prepared when you share.',
    steps: [
      {
        kicker: 'Step 1',
        title: 'Enable #collecte',
        body: 'Open the app with #collecte (or tap the button above). A confirmation banner appears on the home screen. You only do this once per phone.',
      },
      {
        kicker: 'Step 2',
        title: 'Film and pick (“Choose a video”)',
        body: 'Pick a lift, place your phone as shown by the app, and film a full set from rest to rest. Tap “Choose a video”.',
      },
      {
        kicker: 'Step 3',
        title: 'Enter your blind count first',
        body: 'Before showing its own count, the app asks how many reps you completed. Answer honestly before seeing the result: that blind answer is the ground truth.',
      },
      {
        kicker: 'Step 4',
        title: 'Share from “Your sets”',
        body: 'Open “Your sets”, scroll to the bottom, and tap “Send collected sets” to share the .json.gz landmark files.',
      },
    ],
  },
};

/**
 * Standalone shareable tester/coach guide (#guide-collecte) explaining how blind-labelled
 * #collecte sets are recorded and shared from "Vos séries".
 */
export default function CollectGuide({ onClose, onActivate }) {
  const { lang } = useT();
  const c = COPY[lang === 'fr' ? 'fr' : 'en'];
  const active = collectOn();
  const [copied, setCopied] = useState(false);

  const shareUrl = () => `${window.location.origin}${window.location.pathname}#guide-collecte`;
  const copyGuide = async () => {
    try {
      await navigator.clipboard?.writeText?.(shareUrl());
      setCopied(true);
    } catch { /* clipboard optional on restricted contexts */ }
  };

  return <div className="wv-experience">
    <section className="screen is-active cg-screen" data-testid="collect-guide"><div className="wrap">
      <div className="topbar">
        <button className="icon-btn press" onClick={onClose} aria-label={c.back}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span className="pill">{c.kicker}</span>
      </div>
      <h1 className="title" data-reveal style={{ '--i': 0 }}>{c.title}</h1>
      <p className="cg-lead" data-reveal style={{ '--i': 1 }}>{c.lead}</p>
      <p className={`cg-status${active ? ' is-on' : ''}`} role="status" data-testid="collect-guide-status">
        {active ? c.active : c.inactive}
      </p>
      <div className="cg-actions">
        <a
          href="#collecte"
          className="cg-primary press"
          data-testid="collect-guide-activate"
          onClick={e => {
            if (onActivate) {
              e.preventDefault();
              onActivate();
            }
          }}
        >
          {active ? c.openApp : c.enable}
        </a>
        <button type="button" className="cg-secondary press" data-testid="collect-guide-copy" onClick={copyGuide}>
          {copied ? c.copied : c.copyLink}
        </button>
      </div>
      <ol className="cg-steps">
        {c.steps.map((s, i) => <li key={i} className="cg-step">
          <span className="cg-step-kicker">{s.kicker}</span>
          <h2 className="cg-step-title">{s.title}</h2>
          <p className="cg-step-body">{s.body}</p>
        </li>)}
      </ol>
      <p className="cg-note">{c.privacy}</p>
    </div></section>
  </div>;
}
