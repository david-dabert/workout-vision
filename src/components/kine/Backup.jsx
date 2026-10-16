import { useEffect, useRef, useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { GroupHead } from '../experience/Showcase';
import { MAX_FILE_BYTES, MIN_PASSWORD, lastBackup, makeBackup, markBackedUp, openBackup, restore } from '../../lib/kine/backup';

// The follow-up's backup (lib/kine/backup.js): a file encrypted with a password, made on the phone and kept by the
// physiotherapist on his own computer or a USB key; restored on any phone by the same password, merged, never
// replacing. Saving takes two taps: the file is prepared (the key derivation takes a second), then saved by a tap of
// its own (Safari saves only from a tap), and the backup counts as made only when he says the file is put away: the
// app cannot see where a download went. A reminder when results exist and the last backup is a week old, or none was
// made. Status: convention.
const WEEK = 7 * 864e5;
const fileName = () => `sauvegarde-kine-${new Date().toISOString().slice(0, 10)}.json`;

export default function Backup({ fr, k, hasData, onRestored }) {
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');
  const [last, setLast] = useState(lastBackup);
  const [openedAt] = useState(() => Date.now());
  const [ready, setReady] = useState(null);
  const [file, setFile] = useState(null);
  const [openPassword, setOpenPassword] = useState('');
  const input = useRef(null);
  useEffect(() => () => { if (ready) URL.revokeObjectURL(ready.url); }, [ready]);
  const due = hasData && (!last || openedAt - new Date(last).getTime() > WEEK);
  const when = last ? new Date(last).toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  const prepare = async () => {
    hapticLight();
    if (password.length < MIN_PASSWORD) { setNote(k.bShort(MIN_PASSWORD)); return; }
    if (password !== again) { setNote(k.bMismatch); return; }
    setBusy('make'); setNote('');
    try {
      const text = await makeBackup(password);
      const blob = new Blob([text], { type: 'application/json' });
      const name = fileName();
      setReady({ url: URL.createObjectURL(blob), name, file: new File([blob], name, { type: 'application/json' }) });
      setPassword(''); setAgain('');
    } catch { setNote(k.bFailed); }
    setBusy('');
  };
  const share = async () => {
    try { await navigator.share({ files: [ready.file] }); } catch { /* closed: the save link stays */ }
  };
  const confirmSaved = () => { hapticLight(); markBackedUp(); setLast(lastBackup()); setReady(null); setNote(k.bMade); };

  const open = async () => {
    hapticLight();
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setNote(k.bNotBackup); return; }
    setBusy('open'); setNote('');
    try {
      const data = await openBackup(await file.text(), openPassword);
      const r = restore(data.data);
      setNote(!r.ok ? k.bStoreFailed : k.bRestored(r));
      setFile(null); setOpenPassword('');
      if (r.ok) onRestored?.();
    } catch (err) {
      setNote(err?.message === 'wrong-password' ? k.bWrong : k.bNotBackup);
    }
    setBusy('');
  };

  const canShare = !!(ready && navigator.canShare?.({ files: [ready.file] }));
  return <section className="sc-section" data-testid="kn-backup">
    <GroupHead title={k.bTitle} />
    <p className={due ? 'sc-frame-note' : 'sc-caption'} data-testid="kn-backup-status">{when ? k.bLast(when) : k.bNever}{due ? ` ${k.bDue}` : ''}</p>
    <p className="sc-caption">{k.bWhere}</p>
    {!ready ? <div className="kn-fields">
      <label className="kn-field"><span>{k.bPassword}</span><input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} data-testid="kn-backup-password" /></label>
      <label className="kn-field"><span>{k.bAgain}</span><input type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} data-testid="kn-backup-again" /></label>
      <button type="button" className="rc-btn is-primary is-wide press" onClick={prepare} disabled={!!busy || !password} data-testid="kn-backup-make">{busy === 'make' ? k.bPreparing : k.bMake}</button>
      <p className="sc-caption">{k.bKeep}</p>
    </div> : <div className="kn-fields" data-testid="kn-backup-ready">
      <p className="sc-caption">{k.bReady}</p>
      <a className="rc-btn is-primary is-wide press kn-save" href={ready.url} download={ready.name} data-testid="kn-backup-save">{k.bSave}</a>
      {canShare && <button type="button" className="rc-btn is-wide press" onClick={share} data-testid="kn-backup-share">{k.bShare}</button>}
      <button type="button" className="rc-btn is-wide press" onClick={confirmSaved} data-testid="kn-backup-done">{k.bDone}</button>
      <button type="button" className="rc-link press" onClick={() => setReady(null)}>{k.bCancel}</button>
    </div>}
    <div className="kn-fields kn-restore">
      <button type="button" className="rc-btn press" onClick={() => input.current?.click()} disabled={!!busy} data-testid="kn-backup-pick">{file ? file.name : k.bPick}</button>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={e => { setFile(e.target.files?.[0] ?? null); e.target.value = ''; setNote(''); }} data-testid="kn-backup-file" />
      {file && <>
        <label className="kn-field"><span>{k.bPassword}</span><input type="password" autoComplete="current-password" value={openPassword} onChange={e => setOpenPassword(e.target.value)} data-testid="kn-backup-open-password" /></label>
        <button type="button" className="rc-btn is-wide press" onClick={open} disabled={!!busy || !openPassword} data-testid="kn-backup-restore">{busy === 'open' ? k.bOpening : k.bRestore}</button>
      </>}
    </div>
    {note && <p className="sc-caption" role="status" data-testid="kn-backup-note">{note}</p>}
  </section>;
}
