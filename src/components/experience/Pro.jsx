import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { useT } from '../../lib/LanguageContext';
import { PRO } from './pro-copy';
import { exerciseName, guideExercise } from './exercise-info';
import { Thumb } from './Guide';
import { LIMITS, MAX_PAYLOAD, encodeProgramme, plainPayload, programmeLink, programmeOf, fixItem } from './programme';
import { MAX_DRAFTS, isEmptyDraft, loadDrafts, saveDraft, removeDraft, newDraft, newItem } from './programme-store';
import { useCondensingTopbar } from './topbar';
// The form's fields are the report's (Report.css: .field), so the two forms read alike.
import './Report.css';
import './Pro.css';

// The searchable list of every exercise the app counts, the choice's own (ExerciseList.jsx), to pick from.
const ExerciseList = lazy(() => import('./ExerciseList'));

// The programme's PDF (jsPDF and the app's fonts) loads apart, once, as the report's does (Report.jsx), and is warmed
// as soon as a programme is open, so the share happens within the tap.
let kit = null, loading = null;
function warmProgrammePdf() {
  loading ||= import('./programme-pdf').then(m => (kit = m), e => { loading = null; throw e; });
  return loading;
}

// The link that carries a payload, or 'too-long' when a link cannot carry it.
const linkOf = payload => (payload.length <= MAX_PAYLOAD ? programmeLink(location.href, payload) : 'too-long');

// One share sheet per tap: a second tap within this time of the first is let go. A lock held until the share settles
// left both share buttons dead for good when a share never settled. Status: convention, UNSOURCED.
const SHARE_GAP_MS = 1000;

const BackIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>;
const Arrow = () => <svg className="row-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>;

/**
 * Espace pro (6 October 2026): a coach, or a physiotherapist, builds a programme for a client and sends it as a PDF or
 * as a link that opens it in the client's app. Nothing leaves the phone but through the share sheet or the clipboard,
 * on the coach's tap; the drafts stay in this phone's storage (programme-store.js).
 */
/**
 * Espace pro: the coach's drafts, and the editor of one. start: { draft, kept }, a draft to open at once (the one a
 * client's results lead to, programme-store.js, draftFromResults).
 */
export default function Pro({ onClose, start = null }) {
  const { lang } = useT(), fr = lang === 'fr', c = PRO[fr ? 'fr' : 'en'];
  const [drafts, setDrafts] = useState(() => {
    const list = loadDrafts();
    return start && !list.some(d => d.id === start.draft.id) ? [start.draft, ...list] : list;
  });
  const [openId, setOpenId] = useState(start?.draft.id ?? null);
  const [picking, setPicking] = useState(false);
  // The "Pour" field takes focus in a copy made for another client.
  const [focusWho, setFocusWho] = useState(false);
  const open = drafts.find(d => d.id === openId) || null;

  // A change is kept at once; a phone that refuses to keep it, or holds MAX_DRAFTS already, is told on the screen.
  // A draft is kept only once it holds something: "Nouveau programme", then Back, leaves no empty row and takes no
  // place (excellence hunt, 9 October 2026).
  const [kept, setKept] = useState(start ? start.kept : true);
  const update = draft => {
    const next = { ...draft, updatedAt: Date.now() };
    setDrafts(list => [next, ...list.filter(d => d.id !== next.id)]);
    if (isEmptyDraft(next)) { removeDraft(next.id); setKept(true); return; }
    setKept(saveDraft(next));
  };
  const show = id => { setFocusWho(false); setOpenId(id); };
  const create = () => { const d = newDraft(); setDrafts(list => [d, ...list]); setKept(true); show(d.id); };
  const remove = id => { removeDraft(id); setDrafts(list => list.filter(d => d.id !== id)); show(null); };
  const back = () => (open && isEmptyDraft(open) ? remove(open.id) : show(null));
  // The same programme for another client: title, exercises, cues and note, "Pour" left empty.
  const duplicate = () => { const d = { ...open, id: newDraft().id, who: '' }; update(d); setOpenId(d.id); setFocusWho(true); };

  if (open && picking) return <Picker c={c} onBack={() => setPicking(false)} onChoose={key => {
    if (open.items.length < LIMITS.items) update({ ...open, items: [...open.items, newItem(key)] });
    setPicking(false);
  }} />;
  if (open) return <Editor key={open.id} c={c} fr={fr} lang={lang} draft={open} kept={kept} focusWho={focusWho} onChange={update} onPick={() => setPicking(true)} onBack={back} onDuplicate={duplicate} onDelete={() => remove(open.id)} />;
  return <List c={c} fr={fr} drafts={drafts.filter(d => !isEmptyDraft(d))} onClose={onClose} onCreate={create} onOpen={show} />;
}

