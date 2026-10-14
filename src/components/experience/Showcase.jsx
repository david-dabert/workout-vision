import { useId } from 'react';
import './Showcase.css';
import { NBSP } from './showcase-text';

// The parts the showcase screens share (Sports, Equine, coaches, buddies, ergonomics, chat): the topbar with Back,
// a group's head, a value under its label, a slider and the demo badge, in the design system's tokens (Showcase.css,
// design/SYSTEM.md). Presentation only: nothing here computes or changes a value.
// Status: convention (the app's design system; no measurement involved).

export const BackIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>;

/** The topbar of every screen (Guide, Pro, About): Back on the left; a pill or compact actions on the right. */
export function Topbar({ fr, onBack, backTestId, children }) {
  return <div className="topbar">
    <button type="button" className="icon-btn press" onClick={onBack} aria-label={fr ? 'Retour' : 'Back'} data-testid={backTestId}><BackIcon /></button>
    {children ? <div className="sc-topbar-end">{children}</div> : null}
  </div>;
}

/** The badge beside a group of values fixed in the code rather than measured from the person's video (R8). */
export const DemoTag = ({ fr }) => <span className="sc-tag is-demo" data-testid="demo-badge">{fr ? 'Démo' : 'Demo'}</span>;

/** A verdict as a tag: an ok verdict in ash, one that asks for attention in the gold outline. */
export const Verdict = ({ ok, children, testId }) => <span className={`sc-tag ${ok ? 'is-good' : 'is-warn'}`} data-testid={testId}>{children}</span>;

/** A group's head: its name over a hairline, its tags (verdict, demo) on the right. */
export function GroupHead({ title, as: Heading = 'h2', children }) {
  return <div className="sc-head">
    <Heading className="sc-head-title">{title}</Heading>
    {children ? <span className="sc-head-tags">{children}</span> : null}
  </div>;
}

/** One value: its label above it, the value in tabular figures, a no-break space before its unit (none before °). */
export function Metric({ label, value, unit, text = false, wide = false, sub, children, testId }) {
  return <div className={`sc-metric${wide ? ' is-wide' : ''}`} data-testid={testId}>
    <span className="sc-metric-label">{label}</span>
    <span className={`sc-metric-value${text ? ' is-text' : ''}`}>{value}{unit === '°' ? unit : unit ? <span className="sc-unit">{NBSP}{unit}</span> : null}</span>
    {sub ? <span className="sc-metric-sub">{sub}</span> : null}
    {children}
  </div>;
}

/** A slider: its label and value on one line above the track; the track fills up to the value. */
export function Range({ label, display, min, max, step, value, onChange, testId }) {
  const id = useId();
  const span = Number(max) - Number(min);
  const p = span > 0 ? Math.max(0, Math.min(100, ((Number(value) - Number(min)) / span) * 100)) : 0;
  return <div className="sc-range">
    <label className="sc-range-head" htmlFor={id}><span>{label}</span><output className="sc-range-val" htmlFor={id}>{display}</output></label>
    <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={onChange} style={{ '--p': `${p}%` }} data-testid={testId} />
  </div>;
}
