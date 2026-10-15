import { useEffect, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { hapticLight } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { Topbar } from '../experience/Showcase';
import { readPose } from '../../lib/reference/readPose';
import ComparisonView from './ComparisonView';
import { FilePick } from './parts';
import { useObjectUrl } from '../../lib/reference/useObjectUrl';
import { COPY } from './reference-copy';
import './ReferenceCompare.css';

// Two videos chosen on the phone, a reference and an attempt, compared (ComparisonView.jsx). The physiotherapist's
// workspace (KineWorkspace.jsx) opens it for any exercise outside the built-in library. Both videos stay on the phone.

export default function ReferenceCompare({ onClose, embedded = false }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const c = COPY[fr ? 'fr' : 'en'];
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);

  const [refFile, setRefFile] = useState(null);
  const [attFile, setAttFile] = useState(null);
  const [refPose, setRefPose] = useState(null);
  const [attPose, setAttPose] = useState(null);
  const [phase, setPhase] = useState('pick');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const refUrl = useObjectUrl(refFile);
  const attUrl = useObjectUrl(attFile);

  const pickRef = f => { setRefFile(f); setRefPose(null); setAttPose(null); setPhase('pick'); };
  const pickAtt = f => { setAttFile(f); setAttPose(null); setPhase('pick'); };

  const run = async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError('');
    try {
      let r = refPose;
      if (!r) {
        setPhase('reading-ref'); setProgress(0);
        r = await readPose(refFile, { signal: ctrl.signal, onProgress: p => setProgress(p) });
        setRefPose(r);
      }
      setPhase('reading-att'); setProgress(0);
      const a = await readPose(attFile, { signal: ctrl.signal, onProgress: p => setProgress(p) });
      setAttPose(a);
      setPhase('done');
    } catch (err) {
      if (err?.name === 'AbortError') { setPhase('pick'); return; }
      setError(err?.message || String(err));
      setPhase('error');
    }
  };
  useEffect(() => () => abortRef.current?.abort(), []);
  const reading = phase === 'reading-ref' || phase === 'reading-att';

  const content = <>
    <div className="sc-section rc-picks">
      <FilePick label={c.refLabel} hint={c.refHint} file={refFile} onFile={pickRef} c={c} testId="rc-ref" />
      <FilePick label={c.attLabel} hint={c.attHint} file={attFile} onFile={pickAtt} c={c} testId="rc-att" />
      {!reading && phase !== 'done' && <button type="button" className="rc-btn is-primary is-wide press" disabled={!refFile || !attFile} onClick={run} data-testid="rc-compare">{c.compare}</button>}
      {reading && <div className="rc-progress" role="status" data-testid="rc-progress">
        <span>{phase === 'reading-ref' ? c.readingRef : c.readingAtt}</span>
        <div className="rc-bar"><i style={{ width: `${Math.round(progress)}%` }} /></div>
        <button type="button" className="rc-link press" onClick={() => abortRef.current?.abort()}>{c.cancel}</button>
      </div>}
      {phase === 'error' && <p className="rc-error" role="alert" data-testid="rc-error">{c.failed} <small>{error}</small> <button type="button" className="rc-link press" onClick={run}>{c.retry}</button></p>}
    </div>
    {phase === 'done' && <>
      <ComparisonView refPose={refPose} attPose={attPose} refUrl={refUrl} attUrl={attUrl} />
      <button type="button" className="rc-btn is-wide press" onClick={() => { hapticLight(); setAttFile(null); setAttPose(null); setPhase('pick'); }} data-testid="rc-new">{c.newAttempt}</button>
    </>}
  </>;
  if (embedded) return content;
  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen rc-screen" data-testid="reference-screen">
        <div className="wrap">
          <Topbar fr={fr} backTestId="reference-back-btn" onBack={onClose || (() => { window.location.hash = ''; })} />
          <p className="eyebrow">{c.eyebrow}</p>
          <h1 className="title">{c.title}</h1>
          <p className="sub">{c.sub}</p>
          {content}
        </div>
      </section>
    </div>
  );
}