function List({ c, fr, drafts, onClose, onCreate, onOpen }) {
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [fr]);
  const day = t => new Date(t).toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' });
  return <div className="wv-experience">
    <section ref={screenRef} className="screen is-active pro-screen" data-testid="pro-screen"><div className="wrap">
      <div className="topbar">
        <button className="icon-btn press" onClick={onClose} aria-label={c.back}><BackIcon /></button>
        <span className="pill">{fr ? 'Version de test' : 'Test version'}</span>
      </div>
      <p className="eyebrow pro-eyebrow" data-reveal style={{ '--i': 0 }}>{c.eyebrow}</p>
      <h1 className="title" data-reveal style={{ '--i': 0 }}>{c.title}</h1>
      <p className="sub pro-sub" data-reveal style={{ '--i': 1 }}>{c.sub}</p>
      <div className="actions" data-reveal style={{ '--i': 2 }}>
        <button type="button" className="btn-primary press" onClick={onCreate} data-testid="pro-new">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          <span>{c.newProgramme}</span>
        </button>
      </div>
      {drafts.length > 0 && <div data-reveal style={{ '--i': 3 }}>
        <h2 className="section-head">{c.draftsHead}</h2>
        <ul className="pro-drafts">{drafts.map(d => <li key={d.id}>
          <button type="button" className="pro-draft press" onClick={() => onOpen(d.id)}>
            <span className="row-txt"><b>{d.title.trim() || c.untitled}</b><small>{[d.who.trim(), c.draftMeta(d.items.length, day(d.updatedAt))].filter(Boolean).join(' · ')}</small></span>
            <Arrow />
          </button>
        </li>)}</ul>
      </div>}
      <p className="foot pro-foot" data-reveal style={{ '--i': 4 }}>{c.users} {c.privacy}</p>
    </div></section>
  </div>;
}

