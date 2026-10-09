import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { PRO } from './pro-copy';
import { exerciseName, guideExercise } from './exercise-info';
import { Thumb } from './Guide';
import { decodeProgramme, plainResultsPayload, plannedOf, progressOf, resultsLink, resultsOf } from './programme';
import { keepReceived, loadReceived, openReceived, removeReceived } from './programme-store';
import { useSets } from './sets';
import { useCondensingTopbar } from './topbar';
import './Pro.css';

const BackIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>;

/**
 * The client's programme (6 October 2026): opened from the coach's link (#programme=…, programme.js), or from the
 * choice once kept. Each exercise with its target; a tap films it (onStart, the usual filming screen). The sets saved
 * from it today show beside the target: planned against counted (progressOf). Kept on this phone only.
 * payload: the link's payload when the app was opened from it, else null.
 */
export default function Programme({ payload, onClose, onStart }) {
  const { lang } = useT(), fr = lang === 'fr', c = PRO[fr ? 'fr' : 'en'];
  // 'opening' while a link is read; then the programme kept, an error, or none.
  const [state, setState] = useState(() => (payload ? { kind: 'opening' } : current(loadReceived())));
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState('');
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang, state.kind, state.entry?.id]);
  const sets = useSets();

  useEffect(() => {
    if (!payload) return undefined;
    let live = true;
    decodeProgramme(payload).then(r => {
      if (!live) return;
      if (!r.ok) { setState({ kind: 'error', error: r.error }); return; }
      const id = keepReceived(r.programme);
      // The address keeps no programme once it is on the phone: a reload, or Back, finds it kept.
      try { history.replaceState(history.state, '', '#programme'); } catch { /* the address keeps it; nothing breaks */ }
      setState(current(loadReceived(), id, r.programme));
    });
    return () => { live = false; };
  }, [payload]);

  const show = id => { openReceived(id); setConfirm(false); setState(current(loadReceived(), id)); screenRef.current?.scrollTo?.({ top: 0 }); };
  const remove = id => { removeReceived(id); setConfirm(false); setState(current(loadReceived())); };

  const top = <div className="topbar">
    <button className="icon-btn press" onClick={onClose} aria-label={c.back}><BackIcon /></button>
    <span className="pill">{fr ? 'Version de test' : 'Test version'}</span>
  </div>;

  if (state.kind !== 'programme') {
    const words = state.kind === 'error' ? [c.errorTitle, c.errors[state.error] || c.errors.malformed] : state.kind === 'opening' ? [c.opening, ''] : [c.none, c.noneSub];
    return <div className="wv-experience">
      <section ref={screenRef} className="screen is-active pro-screen programme-screen" data-testid="programme-screen" aria-busy={state.kind === 'opening' || undefined}><div className="wrap">
        {top}
        <p className="eyebrow pro-eyebrow" data-reveal style={{ '--i': 0 }}>{c.clientEyebrow}</p>
        <h1 className="title" data-reveal style={{ '--i': 0 }} data-testid={state.kind === 'error' ? 'programme-error' : undefined}>{words[0]}</h1>
        {words[1] && <p className="sub pro-sub" data-reveal style={{ '--i': 1 }}>{words[1]}</p>}
        {state.kind !== 'opening' && <div className="actions" data-reveal style={{ '--i': 2 }}><button type="button" className="btn-ghost press" onClick={onClose}>{c.errorBack}</button></div>}
      </div></section>
    </div>;
  }

  const { entry, others } = state, p = entry.programme;
  const progress = progressOf(p, entry.id, Array.isArray(sets) ? sets : []);
  // The results link (programme.js, resultsOf): ready before the tap, as a share must be called within it (Safari).
  // Offered once a set is saved today; the plain payload, made at once.
  const resultsUrl = progress.items.some(i => i.done.length) ? resultsLink(location.href, plainResultsPayload(resultsOf(p, progress))) : null;
  function sendResults() {
    if (!resultsUrl) return;
    const copy = () => (navigator.clipboard?.writeText(resultsUrl) ?? Promise.reject(new Error('no clipboard'))).then(() => setNote(c.resultsCopied), () => setNote(c.linkError));
    if (!navigator.share) { copy(); return; }
    // Refused for any reason but the client's own cancel, the link is copied instead.
    navigator.share({ title: p.title, text: c.resultsText(p.title), url: resultsUrl }).then(() => setNote(''), e => { if (e.name !== 'AbortError') copy(); });
  }
  return <div className="wv-experience">
    <section ref={screenRef} className="screen is-active pro-screen programme-screen" data-testid="programme-screen"><div className="wrap">
      {top}
      <p className="eyebrow pro-eyebrow" data-reveal style={{ '--i': 0 }}>{c.clientEyebrow}</p>
      <h1 className="title" data-reveal style={{ '--i': 0 }}>{p.title}</h1>
      <p className="programme-meta" data-reveal style={{ '--i': 1 }}>
        {p.who && <span>{c.whoLine(p.who)}</span>}
        <span data-testid="programme-today">{c.today(progress.complete, progress.total)}</span>
      </p>
      {p.note && <p className="programme-note" data-reveal style={{ '--i': 1 }}>{p.note}</p>}
      <ol className="programme-list" data-reveal style={{ '--i': 2 }}>{p.items.map((item, i) => {
        const name = exerciseName(item.key, lang), e = guideExercise(item.key), got = progress.items[i];
        const slots = Math.max(item.sets, got.done.length);
        return <li key={`${item.key}-${i}`} className={`programme-item${got.complete ? ' is-done' : ''}`} data-testid="programme-item">
          <button type="button" className="programme-btn press" onClick={() => onStart(item.key, plannedOf(entry.id, i, item))} aria-label={c.film(name)}>
            {e ? <Thumb exercise={e} /> : <span className="thumb" />}
            <span className="programme-body">
              <span className="programme-name">{name}</span>
              <span className="programme-target mono">{c.target(item.sets, item.reps, item.rest)}</span>
              {item.note && <span className="programme-cue">{item.note}</span>}
            </span>
            {got.complete
              ? <svg className="programme-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              : <svg className="row-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>}
          </button>
          {/* Planned against counted: one cell per planned set, the reps counted in the ones done. */}
          <ul className="programme-sets" aria-label={name} data-testid="programme-sets">{Array.from({ length: slots }, (_, k) => {
            const n = got.done[k];
            return <li key={k} className={n === undefined ? 'is-todo' : n >= item.reps ? 'is-met' : 'is-short'}
              aria-label={n === undefined ? c.setTodo(k + 1) : c.setDone(k + 1, n, item.reps)}>
              {n !== undefined && <span aria-hidden="true">{n}</span>}
            </li>;
          })}</ul>
        </li>;
      })}</ol>
      {resultsUrl && <div className="actions programme-send">
        <button type="button" className="btn-line press" onClick={sendResults} data-testid="programme-send">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M12 3v12" /><path d="M7 8l5-5 5 5" /></svg>
          <span>{c.sendResults}</span>
        </button>
        {note && <p className="pro-status" role="status" data-testid="programme-send-status">{note}</p>}
        <p className="foot pro-foot">{c.resultsPrivacy}</p>
      </div>}
      <p className="foot pro-foot">{c.tapHint} {c.sendBack}</p>
      <p className="foot pro-foot">{c.clientPrivacy}</p>
      {others.length > 0 && <>
        <h2 className="section-head">{c.othersHead}</h2>
        <ul className="pro-drafts">{others.map(o => <li key={o.id}>
          <button type="button" className="pro-draft press" onClick={() => show(o.id)}>
            <span className="row-txt"><b>{o.programme.title}</b>{o.programme.who && <small>{c.whoLine(o.programme.who)}</small>}</span>
            <svg className="row-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>
          </button>
        </li>)}</ul>
      </>}
      <div className="pro-delete">
        {confirm
          ? <div className="pro-confirm" role="group" aria-label={c.confirmRemove}>
            <p>{c.confirmRemove}</p>
            <div className="pro-confirm-row">
              <button type="button" className="btn-ghost is-s press" onClick={() => setConfirm(false)}>{c.cancel}</button>
              <button type="button" className="btn-ghost is-s press pro-danger" onClick={() => remove(entry.id)}>{c.confirmRemoveYes}</button>
            </div>
          </div>
          : <button type="button" className="text-btn press" onClick={() => setConfirm(true)}>{c.removeProgramme}</button>}
      </div>
    </div></section>
  </div>;
}

// The programme to show: the one named, else the one opened last; the others listed under it.
function current(list, id = null, fallback = null) {
  const entry = list.find(r => r.id === id) || (fallback && id ? { id, programme: fallback } : null) || list[0];
  if (!entry) return { kind: 'none' };
  return { kind: 'programme', entry, others: list.filter(r => r.id !== entry.id) };
}
