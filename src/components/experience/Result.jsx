import { useState, useEffect, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { exerciseName, filmView } from './exercise-info';
import { saveWorkout } from '../../lib/storage';
import { askToKeep } from '../../lib/keep-sets';
import { contribution, contributeAsks, keepContribution, markContributeAsked, readChoice, shouldAskContribute } from '../../lib/contribute';
import ContributeAsk from './ContributeAsk';
import { contributeBuild } from '../../lib/buildFlags';
import { warmReportPdf } from './Report';
import { refreshSets, loadSets, knownSets } from './sets';
import { setAccount } from './set-account';
import RestClock from './RestClock';
import { restClock } from './rest-clock';
import { NOTES } from './set-notes';
import { decimal, measureGuide, repTable, speedChangeLine } from './report-sheet';
import { MeasureGuide } from './measure-guide';
import { partialIn, setAverages } from './tempo';
import RepWave from './RepWave';
import { referenceBand } from '../../lib/reference-ranges';
import { waveAngles } from './wave';
import { savedSet } from './saved-set';
import { InstallSuggest } from './Install';
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
import { collectOn, collectThisSet } from '../../lib/phoneCollect';
import { RESULT } from './result-copy';
import { dayPlan, planRows, quickKeys } from './result-plan';

const REDUCED = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
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
// Whether a flagged set offers the spec-guided count beside the app's (see `second` below). Status: off, measured.
const OFFER_BODY_SECOND = false;

export default function Result({ result, lift, videoFile = null, covered, onClose, onReport, onReplay, onNewSet, onChangeLift = onClose, onRefilm, onSaved = () => {}, liveShown = null, planned = null }) {
  const { lang } = useT(), fr = lang === 'fr';
  const reduced = useRef(REDUCED()).current;
  // A set the counter did not refuse but found no rep in is not a measured 0 (R8): the app cannot tell an
  // empty set from reps it missed. The screen asserts no number, no measure and no mark, and opens on the
  // question "How many did you do?"; the set is saved with the app's 0 beside the person's count, as a
  // correction (3 October 2026). Status: convention, from R8.
  const unsure = !result.refused && result.count === 0;
  // Low confidence (screen 05b of the final direction, C4 of the design review of 7 October 2026): the app's own
  // signals only, no new threshold. A refused set, a set counted none in, or a live set whose final count is not the
  // one the live screen showed. The screen then shows no number, no gold and no measure until the person gives
  // their count ("–", quick keys centred on the plan, none chosen). Status: convention, from R8.
  const liveDiffers = !result.refused && liveShown !== null && result.count > 0 && liveShown !== result.count;
  // A counted set whose joint disagrees with the rest of the body (counting/bodyCheck.js, coreAnalysis.js
  // withBodyCheck; 8 October 2026): its count opens the slot as one to confirm, with no grade and no measure (R8, before
  // the save and after it: showMeasures), and the spec-guided count beside it when it differs, both labelled; nothing
  // is saved until the person confirms or changes the number. Status: experimental (test/real-phone/accuracy/body-check.txt).
  const flagged = !result.refused && result.count > 0 && result.bodyCheck?.flagged === true;
  // The spec-guided count is not offered beside it (8 October 2026): on the real-world sets it flags (public build halves,
  // RepCount-A, David's sets) it was right 7 times in 79 where offered, the app's own count 19 times on the same sets
  // (test/real-phone/accuracy/body-check.txt). It stays in result.bodyCheck.second and the saved set, to be measured.
  const second = OFFER_BODY_SECOND && flagged && Number.isInteger(result.bodyCheck.second?.count) && result.bodyCheck.second.count > 0 && result.bodyCheck.second.count !== result.count ? result.bodyCheck.second.count : null;
  const low = !!result.refused || unsure || liveDiffers || flagged;
  // A refused set may carry PSC's count (coreAnalysis.js, withProposal; 8 October 2026): the slot opens on it, labelled
  // "Proposition de l'appli", and nothing is saved until the person confirms or changes it (R8: a number to confirm,
  // never a silent count, no grade, no measure). Status: validated on the bench (TRIED.md, 8 October).
  const proposal = result.refused && Number.isInteger(result.proposal?.count) && result.proposal.count > 0 ? result.proposal.count : null;
  // The numbers of the app the person may confirm as they stand: the proposal, or a flagged set's two counts.
  const offeredBy = n => n > 0 && (n === proposal || (flagged && (n === result.count || n === second)));
  const c = RESULT[fr ? 'fr' : 'en'];
  const [step, setStep] = useState(low ? 'fix' : 'ask'); // ask | fix | saved
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
  // 0 stands for "no number chosen yet" on the low-confidence screen ("–"); otherwise the app's count to confirm.
  const [trueN, setTrueN] = useState(low ? (proposal ?? (flagged ? result.count : 0)) : result.count);
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
  // Leaving a set not yet saved asks first (WP1.4 of docs/SPEC-production.md): the close button and the
  // browser's back (Safari's edge swipe) both lead here, so a set is never lost by a slip of the thumb. A refused set
  // too, once a number stands in its slot (the app's proposal, or one typed): excellence hunt, 9 October 2026.
  const [closing, setClosing] = useState(false);
  const unsaved = step !== 'saved';
  // A set the app counted none in, with no number typed yet, holds nothing to keep: closing it asks nothing.
  const empty = low && step === 'fix' && trueN === 0;
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

  // The keys hold at the foot of the screen while content passes under them; only then do they lay a ground of
  // their own over it (is-stuck), so at rest they sit on the stage with no edge. Stuck when the mark that follows them
  // in the page (res-dock-end) lies below the screen.
  useEffect(() => {
    const screen = rootRef.current?.querySelector('.screen');
    if (!screen) return undefined;
    let raf = 0;
    const check = () => {
      raf = 0;
      const dock = screen.querySelector('.res-dock'), end = screen.querySelector('.res-dock-end');
      if (dock && end) dock.classList.toggle('is-stuck', end.getBoundingClientRect().top > screen.getBoundingClientRect().bottom + 1);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(check); };
    check();
    screen.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { cancelAnimationFrame(raf); screen.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  });

  // The ghost of the lift that stood behind the number is gone (C4, 7 October 2026): the final direction keeps one
  // reading per screen, with no particles, and the stage sleeps without a layer (C9).

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
      savedId.current = await saveWorkout(savedSet({ result, lift, n, corrected, sides, manual, planned, proposal }));
      refreshSets();
      // A set is now worth keeping: the browser is asked to keep the app's storage (keep-sets.js; a no-op once kept).
      askToKeep();
      // With the person's yes, this set is kept as a contribution: counts, pose, decoder, phone kind (contribute.js).
      // A build without VITE_CONTRIBUTE keeps none and never asks: contributions are paused (buildFlags.js, WP0.4).
      if (!manual && corrected !== null && contributeBuild() && readChoice() === 'yes') keepThis(n); // a typed or unanswered count is no label of the app's read
      // On David's phone only (the flag set at #collecte, phoneCollect.js): the set's landmark file in the collector's
      // format, with the count kept here, marked after-app. Video sets only: a live set has no video and is not read
      // at the collector's settings. Never sent from here; never awaited, so a failure does not touch the save.
      if (!manual && corrected !== null && videoFile && collectOn()) {
        collectThisSet({ result, lift, kept: n, view: filmView(lift), videoFile, version: appVersion() })
          .catch(e => console.warn('[collecte] this set could not be kept', e));
      }
      // The sets were never read: read them now, the one just saved first, and count the others.
      if (before === null) loadSets().then(l => setBefore(b => b ?? mine(l).slice(1)), () => {});
      // The question on helping, from the number of sets now on the phone; unread, it is not asked.
      if (contributeBuild()) loadSets().then(l => {
        if (shouldAskContribute({ choice: readChoice(), ...contributeAsks(), saved: l.length })) setContributeAt(c => c ?? l.length);
      }, () => {});
      setSaveError(''); // a retry that saves takes back "not saved"
      if (!manual) track(isCorrected(n, count) ? 'result_corrected' : 'result_kept', { lift });
      setStep('saved');
      // A flagged set's left-right comparison is of the joint the body check doubts: none goes on (saved-set.js).
      if (!manual) onSaved(n, n === count && !flagged ? sides : null); // the replay states the saved count beside the detected marks; the report reads the comparison
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
    if (step === 'fix' && low && trueN === 0) {
      setClosing(false);
      // Nothing to keep yet: the question on the number takes focus, as the card it stands in.
      requestAnimationFrame(() => {
        const q = document.querySelector('[data-testid="fix-card"] .ask-q');
        if (q) { if (!q.hasAttribute('tabindex')) q.setAttribute('tabindex', '-1'); q.focus({ preventScroll: false, focusVisible: false }); }
      });
      return;
    }
    // A flagged set kept at one of the app's own numbers is a confirmed count, not a correction.
    // A refused set is kept as the person's own count, as its save key keeps it (WP1.6).
    if (await doSave(step === 'fix' ? trueN : count, flagged ? trueN !== count : step === 'fix', !!result.refused)) { setClosing(false); await released(); onClose(); }
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

  // The number the person gives: by − and +, a quick key, or typed on the number pad. On a counted set, a change makes
  // the count theirs (step fix); brought back to the app's number, it is the app's to confirm again (step ask).
  const adjust = v => {
    const n = Math.max(0, Math.min(99, v));
    setTyped(null);
    setTrueN(n);
    if (!low) setStep(n === count ? 'ask' : 'fix');
  };
  const live = !!result.metadata?.live;
  // For a set filmed from a programme: the day's sets of this exercise and the set's place among them
  // (result-plan.js). Until the sets are read there is no table and no set number, never a wrong one.
  const day = dayPlan({ planned, sets: before, lift });
  // The status line (one per screen, final direction): the state of the count, then where the set stands.
  const where = day ? `${liftName} · ${c.setOf(day.index, Math.max(day.sets, day.index))}` : low ? liftName : `${liftName} · ${armLabel}`;
  const typedSaved = step === 'saved' && (!!result.refused || isCorrected(trueN, count));
  const status = <div className="res-status" data-testid="res-status">
    <p className="res-status-state">{step === 'saved'
      ? <><i className={`res-mark is-sq${typedSaved ? '' : ' is-measured'}`} aria-hidden="true" />{c.saved}</>
      : <><i className={`res-mark is-ring${!low && step === 'ask' ? ' is-measured' : ''}`} aria-hidden="true" />{low && !offeredBy(trueN) ? c.yourCount : c.toConfirm}</>}</p>
    <p className="res-status-where">{where}</p>
  </div>;
  const tierLine = tierOf(lift) ? <div className="res-tierline"><p className={`tier tier-${tierOf(lift)}`}>{tierLabel(tierOf(lift), fr)}</p></div> : null;

  // − and +, drawn (Geist has no U+2212 at this weight), 64 pt square keys whose outline holds 3:1 (WCAG 1.4.11).
  const minus = <svg viewBox="0 0 22 22" aria-hidden="true"><path d="M3 11H19" /></svg>;
  const plus = <svg viewBox="0 0 22 22" aria-hidden="true"><path d="M3 11H19M11 3V19" /></svg>;
  // The number between − and +. It is also a field: a tap opens the number pad and typing replaces the number, so 7
  // to 34 takes three taps, not 27 (design review of 1 October). The field opens empty, so what is typed replaces the
  // number wherever iOS leaves the caret (review of 2 October); with every digit deleted the number stays as it was.
  const hero = (slot, ready, keys = true) => <div className={`res-hero${ready ? '' : ' is-waiting'}`}>
    {keys && <button type="button" className="res-step press" disabled={!ready || trueN <= 0} onClick={() => adjust(trueN - 1)} aria-label={fr ? 'Une de moins' : 'One fewer'}>{minus}</button>}
    <span className={`res-slot${typed !== null ? ' is-typing' : ''}`}>
      {slot}
      {keys && <input className="stepper-in" type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" enterKeyHint="done" disabled={!ready}
        aria-label={fr ? 'Nombre de répétitions' : 'Number of reps'} value={typed ?? (trueN ? String(trueN) : '')}
        onFocus={() => { typedFrom.current = trueN; setTyped(''); }}
        onBlur={() => setTyped(null)}
        onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(0, 2); setTyped(d); const n = d === '' ? typedFrom.current : Number(d); setTrueN(n); if (!low) setStep(n === count ? 'ask' : 'fix'); }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />}
    </span>
    {keys && <button type="button" className="res-step press" disabled={!ready || trueN >= 99} onClick={() => adjust(trueN + 1)} aria-label={fr ? 'Une de plus' : 'One more'}>{plus}</button>}
  </div>;

  // Leaving a set not yet saved: one question, naming the number, where the keys stood.
  const closeCard = <div className="res-close appear" data-testid="close-card" role="group" aria-labelledby="close-q">
    <p className="ask-q" id="close-q" tabIndex={-1}>{(() => {
      const n = step === 'fix' ? trueN : count;
      const what = fr ? (n > 1 ? `ces ${n} répétitions` : n === 1 ? 'cette répétition' : 'cette série') : (n > 1 ? `these ${n} reps` : n === 1 ? 'this rep' : 'this set');
      return fr ? `Garder ${what} ?` : `Keep ${what}?`;
    })()}</p>
    <div className="ask-row">
      <button type="button" className="res-key is-primary press" onClick={keepAndClose} data-testid="close-keep">{fr ? 'Garder' : 'Keep'}</button>
      <button type="button" className="res-key press" onClick={discardAndClose} data-testid="close-discard">{fr ? 'Ne pas garder' : 'Don’t keep'}</button>
    </div>
  </div>;

  // Low confidence (screen 05b): the cause the app measured, the question, and no number until the person gives one.
  // The slot starts at "–"; the quick keys are centred on the plan (else on the person's previous set of this lift,
  // labelled so), none chosen; Save waits for a number. The app's count is never offered as the centre (R8).
  const centre = Number.isInteger(planned?.reps) && planned.reps > 0 ? planned.reps : null;
  const previous = before?.[0]?.reps;
  const quick = quickKeys(centre ?? previous);
  const centreLine = centre ? c.planSays(centre) : quick.length ? c.lastSet(previous) : '';
  const lowAsk = (manual, cause) => <div key="count" className="res-low" data-testid="fix-card">
    <h2 className="res-low-title refused-title" data-testid={manual ? undefined : 'res-uncounted'}>{liveDiffers || proposal || flagged ? c.notSure : c.noCount}</h2>
    <div className="res-cause">
      <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" /><path d="M10 5.5v5.5" /><circle className="dot" cx="10" cy="14.2" r=".6" /></svg>
      <div>{cause.map(l => <p key={l}>{l}</p>)}</div>
    </div>
    <p className="ask-q res-ask" id="res-ask">{c.howMany}</p>
    {hero(trueN > 0
      ? <span key={trueN} className="res-typed" data-testid="res-typed" aria-hidden="true">{trueN}</span>
      : <span className="res-empty" data-testid="res-empty" aria-hidden="true"><i /></span>, true)}
    <p className="sr" aria-live="polite" aria-atomic="true">{trueN > 0 ? trueN : c.empty}</p>
    {proposal && <p className="res-state is-proposal" data-testid="res-proposal">{c.proposal(proposal)}</p>}
    {/* A flagged set: the app's count, labelled; with the spec-guided count, the two as keys, each with where it
        comes from (the counted joint, the whole body), neither chosen over the other by its look. */}
    {flagged && !second && <p className="res-state is-proposal" data-testid="res-bodycount">{c.bodyCounted(count)}</p>}
    {flagged && second && <div className="res-cands" role="group" aria-label={c.bodyChoices} data-testid="res-candidates">
      {[[count, c.byJoint(liftDefinition(lift)?.joint)], [second, c.byBody]].map(([n, from], i) => <button key={i} type="button" className={`res-cand press${trueN === n ? ' is-on' : ''}`} aria-pressed={trueN === n} onClick={() => adjust(n)} data-testid={i ? 'res-cand-body' : 'res-cand-joint'}>
        <span className="res-cand-n">{n}</span><span className="res-cand-from">{from}</span>
      </button>)}
    </div>}
    {proposal && trueN === proposal ? <p className="res-hint" data-testid="res-proposal-note">{c.proposalNote}</p>
      : flagged && offeredBy(trueN) ? <p className="res-hint" data-testid="res-body-note">{c.bodyNote}</p>
      : trueN > 0 ? <p className="res-state is-typed">{c.typedBy}</p> : <p className="res-hint">{quick.length > 0 ? c.quickHint : c.typeHint}</p>}
    {quick.length > 0 && <div className="res-quick" role="group" aria-labelledby="res-ask">{quick.map(k => <button key={k} type="button" className={`res-qk press${trueN === k ? ' is-on' : ''}`} aria-pressed={trueN === k} onClick={() => adjust(k)}>{k}</button>)}</div>}
    {centreLine && <p className="res-hint res-centre">{centreLine}</p>}
  </div>;
  const lowDock = manual => [<div key="dock" className="res-dock" data-testid="res-dock">{closing && unsaved ? closeCard : <div className="res-keys">
    <button type="button" className="res-key is-primary press" data-testid="res-save" disabled={trueN === 0} onClick={() => { if (trueN === 0) return; navigator.vibrate?.(10); doSave(trueN, flagged ? trueN !== count : true, manual); }}>{trueN > 0 ? (offeredBy(trueN) ? c.confirmN(trueN) : c.saveN(trueN)) : c.save}</button>
    <button type="button" className="res-key press" onClick={onRefilm}>{c.refilm}</button>
  </div>}</div>, <i key="dock-end" className="res-dock-end" aria-hidden="true" />];

  if (result.refused) {
    const text = why.cause === 'nobody'
      ? (result.metadata?.live ? (fr ? 'Personne n’apparaît à l’image.' : 'We could not find you in the picture.') : (fr ? 'Personne n’apparaît dans la vidéo.' : 'We could not find you in the video.'))
      : why.cause === 'unclear'
        ? (many
          ? (fr ? `Vos ${limb.noun} n’étaient pas assez visibles pour compter les répétitions.` : `Your ${limb.noun} were not visible enough to count the reps.`)
          : (fr ? `Votre ${armLabel} n’était pas assez visible pour compter les répétitions.` : `Your ${armLabel} was not visible enough to count the reps.`))
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
      ? (fr ? 'Reculez pour que vos hanches soient dans l’image, puis refilmez.' : 'Step back so your hips are in the picture, then record again.')
      : why.cause === 'nobody'
        ? (fr ? 'Posez le téléphone face à vous, placez-vous dans l’image, puis refilmez.' : 'Stand the phone facing you, step into the picture, then record again.')
        : legs
          ? (fr ? 'Placez-vous au centre de l’image, pieds compris, puis refilmez.' : 'Stand in the middle of the picture, feet included, then record again.')
          : (fr ? 'Placez-vous au centre de l’image, bras compris, puis refilmez.' : 'Stand in the middle of the picture, arms included, then record again.');
    // The cause the app measured (refusal.js) and its fix, then the person's count, typed by hand and saved as theirs
    // with no count of the app (WP1.6 of docs/SPEC-production.md; R8). "Refilmer" stays one tap away. The replay, in
    // the top bar, shows where the tracking lost the body; under it, this screen is out of reach.
    return <div className="wv-experience" ref={rootRef} inert={covered ? true : undefined}>
      <section className={`screen is-active result-screen is-low${step === 'saved' ? ' is-saved' : ''}`}><div className="wrap">
        <Topbar fr={fr} onClose={askClose} onReplay={onReplay} replayRef={replayRef} badge={false} />
        {status}
        {tierLine}
        {step !== 'saved' && lowAsk(true, [text, fix])}
        {step !== 'saved' && lowDock(true)}
        <div ref={cardRef}>
          {step === 'saved' && <div className="saved appear" data-testid="saved-card">
            <p className="saved-msg">{proposal && trueN === proposal ? c.savedConfirmed(trueN) : fr ? `Merci. ${trueN} ${trueN > 1 ? 'répétitions enregistrées, saisies' : 'répétition enregistrée, saisie'} à la main.` : `Thank you. ${trueN} ${trueN === 1 ? 'rep' : 'reps'} saved, typed by hand.`}</p>
            <div className="rest-slot" ref={restRef}><RestClock fr={fr} clock={rest} /></div>
            <button className="btn-primary press" onClick={after(onNewSet)} data-testid="new-set">{fr ? 'Nouvelle série' : 'New set'}</button>
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
  // The numeral: the app's count rising, then the count to confirm, in the measured count's colour; the person's
  // number once they change it (step fix) or once a changed count is saved, drawn in --c-fg at weight 400 with the words
  // "Saisi par vous" (C1, R8). After a low-confidence screen it is the number the person gave.
  const big = step === 'ask' ? shown : trueN;
  const typedView = step === 'fix' || corrected;
  const one = big <= 1;
  // Before the person gives their count on the low-confidence screen, no measure of the set is shown (R8, no grade).
  // A set the body check flagged shows none once saved either: every measure of the set (cells, ranges, tempo, short
  // marks, wave, left against right) is read on the counted joint's angle, the one the check found disagreeing with
  // the rest of the body (R8; as a refused set, the proposal's pattern, shows none). The day's table is no measure.
  const showMeasures = !low || (step === 'saved' && !flagged);
  const measured = count > 0 && asked && showMeasures;
  // The level chosen before this set sets the screen; one chosen on it applies from the next set.
  // The set's two ranges and what a gap means: under the strips, or under the marks for the beginner, who has no strips.
  const sidesLine = measured && sidesText ? <div className="res-sides" data-testid="res-sides"><p>{sidesText.line}</p><p className="res-sides-note">{sidesText.note}</p></div> : null;
  // The cells still planned after the counted ones (dashed, never filled), and the day's rows.
  const extra = day ? Math.max(0, day.reps - reps.length) : 0;
  const current = step === 'saved'
    ? { kind: isCorrected(trueN, count) ? 'corrected' : 'confirmed', n: trueN }
    : low ? { kind: 'yours', n: trueN || null } : { kind: 'pending', n: step === 'fix' ? trueN : count, typed: step === 'fix' };
  const rows = planRows(day, current);
  const replayKey = onReplay && <button ref={replayRef} type="button" className="res-key press" onClick={onReplay}>{live ? c.replaySet : c.replayVideo}</button>;
  const blocks = {
    // Low confidence: the cause and the question, no number (05b). Otherwise the question, the count between − and +,
    // its state in a mark and a word, and where it comes from (05).
    count: low && step !== 'saved' ? lowAsk(false, unsure ? [c.noneFound] : [...(liveDiffers ? [c.liveDiffers(liveShown)] : []), ...(flagged ? [c.bodyCause(jointName(liftDefinition(lift)?.joint, fr))] : [])]) : <div key="count" className="res-count">
      {step !== 'saved' && <p className={`res-q${asked ? '' : ' is-waiting'}${step === 'fix' ? ' is-fix' : ''}`} aria-hidden={asked ? undefined : true}>{step === 'fix' ? c.howMany : c.question(count)}</p>}
      {hero(<span key={big} className={`numeral tick${typedView ? ' is-typed' : ''}${String(big).length > 2 ? ' is-long' : ''}`} aria-hidden="true" data-testid="res-numeral">{big}</span>, asked, step !== 'saved')}
      {step === 'fix' && <p className="sr" aria-live="polite" aria-atomic="true">{trueN}</p>}
      <p className={`res-state${typedView ? ' is-typed' : ''}${step === 'saved' ? ' is-saved' : ''}`} data-testid="res-state">{typedView
        ? c.typedBy
        : <><i className={`res-mark ${step === 'saved' ? 'is-sq' : 'is-ring'} is-measured`} aria-hidden="true" />{step === 'saved' ? c.saved : c.toConfirm}</>}</p>
      {/* Where the number comes from: the app, on a video whose length is measured (metadata.duration); once the person
          changed it, the app's own count beside theirs (the saved card says it once saved). */}
      {step === 'fix' ? <p className="res-src">{c.countedWas(count)}</p> : !typedView && <p className="res-src" data-testid="res-src">{c.source(seconds, live)}</p>}
      {tierLine}
      {result.test && <p className="res-label">{fr ? (one ? 'Répétition' : 'Répétitions') : (big === 1 ? 'Rep' : 'Reps')}{fr ? ` en ${result.test.windowSec} secondes` : ` in ${result.test.windowSec} seconds`}</p>}
      {/* A fitness test whose video ends before its window: the score is of what was filmed (fitness-tests.js). */}
      {result.test && !result.test.complete && <p className="res-meta res-test-short" data-testid="res-test-short">{result.metadata?.live
        ? (fr ? `La série s’arrête avant les ${result.test.windowSec} secondes : le score ne porte que sur ce qui a été filmé.` : `The set stops before ${result.test.windowSec} seconds: the score covers only what was filmed.`)
        : (fr ? `La vidéo s’arrête avant les ${result.test.windowSec} secondes : le score ne porte que sur ce qui a été filmé.` : `The video ends before ${result.test.windowSec} seconds: the score covers only what was filmed.`)}</p>}
      <p className="sr" role="status">{step === 'saved'
        ? (fr ? `${trueN} ${trueN > 1 ? 'répétitions enregistrées' : 'répétition enregistrée'}.` : `${trueN} ${trueN === 1 ? 'rep' : 'reps'} saved.`)
        : asked ? (fr ? `${count} ${count > 1 ? 'répétitions comptées' : 'répétition comptée'}.` : `${count} ${count === 1 ? 'rep' : 'reps'} counted.`) : ''}</p>
    </div>,
    // One cell per counted rep, solid in the measured colour as the count rises; for a planned set, one dashed cell
    // per rep still planned (never filled, never gold). Touching the cells shows the nearest rep's details.
    bars: count > 0 && showMeasures && <div key="bars" className="res-cells-wrap">
      <div className="res-cells">
        <div ref={marksRef} className={`bars${sel >= 0 ? ' has-sel' : ''}`} style={{ flexGrow: Math.max(1, reps.length) }}
          {...(asked ? { role: 'group', tabIndex: 0, 'aria-label': marksLabel({ fr, corrected }), onClick: pick, onKeyDown: keys } : { 'aria-hidden': true })}>
          {reps.map((rep, i) => <div key={rep.index} className={`bar${i < shown ? ' lit' : ''}${i === sel ? ' sel' : ''}`}><i />{shortSet.has(rep.index) && i < shown && <b className="short-mark" aria-hidden="true">▾</b>}</div>)}
        </div>
        {extra > 0 && <div className="bars is-planned" data-testid="res-planned-cells" aria-hidden="true" style={{ flexGrow: extra }}>
          {Array.from({ length: extra }, (_, i) => <div key={i} className="bar is-planned"><i /></div>)}
        </div>}
      </div>
      {/* VoiceOver on iPhone cannot move through the marks (they answer arrow keys and taps): every rep's line is
          also in a list read in order, with the label of the measures before it (second audit, 3 October). */}
      {asked && <ol className="sr" data-testid="res-reps-sr">{reps.map((_, i) => { const t = repText(i); return <li key={i}>{t.head}{t.body}</li>; })}</ol>}
      {view.level === 'beginner' && sidesLine}
      <p className="res-detail" aria-live="polite">{detailHead && <span className="sr">{detailHead}</span>}{detail}</p>
      {/* Under the cells: every measure on this screen (cells, account, table) is experimental (measures.js). */}
      {MEASURES_SHOWN && <p className="res-exp" data-testid="res-exp">{experimentalLabel(fr)}</p>}
    </div>,
    // The day's table, for a set filmed from a programme: each set with a mark, a weight and a word. Confirmed sets in
    // the measured colour at weight 700; the set on screen "à confirmer"; a typed or corrected set at weight 400 with
    // its word; the sets to come "prévu N", at caption size, never a numeral and never gold (R8).
    plan: rows.length > 0 && (!low || step === 'saved') && <div key="plan" className="res-plan" data-testid="res-plan">
      <p className="res-plan-head"><span className="res-caps">{c.today}</span><span>{c.plannedHead(day.sets, day.reps)}</span></p>
      <ol className="res-rows">{rows.map(r => <li key={r.k} className={`res-row is-${r.kind}${r.typed ? ' is-typed' : ''}${r.k === day.index ? ' is-current' : ''}`} data-kind={r.kind}>
        <i className="res-mark" aria-hidden="true" />
        <span className="res-row-set">{c.setN(r.k)}</span>
        <span className="res-row-n" data-testid={r.kind === 'planned' ? 'res-planned' : undefined}>{r.kind === 'planned' ? c.plannedValue(r.n) : (r.n ?? '–')}</span>
        <span className="res-row-word">{r.kind === 'planned' ? '' : c.word[r.typed ? 'pending' : r.kind]}</span>
      </li>)}</ol>
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
    wave: MEASURES_SHOWN && count > 0 && showMeasures && result.smoothedAngles?.length > 1 && <div key="wave" className="res-wave">
      <RepWave angles={waveAngles(result)} timestamps={result.timestamps} reps={reps} rest={liftDefinition(lift)?.rest} first={liftDefinition(lift)?.first} sel={sel} shown={shown} fr={fr} jointWord={jointName(liftDefinition(lift)?.joint, fr)} onSelect={setSel} reference={referenceBand(lift, { joint: liftDefinition(lift)?.joint })} />
    </div>,
    // The keys, in the thumb zone: "Oui, N répétitions" confirms the app's count, the video is one tap away. A changed
    // count is saved as the person's. Nothing is saved, and nothing celebrates, before one of them is pressed.
    dock: !low && step !== 'saved' && [<div key="dock" className="res-dock" data-testid="res-dock">
      {closing && unsaved ? closeCard
        : step === 'ask'
          ? (asked && <div className="res-keys appear" data-testid="ask-card">
            <button type="button" className="res-key is-primary press" data-testid="res-yes" onClick={() => { navigator.vibrate?.(10); doSave(count, false); }}>{c.yes(count)}</button>
            {replayKey}
          </div>)
          : <div className="res-keys" data-testid="fix-card">
            <button type="button" className="res-key is-primary press" data-testid="res-save" onClick={() => { navigator.vibrate?.(10); doSave(trueN, true); }}>{c.saveN(trueN)}</button>
            {replayKey}
          </div>}
    </div>, <i key="dock-end" className="res-dock-end" aria-hidden="true" />],
    lowDock: low && step !== 'saved' && lowDock(false),
    card: <div key="card" ref={cardRef}>
      {step === 'saved' && (
        <div className="saved appear" data-testid="saved-card">
          {trueN !== count && <p className="res-meta saved-corr">{fr ? `Compté par l’app : ${count}. Corrigé : ${trueN}.` : `Counted by the app: ${count}. Corrected: ${trueN}.`}</p>}
          {moment && <p className={`moment is-${moment.kind}`} data-testid="moment" role="status">{moment.text}</p>}
          <p className="saved-msg">{trueN !== count
            ? (fr ? 'Merci. Votre correction est notée sur votre téléphone.' : 'Thank you. Your correction is noted on your phone.')
            : (fr ? 'Merci. Série enregistrée sur votre téléphone.' : 'Thank you. Set saved on your phone.')}</p>
          {/* The rest begins as the set is saved: its clock runs at once, above the report and the
              challenge, since the next thing done on the bench is to rest (design pass, 29 September). */}
          <div className="rest-slot" ref={restRef}><RestClock fr={fr} clock={rest} /></div>
          {/* A gym session is several sets of one lift: the next set goes straight back to filming this lift, and
              changing lift is the quieter choice beside it (WP1.3 of docs/SPEC-production.md). Once saved, the next
              set is the one thing left to do (design pass of 4 October). */}
          <button className="btn-primary press" onClick={after(onNewSet)} data-testid="new-set">{fr ? 'Nouvelle série' : 'New set'}</button>
          <button className="text-btn press" onClick={after(onChangeLift)} data-testid="change-lift">{fr ? 'Changer d’exercice' : 'Change exercise'}</button>
          <button ref={reportRef} className="btn-ghost press" onClick={() => onReport(trueN, savedId.current)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z" /><path d="M14 3v5h5" /><path d="M8.5 13h7M8.5 16.5h5" /></svg>
            <span>{fr ? 'Rapport de séance' : 'Session report'}</span>
          </button>
          <button className="text-btn press" onClick={challenge}>{fr ? 'Défier un ami' : 'Challenge a friend'}</button>
          <p className="share-note" role="status">{shareNote}</p>
          {/* Once, on the saved card of the first set saved where the app is not installed: how to install it (Install.jsx).
              After the confirmation, never before it. */}
          <InstallSuggest fr={fr} />
          {/* After the first saved set (and once more from the fifth): one quiet question, which nothing waits on. */}
          {showContribute && <ContributeAsk fr={fr} onYes={() => keepThis(trueN)} />}
          {/* Once, after a saved set, when no level is stored. */}
          {offerLevel && <div className="level-ask appear" data-testid="level-ask">
            <p className="level-q" aria-hidden="true">{fr ? 'Pour adapter l’écran, quel est votre niveau ?' : 'To fit the screen to you, what is your level?'}</p>
            <LevelPick id="level-ask-label" quiet label={fr ? 'Pour adapter l’écran, quel est votre niveau ?' : 'To fit the screen to you, what is your level?'} value={chosen} onChange={chooseLevel} fr={fr} />
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
    plain: count > 0 && showMeasures && <div key="plain" className="set-account" data-testid="set-account">{plain}</div>,
    more: measured && <div key="more" className="set-account acc-more appear">{more}</div>,
  };
  // One order for every level: the status, the count, its cells, the day's table and the keys lead, so the
  // question and its answer stay on the first screen; the level's own blocks follow (level.js).
  const order = ['count', 'bars', 'plan', 'dock', 'lowDock', 'card', ...resultBlocks(view.level).filter(b => !['count', 'bars', 'card'].includes(b))];
  // Under the report, the result is out of reach of taps, the keyboard and screen readers.
  return <div className="wv-experience" ref={rootRef} inert={covered ? true : undefined}>
    <section className={`screen is-active result-screen lv-${view.level}${step === 'saved' ? ' is-saved' : ''}${low ? ' is-low' : ''}`} data-level={view.level}><div className="wrap">
      {/* The replay is the second key while the count waits for its answer; in the top bar otherwise. */}
      <Topbar fr={fr} onClose={askClose} onReplay={low || step === 'saved' ? onReplay : undefined} replayRef={replayRef} badge={false} />
      {status}
      {low && step !== 'saved' && tierLine}
      {order.map(b => blocks[b] || null)}
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
