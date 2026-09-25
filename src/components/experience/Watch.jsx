import { useT } from '../../lib/LanguageContext';
import { META } from './lift-scenes';
import './Watch.css';

export default function Watch({ lift, progress, phase, onSkip }) {
  const { lang } = useT(), fr = lang === 'fr';
  const pct = Math.round(progress);
  const title = META[lift]?.[lang] || lift;

  return <div className="wv-experience">
    <section className="screen is-active watch-screen" role="status" aria-live="polite">
      <div>
        <p className="eyebrow">{title}</p>
      </div>
      <div className="watch-bottom">
        <p className="pct" aria-label={`${pct}%`}>{pct}</p>
        <div className="watch-progress" aria-hidden="true"><i style={{ width: `${pct}%` }} /></div>
        <p className="privacy">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
          <span>{fr ? 'Analysé sur votre téléphone. Rien n\u2019est envoyé.' : 'Analysed on your phone. Nothing is sent.'}</span>
        </p>
        <button className="text-btn press" type="button" onClick={onSkip}>{fr ? 'Passer' : 'Skip'}</button>
      </div>
    </section>
  </div>;
}
