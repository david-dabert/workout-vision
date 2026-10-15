import { useMemo, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import { useCondensingTopbar } from '../experience/topbar';
import { Topbar, GroupHead, Verdict } from '../experience/Showcase';
import { exerciseById } from '../../lib/kine/library';
import { RESULT_KEY, cleanResult, payloadAfter, unpack } from '../../lib/kine/links';
import { COPY, JOINT_NAMES, pct } from '../reference/reference-copy';
import { TOLERANCE_DEG } from '../../lib/reference/compare';
import { KINE } from './kine-copy';
import '../reference/ReferenceCompare.css';
import './Kine.css';

// A patient's result, opened on the physiotherapist's phone from the link the patient sent (#kine-r=<payload>,
// lib/kine/links.js): the exercise, the verdict, the tempo, each joint's share of time within tolerance and range
// reached, and the positions held. Only figures travel: no video, no skeleton.

export default function KineResult({ onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const k = KINE[fr ? 'fr' : 'en'], c = COPY[fr ? 'fr' : 'en'], names = JOINT_NAMES[fr ? 'fr' : 'en'];
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);
  const r = useMemo(() => cleanResult(unpack(payloadAfter(window.location.hash, RESULT_KEY))), []);
  const ex = r ? exerciseById(r.id) : null;
  const when = r?.date ? new Date(r.date).toLocaleString(fr ? 'fr-FR' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen rc-screen kn-screen" data-testid="kine-result-screen">
        <div className="wrap">
          <Topbar fr={fr} backTestId="kine-result-back-btn" onBack={onClose || (() => { window.location.hash = ''; })} />
          {!r || !ex ? <p className="sc-frame-note" data-testid="kn-bad-result">{k.rBad}</p> : <>
            <p className="eyebrow">{k.rEyebrow}{when ? ` · ${when}` : ''}</p>
            <h1 className="title">{k.rTitle(r.patient, ex[fr ? 'fr' : 'en'].title)}</h1>
            <p className={`rc-verdict is-${r.verdict}`} data-testid="kn-result-verdict">{r.verdict === 'match' ? c.match : r.verdict === 'revise' ? c.revise : c.refused}</p>
            {r.tempo != null && <p className="sub">{k.rTempo(r.tempo)}</p>}
            {r.joints.length > 0 && <section className="sc-section">
              <GroupHead title={c.joints} />
              <ul className="rc-joints">{r.joints.map(j => <li key={j.name}>
                <b>{names[j.name] || j.name}</b>
                <span><small>{k.rWithin}</small>{j.within == null ? '–' : pct(j.within, fr)}</span>
                <span><small>{k.rRange}</small>{j.range == null ? '–' : pct(Math.min(j.range, 9.99), fr)}</span>
              </li>)}</ul>
            </section>}
            {r.holds.length > 0 && <section className="sc-section">
              <GroupHead title={k.rHolds} />
              <ul className="rc-holds">{r.holds.map((h, i) => <li key={i}><div className="rc-hold">
                <span className="rc-hold-name">{c.holdRow(i)}</span>
                <span className="rc-hold-vals"><small>{c.holdRef(h.ref, h.refSec)}</small><small>{c.holdAtt(h.att, h.attSec)}</small></span>
                <Verdict ok={h.status === 'held'}>{h.status === 'held' ? c.holdOk : h.status === 'short' ? c.holdShort : c.holdOff}</Verdict>
              </div></li>)}</ul>
            </section>}
            <p className="sc-caption">{c.note(TOLERANCE_DEG)}</p>
          </>}
        </div>
      </section>
    </div>
  );
}

