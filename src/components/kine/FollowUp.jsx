import { useState } from 'react';
import { hapticLight } from '../../lib/haptics';
import { GroupHead, Verdict } from '../experience/Showcase';
import { exerciseById } from '../../lib/kine/library';
import { RESULT_KEY, payloadAfter, unpack } from '../../lib/kine/links';
import { followUp, forgetPatient, keepResult, sessionWithin } from '../../lib/kine/store';
import { TOLERANCE_DEG, TOLERANCE_SHARE } from '../../lib/reference/compare';
import { COPY, JOINT_NAMES, pct } from '../reference/reference-copy';

// The physiotherapist's follow-up (#kine, tab "Suivi"): the results patients sent back, kept on this phone when opened
// (KineResult.jsx) or pasted here, by patient and exercise, attempt after attempt. Only the figures the result link
// carries (lib/kine/links.js cleanResult): verdict, share within tolerance and range reached per measure, positions
// held. The tolerance stays provisional and is said so (R8); nothing leaves the phone but the PDF the physiotherapist
// exports.

const when = (iso, fr) => (iso ? new Date(iso).toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');

// The share within tolerance of each measure, attempt after attempt, with the verdict's threshold.
function Trend({ sessions, names, k, fr }) {
  const W = 320, H = 110, pad = 8;
  const measures = [...new Set(sessions.flatMap(s => s.joints.map(j => j.name)))];
  if (sessions.length < 2 || !measures.length) return null;
  const x = i => pad + (i / (sessions.length - 1)) * (W - 2 * pad);
  const y = v => pad + (1 - v) * (H - 2 * pad);
  return <figure className="rc-chart kn-trend">
    <figcaption>{k.fTrend}</figcaption>
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={k.fTrend}>
      <line x1={pad} x2={W - pad} y1={y(TOLERANCE_SHARE)} y2={y(TOLERANCE_SHARE)} className="kn-threshold" />
      {measures.map((m, n) => {
        const pts = sessions.map((s, i) => [i, s.joints.find(j => j.name === m)?.within]).filter(([, v]) => v != null);
        return <g key={m} className={`kn-series is-${n % 3}`}>
          <path d={pts.map(([i, v], p) => `${p ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')} />
          {pts.map(([i, v]) => <circle key={i} cx={x(i)} cy={y(v)} r="2.6" />)}
        </g>;
      })}
    </svg>
    <p className="rc-legend">{measures.map((m, n) => <span key={m} className="kn-legend"><span className={`rc-key kn-key is-${n % 3}`} />{names[m] || m}</span>)}<span className="kn-legend"><span className="rc-key kn-key is-threshold" />{k.fThreshold} {pct(TOLERANCE_SHARE, fr)}</span></p>
  </figure>;
}

function Exercise({ id, sessions, fr, k, c, names }) {
  const ex = exerciseById(id);
  const first = sessionWithin(sessions[0]), last = sessionWithin(sessions.at(-1));
  return <section className="sc-section" data-testid={`kn-follow-ex-${id}`}>
    <GroupHead title={`${ex[fr ? 'fr' : 'en'].title} · ${k.fCount(sessions.length)}`} />
    {sessions.length > 1 && first != null && last != null && <p className="sc-caption" data-testid={`kn-follow-progress-${id}`}>{k.fFromTo(pct(first, fr), pct(last, fr))}</p>}
    <Trend sessions={sessions} names={names} k={k} fr={fr} />
    <ul className="kn-sessions">
      {[...sessions].reverse().map((s, i) => {
        const held = s.holds.filter(h => h.status === 'held').length;
        return <li key={i} className="kn-session">
          <span className="kn-session-head"><b>{when(s.date, fr)}</b><Verdict ok={s.verdict === 'match'}>{s.verdict === 'match' ? c.match : s.verdict === 'revise' ? c.revise : c.refused}</Verdict></span>
          {s.joints.map(j => <span key={j.name} className="kn-session-row">{names[j.name] || j.name}<small>{k.rWithin} {j.within == null ? '–' : pct(j.within, fr)} · {k.rRange} {j.range == null ? '–' : pct(Math.min(j.range, 9.99), fr)}</small></span>)}
          {s.holds.length > 0 && <span className="kn-session-row"><small>{k.fHolds(held, s.holds.length)}</small></span>}
        </li>;
      })}
    </ul>
  </section>;
}

export default function FollowUp({ fr, k, profile, initial = null }) {
  const c = COPY[fr ? 'fr' : 'en'], names = JOINT_NAMES[fr ? 'fr' : 'en'];
  const [patients, setPatients] = useState(() => followUp());
  const [open, setOpen] = useState(initial);
  const [paste, setPaste] = useState('');
  const [note, setNote] = useState('');
  const refresh = () => setPatients(followUp());

  const add = () => {
    hapticLight();
    const hash = paste.slice(Math.max(0, paste.indexOf('#')));
    const payload = payloadAfter(hash.startsWith('#') ? hash : `#${hash}`, RESULT_KEY);
    const r = payload ? unpack(payload) : null;
    if (!r) { setNote(k.fBad); return; }
    const kept = keepResult(r);
    setNote(kept ? k.fOk : k.fDup);
    if (kept) { setPaste(''); refresh(); }
  };

  const patient = patients.find(p => p.key === open);
  const exportPdf = async () => {
    hapticLight();
    const { followUpPdf } = await import('../../lib/kine/pdf');
    followUpPdf(patient, { lang: fr ? 'fr' : 'en', practitioner: profile }).save(`suivi-${(patient.name || 'patient').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.pdf`);
  };
  const forget = () => {
    if (!window.confirm(k.fForgetConfirm(patient.name || k.fNoName))) return;
    forgetPatient(patient.key);
    setOpen(null);
    refresh();
  };

  if (patient) {
    return <>
      <section className="sc-section">
        <button type="button" className="rc-link press" onClick={() => setOpen(null)} data-testid="kn-follow-all">← {k.fAll}</button>
        <h2 className="kn-follow-name" data-testid="kn-follow-patient">{patient.name || k.fNoName}</h2>
        <p className="sc-caption">{k.fCount(patient.count)} · {k.fLast(when(patient.last, fr))}</p>
      </section>
      {patient.exercises.map(e => <Exercise key={e.id} id={e.id} sessions={e.sessions} fr={fr} k={k} c={c} names={names} />)}
      <section className="sc-section">
        <p className="sc-caption">{c.note(TOLERANCE_DEG)}</p>
        <button type="button" className="rc-btn is-primary is-wide press" onClick={exportPdf} data-testid="kn-follow-pdf">{k.fPdf}</button>
        <button type="button" className="rc-link press kn-forget" onClick={forget} data-testid="kn-follow-forget">{k.fForget}</button>
      </section>
    </>;
  }

  return <>
    <section className="sc-section">
      <GroupHead title={k.fTitle} />
      <p className="sc-caption">{k.fHint}</p>
      {!patients.length && <p className="sc-frame-note" data-testid="kn-follow-empty">{k.fEmpty}</p>}
      <ul className="kn-patients">
        {patients.map(p => {
          const latest = p.exercises.flatMap(e => e.sessions).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
          return <li key={p.key}>
            <button type="button" className="kn-patient press" onClick={() => { hapticLight(); setOpen(p.key); }} data-testid={`kn-follow-open-${p.key}`}>
              <span><b>{p.name || k.fNoName}</b><small>{k.fCount(p.count)} · {k.fLast(when(p.last, fr))}</small></span>
              {latest && <Verdict ok={latest.verdict === 'match'}>{latest.verdict === 'match' ? c.match : latest.verdict === 'revise' ? c.revise : c.refused}</Verdict>}
            </button>
          </li>;
        })}
      </ul>
    </section>
    <section className="sc-section">
      <div className="kn-fields">
        <label className="kn-field"><span>{k.fPaste}</span><input value={paste} onChange={e => { setPaste(e.target.value); setNote(''); }} placeholder={k.fPastePh} data-testid="kn-follow-paste" /></label>
        <button type="button" className="rc-btn press" onClick={add} disabled={!paste.trim()} data-testid="kn-follow-add">{k.fAdd}</button>
        {note && <p className="sc-caption" role="status" data-testid="kn-follow-note">{note}</p>}
      </div>
    </section>
  </>;
}
