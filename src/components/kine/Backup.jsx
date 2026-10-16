import { useRef, useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { GroupHead } from '../experience/Showcase';
import { MIN_PASSWORD, lastBackup, makeBackup, markBackedUp, openBackup, restore } from '../../lib/kine/backup';

// The follow-up's backup (lib/kine/backup.js): a file encrypted with a password, made on the phone and kept by the
// physiotherapist on his own computer or a USB key; restored on any phone by the same password, merged, never
// replacing. A reminder when results exist and the last backup is a week old, or none was made. Status: convention.
const WEEK = 7 * 864e5;

export default function Backup({ fr, k, hasData, onRestored }) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [last, setLast] = useState(lastBackup);
  // The moment the screen opened, for the reminder (read once, not at every render).
  const [openedAt] = useState(() => Date.now());
  const [file, setFile] = useState(null);
  const [openPassword, setOpenPassword] = useState('');
  const input = useRef(null);
  const due = hasData && (!last || openedAt - new Date(last).getTime() > WEEK);
  const when = last ? new Date(last).toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  const make = async () => {
    hapticLight();
    if (password.length < MIN_PASSWORD) { setNote(k.bShort(MIN_PASSWORD)); return; }
    if (password !== again) { setNote(k.bMismatch); return; }
    setBusy(true); setNote('');
    try {
      const text = await makeBackup(password);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = `sauvegarde-kine-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      markBackedUp(); setLast(lastBackup()); setPassword(''); setAgain(''); setNote(k.bMade);
    } catch { setNote(k.bFailed); }
    setBusy(false);
  };

  const open = async () => {
    hapticLight();
    if (!file) return;
    setBusy(true); setNote('');
    try {
      const data = await openBackup(await file.text(), openPassword);
      const added = restore(data.data);
      setNote(added === false ? k.bStoreFailed : k.bRestored(added));
      setFile(null); setOpenPassword('');
      if (added !== false) onRestored?.();
    } catch (err) {
      setNote(err?.message === 'wrong-password' ? k.bWrong : k.bNotBackup);
    }
    setBusy(false);
  };

  return <section className="sc-section" data-testid="kn-backup">
    <GroupHead title={k.bTitle} />
    <p className={due ? 'sc-frame-note' : 'sc-caption'} data-testid="kn-backup-status">{when ? k.bLast(when) : k.bNever}{due ? ` ${k.bDue}` : ''}</p>
    <p className="sc-caption">{k.bWhere}</p>
    <div className="kn-fields">
      <label className="kn-field"><span>{k.bPassword}</span><input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} data-testid="kn-backup-password" /></label>
      <label className="kn-field"><span>{k.bAgain}</span><input type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} data-testid="kn-backup-again" /></label>
      <button type="button" className="rc-btn is-primary is-wide press" onClick={make} disabled={busy || !password} data-testid="kn-backup-make">{k.bMake}</button>
      <p className="sc-caption">{k.bKeep}</p>
    </div>
    <div className="kn-fields kn-restore">
      <button type="button" className="rc-btn press" onClick={() => input.current?.click()} disabled={busy} data-testid="kn-backup-pick">{file ? file.name : k.bPick}</button>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={e => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; setNote(''); }} data-testid="kn-backup-file" />
      {file && <>
        <label className="kn-field"><span>{k.bPassword}</span><input type="password" autoComplete="current-password" value={openPassword} onChange={e => setOpenPassword(e.target.value)} data-testid="kn-backup-open-password" /></label>
        <button type="button" className="rc-btn is-wide press" onClick={open} disabled={busy || !openPassword} data-testid="kn-backup-restore">{k.bRestore}</button>
      </>}
    </div>
    {note && <p className="sc-caption" role="status" data-testid="kn-backup-note">{note}</p>}
  </section>;
}