// A whole number typed in a field of its own; brought into bounds when the field is left (programme.js, fixItem).
function NumField({ id, label, longLabel, value, onCommit }) {
  // While the field is being typed in, its own text; otherwise the draft's number.
  const [text, setText] = useState(null);
  return <div className="pro-num">
    <label htmlFor={id} aria-label={longLabel}>{label}</label>
    <input id={id} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" enterKeyHint="done" maxLength={3}
      value={text ?? String(value)} onFocus={() => setText(String(value))} onChange={e => setText(e.target.value.replace(/[^0-9]/g, ''))}
      onBlur={() => { if (text !== null) onCommit(text); setText(null); }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
  </div>;
}

function Editor({ c, fr, lang, draft, kept, focusWho = false, onChange, onPick, onBack, onDuplicate, onDelete }) {
  const screenRef = useRef(null), whoRef = useRef(null);
  useEffect(() => { if (focusWho) whoRef.current?.focus({ preventScroll: false }); }, [focusWho]);
  // The bar's small title follows the programme's title as it is typed.
  useCondensingTopbar(screenRef, [fr, draft.title.trim()]);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState(kit ? 'ready' : 'preparing');
  // The packed link of the programme as it stands, once made: { of, link }.
  const [packed, setPacked] = useState({ of: '', link: '' });
  const [showLink, setShowLink] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const noteTimer = useRef(0), shareAt = useRef({ pdf: -Infinity, link: -Infinity });
  const programme = programmeOf(draft), shape = programme ? JSON.stringify(programme) : '';
  // The link is the programme's as it stands, made in the render itself (the plain form), so the tap shares it at once
  // (Safari shares only from the tap itself); the packed form, shorter, takes its place once made. 8 October 2026: on
  // David's iPhone, a number typed, then "Share the link" said "The link could not be prepared": leaving the field
  // changed the programme within the tap, and the link, made only by the packing, was not there yet.
  const plain = useMemo(() => (shape ? linkOf(plainPayload(JSON.parse(shape))) : ''), [shape]);
  const link = packed.of === shape ? packed.link : plain;
  useEffect(() => {
    if (!shape) return undefined;
    let live = true;
    encodeProgramme(JSON.parse(shape)).then(p => { if (live) setPacked({ of: shape, link: linkOf(p) }); }, () => {});
    return () => { live = false; };
  }, [shape]);
  // Whether the same button's share began less than SHARE_GAP_MS ago; else the share about to begin is noted.
  const tooSoon = what => {
    const now = Date.now();
    if (now - shareAt.current[what] < SHARE_GAP_MS) return true;
    shareAt.current[what] = now;
    return false;
  };
  useEffect(() => {
    warmProgrammePdf().then(() => setStatus('ready'), () => setStatus('error'));
    return () => clearTimeout(noteTimer.current);
  }, []);

  const say = (text, ms = 4000) => { clearTimeout(noteTimer.current); setNote(text); noteTimer.current = setTimeout(() => setNote(''), ms); };
  const set = (field, value) => onChange({ ...draft, [field]: value });
  const setItem = (i, patch) => onChange({ ...draft, items: draft.items.map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const move = (i, d) => {
    const items = [...draft.items], j = i + d;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    onChange({ ...draft, items });
  };
  const drop = i => onChange({ ...draft, items: draft.items.filter((_, k) => k !== i) });
  const name = key => exerciseName(key, lang);

  function download(blob, fileName, warning = '') {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    if (warning) say(`${c.pdfDownloaded} ${warning}`, 12000);
    else say(c.pdfDownloaded);
  }
  // Built and shared inside the tap, as the report's PDF (Report.jsx).
  function sharePdf() {
    if (!programme) return;
    if (!kit) { setStatus('preparing'); warmProgrammePdf().then(() => setStatus('ready'), () => { setStatus('error'); say(c.pdfError); }); return; }
    let blob;
    const date = new Date();
    if (tooSoon('pdf')) return;
    // The link goes on the PDF as a QR code (programme-pdf.js, programmeQr), packed now, within the tap (packNow): the
    // programme as it stands, a number just typed included, and never the longer plain link.
    let qr = null;
    try {
      const pdfLink = linkOf(kit.packNow(programme));
      qr = pdfLink === 'too-long' ? null : kit.programmeQr(pdfLink);
      blob = kit.programmePdf(programme, { lang, date, qr });
    } catch (e) { console.error('[programme pdf]', e); say(c.pdfError); return; }
    // A sheet with no code says so: the client could not open the programme from the paper (excellence hunt, 9 October).
    const warning = qr ? '' : c.pdfNoQr;
    const fileName = kit.programmeFileName(programme, { lang, date });
    const file = new File([blob], fileName, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      if (warning) say(warning, 12000);
      // Refused for any reason but the coach's own cancel (a share still open counts), the file is downloaded instead.
      navigator.share({ files: [file], title: programme.title })
        .catch(e => { if (e.name !== 'AbortError') download(blob, fileName, warning); });
      return;
    }
    download(blob, fileName, warning);
  }
  const linkReady = link && link !== 'too-long';
  function copy() {
    if (!linkReady) { say(link === 'too-long' ? c.tooLong : c.linkError); return; }
    const done = () => { setShowLink(false); say(c.copied); };
    const fail = () => { setShowLink(true); say(c.copyFailed); };
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, fail);
      else fail();
    } catch { fail(); }
  }
  function shareLink() {
    if (!linkReady) { say(link === 'too-long' ? c.tooLong : c.linkError); return; }
    if (!navigator.share) { copy(); return; }
    if (tooSoon('link')) return;
    navigator.share({ title: programme.title, text: c.linkText(programme.title), url: link })
      .catch(e => { if (e.name !== 'AbortError') copy(); });
  }

  return <div className="wv-experience">
    <section ref={screenRef} className="screen is-active pro-screen pro-edit" data-testid="pro-editor"><div className="wrap">
      <div className="topbar">
        <button className="icon-btn press" onClick={onBack} aria-label={c.back}><BackIcon /></button>
        <span className="pill">{c.eyebrow}</span>
      </div>
      <h1 className="title" data-reveal style={{ '--i': 0 }}>{draft.title.trim() || c.editTitle}</h1>
      {kept === false && <p className="pro-warn" role="alert">{c.storageOff}</p>}
      {kept === 'full' && <p className="pro-warn" role="alert" data-testid="pro-full">{c.draftsFull(MAX_DRAFTS)}</p>}
      <div className="field pro-first">
        <label htmlFor="pTitle">{c.titleLabel}</label>
        <input id="pTitle" type="text" autoComplete="off" autoCapitalize="sentences" enterKeyHint="next" maxLength={LIMITS.title}
          placeholder={c.titlePlaceholder} value={draft.title} onChange={e => set('title', e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="pWho">{c.whoLabel}</label>
        <input ref={whoRef} id="pWho" type="text" autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint="next" maxLength={LIMITS.who}
          placeholder={c.whoPlaceholder} value={draft.who} onChange={e => set('who', e.target.value)} />
      </div>

      <h2 className="section-head">{c.exercisesHead}</h2>
      {draft.items.length === 0 && <p className="pro-empty">{c.noExercise}</p>}
      <ol className="pro-items">{draft.items.map((item, i) => {
        const n = name(item.key), e = guideExercise(item.key);
        const commit = field => text => { const v = fixItem({ ...item, [field]: text === '' ? NaN : Number(text) })[field]; setItem(i, { [field]: v }); };
        return <li key={`${item.key}-${i}`} className="pro-item" data-testid="pro-item">
          <div className="pro-item-head">
            {e ? <Thumb exercise={e} /> : <span className="thumb" />}
            <span className="pro-item-name"><span className="pro-index mono">{String(i + 1).padStart(2, '0')}</span>{n}</span>
          </div>
          <div className="pro-nums">
            <NumField id={`p${i}s`} label={c.sets} longLabel={c.setsLong} value={item.sets} onCommit={commit('sets')} />
            <NumField id={`p${i}r`} label={c.reps} longLabel={c.repsLong} value={item.reps} onCommit={commit('reps')} />
            <NumField id={`p${i}t`} label={c.rest} longLabel={c.restLong} value={item.rest} onCommit={commit('rest')} />
          </div>
          <input className="pro-item-note" type="text" autoComplete="off" autoCapitalize="sentences" maxLength={LIMITS.itemNote}
            aria-label={`${c.itemNotePlaceholder}, ${n}`} placeholder={c.itemNotePlaceholder} value={item.note} onChange={ev => setItem(i, { note: ev.target.value })} />
          <div className="pro-item-tools">
            <button type="button" className="icon-btn press" disabled={i === 0} onClick={() => move(i, -1)} aria-label={c.moveUp(n)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></svg></button>
            <button type="button" className="icon-btn press" disabled={i === draft.items.length - 1} onClick={() => move(i, 1)} aria-label={c.moveDown(n)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14" /><path d="M6 13l6 6 6-6" /></svg></button>
            <button type="button" className="text-btn pro-remove press" onClick={() => drop(i)} aria-label={c.removeLabel(n)}>{c.remove}</button>
          </div>
        </li>;
      })}</ol>
      {draft.items.length < LIMITS.items && <button type="button" className="btn-ghost press pro-add" onClick={onPick} data-testid="pro-add">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
        <span>{c.add}</span>
      </button>}

      <div className="field pro-note">
        <label htmlFor="pNote">{c.noteLabel}</label>
        <textarea id="pNote" rows="3" autoCapitalize="sentences" maxLength={LIMITS.note}
          placeholder={c.notePlaceholder} value={draft.note} onChange={e => set('note', e.target.value)} />
      </div>

      <div className="pro-share">
        <p className="pro-status" role="status">{note || (!programme ? c.needs : '')}</p>
        <button type="button" className={`btn-primary press${status === 'preparing' ? ' is-busy' : ''}`} aria-disabled={!programme || status === 'preparing' || undefined} onClick={sharePdf} data-testid="pro-pdf">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3.5" /><path d="M7.5 8L12 3.5 16.5 8" /><path d="M5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12" /></svg>
          <span>{status === 'preparing' ? c.preparing : c.sharePdf}</span>
        </button>
        <div className="pro-link-row">
          <button type="button" className="btn-line press" aria-disabled={!linkReady || undefined} onClick={shareLink} data-testid="pro-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></svg>
            <span>{c.shareLink}</span>
          </button>
          <button type="button" className="btn-ghost press pro-copy" aria-disabled={!linkReady || undefined} onClick={copy} data-testid="pro-copy">{c.copyLink}</button>
        </div>
        {showLink && linkReady && <div className="field">
          <label htmlFor="pLink">{c.linkLabel}</label>
          <input id="pLink" type="text" readOnly value={link} onFocus={e => e.currentTarget.select()} />
        </div>}
      </div>

      {draft.items.length > 0 && <div className="actions pro-dup">
        <button type="button" className="btn-ghost press" onClick={onDuplicate} data-testid="pro-duplicate">{c.duplicate}</button>
      </div>}

      <div className="pro-delete">
        {confirm
          ? <div className="pro-confirm" role="group" aria-label={c.confirmDelete}>
            <p>{c.confirmDelete}</p>
            <div className="pro-confirm-row">
              <button type="button" className="btn-ghost is-s press" onClick={() => setConfirm(false)}>{c.cancel}</button>
              <button type="button" className="btn-ghost is-s press pro-danger" onClick={onDelete}>{c.confirmYes}</button>
            </div>
          </div>
          : <button type="button" className="text-btn press" onClick={() => setConfirm(true)}>{c.deleteDraft}</button>}
      </div>
    </div></section>
  </div>;
}

function Picker({ c, onBack, onChoose }) {
  const backRef = useRef(null);
  useEffect(() => { backRef.current?.focus({ preventScroll: true }); }, []);
  return <div className="wv-experience">
    <section className="screen is-active pro-screen pro-pick" data-testid="pro-picker"><div className="wrap">
      <div className="topbar">
        <button ref={backRef} className="icon-btn press" onClick={onBack} aria-label={c.pickBack}><BackIcon /></button>
        <span className="pill">{c.eyebrow}</span>
      </div>
      <Suspense fallback={<div aria-busy="true" />}><ExerciseList onChoose={onChoose} /></Suspense>
    </div></section>
  </div>;
}
