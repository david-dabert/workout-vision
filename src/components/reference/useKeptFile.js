import { useEffect, useRef, useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { shareSheet } from '../../lib/shareSheet';

/**
 * A file prepared on a tap and then shared (the share sheet, where the phone can share it) or opened / saved.
 * make(onProgress) resolves with the File.
 */
export function useKeptFile() {
  const [made, setMade] = useState({ state: 'idle', progress: 0, file: null, url: null, why: '' });
  const [shareBroke, setShareBroke] = useState(false);
  const sheet = useRef(null);
  sheet.current ??= shareSheet();
  const abort = useRef(null);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => () => { if (made.url) URL.revokeObjectURL(made.url); }, [made.url]);
  const prepare = make => {
    hapticLight();
    abort.current = new AbortController();
    setShareBroke(false);
    setMade({ state: 'making', progress: 0, file: null, url: null, why: '' });
    make(p => setMade(m => (m.state === 'making' ? { ...m, progress: p } : m)), abort.current.signal)
      .then(file => setMade({ state: 'ready', progress: 1, file, url: URL.createObjectURL(file), why: '' }))
      .catch(e => { if (e?.name !== 'AbortError') setMade({ state: 'failed', progress: 0, file: null, url: null, why: e?.message || '' }); else setMade({ state: 'idle', progress: 0, file: null, url: null, why: '' }); });
  };
  const sharable = !shareBroke && !!made.file && typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [made.file] });
  const share = () => {
    if (!sheet.current.begin()) return;
    hapticLight();
    navigator.share({ files: [made.file] }).catch(e => { if (sheet.current.failed(e)) setShareBroke(true); });
  };
  const cancel = () => abort.current?.abort();
  return { made, prepare, share, sharable, shareBroke, cancel };
}

