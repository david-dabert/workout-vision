import { useState, useMemo, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { calculateNioshLifting, FREQUENCIES } from '../../lib/ergonomics';
import { hapticLight } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { Topbar, Verdict, GroupHead, Metric, Range } from '../experience/Showcase';
import { num } from '../experience/showcase-text';
import './Ergonomics.css';

// Calculateur NIOSH (honesty pass of 14 October 2026, ERG-1 to ERG-4): the revised NIOSH lifting equation on the values
// the person sets (src/lib/ergonomics/niosh.ts, Waters et al. 1993; status literature), every multiplier shown as a
// worked product, NIOSH's own reading of the lifting index, and a lift outside the equation said as such. Gone: the
// invented L5/S1 "compression" and its verdict, the drawing that did not follow the posture, the "vision" and "HUD"
// tabs (nothing is read from a camera), the GDPR card, "Conforme", "Enterprise Biomechanics", and an opening state
// that did not match the example highlighted. French awaiting David's approval (R10).

const EXAMPLES = [
  { id: 'twist_pallet', fr: 'Palettisation avec torsion', en: 'Palletising with a twist', load: 18, H: 45, V: 70, D: 40, A: 45 },
  { id: 'floor_lift', fr: 'Prise au sol', en: 'Lift from the floor', load: 20, H: 38, V: 22, D: 65, A: 0 },
  { id: 'conveyor_reach', fr: 'Convoyeur, bras tendus', en: 'Conveyor, arms out', load: 14, H: 52, V: 85, D: 30, A: 10 },
  { id: 'overhead_shelf', fr: 'Étagère en hauteur', en: 'High shelf', load: 12, H: 42, V: 140, D: 45, A: 5 },
];

const COPY = {
  fr: {
    eyebrow: 'Ergonomie au travail',
    title: 'Calculateur NIOSH',
    sub: 'La charge limite recommandée pour une manutention à deux mains, par l’équation révisée du NIOSH, à partir des valeurs que vous réglez. Un calcul indicatif, pas un diagnostic.',
    examples: 'Exemples',
    result: 'Résultat',
    rwl: 'Limite recommandée (RWL)',
    load: v => `Charge soulevée\u00A0: ${v}\u00A0kg`,
    li: 'Indice de levage (LI)',
    nominal: 'LI ≤\u00A01\u00A0: risque nominal selon le NIOSH',
    increased: 'LI >\u00A01\u00A0: risque accru pour une partie des personnes',
    high: 'LI >\u00A03\u00A0: risque accru pour la plupart des personnes',
    outside: list => `Hors du domaine de l’équation (${list})\u00A0: aucune limite ni indice.`,
    product: 'Le calcul',
    lowest: name => `Le coefficient le plus bas, celui qui réduit le plus la limite\u00A0: ${name}.`,
    factors: { HM: 'distance horizontale', VM: 'hauteur de départ', DM: 'course verticale', AM: 'torsion', FM: 'fréquence et durée', CM: 'qualité de la prise' },
    settings: 'Vos valeurs',
    sLoad: 'Charge', sH: 'Distance horizontale des mains (H)', sV: 'Hauteur des mains au départ (V)', sD: 'Course verticale (D)', sA: 'Angle de torsion (A)',
    sF: 'Fréquence', perMin: v => (v === 0.2 ? '1 toutes les 5\u00A0min ou moins' : `${num(v, true)} par minute`),
    sDur: 'Durée de la tâche', durShort: '1\u00A0h ou moins', durModerate: '1 à 2\u00A0h', durLong: '2 à 8\u00A0h',
    sC: 'Prise', good: 'Bonne (poignées)', fair: 'Moyenne', poor: 'Mauvaise',
    source: 'Coefficients\u00A0: Waters et al. 1993 (Ergonomics 36(7)) et le manuel d’application du NIOSH (1994, publication 94-110). Les valeurs viennent de vos réglages, pas d’une vidéo.',
  },
  en: {
    eyebrow: 'Workplace ergonomics',
    title: 'NIOSH calculator',
    sub: 'The recommended weight limit of a two-handed lift, by the revised NIOSH lifting equation, from the values you set. An indicative calculation, not a diagnosis.',
    examples: 'Examples',
    result: 'Result',
    rwl: 'Recommended limit (RWL)',
    load: v => `Load lifted: ${v} kg`,
    li: 'Lifting index (LI)',
    nominal: 'LI ≤ 1: nominal risk according to NIOSH',
    increased: 'LI > 1: increased risk for some people',
    high: 'LI > 3: increased risk for most people',
    outside: list => `Outside the equation's domain (${list}): no limit, no index.`,
    product: 'The calculation',
    lowest: name => `The lowest multiplier, the one that lowers the limit most: ${name}.`,
    factors: { HM: 'horizontal distance', VM: 'starting height', DM: 'vertical travel', AM: 'twist', FM: 'frequency and duration', CM: 'grip quality' },
    settings: 'Your values',
    sLoad: 'Load', sH: 'Horizontal distance of the hands (H)', sV: 'Height of the hands at the start (V)', sD: 'Vertical travel (D)', sA: 'Twist angle (A)',
    sF: 'Frequency', perMin: v => (v === 0.2 ? '1 every 5 min or less' : `${v} a minute`),
    sDur: 'Task duration', durShort: '1 h or less', durModerate: '1 to 2 h', durLong: '2 to 8 h',
    sC: 'Grip', good: 'Good (handles)', fair: 'Fair', poor: 'Poor',
    source: 'Multipliers: Waters et al. 1993 (Ergonomics 36(7)) and the NIOSH Applications Manual (1994, publication 94-110). The values come from your settings, not from a video.',
  },
};

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
  const n2 = v => num(v.toFixed(2), fr);
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

          <section className="sc-section ergo-product" data-testid="ergo-product">
            <GroupHead title={c.product} />
            <div className="sc-card">
              <p className="ergo-equation">RWL = 23{'\u00A0'}kg × HM × VM × DM × AM × FM × CM</p>
              <ul className="ergo-factors">
                {rows.map(([f, v, why]) => (
                  <li key={f} className={f === r.lowest ? 'is-lowest' : ''}>
                    <span className="ergo-factor-name"><b>{f}</b> {c.factors[f]}</span>
                    <span className="ergo-factor-why">{why}</span>
                    <span className="ergo-factor-val">{n2(v)}</span>
                  </li>
                ))}
              </ul>
              <p className="ergo-equation is-total">= {num(r.recommendedWeightLimitKg, fr)}{'\u00A0'}kg</p>
              <p className="sc-caption">{c.lowest(c.factors[r.lowest])}</p>
            </div>
          </section>

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
