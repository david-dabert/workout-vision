import { useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useT } from '../../lib/LanguageContext';
import { hapticLight } from '../../lib/haptics';
import { useCondensingTopbar } from '../experience/topbar';
import { Topbar, GroupHead } from '../experience/Showcase';
import { LIBRARY, exerciseById, hasMedia } from '../../lib/kine/library';
import ExerciseCard from './ExerciseCard';
import { cleanProgramme, programmeLink } from '../../lib/kine/links';
import { readProfile, saveProfile, nextInvoiceNumber, takeFollowUpRequest, EMPTY_PROFILE } from '../../lib/kine/store';
import ReferenceCompare from '../reference/ReferenceCompare';
import FollowUp from './FollowUp';
import { KINE } from './kine-copy';
import '../reference/ReferenceCompare.css';
import './Kine.css';

// The physiotherapist's workspace (#kine), built with Olivier (15 October 2026): his exercises with his videos and his
// own words, a programme composed for one patient and sent as a link (and a PDF sheet with its QR code), the note
// d'honoraires, the follow-up of the results patients send back (FollowUp.jsx), and a free comparison of two videos. Everything stays on the phone; the programme travels in its link
// (lib/kine/links.js). Exercises with no comparison say so (R8).

const today = () => new Date().toISOString().slice(0, 10);

// The QR code of the programme's link, as one SVG path (error correction L, a quiet zone of 2 modules); null when the
// link is too long for any code.
function qrPath(link) {
  if (!link) return null;
  try {
    const qr = QRCode.create(link, { errorCorrectionLevel: 'L' });
    const n = qr.modules.size;
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.modules.get(r, c)) d += `M${c + 2} ${r + 2}h1v1h-1z`;
    return { side: n + 4, d };
  } catch {
    return null;
  }
}
const baseUrl = () => `${window.location.origin}${window.location.pathname}`;

function NumberField({ label, value, onChange, min, max, testId }) {
  return <label className="kn-num"><span>{label}</span>
    <input type="number" inputMode="numeric" min={min} max={max} value={value} onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))} data-testid={testId} />
  </label>;
}

