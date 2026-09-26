import { useState, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { META, liftView } from './lift-scenes';
import './Report.css';

async function buildPDF({ fr, today, client, coach, count, liftName, armLabel, corrected, resultCount, notes }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 20;
  let y = 25;

  doc.setFontSize(9);
  doc.setTextColor(107, 98, 86);
  doc.text('Workout Vision', M, y);
  doc.text(today, W - M, y, { align: 'right' });
  y += 12;

  doc.setFontSize(24);
  doc.setTextColor(29, 24, 18);
  doc.text(fr ? 'Rapport de séance' : 'Session report', M, y);
  y += 14;

  doc.setFontSize(9);
  doc.setTextColor(107, 98, 86);
  doc.text(fr ? 'CLIENT' : 'CLIENT', M, y);
  doc.text(fr ? 'COACH' : 'COACH', M + 85, y);
  y += 5;
  doc.setFontSize(12);
  doc.setTextColor(29, 24, 18);
  doc.text(client || '-', M, y);
  doc.text(coach || '-', M + 85, y);
  y += 12;

  doc.setDrawColor(228, 220, 205);
  doc.line(M, y, W - M, y);
  y += 10;

  doc.setFontSize(48);
  doc.setTextColor(138, 102, 48);
  doc.text(String(count), M, y);
  const countW = doc.getTextWidth(String(count));
  doc.setFontSize(13);
  doc.setTextColor(29, 24, 18);
  doc.text(fr ? 'répétitions' : 'reps', M + countW + 6, y - 10);
  doc.setFontSize(12);
  doc.setTextColor(107, 98, 86);
  doc.text(liftName, M + countW + 6, y - 1);
  y += 8;

  doc.setFontSize(11);
  doc.setTextColor(107, 98, 86);
  doc.text(`${fr ? 'Bras suivi : ' : 'Arm tracked: '}${armLabel}`, M, y);
  y += 6;

  if (corrected) {
    doc.text(fr
      ? `Compté par l'app : ${resultCount}. Corrigé : ${count}.`
      : `Counted by the app: ${resultCount}. Corrected: ${count}.`, M, y);
    y += 6;
  }

  if (notes) {
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(107, 98, 86);
    doc.text(fr ? 'NOTES' : 'NOTES', M, y);
    y += 5;
    doc.setFontSize(11);
    doc.setTextColor(29, 24, 18);
    const noteLines = doc.splitTextToSize(notes, W - 2 * M);
    doc.text(noteLines, M, y);
    y += noteLines.length * 5;
  }

  y += 8;
  doc.setDrawColor(228, 220, 205);
  doc.line(M, y, W - M, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(107, 98, 86);
  doc.text(fr ? 'Comptage automatique sur le téléphone. Version de test. Aucun score de forme.' : 'Counted automatically on the phone. Test version. No form score.', M, y);

  return doc.output('blob');
}

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
    const blob = await buildPDF({ fr, today, client, coach, count, liftName, armLabel, corrected, resultCount: result.count, notes });
    const file = new File([blob], fr ? 'rapport_seance.pdf' : 'session_report.pdf', { type: 'application/pdf' });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fr ? 'Rapport de séance' : 'Session report' });
      } catch { /* user cancelled */ }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      setToast(true);
      setTimeout(() => setToast(false), 3000);
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
      {toast && <p className="toast">{fr ? 'PDF téléchargé.' : 'PDF downloaded.'}</p>}
    </div></section>
  </div>;
}
