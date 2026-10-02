import { useState, useEffect, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { topPose } from './lift-scenes';
import { exerciseName } from './exercise-info';
import { Body, mapPose, DPR, LITE } from './entry-scene';
import { addLayer, presence } from './stage-loop';
import { saveWorkout } from '../../lib/storage';
import { askToKeep } from '../../lib/keep-sets';
import { contribution, contributeAsked, keepContribution, markContributeAsked, readChoice } from '../../lib/contribute';
import ContributeAsk from './ContributeAsk';
import { warmReportPdf } from './Report';
import { refreshSets, loadSets, knownSets } from './sets';
import { setAccount } from './set-account';
import RestClock from './RestClock';
import Digits from './Digits';
import { restClock } from './rest-clock';
import { NOTES } from './set-notes';
import { decimal, repTable, speedChangeLine } from './report-sheet';
import { readLevel, writeLevel, levelAsked, markLevelAsked, shouldAskLevel, levelView, resultBlocks } from './level';
import LevelPick from './LevelPick';
import { tierLabel } from '../../lib/liftTiers';
import { MEASURES_SHOWN, SPEED_CHANGE_SHOWN, experimentalLabel } from './measures';
import { tierOf } from '../../lib/offer';
import { reportEmailUrl, reportIssueUrl, challengeShare, shareChallenge, appVersion, reportFor } from '../../lib/reportLinks';
import { limbLabel, jointName } from './lift-meta';
import { liftDefinition } from '../../lib/counting/core';
import { refusal } from './refusal';
import { TARGET_FPS } from '../../lib/extractionConfig';
import './Result.css';
import { isCorrected, markLabel, marksLabel } from './replay-labels';
import { compareSides } from '../../lib/counting/symmetry';
import { sidesLines, sidesRecord } from './sides-line';
import RepStrips, { hasStrips } from './RepStrips';

const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// The user's own body at the top of the first rep, faint behind the number.
function ghostSource(result, lift) {
  const rep = result.reps?.[0], frames = result.imageLandmarks, ts = result.timestamps;
  if (rep && frames?.length && ts?.length) {
    const at = rep.startTime + (rep.concentricSec || 0);
    let best = 0;
    for (let i = 1; i < ts.length; i++) if (Math.abs(ts[i] - at) < Math.abs(ts[best] - at)) best = i;
    const lm = frames[best], fw = result.metadata?.width || result.metadata?.extractedWidth || 1, fh = result.metadata?.height || result.metadata?.extractedHeight || 1;
    if (lm) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const p = new Float32Array(66);
      for (let i = 0; i < 33; i++) {
        const q = lm[i], x = q.x * fw, y = q.y * fh;
        p[i * 2] = q.visibility < 0.3 ? NaN : x; p[i * 2 + 1] = q.visibility < 0.3 ? NaN : y;
        if (q.visibility >= 0.5) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      }
      if (Number.isFinite(x0)) {
        const px = (x1 - x0) * 0.1, py = (y1 - y0) * 0.1;
        for (let i = 0; i < 33; i++) { p[i * 2] -= x0 - px; p[i * 2 + 1] -= y0 - py; }
        return { p, vb: [x1 - x0 + 2 * px, y1 - y0 + 2 * py] };
      }
    }
  }
  return topPose(lift);
}

function Topbar({ fr, onClose, onReplay, replayRef, badge = true }) {
  return <div className="topbar">
    <button className="icon-btn press" onClick={onClose} aria-label={fr ? 'Fermer' : 'Close'}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
    {onReplay && <button ref={replayRef} className="rp-open press" onClick={onReplay} aria-label={fr ? 'Revoir la série avec le squelette' : 'Replay the set with the skeleton'}>
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z" /></svg>
      <span>{fr ? 'Revoir' : 'Replay'}</span>
    </button>}
    {/* The test mark stays on the screens without a result; on the result it would push Revoir off the centre
        line in French (David's standing order, 2 October 2026; design review). Only the counted result drops it. */}
    {badge && <span className="pill">{fr ? 'Version de test' : 'Test version'}</span>}
  </div>;
}

// Shown when the analysis itself failed; the technical message stays in the console.
export function AnalysisError({ lift, phase, onClose, onRefilm }) {
  const { lang } = useT(), fr = lang === 'fr';
  const model = phase === 'model';
  return <div className="wv-experience">
    <section className="screen is-active result-screen"><div className="wrap">
      <Topbar fr={fr} onClose={onClose} />
      <p className="eyebrow refused-eyebrow" data-reveal style={{ '--i': 0 }}>{exerciseName(lift, lang)}</p>
      <h2 className="title refused-title" data-reveal style={{ '--i': 1 }}>{model
        ? (fr ? 'L’analyse n’a pas pu démarrer.' : 'The analysis could not start.')
        : (fr ? 'Nous n’avons pas pu lire cette vidéo.' : 'We could not read this video.')}</h2>
      <p className="body-text" data-reveal style={{ '--i': 2 }}>{model
        ? (fr ? 'Rechargez la page, puis réessayez.' : 'Reload the page, then try again.')
        : (fr ? 'Essayez une autre vidéo, ou filmez à nouveau avec l’appareil photo.' : 'Try another video, or record again with the camera.')}</p>
      <div className="actions result-actions" data-reveal style={{ '--i': 4 }}>
        <button className="btn-primary press" onClick={onRefilm}>{fr ? 'Refilmer' : 'Record again'}</button>
        <button className="btn-ghost press" onClick={onRefilm}>{fr ? 'Choisir une autre vidéo' : 'Choose another video'}</button>
      </div>
    </div></section>
  </div>;
}

