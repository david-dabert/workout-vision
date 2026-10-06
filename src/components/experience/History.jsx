import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { exerciseName } from './exercise-info';
import { limbLabel } from './lift-meta';
import Report, { warmReportPdf } from './Report';
import { loadSets, knownSets, onSetsChanged, removeSet, countedBy, setTime } from './sets';
import { exerciseProgress, recordsOf } from './progress';
import ExerciseProgress from './ExerciseProgress';
import ExportSets from './ExportSets';
import KeepSets from './KeepSets';
import ContributeHistory from './ContributeHistory';
import CollectHistory from './CollectHistory';
import { collectOn } from '../../lib/phoneCollect';
import { contributeBuild } from '../../lib/buildFlags';
import { contributions, forgetContributions, readChoice } from '../../lib/contribute';
import LevelPick from './LevelPick';
import { readLevel, writeLevel } from './level';
import { useCondensingTopbar } from './topbar';
import { track } from '../../lib/events';
import './History.css';

const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOAD_WAIT_MS = 10_000;
const dayKey = d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function dayLabel(d, fr) {
  const now = new Date(), yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return fr ? 'Aujourd’hui' : 'Today';
  if (dayKey(d) === dayKey(yesterday)) return fr ? 'Hier' : 'Yesterday';
  const opts = { weekday: 'long', day: 'numeric', month: 'long', ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }) };
  return d.toLocaleDateString(fr ? 'fr-FR' : 'en-GB', opts);
}

