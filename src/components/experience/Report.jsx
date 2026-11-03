import { useState, useRef, useEffect } from 'react';
import { useT } from '../../lib/LanguageContext';
import { exerciseName, guideExercise } from './exercise-info';
import { reportSheet, reportFileName, measuresFile, wideDetail, NAME_MAX, NOTES_MAX } from './report-sheet';
import { knownSets, loadSets, previousSet } from './sets';
import { liftDefinition } from '../../lib/counting/core';
import { track } from '../../lib/events';
import { useCondensingTopbar } from './topbar';
import './Report.css';
import RepWave from './RepWave';
import { MeasureGuide } from './measure-guide';
import { shareSheet } from '../../lib/shareSheet';
import { downloadBvhFile } from '../../lib/biomechanics/bvhExport';
import MocapViewer from './MocapViewer';

// The PDF code (jsPDF and the app's fonts) loads apart from the screens, once,
// and is warmed as soon as a report is likely, so the share happens within the tap.
let kit = null, loading = null, warmed = false;
const drawingsWarmed = new Set();
export async function warmReportPdf(lift = null) {
  loading ||= import('./report-pdf').then(m => (kit = m), e => { loading = null; throw e; });
  const m = await loading;
  if (lift && !drawingsWarmed.has(lift)) {
    try {
      const sd = await import('./sheet-drawings');
      await sd.drawings.warm([lift]);
      drawingsWarmed.add(lift);
    } catch (_) {}
  }
  return m;
}

/**
 * The session report for one saved set. It assumes no coach (step 1): the user says, if they
 * wish, their name, whom they trained with and at which level, and the sheet shows only that.
 * count: the number the visitor confirmed or corrected; counted: what the app counted.
 * reps: the saved set's reps, when their details were measured with step 3c's boundaries: the app's, or those read again
 * for the person's count (recounted). doubted: the body check flagged the set's joint (saved-set.js keepsMeasures).
 */
