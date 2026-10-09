import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { PRO } from './pro-copy';
import { exerciseName, guideExercise } from './exercise-info';
import { Thumb } from './Guide';
import { decodeResults, targetText } from './programme';
import { useCondensingTopbar } from './topbar';
import './Pro.css';

const BackIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>;

/**
 * A client's results, opened on the coach's phone from the link the client sent (#resultats=…, programme.js,
 * 9 October 2026): the programme's exercises, each with its target and the reps of each set the client saved that day,
 * as the client's own programme screen shows them (Programme.jsx). Read only, kept nowhere: the link holds it all.
 * payload: the link's payload.
 */
export default function Results({ payload, onClose }) {
  const { lang } = useT(), fr = lang === 'fr', c = PRO[fr ? 'fr' : 'en'];
  const [state, setState] = useState({ kind: 'opening' });
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang, state.kind]);

  useEffect(() => {
    let live = true;
    decodeResults(payload).then(r => { if (live) setState(r.ok ? { kind: 'results', results: r.results } : { kind: 'error', error: r.error }); });
    return () => { live = false; };
  }, [payload]);

  const top = <div className="topbar">
    <button className="icon-btn press" onClick={onClose} aria-label={c.back}><BackIcon /></button>
    <span className="pill">{fr ? 'Version de test' : 'Test version'}</span>
  </div>;

  if (state.kind !== 'results') {
    const words = state.kind === 'error' ? [c.errorTitle, c.errors[state.error] || c.errors.malformed] : [c.opening, ''];
    return <div className="wv-experience">
      <section ref={screenRef} className="screen is-active pro-screen programme-screen" data-testid="results-screen" aria-busy={state.kind === 'opening' || undefined}><div className="wrap">
        {top}
        <p className="eyebrow pro-eyebrow" data-reveal style={{ '--i': 0 }}>{c.resultsEyebrow}</p>
        <h1 className="title" data-reveal style={{ '--i': 0 }} data-testid={state.kind === 'error' ? 'results-error' : undefined}>{words[0]}</h1>
        {words[1] && <p className="sub pro-sub" data-reveal style={{ '--i': 1 }}>{words[1]}</p>}
        {state.kind === 'error' && <div className="actions" data-reveal style={{ '--i': 2 }}><button type="button" className="btn-ghost press" onClick={onClose}>{c.errorBack}</button></div>}
      </div></section>
    </div>;
  }

  const r = state.results;
  const [y, m, d] = r.day.split('-').map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const complete = r.items.filter(i => i.done.length >= i.sets).length;
  return <div className="wv-experience">
    <section ref={screenRef} className="screen is-active pro-screen programme-screen" data-testid="results-screen"><div className="wrap">
      {top}
      <p className="eyebrow pro-eyebrow" data-reveal style={{ '--i': 0 }}>{c.resultsEyebrow}</p>
      <h1 className="title" data-reveal style={{ '--i': 0 }}>{r.title}</h1>
      <p className="programme-meta" data-reveal style={{ '--i': 1 }}>
        {r.who && <span>{c.whoLine(r.who)}</span>}
        <span data-testid="results-day">{c.resultsDay(day)}</span>
        <span data-testid="results-done">{c.resultsDone(complete, r.items.length)}</span>
      </p>
      <ol className="programme-list" data-reveal style={{ '--i': 2 }}>{r.items.map((item, i) => {
        const name = exerciseName(item.key, lang), e = guideExercise(item.key);
        const slots = Math.max(item.sets, item.done.length);
        return <li key={`${item.key}-${i}`} className={`programme-item${item.done.length >= item.sets ? ' is-done' : ''}`} data-testid="results-item">
          <div className="programme-btn">
            {e ? <Thumb exercise={e} /> : <span className="thumb" />}
            <span className="programme-body">
              <span className="programme-name">{name}</span>
              <span className="programme-target mono">{targetText(item)}</span>
            </span>
          </div>
          {/* Planned against counted, as on the client's screen: one cell per planned set, the reps counted in the ones done. */}
          <ul className="programme-sets" aria-label={name} data-testid="results-sets">{Array.from({ length: slots }, (_, k) => {
            const n = item.done[k];
            return <li key={k} className={n === undefined ? 'is-todo' : n >= item.reps ? 'is-met' : 'is-short'}
              aria-label={n === undefined ? c.setTodo(k + 1) : c.setDone(k + 1, n, item.reps)}>
              {n !== undefined && <span aria-hidden="true">{n}</span>}
            </li>;
          })}</ul>
        </li>;
      })}</ol>
      <p className="foot pro-foot">{c.resultsSource}</p>
    </div></section>
  </div>;
}