// What was read, without naming a cause the app cannot see (review 01 of the partial-read fix).
function partialLine(read, expected, fr) {
  const share = expected ? Math.round((Math.min(read, expected) / expected) * 100) : null;
  if (expected && read > expected) return fr ? 'Une partie de la vidéo a été lue deux fois. Nous n’affichons pas un compte faux. Recommencez l’analyse.' : 'Part of the video was read twice. We do not show a wrong count. Start the analysis again.';
  return share === null
    ? (fr ? 'La durée de la vidéo n’a pas pu être lue. Nous n’affichons pas un compte incertain. Recommencez l’analyse.' : 'The length of the video could not be read. We do not show an uncertain count. Start the analysis again.')
    : (fr ? `Seuls ${share}\u00A0% de la vidéo ont été analysés. Nous n’affichons pas un compte partiel. Recommencez l’analyse.` : `Only ${share}% of the video was analysed. We do not show a partial count. Start the analysis again.`);
}

// Shown when the phone read only part of the video: no count, since it would be the count of part
// of the set (29 September: 181 of 439 samples read, 2 of 10 reps counted).
export function AnalysisIncomplete({ lift, read, expected, decoder, onClose, onRestart, onRefilm }) {
  const { lang } = useT(), fr = lang === 'fr';
  return <div className="wv-experience">
    <section className="screen is-active result-screen"><div className="wrap">
      <Topbar fr={fr} onClose={onClose} />
      <p className="eyebrow refused-eyebrow" data-reveal style={{ '--i': 0 }}>{exerciseName(lift, lang)}</p>
      <h2 className="title refused-title" data-reveal style={{ '--i': 1 }}>{fr ? 'La vidéo n’a pas été lue en entier.' : 'The video was not read in full.'}</h2>
      <p className="body-text" data-reveal style={{ '--i': 2 }}>{partialLine(read, expected, fr)}</p>
      <div className="actions result-actions" data-reveal style={{ '--i': 4 }}>
        <button className="btn-primary press" onClick={onRestart}>{fr ? 'Recommencer l’analyse' : 'Start the analysis again'}</button>
        <button className="btn-ghost press" onClick={onRefilm}>{fr ? 'Choisir une autre vidéo' : 'Choose another video'}</button>
      </div>
      <ReportCount fr={fr} report={{ lift, liftName: exerciseName(lift, lang), counted: null, userCount: null, partial: true, version: appVersion(), fr, decoder, read: { read, expected } }} />
    </div></section>
  </div>;
}

// Shown when the page was hidden during the analysis (screen locked, app left).
// The run was stopped and nothing it measured is shown.
export function AnalysisInterrupted({ lift, onClose, onRestart, onRefilm }) {
  const { lang } = useT(), fr = lang === 'fr';
  return <div className="wv-experience">
    <section className="screen is-active result-screen"><div className="wrap">
      <Topbar fr={fr} onClose={onClose} />
      <p className="eyebrow refused-eyebrow" data-reveal style={{ '--i': 0 }}>{exerciseName(lift, lang)}</p>
      <h2 className="title refused-title" data-reveal style={{ '--i': 1 }}>{fr ? 'L’analyse a été interrompue.' : 'The analysis was interrupted.'}</h2>
      <p className="body-text" data-reveal style={{ '--i': 2 }}>{fr
        ? 'L’écran s’est éteint ou vous avez quitté l’app. Gardez l’écran allumé pendant l’analyse, puis recommencez.'
        : 'The screen turned off or you left the app. Keep the screen on during the analysis, then start again.'}</p>
      <div className="actions result-actions" data-reveal style={{ '--i': 4 }}>
        <button className="btn-primary press" onClick={onRestart}>{fr ? 'Recommencer l’analyse' : 'Start the analysis again'}</button>
        <button className="btn-ghost press" onClick={onRefilm}>{fr ? 'Choisir une autre vidéo' : 'Choose another video'}</button>
      </div>
    </div></section>
  </div>;
}

/**
 * covered: the screen open over the result ('report' or 'replay'), or nothing.
 * onReplay: opens the replay; absent when the video is not at hand.
 */