export default function Report({ lift, count, counted, arm, date, source, afterRefusal = false, proposed = false, proposedBy = null, leaving, onBack, reps, setId, sides = null, wave = null, planned = null, recounted = false, doubted = false, result = null }) {
  const { lang } = useT(), fr = lang === 'fr';
  const [name, setName] = useState('');
  const [context, setContext] = useState(''); // '' | alone | friend | coach | physio
  const [partner, setPartner] = useState('');
  const [rpe, setRpe] = useState(null);
  const [pain, setPain] = useState(null);
  // '' | beginner | intermediate | expert, prefilled from the level stored on this phone (level.js).
  // Empty until chosen here: the screen promises that only what the user fills in appears on the PDF,
  // so the level stored for the result screen is not written on the sheet by itself (review, 30 September).
  const [level, setLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState(kit ? 'ready' : 'preparing'); // ready | preparing | error
  const [note, setNote] = useState('');
  const failures = useRef(0);
  const noteTimer = useRef(0);
  const shares = useRef(null);
  shares.current ??= shareSheet();
  // The title condenses into the topbar as the form scrolls under it (section 3, change 1).
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);
  const backRef = useRef(null), partnerRef = useRef(null), notesRef = useRef(null);
  const when = useRef(date ? new Date(date) : new Date()).current;

  const liftName = exerciseName(lift, lang);
  const first = liftDefinition(lift)?.first || 'concentric';
  // The previous saved set of the same lift and the same tracked arm or side, if any, for comparison: before this one, never this one.
  // Just after a save the sets are being read again; the comparison then follows once they are in,
  // rather than being left out for good (review, 30 September).
  const previousOf = all => {
    const prev = previousSet(all, lift, { id: setId, at: when.getTime(), arm });
    return prev ? { count: prev.reps, reps: prev.repDetails, date: new Date(prev.createdAt ?? prev.date) } : null;
  };
  const [previous, setPrevious] = useState(() => { const all = knownSets(); return all ? previousOf(all) : undefined; });
  useEffect(() => {
    if (previous !== undefined) return undefined;
    let live = true;
    loadSets().then(all => { if (live) setPrevious(previousOf(all)); }, () => { if (live) setPrevious(null); });
    return () => { live = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const activeWave = wave || (result?.angles ? { a: result.angles, t: result.timestamps || result.angles.map((_, i) => i / 30) } : null);
  const sheet = reportSheet({ lang, date: when, name, context, partner, level, notes, liftName, count, counted, arm, joint: liftDefinition(lift)?.joint, reps, source, afterRefusal, proposed, proposedBy, first, previousSet: previous ?? null, sides, lift, wave: activeWave, planned, rpe, pain, recounted, doubted, result });
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;
  const guide = guideExercise(lift);
  const [activeFrame, setActiveFrame] = useState(0);
  useEffect(() => {
    if (!guide?.frames?.length || guide.frames.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => {
      setActiveFrame(f => (f + 1) % guide.frames.length);
    }, 850);
    return () => clearInterval(timer);
  }, [guide]);

  function prepare() {
    setStatus('preparing');
    warmReportPdf(lift).then(() => { setStatus('ready'); setNote(''); }, () => {
      failures.current += 1;
      setStatus('error');
      setNote(failures.current > 1
        ? (fr ? 'Le PDF n’a pas pu être préparé. Rechargez l’appli, puis rouvrez la série dans Vos séries.' : 'The PDF could not be prepared. Reload the app, then open the set again in Your sets.')
        : (fr ? 'Le PDF n’a pas pu être préparé. Réessayez.' : 'The PDF could not be prepared. Try again.'));
    });
  }

  useEffect(() => {
    backRef.current?.focus({ preventScroll: true, focusVisible: false });
    if (!kit) prepare();
    // One build in advance, once the screen has settled, so the first share is as quick as the next.
    const t = setTimeout(() => {
      if (warmed) return;
      warmReportPdf().then(m => { if (!warmed) { warmed = true; try { m.reportPdf(sheetRef.current); } catch { /* the share reports it */ } } }, () => {});
    }, 900);
    return () => { clearTimeout(t); clearTimeout(noteTimer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function say(text) {
    clearTimeout(noteTimer.current);
    setNote(text);
    noteTimer.current = setTimeout(() => setNote(''), 4000);
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    say(fr ? 'Téléchargement du PDF lancé.' : 'PDF download started.');
  }

  // Built and shared inside the tap: Safari opens the share sheet only from a gesture.
  function share() {
    if (status === 'preparing' || !shares.current.begin()) return; // one tap at a time
    if (status === 'error' || !kit) { prepare(); return; }
    let blob;
    try { blob = kit.reportPdf(sheet); } catch (e) {
      console.error('[report pdf]', e);
      setNote(fr ? 'Le PDF n’a pas pu être préparé. Réessayez.' : 'The PDF could not be prepared. Try again.');
      return;
    }
    const fileName = reportFileName({ lang, date: when, name });
    const file = new File([blob], fileName, { type: 'application/pdf' });
    track('share', { lift });
    if (shares.current.shares(!!navigator.canShare?.({ files: [file] }))) {
      // Nothing waits on the sheet (shareSheet.js): a refusal says so, and the next tap downloads.
      navigator.share({ files: [file], title: sheet.title }).catch(e => {
        if (shares.current.failed(e)) setNote(fr ? 'Le partage n’a pas abouti. Touchez à nouveau pour télécharger.' : 'Sharing did not go through. Tap again to download.');
      });
      return;
    }
    download(blob, fileName);
  }

  // The set as a file (measuresFile, report-sheet.js): every value says where it comes from.
  function exportJson() {
    const payload = measuresFile({ fr, lift, date: when, count, counted, source, afterRefusal, proposed, proposedBy, reps, sides, planned, doubted, joint: liftDefinition(lift)?.joint,
      person: { name, context, partner, level, pain, rpe, notes } });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const day = when.toISOString().slice(0, 10);
    const fileName = `${fr ? 'mesures-serie' : 'set-measures'}-${lift}-${day}.json`;
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    say(fr ? 'Téléchargement des données JSON lancé.' : 'JSON download started.');
  }

  const next = target => e => { if (e.key === 'Enter') { e.preventDefault(); target.current?.focus(); } };
  const busy = status === 'preparing';


  return <div className={`wv-experience${leaving ? ' is-leaving' : ''}`}>
    <section ref={screenRef} className="screen is-active report-screen"><div className="wrap">
      <div className="topbar">
        <button ref={backRef} className="icon-btn press" onClick={onBack} aria-label={fr ? 'Retour' : 'Back'}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span className="pill">{fr ? 'Version de test' : 'Test version'}</span>
      </div>
      <h2 className="title" data-reveal style={{ '--i': 0 }}>{fr ? 'Rapport de séance' : 'Session report'}</h2>
      <p className="report-sub" data-reveal style={{ '--i': 1 }}>{fr ? 'Tout est facultatif\u00A0: seul ce que vous remplissez apparaît sur le PDF.' : 'Everything is optional: only what you fill in appears on the PDF.'}</p>

      <article className="sheet" data-reveal style={{ '--i': 2 }} aria-label={fr ? 'Aperçu du PDF' : 'PDF preview'}>
        <div className="sh-top">{sheet.brand && <span>{sheet.brand}</span>}<span>{sheet.date}</span></div>
        <h3 className="sh-title">{sheet.title}</h3>
        {sheet.people.length > 0 && <div className="sh-people">
          {sheet.people.map(([label, value]) => <span key={label}><em>{label}</em><span>{value}</span></span>)}
        </div>}
        <div className="sh-count-row">
          <div className="sh-count">
            <span className="sh-n">{sheet.count}</span>
            <span className="sh-nl"><b>{sheet.word}</b><span>{sheet.lift}</span>{sheet.planned && <span className="sh-planned" data-testid="sh-planned">{sheet.planned}</span>}</span>
          </div>
          {guide?.frames?.length > 0 && (
            <div className="sh-mockup-frame" data-testid="sh-mockup-frame" aria-hidden="true" title={sheet.lift}>
              <img
                src={guide.frames[activeFrame % guide.frames.length]}
                width="72"
                height="72"
                alt=""
                loading="eager"
              />
              <span className="sh-mockup-phase">{activeFrame + 1}/{guide.frames.length}</span>
            </div>
          )}
        </div>
        {/* The numeral leads; the sentence is its caption (critic, 30 September). */}
        {sheet.opener && <p className="sh-opener">{sheet.opener}</p>}
        {/* How the count was made, labelled like the people above (David's iPhone, 5 October: four grey sentences of equal weight). */}
        {sheet.details.length > 0 && <div className="sh-people sh-details">
          {sheet.details.map(([label, value]) => <span key={label} className={wideDetail(value) ? 'is-wide' : undefined}><em>{label}</em><span>{value}</span></span>)}
        </div>}
        {/* The person's own pain and effort, as they gave them: theirs, never graded, on every sheet. */}
        {sheet.own.length > 0 && <div className="sh-people sh-details sh-own" data-testid="sh-own">
          {sheet.own.map(([label, value]) => <span key={label}><em>{label}</em><span>{value}</span></span>)}
        </div>}

        {sheet.optimization && (
          <div className="sh-mocap-section" data-testid="sh-mocap-section">
            <MocapViewer worldLandmarks={result?.worldLandmarks || null} lift={lift} fr={fr} />
            {sheet.optimization?.bvhData && (
              <div className="sh-mocap-export" data-testid="sh-mocap-export">
                <button
                  type="button"
                  className="res-opt-export-btn press"
                  onClick={() => downloadBvhFile(sheet.optimization.bvhData, `mocap-${lift}-${Date.now()}.bvh`)}
                  data-testid="report-export-bvh-btn"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>{fr ? 'Télécharger fichier Mocap (.bvh)' : 'Download Mocap file (.bvh)'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 1. Coach's Prescription ("Le Verdict du Coach") */}
        {sheet.optimization?.coachPrescription && (
          <div className="sh-coach-prescription" data-testid="sh-coach-prescription">
            <div className="sh-cp-head">
              <div className="sh-cp-titles">
                <span className="sh-cp-kicker">{fr ? 'Le Verdict du Coach' : 'The Coach’s Prescription'}</span>
                <h4 className="sh-cp-title">{fr ? sheet.optimization.coachPrescription.tierLabelFr : sheet.optimization.coachPrescription.tierLabelEn}</h4>
              </div>
              <div className="sh-cp-score">
                <span className="sh-cp-score-val">{sheet.optimization.coachPrescription.executionComplianceScore}%</span>
                <span className="sh-cp-score-lbl">{fr ? 'Standard d’élite' : 'Elite Standard'}</span>
              </div>
            </div>
            {sheet.optimization.coachPrescription.limitingFactor?.category !== 'none' && (
              <div className="sh-cp-bottleneck">
                <div className="sh-cp-bottleneck-head">
                  <span className="sh-cp-bottleneck-badge">{fr ? 'Facteur limitant #1' : 'Bottleneck #1'}</span>
                  <span className="sh-cp-bottleneck-title">{fr ? sheet.optimization.coachPrescription.limitingFactor.titleFr : sheet.optimization.coachPrescription.limitingFactor.titleEn}</span>
                </div>
                <p className="sh-cp-bottleneck-desc">{fr ? sheet.optimization.coachPrescription.limitingFactor.detailFr : sheet.optimization.coachPrescription.limitingFactor.detailEn}</p>
              </div>
            )}
            <div className="sh-cp-next-set">
              <span className="sh-cp-next-kicker">{fr ? 'Consigne pour la série suivante' : 'Prescription for Set N+1'}</span>
              <p className="sh-cp-next-cue">{fr ? sheet.optimization.coachPrescription.nextSetPrescription.cueFr : sheet.optimization.coachPrescription.nextSetPrescription.cueEn}</p>
              <div className="sh-cp-focus">
                <em>{fr ? 'Focus mental\u00A0:' : 'Mental cue:'}</em>
                <span>{fr ? sheet.optimization.coachPrescription.nextSetPrescription.mentalFocusFr : sheet.optimization.coachPrescription.nextSetPrescription.mentalFocusEn}</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. Detailed Biomechanics & 3D Kinematics */}
        {sheet.optimization && (
          <div className="sh-biomechanics-section" data-testid="sh-biomechanics-section">
            <div className="sh-sec-head">
              <span className="sh-sec-title">{fr ? 'Biomécanique détaillée & Cinématique 3D' : 'Detailed Biomechanics & 3D Kinematics'}</span>
              <span className="sh-sec-sub">{fr ? 'Angles, puissance (W), perte de vitesse et cinématique' : 'Angles, power (W), velocity loss and kinematics'}</span>
            </div>
            <div className="sh-bio-grid">
              {(sheet.optimizationMetrics || []).map(m => (
                <div key={m.label} className="sh-bio-card">
                  <div className="sh-bio-card-head">
                    <span className="sh-bio-lbl">{m.label}</span>
                    <span className="sh-bio-val">{m.val}</span>
                  </div>
                  <div className="sh-bio-track"><div className="sh-bio-bar" style={{ width: `${m.fillPct}%` }} /></div>
                  <span className="sh-bio-sub">{m.sub}</span>
                </div>
              ))}
            </div>
            <p className="sh-bio-disclaimer">{fr ? '* Estimation indicative basée sur le travail mécanique de la série.' : '* Indicative estimate based on mechanical work.'}</p>
          </div>
        )}

        {/* 3. Rep-by-Rep Velocity Profile */}
        {sheet.optimization?.repVelocityProfiles?.length > 0 && (
          <div className="sh-vbt-section" data-testid="sh-vbt-section">
            <div className="sh-sec-head">
              <span className="sh-sec-title">{fr ? 'Profil de Vitesse par Répétition' : 'Rep-by-Rep Velocity Profile'}</span>
              <span className="sh-sec-sub">{fr ? 'Ralentissement vs rep la plus rapide' : 'Deceleration vs fastest rep'}</span>
            </div>
            <div className="sh-vbt-strip">
              {sheet.optimization.repVelocityProfiles.map(p => (
                <div key={p.repIndex} className={`sh-vbt-card is-${p.tier}`}>
                  <div className="sh-vbt-card-head">
                    <span className="sh-vbt-num">R{p.repIndex}</span>
                    <span className="sh-vbt-loss">{p.velocityLossPercent}%</span>
                  </div>
                  <div className="sh-vbt-track"><div className="sh-vbt-bar" style={{ width: `${Math.max(12, Math.min(100, p.velocityLossPercent))}%` }} /></div>
                  <div className="sh-vbt-times">
                    <span>{p.concentricSec > 0 ? `${p.concentricSec}s` : '—'}</span>
                    <span>{p.powerWatts ? `${p.powerWatts}W` : (p.romDegrees > 0 ? `${Math.round(p.romDegrees)}°` : '')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Sticking Point */}
        {sheet.optimization?.stickingPointSummary && (
          <div className="sh-sticking-box" data-testid="sh-sticking-box">
            <div className="sh-sticking-head">
              <span className="sh-sticking-badge">{fr ? 'Point de blocage' : 'Sticking Point'}</span>
              <span className="sh-sticking-title">{fr ? 'Ralentissement biomécanique' : 'Biomechanical Deceleration'}</span>
            </div>
            <p className="sh-sticking-desc">{sheet.optimization.stickingPointSummary}</p>
          </div>
        )}

        {/* 5. Hypertrophy Recommendations */}
        {sheet.optimization?.coachingPoints?.length > 0 && (
          <div className="sh-coaching-section" data-testid="sh-coaching-section">
            <span className="sh-sec-title">{fr ? 'Recommandations hypertrophie' : 'Hypertrophic Stimulus Cues'}</span>
            <ul className="sh-cues-list">
              {sheet.optimization.coachingPoints.map((cue, idx) => (
                <li key={idx} className="sh-cue-item">
                  <span className="sh-cue-bullet">•</span>
                  <span>{cue}</span>
                </li>
              ))}
            </ul>
            {sheet.optimization.targetMuscles?.length > 0 && (
              <div className="sh-target-muscles">
                <em>{fr ? 'Muscles cibles\u00A0:' : 'Target muscles:'}</em>
                <span>{sheet.optimization.targetMuscles.join(', ')}</span>
              </div>
            )}
          </div>
        )}
        {/* The set's two figures, set like the count, under it. */}
        {sheet.stats.length > 0 && <div className="sh-stats" data-testid="sh-stats">
          {sheet.stats.map(([label, value]) => <span key={label}><em>{label}</em><b>{value}</b></span>)}
        </div>}
        {sheet.wave && <div className="sh-wave" data-testid="sh-wave"><RepWave angles={sheet.wave.a} timestamps={sheet.wave.t} reps={sheet.wave.reps} rest={sheet.wave.rest} first={sheet.wave.first} sel={-1} shown={sheet.wave.reps.length} fr={fr} jointWord={sheet.wave.jointWord} onSelect={() => {}} reference={sheet.wave.reference} /></div>}
        {sheet.rows.length > 0 && <table className="sh-table">
          <thead><tr>{sheet.columns.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
          <tbody>{sheet.rows.map(row => <tr key={row[0]}>{row.map((v, k) => <td key={k}>{v}</td>)}</tr>)}</tbody>
        </table>}
        {(sheet.shortRepNote || sheet.partialRepNote) && <p className="sh-foot-notes">{[sheet.shortRepNote, sheet.partialRepNote].filter(Boolean).join('   ')}</p>}
        {sheet.more.map(line => <p key={line} className="sh-line">{line}</p>)}
        {sheet.guide && <MeasureGuide guide={sheet.guide} />}
        {sheet.notes && <div className="sh-notes"><em>{sheet.notesLabel}</em><p>{sheet.notes}</p></div>}
        {sheet.foot && <p className="sh-foot">{sheet.foot}</p>}
        {/* Experimental, at the foot of the sheet as at the foot of every PDF page (R8). */}
        {sheet.experimental && <p className="sh-exp" data-testid="sh-exp">{sheet.experimental}</p>}
      </article>

      <div className="report-custom-drawer" data-reveal style={{ '--i': 3 }}>
        <div className="report-custom-head">
          <div className="report-custom-title-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="report-custom-icon">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <div className="report-custom-title">{fr ? 'Personnaliser le rapport' : 'Customize report'}</div>
          </div>
          <p className="report-custom-sub">{fr ? 'Complétez vos notes athlète, vos ressentis et vos informations d’entraînement.' : 'Add your athlete notes, perceived exertion, and session context.'}</p>
        </div>
        <div className="field">
          <label htmlFor="fName">{fr ? 'Votre nom' : 'Your name'}</label>
          <input id="fName" type="text" autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint="next" maxLength={NAME_MAX}
            placeholder={fr ? 'Prénom et nom' : 'First and last name'} value={name} onChange={e => setName(e.target.value)} onKeyDown={next(notesRef)} />
        </div>
        <Choice id="fWith" label={fr ? 'Entraînement' : 'Training'} value={context} onChange={v => { setContext(v); setPartner(''); }}
          options={[['alone', fr ? 'En solo' : 'Alone'], ['friend', fr ? 'En binôme' : 'With a friend'], ['coach', fr ? 'Avec un coach' : 'With a coach'], ['physio', fr ? 'Séance kiné' : 'Physiotherapy']]} pairs />
        {(context === 'friend' || context === 'coach' || context === 'physio') && <div className="field fade-in">
          <label htmlFor="fPartner">{context === 'physio' ? (fr ? 'Nom du kinésithérapeute' : 'Physiotherapist’s name') : context === 'coach' ? (fr ? 'Nom du coach' : 'Coach’s name') : (fr ? 'Nom du partenaire' : 'Friend’s name')}</label>
          <input id="fPartner" ref={partnerRef} type="text" autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck={false} enterKeyHint="next" maxLength={NAME_MAX}
            placeholder={fr ? 'Prénom et nom' : 'First and last name'} value={partner} onChange={e => setPartner(e.target.value)} onKeyDown={next(notesRef)} />
        </div>}
        <Choice id="fLevel" label={fr ? 'Niveau' : 'Level'} value={level} onChange={setLevel}
          options={[['beginner', fr ? 'Débutant' : 'Beginner'], ['intermediate', fr ? 'Intermédiaire' : 'Intermediate'], ['expert', fr ? 'Confirmé' : 'Expert']]} />
        <Choice id="fPain" label={fr ? 'Douleur ressentie, de 0 à 10' : 'Pain felt, from 0 to 10'} value={pain === null ? '' : String(pain)} onChange={v => setPain(v === '' ? null : Number(v))}
          options={Array.from({ length: 11 }, (_, i) => [String(i), String(i)])} cols={6} />
        <Choice id="fRpe" label={fr ? 'Effort perçu (RPE)' : 'Perceived exertion (RPE)'} value={rpe === null ? '' : String(rpe)} onChange={v => setRpe(v === '' ? null : Number(v))}
          options={[['6', '6'], ['7', '7'], ['8', '8'], ['9', '9'], ['10', '10']]} cols={5} />
        <div className="field">
          <label htmlFor="fNotes">Notes</label>
          <textarea id="fNotes" ref={notesRef} rows="3" autoCapitalize="sentences" maxLength={NOTES_MAX}
            placeholder={fr ? 'Observations, consignes pour la prochaine séance…' : 'Observations, instructions for the next session…'} value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="share-bar">
        <p className="share-note" role="status">{note}</p>
        <button type="button" className={`btn-primary press${busy ? ' is-busy' : ''}`} aria-disabled={busy || undefined} onClick={share}>
          {status === 'ready' && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15V3.5" /><path d="M7.5 8L12 3.5 16.5 8" /><path d="M5 12v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12" /></svg>}
          <span>{status === 'ready' ? (fr ? 'Partager le PDF' : 'Share the PDF')
            : busy ? (fr ? 'Préparation du PDF…' : 'Preparing the PDF…')
              : (fr ? 'Réessayer' : 'Try again')}</span>
        </button>
        <button type="button" className="text-btn press report-json-btn" onClick={exportJson} data-testid="report-export-json">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          {/* Awaiting David's approval of the words (R10). */}
          <span>{fr ? 'Mesures de la série (JSON)' : 'Set measures (JSON)'}</span>
        </button>
      </div>
    </div></section>
  </div>;
}

// One answer among a few, or none: a second tap on the chosen one clears it, since every answer is optional. cols: a
// scale's keys to a row (Report.css, is-scale), the last row centred: effort's five on one row, pain's eleven as 6 + 5.
// pairs: four answers as two rows of two (Training), so none stands alone on a second row.
function Choice({ id, label, value, onChange, options, cols = 0, pairs = false }) {
  return <div className="field">
    <span className="field-label" id={id}>{label}</span>
    <div className={`report-seg${cols ? ' is-scale' : pairs ? ' is-pairs' : ''}`} style={cols ? { '--cols': cols } : undefined} role="group" aria-labelledby={id}>
      {options.map(([key, text]) => <button key={key} type="button" className="press" aria-pressed={value === key}
        onClick={() => onChange(value === key ? '' : key)}>{text}</button>)}
    </div>
  </div>;
}
