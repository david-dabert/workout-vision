import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { hapticLight } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { Topbar, GroupHead } from '../experience/Showcase';
import { exerciseById, hasMedia, mediaUrl } from '../../lib/kine/library';
import { PROGRAMME_KEY, cleanProgramme, payloadAfter, resultLink, unpack } from '../../lib/kine/links';
import { loadReferencePose } from '../../lib/kine/media';
import { attemptsOf, logAttempt } from '../../lib/kine/store';
import { readPose } from '../../lib/reference/readPose';
import { useObjectUrl } from '../../lib/reference/useObjectUrl';
import ComparisonView from '../reference/ComparisonView';
import { shownAngle } from '../../lib/reference/compare';
import { COPY } from '../reference/reference-copy';
import ExerciseCard from './ExerciseCard';
import { KINE } from './kine-copy';
import '../reference/ReferenceCompare.css';
import './Kine.css';

// The patient's programme (#kine-p=<payload>, lib/kine/links.js), opened from the physiotherapist's link or QR code:
// who prepared it, the rhythm, the general advice, and each exercise with the physiotherapist's video, steps, dosage
// and personal note. An exercise the app compares has "Film my attempt": the video is read on the phone, compared with
// the reference (ComparisonView.jsx), logged on the phone, and its result alone can be sent back as a link (#kine-r=).

const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const weekAgo = () => Date.now() - 7 * 864e5;

// `mirror`: the patient works the side opposite the reference's (the programme's side, library.js `side`).
function Attempt({ ex, programme, programmeId, fr, k, onLogged, mirror }) {
  const c = COPY[fr ? 'fr' : 'en'];
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [refPose, setRefPose] = useState(null);
  const [attPose, setAttPose] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const attUrl = useObjectUrl(file);
  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async f => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setFile(f); setAttPose(null); setResult(null); setError('');
    try {
      setPhase('ref'); setProgress(0);
      const r = refPose || await loadReferencePose(ex, { signal: ctrl.signal, onProgress: setProgress });
      setRefPose(r);
      setPhase('att'); setProgress(0);
      setAttPose(await readPose(f, { signal: ctrl.signal, onProgress: setProgress }));
      setPhase('done');
    } catch (err) {
      if (err?.name === 'AbortError') { setPhase('idle'); return; }
      setError(err?.message || String(err)); setPhase('error');
    }
  };
  const onResult = useCallback(r => {
    setResult(r);
    logAttempt(programmeId, { id: ex.id, date: new Date().toISOString(), verdict: r.verdict });
    onLogged();
  }, [programmeId, ex.id, onLogged]);

  const send = async () => {
    hapticLight();
    const link = resultLink(`${window.location.origin}${window.location.pathname}`, {
      id: ex.id, patient: programme.patient, kine: programme.kine.name, date: new Date().toISOString().slice(0, 16), verdict: result.verdict, tempo: result.tempo,
      joints: result.joints.map(j => ({ name: j.name, within: j.within, range: j.rangeShare })),
      holds: result.holds.map(h => ({ ref: shownAngle(h.refAngle, h.direction), att: shownAngle(h.attAngle, h.direction), refSec: h.refSec, attSec: h.attSec, status: h.status })),
    });
    const verdict = result.verdict === 'match' ? c.match : result.verdict === 'revise' ? c.revise : c.refused;
    const text = k.pSendText(ex[fr ? 'fr' : 'en'].title, verdict);
    if (navigator.share) { try { await navigator.share({ text, url: link }); return; } catch { /* closed */ } }
    const to = programme.kine.email ? `mailto:${programme.kine.email}?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(link)}` : null;
    if (to) window.location.href = to; else { try { await navigator.clipboard.writeText(link); } catch { /* blocked */ } }
  };

  return <div className="kn-attempt">
    <button type="button" className="rc-btn is-primary is-wide press" onClick={() => input.current?.click()} disabled={phase === 'ref' || phase === 'att'} data-testid={`kn-film-${ex.id}`}>{phase === 'done' ? k.pFilmAgain : k.pFilm}</button>
    <input ref={input} type="file" accept="video/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { hapticLight(); run(f); } }} data-testid={`kn-film-${ex.id}-input`} />
    {(phase === 'ref' || phase === 'att') && <div className="rc-progress" role="status">
      <span>{phase === 'ref' ? k.pReadingRef : k.pReading}</span>
      <div className="rc-bar"><i style={{ width: `${Math.round(progress)}%` }} /></div>
      <button type="button" className="rc-link press" onClick={() => abortRef.current?.abort()}>{c.cancel}</button>
    </div>}
    {phase === 'error' && <p className="rc-error" role="alert">{c.failed} <small>{error}</small></p>}
    {phase === 'done' && <>
      <ComparisonView refPose={refPose} attPose={attPose} refUrl={mediaUrl(ex, 'mp4')} attUrl={attUrl} onResult={onResult} measures={ex.measures} mirror={mirror} />
      {result && <button type="button" className="rc-btn is-wide press" onClick={send} data-testid={`kn-send-${ex.id}`}>{k.pSend}</button>}
    </>}
  </div>;
}

