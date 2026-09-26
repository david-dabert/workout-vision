import { useState, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { META, liftView } from './lift-scenes';
import './Report.css';

export default function Report({ result, lift, trueN, onBack }) {
  const { lang } = useT(), fr = lang === 'fr';
  const [client, setClient] = useState('');
  const [coach, setCoach] = useState('');
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState(false);
  const sheetRef = useRef(null);

  const liftName = META[lift]?.[lang] || lift;
  const count = trueN ?? result.count;
  const corrected = trueN != null && trueN !== result.count;
  const armLabel = fr
    ? (result.arm === 'left' ? 'bras gauche' : 'bras droit')
    : (result.arm === 'left' ? 'left arm' : 'right arm');
  const today = new Date().toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  async function handleShare() {
    // Build plain-text fallback for share
    const lines = [
      fr ? 'Rapport de séance' : 'Session report',
      `${today}`,
      '',
      `${fr ? 'Client' : 'Client'}: ${client || '-'}`,
      `${fr ? 'Coach' : 'Coach'}: ${coach || '-'}`,
      '',
      `${count} ${liftName}`,
      `${fr ? 'Bras suivi' : 'Arm tracked'}: ${armLabel}`,
    ];
    if (corrected) {
      lines.push(fr
        ? `Compté par l'app : ${result.count}. Corrigé : ${count}.`
        : `Counted by the app: ${result.count}. Corrected: ${count}.`);
    }
    if (result.reps?.length) {
      lines.push('');
      lines.push(fr ? 'Rép. | Durée | Amplitude' : 'Rep | Time | Range');
      result.reps.forEach(rep => {
        const dur = rep.duration ? `${(rep.duration / 1000).toFixed(1)}s` : '-';
        const rom = rep.rom ? `${Math.round(rep.rom)}°` : '-';
        lines.push(`${rep.index} | ${dur} | ${rom}`);
      });
    }
    if (notes) { lines.push(''); lines.push(`${fr ? 'Notes' : 'Notes'}: ${notes}`); }
    lines.push('');
    lines.push(fr ? 'Comptage automatique sur le téléphone. Version de test.' : 'Counted automatically on the phone. Test version.');

    const text = lines.join('\n');

    if (navigator.share) {
      try {
        await navigator.share({ title: fr ? 'Rapport de séance' : 'Session report', text });
      } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        setToast(true);
        setTimeout(() => setToast(false), 3000);
      } catch { /* ignore */ }
    }
  }

  return <div className="wv-experience">
    <section className="screen is-active report-screen"><div className="wrap">
      <div className="topbar">
        <button className="icon-btn press" onClick={onBack} aria-label={fr ? 'Retour' : 'Back'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span className="pill">{fr ? 'Version de test' : 'Test version'}</span>
      </div>
      <h2 className="title">{fr ? 'Rapport pour votre coach' : 'Report for your coach'}</h2>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="fClient">{fr ? 'Client' : 'Client'}</label>
          <input id="fClient" type="text" autoComplete="off" placeholder={fr ? 'Prénom et nom' : 'First and last name'} value={client} onChange={e => setClient(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="fCoach">{fr ? 'Coach' : 'Coach'}</label>
          <input id="fCoach" type="text" autoComplete="off" placeholder={fr ? 'Prénom et nom' : 'First and last name'} value={coach} onChange={e => setCoach(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="fNotes">{fr ? 'Notes' : 'Notes'}</label>
        <textarea id="fNotes" rows="3" placeholder={fr ? 'Observations, consignes pour la prochaine séance\u2026' : 'Observations, instructions for the next session\u2026'} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <article className="sheet" ref={sheetRef}>
        <div className="sh-top"><span>Workout Vision</span><span>{today}</span></div>
        <h3 className="sh-title">{fr ? 'Rapport de séance' : 'Session report'}</h3>
        <div className="sh-people">
          <span><em>{fr ? 'Client' : 'Client'}</em><span>{client || '-'}</span></span>
          <span><em>{fr ? 'Coach' : 'Coach'}</em><span>{coach || '-'}</span></span>
        </div>
        <div className="sh-count">
          <span className="sh-n">{count}</span>
          <span className="sh-nl">
            <b>{fr ? 'répétitions' : 'reps'}</b>
            <span>{liftName}</span>
          </span>
        </div>
        {corrected && <p className="sh-line">{fr
          ? `Compté par l'app : ${result.count}. Corrigé : ${count}.`
          : `Counted by the app: ${result.count}. Corrected: ${count}.`
        }</p>}
        <p className="sh-line">{fr ? 'Bras suivi : ' : 'Arm tracked: '}{armLabel}</p>
        {result.reps?.length > 0 && <table className="sh-table">
          <thead><tr>
            <th>{fr ? 'Rép.' : 'Rep'}</th>
            <th>{fr ? 'Durée' : 'Time'}</th>
            <th>{fr ? 'Amplitude' : 'Range'}</th>
            <th>{fr ? 'Montée' : 'Up'}</th>
            <th>{fr ? 'Descente' : 'Down'}</th>
          </tr></thead>
          <tbody>
            {result.reps.map(rep => <tr key={rep.index}>
              <td>{rep.index}</td>
              <td>{rep.duration ? `${(rep.duration / 1000).toFixed(1)}s` : '-'}</td>
              <td>{rep.rom ? `${Math.round(rep.rom)}°` : '-'}</td>
              <td>{rep.up ? `${(rep.up / 1000).toFixed(1)}s` : '-'}</td>
              <td>{rep.down ? `${(rep.down / 1000).toFixed(1)}s` : '-'}</td>
            </tr>)}
          </tbody>
        </table>}
        {notes && <div className="sh-notes">
          <em>{fr ? 'Notes' : 'Notes'}</em>
          <p>{notes}</p>
        </div>}
        <p className="sh-foot">{fr ? 'Comptage automatique sur le téléphone. Version de test. Aucun score de forme.' : 'Counted automatically on the phone. Test version. No form score.'}</p>
      </article>

      <button className="btn-primary press" type="button" onClick={handleShare}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3.5" /><path d="M7.5 8L12 3.5 16.5 8" /><path d="M5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12" /></svg>
        <span>{fr ? 'Partager le PDF' : 'Share the PDF'}</span>
      </button>
      {toast && <p className="toast">{fr ? 'Sur iPhone, la feuille de partage s\u2019ouvre ici.' : 'On iPhone, the share sheet opens here.'}</p>}
    </div></section>
  </div>;
}
