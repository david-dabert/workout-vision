// The sets kept beyond this browser's storage (keep-sets.js): a backup file of every set, saved on the phone
// or sent where the person chooses, and its restoration on any phone. On a phone where the browser has not
// promised to keep the app's storage and the app is not on the home screen, one line says why a backup matters.
import { useEffect, useRef, useState } from 'react';
import { backupFile, onHomeScreen, readBackup, restoreBackup } from '../../lib/keep-sets';
import { refreshSets, loadSets } from './sets';

const ICON_SAVE = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11" /><path d="M7.5 10.5 12 15l4.5-4.5" /><path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" /></svg>;
const ICON_OPEN = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" /></svg>;

export default function KeepSets({ sets, fr, onRestored, style }) {
  const [note, setNote] = useState('');
  const [kept, setKept] = useState(true); // until the browser says otherwise, no warning
  const lastSave = useRef(0), downloadNext = useRef(false);
  useEffect(() => {
    let live = true;
    Promise.resolve(navigator.storage?.persisted?.()).then(p => { if (live) setKept(!!p || onHomeScreen()); }, () => {});
    return () => { live = false; };
  }, []);

  function save() {
    const now = Date.now();
    if (now - lastSave.current < 1500) return;
    lastSave.current = now;
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
    const r = readBackup(await file.text());
    if (r.error) {
      setNote(r.error === 'newer-version'
        ? (fr ? 'Cette sauvegarde vient d’une version plus récente de l’app. Mettez l’app à jour, puis réessayez.' : 'This backup comes from a newer version of the app. Update the app, then try again.')
        : (fr ? 'Ce fichier n’est pas une sauvegarde de vos séries.' : 'This file is not a backup of your sets.'));
      return;
    }
    try {
      const { added, present } = await restoreBackup(r.sets);
      refreshSets();
      onRestored?.(await loadSets());
      const parts = [fr ? `${added} ${added > 1 ? 'séries restaurées' : 'série restaurée'}.` : `${added} ${added === 1 ? 'set' : 'sets'} restored.`];
      if (present) parts.push(fr ? `${present} ${present > 1 ? 'étaient déjà' : 'était déjà'} sur ce téléphone.` : `${present} ${present === 1 ? 'was' : 'were'} already on this phone.`);
      if (r.skipped) parts.push(fr ? `${r.skipped} ${r.skipped > 1 ? 'séries illisibles n’ont' : 'série illisible n’a'} pas été restaurée${r.skipped > 1 ? 's' : ''}.` : `${r.skipped} unreadable ${r.skipped === 1 ? 'set was' : 'sets were'} not restored.`);
      setNote(parts.join(' '));
    } catch {
      setNote(fr ? 'La sauvegarde n’a pas pu être restaurée. Réessayez.' : 'The backup could not be restored. Try again.');
    }
  }

  // Backup and restore share one line, with short visible words; each keeps its full name for a screen
  // reader (the visible word is part of it, WCAG 2.5.3). The reason, when shown, follows as a caption.
  return <div className="hist-export hist-keep" data-reveal style={style} data-testid="keep-sets">
    <div className="hist-keep-row">
      {sets?.length > 0 && <button type="button" className="text-btn press" onClick={save} aria-label={fr ? 'Sauvegarder vos séries' : 'Back up your sets'}>{ICON_SAVE}<span>{fr ? 'Sauvegarder' : 'Back up'}</span></button>}
      <label className="text-btn press" role="button" tabIndex="0" aria-label={fr ? 'Restaurer une sauvegarde' : 'Restore a backup'} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.querySelector('input')?.click(); } }}>
        <input type="file" accept=".json,application/json" className="hx" tabIndex="-1" aria-hidden="true" onChange={restore} />
        {ICON_OPEN}<span>{fr ? 'Restaurer' : 'Restore'}</span>
      </label>
    </div>
    {!kept && sets?.length > 0 && <p className="hist-keep-why">{fr
      ? 'Sur iPhone, Safari peut effacer vos séries après sept jours d’utilisation sans ouvrir l’app. Ajoutez-la à l’écran d’accueil, ou gardez une sauvegarde.'
      : 'On iPhone, Safari may erase your sets after seven days of use without opening the app. Add it to your home screen, or keep a backup.'}</p>}
    <p className="hist-export-note" role="status">{note}</p>
  </div>;
}
