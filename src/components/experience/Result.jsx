import { useState, useEffect, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { topPose } from './lift-scenes';
import { exerciseName } from './exercise-info';
import { Body, mapPose, DPR, LITE } from './entry-scene';
import { addLayer, presence } from './stage-loop';
import { saveWorkout } from '../../lib/storage';
import { askToKeep } from '../../lib/keep-sets';
import { contribution, contributeAsks, keepContribution, markContributeAsked, readChoice, shouldAskContribute } from '../../lib/contribute';
import ContributeAsk from './ContributeAsk';
import { contributeBuild } from '../../lib/buildFlags';
import { warmReportPdf } from './Report';
import { refreshSets, loadSets, knownSets } from './sets';
import { setAccount } from './set-account';
import RestClock from './RestClock';
import Digits from './Digits';
import { restClock } from './rest-clock';
import { NOTES } from './set-notes';
import { decimal, measureGuide, repTable, speedChangeLine } from './report-sheet';
import { MeasureGuide } from './measure-guide';
import { partialIn, setAverages } from './tempo';
import RepWave from './RepWave';
import { waveAngles } from './wave';
import { savedSet } from './saved-set';
import { momentLine } from './moment';
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
import { track } from '../../lib/events';

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
// The analysis stopped before a count. Three causes, each said as it is (David's iPhone, 4 October: one screen said
// "could not read" for all of them, with no way to try again or to say what happened):
//   the pose model did not start (reload); the phone read the video frozen, its pictures or skeletons repeating
//   (FrozenReadError, FrozenSkeletonsError: try the analysis again, screen on); any other failure of the read.
// Every case offers the report, with the failure's name, message and decoder, so the cause reaches David.
export function AnalysisError({ lift, phase, failure = null, onClose, onRestart, onRefilm }) {
  const { lang } = useT(), fr = lang === 'fr';
  const model = phase === 'model';
  const frozen = !model && /^Frozen/.test(failure?.name || '');
  const title = model
    ? (fr ? 'L’analyse n’a pas pu démarrer.' : 'The analysis could not start.')
    : frozen
      ? (fr ? 'Le téléphone a mal lu cette vidéo.' : 'The phone did not read this video properly.')
      : (fr ? 'Nous n’avons pas pu lire cette vidéo.' : 'We could not read this video.');
  const body = model
    ? (fr ? 'Rechargez la page, puis réessayez.' : 'Reload the page, then try again.')
    : frozen
      ? (fr ? 'Les images sont restées figées pendant la lecture, donc aucun compte n’est affiché. Relancez l’analyse en gardant l’écran allumé.' : 'The pictures stayed frozen while the video was read, so no count is shown. Start the analysis again and keep the screen on.')
      : (fr ? 'Relancez l’analyse, ou filmez à nouveau avec l’appareil photo.' : 'Start the analysis again, or record again with the camera.');
  const report = failure && !model ? { lift, liftName: exerciseName(lift, lang), counted: null, userCount: null, version: appVersion(), fr, decoder: failure.decoder || '', failure: `${failure.name}: ${failure.message}` } : null;
  return <div className="wv-experience">
    <section className="screen is-active result-screen"><div className="wrap">
      <Topbar fr={fr} onClose={onClose} />
      <p className="eyebrow refused-eyebrow" data-reveal style={{ '--i': 0 }}>{exerciseName(lift, lang)}</p>
      <h2 className="title refused-title" data-reveal style={{ '--i': 1 }}>{title}</h2>
      <p className="body-text" data-reveal style={{ '--i': 2 }}>{body}</p>
      <div className="actions result-actions" data-reveal style={{ '--i': 4 }}>
        {/* The model failed to start: the words ask for a reload, so the screen offers it (audit of 2 October). */}
        {model
          ? <>
            <button className="btn-primary press" onClick={() => window.location.reload()}>{fr ? 'Recharger la page' : 'Reload the page'}</button>
            <button className="btn-ghost press" onClick={onRefilm}>{fr ? 'Refilmer' : 'Record again'}</button>
          </>
          : <>
            {onRestart && <button className="btn-primary press" onClick={onRestart} data-testid="error-restart">{fr ? 'Relancer l’analyse' : 'Start the analysis again'}</button>}
            <button className={`${onRestart ? 'btn-ghost' : 'btn-primary'} press`} onClick={onRefilm}>{fr ? 'Refilmer' : 'Record again'}</button>
          </>}
      </div>
      {report && <ReportCount fr={fr} report={report} />}
    </div></section>
  </div>;
}

// What was read, without naming a cause the app cannot see (review 01 of the partial-read fix).
// Samples out of time order were read again from an earlier point: the "read twice" line, never "NaN %" (third audit, C08).
function partialLine(read, expected, fr, disordered) {
  const share = expected && Number.isFinite(read) ? Math.round((Math.min(read, expected) / expected) * 100) : null;
  if (disordered || (expected && read > expected)) return fr ? 'Une partie de la vidéo a été lue deux fois. Nous n’affichons pas un compte faux. Recommencez l’analyse.' : 'Part of the video was read twice. We do not show a wrong count. Start the analysis again.';
  return share === null
    ? (fr ? 'La durée de la vidéo n’a pas pu être lue. Nous n’affichons pas un compte incertain. Recommencez l’analyse.' : 'The length of the video could not be read. We do not show an uncertain count. Start the analysis again.')
    : (fr ? `Seuls ${share}\u00A0% de la vidéo ont été analysés. Nous n’affichons pas un compte partiel. Recommencez l’analyse.` : `Only ${share}% of the video was analysed. We do not show a partial count. Start the analysis again.`);
}

// Shown when the phone read only part of the video: no count, since it would be the count of part
// of the set (29 September: 181 of 439 samples read, 2 of 10 reps counted).
export function AnalysisIncomplete({ lift, read, expected, disordered = false, decoder, onClose, onRestart, onRefilm }) {
  const { lang } = useT(), fr = lang === 'fr';
  return <div className="wv-experience">
    <section className="screen is-active result-screen"><div className="wrap">
      <Topbar fr={fr} onClose={onClose} />
      <p className="eyebrow refused-eyebrow" data-reveal style={{ '--i': 0 }}>{exerciseName(lift, lang)}</p>
      <h2 className="title refused-title" data-reveal style={{ '--i': 1 }}>{fr ? 'La vidéo n’a pas été lue en entier.' : 'The video was not read in full.'}</h2>
      <p className="body-text" data-reveal style={{ '--i': 2 }}>{partialLine(read, expected, fr, disordered)}</p>
      <div className="actions result-actions" data-reveal style={{ '--i': 4 }}>
        <button className="btn-primary press" onClick={onRestart}>{fr ? 'Recommencer l’analyse' : 'Start the analysis again'}</button>
        <button className="btn-ghost press" onClick={onRefilm}>{fr ? 'Choisir une autre vidéo' : 'Choose another video'}</button>
      </div>
      <ReportCount fr={fr} report={{ lift, liftName: exerciseName(lift, lang), counted: null, userCount: null, partial: true, version: appVersion(), fr, decoder, read: { read, expected, disordered } }} />
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
 * liveShown: for a set counted live (LiveSession.jsx), the last count the live screen showed, or null.
 */
export default function Result({ result, lift, covered, onClose, onReport, onReplay, onNewSet, onChangeLift = onClose, onRefilm, onSaved = () => {}, liveShown = null }) {
  const { lang } = useT(), fr = lang === 'fr';
  const reduced = useRef(REDUCED()).current;
  // A set the counter did not refuse but found no rep in is not a measured 0 (R8): the app cannot tell an
  // empty set from reps it missed. The screen asserts no number, no measure and no mark, and opens on the
  // question "How many did you do?"; the set is saved with the app's 0 beside the person's count, as a
  // correction (3 October 2026). Status: convention, from R8.
  const unsure = !result.refused && result.count === 0;
  const [step, setStep] = useState(unsure ? 'fix' : 'ask'); // ask | fix | saved
  // The button tapped goes with its card ("Non", "Enregistrer"): focus follows to the new card's first words, so
  // VoiceOver and the keyboard are not left on nothing (second audit, 3 October). Only when focus was lost.
  const cardRef = useRef(null), firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) { firstStep.current = false; return; }
    const a = document.activeElement;
    if (a && a !== document.body && document.contains(a)) return;
    const target = cardRef.current?.querySelector('.ask-q, .saved-msg, .saved-corr');
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true, focusVisible: false });
  }, [step]);
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
  // Leaving a counted set not yet saved asks first (WP1.4 of docs/SPEC-production.md): the close button and the
  // browser's back (Safari's edge swipe) both lead here, so a set is never lost by a slip of the thumb.
  const [closing, setClosing] = useState(false);
  const unsaved = step !== 'saved' && !result.refused;
  // A set the app counted none in, with no number typed yet, holds nothing to keep: closing it asks nothing.
  const empty = unsure && step === 'fix' && trueN === 0;
  const emptyRef = useRef(empty);
  emptyRef.current = empty;
  const unsavedRef = useRef(unsaved);
  unsavedRef.current = unsaved;
  // While the question is open, the close button takes it back to the count's question: a slip undone in one tap.
  const askClose = () => {
    if (unsavedRef.current && !emptyRef.current) setClosing(c => !c);
    else release().then(onClose);
  };
  // The question takes focus and comes into view as it opens, for VoiceOver, the keyboard and a short screen.
  useEffect(() => {
    if (!closing || covered) return;
    const q = document.getElementById('close-q');
    q?.scrollIntoView({ block: 'center', behavior: 'auto' });
    q?.focus({ preventScroll: true, focusVisible: false });
  }, [closing, covered]);
  // Back is held by one extra history entry at the same address while the set is unsaved: going back takes that
  // entry and stays on the result, where the question opens; the entry is put back for the next swipe. A change of
  // address made by the app itself (another screen) is not a back, and is let through.
  // Once the set is saved, or the person leaves by the card, the extra entry is taken back, so the history holds no
  // dead step; whatever moves on (a new set, the choice) waits for that. A browser that skips the entry (some skip
  // entries added without a tap) goes back as it did before this guard: no worse, and the close button still asks.
  const guard = useRef({ here: null, off: false, pending: Promise.resolve() });
  const release = () => {
    const g = guard.current;
    if (g.off) return g.pending;
    if (typeof history === 'undefined' || !history.state?.wvResult || location.href !== g.here) return g.pending;
    g.off = true;
    g.pending = new Promise(done => {
      let t = 0;
      const end = () => { clearTimeout(t); window.removeEventListener('popstate', end); done(); };
      window.addEventListener('popstate', end);
      t = setTimeout(end, 500);
      history.back();
    });
    return g.pending;
  };
  const released = () => release();
  useEffect(() => {
    if (!unsaved || typeof history === 'undefined') return undefined;
    const g = guard.current;
    g.here = location.href; g.off = false;
    history.pushState({ wvResult: true }, '', g.here);
    const onPop = () => {
      if (g.off || location.href !== g.here || !unsavedRef.current) return;
      // Nothing to keep: the back goes on, as the person asked.
      if (emptyRef.current) { g.off = true; history.back(); return; }
      history.pushState({ wvResult: true }, '', g.here);
      setClosing(true);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // Saved in place: the entry goes now. Left for another screen: the address has changed and nothing is undone.
      release();
    };
  }, [unsaved]); // eslint-disable-line react-hooks/exhaustive-deps
  // Every way on from the result waits for the entry to be taken back first.
  const after = fn => (...a) => guard.current.pending.then(() => fn(...a));
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
  // One rep's line: its name (spoken, not printed: the lit mark shows it) and its measures.
  const repText = i => {
    const r = reps[i];
    const filmed = fr ? (corrected ? 'filmé en partie' : 'filmée en partie') : 'partly filmed';
    // After a correction the marks are the app's, not the saved set's reps: they are named so (replay-labels.js).
    const word = corrected ? markLabel({ index: i + 1, total: reps.length, fr, corrected }) : `${fr ? 'Rép.' : 'Rep'} ${i + 1}`;
    // "Repère" is masculine, "répétition" feminine: the clipped note agrees with the word before it.
    if (!MEASURES_SHOWN) return { head: '', body: `${word}${r.clipped ? `${NB}· ${filmed}` : ''}` };
    return { head: `${word} · `, body: r.clipped
      ? `${Math.round(r.romDegrees)}°${NB}· ${filmed}`
      : partialIn(reps)(r)
      ? `${Math.round(r.romDegrees)}°${NB}· ${fr ? (corrected ? 'partiel, non chronométré' : 'partielle, non chronométrée') : 'partial, not timed'}`
      : `${sec(r.endTime - r.startTime)}${NB}· ${Math.round(r.romDegrees)}°${NB}· conc.${NB}${sec(r.concentricSec)}${NB}· ${fr ? 'exc.' : 'ecc.'}${NB}${sec(r.eccentricSec)}` };
  };
  let detail = '', detailHead = '';
  if (sel >= 0 && reps[sel]) {
    ({ head: detailHead, body: detail } = repText(sel));
  } else if (MEASURES_SHOWN && (asked || step !== 'ask') && whole.length) {
    const { rom, dur } = setAverages(reps);
    // The joint whose angle is measured is named, so a range is never read as another joint's (design review,
    // 2 October: 64° read as shoulder flexion on a press). jointName (lift-meta.js).
    detail = fr ? `Amplitude moyenne ${jointName(liftDefinition(lift)?.joint, true)}${NB}: ${Math.round(rom)}°${dur === null ? '' : `${NB}· durée moyenne ${sec(dur)}`}` : `Average ${jointName(liftDefinition(lift)?.joint, false)} range: ${Math.round(rom)}°${dur === null ? '' : `${NB}· average duration ${sec(dur)}`}`;
  }
  // Step 3: the account of the set, one tip and a word of encouragement (set-account.js). The sets of
  // this exercise already saved give the last set's reps and this set's rank once it is saved.
  const mine = list => (list || []).filter(w => (w.exercise || w.exerciseKey) === lift);
  // Unknown (null) until read; a failed read is tried again once the set is saved, and until then the
  // screen states no rank and no comparison rather than a false one (review 01 of step 3).
  const [before, setBefore] = useState(() => { const k = knownSets(); return k ? mine(k) : null; });
  useEffect(() => { let live = true; loadSets().then(l => { if (live) setBefore(b => b ?? mine(l)); }, () => {}); return () => { live = false; }; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Once saved: the one earned line, a record, a record equalled or a first set (moment.js), above the thanks.
  const moment = step === 'saved' ? momentLine({ n: trueN, before, fr }) : null;
  const account = setAccount({ reps, first: liftDefinition(lift)?.first, fr, name: liftName, count: trueN, corrected: step === 'saved' && isCorrected(trueN, count), previous: before?.length ? before[0].reps : null, nth: before ? before.length + 1 : null });
  const shortSet = new Set(account.short);
  // The level read as the screen opens (level.js); the expert's table and speed line are the report's own,
  // its first column headed Repère after a correction, as the report heads it (third audit C11).
  const [view] = useState(() => levelView(readLevel()));
  const perRep = view.perRep && MEASURES_SHOWN ? { table: repTable({ reps, first: liftDefinition(lift)?.first, fr, corrected }), speed: SPEED_CHANGE_SHOWN ? speedChangeLine(reps, fr) : '' } : null;
  const table = perRep?.table, speedLine = perRep?.speed || '';
  // The question on the level: offered once, after a saved set, when none is stored.
  const [levelBefore] = useState(() => ({ level: readLevel(), asked: levelAsked() }));
  const [chosen, setChosen] = useState('');
  // A refused set typed by hand shows neither question, so neither is spent on it (review of 4 October).
  const offerLevel = !result.refused && shouldAskLevel({ step, ...levelBefore });
  useEffect(() => { if (offerLevel) markLevelAsked(); }, [offerLevel]);
  // Whether to help improve the count: asked on the saved card of the first set, and once more from the fifth when
  // left unanswered, never after a yes or a no (contribute.js shouldAskContribute). Decided once the sets on the
  // phone are read after the save; shown is asked.
  const [contributeAt, setContributeAt] = useState(null); // the sets on the phone when it is asked
  const showContribute = !result.refused && step === 'saved' && contributeAt !== null;
  useEffect(() => { if (showContribute) markContributeAsked(contributeAt); }, [showContribute]); // eslint-disable-line react-hooks/exhaustive-deps
  // "Noted" only when the phone stored it (audit of 2 October); otherwise the screen says it was not kept.
  const [levelLost, setLevelLost] = useState(false);
  function chooseLevel(l) { setLevelLost(!writeLevel(l)); setChosen(l); }
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
    if (result.refused || unsure) return undefined;
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
  // True once kept; a write the phone refuses is never taken for a kept set (audit of 2 October).
  const keepThis = n => keepContribution(contribution({ result, lift, kept: n, setId: savedId.current, appVersion: appVersion() }))
    .then(() => true, e => { console.warn('[contribute] this set could not be kept', e); return false; });

  async function doSave(n, corrected, manual = false) {
    if (saving.current) return false;
    saving.current = true;
    // The rest begins at the first attempt to save; a retry leaves the clock as the user left it.
    if (!restBegun.current) { restBegun.current = true; rest.start(); }
    try {
      savedId.current = await saveWorkout(savedSet({ result, lift, n, corrected, sides, manual }));
      refreshSets();
      // A set is now worth keeping: the browser is asked to keep the app's storage (keep-sets.js; a no-op once kept).
      askToKeep();
      // With the person's yes, this set is kept as a contribution: counts, pose, decoder, phone kind (contribute.js).
      // A build without VITE_CONTRIBUTE keeps none and never asks: contributions are paused (buildFlags.js, WP0.4).
      if (!manual && corrected !== null && contributeBuild() && readChoice() === 'yes') keepThis(n); // a typed or unanswered count is no label of the app's read
      // The sets were never read: read them now, the one just saved first, and count the others.
      if (before === null) loadSets().then(l => setBefore(b => b ?? mine(l).slice(1)), () => {});
      // The question on helping, from the number of sets now on the phone; unread, it is not asked.
      if (contributeBuild()) loadSets().then(l => {
        if (shouldAskContribute({ choice: readChoice(), ...contributeAsks(), saved: l.length })) setContributeAt(c => c ?? l.length);
      }, () => {});
      setSaveError(''); // a retry that saves takes back "not saved"
      if (!manual) track(isCorrected(n, count) ? 'result_corrected' : 'result_kept', { lift });
      setStep('saved');
      if (!manual) onSaved(n, n === count ? sides : null); // the replay states the saved count beside the detected marks; the report reads the comparison
      warmReportPdf().catch(() => {}); // the report screen says so if it could not load
      return true;
    } catch {
      setSaveError(fr ? 'Résultat affiché, mais non enregistré.' : 'Result shown, but could not save it.');
      return false;
    } finally { saving.current = false; }
  }

  // "Garder": the set is saved as the screen stands (the app's count while it asks, the typed count once corrected),
  // then the screen closes as the person wanted. With no count to save (the app counted none and nothing is typed
  // yet), the question on the number opens instead. "Ne pas garder": the screen closes and nothing is saved.
  // The question names the number ("Garder ces 4 répétitions ?"), in place of "C'est bien 4 ?": keeping it is the
  // person's answer to both, so the set is saved as confirmed, or as corrected when the number was typed.
  async function keepAndClose() {
    if (saving.current) return;
    if (step === 'fix' && unsure && trueN === 0) {
      setClosing(false);
      // Nothing to keep yet: the question on the number takes focus, as the card it stands in.
      requestAnimationFrame(() => {
        const q = cardRef.current?.querySelector('[data-testid="fix-card"] .ask-q');
        if (q) { if (!q.hasAttribute('tabindex')) q.setAttribute('tabindex', '-1'); q.focus({ preventScroll: false, focusVisible: false }); }
      });
      return;
    }
    if (await doSave(step === 'fix' ? trueN : count, step === 'fix')) { setClosing(false); await released(); onClose(); }
  }
  async function discardAndClose() {
    if (saving.current) return; // a save already under way finishes; the card stays until it does
    setClosing(false);
    await released();
    onClose();
  }

  // The challenge opens the phone's share sheet inside the tap, with the result and a link to the
  // app; where the sheet is missing or refuses the message, the message is copied for the user to paste.
  function challenge() {
    const data = challengeShare({ liftName, count: trueN, counted: count, fr, url: new URL(import.meta.env.BASE_URL, location.origin).href });
    setShareNote('');
    track('share', { lift });
    shareChallenge(data, { share: navigator.share ? d => navigator.share(d) : null, clipboard: navigator.clipboard }).then(out => {
      if (out === 'copied') setShareNote(fr ? 'Message copié. Collez-le dans une conversation.' : 'Message copied. Paste it into a chat.');
      else if (out === 'unavailable') setShareNote(fr ? 'Le partage n’est pas disponible dans ce navigateur.' : 'Sharing is not available in this browser.');
    });
  }
  // What the phone read, for the report: the decoder and the samples read out of the video's.
  const read = { read: result.timestamps?.length ?? null, expected: Number.isFinite(result.metadata?.duration) ? Math.floor(result.metadata.duration * TARGET_FPS) : null };
  const report = reportFor({ lift, liftName, count, trueN, version: appVersion(), fr, refused: !!result.refused, step, saveError, decoder: result.metadata?.method || '', read });

  // The question "How many did you do?" with its stepper: after a "No", for a set the app counted none in, and,
  // as "Saisir mon nombre", for a set the app refused (manual: saved as typed by hand, WP1.6).
  const fixCard = manual => (
        <div className="glass appear" data-testid="fix-card">
          <p className="ask-q">{fr ? 'Combien en avez-vous fait\u00A0?' : 'How many did you do?'}</p>
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
          {/* With no count from the app, the person's own count is saved, never the 0 the stepper opens on. */}
          <button type="button" className="btn-primary press" disabled={(unsure || manual) && trueN === 0} onClick={() => { if ((unsure || manual) && trueN === 0) return; navigator.vibrate?.(10); doSave(trueN, true, manual); }}>
            <span>{fr ? 'Enregistrer' : 'Save'}</span>
          </button>
        </div>
  );

  if (result.refused) {
    const text = why.cause === 'nobody'
      ? (result.metadata?.live ? (fr ? 'Personne n’apparaît à l’image.' : 'We could not find you in the picture.') : (fr ? 'Personne n’apparaît dans la vidéo.' : 'We could not find you in the video.'))
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
        <Topbar fr={fr} onClose={onClose} onReplay={onReplay} replayRef={replayRef} badge={false} />
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
          {/* One button: "Choisir une autre vidéo" beside it did the same, back to Film (third audit C14, 3 October). */}
          <button className="btn-primary press" onClick={onRefilm}>{fr ? 'Refilmer' : 'Record again'}</button>
          {/* The set is done all the same: the person may log it by hand, saved as theirs, with no count of the app
              (WP1.6 of docs/SPEC-production.md). The stepper opens on 0, never on the count the app refused (R8). */}
          {step === 'ask' && <button className="btn-ghost press" data-testid="manual-open" onClick={() => { setTyped(null); setTrueN(0); setStep('fix'); }}>{fr ? 'Saisir mon nombre' : 'Enter my count'}</button>}
        </div>
        <div ref={cardRef}>
          {step === 'fix' && fixCard(true)}
          {step === 'saved' && <div className="saved appear" data-testid="saved-card">
            <p className="saved-msg">{fr ? `Merci. ${trueN} ${trueN > 1 ? 'répétitions enregistrées, saisies' : 'répétition enregistrée, saisie'} à la main.` : `Thank you. ${trueN} ${trueN === 1 ? 'rep' : 'reps'} saved, typed by hand.`}</p>
            <div className="rest-slot" ref={restRef}><RestClock fr={fr} clock={rest} /></div>
            <button className="btn-line press" onClick={after(onNewSet)} data-testid="new-set">{fr ? 'Nouvelle série' : 'New set'}</button>
            <button className="text-btn press" onClick={after(onChangeLift)} data-testid="change-lift">{fr ? 'Changer d’exercice' : 'Change exercise'}</button>
          </div>}
          {saveError && <p role="alert" className="save-error">{saveError}</p>}
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
    // No count to show: the words of the refused screen, and the question below them (unsure, above).
    count: unsure && step !== 'saved' ? <h2 key="count" className="title refused-title" data-testid="res-uncounted">{fr ? 'Nous n’avons pas pu compter cette série.' : 'We could not count this set.'}</h2> : <div key="count" className="res-count">
      <span key={big} className="numeral tick" aria-hidden="true" data-testid="res-numeral">{big}</span>
      <p className="res-label">{fr ? (one ? 'Répétition' : 'Répétitions') : (big === 1 ? 'Rep' : 'Reps')}{result.test ? (fr ? ` en ${result.test.windowSec}\u00A0secondes` : ` in ${result.test.windowSec} seconds`) : ''}</p>
      {/* A fitness test whose video ends before its window: the score is of what was filmed (fitness-tests.js). */}
      {result.test && !result.test.complete && <p className="res-meta res-test-short" data-testid="res-test-short">{result.metadata?.live
        ? (fr ? `La série s’arrête avant les ${result.test.windowSec}\u00A0secondes\u00A0: le score ne porte que sur ce qui a été filmé.` : `The set stops before ${result.test.windowSec} seconds: the score covers only what was filmed.`)
        : (fr ? `La vidéo s’arrête avant les ${result.test.windowSec}\u00A0secondes\u00A0: le score ne porte que sur ce qui a été filmé.` : `The video ends before ${result.test.windowSec} seconds: the score covers only what was filmed.`)}</p>}
      {/* A live set: the count shown during the set was the core on the set so far; this one is the core on all of it
          (liveCounter.js). When they differ the screen says so, so the number heard during the set is not taken for a
          second measure. Not shown for a set the app could not count: that screen asserts no number (R8). */}
      {liveShown !== null && count > 0 && liveShown !== count && <p className="res-meta res-live" data-testid="res-live">{fr
        ? `En direct, l’app affichait ${liveShown}. Le compte final relit toute la série.`
        : `Live, the app showed ${liveShown}. The final count reads the whole set again.`}</p>}
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
      {/* VoiceOver on iPhone cannot move through the marks (they answer arrow keys and taps): every rep's line is
          also in a list read in order, with the label of the measures before it (second audit, 3 October). */}
      {asked && <ol className="sr" data-testid="res-reps-sr">{reps.map((_, i) => { const t = repText(i); return <li key={i}>{t.head}{t.body}</li>; })}</ol>}
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
    // The measured angle over the set, each rep over it (RepWave.jsx), for every level: what was measured, drawn.
    wave: MEASURES_SHOWN && count > 0 && result.smoothedAngles?.length > 1 && <div key="wave" className="res-wave">
      <RepWave angles={waveAngles(result)} timestamps={result.timestamps} reps={reps} rest={liftDefinition(lift)?.rest} first={liftDefinition(lift)?.first} sel={sel} shown={shown} fr={fr} jointWord={jointName(liftDefinition(lift)?.joint, fr)} onSelect={setSel} />
    </div>,
    card: <div key="card" ref={cardRef}>
      {closing && unsaved && (
        <div className="glass appear" data-testid="close-card" role="group" aria-labelledby="close-q">
          <p className="ask-q" id="close-q" tabIndex={-1}>{(() => {
            const n = step === 'fix' ? trueN : count;
            const what = fr ? (n > 1 ? `ces ${n} répétitions` : n === 1 ? 'cette répétition' : 'cette série') : (n > 1 ? `these ${n} reps` : n === 1 ? 'this rep' : 'this set');
            return fr ? `Garder ${what}\u00A0?` : `Keep ${what}?`;
          })()}</p>
          <div className="ask-row">
            <button type="button" className="btn-primary press" onClick={keepAndClose} data-testid="close-keep">
              <span>{fr ? 'Garder' : 'Keep'}</span>
            </button>
            <button type="button" className="btn-ghost press" onClick={discardAndClose} data-testid="close-discard">{fr ? 'Ne pas garder' : 'Don’t keep'}</button>
          </div>
        </div>
      )}
      {/* One question at a time: while the close question is open it stands where the other question stood. */}
      {step === 'ask' && asked && !closing && (
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

      {step === 'fix' && !(closing && unsaved) && fixCard(false)}
      {step === 'saved' && (
        <div className="saved appear" data-testid="saved-card">
          {trueN !== count && <p className="res-meta saved-corr">{fr ? `Compté par l’app\u00A0: ${count}. Corrigé\u00A0: ${trueN}.` : `Counted by the app: ${count}. Corrected: ${trueN}.`}</p>}
          {moment && <p className={`moment is-${moment.kind}`} data-testid="moment" role="status">{moment.text}</p>}
          <p className="saved-msg">{trueN !== count
            ? (fr ? 'Merci. Votre correction est notée sur votre téléphone.' : 'Thank you. Your correction is noted on your phone.')
            : (fr ? 'Merci. Série enregistrée sur votre téléphone.' : 'Thank you. Set saved on your phone.')}</p>
          {/* The rest begins as the set is saved: its clock runs at once, above the report and the
              challenge, since the next thing done on the bench is to rest (design pass, 29 September).
              The result screen carries no opener: its numeral and account already say it; the report does. */}
          <div className="rest-slot" ref={restRef}><RestClock fr={fr} clock={rest} /></div>
          {/* After saving, the next things done in a gym are resting and the next set: the next set leads, the
              report follows, the challenge stays as a quiet line (design review of 1 October). */}
          {/* A gym session is several sets of one lift: the next set goes straight back to filming this lift, and
              changing lift is the quieter choice beside it (WP1.3 of docs/SPEC-production.md). */}
          {/* Once saved, the next set is the one thing left to do: it takes the gold, so the screen keeps one clear
              action after the question goes (design pass of 4 October). */}
          <button className="btn-primary press" onClick={after(onNewSet)} data-testid="new-set">{fr ? 'Nouvelle série' : 'New set'}</button>
          <button className="text-btn press" onClick={after(onChangeLift)} data-testid="change-lift">{fr ? 'Changer d’exercice' : 'Change exercise'}</button>
          <button ref={reportRef} className="btn-ghost press" onClick={() => onReport(trueN, savedId.current)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3v5h5" /><path d="M8.5 13h7M8.5 16.5h5" /></svg>
            <span>{fr ? 'Rapport de séance' : 'Session report'}</span>
          </button>
          <button className="text-btn press" onClick={challenge}>{fr ? 'Défier un ami' : 'Challenge a friend'}</button>
          <p className="share-note" role="status">{shareNote}</p>
          {/* After the first saved set (and once more from the fifth): one quiet question, which nothing waits on. */}
          {showContribute && <ContributeAsk fr={fr} onYes={() => keepThis(trueN)} />}
          {/* Once, after a saved set, when no level is stored. */}
          {offerLevel && <div className="level-ask appear" data-testid="level-ask">
            <p className="level-q" aria-hidden="true">{fr ? 'Pour adapter l’écran, quel est votre niveau\u00A0?' : 'To fit the screen to you, what is your level?'}</p>
            <LevelPick id="level-ask-label" quiet label={fr ? 'Pour adapter l’écran, quel est votre niveau\u00A0?' : 'To fit the screen to you, what is your level?'} value={chosen} onChange={chooseLevel} fr={fr} />
            {chosen && <p className="level-note" role="status">{levelLost
              ? (fr ? 'Votre niveau n’a pas pu être enregistré sur ce téléphone.' : 'Your level could not be saved on this phone.')
              : (fr ? 'C’est noté. L’écran s’adapte dès la prochaine série. Vous pouvez le changer dans Vos séries.' : 'Noted. The screen adapts from your next set. You can change it in Your sets.')}</p>}
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
      <div className="lv-units" data-testid="level-legend"><MeasureGuide guide={measureGuide(fr)} tut={false} /></div>
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
      <Topbar fr={fr} onClose={askClose} onReplay={onReplay} replayRef={replayRef} badge={false} />
      <div className="res-head" data-reveal style={{ '--i': 0 }}>
        <p className="eyebrow">{liftName}</p>
        <div className="res-sub">
          {tierOf(lift) && <p className={`tier tier-${tierOf(lift)}`}>{tierLabel(tierOf(lift), fr)}</p>}
          <p className="res-meta">{seconds ? `${seconds}\u00A0s · ${armLabel}` : armLabel}</p>
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
