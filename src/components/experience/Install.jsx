// Installing the app on the home screen (install.js): a quiet row at the foot of the choice, a one-time suggestion
// on the saved card of the first set, and the sheet that shows how where the browser cannot install by itself.
// Nothing shows once the app runs from the home screen. The words: install-copy.js (approved by David on 9 October 2026, R10).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { installKind, onInstallChange, promptInstall, markInstall, shouldSuggestInstall } from '../../lib/install';
import { onIOS } from '../../lib/keep-sets';
import { INSTALL } from './install-copy';
import './Install.css';

// What can be offered, read again when Chromium hands its prompt over, when the app is installed, or when the
// display mode turns standalone.
function subscribe(f) {
  const off = onInstallChange(f);
  let mq = null;
  try { mq = matchMedia('(display-mode: standalone)'); mq.addEventListener?.('change', f); } catch { /* no matchMedia */ }
  return () => { off(); mq?.removeEventListener?.('change', f); };
}
function useInstallKind() {
  return useSyncExternalStore(subscribe, () => installKind(), () => 'none');
}

// The glyphs as iOS draws them: Share (a square open at the top, an arrow out of it) and Add to Home Screen (a
// plus in a rounded square). Drawn here, never an image of Apple's.
const SHARE_GLYPH = <svg className="ins-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-testid="share-glyph"><path d="M8.5 9.5H7A1.5 1.5 0 0 0 5.5 11v8.5A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V11A1.5 1.5 0 0 0 17 9.5h-1.5" /><path d="M12 14.5V2.5" /><path d="M8.5 6 12 2.5 15.5 6" /></svg>;
const ADD_GLYPH = <svg className="ins-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" /></svg>;
const ROW_ARROW = <svg className="row-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>;

/** The install action: Chromium's prompt where it is held, the sheet otherwise. Returns [act, sheet]. */
function useInstallAction(kind, fr, after) {
  const [open, setOpen] = useState(false);
  const act = async () => {
    navigator.vibrate?.(10);
    if (kind === 'prompt') { const r = await promptInstall(); after?.(r); return; }
    setOpen(true);
  };
  const sheet = open && kind !== 'none' && kind !== 'prompt' ? <InstallSheet kind={kind} fr={fr} onClose={() => setOpen(false)} /> : null;
  return [act, sheet];
}

/** The quiet row at the foot of the choice. */
export function InstallRow({ fr }) {
  const kind = useInstallKind();
  const [act, sheet] = useInstallAction(kind, fr);
  if (kind === 'none') return null;
  const c = INSTALL[fr ? 'fr' : 'en'];
  return <>
    <button type="button" className="row-link ins-row press" onClick={act} data-testid="install-row" aria-haspopup={kind === 'prompt' ? undefined : 'dialog'}>
      <span className="row-ico" aria-hidden="true">{ADD_GLYPH}</span>
      <span className="row-txt"><b>{c.row}</b><small>{c.rowSub}</small></span>
      {ROW_ARROW}
    </button>
    {sheet}
  </>;
}

/** The one-time suggestion on the saved card (Result.jsx): only after a confirmed save, never again once shown. */
export function InstallSuggest({ fr }) {
  const kind = useInstallKind();
  const [show] = useState(() => shouldSuggestInstall({ kind: installKind() }));
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { if (show) markInstall('shown'); }, [show]);
  const [act, sheet] = useInstallAction(kind, fr, r => { if (r === 'accepted') markInstall('installed'); });
  const c = INSTALL[fr ? 'fr' : 'en'];
  if (!show) return null;
  if (dismissed) return <p className="ins-note" role="status" data-testid="install-later">{c.laterNote}</p>;
  if (kind === 'none') return null;
  const ios = kind === 'ios' || kind === 'ios-other' || (kind === 'in-app' && onIOS());
  return <div className="ins-suggest appear" data-testid="install-suggest">
    <p className="ins-suggest-title">{c.suggestTitle}</p>
    <p className="ins-suggest-why">{ios ? c.why : c.suggestOther}</p>
    <div className="ins-suggest-keys">
      <button type="button" className="ins-key press" onClick={act} data-testid="install-suggest-key" aria-haspopup={kind === 'prompt' ? undefined : 'dialog'}>{ADD_GLYPH}<span>{c.suggestKey}</span></button>
      <button type="button" className="text-btn press" onClick={() => { markInstall('dismissed'); setDismissed(true); }} data-testid="install-dismiss">{c.later}</button>
    </div>
    {sheet}
  </div>;
}

