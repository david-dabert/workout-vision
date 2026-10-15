import { useState } from 'react';
import { useT } from '../../lib/LanguageContext';
import { eventsConfigured, eventsHost, browserRefuses, countingOff, setCountingOff } from '../../lib/events';
import { USAGE_EVENTS } from '../../../feedback-worker/usage-schema.js';
import { NOTICE, FIELD_WORDS, EVENT_WORDS, schemaFields } from './usage-notice-copy';
import './UsageNotice.css';

// The build's events URL, read here and not only in events.js, so the notice's own chunk names its host: the deploy
// job fails when VITE_EVENTS_URL is set and this chunk does not (PRIV-3; scripts/check-dist-events.mjs, which finds
// the chunk by the marker below).
const HOST = eventsHost(import.meta.env.VITE_EVENTS_URL || '');
const MARKER = 'wv-usage-notice';

/**
 * The notice of the anonymous usage counts (#comptage), reached from the line under the choice of lift and from the
 * Choice footer: what is sent (generated from usage-schema.js), what is never kept, where it goes, how to stop it.
 * listAll renders the folded steps too, for the unit test's static markup.
 */
export default function UsageNotice({ onClose, listAll = false }) {
  const { lang } = useT(), fr = lang === 'fr';
  const c = NOTICE[fr ? 'fr' : 'en'], words = FIELD_WORDS[fr ? 'fr' : 'en'], ev = EVENT_WORDS[fr ? 'fr' : 'en'];
  const [off, setOff] = useState(countingOff);
  const [steps, setSteps] = useState(false);
  const configured = eventsConfigured() && !!HOST, refused = browserRefuses();
  const toggle = () => { setCountingOff(!off); setOff(!off); };
  const names = Object.keys(USAGE_EVENTS);
  return <div className="wv-experience">
    <section className="screen is-active usage-notice-screen" data-notice={MARKER} data-testid="usage-notice"><div className="wrap">
      <div className="topbar">
        <button className="icon-btn press" onClick={onClose} aria-label={c.back}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button>
        <span className="pill">{c.kicker}</span>
      </div>
      <h1 className="title un-title" data-reveal style={{ '--i': 0 }}>{c.title}</h1>
      {!configured ? <p className="un-lead" data-reveal style={{ '--i': 1 }}>{c.none}</p> : <>
        <p className="un-lead" data-reveal style={{ '--i': 1 }}>{c.lead}</p>
        <div className="un-body" data-reveal style={{ '--i': 2 }}>
          {/* The switch first, in view on every size; then what is sent, what is never kept, and where. */}
          <h2 className="un-h">{c.stop}</h2>
          <div className="un-stop">
            <p className="un-state" role="status">{refused ? c.stateBrowser : off ? c.stateOff : c.stateOn}</p>
            {!refused && <button type="button" className={`un-toggle press${off ? '' : ' is-on'}`} onClick={toggle} aria-pressed={!off}
              aria-label={off ? c.turnOnLabel : c.turnOffLabel} data-testid="usage-notice-toggle">{off ? c.turnOn : c.turnOff}</button>}
          </div>
          <p className="un-note">{c.stopText}</p>

          <h2 className="un-h">{c.sent}</h2>
          <dl className="un-fields" data-testid="usage-notice-fields">
            {schemaFields().map(f => <div key={f} className="un-field" data-field={f}>
              <dt>{words[f][0]}</dt>
              <dd>{words[f][1] ?? null}</dd>
            </div>)}
          </dl>
          {/* The steps, folded: rendered only once opened, so a closed list holds no hidden text. */}
          <details className="un-events" onToggle={e => setSteps(e.currentTarget.open)}>
            <summary className="press">{c.events(names.length)}</summary>
            {(steps || listAll) && <ul>{names.map(n => <li key={n} data-event={n}>{ev[n]}</li>)}</ul>}
          </details>

          <h2 className="un-h">{c.never}</h2>
          <p className="un-p">{c.neverText}</p>

          <h2 className="un-h">{c.where}</h2>
          <p className="un-p" data-testid="usage-notice-host">{c.whereText(HOST)}</p>

        </div>
      </>}
    </div></section>
  </div>;
}
