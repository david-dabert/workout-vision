import { useEffect, useMemo, useState } from 'react';
import {
  RATES, simulateCoachMonth, localIsoDate, paperDate, euros, isValidSiret, invoiceMissing, buildInvoice, invoiceLines,
  receiptsCsv, siretText, PAYMENT_MODES, PAYMENT_MODE_FR, buildCreditNote, creditNoteLines, ratePct,
} from '../../lib/accounting';
import {
  issueInvoiceNumber, issueCreditNoteNumber, saveIssuedInvoice, getIssuedInvoices, markInvoicePaid, markInvoiceCancelled, getLegacyReceiptRows,
} from '../../lib/coachStorage';
import { hapticLight, hapticTap } from '../../lib/haptics';
import { Range, Metric } from '../experience/Showcase';
import { OFFICE, PAYMENT_MODE_EN } from './office-copy';
import { useOfficePdf } from './office-share';

// Comptabilité (honesty pass of 14 October 2026, wave 2B: ACC-1 to ACC-6, INV-1 to INV-7). A simulator of the month at
// the coach's own values, with the dated rates of accounting.ts (RATES, status literature); the coach's file, kept on
// this phone; an invoice that is refused while a required field is empty and says which; numbers in a sequence that is
// never reused; a receipts book of money actually received. No brand, no identity, no rate is written in for the coach.
// Second review (14 October 2026): the simulator says its opening values are an example; the break-even line says
// "après cotisations et impôt" when the versement libératoire is on; the rates are written from RATES; the invoice's
// description starts empty; an unpaid invoice can be cancelled by a credit note (avoir) of its own sequence; the
// screen says the invoices live on this phone only; old receipt rows show their date as a date.

const SvgFile = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
const SvgCopy = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
const SvgDownload = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;

const EMPTY_PROFILE = { name: '', siret: '', address: '', cartePro: '', rcpPro: '', gym: '', mediator: '' };

