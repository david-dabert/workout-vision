import { useEffect, useRef, useState } from 'react';
import { useT } from '../lib/LanguageContext';
import { analyzeCoreVideo, APPROVED_LIFTS } from '../lib/coreAnalysis';
import { saveWorkout } from '../lib/storage';
import Watch from './experience/Watch';
import Result from './experience/Result';
import Report from './experience/Report';

export default function CoreUpload({ onClose, initialLift = '', initialFile = null }) {
  const { lang, tExercise } = useT();
  const fr = lang === 'fr';
  const [lift, setLift] = useState(initialLift);
  const [file, setFile] = useState(initialFile);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [landmarks, setLandmarks] = useState(null);
  const [frameSize, setFrameSize] = useState(null);
  const trueNRef = useRef(null);
  const abort = useRef(null);
  const autoStarted = useRef(false);
  useEffect(() => () => abort.current?.abort(), []);

  // Auto-start analysis when arriving from the Film screen with a file
  useEffect(() => {
    if (initialFile && initialLift && !autoStarted.current) {
      autoStarted.current = true;
      analyze();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function analyze() {
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true); setResult(null); setError(''); setProgress(0);
    try {
      const output = await analyzeCoreVideo(file, lift, { signal: controller.signal, onProgress: setProgress, onPhase: setPhase, onLandmarks: (lm, w, h) => { setLandmarks(lm); setFrameSize([w, h]); } });
      setResult(output);
      // In experience mode (initialFile), Result component handles saving
      if (!initialFile && !output.refused) {
        try {
          await saveWorkout({ exercise: lift, reps: output.count, repDetails: output.reps, arm: output.arm, confidence: output.confidence, date: new Date().toISOString(), source: 'counter-core', duration: output.metadata.duration });
        } catch {
          setError(fr ? 'Résultat affiché, mais non enregistré sur ce téléphone.' : 'Result shown, but could not save it on this phone.');
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
    } finally { setBusy(false); abort.current = null; }
  }

  // Experience-mode Watch screen while analyzing
  if (initialFile && busy) {
    return <Watch lift={lift} progress={progress} phase={phase} landmarks={landmarks} frameSize={frameSize} onSkip={() => { abort.current?.abort(); onClose(); }} />;
  }

  // Experience-mode Result + Report (Result stays mounted so step state survives)
  if (initialFile && result) {
    return <>
      <Result result={result} lift={lift} onClose={onClose} onReport={(savedN) => { trueNRef.current = savedN; setShowReport(true); }} onNewSet={onClose} onRefilm={onClose} />
      {showReport && <Report result={result} lift={lift} trueN={trueNRef.current} onBack={() => setShowReport(false)} />}
    </>;
  }

  return <main className="page" style={{ maxWidth: 520, margin: '0 auto', padding: 20 }}>
    <button className="btn btn-ghost" onClick={() => { abort.current?.abort(); onClose(); }}>{fr ? 'Retour' : 'Back'}</button>
    <h1>{fr ? 'Analyser une vidéo' : 'Analyze a video'}</h1>
    <p>{fr ? 'Version de test - vérifiez le nombre de répétitions.' : 'Test version - check the repetition count.'}</p>
    <label htmlFor="core-lift">{fr ? 'Exercice' : 'Exercise'}</label>
    <select id="core-lift" value={lift} disabled={busy} onChange={e => { setLift(e.target.value); setResult(null); }} style={{ display: 'block', width: '100%', minHeight: 44, marginBottom: 16 }}>
      <option value="">{fr ? 'Choisir un exercice' : 'Choose an exercise'}</option>
      {APPROVED_LIFTS.map(id => <option key={id} value={id}>{tExercise(id)}</option>)}
    </select>
    <label htmlFor="core-file">{fr ? 'Vidéo' : 'Video'}</label>
    <input id="core-file" type="file" accept="video/*,.mov" disabled={busy} onChange={e => { setFile(e.target.files[0] || null); setResult(null); }} style={{ display: 'block', marginBottom: 20, maxWidth: '100%' }} />
    <button className="btn btn-primary" disabled={!file || !lift || busy} onClick={analyze}>{fr ? 'Analyser' : 'Analyze'}</button>
    {busy && <div role="status">
      <p>{phase === 'model' ? (fr ? 'Chargement du modèle…' : 'Loading model…') : `${fr ? 'Analyse' : 'Analysis'} ${Math.round(progress)}%`}</p>
      <progress max="100" value={progress} />
      <button className="btn btn-ghost" onClick={() => abort.current?.abort()}>{fr ? 'Annuler' : 'Cancel'}</button>
    </div>}
    {error && <p role="alert">{error}</p>}
    {result && <section data-testid="core-result" aria-live="polite">
      <h2>{tExercise(result.exercise)}</h2>
      {result.refused ? <p>{fr ? 'Impossible de compter : les articulations nécessaires sont cachées pendant la majeure partie de la série. Filmez avec le bras entier visible.' : 'Cannot count: the required joints are hidden for most of the set. Film with the whole arm visible.'}</p> : <>
        {/* Ask for verification for every result, including all low-confidence results. */}
        <h2>{fr ? `Nous avons compté ${result.count}. Est-ce correct ?` : `We counted ${result.count}. Is that right?`}</h2>
        <p>{fr ? 'Bras utilisé' : 'Arm used'}: {result.arm}</p>
        <ol aria-label={fr ? 'Répétitions comptées' : 'Counted repetitions'} style={{ display: 'flex', gap: 4, listStyle: 'none', padding: 0, flexWrap: 'wrap' }}>{result.reps.map(rep => <li key={rep.index} aria-label={`${fr ? 'Répétition' : 'Rep'} ${rep.index}`} style={{ width: 12, height: 28, background: 'currentColor', borderRadius: 2 }} />)}</ol>
      </>}
    </section>}
  </main>;
}
