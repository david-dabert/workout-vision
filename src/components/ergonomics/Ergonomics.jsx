import { useState, useMemo, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { calculateNioshLifting, FREQUENCIES } from '../../lib/ergonomics';
import { hapticLight } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { Topbar, Verdict, GroupHead, Metric, Range } from '../experience/Showcase';
import { num } from '../experience/showcase-text';
import NioshProduct from './NioshProduct';
import { COPY } from './niosh-copy';
import './Ergonomics.css';

// Calculateur NIOSH (honesty pass of 14 October 2026, ERG-1 to ERG-4): the revised NIOSH lifting equation on the values
// the person sets (src/lib/ergonomics/niosh.ts, Waters et al. 1993; status literature), every multiplier shown as a
// worked product, NIOSH's own reading of the lifting index, and a lift outside the equation said as such. Gone: the
// invented L5/S1 "compression" and its verdict, the drawing that did not follow the posture, the "vision" and "HUD"
// tabs (nothing is read from a camera), the GDPR card, "Conforme", "Enterprise Biomechanics", and an opening state
// that did not match the example highlighted. Second review (14 October 2026): a lift outside the domain shows no limit
// in the worked product either (it printed "= 0 kg" under "aucune limite"); the frequency rows say "levée".
// French awaiting David's approval (R10).

const EXAMPLES = [
  { id: 'twist_pallet', fr: 'Palettisation avec torsion', en: 'Palletising with a twist', load: 18, H: 45, V: 70, D: 40, A: 45 },
  { id: 'floor_lift', fr: 'Prise au sol', en: 'Lift from the floor', load: 20, H: 38, V: 22, D: 65, A: 0 },
  { id: 'conveyor_reach', fr: 'Convoyeur, bras tendus', en: 'Conveyor, arms out', load: 14, H: 52, V: 85, D: 30, A: 10 },
  { id: 'overhead_shelf', fr: 'Étagère en hauteur', en: 'High shelf', load: 12, H: 42, V: 140, D: 45, A: 5 },
];

export default function Ergonomics({ onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const c = COPY[fr ? 'fr' : 'en'];
  // The screen opens on the example it highlights (ERG-4: the state and the highlighted example disagreed).
  const first = EXAMPLES[0];
  const [example, setExample] = useState(first.id);
  const [load, setLoad] = useState(first.load);
  const [H, setH] = useState(first.H);
  const [V, setV] = useState(first.V);
  const [D, setD] = useState(first.D);
  const [A, setA] = useState(first.A);
  const [freq, setFreq] = useState(0.2);
  const [duration, setDuration] = useState('short');
  const [coupling, setCoupling] = useState('good');
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);

  const r = useMemo(() => calculateNioshLifting({
    loadWeightKg: load, horizontalDistanceCm: H, verticalOriginCm: V, verticalTravelDistanceCm: D, asymmetryAngleDeg: A,
    frequencyLiftsPerMin: freq, duration, couplingQuality: coupling,
  }), [load, H, V, D, A, freq, duration, coupling]);

  const pick = (e) => { hapticLight(); setExample(e.id); setLoad(e.load); setH(e.H); setV(e.V); setD(e.D); setA(e.A); };
  const set = (fn) => (ev) => { setExample(''); fn(Number(ev.target.value)); };
  const rows = [
    ['HM', r.horizontalMultiplierHM, `H = ${H}\u00A0cm`],
    ['VM', r.verticalMultiplierVM, `V = ${V}\u00A0cm`],
    ['DM', r.distanceMultiplierDM, `D = ${D}\u00A0cm`],
    ['AM', r.asymmetricMultiplierAM, `A = ${A}°`],
    ['FM', r.frequencyMultiplierFM, c.perMin(freq)],
    ['CM', r.couplingMultiplierCM, c[coupling]],
  ];
  const verdict = r.riskCategory === 'nominal' ? c.nominal : r.riskCategory === 'increased' ? c.increased : c.high;

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen ergo-screen" data-testid="ergonomics-screen">
        <div className="wrap">
          <Topbar fr={fr} backTestId="ergo-back-btn" onBack={onClose || (() => { window.location.hash = ''; })} />

          <p className="eyebrow" data-reveal style={{ '--i': 0 }}>{c.eyebrow}</p>
          <h1 className="title" data-reveal style={{ '--i': 0 }}>{c.title}</h1>
          <p className="sub" data-reveal style={{ '--i': 1 }}>{c.sub}</p>

          <div className="sc-section" data-reveal style={{ '--i': 2 }}>
            <div className="sc-rail" role="group" aria-label={c.examples}>
              {EXAMPLES.map(e => (
                <button key={e.id} type="button" className="sc-chip press" aria-pressed={example === e.id} onClick={() => pick(e)} data-testid={`preset-${e.id}`}>
                  {fr ? e.fr : e.en}
                </button>
              ))}
            </div>
          </div>

          <section className="sc-section" data-reveal style={{ '--i': 3 }}>
            <GroupHead title={c.result} />
            {r.riskCategory === 'outside' ? (
              <p className="sc-frame-note" data-testid="ergo-outside">{c.outside(r.outside.map(f => c.factors[f]).join(', '))}</p>
            ) : (
              <div className="sc-metrics">
                <Metric label={c.rwl} value={num(r.recommendedWeightLimitKg, fr)} unit="kg" sub={c.load(num(load, fr))} testId="ergo-rwl-value" />
                <Metric label={c.li} value={num(r.liftingIndexLI, fr)} testId="ergo-li-value">
                  <Verdict ok={r.riskCategory === 'nominal'}>{verdict}</Verdict>
                </Metric>
              </div>
            )}
          </section>

          <NioshProduct r={r} rows={rows} c={c} fr={fr} />

          <section className="sc-section ergo-controls">
            <GroupHead title={c.settings} />
            <div className="sc-ranges">
              <Range label={c.sLoad} display={`${num(load, fr)}\u00A0kg`} min="1" max="50" step="1" value={load} onChange={set(setLoad)} testId="slider-load" />
              <Range label={c.sH} display={`${H}\u00A0cm`} min="20" max="70" step="1" value={H} onChange={set(setH)} testId="slider-h" />
              <Range label={c.sV} display={`${V}\u00A0cm`} min="0" max="180" step="5" value={V} onChange={set(setV)} testId="slider-v" />
              <Range label={c.sD} display={`${D}\u00A0cm`} min="25" max="180" step="5" value={D} onChange={set(setD)} testId="slider-d" />
              <Range label={c.sA} display={`${A}°`} min="0" max="140" step="5" value={A} onChange={set(setA)} testId="slider-a" />
            </div>
            <div className="ergo-selects">
              <label className="ergo-select"><span>{c.sF}</span>
                <select value={freq} onChange={e => setFreq(Number(e.target.value))} data-testid="select-frequency">
                  {FREQUENCIES.map(f => <option key={f} value={f}>{c.perMin(f)}</option>)}
                </select>
              </label>
              <label className="ergo-select"><span>{c.sDur}</span>
                <select value={duration} onChange={e => setDuration(e.target.value)} data-testid="select-duration">
                  <option value="short">{c.durShort}</option>
                  <option value="moderate">{c.durModerate}</option>
                  <option value="long">{c.durLong}</option>
                </select>
              </label>
              <label className="ergo-select"><span>{c.sC}</span>
                <select value={coupling} onChange={e => setCoupling(e.target.value)} data-testid="select-coupling">
                  <option value="good">{c.good}</option>
                  <option value="fair">{c.fair}</option>
                  <option value="poor">{c.poor}</option>
                </select>
              </label>
            </div>
            <p className="sc-caption">{c.source}</p>
          </section>
        </div>
      </section>
    </div>
  );
}