// The link to open elsewhere: the app's own address, without a screen's hash.
const appLink = () => { try { return location.origin + location.pathname; } catch { return ''; } };

// Copies the link: the clipboard where the browser lets the page write, otherwise the shown link selected and copied
// the old way (the browsers inside apps often refuse the first). False if neither did.
async function copyLink(text, el) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back */ }
  try {
    const r = document.createRange(); r.selectNodeContents(el);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    return document.execCommand('copy');
  } catch { return false; }
}

const FOCUSABLE = 'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])';

/** The sheet: how to install on iOS, or where to open the link from a browser that cannot install. */
export function InstallSheet({ kind, fr, onClose }) {
  const c = INSTALL[fr ? 'fr' : 'en'];
  const box = useRef(null), title = useRef(null), linkRef = useRef(null);
  const [note, setNote] = useState('');
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  // The rest of the app is out of reach (inert) while the sheet is open; focus goes to its title and comes back to
  // the key that opened it. Escape closes; Tab stays inside.
  useEffect(() => {
    const opener = document.activeElement, root = document.getElementById('root');
    const wasInert = root?.inert;
    if (root) root.inert = true;
    title.current?.focus({ preventScroll: true });
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== 'Tab' || !box.current) return;
      const items = [...box.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1], at = document.activeElement;
      if (e.shiftKey && (at === first || at === title.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (root) root.inert = !!wasInert;
      if (opener?.isConnected) opener.focus?.({ preventScroll: true });
    };
  }, []);
  const link = appLink();
  const where = onIOS() ? 'ios' : 'other';
  const steps = kind === 'ios';
  const heading = steps ? c.title : c.openTitle[kind === 'ios-other' ? 'ios' : where];
  const copy = async () => setNote((await copyLink(link, linkRef.current)) ? c.copied : c.copyFailed);
  return createPortal(<div className="wv-experience ins-layer" data-testid="install-sheet-layer">
    <div className="ins-scrim" onClick={onClose} aria-hidden="true" />
    <div className="ins-sheet" ref={box} role="dialog" aria-modal="true" aria-labelledby="ins-title" data-testid="install-sheet" data-kind={kind}>
      <div className="ins-head">
        <h2 id="ins-title" className="ins-title" ref={title} tabIndex={-1}>{heading}</h2>
        <button type="button" className="ins-x press" onClick={onClose} aria-label={c.close}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
      {steps ? <>
        <ol className="ins-steps" aria-label={c.stepsLabel}>
          {c.steps.map((s, i) => <li key={i} className="ins-step">
            <span className="ins-n" aria-hidden="true">{i + 1}</span>
            <span className="ins-step-txt">
              <span className="ins-step-line">{s.lead} {i === 0 && SHARE_GLYPH}{i === 1 && ADD_GLYPH}<b>{fr ? `« ${s.what} »` : `“${s.what}”`}</b>{i === 2 && s.note ? ` ${s.note}` : ''}</span>
              {i === 0 && s.note && <small>{s.note}</small>}
            </span>
          </li>)}
        </ol>
        <p className="ins-why" data-testid="install-why">{c.why}</p>
        <button type="button" className="ins-key is-primary press" onClick={onClose}>{c.close}</button>
      </> : <>
        <p className="ins-body" data-testid="install-open-elsewhere">{kind === 'ios-other' ? c.iosOther : c.inApp[where]}</p>
        <p className="ins-link" ref={linkRef} data-testid="install-link">{link}</p>
        <button type="button" className="ins-key is-primary press" onClick={copy} data-testid="install-copy">{c.copy}</button>
        <p className="ins-note" role="status">{note}</p>
        <button type="button" className="ins-key press" onClick={onClose}>{c.close}</button>
      </>}
    </div>
  </div>, document.body);
}
