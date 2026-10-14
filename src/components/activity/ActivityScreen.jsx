import { useMemo, useRef, useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { hapticLight } from '../../lib/haptics';
import { volleyballDemo } from '../../lib/activity/demo';
import { useCondensingTopbar } from '../experience/topbar';
import { Topbar, DemoTag, GroupHead, Metric } from '../experience/Showcase';
import { num, NBSP } from '../experience/showcase-text';
import { ACTIVITY_COPY } from './activity-copy';
import './ActivityScreen.css';

// The activity screen (docs/VISION.md, "The screens"): any activity specification (src/lib/activity/types.ts) and the
// engine's result on it, every measure with its margin or the reason it is withheld (R8), every count with how it was
// checked. ActivityView knows no sport: it reads the specification's labels, formulas, R9 statuses and error notes.
// ActivityScreen runs a demonstration on synthetic movement with known truth (src/lib/activity/demo.ts), so every
// number it shows sits beside its truth and its verdict: inside or outside the margin, a count exact or wrong.

/** The demonstrations the screen can open, by page. */
const DEMOS = { volleyball: volleyballDemo };

// Decimals shown per unit: a centimetre to the millimetre, a time to the hundredth. Status: convention (display only).
const PLACES = { cm: 1, s: 2 };
const placesOf = unit => PLACES[unit] ?? 2;
const fmt = (v, d, fr) => num(v.toFixed(d), fr);
/** A margin rounded up at the precision shown, never to zero: the margin written is never smaller than the one computed. */
const fmtMargin = (m, d, fr) => { const k = 10 ** d; return fmt(Math.max(1, Math.ceil(m * k - 1e-9)) / k, d, fr); };
const withUnit = (text, unit) => (unit ? `${text}${NBSP}${unit}` : text);

/** What a measure shows: a number with its margin, a count, or no number and why. */
function shownOf(m, spec, lang) {
  const isCount = spec.measures.find(s => s.key === m.key)?.formula.kind === 'count';
  if (m.value === null) return { shown: false, reason: m.refused?.[lang] ?? null };
  if (isCount) return { shown: true, isCount };
  if (m.margin === null) return { shown: false, reason: ACTIVITY_COPY[lang].noMargin };
  return { shown: true, isCount };
}

function MeasureTile({ m, spec, truth, lang }) {
  const fr = lang === 'fr', c = ACTIVITY_COPY[lang], d = placesOf(m.unit);
  const { shown, isCount, reason } = shownOf(m, spec, lang);
  const value = !shown ? c.noNumber : isCount ? String(m.value) : `${fmt(m.value, d, fr)}${NBSP}±${NBSP}${fmtMargin(m.margin, d, fr)}`;
  const t = shown && truth ? truth.value : null;
  const inside = t !== null && (isCount ? t === m.value : Math.abs(m.value - t) <= m.margin);
  const verdict = isCount ? (inside ? c.countRight : c.countWrong) : inside ? c.inside : c.outside;
  return <Metric wide label={m.label[lang]} value={value} unit={shown && !isCount ? m.unit : null} text={!shown} testId={`activity-measure-${m.key}`}>
    {t !== null ? <span className="act-truth" data-testid={`activity-truth-${m.key}`}>
      {c.truth(isCount ? String(t) : withUnit(fmt(t, d, fr), m.unit))}, <span className={inside ? '' : 'act-out'} data-testid={`activity-verdict-${m.key}`}>{verdict}</span>
    </span> : null}
    {reason ? <span className="act-reason" data-testid={`activity-refused-${m.key}`}>{reason}</span> : null}
    {shown && m.scope ? <span className="act-reason" data-testid={`activity-scope-${m.key}`}>{m.scope[lang]}</span> : null}
    <span className="act-note">{m.error.note[lang]}</span>
    {/* The status keeps to its dot: a no-break space, so it never sits alone on the last line. */}
    <span className="act-formula">{m.formulaText[lang]} ·{NBSP}{c.status[m.status]}</span>
  </Metric>;
}

/**
 * Each event's values, with their truths: one row per event of the activity's counted event, one column per measure.
 * A cell holds the value with its margin, then its truth and its verdict, so the table stays three columns wide. A
 * measure whose summary is refused (the best jump cannot be named) still has its column: the engine keeps each value
 * it measured. A cell without a value says why under "no number", in the engine's words for that event (R8). At
 * phone width a measure that does not apply to an event takes no room in its card, unless no measure applies to it,
 * so a card never holds its title alone.
 */
function EventTable({ result, spec, truth, lang }) {
  const fr = lang === 'fr', c = ACTIVITY_COPY[lang];
  const of = spec.measures.find(s => s.formula.kind === 'count')?.of ?? spec.measures[0]?.of;
  const events = result.events[of] ?? [];
  const cols = result.measures.filter(m => {
    const s = spec.measures.find(x => x.key === m.key);
    return s && s.of === of && s.formula.kind !== 'count' && m.values.length && m.values.every(v => v.margin !== null);
  });
  if (!events.length || !cols.length) return null;
  const nameOf = m => (spec.measures.find(x => x.key === m.key)?.each ?? m.label)[lang];
  return <section className="sc-section" data-testid="activity-events">
    <GroupHead title={c.eachHead} />
    <table className="sc-table">
      <thead><tr><th scope="col">{c.eventCol}</th>{cols.map(m => <th key={m.key} scope="col">{nameOf(m)}</th>)}</tr></thead>
      <tbody>
        {events.map((_, i) => {
          // Neither a value nor a truth: the measure does not apply to this event (a standing jump has no run-up).
          const na = m => !m.values.some(x => x.event === i) && truth && (truth?.[m.key]?.byEvent?.[i] ?? null) === null;
          const none = cols.every(na);
          return <tr key={i} className={none ? 'act-none' : undefined}>
            <td>{c.event(i + 1)}</td>
            {cols.map(m => {
              const v = m.values.find(x => x.event === i), d = placesOf(m.unit);
              const t = truth?.[m.key]?.byEvent?.[i] ?? null;
              if (na(m)) return <td key={m.key} className="act-na" data-label={nameOf(m)}>{none ? c.notApplicable : <span aria-hidden="true">–</span>}</td>;
              // A value where the truth has none (a run-up read on a standing jump) is outside any margin.
              const inside = v && t !== null && Math.abs(v.value - t) <= v.margin;
              const why = v ? null : m.withheld?.find(x => x.event === i)?.reason[lang] ?? null;
              return <td key={m.key} data-label={nameOf(m)}>
                <span>{v ? withUnit(`${fmt(v.value, d, fr)}${NBSP}±${NBSP}${fmtMargin(v.margin, d, fr)}`, m.unit) : c.noNumber}</span>
                {why ? <span className="act-in" data-testid={`activity-withheld-${m.key}-${i + 1}`}>{why}</span> : null}
                {truth ? <span className="act-in">{c.truth(t !== null ? withUnit(fmt(t, d, fr), m.unit) : c.none)}</span> : null}
                {truth && v ? <span className={`act-in${inside ? '' : ' act-out'}`}>{inside ? c.inside : c.outside}</span> : null}
              </td>;
            })}
          </tr>;
        })}
      </tbody>
    </table>
  </section>;
}

/** Any activity's result: its measures, each with its margin or the reason it is withheld, then each event's values. */
export function ActivityView({ spec, result, truth = null, demo = false }) {
  const { lang } = useT();
  const c = ACTIVITY_COPY[lang];
  return <>
    <section className="sc-section" data-testid="activity-results">
      <GroupHead title={c.resultsHead}>{demo ? <DemoTag fr={lang === 'fr'} /> : null}</GroupHead>
      {result.refused ? <p className="sc-text" data-testid="activity-refused">{result.refused[lang]}</p> : null}
      <div className="sc-metrics">
        {result.measures.map(m => <MeasureTile key={m.key} m={m} spec={spec} truth={truth?.[m.key] ?? null} lang={lang} />)}
      </div>
      <p className="sc-caption">{c.honest}</p>
    </section>
    <EventTable result={result} spec={spec} truth={truth} lang={lang} />
  </>;
}

/** The screen: a demonstration of an activity on synthetic movement, at the frame rate the visitor picks. */
export default function ActivityScreen({ activity = 'volleyball', onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr', c = ACTIVITY_COPY[lang];
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);
  const demo = DEMOS[activity] ?? volleyballDemo;
  const { spec } = demo;
  const [rate, setRate] = useState(demo.rate);
  const run = useMemo(() => demo.run(rate), [demo, rate]);

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen activity-screen" data-testid="activity-screen">
        <div className="wrap">
          <Topbar fr={fr} backTestId="activity-back-btn" onBack={() => { hapticLight(); if (onClose) onClose(); else window.location.hash = ''; }} />
          <p className="eyebrow" data-reveal style={{ '--i': 0 }}>{c.eyebrow}</p>
          <h1 className="title" data-reveal style={{ '--i': 0 }}>{spec.name[lang]}</h1>
          <p className="sub" data-reveal style={{ '--i': 1 }}>{spec.tagline[lang]}</p>

          <section className="sc-section" data-testid="activity-synthetic" data-reveal style={{ '--i': 2 }}>
            <div className="sc-card">
              <div className="sc-card-top">
                <h2 className="act-card-title">{c.syntheticHead}</h2>
                <DemoTag fr={fr} />
              </div>
              <p className="sc-text">{c.synthetic}</p>
              <p className="sc-caption">{c.notShown}</p>
            </div>
          </section>

          <section className="sc-section" data-reveal style={{ '--i': 3 }}>
            <GroupHead title={c.rateHead} />
            <div className="sc-seg" role="group" aria-label={c.rateGroup}>
              {demo.rates.map(r => (
                <button key={r} type="button" className="press" aria-pressed={rate === r} data-testid={`activity-rate-${r}`}
                  onClick={() => { hapticLight(); setRate(r); }}>{c.rate(r)}</button>
              ))}
            </div>
            <p className="sc-caption" data-testid="activity-made">{c.made(run.made.jumps, run.made.approaches, run.made.rate)}</p>
          </section>

          <ActivityView spec={spec} result={run.result} truth={run.truth} demo />

          <section className="sc-section">
            <GroupHead title={c.filmHead} />
            <ol className="act-steps">
              {spec.filming.map((step, i) => <li key={i} className="sc-text">{step[lang]}</li>)}
            </ol>
            <p className="sc-caption">{c.filmLater}</p>
          </section>
        </div>
      </section>
    </div>
  );
}