export default function KinePatient({ onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const k = KINE[fr ? 'fr' : 'en'];
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);
  const payload = payloadAfter(window.location.hash, PROGRAMME_KEY);
  const programme = useMemo(() => cleanProgramme(unpack(payload)), [payload]);
  const programmeId = useMemo(() => fnv(payload || ''), [payload]);
  const [log, setLog] = useState(() => attemptsOf(programmeId));
  const refresh = useCallback(() => setLog(attemptsOf(programmeId)), [programmeId]);
  const week = log.filter(a => Date.parse(a.date) > weekAgo()).length;

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen rc-screen kn-screen" data-testid="kine-patient-screen">
        <div className="wrap">
          <Topbar fr={fr} backTestId="kine-patient-back-btn" onBack={onClose || (() => { window.location.hash = ''; })} />
          {!programme ? <p className="sc-frame-note" data-testid="kn-bad-link">{k.pBad}</p> : <>
            <p className="eyebrow">{k.pEyebrow}</p>
            <h1 className="title">{k.pTitle(programme.patient)}</h1>
            <p className="sub">{programme.kine.name ? `${k.pFrom(programme.kine.name)} · ` : ''}{k.pRhythm(programme.perDay, programme.weeks)}</p>
            {(programme.kine.phone || programme.kine.email) && <div className="kn-row kn-contact">
              {programme.kine.phone && <a className="rc-btn press" href={`tel:${programme.kine.phone.replace(/\s+/g, '')}`}>{k.pCall}</a>}
              {programme.kine.email && <a className="rc-btn press" href={`mailto:${programme.kine.email}`}>{k.pMail}</a>}
            </div>}
            {programme.note && <p className="kn-note" data-testid="kn-general-note">{programme.note}</p>}
            {week > 0 && <p className="sc-caption" data-testid="kn-week">{k.pDone(week)}</p>}
            {programme.items.map((it, n) => {
              const ex = exerciseById(it.id);
              return <section key={it.id} className="sc-section">
                <GroupHead title={`${n + 1} · ${k.dosage(it.reps, it.sets)}`} />
                <ExerciseCard ex={{ ...ex, dosage: { reps: it.reps, sets: it.sets } }} fr={fr} k={k} open stepsLabel={k.howTo} />
                {it.note && <p className="kn-note">{it.note}</p>}
                {ex.side && it.side && it.side !== ex.side && <p className="kn-note" data-testid={`kn-side-note-${it.id}`}>{k.pSide(it.side, ex.side)}</p>}
                {ex.compare && hasMedia() ? <Attempt ex={ex} programme={programme} programmeId={programmeId} fr={fr} k={k} onLogged={refresh} mirror={!!(ex.side && it.side && it.side !== ex.side)} />
                  : <p className="sc-caption">{ex.compare ? k.noMedia : k.pNoCompare}</p>}
              </section>;
            })}
            <p className="sc-caption">{k.pPrivacy}</p>
          </>}
        </div>
      </section>
    </div>
  );
}
