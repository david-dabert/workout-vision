import { useEffect, useRef, useState } from 'react';
import { shareSheet } from '../../lib/shareSheet';

// The office's PDF (office-pdf.js, with jsPDF and the app's fonts) loads apart, once, and is warmed when the screen
// opens, so the share happens within the tap (Safari opens the share sheet only from a gesture), as Report.jsx does.
// The three lines said to the coach are the report's, approved by David (Report.jsx); "Préparation du PDF…" is the
// report's too; "Le PDF est prêt : touchez à nouveau." is new, awaiting David's approval (R10).
let kit = null, loading = null;
function warm() {
  loading ||= import('./office-pdf').then(m => (kit = m), e => { loading = null; throw e; });
  return loading;
}

/**
 * { share(title, content, stem), note }: builds the PDF in the tap and opens the share sheet, or downloads it. content:
 * the lines of a document (the contract), or { invoice } for an invoice or a credit note, set as a sheet with a table.
 */
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

  function share(title, content, stem) {
    if (!sheet.current.begin()) return;
    // Not loaded yet at this tap (a slow network): say so, and say when it is ready. The share sheet itself needs a tap
    // of its own (Safari opens it only from a gesture). Second review of 14 October 2026: this tap did nothing, silently.
    if (!kit) {
      say(fr ? 'Préparation du PDF…' : 'Preparing the PDF…');
      warm().then(() => say(fr ? 'Le PDF est prêt\u00A0: touchez à nouveau.' : 'The PDF is ready: tap again.'),
        () => say(fr ? 'Le PDF n’a pas pu être préparé. Réessayez.' : 'The PDF could not be prepared. Try again.'));
      return;
    }
    let blob;
    try { blob = Array.isArray(content) ? kit.documentPdf({ title, lines: content, fr: true }) : kit.invoicePdf(content.invoice); } catch (e) {
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
