import { useEffect, useRef, useState } from 'react';
import { shareSheet } from '../../lib/shareSheet';

// The office's PDF (office-pdf.js, with jsPDF and the app's fonts) loads apart, once, and is warmed when the screen
// opens, so the share happens within the tap (Safari opens the share sheet only from a gesture), as Report.jsx does.
// The three lines said to the coach are the report's, approved by David (Report.jsx).
let kit = null, loading = null;
function warm() {
  loading ||= import('./office-pdf').then(m => (kit = m), e => { loading = null; throw e; });
  return loading;
}

/** { share(title, lines, stem), note }: builds the PDF in the tap and opens the share sheet, or downloads it. */
export function useOfficePdf(fr) {
  const [note, setNote] = useState('');
  const timer = useRef(0);
  const sheet = useRef(null);
  sheet.current ??= shareSheet();
  useEffect(() => { warm().catch(() => {}); return () => clearTimeout(timer.current); }, []);
  const say = (text) => { clearTimeout(timer.current); setNote(text); timer.current = setTimeout(() => setNote(''), 5000); };

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    say(fr ? 'Téléchargement du PDF lancé.' : 'PDF download started.');
  }

  function share(title, lines, stem) {
    if (!sheet.current.begin()) return;
    if (!kit) { warm().catch(() => say(fr ? 'Le PDF n’a pas pu être préparé. Réessayez.' : 'The PDF could not be prepared. Try again.')); return; }
    let blob;
    try { blob = kit.documentPdf({ title, lines, fr: true }); } catch (e) {
      console.error('[office pdf]', e);
      say(fr ? 'Le PDF n’a pas pu être préparé. Réessayez.' : 'The PDF could not be prepared. Try again.');
      return;
    }
    const name = kit.pdfFileName(stem);
    const file = new File([blob], name, { type: 'application/pdf' });
    if (sheet.current.shares(!!navigator.canShare?.({ files: [file] }))) {
      navigator.share({ files: [file], title }).catch(e => {
        if (sheet.current.failed(e)) say(fr ? 'Le partage n’a pas abouti. Touchez à nouveau pour télécharger.' : 'Sharing did not go through. Tap again to download.');
      });
      return;
    }
    download(blob, name);
  }

  return { share, note };
}
