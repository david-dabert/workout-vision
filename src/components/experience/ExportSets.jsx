// The history's export for a coach: the saved sets as a spreadsheet file (sets-csv.js; a second file of
// measured reps only once measures are validated, measures.js), handed to the
// phone's share sheet where it takes files, else downloaded. Built and shared inside the tap, since
// Safari opens the share sheet only from a gesture. Nothing is sent anywhere by the app itself.
// The words are in test/real-phone/swarm/copy-export.md, for David's approval (CLAUDE.md R10).
import { useRef, useState } from 'react';
import { exportFiles } from './sets-csv';

export default function ExportSets({ sets, lang, name, style }) {
  const fr = lang === 'fr';
  const [note, setNote] = useState('');
  // A double tap saves each file once (review, 30 September).
  const lastDownload = useRef(0);
  // A share that failed, or that WebKit refused because an earlier sheet never answered: the next tap,
  // a gesture of its own, downloads instead. Nothing waits on a share to settle, so the button never
  // freezes (review, 30 September).
  const downloadNext = useRef(false);
  if (!sets?.length) return null;

  function download(files) {
    const now = Date.now();
    if (now - lastDownload.current < 1500) return;
    lastDownload.current = now;
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
    // The browser may still block a file; the app says what it did, not what was saved.
    setNote(files.length > 1
      ? (fr ? 'Téléchargement lancé : vos séries et le détail des répétitions.' : 'Download started: your sets and the rep-by-rep detail.')
      : (fr ? 'Téléchargement de vos séries lancé.' : 'Download of your sets started.'));
  }

  function run() {
    setNote('');
    let files;
    try {
      const locale = typeof navigator !== 'undefined' ? navigator.language : undefined;
      files = exportFiles(sets, { lang, name, locale }).map(f => new File([f.text], f.name, { type: 'text/csv' }));
    } catch (e) {
      console.error('[export]', e);
      setNote(fr ? 'L’export n’a pas pu être préparé. Réessayez.' : 'The export could not be prepared. Try again.');
      return;
    }
    if (!downloadNext.current && typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
      navigator.share({ files, title: fr ? 'Vos séries' : 'Your sets' }).catch(e => {
        if (e.name === 'AbortError') return; // the user closed the sheet
        downloadNext.current = true;
        setNote(fr ? 'Le partage n’a pas abouti. Touchez à nouveau pour télécharger.' : 'Sharing did not go through. Tap again to download.');
      });
      return;
    }
    downloadNext.current = false;
    download(files);
  }

  return <div className="hist-export" data-reveal style={style}>
    <button type="button" className="text-btn press" onClick={run}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11" /><path d="M7.5 8.5 12 4l4.5 4.5" /><path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" /></svg>
      <span>{fr ? 'Exporter vos séries' : 'Export your sets'}</span>
    </button>
    <p className="hist-export-note" role="status">{note}</p>
  </div>;
}
