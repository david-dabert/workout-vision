// In the history: the contributions waiting on this phone (contribute.js), sent through the share sheet or
// downloaded, and the choice to start or to stop, which erases them. The file is prepared as soon as the sets
// waiting are known, so a tap on Send opens the share sheet inside the tap, as Safari requires (review of
// 2 October); a tap while a sheet is open does nothing; stopping drops a prepared file before it can be sent.
import { useEffect, useRef, useState } from 'react';
import { contributions, contributionsFile, eraseContributions, forgetContributions, readChoice, persistChoice } from '../../lib/contribute';
import { CONTRIBUTE } from './contribute-copy';

export default function ContributeHistory({ fr, style, sets = null }) {
  const t = CONTRIBUTE[fr ? 'fr' : 'en'];
  const [choice, setChoice] = useState(readChoice);
  const [waiting, setWaiting] = useState(null);
  const [prepared, setPrepared] = useState(null); // { list, file }: the file prepared for that list
  const [note, setNote] = useState('');
  const downloadNext = useRef(false), sharing = useRef(false), generation = useRef(0);

  // The sets waiting, read when helping, and again whenever the saved sets change: a set deleted in the history
  // takes its contribution with it, and the file prepared before is dropped (audit of 2 October). Their file is
  // prepared at once.
  useEffect(() => {
    if (choice !== 'yes') return undefined;
    let live = true;
    contributions().then(l => { if (live) setWaiting(l); }, () => { if (live) setWaiting([]); });
    return () => { live = false; };
  }, [choice, sets]);
  useEffect(() => {
    if (!waiting?.length) return undefined;
    const g = ++generation.current;
    contributionsFile(waiting).then(f => { if (g === generation.current) setPrepared({ list: waiting, file: f }); }, () => { if (g === generation.current) setNote(t.prepareFailed); });
    return undefined;
  }, [waiting]); // eslint-disable-line react-hooks/exhaustive-deps
  // Only a file prepared for the sets now waiting can be sent.
  const file = prepared && prepared.list === waiting ? prepared.file : null;

  function send() {
    if (!file || sharing.current) return;
    setNote('');
    const list = waiting, f = file, g = generation.current;
    if (!downloadNext.current && typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] })) {
      sharing.current = true;
      navigator.share({ files: [f], title: t.shareTitle }).then(async () => {
        sharing.current = false;
        if (g !== generation.current) return; // stopped meanwhile: nothing more is said or kept
        await forgetContributions(list.map(c => c.setId)).catch(() => {});
        setWaiting(w => (w || []).filter(c => !list.includes(c)));
        setNote(t.sent(list.length));
      }, e => {
        sharing.current = false;
        if (e.name === 'AbortError') return;
        downloadNext.current = true;
        setNote(t.shareFailed);
      });
      return;
    }
    downloadNext.current = false;
    const url = URL.createObjectURL(f), a = Object.assign(document.createElement('a'), { href: url, download: f.name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    // A download is not a sending: the sets stay until the person stops, or shares them through the sheet.
    setNote(t.downloaded);
  }

  async function stop() {
    // The phone must hold the stop before it is shown, or the stored yes would go on collecting (FINDING-016).
    if (!persistChoice('no')) { setNote(t.stopFailed); return; }
    generation.current++; // a prepared or shared file of the erased sets is dropped
    setChoice('no');
    setPrepared(null);
    try { await eraseContributions(); setWaiting(null); setNote(t.stopped); }
    catch { setNote(t.eraseFailed); }
  }

  return <section className="hist-contribute" data-reveal style={style} data-testid="contribute-history">
    <h2 className="eyebrow">{t.title}</h2>
    <p className="hist-keep-why">{t.what}</p>
    {choice === 'yes'
      ? <>
        <p className="hist-contribute-n">{waiting ? t.waiting(waiting.length) : ''}</p>
        <div className="hist-keep-row">
          {waiting?.length > 0 && <button type="button" className="text-btn press" onClick={send} disabled={!file} aria-disabled={!file}>{t.send}</button>}
          <button type="button" className="text-btn press" onClick={stop}>{t.stop}</button>
        </div>
      </>
      : <div className="hist-keep-row"><button type="button" className="text-btn press" onClick={() => { if (persistChoice('yes')) { setChoice('yes'); setNote(''); } else setNote(t.startFailed); }}>{t.start}</button></div>}
    <p className="hist-export-note" role="status">{note}</p>
  </section>;
}