function ProgrammeTab({ fr, k, profile }) {
  const [patient, setPatient] = useState('');
  const [perDay, setPerDay] = useState(1);
  const [weeks, setWeeks] = useState(4);
  const [note, setNote] = useState('');
  const [items, setItems] = useState([]);
  const [copied, setCopied] = useState(false);
  const programme = useMemo(() => cleanProgramme({
    kine: { name: profile.name, phone: profile.phone, email: profile.email }, patient, perDay, weeks, note, items, date: today(),
  }), [profile, patient, perDay, weeks, note, items]);
  const link = programme ? programmeLink(baseUrl(), programme) : '';
  const qr = useMemo(() => qrPath(link), [link]);
  const has = id => items.some(i => i.id === id);
  const add = ex => { hapticLight(); setItems(list => (list.some(i => i.id === ex.id) ? list : [...list, { id: ex.id, reps: ex.dosage.reps, sets: ex.dosage.sets, note: '' }])); };
  const set = (id, patch) => setItems(list => list.map(i => (i.id === id ? { ...i, ...patch } : i)));
  const share = async () => {
    hapticLight();
    const text = k.shareText(patient, profile.name);
    if (navigator.share) { try { await navigator.share({ title: k.pEyebrow, text, url: link }); return; } catch { /* closed */ } }
    copy();
  };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* blocked */ } };
  const pdf = async () => {
    hapticLight();
    const { programmePdf } = await import('../../lib/kine/pdf');
    programmePdf(programme, { lang: fr ? 'fr' : 'en', link }).save(`programme-${(patient || 'patient').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.pdf`);
  };

  return <>
    <section className="sc-section">
      <div className="kn-fields">
        <label className="kn-field"><span>{k.patient}</span><input value={patient} onChange={e => setPatient(e.target.value)} placeholder={k.patientPh} data-testid="kn-patient" /></label>
        <div className="kn-row">
          <NumberField label={k.perDay} value={perDay} onChange={setPerDay} min={1} max={6} testId="kn-perday" />
          <NumberField label={k.weeks} value={weeks} onChange={setWeeks} min={1} max={52} testId="kn-weeks" />
        </div>
        <label className="kn-field"><span>{k.note}</span><textarea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder={k.notePh} /></label>
      </div>
    </section>

    <section className="sc-section">
      <GroupHead title={`${k.tabs.programme} · ${items.length}`} />
      {!items.length && <p className="sc-caption">{k.empty}</p>}
      <ol className="kn-items">
        {items.map((it, n) => {
          const ex = exerciseById(it.id), t = ex[fr ? 'fr' : 'en'];
          return <li key={it.id} className="kn-item" data-testid={`kn-item-${it.id}`}>
            <div className="kn-item-head"><b>{n + 1}. {t.title}</b><button type="button" className="rc-link press" onClick={() => setItems(list => list.filter(i => i.id !== it.id))}>{k.remove}</button></div>
            <div className="kn-row">
              <NumberField label={k.sets} value={it.sets} onChange={v => set(it.id, { sets: v })} min={1} max={20} />
              <NumberField label={k.reps} value={it.reps} onChange={v => set(it.id, { reps: v })} min={1} max={100} />
            </div>
            {ex.side && <label className="kn-field"><span>{k.side}</span>
              <select value={it.side ?? ex.side} onChange={e => set(it.id, { side: e.target.value })} data-testid={`kn-side-${it.id}`}>
                {['left', 'right'].map(s => <option key={s} value={s}>{k.sides[s]}</option>)}
              </select>
            </label>}
            <label className="kn-field"><span>{k.itemNote}</span><textarea rows={2} value={it.note} onChange={e => set(it.id, { note: e.target.value })} placeholder={k.itemNotePh} /></label>
          </li>;
        })}
      </ol>
      {programme && <div className="kn-send" data-testid="kn-send" data-link={link}>
        {qr && <svg className="kn-qr" viewBox={`0 0 ${qr.side} ${qr.side}`} role="img" aria-label={k.qrHint} data-testid="kn-qr"><rect width={qr.side} height={qr.side} fill="#FBF7EF" /><path d={qr.d} fill="#150F08" /></svg>}
        <p className="sc-caption">{k.qrHint}</p>
        <button type="button" className="rc-btn is-primary is-wide press" onClick={share} data-testid="kn-share">{k.send}</button>
        <div className="kn-row">
          <button type="button" className="rc-btn press" onClick={copy} data-testid="kn-copy">{copied ? k.copied : k.copy}</button>
          <button type="button" className="rc-btn press" onClick={pdf} data-testid="kn-pdf">{k.sheet}</button>
        </div>
      </div>}
    </section>

    <section className="sc-section">
      <GroupHead title={k.tabs.library} />
      <div className="kn-cards">
        {LIBRARY.map(ex => <ExerciseCard key={ex.id} ex={ex} fr={fr} k={k}
          action={<button type="button" className={`rc-btn press ${has(ex.id) ? '' : 'is-primary'}`} onClick={() => add(ex)} disabled={has(ex.id)} data-testid={`kn-add-${ex.id}`}>{has(ex.id) ? k.added : k.add}</button>} />)}
      </div>
    </section>
  </>;
}

