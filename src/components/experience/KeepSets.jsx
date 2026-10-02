// The sets kept beyond this browser's storage (keep-sets.js): a backup file of every set, saved on the phone
// or sent where the person chooses, and its restoration on any phone. On an iPhone or iPad where the app is not
// on the home screen, one line says why a backup matters (keep-sets.js).
import { useRef, useState } from 'react';
import { backupFile, onHomeScreen, onIOS } from '../../lib/keep-sets';
import { restoreFlow } from './keep-sets-view';
import { refreshSets, loadSets } from './sets';

const ICON_SAVE = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11" /><path d="M7.5 10.5 12 15l4.5-4.5" /><path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" /></svg>;
const ICON_OPEN = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /></svg>;

export default function KeepSets({ sets, fr, onRestored, style }) {
  const [note, setNote] = useState('');
  // Shown on iOS outside the home screen, whatever the browser says of persistence (keep-sets.js: UNSOURCED
  // that persistence exempts the app from the seven-day deletion).
  const [warn] = useState(() => onIOS() && !onHomeScreen());
  const lastDownload = useRef(0), downloadNext = useRef(false);

  // A share failed or refused: the next tap, a gesture of its own, downloads (ExportSets.jsx). Only repeated
  // downloads are held back, never the tap that follows a failed share (review of 2 October).
  function save() {
    setNote('');
    const f = backupFile(sets), file = new File([f.text], f.name, { type: 'application/json' });
    if (!downloadNext.current && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: fr ? 'Sauvegarde de vos séries' : 'Backup of your sets' }).catch(e => {
        if (e.name === 'AbortError') return;
        downloadNext.current = true;
        setNote(fr ? 'Le partage n’a pas abouti. Touchez à nouveau pour télécharger.' : 'Sharing did not go through. Tap again to download.');
      });
      return;
    }
    const now = Date.now();
    if (now - lastDownload.current < 1500) return;
    lastDownload.current = now;
    downloadNext.current = false;
    const url = URL.createObjectURL(file), a = Object.assign(document.createElement('a'), { href: url, download: f.name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setNote(fr ? 'Téléchargement de la sauvegarde lancé.' : 'Download of the backup started.');
  }

  async function restore(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setNote('');
    const r = await restoreFlow(file.text(), fr, { list: () => { refreshSets(); return loadSets(); } });
    if (r.sets) onRestored?.(r.sets);
    setNote(r.note);
  }

  // Backup and restore share one line, with short visible words; each keeps its full name for a screen
  // reader (the visible word is part of it, WCAG 2.5.3). The reason, when shown, follows as a caption.
  return <div className="hist-export hist-keep" data-reveal style={style} data-testid="keep-sets">
    <div className="hist-keep-row">
      {sets?.length > 0 && <button type="button" className="text-btn press" onClick={save} aria-label={fr ? 'Sauvegarder vos séries' : 'Back up your sets'}>{ICON_SAVE}<span>{fr ? 'Sauvegarder' : 'Back up'}</span></button>}
      {/* The file input is the control, laid over its label (as on the filming screen): no second control around it. */}
      <label className="text-btn press">
        <input type="file" accept=".json,application/json" className="hx" aria-label={fr ? 'Restaurer une sauvegarde' : 'Restore a backup'} onChange={restore} />
        {ICON_OPEN}<span>{fr ? 'Restaurer' : 'Restore'}</span>
      </label>
    </div>
    {warn && sets?.length > 0 && <p className="hist-keep-why" data-testid="keep-why">{fr
      ? 'Sur iPhone, Safari peut effacer vos séries après sept jours d’utilisation sans ouvrir l’app. Ajoutez-la à l’écran d’accueil, ou gardez une sauvegarde.'
      : 'On iPhone, Safari may erase your sets after seven days of use without opening the app. Add it to your home screen, or keep a backup.'}</p>}
    <p className="hist-export-note" role="status">{note}</p>
  </div>;
}

