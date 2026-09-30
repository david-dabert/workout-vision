// The history's export for a coach: the saved sets as spreadsheet files (sets-csv.js), handed to the
// phone's share sheet where it takes files, else downloaded. Built and shared inside the tap, since
// Safari opens the share sheet only from a gesture. Nothing is sent anywhere by the app itself.
// The words are in test/real-phone/swarm/copy-export.md, for David's approval (CLAUDE.md R10).
import { useRef, useState } from 'react';
import { exportFiles } from './sets-csv';

export default function ExportSets({ sets, lang, name, style }) {
  const fr = lang === 'fr';
  const [note, setNote] = useState('');
  const sharing = useRef(false);
  if (!sets?.length) return null;

  function download(files) {
    for (const file of files) {
      const url = URL.createObjectURL(file);
      const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
    setNote(files.length > 1
      ? (fr ? 'Deux fichiers téléchargés : vos séries et le détail des répétitions.' : 'Two files downloaded: your sets and the rep-by-rep detail.')
      : (fr ? 'Fichier de vos séries téléchargé.' : 'Your sets file downloaded.'));
  }

  function run() {
    if (sharing.current) return; // one share sheet at a time
    setNote('');
    let files;
    try {
      files = exportFiles(sets, { lang, name }).map(f => new File([f.text], f.name, { type: 'text/csv' }));
    } catch (e) {
      console.error('[export]', e);
      setNote(fr ? 'L’export n’a pas pu être préparé. Réessayez.' : 'The export could not be prepared. Try again.');
      return;
    }
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
      sharing.current = true;
      navigator.share({ files, title: fr ? 'Vos séries' : 'Your sets' })
        .catch(e => { if (e.name !== 'AbortError' && e.name !== 'InvalidStateError') download(files); })
        .finally(() => { sharing.current = false; });
      return;
    }
    download(files);
  }

  return <div className="hist-export" data-reveal style={style}>
    <button type="button" className="text-btn press" onClick={run}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11" /><path d="M7.5 8.5 12 4l4.5 4.5" /><path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" /></svg>
      <span>{fr ? 'Exporter vos séries (CSV)' : 'Export your sets (CSV)'}</span>
    </button>
    <p className="hist-export-note" role="status">{note}</p>
  </div>;
}