function InvoiceTab({ fr, k, profile, onProfile }) {
  const [patient, setPatient] = useState('');
  const [date, setDate] = useState(today());
  const [lines, setLines] = useState([{ label: k.linePh, amount: profile.fee || 0 }]);
  const [paid, setPaid] = useState(true);
  const [method, setMethod] = useState(k.methods[0]);
  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const ready = profile.name && profile.rpps;
  const make = async () => {
    hapticLight();
    const { invoicePdf } = await import('../../lib/kine/pdf');
    const number = nextInvoiceNumber();
    invoicePdf({ number, practitioner: profile, patient, date, lines, paid, method }, { lang: fr ? 'fr' : 'en' }).save(`note-honoraires-${number}.pdf`);
  };
  if (!ready) return <section className="sc-section"><p className="sc-frame-note">{k.needProfile}</p><button type="button" className="rc-btn is-primary press" onClick={onProfile}>{k.tabs.profile}</button></section>;
  return <section className="sc-section">
    <GroupHead title={k.invoiceTitle} />
    <div className="kn-fields">
      <label className="kn-field"><span>{k.patient}</span><input value={patient} onChange={e => setPatient(e.target.value)} placeholder={k.patientPh} data-testid="kn-inv-patient" /></label>
      <label className="kn-field"><span>{k.date}</span><input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      {lines.map((l, i) => <div key={i} className="kn-row kn-line">
        <label className="kn-field"><span>{k.line}</span><input value={l.label} onChange={e => setLines(ls => ls.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} /></label>
        <label className="kn-field kn-amount"><span>{k.amount}</span><input type="number" inputMode="decimal" step="0.01" min="0" value={l.amount} onChange={e => setLines(ls => ls.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} /></label>
      </div>)}
      <button type="button" className="rc-link press" onClick={() => setLines(ls => [...ls, { label: '', amount: 0 }])}>+ {k.addLine}</button>
      <label className="rc-toggle"><input type="checkbox" checked={paid} onChange={e => setPaid(e.target.checked)} /> {k.paid}</label>
      {paid && <label className="kn-field"><span>{k.method}</span><select value={method} onChange={e => setMethod(e.target.value)}>{k.methods.map(m => <option key={m}>{m}</option>)}</select></label>}
      <p className="kn-total"><span>{k.total}</span><b>{new Intl.NumberFormat(fr ? 'fr-FR' : 'en-GB', { style: 'currency', currency: 'EUR' }).format(total)}</b></p>
      <p className="sc-caption">{k.vat}</p>
      <button type="button" className="rc-btn is-primary is-wide press" onClick={make} data-testid="kn-make-invoice">{k.makeInvoice}</button>
    </div>
  </section>;
}

function ProfileTab({ k, profile, onSave }) {
  const [p, setP] = useState(profile);
  const [saved, setSaved] = useState(false);
  return <section className="sc-section">
    <p className="sc-caption">{k.profileHint}</p>
    <div className="kn-fields">
      {Object.keys(EMPTY_PROFILE).map(key => <label key={key} className="kn-field"><span>{k.fields[key]}</span>
        <input value={p[key]} type={key === 'fee' ? 'number' : key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} onChange={e => { setSaved(false); setP({ ...p, [key]: key === 'fee' ? Number(e.target.value) || 0 : e.target.value }); }} data-testid={`kn-profile-${key}`} />
      </label>)}
      <button type="button" className="rc-btn is-primary is-wide press" onClick={() => { hapticLight(); onSave(p); setSaved(true); }} data-testid="kn-profile-save">{saved ? k.saved : k.save}</button>
    </div>
  </section>;
}

export default function KineWorkspace({ onClose }) {
  const { lang } = useT();
  const fr = lang === 'fr';
  const k = KINE[fr ? 'fr' : 'en'];
  const screenRef = useRef(null);
  useCondensingTopbar(screenRef, [lang]);
  // A result opened on this phone (KineResult.jsx) can ask for its patient's follow-up.
  const [followUpOf, setFollowUpOf] = useState(takeFollowUpRequest);
  const [tab, setTab] = useState(followUpOf != null ? 'followup' : 'programme');
  const [profile, setProfile] = useState(readProfile);
  const save = p => { saveProfile(p); setProfile(p); };

  return (
    <div className="wv-experience">
      <section ref={screenRef} className="screen is-active sc-screen rc-screen kn-screen" data-testid="kine-screen">
        <div className="wrap">
          <Topbar fr={fr} backTestId="kine-back-btn" onBack={onClose || (() => { window.location.hash = ''; })} />
          <p className="eyebrow">{k.eyebrow}</p>
          <h1 className="title">{k.title}</h1>
          <p className="sub">{k.sub}</p>
          {!hasMedia() && <p className="sc-frame-note" data-testid="kn-no-media">{k.noMedia}</p>}
          <div className="sc-section">
            <div className="sc-rail" role="tablist">
              {Object.entries(k.tabs).map(([id, label]) => <button key={id} type="button" role="tab" className="sc-chip press" aria-pressed={tab === id} aria-selected={tab === id} onClick={() => { hapticLight(); setTab(id); setFollowUpOf(null); }} data-testid={`kn-tab-${id}`}>{label}</button>)}
            </div>
          </div>
          {tab === 'programme' && <ProgrammeTab fr={fr} k={k} profile={profile} />}
          {tab === 'followup' && <FollowUp fr={fr} k={k} profile={profile} initial={followUpOf} />}
          {tab === 'library' && <section className="sc-section"><div className="kn-cards">{LIBRARY.map(ex => <ExerciseCard key={ex.id} ex={ex} fr={fr} k={k} open />)}</div></section>}
          {tab === 'invoice' && <InvoiceTab fr={fr} k={k} profile={profile} onProfile={() => setTab('profile')} />}
          {tab === 'compare' && <section className="sc-section"><p className="sc-caption">{k.compareHint}</p><ReferenceCompare embedded /></section>}
          {tab === 'profile' && <ProfileTab k={k} profile={profile} onSave={save} />}
        </div>
      </section>
    </div>
  );
}
