import { useState, useRef, useEffect } from 'react';
import { useT } from '../../lib/LanguageContext';
import { META } from './lift-scenes';
import { reportSheet, reportFileName, NAME_MAX, NOTES_MAX } from './report-sheet';
import './Report.css';

// The PDF code (jsPDF and the app's fonts) loads apart from the screens, once,
// and is warmed as soon as a report is likely, so the share happens within the tap.
let kit = null, loading = null, warmed = false;
export function warmReportPdf() {
  loading ||= import('./report-pdf').then(m => (kit = m), e => { loading = null; throw e; });
  return loading;
}

/**
 * The coach's report for one saved set.
 * count: the number the visitor confirmed or corrected; counted: what the app counted.
 * reps: the app's reps, when their details were measured with step 3c's boundaries.
 */
export default function Report({ lift, count, counted, arm, date, source, leaving, onBack, reps }) {
  const { lang, tExercise } = useT(), fr = lang === 'fr';
  const [client, setClient] = useState('');
  const [coach, setCoach] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState(kit ? 'ready' : 'preparing'); // ready | preparing | error
  const [note, setNote] = useState('');
  const failures = useRef(0);
  const noteTimer = useRef(0);
  const sharing = useRef(false);
  const backRef = useRef(null), coachRef = useRef(null), notesRef = useRef(null);
  const when = useRef(date ? new Date(date) : new Date()).current;

  const liftName = META[lift]?.[lang] || tExercise(lift);
  const sheet = reportSheet({ lang, date: when, client, coach, notes, liftName, count, counted, arm, reps, source });
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;

  function prepare() {
    setStatus('preparing');
    warmReportPdf().then(() => { setStatus('ready'); setNote(''); }, () => {
      failures.current += 1;
      setStatus('error');
      setNote(failures.current > 1
        ? (fr ? 'Le PDF n’a pas pu être préparé. Rechargez l’app, puis rouvrez la série dans Vos séries.' : 'The PDF could not be prepared. Reload the app, then open the set again in Your sets.')
        : (fr ? 'Le PDF n’a pas pu être préparé. Réessayez.' : 'The PDF could not be prepared. Try again.'));
    });
  }

  useEffect(() => {
    backRef.current?.focus({ preventScroll: true });
    if (!kit) prepare();
    // One build in advance, once the screen has settled, so the first share is as quick as the next.
    const t = setTimeout(() => {
      if (warmed) return;
      warmReportPdf().then(m => { if (!warmed) { warmed = true; try { m.reportPdf(sheetRef.current); } catch { /* the share reports it */ } } }, () => {});
    }, 900);
    return () => { clearTimeout(t); clearTimeout(noteTimer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function say(text) {
    clearTimeout(noteTimer.current);
    setNote(text);
    noteTimer.current = setTimeout(() => setNote(''), 4000);
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    say(fr ? 'PDF téléchargé.' : 'PDF downloaded.');
  }

  // Built and shared inside the tap: Safari opens the share sheet only from a gesture.
  function share() {
    if (status === 'preparing' || sharing.current) return; // one share sheet at a time
    if (status === 'error' || !kit) { prepare(); return; }
    let blob;
    try { blob = kit.reportPdf(sheet); } catch (e) {
      console.error('[report pdf]', e);
      setNote(fr ? 'Le PDF n’a pas pu être préparé. Réessayez.' : 'The PDF could not be prepared. Try again.');
      return;
    }
    const name = reportFileName({ lang, date: when, client });
    const file = new File([blob], name, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      sharing.current = true;
      navigator.share({ files: [file], title: sheet.title })
        .catch(e => { if (e.name !== 'AbortError' && e.name !== 'InvalidStateError') download(blob, name); })
        .finally(() => { sharing.current = false; });
      return;
    }
    download(blob, name);
  }

  const next = target => e => { if (e.key === 'Enter') { e.preventDefault(); target.current?.focus(); } };
  const busy = status === 'preparing';

  return <div className={`wv-experience${leaving ? ' is-leaving' : ''}`}>
    <section className="screen is-active report-screen"><div className="wrap">
      <div className="topbar">
        <button ref={backRef} className="icon-btn press" onClick={onBack} aria-label={fr ? 'Retour' : 'Back'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span className="pill">{fr ? 'Version de test' : 'Test version'}</span>
      </div>
      <h2 className="title">{fr ? 'Rapport pour votre coach' : 'Report for your coach'}</h2>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="fClient">Client</label>
          <input id="fClient" type="text" autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint="next" maxLength={NAME_MAX}
            placeholder={fr ? 'Prénom et nom' : 'First and last name'} value={client} onChange={e => setClient(e.target.value)} onKeyDown={next(coachRef)} />
        </div>
        <div className="field">
          <label htmlFor="fCoach">Coach</label>
          <input id="fCoach" ref={coachRef} type="text" autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint="next" maxLength={NAME_MAX}
            placeholder={fr ? 'Prénom et nom' : 'First and last name'} value={coach} onChange={e => setCoach(e.target.value)} onKeyDown={next(notesRef)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="fNotes">Notes</label>
        <textarea id="fNotes" ref={notesRef} rows="3" autoCapitalize="sentences" maxLength={NOTES_MAX}
          placeholder={fr ? 'Observations, consignes pour la prochaine séance…' : 'Observations, instructions for the next session…'} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <article className="sheet" aria-label={fr ? 'Aperçu du PDF' : 'PDF preview'}>
        <div className="sh-top"><span>{sheet.brand}</span><span>{sheet.date}</span></div>
        <h3 className="sh-title">{sheet.title}</h3>
        <div className="sh-people">
          <span><em>{sheet.clientLabel}</em><span>{sheet.client}</span></span>
          <span><em>{sheet.coachLabel}</em><span>{sheet.coach}</span></span>
        </div>
        <div className="sh-count">
          <span className="sh-n">{sheet.count}</span>
          <span className="sh-nl"><b>{sheet.word}</b><span>{sheet.lift}</span></span>
        </div>
        {sheet.corrected && <p className="sh-line">{sheet.corrected}</p>}
        {sheet.arm && <p className="sh-line">{sheet.arm}</p>}
        {sheet.rows.length > 0 && <table className="sh-table">
          <thead><tr>{sheet.columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
          <tbody>{sheet.rows.map(row => <tr key={row[0]}>{row.map((v, k) => <td key={k}>{v}</td>)}</tr>)}</tbody>
        </table>}
        {sheet.summary && <p className="sh-line">{sheet.summary}</p>}
        <div className="sh-notes"><em>{sheet.notesLabel}</em><p>{sheet.notes}</p></div>
        <p className="sh-foot">{sheet.foot}</p>
      </article>

      <div className="share-bar">
        <p className="share-note" role="status">{note}</p>
        <label className={`btn-primary press${busy ? ' is-busy' : ''}`} role="button" tabIndex={0} aria-disabled={busy || undefined}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); share(); } }}>
          <input type="checkbox" {...{ switch: '' }} className="hx" tabIndex={-1} aria-hidden="true" onChange={share} />
          {status === 'ready' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3.5" /><path d="M7.5 8L12 3.5 16.5 8" /><path d="M5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12" /></svg>}
          <span>{status === 'ready' ? (fr ? 'Partager le PDF' : 'Share the PDF')
            : busy ? (fr ? 'Préparation du PDF…' : 'Preparing the PDF…')
              : (fr ? 'Réessayer' : 'Try again')}</span>
        </label>
      </div>
    </div></section>
  </div>;
}