/** The sets saved on this phone, by day, each with its report. */
export default function History({ onClose }) {
  const { lang, tExercise } = useT(), fr = lang === 'fr';
  const [sets, setSets] = useState(knownSets); // null while reading
  const [problem, setProblem] = useState('');
  const [open, setOpen] = useState(null);       // the set whose details show
  const [confirm, setConfirm] = useState(null); // the set whose deletion waits for a second tap
  const [report, setReport] = useState(null);
  const [leaving, setLeaving] = useState(false);
  const [level, setLevel] = useState(readLevel);
  const timers = useRef({});
  const rowRefs = useRef({});
  // The title condenses into the topbar as the sets scroll under it (section 3, change 1).
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);

  // Contributions still on the phone keep their section in view, so they can always be erased, even with no set
  // left and the choice stored as no (third audit C17, 3 October).
  const [contributionsLeft, setContributionsLeft] = useState(false);
  useEffect(() => {
    let live = true;
    contributions().then(l => { if (live) setContributionsLeft(l.length > 0); }, () => {});
    return () => { live = false; };
  }, [sets]);

  useEffect(() => {
    const unread = fr ? 'Vos séries n’ont pas pu être lues sur ce téléphone.' : 'Your sets could not be read on this phone.';
    // A read that never ends (the browser's storage blocked or stuck) still shows the restore after LOAD_WAIT_MS,
    // with the line of a failed read; a read that ends later shows its sets and drops that line (audit of
    // 6 October, action 18). LOAD_WAIT_MS: convention (UNSOURCED value).
    let late = false;
    const slow = setTimeout(() => { late = true; setSets(s => s ?? []); setProblem(unread); }, LOAD_WAIT_MS);
    loadSets().then(list => { clearTimeout(slow); if (late) setProblem(''); setSets(list); }, () => { clearTimeout(slow); setSets([]); setProblem(unread); });
    // A set saved or deleted in another tab: the list, and so its backup and export, is read again (C19).
    const stop = onSetsChanged(() => { loadSets().then(setSets, () => {}); });
    const t = timers.current;
    return () => { stop(); clearTimeout(slow); clearTimeout(t.confirm); clearTimeout(t.close); };
  }, []);

  const liftName = w => (w.exercise && exerciseName(w.exercise, lang) !== w.exercise ? exerciseName(w.exercise, lang) : tExercise(w.exercise || w.exerciseKey));
  const armLabel = w => (w.arm === 'left' || w.arm === 'right' || w.arm === 'both') ? limbLabel(w.exercise || w.exerciseKey, w.arm, fr).text : '';

  function toggle(id) {
    setConfirm(null);
    setOpen(o => (o === id ? null : id));
    warmReportPdf().catch(() => {});
  }

  async function remove(w) {
    if (confirm !== w.id) {
      setConfirm(w.id);
      clearTimeout(timers.current.confirm);
      timers.current.confirm = setTimeout(() => setConfirm(null), 5000);
      return;
    }
    clearTimeout(timers.current.confirm);
    // The set listed after this one, or before it when it was the last: the rows are rendered in the order of
    // the list (third audit C13, 3 October).
    const order = (sets || []).map(x => x.id), at = order.indexOf(w.id);
    const neighbour = at < 0 ? undefined : order[at + 1] ?? order[at - 1];
    // The deleted set's row: focus still inside it is lost focus, even when the frame below runs before React has
    // removed the row (seen once under load in e2e/screen-focus.spec.js, 3 October: focus fell to nothing).
    const gone = rowRefs.current[w.id]?.closest('li') ?? null;
    try {
      await removeSet(w.id);
      // A deleted set's contribution goes with it: it is never sent (contribute.js).
      await forgetContributions([w.id]).catch(() => {});
      setSets(list => list.filter(x => x.id !== w.id));
      setOpen(null);
      setConfirm(null);
      // The delete button goes with its set: focus moves to the next set listed, or to the title when none is
      // left, never to nothing (second audit, 3 October).
      requestAnimationFrame(() => {
        const a = document.activeElement;
        if (a && a !== document.body && document.contains(a) && !gone?.contains(a)) return;
        const row = neighbour === undefined ? null : rowRefs.current[neighbour];
        const next = (row && document.contains(row) ? row : null) || document.querySelector('.history-screen h1, .history-screen .title');
        if (!next) return;
        if (!next.matches('button') && !next.hasAttribute('tabindex')) next.setAttribute('tabindex', '-1');
        next.focus({ preventScroll: true, focusVisible: false });
      });
    } catch {
      setConfirm(null);
      setProblem(fr ? 'La série n’a pas pu être supprimée. Réessayez.' : 'The set could not be deleted. Try again.');
    }
  }

  function closeReport() {
    if (leaving) return;
    const done = () => { const id = report?.id; setReport(null); setLeaving(false); requestAnimationFrame(() => rowRefs.current[id]?.focus({ preventScroll: true })); };
    if (REDUCED()) { done(); return; }
    setLeaving(true);
    timers.current.close = setTimeout(done, 450);
  }

  // Sets by day, newest first, as the storage returns them.
  const days = [];
  for (const w of sets || []) {
    const d = new Date(setTime(w)), key = dayKey(d);
    if (days.at(-1)?.key !== key) days.push({ key, label: dayLabel(d, fr), sets: [] });
    days.at(-1).sets.push(w);
  }
  // Per exercise, the reps of the last sets and the personal bests; a set holding one is marked.
  // The row shows the reps, so only the reps record is tagged there; the load records are
  // read in the progress lines, where their load is shown (review, 29 September).
  const progress = exerciseProgress(sets), repsBest = new Set([...recordsOf(progress)].filter(([, kinds]) => kinds.includes('reps')).map(([id]) => id));
  const time = w => new Date(setTime(w)).toLocaleTimeString(fr ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });

  return <>
    <div className="wv-experience" inert={report && !leaving ? true : undefined}>
      <section ref={screenRef} className="screen is-active history-screen"><div className="wrap">
        <div className="topbar">
          <button className="icon-btn press" onClick={onClose} aria-label={fr ? 'Retour' : 'Back'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <span className="pill">{fr ? 'Version de test' : 'Test version'}</span>
        </div>
        <h1 className="title" data-reveal style={{ '--i': 0 }}>{fr ? 'Vos séries.' : 'Your sets.'}</h1>
        <p className="sub" data-reveal style={{ '--i': 1 }}>{fr ? 'Enregistrées sur ce téléphone, elles n’en sortent que si vous les partagez.' : 'Saved on this phone, they leave it only if you share them.'}{sets?.length ? (fr ? ' Touchez une série pour en faire le rapport.' : ' Tap a set to make its report.') : ''}</p>
        {/* The level, changeable here at any time: it sets how much the result screen shows (level.js). */}
        <div data-reveal style={{ '--i': 2 }} data-testid="history-level">
          <LevelPick id="hist-level" label={fr ? 'Votre niveau' : 'Your level'} value={level} onChange={l => { if (writeLevel(l)) setLevel(l); }} fr={fr} />
        </div>
        {problem && <p className="hist-error" role="alert">{problem}</p>}
        {sets && !sets.length && !problem && <div className="hist-empty" data-reveal style={{ '--i': 2 }}>
          <p>{fr ? 'Aucune série enregistrée pour l’instant.' : 'No set saved yet.'}</p>
          <button className="btn-primary press" onClick={onClose}>{fr ? 'Filmer une série' : 'Record a set'}</button>
        </div>}
        <ExerciseProgress progress={progress} name={liftName} fr={fr} style={{ '--i': 2 }} />
        {days.map((day, i) => <section key={day.key} className="hist-day" data-reveal style={{ '--i': Math.min(i + 2, 6) }}>
          <h2 className="hist-head">{day.label}</h2>
          <ul className="hist-list">{day.sets.map(w => {
            const counted = countedBy(w), shown = open === w.id, arm = armLabel(w);
            // Typed by hand after a refusal (WP1.6): no count of the app to set beside it.
            const byHand = counted === null, fixed = !byHand && counted !== w.reps;
            const seconds = Math.round(w.duration || 0);
            return <li key={w.id} className="hist-item">
              <button ref={el => { rowRefs.current[w.id] = el; }} className="hist-btn press" aria-expanded={shown} onClick={() => toggle(w.id)}>
                <span className={`hist-n${fixed || byHand ? ' is-corrected' : ''}`} aria-hidden="true">{w.reps}</span>
                <span className="hist-txt">
                  <span className="hist-name">{liftName(w)}</span>
                  <span className="hist-meta"><span>{[time(w), seconds ? `${seconds}\u00A0s` : '', arm].filter(Boolean).map((part, i) => <span key={i}>{part}</span>)}</span></span>
                  <span className="sr">{fr ? `${w.reps} ${w.reps > 1 ? 'répétitions' : 'répétition'}` : `${w.reps} ${w.reps === 1 ? 'rep' : 'reps'}`}</span>
                </span>
                {(fixed || byHand || repsBest.has(w.id)) && <span className="hist-tags">
                  {repsBest.has(w.id) && <span className="hist-tag is-best">{fr ? 'Record' : 'Best'}</span>}
                  {fixed && <span className="hist-tag">{fr ? 'Corrigé' : 'Corrected'}</span>}
                  {byHand && <span className="hist-tag">{fr ? 'Saisi à la main' : 'Typed by hand'}</span>}
                </span>}
              </button>
              {shown && <div className="hist-detail appear">
                {byHand && w.afterRefusal && <p className="hist-corr">{fr ? 'Saisi à la main : l’app n’a pas pu compter cette série.' : 'Typed by hand: the app could not count this set.'}</p>}
                {fixed && <p className="hist-corr">{fr ? `Compté par l’app : ${counted}. Corrigé : ${w.reps}.` : `Counted by the app: ${counted}. Corrected: ${w.reps}.`}</p>}
                <button className="btn-line press" onClick={() => { setLeaving(false); setReport(w); track('report_open', { lift: w.exercise || w.exerciseKey }); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3v5h5" /><path d="M8.5 13h7M8.5 16.5h5" /></svg>
                  <span>{fr ? 'Rapport de séance' : 'Session report'}</span>
                </button>
                <button className={`text-btn press${confirm === w.id ? ' is-armed' : ''}`} onClick={() => remove(w)}>
                  {confirm === w.id ? (fr ? 'Touchez encore pour supprimer' : 'Tap again to delete') : (fr ? 'Supprimer cette série' : 'Delete this set')}
                </button>
              </div>}
            </li>;
          })}</ul>
        </section>)}
        {/* The data, after the sets (the first set stays in view, PLAN.md rule 6): export, backup and restore,
            restore offered even with no set, as on a new phone. */}
        {sets && <section className="hist-data" data-reveal style={{ '--i': 6 }} data-testid="hist-data">
          <h2 className="eyebrow">{fr ? 'Vos données' : 'Your data'}</h2>
          <ExportSets sets={sets} lang={lang} name={liftName} />
          <KeepSets sets={sets} fr={fr} onRestored={list => { setProblem(''); setSets(list); }} />
        </section>}
        {/* While helping, or while contributions wait, the section stays, so the person can always stop and erase,
            even with no set left. A build with contributions paused (buildFlags.js, WP0.4) offers nothing to start:
            the section shows only for a stored yes or sets still waiting, to stop and erase them. */}
        {((contributeBuild() && sets?.length > 0) || readChoice() === 'yes' || contributionsLeft) && <ContributeHistory fr={fr} sets={sets} style={{ '--i': 6 }} />}
        {/* On David's phone only, with the flag set at #collecte (phoneCollect.js): the landmark files to send. */}
        {collectOn() && <CollectHistory fr={fr} sets={sets} style={{ '--i': 6 }} />}
      </div></section>
    </div>
    {report && <Report lift={report.exercise || report.exerciseKey} count={report.reps} counted={countedBy(report)} arm={report.arm}
      date={setTime(report)} source={report.source} afterRefusal={!!report.afterRefusal} reps={report.repDetailsVersion === 2 ? report.repDetails : null}
      setId={report.id} sides={report.sides ?? null} wave={report.repDetailsVersion === 2 ? report.wave ?? null : null} leaving={leaving} onBack={closeReport} />}
  </>;
}
