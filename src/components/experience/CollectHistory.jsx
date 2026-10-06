// In the history, on David's phone only (phoneCollect.js: the flag set at #collecte): the landmark files kept from
// the result screen, all sent in one share sheet, or downloaded where the sheet takes no files; then the offer to
// clear them. The files are read when the section opens, so a tap on Send opens the sheet inside the tap, as Safari
// requires (as ContributeHistory.jsx). Nothing is sent without that tap.
import { useEffect, useRef, useState } from 'react';
import { collectOn, collectedFiles, forgetCollected } from '../../lib/phoneCollect';
import { COLLECT } from './collect-copy';

// A cancel, or a second sheet asked while one is open, is no failure (as video-export.js shareFailed, kept here so
// the history does not load the replay's code).
const shareFailed = e => e?.name !== 'AbortError' && e?.name !== 'InvalidStateError';

export default function CollectHistory({ fr, style, sets = null }) {
  const t = COLLECT[fr ? 'fr' : 'en'];
  const [files, setFiles] = useState(null);
  const [note, setNote] = useState('');
  const [offered, setOffered] = useState(null); // names shared or downloaded, offered for clearing
  const sharing = useRef(false), downloadNext = useRef(false);
  const on = collectOn();

  useEffect(() => {
    if (!on) return undefined;
    let live = true;
    collectedFiles().then(f => { if (live) setFiles(f); }, () => { if (live) { setFiles([]); setNote(t.readFailed); } });
    return () => { live = false; };
  }, [on, sets]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!on) return null;

  function download(list) {
    for (const f of list) {
      const url = URL.createObjectURL(f), a = Object.assign(document.createElement('a'), { href: url, download: f.name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
  }

  function send() {
    if (!files?.length || sharing.current) return;
    const list = files;
    setNote(''); setOffered(null);
    if (!downloadNext.current && typeof navigator.share === 'function' && (typeof navigator.canShare !== 'function' || navigator.canShare({ files: list }))) {
      sharing.current = true;
      navigator.share({ files: list, title: t.shareTitle }).then(() => {
        sharing.current = false;
        setOffered(list.map(f => f.name));
        setNote(t.shared(list.length));
      }, e => {
        sharing.current = false;
        if (!shareFailed(e)) return;
        downloadNext.current = true;
        setNote(t.shareFailed);
      });
      return;
    }
    downloadNext.current = false;
    download(list);
    setOffered(list.map(f => f.name));
    setNote(t.downloaded(list.length));
  }

  async function clear() {
    const names = offered;
    if (!names) return;
    try {
      await forgetCollected(names);
      setOffered(null);
      setFiles(f => (f || []).filter(x => !names.includes(x.name)));
      setNote(t.cleared);
    } catch { setNote(t.clearFailed); }
  }

  return <section className="hist-contribute" data-reveal style={style} data-testid="collect-history">
    <h2 className="eyebrow">{t.title}</h2>
    {files && files.length === 0 && !offered && <p className="hist-contribute-n">{t.none}</p>}
    <div className="hist-keep-row">
      {files?.length > 0 && <button type="button" className="text-btn press" onClick={send} data-testid="collect-send">{t.send(files.length)}</button>}
      {offered && <>
        <button type="button" className="text-btn press" onClick={clear}>{t.clear}</button>
        <button type="button" className="text-btn press" onClick={() => { setOffered(null); setNote(t.kept); }}>{t.keep}</button>
      </>}
    </div>
    <p className="hist-export-note" role="status">{note}</p>
  </section>;
}
