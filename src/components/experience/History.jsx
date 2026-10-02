import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { exerciseName } from './exercise-info';
import { limbLabel } from './lift-meta';
import Report, { warmReportPdf } from './Report';
import { loadSets, knownSets, removeSet, countedBy, setTime } from './sets';
import { exerciseProgress, recordsOf } from './progress';
import ExerciseProgress from './ExerciseProgress';
import ExportSets from './ExportSets';
import LevelPick from './LevelPick';
import { readLevel, writeLevel } from './level';
import { useCondensingTopbar } from './topbar';
import './History.css';

const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  useEffect(() => {
    loadSets().then(setSets, () => { setSets([]); setProblem(fr ? 'Vos séries n’ont pas pu être lues sur ce téléphone.' : 'Your sets could not be read on this phone.'); });
    const t = timers.current;
    return () => { clearTimeout(t.confirm); clearTimeout(t.close); };
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
    try {
      await removeSet(w.id);
      setSets(list => list.filter(x => x.id !== w.id));
      setOpen(null);
      setConfirm(null);
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
        <p className="sub" data-reveal style={{ '--i': 1 }}>{fr ? 'Elles restent sur ce téléphone.' : 'They stay on this phone.'}{sets?.length ? (fr ? ' Touchez une série pour en faire le rapport.' : ' Tap a set to make its report.') : ''}</p>
        <ExportSets sets={sets} lang={lang} name={liftName} style={{ '--i': 1 }} />
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
            const seconds = Math.round(w.duration || 0);
            return <li key={w.id} className="hist-item">
              <button ref={el => { rowRefs.current[w.id] = el; }} className="hist-btn press" aria-expanded={shown} onClick={() => toggle(w.id)}>
                <span className={`hist-n${counted !== w.reps ? ' is-corrected' : ''}`} aria-hidden="true">{w.reps}</span>
                <span className="hist-txt">
                  <span className="hist-name">{liftName(w)}</span>
                  <span className="hist-meta"><span>{[time(w), seconds ? `${seconds} s` : '', arm].filter(Boolean).map((part, i) => <span key={i}>{part}</span>)}</span></span>
                  <span className="sr">{fr ? `${w.reps} ${w.reps > 1 ? 'répétitions' : 'répétition'}` : `${w.reps} ${w.reps === 1 ? 'rep' : 'reps'}`}</span>
                </span>
                {(counted !== w.reps || repsBest.has(w.id)) && <span className="hist-tags">
                  {repsBest.has(w.id) && <span className="hist-tag is-best">{fr ? 'Record' : 'Best'}</span>}
                  {counted !== w.reps && <span className="hist-tag">{fr ? 'Corrigé' : 'Corrected'}</span>}
                </span>}
              </button>
              {shown && <div className="hist-detail appear">
                {counted !== w.reps && <p className="hist-corr">{fr ? `Compté par l’app : ${counted}. Corrigé : ${w.reps}.` : `Counted by the app: ${counted}. Corrected: ${w.reps}.`}</p>}
                <button className="btn-line press" onClick={() => { setLeaving(false); setReport(w); }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3v5h5" /><path d="M8.5 13h7M8.5 16.5h5" /></svg>
                  <span>{fr ? 'Rapport de séance' : 'Session report'}</span>
                </button>
                <button className={`text-btn press${confirm === w.id ? ' is-armed' : ''}`} onClick={() => remove(w)}>
                  {confirm === w.id ? (fr ? 'Toucher encore pour supprimer' : 'Tap again to delete') : (fr ? 'Supprimer cette série' : 'Delete this set')}
                </button>
              </div>}
            </li>;
          })}</ul>
        </section>)}
      </div></section>
    </div>
    {report && <Report lift={report.exercise || report.exerciseKey} count={report.reps} counted={countedBy(report)} arm={report.arm}
      date={setTime(report)} source={report.source} reps={report.repDetailsVersion === 2 ? report.repDetails : null}
      setId={report.id} sides={report.sides ?? null} leaving={leaving} onBack={closeReport} />}
  </>;
}
