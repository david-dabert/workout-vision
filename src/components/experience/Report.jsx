import { useState, useRef, useEffect } from 'react';
import { useT } from '../../lib/LanguageContext';
import { exerciseName } from './exercise-info';
import { reportSheet, reportFileName, NAME_MAX, NOTES_MAX } from './report-sheet';
import { knownSets, setTime } from './sets';
import { liftDefinition } from '../../lib/counting/core';
import './Report.css';

// The PDF code (jsPDF and the app's fonts) loads apart from the screens, once,
// and is warmed as soon as a report is likely, so the share happens within the tap.
let kit = null, loading = null, warmed = false;
export function warmReportPdf() {
  loading ||= import('./report-pdf').then(m => (kit = m), e => { loading = null; throw e; });
  return loading;
}

/**
 * The session report for one saved set. It assumes no coach (step 1): the user says, if they
 * wish, their name, whom they trained with and at which level, and the sheet shows only that.
 * count: the number the visitor confirmed or corrected; counted: what the app counted.
 * reps: the app's reps, when their details were measured with step 3c's boundaries.
 */
export default function Report({ lift, count, counted, arm, date, source, leaving, onBack, reps }) {
  const { lang } = useT(), fr = lang === 'fr';
  const [name, setName] = useState('');
  const [context, setContext] = useState(''); // '' | alone | friend | coach
  const [partner, setPartner] = useState('');
  const [level, setLevel] = useState(''); // '' | beginner | intermediate | expert
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState(kit ? 'ready' : 'preparing'); // ready | preparing | error
  const [note, setNote] = useState('');
  const failures = useRef(0);
  const noteTimer = useRef(0);
  const sharing = useRef(false);
  const backRef = useRef(null), partnerRef = useRef(null), notesRef = useRef(null);
  const when = useRef(date ? new Date(date) : new Date()).current;

  const liftName = exerciseName(lift, lang);
  const first = liftDefinition(lift)?.first || 'concentric';
  // The previous saved set of the same lift, if any, for comparison.
  const prevRef = useRef(undefined);
  if (prevRef.current === undefined) {
    const all = knownSets();
    if (all) {
      const prev = all.filter(w => (w.exercise || w.exerciseKey) === lift && w.repDetails?.length && w.repDetailsVersion >= 2)
        .sort((a, b) => setTime(b) - setTime(a))[0];
      prevRef.current = prev ? { count: prev.reps, reps: prev.repDetails, date: new Date(prev.createdAt ?? prev.date) } : null;
    } else {
      prevRef.current = null;
    }
  }
  const sheet = reportSheet({ lang, date: when, name, context, partner, level, notes, liftName, count, counted, arm, joint: liftDefinition(lift)?.joint, reps, source, first, previousSet: prevRef.current });
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
    const fileName = reportFileName({ lang, date: when, name });
    const file = new File([blob], fileName, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      sharing.current = true;
      navigator.share({ files: [file], title: sheet.title })
        .catch(e => { if (e.name !== 'AbortError' && e.name !== 'InvalidStateError') download(blob, fileName); })
        .finally(() => { sharing.current = false; });
      return;
    }
    download(blob, fileName);
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
      <h2 className="title">{fr ? 'Rapport de séance' : 'Session report'}</h2>
      <p className="report-sub">{fr ? 'Tout est facultatif\u00A0: seul ce que vous remplissez apparaît sur le PDF.' : 'Everything is optional: only what you fill in appears on the PDF.'}</p>
      <div className="field">
        <label htmlFor="fName">{fr ? 'Votre nom' : 'Your name'}</label>
        <input id="fName" type="text" autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint="next" maxLength={NAME_MAX}
          placeholder={fr ? 'Prénom et nom' : 'First and last name'} value={name} onChange={e => setName(e.target.value)} onKeyDown={next(notesRef)} />
      </div>
      <Choice id="fWith" label={fr ? 'Entraînement' : 'Training'} value={context} onChange={v => { setContext(v); setPartner(''); }}
        options={[['alone', fr ? 'En solo' : 'Alone'], ['friend', fr ? 'En binôme' : 'With a friend'], ['coach', fr ? 'Avec un coach' : 'With a coach']]} />
      {(context === 'friend' || context === 'coach') && <div className="field fade-in">
        <label htmlFor="fPartner">{context === 'coach' ? (fr ? 'Nom du coach' : 'Coach’s name') : (fr ? 'Nom du partenaire' : 'Friend’s name')}</label>
        <input id="fPartner" ref={partnerRef} type="text" autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint="next" maxLength={NAME_MAX}
          placeholder={fr ? 'Prénom et nom' : 'First and last name'} value={partner} onChange={e => setPartner(e.target.value)} onKeyDown={next(notesRef)} />
      </div>}
      <Choice id="fLevel" label={fr ? 'Niveau' : 'Level'} value={level} onChange={setLevel}
        options={[['beginner', fr ? 'Débutant' : 'Beginner'], ['intermediate', fr ? 'Intermédiaire' : 'Intermediate'], ['expert', fr ? 'Confirmé' : 'Expert']]} />
      <div className="field">
        <label htmlFor="fNotes">Notes</label>
        <textarea id="fNotes" ref={notesRef} rows="3" autoCapitalize="sentences" maxLength={NOTES_MAX}
          placeholder={fr ? 'Observations, consignes pour la prochaine séance…' : 'Observations, instructions for the next session…'} value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <article className="sheet" aria-label={fr ? 'Aperçu du PDF' : 'PDF preview'}>
        <div className="sh-top">{sheet.brand && <span>{sheet.brand}</span>}<span>{sheet.date}</span></div>
        <h3 className="sh-title">{sheet.title}</h3>
        {sheet.people.length > 0 && <div className="sh-people">
          {sheet.people.map(([label, value]) => <span key={label}><em>{label}</em><span>{value}</span></span>)}
        </div>}
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
        {sheet.summary.map(line => <p key={line} className="sh-line">{line}</p>)}
        {sheet.shortRepNote && <p className="sh-line sh-short">{sheet.shortRepNote}</p>}
        {sheet.notes && <div className="sh-notes"><em>{sheet.notesLabel}</em><p>{sheet.notes}</p></div>}
        <p className="sh-foot">{sheet.foot}</p>
      </article>

      <div className="share-bar">
        <p className="share-note" role="status">{note}</p>
        <button type="button" className={`btn-primary press${busy ? ' is-busy' : ''}`} aria-disabled={busy || undefined} onClick={share}>
          {status === 'ready' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3.5" /><path d="M7.5 8L12 3.5 16.5 8" /><path d="M5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12" /></svg>}
          <span>{status === 'ready' ? (fr ? 'Partager le PDF' : 'Share the PDF')
            : busy ? (fr ? 'Préparation du PDF…' : 'Preparing the PDF…')
              : (fr ? 'Réessayer' : 'Try again')}</span>
        </button>
      </div>
    </div></section>
  </div>;
}

// One answer among a few, or none: a second tap on the chosen one clears it, since every answer is optional.
function Choice({ id, label, value, onChange, options }) {
  return <div className="field">
    <span className="field-label" id={id}>{label}</span>
    <div className="report-seg" role="group" aria-labelledby={id}>
      {options.map(([key, text]) => <button key={key} type="button" className="press" aria-pressed={value === key}
        onClick={() => onChange(value === key ? '' : key)}>{text}</button>)}
    </div>
  </div>;
}