export default function Result({ result, lift, covered, onClose, onReport, onReplay, onNewSet, onRefilm, onSaved = () => {} }) {
  const { lang } = useT(), fr = lang === 'fr';
  const reduced = useRef(REDUCED()).current;
  const [step, setStep] = useState('ask'); // ask | fix | saved
  const [trueN, setTrueN] = useState(result.count);
  // The typed digits while the numeral is open to the keyboard ('' until a digit is typed); null when not
  // typing. The number it opened on is kept, so an empty field means "unchanged".
  const [typed, setTyped] = useState(null);
  const typedFrom = useRef(0);
  const [shown, setShown] = useState(reduced ? result.count : 0);
  const [asked, setAsked] = useState(reduced);
  const [saveError, setSaveError] = useState('');
  const [rest] = useState(restClock), restBegun = useRef(false);
  const savedId = useRef(null), restRef = useRef(null);
  // Once saved, the rest is what the user looks at on the bench: it is brought into view (critic, 30 September).
  useEffect(() => { if (step === 'saved') restRef.current?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }, [step]); // the report compares this set with the one before it, never with itself
  const [shareNote, setShareNote] = useState('');
  const [sel, setSel] = useState(-1); // the rep whose details are shown, or none
  const saving = useRef(false);
  const rootRef = useRef(null);
  const reportRef = useRef(null);
  const replayRef = useRef(null);
  const coveredRef = useRef(covered);
  coveredRef.current = covered;
  // Once the question is answered the ghost steps back, so it never sits on the cards' words (#8).
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  // Back from the report or the replay, the keyboard and screen readers return to the button that opened it.
  const wasCovered = useRef(covered);
  useEffect(() => {
    if (wasCovered.current && !covered) (wasCovered.current === 'replay' ? replayRef : reportRef).current?.focus({ preventScroll: true });
    wasCovered.current = covered;
  }, [covered]);

  const liftName = exerciseName(lift, lang);
  // A refused set speaks of the limbs that were out of sight (refusal.js); a counted one, of the limbs it counted.
  const why = result.refused ? refusal(result, lift) : null;
  const limb = limbLabel(lift, why ? why.side : result.arm === 'both' ? 'both' : result.arm === 'left' ? 'left' : 'right', fr), armLabel = limb.text, e = limb.feminine ? 'e' : '';
  const many = !!limb.plural, ee = limb.feminine ? 'es' : 's';
  const legs = liftDefinition(lift)?.joint === 'knee';
  const seconds = Math.round(result.metadata?.duration || 0);
  const count = result.count;

  // Each rep's mark is as tall as its range, as in the prototype; touching the marks
  // shows the nearest rep's details. A rep the recording cut shows its range only.
  // Without validated measures (measures.js) every mark has one height, and a rep's details are its
  // number alone, with "partly filmed" where the recording cut it.
  const reps = result.reps || [];
  const maxRom = Math.max(1, ...reps.map(r => r.romDegrees || 0));
  const NB = '\u00A0', sec = x => `${decimal(x, fr)}${NB}s`;
  const whole = reps.filter(r => !r.clipped);
  // Left against right, for a set filmed from the front only (counting/symmetry.ts); measured once.
  const [compared] = useState(() => (Array.isArray(result.worldLandmarks) && Array.isArray(result.timestamps)
    ? compareSides(result.worldLandmarks, result.timestamps, lift, reps) : null));
  const sides = sidesRecord(compared);
  const sidesPerRep = compared?.status === 'measured' ? compared.comparison.perRep : null;
  const corrected = step === 'saved' && isCorrected(trueN, count);
  const sidesText = MEASURES_SHOWN && !corrected ? sidesLines(sides, fr, lift) : null;
  // The chosen rep's number is its lit mark; it is spoken, not printed, so the line stays on one row.
  // Where a line must break, it breaks after a separator, never inside a measure.
  let detail = '', detailHead = '';
  if (sel >= 0 && reps[sel]) {
    const r = reps[sel];
    const filmed = fr ? (corrected ? 'filmé en partie' : 'filmée en partie') : 'partly filmed';
    // After a correction the marks are the app's, not the saved set's reps: they are named so (replay-labels.js).
    const word = corrected ? markLabel({ index: sel + 1, total: reps.length, fr, corrected }) : `${fr ? 'Rép.' : 'Rep'} ${sel + 1}`;
    // "Repère" is masculine, "répétition" feminine: the clipped note agrees with the word before it.
    if (!MEASURES_SHOWN) { detailHead = ''; detail = `${word}${r.clipped ? `${NB}· ${filmed}` : ''}`; }
    else { detailHead = `${word} · `; detail = r.clipped
      ? `${Math.round(r.romDegrees)}°${NB}· ${filmed}`
      : `${sec(r.endTime - r.startTime)}${NB}· ${Math.round(r.romDegrees)}°${NB}· conc.${NB}${sec(r.concentricSec)}${NB}· ${fr ? 'exc.' : 'ecc.'}${NB}${sec(r.eccentricSec)}`; }
  } else if (MEASURES_SHOWN && (asked || step !== 'ask') && whole.length) {
    const rom = whole.reduce((a, r) => a + r.romDegrees, 0) / whole.length;
    const dur = whole.reduce((a, r) => a + (r.endTime - r.startTime), 0) / whole.length;
    // The joint whose angle is measured is named, so a range is never read as another joint's (design review,
    // 2 October: 64° read as shoulder flexion on a press). jointName (lift-meta.js).
    detail = fr ? `Amplitude moyenne ${jointName(liftDefinition(lift)?.joint, true)}${NB}: ${Math.round(rom)}°${NB}· durée moyenne ${sec(dur)}` : `Average ${jointName(liftDefinition(lift)?.joint, false)} range: ${Math.round(rom)}°${NB}· average duration ${sec(dur)}`;
  }
  // Step 3: the account of the set, one tip and a word of encouragement (set-account.js). The sets of
  // this exercise already saved give the last set's reps and this set's rank once it is saved.
  const mine = list => (list || []).filter(w => (w.exercise || w.exerciseKey) === lift);
  // Unknown (null) until read; a failed read is tried again once the set is saved, and until then the
  // screen states no rank and no comparison rather than a false one (review 01 of step 3).
  const [before, setBefore] = useState(() => { const k = knownSets(); return k ? mine(k) : null; });
  useEffect(() => { let live = true; loadSets().then(l => { if (live) setBefore(b => b ?? mine(l)); }, () => {}); return () => { live = false; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const account = setAccount({ reps, first: liftDefinition(lift)?.first, fr, name: liftName, count: trueN, corrected: step === 'saved' && isCorrected(trueN, count), previous: before?.length ? before[0].reps : null, nth: before ? before.length + 1 : null });
  const shortSet = new Set(account.short);
  // The level read as the screen opens (level.js); the expert's table and speed line are the report's own.
  const [view] = useState(() => levelView(readLevel()));
  const perRep = view.perRep && MEASURES_SHOWN ? { table: repTable({ reps, first: liftDefinition(lift)?.first, fr }), speed: SPEED_CHANGE_SHOWN ? speedChangeLine(reps, fr) : '' } : null;
  const table = perRep?.table, speedLine = perRep?.speed || '';
  // The question on the level: offered once, after a saved set, when none is stored.
  const [levelBefore] = useState(() => ({ level: readLevel(), asked: levelAsked() }));
  const [chosen, setChosen] = useState('');
  const offerLevel = shouldAskLevel({ step, ...levelBefore });
  useEffect(() => { if (offerLevel) markLevelAsked(); }, [offerLevel]);
  // Asked once, on a saved card that asks nothing else (the level question comes first); shown is asked.
  const [askContribute] = useState(() => readChoice() === null && !contributeAsked());
  const showContribute = step === 'saved' && !offerLevel && askContribute;
  useEffect(() => { if (showContribute) markContributeAsked(); }, [showContribute]);
  function chooseLevel(l) { writeLevel(l); setChosen(l); }
  const marksRef = useRef(null);
  function pick(e) {
    const marks = [...(marksRef.current?.children || [])];
    let best = -1, gap = Infinity;
    marks.forEach((m, i) => { const r = m.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - e.clientX); if (d < gap) { gap = d; best = i; } });
    if (best >= 0) setSel(s => (s === best ? -1 : best));
  }
  function keys(e) {
    const n = reps.length, go = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (go) { e.preventDefault(); setSel(s => (s < 0 ? (go > 0 ? 0 : n - 1) : Math.min(n - 1, Math.max(0, s + go)))); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); setSel(e.key === 'Home' ? 0 : n - 1); }
    else if (e.key === 'Escape') setSel(-1);
  }

  // The count rises one rep at a time, lighting one mark per rep; the question follows.
  useEffect(() => {
    if (reduced || result.refused) return undefined;
    const step = Math.min(150, 1500 / Math.max(count, 1)), t0 = performance.now();
    let raf = 0, t = 0;
    const tick = (now) => {
      const k = Math.max(0, Math.min(count, Math.floor((now - t0 - 450) / step) + 1));
      setShown(k);
      if (k < count) raf = requestAnimationFrame(tick);
      else t = setTimeout(() => setAsked(true), 560);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The ghost of the lift behind the number.
  useEffect(() => {
    if (result.refused) return undefined;
    const body = new Body(LITE ? 1700 : 2600, 7), src = ghostSource(result, lift), out = new Float32Array(66), memo = {};
    return addLayer((ctx, W, H, t, now) => {
      const here = presence(rootRef.current, now, memo);
      if (coveredRef.current || here <= 0) return;
      mapPose(src.p, src.vb, { x: W * 0.04, y: H * 0.04, w: W * 0.92, h: H * 0.66 }, out);
      // The ghost belongs to the count: it fades as the count scrolls away, so it never sits behind the
      // charts and words below (design review, 2 October).
      const num = rootRef.current?.querySelector('.res-count');
      const seen = num ? Math.max(0, Math.min(1, num.getBoundingClientRect().bottom / (window.innerHeight * 0.5))) : 1;
      if (seen <= 0) return;
      body.draw(ctx, out, { alpha: 0.2 * here * seen * (stepRef.current === 'ask' ? 1 : 0.3), time: t, dpr: DPR, breathe: reduced ? 0 : Math.sin(t * 0.9) * 0.01 });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The set saved, as a contribution, kept on this phone until the person sends or erases it.
  const keepThis = n => { keepContribution(contribution({ result, lift, kept: n, setId: savedId.current, appVersion: appVersion() })).catch(() => {}); };

  async function doSave(n, corrected) {
    if (saving.current) return;
    saving.current = true;
    // The rest begins at the first attempt to save; a retry leaves the clock as the user left it.
    if (!restBegun.current) { restBegun.current = true; rest.start(); }
    try {
      savedId.current = await saveWorkout({
        exercise: lift, reps: n, repDetails: result.reps, arm: result.arm, confidence: result.confidence,
        date: new Date().toISOString(), source: 'counter-core', duration: result.metadata?.duration, corrected,
        // Measured over the app's marks: kept only when the saved count is the app's.
        sides: n === count ? sides : null,
        // What the app counted stays apart from what the visitor kept.
        machineResult: { reps: count, confidence: result.confidence ?? null },
        correctedResult: n !== count ? { reps: n } : null,
        // Rep details measured with step 3c's boundaries; older sets' details are not shown.
        repDetailsVersion: 2,
      });
      refreshSets();
      // A set is now worth keeping: the browser is asked to keep the app's storage (keep-sets.js; a no-op once kept).
      askToKeep();
      // With the person's yes, this set is kept as a contribution: counts, pose, decoder, phone kind (contribute.js).
      if (readChoice() === 'yes') keepThis(n);
      // The sets were never read: read them now, the one just saved first, and count the others.
      if (before === null) loadSets().then(l => setBefore(b => b ?? mine(l).slice(1)), () => {});
      setSaveError(''); // a retry that saves takes back "not saved"
      setStep('saved');
      onSaved(n, n === count ? sides : null); // the replay states the saved count beside the detected marks; the report reads the comparison
      warmReportPdf().catch(() => {}); // the report screen says so if it could not load
    } catch {
      setSaveError(fr ? 'Résultat affiché, mais non enregistré.' : 'Result shown, but could not save it.');
    } finally { saving.current = false; }
  }

  // The challenge opens the phone's share sheet inside the tap, with the result and a link to the
  // app; where the sheet is missing or refuses the message, the message is copied for the user to paste.
  function challenge() {
    const data = challengeShare({ liftName, count: trueN, counted: count, fr, url: new URL(import.meta.env.BASE_URL, location.origin).href });
    setShareNote('');
    shareChallenge(data, { share: navigator.share ? d => navigator.share(d) : null, clipboard: navigator.clipboard }).then(out => {
      if (out === 'copied') setShareNote(fr ? 'Message copié. Collez-le dans une conversation.' : 'Message copied. Paste it into a chat.');
      else if (out === 'unavailable') setShareNote(fr ? 'Le partage n’est pas disponible dans ce navigateur.' : 'Sharing is not available in this browser.');
    });
  }
  // What the phone read, for the report: the decoder and the samples read out of the video's.
  const read = { read: result.timestamps?.length ?? null, expected: Number.isFinite(result.metadata?.duration) ? Math.floor(result.metadata.duration * TARGET_FPS) : null };
  const report = reportFor({ lift, liftName, count, trueN, version: appVersion(), fr, refused: !!result.refused, step, saveError, decoder: result.metadata?.method || '', read });

  if (result.refused) {
    const text = why.cause === 'nobody'
      ? (fr ? 'Nous ne vous avons pas trouvé dans la vidéo.' : 'We could not find you in the video.')
      : why.cause === 'unclear'
        ? (many
          ? (fr ? `Vos ${limb.noun} n\u2019étaient pas assez visibles pour compter les répétitions.` : `Your ${limb.noun} were not visible enough to count the reps.`)
          : (fr ? `Votre ${armLabel} n\u2019était pas assez visible pour compter les répétitions.` : `Your ${armLabel} was not visible enough to count the reps.`))
        : why.hips
          ? (why.cause === 'outside'
            ? (fr ? 'Vos hanches sont restées hors du cadre pendant la plus grande partie de la série.' : 'Your hips stayed out of the frame for most of the set.')
            : (fr ? 'Vos hanches étaient cachées pendant la plus grande partie de la série.' : 'Your hips were hidden for most of the set.'))
          : (why.cause === 'outside'
            ? (many
              ? (fr ? `Vos ${limb.noun} sont sorti${ee} du cadre pendant la plus grande partie de la série.` : `Your ${limb.noun} left the frame for most of the set.`)
              : (fr ? `Votre ${armLabel} est sorti${e} du cadre pendant la plus grande partie de la série.` : `Your ${armLabel} left the frame for most of the set.`))
            : (many
              ? (fr ? `Vos ${limb.noun} étaient caché${ee} pendant la plus grande partie de la série.` : `Your ${limb.noun} were hidden for most of the set.`)
              : (fr ? `Votre ${armLabel} était caché${e} pendant la plus grande partie de la série.` : `Your ${armLabel} was hidden for most of the set.`)));
    const fix = why.hips
      ? (fr ? 'Reculez pour que vos hanches soient dans l\u2019image, puis refilmez.' : 'Step back so your hips are in the picture, then record again.')
      : why.cause === 'nobody'
        ? (fr ? 'Posez le téléphone face à vous, placez-vous dans l\u2019image, puis refilmez.' : 'Stand the phone facing you, step into the picture, then record again.')
        : legs
          ? (fr ? 'Placez-vous au centre de l\u2019image, pieds compris, puis refilmez.' : 'Stand in the middle of the picture, feet included, then record again.')
          : (fr ? 'Placez-vous au centre de l\u2019image, bras compris, puis refilmez.' : 'Stand in the middle of the picture, arms included, then record again.');
    // The replay shows where the tracking lost the body; under it, this screen is out of reach.
    return <div className="wv-experience" inert={covered ? true : undefined}>
      <section className="screen is-active result-screen"><div className="wrap">
        <Topbar fr={fr} onClose={onClose} onReplay={onReplay} replayRef={replayRef} />
        <p className="eyebrow refused-eyebrow" data-reveal style={{ '--i': 0 }}>{liftName}</p>
        <h2 className="title refused-title" data-reveal style={{ '--i': 1 }}>{fr ? 'Nous n’avons pas pu compter cette série.' : 'We could not count this set.'}</h2>
        {/* The frame beside its sentence, as a figure and its caption, so "Refilmer" stays in view (design review, 30 September). */}
        <div className={why.cause === 'outside' ? 'refused-why' : undefined} data-reveal style={{ '--i': 2 }}>
          {why.cause === 'outside' && <div className="frame">
            <i className="edge" style={why.exitLeft ? { left: 0 } : { right: 0 }} aria-hidden="true" />
            <span className="edge-label" style={{ textAlign: why.exitLeft ? 'left' : 'right' }}>{fr ? 'Hors cadre' : 'Out of frame'}</span>
          </div>}
          <p className="body-text">{text}</p>
        </div>
        <div className="fix-note" data-reveal style={{ '--i': 3 }}>
          <p className="eyebrow">{fr ? 'La correction' : 'The fix'}</p>
          <p className="fix-text">{fix}</p>
        </div>
        <div className="actions result-actions" data-reveal style={{ '--i': 4 }}>
          <button className="btn-primary press" onClick={onRefilm}>{fr ? 'Refilmer' : 'Record again'}</button>
          <button className="btn-ghost press" onClick={onRefilm}>{fr ? 'Choisir une autre vidéo' : 'Choose another video'}</button>
        </div>
        <ReportCount fr={fr} report={report} />
      </div></section>
    </div>;
  }

  // The account (A) and the tip (B); the cheer (C) and the notes, which a beginner finds open.
  const plain = <>
    {account.lines.map(l => <p key={l} className="acc-line">{l}</p>)}
    <p className="acc-tip">{account.tip}</p>
  </>;
  const more = <>
    {step === 'saved' && account.cheer && <p className="acc-cheer">{account.cheer}</p>}
    <details className="acc-notes" open={view.notesOpen || undefined}>
      <summary className="text-btn press">{fr ? 'En savoir plus' : 'Learn more'}</summary>
      {NOTES[fr ? 'fr' : 'en'].map(n => <section key={n.title}>
        <h3 className="eyebrow">{n.title}</h3>
        {n.lead && <p className="acc-lead">{n.lead}</p>}
        {n.lines.map(l => <p key={l}>{l}</p>)}
      </section>)}
    </details>
  </>;
  // Once saved, the numeral is the count saved: the user's, when they corrected it; the app's stays
  // beside it as "Compté par l'app" (review of 1 October). Before, it is the app's count rising.
  const big = step === 'saved' ? trueN : shown;
  const one = big <= 1;
  const measured = count > 0 && asked;
  // The level chosen before this set sets the screen; one chosen on it applies from the next set.
  // The set's two ranges and what a gap means: under the strips, or under the marks for the beginner, who has no strips.
  const sidesLine = measured && sidesText ? <div className="res-sides" data-testid="res-sides"><p>{sidesText.line}</p><p className="res-sides-note">{sidesText.note}</p></div> : null;
  const blocks = {
    count: <div key="count" className="res-count">
      <span key={big} className="numeral tick" aria-hidden="true" data-testid="res-numeral">{big}</span>
      <p className="res-label">{fr ? (one ? 'Répétition' : 'Répétitions') : (big === 1 ? 'Rep' : 'Reps')}{result.test ? (fr ? ` en ${result.test.windowSec}\u00A0secondes` : ` in ${result.test.windowSec} seconds`) : ''}</p>
      {/* A fitness test whose video ends before its window: the score is of what was filmed (fitness-tests.js). */}
      {result.test && !result.test.complete && <p className="res-meta res-test-short" data-testid="res-test-short">{fr ? `La vidéo s’arrête avant les ${result.test.windowSec}\u00A0secondes\u00A0: le score ne porte que sur ce qui a été filmé.` : `The video ends before ${result.test.windowSec} seconds: the score covers only what was filmed.`}</p>}
      {/* Under the count from the first frame: every measure on this screen (marks, account, table) is experimental (measures.js). */}
      {MEASURES_SHOWN && count > 0 && <p className="res-exp" data-testid="res-exp">{experimentalLabel(fr)}</p>}
      <p className="sr" role="status">{step === 'saved'
        ? (fr ? `${trueN} ${trueN > 1 ? 'répétitions enregistrées' : 'répétition enregistrée'}.` : `${trueN} ${trueN === 1 ? 'rep' : 'reps'} saved.`)
        : asked ? (fr ? `${count} ${count > 1 ? 'répétitions comptées' : 'répétition comptée'}.` : `${count} ${count === 1 ? 'rep' : 'reps'} counted.`) : ''}</p>
    </div>,
    bars: count > 0 && <div key="bars">
      <div ref={marksRef} className={`bars${sel >= 0 ? ' has-sel' : ''}`}
        {...(asked ? { role: 'group', tabIndex: 0, 'aria-label': marksLabel({ fr, corrected }), onClick: pick, onKeyDown: keys } : { 'aria-hidden': true })}>
        {reps.map((rep, i) => <div key={rep.index} className={`bar${i < shown ? ' lit' : ''}${i === sel ? ' sel' : ''}`} style={{ '--r': MEASURES_SHOWN ? Math.max(0, rep.romDegrees || 0) / maxRom : 1 }}><i />{shortSet.has(rep.index) && i < shown && <b className="short-mark" aria-hidden="true">▾</b>}</div>)}
      </div>
      {view.level === 'beginner' && sidesLine}
      <p className="res-detail" aria-live="polite">{detailHead && <span className="sr">{detailHead}</span>}{detail}</p>
    </div>,
    // Expert: the set's concentric speed change, the report's own line (report-sheet.js).
    speed: measured && speedLine && <p key="speed" className="lv-speed" data-testid="level-speed">{speedLine}</p>,
    // Under the question (it stays on the first screen, level.js): each rep's tempo and, for a set filmed
    // from the front, its gap between sides, with the set's two ranges and what a gap means beside them.
    strips: measured && MEASURES_SHOWN && (hasStrips(reps, corrected ? null : sidesPerRep) || sidesText) && <div key="strips" className="res-strips">
      <RepStrips reps={reps} sel={sel} shown={shown} sides={corrected ? null : sidesPerRep} fr={fr} onPick={pick} markName={corrected ? i => markLabel({ index: i + 1, total: reps.length, fr, corrected }) : null} />
      {sidesLine}
    </div>,
    card: <div key="card">
      {step === 'ask' && asked && (
        <div className="glass appear" data-testid="ask-card">
          <p className="ask-q">{fr ? `C’est bien ${count}\u00A0?` : `Was it ${count}?`}</p>
          <div className="ask-row">
            <button type="button" className="btn-primary press" onClick={() => { navigator.vibrate?.(10); doSave(count, false); }}>
              <span>{fr ? 'Oui, c’est juste' : 'Yes, that’s right'}</span>
            </button>
            <button className="btn-ghost press" onClick={() => setStep('fix')}>{fr ? 'Non' : 'No'}</button>
          </div>
        </div>
      )}

      {step === 'fix' && (
        <div className="glass appear" data-testid="fix-card">
          <p className="ask-q">{fr ? 'Combien en avez-vous fait ?' : 'How many did you do?'}</p>
          <div className="stepper">
            <button className="round press" disabled={trueN <= 0} onClick={() => { setTyped(null); setTrueN(n => Math.max(0, n - 1)); }} aria-label={fr ? 'Une de moins' : 'One fewer'}>−</button>
            {/* The numeral is also a field: a tap opens the number pad and typing replaces the number, so 7 to 34
                takes three taps, not 27 (design review of 1 October). The figures stay drawn by Digits underneath.
                aria-atomic: the digits are separate nodes, so the whole number is read, not the digit that changed (review, 30 September). */}
            <span className={`stepper-n${typed !== null ? ' is-typing' : ''}`}>
              <span aria-live="polite" aria-atomic="true"><Digits text={trueN} /></span>
              {/* The field opens empty, so what is typed replaces the number wherever iOS leaves the caret (a
                  select() on focus does not hold after a tap in WebKit: review of 2 October). Until a digit is
                  typed, and if every digit is deleted, the number stays the one it opened on. */}
              <input className="stepper-in" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" enterKeyHint="done"
                aria-label={fr ? 'Nombre de répétitions' : 'Number of reps'} value={typed ?? String(trueN)}
                onFocus={() => { typedFrom.current = trueN; setTyped(''); }}
                onBlur={() => setTyped(null)}
                onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(0, 2); setTyped(d); setTrueN(d === '' ? typedFrom.current : Number(d)); }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
            </span>
            <button className="round press" disabled={trueN >= 99} onClick={() => { setTyped(null); setTrueN(n => Math.min(99, n + 1)); }} aria-label={fr ? 'Une de plus' : 'One more'}>+</button>
          </div>
          <button type="button" className="btn-primary press" onClick={() => { navigator.vibrate?.(10); doSave(trueN, true); }}>
            <span>{fr ? 'Enregistrer' : 'Save'}</span>
          </button>
        </div>
      )}

      {step === 'saved' && (
        <div className="saved appear" data-testid="saved-card">
          {trueN !== count && <p className="res-meta saved-corr">{fr ? `Compté par l’app : ${count}. Corrigé : ${trueN}.` : `Counted by the app: ${count}. Corrected: ${trueN}.`}</p>}
          <p className="saved-msg">{trueN !== count
            ? (fr ? 'Merci. Votre correction est notée sur votre téléphone.' : 'Thank you. Your correction is noted on your phone.')
            : (fr ? 'Merci. Série enregistrée sur votre téléphone.' : 'Thank you. Set saved on your phone.')}</p>
          {/* The rest begins as the set is saved: its clock runs at once, above the report and the
              challenge, since the next thing done on the bench is to rest (design pass, 29 September).
              The result screen carries no opener: its numeral and account already say it; the report does. */}
          <div className="rest-slot" ref={restRef}><RestClock fr={fr} clock={rest} /></div>
          {/* After saving, the next things done in a gym are resting and the next set: the next set leads, the
              report follows, the challenge stays as a quiet line (design review of 1 October). */}
          <button className="btn-line press" onClick={onNewSet}>{fr ? 'Nouvelle série' : 'New set'}</button>
          <button ref={reportRef} className="btn-ghost press" onClick={() => onReport(trueN, savedId.current)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3v5h5" /><path d="M8.5 13h7M8.5 16.5h5" /></svg>
            <span>{fr ? 'Rapport de séance' : 'Session report'}</span>
          </button>
          <button className="text-btn press" onClick={challenge}>{fr ? 'Défier un ami' : 'Challenge a friend'}</button>
          <p className="share-note" role="status">{shareNote}</p>
          {/* Once, after a saved set, when no level is stored: one quiet question, which nothing waits on. */}
          {showContribute && <ContributeAsk fr={fr} onYes={() => keepThis(trueN)} />}
          {offerLevel && <div className="level-ask appear" data-testid="level-ask">
            <p className="level-q" aria-hidden="true">{fr ? 'Pour adapter l’écran, quel est votre niveau ?' : 'To fit the screen to you, what is your level?'}</p>
            <LevelPick id="level-ask-label" quiet label={fr ? 'Pour adapter l’écran, quel est votre niveau ?' : 'To fit the screen to you, what is your level?'} value={chosen} onChange={chooseLevel} fr={fr} />
            {chosen && <p className="level-note" role="status">{fr ? 'C’est noté. L’écran s’adapte dès la prochaine série. Vous pouvez le changer dans l’historique.' : 'Noted. The screen adapts from your next set. You can change it in your history.'}</p>}
          </div>}
        </div>
      )}

      {saveError && <p role="alert" className="save-error">{saveError}</p>}
      {/* A set the phone could not save is still done: the rest runs all the same (review, 29 September). */}
      {saveError && step !== 'saved' && <div className="rest-slot"><RestClock fr={fr} clock={rest} /></div>}
    </div>,
    // Expert: the report's per-rep table, compact, under the question so the question stays in view.
    table: measured && table && <div key="table" className="lv-table-wrap" data-testid="level-table">
      <table className="lv-table">
        <thead><tr>{table.columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>{table.rows.map(row => <tr key={row[0]}>{row.map((v, k) => <td key={k}>{v}</td>)}</tr>)}</tbody>
      </table>
      <p className="lv-units">{fr ? 'Tempo\u00A0: descente-pause-montée-pause, en secondes. Pic et Moy.\u00A0: vitesse angulaire, en °/s.' : 'Tempo: lowering-pause-lifting-pause, in seconds. Peak and Mean: angular speed, in °/s.'}</p>
    </div>,
    account: measured && <div key="account" className="set-account appear" data-testid="set-account">
      {plain}
      {more}
    </div>,
    // Beginner: the account and the tip lead, from the first frame.
    plain: count > 0 && <div key="plain" className="set-account" data-testid="set-account">{plain}</div>,
    more: measured && <div key="more" className="set-account acc-more appear">{more}</div>,
  };
  // Under the report, the result is out of reach of taps, the keyboard and screen readers.
  return <div className="wv-experience" ref={rootRef} inert={covered ? true : undefined}>
    <section className={`screen is-active result-screen lv-${view.level}${step === 'saved' ? ' is-saved' : ''}`} data-level={view.level}><div className="wrap">
      <Topbar fr={fr} onClose={onClose} onReplay={onReplay} replayRef={replayRef} badge={false} />
      <div className="res-head" data-reveal style={{ '--i': 0 }}>
        <p className="eyebrow">{liftName}</p>
        <div className="res-sub">
          {tierOf(lift) && <p className={`tier tier-${tierOf(lift)}`}>{tierLabel(tierOf(lift), fr)}</p>}
          <p className="res-meta">{seconds ? `${seconds} s · ${armLabel}` : armLabel}</p>
        </div>
      </div>
      {resultBlocks(view.level).map(b => blocks[b] || null)}
      {/* The support links come after what the app measured (critic, 30 September). */}
      {report && <ReportCount fr={fr} report={report} />}
    </div></section>
  </div>;
}

// Every result offers a report of its count, a refused one and one whose save failed included
// (PLAN.md, GROWTH, step 1): by e-mail, or as a GitHub issue for users who have an account.
function ReportCount({ fr, report }) {
  return <p className="report-count" data-testid="report-count">
    <span>{fr ? 'Signaler ce comptage' : 'Report this count'}</span>
    <a className="text-btn" href={reportEmailUrl(report)}>{fr ? 'Par e-mail' : 'By email'}</a>
    <a className="text-btn" href={reportIssueUrl(report)} target="_blank" rel="noreferrer">{fr ? 'Sur GitHub' : 'On GitHub'}</a>
  </p>;
}
