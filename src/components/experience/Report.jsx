import { useState, useRef, useEffect } from 'react';
import { useT } from '../../lib/LanguageContext';
import { exerciseName } from './exercise-info';
import { reportSheet, reportFileName, NAME_MAX, NOTES_MAX } from './report-sheet';
import { knownSets, loadSets, previousSet } from './sets';
import { liftDefinition } from '../../lib/counting/core';
import { track } from '../../lib/events';
import { useCondensingTopbar } from './topbar';
import './Report.css';
import RepWave from './RepWave';
import { MeasureGuide } from './measure-guide';

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
export default function Report({ lift, count, counted, arm, date, source, afterRefusal = false, leaving, onBack, reps, setId, sides = null, wave = null, planned = null }) {
  const { lang } = useT(), fr = lang === 'fr';
  const [name, setName] = useState('');
  const [context, setContext] = useState(''); // '' | alone | friend | coach
  const [partner, setPartner] = useState('');
  // '' | beginner | intermediate | expert, prefilled from the level stored on this phone (level.js).
  // Empty until chosen here: the screen promises that only what the user fills in appears on the PDF,
  // so the level stored for the result screen is not written on the sheet by itself (review, 30 September).
  const [level, setLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState(kit ? 'ready' : 'preparing'); // ready | preparing | error
  const [note, setNote] = useState('');
  const failures = useRef(0);
  const noteTimer = useRef(0);
  const sharing = useRef(false);
  // The title condenses into the topbar as the form scrolls under it (section 3, change 1).
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);
  const backRef = useRef(null), partnerRef = useRef(null), notesRef = useRef(null);
  const when = useRef(date ? new Date(date) : new Date()).current;

  const liftName = exerciseName(lift, lang);
  const first = liftDefinition(lift)?.first || 'concentric';
  // The previous saved set of the same lift and the same tracked arm or side, if any, for comparison: before this one, never this one.
  // Just after a save the sets are being read again; the comparison then follows once they are in,
  // rather than being left out for good (review, 30 September).
  const previousOf = all => {
    const prev = previousSet(all, lift, { id: setId, at: when.getTime(), arm });
    return prev ? { count: prev.reps, reps: prev.repDetails, date: new Date(prev.createdAt ?? prev.date) } : null;
  };
  const [previous, setPrevious] = useState(() => { const all = knownSets(); return all ? previousOf(all) : undefined; });
  useEffect(() => {
    if (previous !== undefined) return undefined;
    let live = true;
    loadSets().then(all => { if (live) setPrevious(previousOf(all)); }, () => { if (live) setPrevious(null); });
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const sheet = reportSheet({ lang, date: when, name, context, partner, level, notes, liftName, count, counted, arm, joint: liftDefinition(lift)?.joint, reps, source, afterRefusal, first, previousSet: previous ?? null, sides, lift, wave, planned });
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
    backRef.current?.focus({ preventScroll: true, focusVisible: false });
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
    track('share', { lift });
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
    <section ref={screenRef} className="screen is-active report-screen"><div className="wrap">
      <div className="topbar">
        <button ref={backRef} className="icon-btn press" onClick={onBack} aria-label={fr ? 'Retour' : 'Back'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span className="pill">{fr ? 'Version de test' : 'Test version'}</span>
      </div>
      <h2 className="title" data-reveal style={{ '--i': 0 }}>{fr ? 'Rapport de séance' : 'Session report'}</h2>
      <p className="report-sub" data-reveal style={{ '--i': 1 }}>{fr ? 'Tout est facultatif\u00A0: seul ce que vous remplissez apparaît sur le PDF.' : 'Everything is optional: only what you fill in appears on the PDF.'}</p>
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

      <article className="sheet" data-reveal style={{ '--i': 3 }} aria-label={fr ? 'Aperçu du PDF' : 'PDF preview'}>
        <div className="sh-top">{sheet.brand && <span>{sheet.brand}</span>}<span>{sheet.date}</span></div>
        <h3 className="sh-title">{sheet.title}</h3>
        {sheet.people.length > 0 && <div className="sh-people">
          {sheet.people.map(([label, value]) => <span key={label}><em>{label}</em><span>{value}</span></span>)}
        </div>}
        <div className="sh-count">
          <span className="sh-n">{sheet.count}</span>
          <span className="sh-nl"><b>{sheet.word}</b><span>{sheet.lift}</span>{sheet.planned && <span className="sh-planned" data-testid="sh-planned">{sheet.planned}</span>}</span>
        </div>
        {/* The numeral leads; the sentence is its caption (critic, 30 September). */}
        {sheet.opener && <p className="sh-opener">{sheet.opener}</p>}
        {/* How the count was made, labelled like the people above (David's iPhone, 5 October: four grey sentences of equal weight). */}
        {sheet.details.length > 0 && <div className="sh-people sh-details">
          {sheet.details.map(([label, value]) => <span key={label}><em>{label}</em><span>{value}</span></span>)}
        </div>}
        {/* The set's two figures, set like the count, under it. */}
        {sheet.stats.length > 0 && <div className="sh-stats" data-testid="sh-stats">
          {sheet.stats.map(([label, value]) => <span key={label}><em>{label}</em><b>{value}</b></span>)}
        </div>}
        {sheet.wave && <div className="sh-wave" data-testid="sh-wave"><RepWave angles={sheet.wave.a} timestamps={sheet.wave.t} reps={sheet.wave.reps} rest={sheet.wave.rest} first={sheet.wave.first} sel={-1} shown={sheet.wave.reps.length} fr={fr} jointWord={sheet.wave.jointWord} onSelect={() => {}} reference={sheet.wave.reference} /></div>}
        {sheet.rows.length > 0 && <table className="sh-table">
          <thead><tr>{sheet.columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
          <tbody>{sheet.rows.map(row => <tr key={row[0]}>{row.map((v, k) => <td key={k}>{v}</td>)}</tr>)}</tbody>
        </table>}
        {(sheet.shortRepNote || sheet.partialRepNote) && <p className="sh-foot-notes">{[sheet.shortRepNote, sheet.partialRepNote].filter(Boolean).join('   ')}</p>}
        {sheet.more.map(line => <p key={line} className="sh-line">{line}</p>)}
        {sheet.guide && <MeasureGuide guide={sheet.guide} />}
        {sheet.notes && <div className="sh-notes"><em>{sheet.notesLabel}</em><p>{sheet.notes}</p></div>}
        {sheet.foot && <p className="sh-foot">{sheet.foot}</p>}
        {/* Experimental, at the foot of the sheet as at the foot of every PDF page (R8). */}
        {sheet.experimental && <p className="sh-exp" data-testid="sh-exp">{sheet.experimental}</p>}
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