export default function CoachAccounting({ fr, clients, selectedClient, profile, onSaveProfile }) {
  const t = OFFICE[fr ? 'fr' : 'en'];
  const money = (x) => euros(x, fr, 0);
  const cents = (x) => euros(x, fr);
  const modeName = (m) => (fr ? PAYMENT_MODE_FR[m] : PAYMENT_MODE_EN[m]) || m;

  // ─── The simulator: the coach's values; the rent starts at nothing rather than a brand's supposed fee (ACC-4). ───
  // The opening values are an example, and the card says so until the coach sets a price or a number of sessions.
  const [price, setPrice] = useState(50);
  const [sessions, setSessions] = useState(40);
  const [own, setOwn] = useState(false);
  const [rent, setRent] = useState(0);
  const [otherCosts, setOtherCosts] = useState(0);
  const [vl, setVl] = useState(false);
  const sim = useMemo(() => simulateCoachMonth({ sessionPrice: price, sessionsPerMonth: sessions, rent, otherCosts, versementLiberatoire: vl }), [price, sessions, rent, otherCosts, vl]);
  const keepPerSession = price * (1 - RATES.ssiBnc - RATES.cfp - (vl ? RATES.versementLiberatoire : 0));

  // ─── The coach's file ───
  const [draft, setDraft] = useState({ ...EMPTY_PROFILE, ...pick(profile) });
  const [savedNote, setSavedNote] = useState(false);
  const setField = (k) => (e) => { setSavedNote(false); setDraft(d => ({ ...d, [k]: e.target.value })); };
  const siretTyped = draft.siret.replace(/\s+/g, '');
  const siretBad = siretTyped.length > 0 && !isValidSiret(siretTyped);
  const saveProfile = async (e) => {
    e.preventDefault();
    hapticTap();
    await onSaveProfile(draft);
    setSavedNote(true);
  };

  // ─── The invoice ───
  const [clientId, setClientId] = useState(selectedClient?.id || '');
  const [clientName, setClientName] = useState(selectedClient?.name || '');
  const [clientAddress, setClientAddress] = useState(selectedClient?.address || '');
  const [clientKind, setClientKind] = useState('particulier');
  const [desc, setDesc] = useState('');
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('');
  const [serviceDate, setServiceDate] = useState(localIsoDate());
  const [payment, setPayment] = useState('reception');
  const [justIssued, setJustIssued] = useState('');
  const [busy, setBusy] = useState(false);
  const chooseClient = (id) => {
    setClientId(id);
    const c = clients.find(x => x.id === id);
    setClientName(c?.name || '');
    setClientAddress(c?.address || '');
  };
  // The saved file, not the fields being typed, goes on the invoice: what is printed is what is kept.
  const input = {
    coach: { ...EMPTY_PROFILE, ...pick(profile) },
    client: { name: clientName, address: clientAddress, kind: clientKind },
    items: [{ description: desc, quantity: Number(qty), unitPrice: Number(String(unit).replace(',', '.')) }],
    serviceDate, payment,
  };
  const missing = invoiceMissing(input);
  const preview = missing.length ? null : buildInvoice(input, '…');

  const [issued, setIssued] = useState([]);
  const [legacy, setLegacy] = useState([]);
  useEffect(() => {
    let on = true;
    getIssuedInvoices().then(list => { if (on) setIssued(list); });
    getLegacyReceiptRows().then(list => { if (on) setLegacy(list); });
    return () => { on = false; };
  }, []);

  const issue = async () => {
    if (busy || missing.length) return;
    setBusy(true);
    hapticTap();
    try {
      const number = await issueInvoiceNumber(Number(localIsoDate().slice(0, 4)));
      const inv = buildInvoice(input, number);
      if (!inv) return;
      await saveIssuedInvoice(inv);
      setIssued(list => [inv, ...list]);
      setJustIssued(number);
      // The price is typed again for the next invoice: a second tap does not issue the same invoice twice.
      setUnit('');
    } finally { setBusy(false); }
  };

  // ─── Issued invoices: share, copy, record the payment ───
  const pdf = useOfficePdf(fr);
  const [copied, setCopied] = useState('');
  const copyInvoice = (inv) => {
    hapticLight();
    const text = linesOf(inv).join('\n');
    Promise.resolve().then(() => navigator.clipboard.writeText(text))
      .then(() => setCopied(inv.number), () => setCopied(`fail:${inv.number}`));
  };
  // An unpaid invoice cancelled by a credit note (avoir): asked once, then the avoir is issued in its own sequence and
  // the invoice stays in the list, marked cancelled.
  const [cancelling, setCancelling] = useState('');
  const [creditNote, setCreditNote] = useState('');
  const cancelByCredit = async (inv) => {
    if (busy || inv.paid || inv.cancelledBy || inv.kind === 'avoir') return;
    setBusy(true);
    hapticTap();
    try {
      const number = await issueCreditNoteNumber(Number(localIsoDate().slice(0, 4)));
      const cn = buildCreditNote(inv, number);
      if (!cn) return;
      await saveIssuedInvoice(cn);
      const next = await markInvoiceCancelled(inv.number, number);
      setIssued(list => [cn, ...list.map(i => (next && i.number === next.number ? next : i))]);
      setCreditNote(t.creditIssued(number, inv.number));
      setCancelling('');
    } finally { setBusy(false); }
  };
  const linesOf = (doc) => (doc.kind === 'avoir' ? creditNoteLines(doc) : invoiceLines(doc));
  const [paying, setPaying] = useState(null); // { number, paidOn, mode }
  const confirmPaid = async () => {
    if (!paying || !/^\d{4}-\d{2}-\d{2}$/.test(paying.paidOn)) return;
    hapticTap();
    const next = await markInvoicePaid(paying.number, { paidOn: paying.paidOn, mode: paying.mode });
    if (next) setIssued(list => list.map(i => (i.number === next.number ? next : i)));
    setPaying(null);
  };

  // ─── The receipts book: money received only (INV-6) ───
  const rows = issued.filter(i => i.paid && i.kind !== 'avoir').map(i => ({
    paidOn: i.paid.paidOn, number: i.number, client: i.client.name,
    nature: i.items.map(it => it.description).join(' + '), amount: i.total, mode: i.paid.mode,
  })).sort((a, b) => a.paidOn.localeCompare(b.paidOn) || a.number.localeCompare(b.number));
  const exportBook = () => {
    if (!rows.length) return;
    hapticLight();
    const blob = new Blob([receiptsCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `livre-des-recettes-${localIsoDate().slice(0, 4)}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <div className="suite-content-section" data-testid="section-accounting">
      <div className="section-header-row">
        <div>
          <h3>{t.accTitle}</h3>
          <p className="section-subtext">{t.accSub}</p>
        </div>
      </div>

      {/* The month, simulated */}
      <div className="accounting-tuners-card" data-testid="acc-simulator">
        <div className="card-top-row">
          <b>{t.simHead}</b>
          <span className="comp-badge" data-testid="acc-sim-tag">{own ? t.simTag : t.simExample}</span>
        </div>
        {!own && <p className="sc-frame-note office-flush" data-testid="acc-example">{t.simExampleNote}</p>}
        <div className="tuner-row sc-ranges">
          <Range label={t.price} display={money(price)} min="20" max="150" step="5" value={price} onChange={e => { setOwn(true); setPrice(Number(e.target.value)); }} testId="acc-price" />
          <Range label={t.sessions} display={String(sessions)} min="0" max="120" step="1" value={sessions} onChange={e => { setOwn(true); setSessions(Number(e.target.value)); }} testId="acc-sessions" />
          <Range label={t.rent} display={money(rent)} min="0" max="1500" step="10" value={rent} onChange={e => setRent(Number(e.target.value))} testId="acc-rent" />
          <Range label={t.otherCosts} display={money(otherCosts)} min="0" max="1000" step="10" value={otherCosts} onChange={e => setOtherCosts(Number(e.target.value))} testId="acc-other" />
        </div>
        <label className="sc-switch">
          <span className="sc-switch-text">{t.vl}<small>{t.vlSub(ratePct(RATES.versementLiberatoire, fr), money(RATES.versementLiberatoireIncomeLimitPerPart), RATES.versementLiberatoireIncomeYear)}</small></span>
          <input type="checkbox" role="switch" checked={vl} onChange={e => { hapticLight(); setVl(e.target.checked); }} data-testid="acc-vl" />
        </label>
      </div>

      <div className="sc-metrics" data-testid="acc-figures">
        <Metric label={t.turnover} value={money(sim.turnover)} sub={t.turnoverSub(sessions, money(price))} />
        <Metric label={t.contributions} value={money(-sim.contributions)} sub={t.contributionsSub(ratePct(RATES.ssiBnc, fr), ratePct(RATES.cfp, fr))} testId="acc-contributions" />
        <Metric label={t.costs} value={money(-sim.costs)} />
        {sim.incomeTax != null
          ? <Metric label={t.incomeTax} value={money(-sim.incomeTax)} sub={t.incomeTaxSub(ratePct(RATES.versementLiberatoire, fr))} />
          : null}
        <Metric wide label={vl ? t.estimateAfter : t.estimateBefore} value={money(sim.estimate)} sub={vl ? t.estimateAfterSub : t.estimateBeforeSub} testId="acc-estimate" />
      </div>

      <div className="accounting-tuners-card break-even-banner" data-testid="acc-break-even">
        <p className="section-subtext office-flush">
          {sim.costs > 0 && Number.isFinite(sim.breakEvenSessions)
            ? t.breakEven(sim.breakEvenSessions, money(sim.costs), cents(keepPerSession), vl)
            : t.breakEvenNone}
        </p>
      </div>

      <div className="accounting-tuners-card" data-testid="acc-year">
        <p className="office-strong">{t.year(money(sim.yearTurnover))}</p>
        {sim.warnings.includes('vat-base') && <p className="sc-frame-note" data-testid="acc-warn-vat">{t.warnVatBase(money(RATES.vatFranchiseBase))}</p>}
        {sim.warnings.includes('vat-increased') && <p className="sc-frame-note" data-testid="acc-warn-vat">{t.warnVatIncreased(money(RATES.vatFranchiseIncreased))}</p>}
        {sim.warnings.includes('micro-ceiling') && <p className="sc-frame-note" data-testid="acc-warn-ceiling">{t.warnCeiling(money(RATES.microBncCeiling))}</p>}
        <p className="section-subtext office-flush">{t.ratesNote}</p>
      </div>

      {/* The coach's file */}
      <form className="invoice-builder-card" onSubmit={saveProfile} data-testid="acc-profile">
        <div className="invoice-builder-header">
          <div>
            <h4>{t.profileHead}</h4>
            <p className="section-subtext">{t.profileSub}</p>
          </div>
        </div>
        <div className="invoice-controls-row">
          <Field label={t.fName} value={draft.name} onChange={setField('name')} autoComplete="name" />
          <Field label={t.fSiret} value={draft.siret} onChange={setField('siret')} placeholder={t.fSiretPh} inputMode="numeric" invalid={siretBad} hint={siretBad ? t.fSiretBad : ''} testId="acc-siret" />
          <Field label={t.fAddress} value={draft.address} onChange={setField('address')} placeholder={t.fAddressPh} autoComplete="street-address" />
          <Field label={t.fCartePro} value={draft.cartePro} onChange={setField('cartePro')} placeholder={t.fCarteProPh} />
          <Field label={t.fRcp} value={draft.rcpPro} onChange={setField('rcpPro')} placeholder={t.fRcpPh} />
          <Field label={t.fGym} value={draft.gym} onChange={setField('gym')} placeholder={t.fGymPh} />
          <Field label={t.fMediator} value={draft.mediator} onChange={setField('mediator')} placeholder={t.fMediatorPh} />
        </div>
        <div className="form-actions-row">
          <button type="submit" className="btn-save press" data-testid="acc-save-profile">{t.saveProfile}</button>
        </div>
        {savedNote && <p className="sc-frame-note" role="status">{t.profileSaved}</p>}
      </form>

      {/* The invoice */}
      <div className="invoice-builder-card" data-testid="acc-invoice">
        <div className="invoice-builder-header">
          <div>
            <h4>{t.invHead}</h4>
            <p className="section-subtext">{t.invSub}</p>
          </div>
        </div>
        <div className="invoice-controls-row">
          <div className="invoice-field">
            <label htmlFor="inv-client">{t.invClient}</label>
            <select id="inv-client" value={clientId} onChange={e => chooseClient(e.target.value)}>
              <option value="">{t.invOtherClient}</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Field label={t.invClientName} value={clientName} onChange={e => setClientName(e.target.value)} />
          <Field label={t.invClientAddress} value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder={t.fAddressPh} />
          <div className="invoice-field">
            <span className="office-label">{t.invKind}</span>
            <div className="regime-toggle" role="group" aria-label={t.invKind}>
              <button type="button" className={`regime-btn ${clientKind === 'particulier' ? 'active' : ''}`} aria-pressed={clientKind === 'particulier'} onClick={() => setClientKind('particulier')}>{t.invPerson}</button>
              <button type="button" className={`regime-btn ${clientKind === 'professionnel' ? 'active' : ''}`} aria-pressed={clientKind === 'professionnel'} onClick={() => setClientKind('professionnel')}>{t.invBusiness}</button>
            </div>
          </div>
          <Field label={t.invItem} value={desc} onChange={e => setDesc(e.target.value)} placeholder={t.invItemPh} testId="inv-desc" />
          <div className="inline-inputs">
            <Field label={t.invQty} value={qty} onChange={e => setQty(e.target.value)} inputMode="numeric" type="number" />
            <Field label={t.invUnit} value={unit} onChange={e => setUnit(e.target.value)} inputMode="decimal" testId="inv-unit" />
          </div>
          <Field label={t.invServiceDate} value={serviceDate} onChange={e => setServiceDate(e.target.value)} type="date" />
          <div className="invoice-field">
            <label htmlFor="inv-pay">{t.invPayment}</label>
            <select id="inv-pay" value={payment} onChange={e => setPayment(e.target.value)}>
              <option value="reception">{t.invReception}</option>
              <option value="days30">{t.invDays30}</option>
            </select>
          </div>
        </div>

        {missing.length ? (
          <div className="office-missing" data-testid="inv-missing">
            <p className="office-strong">{t.missingInvoice}</p>
            <ul>{missing.map(m => <li key={m}>{t.missing[m]}</li>)}</ul>
          </div>
        ) : (
          <>
            <InvoicePaper inv={preview} fr={fr} number={t.numberAtIssue} />
            <div className="invoice-actions">
              <button type="button" className="suite-action-btn press" onClick={issue} disabled={busy} data-testid="inv-issue">{t.issue}</button>
            </div>
          </>
        )}
        {justIssued && <p className="sc-frame-note" role="status" data-testid="inv-issued-note">{t.issued(justIssued)}</p>}
      </div>

      {/* The invoices issued, and the credit notes that cancel some of them */}
      <div className="livre-recettes-card" data-testid="acc-issued">
        <div className="livre-header"><div><h4>{t.issuedHead}</h4><p className="section-subtext">{t.issuedSub}</p></div></div>
        {issued.length === 0 ? <p className="section-subtext">{t.issuedNone}</p> : (
          <div className="office-invoices">
            {issued.map(inv => {
              const avoir = inv.kind === 'avoir';
              const open = !avoir && !inv.paid && !inv.cancelledBy;
              const badge = avoir ? t.creditTag(inv.cancels)
                : inv.cancelledBy ? t.cancelledBy(inv.cancelledBy)
                  : inv.paid ? t.cashed(paperDate(inv.paid.paidOn, fr), modeName(inv.paid.mode)) : t.toCash;
              return (
                <article key={inv.number} className={`office-invoice ${inv.cancelledBy ? 'is-cancelled' : ''}`} data-testid={`inv-${inv.number}`}>
                  <div className="office-invoice-top">
                    <span className="inv-num office-num">{inv.number}</span>
                    <span className={`comp-badge ${inv.paid || avoir ? 'is-paid' : ''}`}>{badge}</span>
                  </div>
                  <p className="office-invoice-line"><b>{inv.client.name}</b> · {paperDate(inv.issueDate, fr)} · <b>{cents(inv.total)}</b></p>
                  <div className="invoice-actions">
                    <button type="button" className="quick-suite-btn press" onClick={() => { hapticLight(); pdf.share(avoir ? `Avoir ${inv.number}` : `Facture ${inv.number}`, { invoice: inv }, `${avoir ? 'avoir' : 'facture'}-${inv.number}`); }} data-testid={`inv-pdf-${inv.number}`}><SvgFile />{t.pdf}</button>
                    <button type="button" className="quick-suite-btn press" onClick={() => copyInvoice(inv)}><SvgCopy />{copied === inv.number ? t.copied : t.copyText}</button>
                    {open && <button type="button" className="suite-action-btn press" onClick={() => { setCancelling(''); setPaying({ number: inv.number, paidOn: localIsoDate(), mode: 'virement' }); }} data-testid={`inv-pay-${inv.number}`}>{t.markPaid}</button>}
                    {open && <button type="button" className="quick-suite-btn press" onClick={() => { setPaying(null); setCancelling(inv.number); }} data-testid={`inv-cancel-${inv.number}`}>{t.cancelByCredit}</button>}
                  </div>
                  {copied === `fail:${inv.number}` && <p className="sc-frame-note" role="status">{t.copyFailed}</p>}
                  {cancelling === inv.number && (
                    <div className="office-missing" role="alertdialog" aria-label={t.creditAsk(inv.number)}>
                      <p className="office-strong">{t.creditAsk(inv.number)}</p>
                      <div className="form-actions-row">
                        <button type="button" className="btn-cancel press" onClick={() => setCancelling('')}>{t.cancel}</button>
                        <button type="button" className="btn-save press" onClick={() => cancelByCredit(inv)} disabled={busy} data-testid={`inv-credit-ok-${inv.number}`}>{t.creditIssue}</button>
                      </div>
                    </div>
                  )}
                  {paying?.number === inv.number && (
                    <div className="log-session-box">
                      <div className="inline-inputs">
                        <Field label={t.paidOn} type="date" value={paying.paidOn} onChange={e => setPaying(p => ({ ...p, paidOn: e.target.value }))} />
                        <div className="invoice-field">
                          <label htmlFor={`mode-${inv.number}`}>{t.paidMode}</label>
                          <select id={`mode-${inv.number}`} value={paying.mode} onChange={e => setPaying(p => ({ ...p, mode: e.target.value }))}>
                            {PAYMENT_MODES.map(m => <option key={m} value={m}>{modeName(m)}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="form-actions-row">
                        <button type="button" className="btn-cancel press" onClick={() => setPaying(null)}>{t.cancel}</button>
                        <button type="button" className="btn-save press" onClick={confirmPaid} data-testid={`inv-pay-ok-${inv.number}`}>{t.confirm}</button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
        {creditNote && <p className="sc-frame-note" role="status" data-testid="inv-credit-note">{creditNote}</p>}
        {pdf.note && <p className="sc-frame-note" role="status">{pdf.note}</p>}
      </div>

      {/* The receipts book */}
      <div className="livre-recettes-card" data-testid="acc-book">
        <div className="livre-header">
          <div>
            <h4>{t.bookHead}</h4>
            <p className="section-subtext">{t.bookSub}</p>
          </div>
          <button type="button" className="suite-action-btn press" onClick={exportBook} disabled={!rows.length} aria-disabled={!rows.length || undefined} data-testid="btn-download-csv"><SvgDownload />{t.bookExport}</button>
        </div>
        {rows.length ? (
          <table className="sc-table">
            <thead><tr>{t.bookCols.map(c => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.number}>
                  <td data-label={t.bookCols[0]}>{paperDate(r.paidOn, fr)}</td>
                  <td data-label={t.bookCols[1]}>{r.number}</td>
                  <td data-label={t.bookCols[2]}>{r.client}</td>
                  <td data-label={t.bookCols[3]}>{cents(r.amount)}</td>
                  <td data-label={t.bookCols[4]}>{modeName(r.mode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="section-subtext">{t.bookNone}</p>}
        {legacy.length > 0 && (
          <div className="office-missing" data-testid="acc-legacy">
            <p className="section-subtext office-flush">{t.legacyNote}</p>
            <ul>{legacy.map((e, i) => <li key={i}><span className="comp-badge">{t.legacyTag}</span> {paperDate(e.date, fr)} · {e.invoiceNumber} · {e.clientName} · {cents(Number(e.montantHt) || 0)}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}

function pick(p) {
  if (!p) return {};
  const out = {};
  for (const k of Object.keys(EMPTY_PROFILE)) if (typeof p[k] === 'string') out[k] = p[k];
  return out;
}

function Field({ label, value, onChange, placeholder, type = 'text', inputMode, autoComplete, invalid = false, hint = '', testId }) {
  const id = `f-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  return (
    <div className="invoice-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={onChange} placeholder={placeholder} inputMode={inputMode} autoComplete={autoComplete}
        aria-invalid={invalid || undefined} aria-describedby={hint ? `${id}-hint` : undefined} data-testid={testId} />
      {hint && <span id={`${id}-hint`} className="office-hint">{hint}</span>}
    </div>
  );
}

/** The invoice on paper, as it will be printed (the same lines as the PDF and the copied text). Its words are French
 *  in either language, the invoice being a French document; French awaiting David's approval (R10). */
export function InvoicePaper({ inv, fr, number }) {
  if (!inv) return null;
  const money = (x) => euros(x, true);
  return (
    <div className="invoice-preview-sheet" data-testid="inv-preview" lang="fr">
      <div className="inv-top">
        <span className="inv-num">{number ? `FACTURE · ${number}` : `FACTURE N° ${inv.number}`}</span>
        <span className="inv-date">Date d’émission{'\u00A0'}: {paperDate(inv.issueDate)}</span>
      </div>
      <div className="inv-parties">
        <div>
          <strong>{inv.coach.legalName}</strong>
          <span>SIRET{'\u00A0'}: {siretText(inv.coach.siret)}</span>
          <span>{inv.coach.address}</span>
          <span>Carte professionnelle n° {inv.coach.cartePro}</span>
          {inv.coach.rcpPro && <span>Assurance RC pro{'\u00A0'}: {inv.coach.rcpPro}</span>}
          {inv.coach.gym && <span>Lieu d’exercice{'\u00A0'}: {inv.coach.gym}</span>}
        </div>
        <div>
          <strong>{inv.client.name}</strong>
          <span>{inv.client.address}</span>
          <span>Prestation du {paperDate(inv.serviceDate)}</span>
        </div>
      </div>
      <table className="inv-table">
        <thead><tr><th>Désignation</th><th>Qté</th><th>Prix</th><th>Total</th></tr></thead>
        <tbody>
          {inv.items.map((it, i) => (
            <tr key={i}><td>{it.description}</td><td>{it.quantity}</td><td>{money(it.unitPrice)}</td><td>{money(it.quantity * it.unitPrice)}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="inv-total-row">
        <div className="inv-amounts"><b className="total-ttc">Total à payer{'\u00A0'}: {money(inv.total)}</b></div>
        <div className="inv-legal-mentions">{inv.mentions.map((m, i) => <small key={i}>{m}</small>)}</div>
      </div>
      {!fr && <p className="office-hint">The invoice is a French document: its words stay in French.</p>}
    </div>
  );
}
