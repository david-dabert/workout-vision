import { useState, useEffect, useMemo } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  getAllClients,
  saveClient,
  deleteClient,
  logClientSession,
  getClientSessions,
  saveClientCarnet,
  getClientCarnet,
  logClientMeal,
  getClientMeals,
  getCoachProfile,
  saveCoachProfile,
} from '../../lib/coachStorage';
import { isValidSiret, localIsoDate, euros, paperDate } from '../../lib/accounting';
import { generateCoachingContract, contractMissing } from '../../lib/coachContracts';
import CoachAccounting from './CoachAccounting';
import { OFFICE } from './office-copy';
import { useOfficePdf } from './office-share';
import CoachNutrition from './CoachNutrition';
import { bodyToCheck } from './office-legacy';
import {
  PHYSIO_CATALOG,
  PHYSIO_REGIONS,
} from '../../lib/physioCatalog';
import { hapticLight, hapticTap } from '../../lib/haptics';
import { programmable } from '../experience/programme';
import './CoachSuite.css';

const SvgUsers = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const SvgEuro = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10h12M4 14h9M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12a7.9 7.9 0 0 0 7.8 8 7.7 7.7 0 0 0 5.2-2"/></svg>;
const SvgSalad = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z"/><path d="M7 12V7a5 5 0 0 1 10 0v5"/><path d="M12 7V4"/></svg>;
const SvgStetho = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 3v5a3.5 3.5 0 0 0 7 0V3"/><path d="M8 11.5v3a4.5 4.5 0 0 0 9 0v-2"/><circle cx="17" cy="10.5" r="2"/></svg>;
const SvgCheck = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>;
const SvgClose = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const SvgDoc = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const SvgCopy = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
const SvgPrint = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;
const SvgVideo = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;

export default function CoachSuite({ onAddToProgramme, onSelectClient }) {
  const { lang } = useT();
  const fr = lang === 'fr';

  const [activeSubTab, setActiveSubTab] = useState('clients'); // 'clients' | 'accounting' | 'nutrition' | 'physio'

  // ─── 1. Clients ───
  // Honesty pass of 14 October 2026 (CLI-1 to CLI-4 and the missed form reset): every field of a new client starts
  // empty and is emptied after a save (a client used to inherit the last one's body, and 75 kg / 175 cm were written in);
  // no pack is assumed until the coach records one; a session's note is the coach's own; a delete is confirmed and takes
  // everything kept for that client. The count of linked sets is gone: nothing in the app links a set to a client yet.
  const t = OFFICE[fr ? 'fr' : 'en'];
  const EMPTY_CLIENT = { name: '', age: '', sex: '', weight: '', height: '', address: '', goals: '', notes: '' };
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClient, setNewClient] = useState(EMPTY_CLIENT);
  const setNew = (k) => (e) => setNewClient(c => ({ ...c, [k]: e.target.value }));

  // Client Session & Carnet Tracking
  const [clientCarnet, setClientCarnet] = useState(null);
  const [clientSessionsList, setClientSessionsList] = useState([]);
  const [clientMealHistory, setClientMealHistory] = useState([]);
  const [isLoggingSession, setIsLoggingSession] = useState(false);
  const [sessionNotesInput, setSessionNotesInput] = useState('');
  const [sessionTypeInput, setSessionTypeInput] = useState('');
  const [sessionMinutes, setSessionMinutes] = useState('60');
  const [carnetForm, setCarnetForm] = useState(null); // { sessions, price, boughtOn } while recording a purchase
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let mounted = true;
    getAllClients().then((list) => {
      if (!mounted) return;
      setClients(list);
      if (list.length > 0) setSelectedClientId(id => id ?? list[0].id);
    });
    return () => { mounted = false; };
  }, []);

  // Load selected client carnet and sessions
  useEffect(() => {
    if (!selectedClientId) return;
    let mounted = true;
    Promise.all([
      getClientCarnet(selectedClientId),
      getClientSessions(selectedClientId),
      getClientMeals(selectedClientId),
    ]).then(([carnet, sessions, meals]) => {
      if (!mounted) return;
      setClientCarnet(carnet);
      setClientSessionsList(sessions);
      setClientMealHistory(meals);
    });
    return () => { mounted = false; };
  }, [selectedClientId]);

  const handleSaveNewClient = async (e) => {
    e.preventDefault();
    if (!newClient.name.trim()) return;
    hapticTap();
    // bodyTyped: this file's sex, weight and height were typed by the coach (the form starts empty since 14 October
    // 2026); a file without it may hold the old form's pre-filled values (CoachNutrition.jsx, bodyToCheck).
    const created = await saveClient({ ...newClient, name: newClient.name.trim(), bodyTyped: true });
    setClients(prev => [created, ...prev]);
    setSelectedClientId(created.id);
    setCarnetForm(null);
    setConfirmDelete(false);
    setIsAddingClient(false);
    setNewClient(EMPTY_CLIENT);
  };

  const handleDeleteClient = async (id) => {
    hapticLight();
    await deleteClient(id);
    const left = clients.filter(c => c.id !== id);
    setClients(left);
    setConfirmDelete(false);
    if (selectedClientId === id) {
      setSelectedClientId(left[0]?.id || null);
      setClientCarnet(null);
      setClientSessionsList([]);
      setClientMealHistory([]);
    }
  };

  const carnetLeft = clientCarnet ? Math.max(0, clientCarnet.totalPurchased - clientCarnet.completedCount) : 0;

  const handleLogDeliveredSession = async () => {
    if (!selectedClientId) return;
    hapticTap();
    const logged = await logClientSession(selectedClientId, {
      date: localIsoDate(),
      type: sessionTypeInput.trim(),
      durationMin: Number(sessionMinutes) || null,
      notes: sessionNotesInput.trim(),
    });
    setClientSessionsList(prev => [logged, ...prev]);
    // The pack counts down only while sessions are left in it; at zero the coach records a new one.
    if (clientCarnet && carnetLeft > 0) {
      const newCarnet = { ...clientCarnet, completedCount: clientCarnet.completedCount + 1 };
      await saveClientCarnet(selectedClientId, newCarnet);
      setClientCarnet(newCarnet);
    }
    setIsLoggingSession(false);
    setSessionNotesInput('');
    setSessionTypeInput('');
  };

  const handleSaveCarnet = async () => {
    const total = Number(carnetForm?.sessions);
    if (!selectedClientId || !(Number.isInteger(total) && total > 0)) return;
    hapticTap();
    const price = Number(String(carnetForm.price || '').replace(',', '.'));
    const carnet = { totalPurchased: total, completedCount: 0, ...(price > 0 ? { pricePerPack: price } : {}), boughtOn: carnetForm.boughtOn || localIsoDate() };
    await saveClientCarnet(selectedClientId, carnet);
    setClientCarnet(carnet);
    setCarnetForm(null);
  };

  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // ─── 2. The coach's file (Comptabilité) and the contract ───
  // The file is the coach's own, kept on this phone (coachStorage, coachProfile): nothing is written in for them
  // (INV-1, INV-2: the code's SIRET, carte pro and insurer, printed whenever a field was empty, are gone).
  const [coachProfile, setCoachProfile] = useState(null);
  useEffect(() => {
    let on = true;
    getCoachProfile().then(p => { if (on) setCoachProfile(p || {}); });
    return () => { on = false; };
  }, []);
  const handleSaveProfile = async (fields) => {
    const next = { ...(coachProfile || {}), ...fields };
    await saveCoachProfile(next);
    setCoachProfile(next);
  };

  // The contract (CTR-1): a model to have read by a lawyer; prices typed by the coach; nothing is drawn up while a
  // required field is empty.
  // Every figure starts empty and each package asks for its own (second review: the count started at 10, the validity
  // at 6 months, and a monthly follow-up was printed as one session valid six months).
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractPackage, setContractPackage] = useState('carnet');
  const [contractForm, setContractForm] = useState({ sessions: '', price: '', validity: '', perMonth: '', months: '', monthly: '' });
  const setContract = (k) => (e) => setContractForm(f => ({ ...f, [k]: e.target.value }));
  const [copiedContract, setCopiedContract] = useState('');
  const contractPdf = useOfficePdf(fr);
  const amount = (v) => Number(String(v).replace(',', '.'));
  const contractData = {
    coach: coachProfile || {},
    client: { name: selectedClient?.name || '', address: selectedClient?.address || '' },
    packageType: contractPackage,
    sessionsCount: Number(contractForm.sessions),
    totalPrice: amount(contractForm.price),
    validityMonths: Number(contractForm.validity),
    sessionsPerMonth: Number(contractForm.perMonth),
    months: Number(contractForm.months),
    monthlyPrice: amount(contractForm.monthly),
  };
  const contractLacks = contractMissing(contractData, isValidSiret);
  const generatedContract = contractLacks.length ? null : generateCoachingContract(contractData);

  // ─── 3. Nutrition (CoachNutrition.jsx) ───
  const handleLogMeal = async (meal) => {
    if (!selectedClientId) return;
    const logged = await logClientMeal(selectedClientId, meal);
    setClientMealHistory(prev => [logged, ...prev]);
  };
  const handleUpdateClient = async (client) => {
    const saved = await saveClient(client);
    setClients(list => list.map(c => (c.id === saved.id ? { ...saved } : c)));
  };

  // ─── 4. Physio State ───
  const [selectedPhysioRegion, setSelectedPhysioRegion] = useState('all');
  const filteredPhysio = useMemo(() => {
    if (selectedPhysioRegion === 'all') return PHYSIO_CATALOG;
    return PHYSIO_CATALOG.filter(item => item.region === selectedPhysioRegion);
  }, [selectedPhysioRegion]);

  return (
    <div className="coach-suite-container" data-testid="coach-suite">
      {/* Subtab Navigation Pills */}
      <div className="suite-nav-bar">
        <button
          type="button"
          className={`suite-tab-btn ${activeSubTab === 'clients' ? 'active' : ''}`}
          onClick={() => { hapticLight(); setActiveSubTab('clients'); }}
          data-testid="tab-clients"
        >
          <span><SvgUsers />{t.clientsTab}</span>
        </button>
        <button
          type="button"
          className={`suite-tab-btn ${activeSubTab === 'accounting' ? 'active' : ''}`}
          onClick={() => { hapticLight(); setActiveSubTab('accounting'); }}
          data-testid="tab-accounting"
        >
          <span><SvgEuro />{t.accTab}</span>
        </button>
        <button
          type="button"
          className={`suite-tab-btn ${activeSubTab === 'nutrition' ? 'active' : ''}`}
          onClick={() => { hapticLight(); setActiveSubTab('nutrition'); }}
          data-testid="tab-nutrition"
        >
          <span><SvgSalad />{t.nutTab}</span>
        </button>
        <button
          type="button"
          className={`suite-tab-btn ${activeSubTab === 'physio' ? 'active' : ''}`}
          onClick={() => { hapticLight(); setActiveSubTab('physio'); }}
          data-testid="tab-physio"
        >
          <span><SvgStetho />{t.physioTab}</span>
        </button>
      </div>

      {/* ─── TAB 1: CLIENTS ─── */}
      {activeSubTab === 'clients' && (
        <div className="suite-content-section" data-testid="section-clients">
          <div className="section-header-row">
            <div>
              <h3>{t.clientsTitle}</h3>
              <p className="section-subtext">{t.clientsSub}</p>
            </div>
            <button
              type="button"
              className="suite-action-btn press"
              onClick={() => { hapticLight(); setIsAddingClient(true); }}
              data-testid="btn-add-client"
            >
              + {t.addClient}
            </button>
          </div>

          {/* Add Client Modal/Card: every field empty, emptied again after a save */}
          {isAddingClient && (
            <form className="add-client-card" onSubmit={handleSaveNewClient} data-testid="add-client-form">
              <div className="card-top-row">
                <b>{t.newClientHead}</b>
                <button type="button" className="text-close-btn" onClick={() => setIsAddingClient(false)} aria-label={t.close}><SvgClose /></button>
              </div>
              <div className="form-grid">
                <div className="input-group">
                  <label htmlFor="nc-name">{t.fFullName}</label>
                  <input id="nc-name" type="text" required placeholder={t.fFullNamePh} value={newClient.name} onChange={setNew('name')} />
                </div>
                <div className="input-group">
                  <label htmlFor="nc-age">{t.fAgeSex}</label>
                  <div className="inline-inputs">
                    <input id="nc-age" type="number" inputMode="numeric" placeholder={t.fAge} value={newClient.age} onChange={setNew('age')} />
                    <select value={newClient.sex} onChange={setNew('sex')} aria-label={t.fSex}>
                      <option value="">{t.sexUnknown}</option>
                      <option value="female">{fr ? 'Femme' : 'Female'}</option>
                      <option value="male">{fr ? 'Homme' : 'Male'}</option>
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <label htmlFor="nc-weight">{t.fBody}</label>
                  <div className="inline-inputs">
                    <input id="nc-weight" type="number" inputMode="decimal" placeholder={t.fWeight} value={newClient.weight} onChange={setNew('weight')} />
                    <input type="number" inputMode="numeric" placeholder={t.fHeight} aria-label={t.fHeight} value={newClient.height} onChange={setNew('height')} />
                  </div>
                </div>
                <div className="input-group">
                  <label htmlFor="nc-address">{t.fClientAddress}</label>
                  <input id="nc-address" type="text" placeholder={t.fAddressPh} value={newClient.address} onChange={setNew('address')} />
                </div>
                <div className="input-group">
                  <label htmlFor="nc-goals">{t.fGoals}</label>
                  <input id="nc-goals" type="text" placeholder={t.fGoalsPh} value={newClient.goals} onChange={setNew('goals')} />
                </div>
                <div className="input-group full-width">
                  <label htmlFor="nc-notes">{t.fNotes}</label>
                  <textarea id="nc-notes" rows={2} placeholder={t.fNotesPh} value={newClient.notes} onChange={setNew('notes')} />
                  <span className="office-hint is-quiet">{t.notesLocal}</span>
                </div>
              </div>
              <div className="form-actions-row">
                <button type="button" className="btn-cancel press" onClick={() => setIsAddingClient(false)}>
                  {t.cancel}
                </button>
                <button type="submit" className="btn-save press">
                  {t.saveClient}
                </button>
              </div>
            </form>
          )}

          {/* Client List & Detail View */}
          {clients.length === 0 ? (
            <div className="empty-clients-box">
              <p>{t.noClients}</p>
            </div>
          ) : (
            <div className="clients-split-layout">
              <div className="clients-sidebar">
                {clients.map(cl => (
                  <button
                    type="button"
                    key={cl.id}
                    className={`client-item-card press ${selectedClientId === cl.id ? 'active' : ''}`}
                    onClick={() => {
                      hapticLight();
                      setSelectedClientId(cl.id);
                      setConfirmDelete(false);
                      setCarnetForm(null);
                      if (onSelectClient) onSelectClient(cl);
                    }}
                    aria-pressed={selectedClientId === cl.id}
                    data-testid={`client-${cl.id}`}
                  >
                    <span className="client-initials" aria-hidden="true">
                      {cl.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                    <span className="client-card-info">
                      <span className="client-card-name">{cl.name}</span>
                      {cl.goals ? <span className="client-card-sub">{cl.goals}</span> : null}
                    </span>
                  </button>
                ))}
              </div>

              {selectedClient && (
                <div className="client-detail-pane">
                  <div className="detail-pane-header">
                    <div>
                      <h4>{selectedClient.name}</h4>
                      <span className="detail-meta">
                        {[
                          selectedClient.sex === 'female' ? (fr ? 'Femme' : 'Female') : selectedClient.sex === 'male' ? (fr ? 'Homme' : 'Male') : '',
                          selectedClient.age ? `${selectedClient.age} ${fr ? 'ans' : 'years'}` : '',
                          selectedClient.weight ? `${selectedClient.weight}\u00A0kg` : '',
                          selectedClient.height ? `${selectedClient.height}\u00A0cm` : '',
                        ].filter(Boolean).join(' • ')}
                        {bodyToCheck(selectedClient) && (selectedClient.sex || selectedClient.weight || selectedClient.height) ? <span className="comp-badge" data-testid="body-to-check">{t.legacyTag}</span> : null}
                      </span>
                    </div>
                    {!confirmDelete && (
                      <button
                        type="button"
                        className="delete-client-btn press"
                        onClick={() => { hapticLight(); setConfirmDelete(true); }}
                        data-testid="btn-delete-client"
                      >
                        {t.deleteClient}
                      </button>
                    )}
                  </div>

                  {confirmDelete && (
                    <div className="office-missing" role="alertdialog" aria-label={t.deleteAsk(selectedClient.name)} data-testid="confirm-delete">
                      <p className="office-strong">{t.deleteAsk(selectedClient.name)}</p>
                      <div className="form-actions-row">
                        <button type="button" className="btn-cancel press" onClick={() => setConfirmDelete(false)}>{t.cancel}</button>
                        <button type="button" className="btn-save press" onClick={() => handleDeleteClient(selectedClient.id)} data-testid="btn-delete-yes">{t.deleteClient}</button>
                      </div>
                    </div>
                  )}

                  {/* The pack: none until the coach records a purchase (CLI-1) */}
                  <div className="carnet-status-card" data-testid="carnet-card">
                    {clientCarnet ? (
                      <>
                        <div className="carnet-top-row">
                          <div>
                            <span className="carnet-label">{t.carnetLabel}</span>
                            <div className="carnet-fraction">
                              <b>{Math.min(clientCarnet.completedCount, clientCarnet.totalPurchased)}</b> / {clientCarnet.totalPurchased} {t.carnetDoneCount}
                            </div>
                            {/* A pack saved before 14 October 2026 has no date: the first version wrote a pack of 10 at 500 € for any
                                client whose session was logged. It is shown to check, its price not repeated. */}
                            <span className="client-card-sub">{clientCarnet.boughtOn ? t.carnetBought(paperDate(clientCarnet.boughtOn, fr), clientCarnet.pricePerPack ? euros(clientCarnet.pricePerPack, fr) : '') : t.carnetLegacy}</span>
                          </div>
                          <span className="carnet-remaining-badge">
                            {carnetLeft} {t.carnetLeft}
                          </span>
                        </div>
                        <div className="carnet-progress-bar">
                          <div className="carnet-progress-fill" style={{ width: `${Math.min(100, (clientCarnet.completedCount / clientCarnet.totalPurchased) * 100)}%` }} />
                        </div>
                        {carnetLeft === 0 && <p className="sc-frame-note" data-testid="carnet-done">{t.carnetDone}</p>}
                      </>
                    ) : (
                      <p className="office-strong" data-testid="carnet-none">{t.noCarnet}</p>
                    )}

                    {carnetForm ? (
                      <div className="log-session-box">
                        <div className="inline-inputs">
                          <div className="input-group">
                            <label htmlFor="cf-sessions">{t.carnetSessions}</label>
                            <input id="cf-sessions" type="number" inputMode="numeric" min="1" value={carnetForm.sessions} onChange={e => setCarnetForm(f => ({ ...f, sessions: e.target.value }))} />
                          </div>
                          <div className="input-group">
                            <label htmlFor="cf-price">{t.carnetPrice}</label>
                            <input id="cf-price" type="text" inputMode="decimal" value={carnetForm.price} onChange={e => setCarnetForm(f => ({ ...f, price: e.target.value }))} />
                          </div>
                        </div>
                        <div className="input-group">
                          <label htmlFor="cf-date">{t.carnetDate}</label>
                          <input id="cf-date" type="date" value={carnetForm.boughtOn} onChange={e => setCarnetForm(f => ({ ...f, boughtOn: e.target.value }))} />
                        </div>
                        <div className="form-actions-row">
                          <button type="button" className="btn-cancel press" onClick={() => setCarnetForm(null)}>{t.cancel}</button>
                          <button type="button" className="btn-save press" onClick={handleSaveCarnet} data-testid="btn-save-carnet">{t.confirm}</button>
                        </div>
                      </div>
                    ) : (!clientCarnet || carnetLeft === 0) ? (
                      <div className="carnet-action-bar">
                        <button type="button" className="quick-suite-btn press" onClick={() => setCarnetForm({ sessions: '', price: '', boughtOn: localIsoDate() })} data-testid="btn-add-carnet">
                          + {clientCarnet ? t.newCarnet : t.addCarnet}
                        </button>
                      </div>
                    ) : null}

                    <div className="carnet-action-bar">
                      <button
                        type="button"
                        className="log-session-btn press"
                        onClick={() => { hapticLight(); setIsLoggingSession(!isLoggingSession); }}
                        data-testid="btn-log-session"
                      >
                        + {t.logSession}
                      </button>
                    </div>

                    {isLoggingSession && (
                      <div className="log-session-box">
                        <label htmlFor="ls-type">{t.sessionTypeNotes}</label>
                        <input id="ls-type" type="text" value={sessionTypeInput} onChange={e => setSessionTypeInput(e.target.value)} placeholder={t.sessionTypePh} />
                        <div className="input-group">
                          <label htmlFor="ls-minutes">{t.sessionDuration}</label>
                          <select id="ls-minutes" value={sessionMinutes} onChange={e => setSessionMinutes(e.target.value)}>
                            {['30', '45', '60', '75', '90', '120'].map(m => <option key={m} value={m}>{t.minutes(m)}</option>)}
                          </select>
                        </div>
                        <textarea
                          rows={2}
                          value={sessionNotesInput}
                          onChange={e => setSessionNotesInput(e.target.value)}
                          placeholder={t.sessionNotesPh}
                          aria-label={t.sessionTypeNotes}
                        />
                        <div className="form-actions-row">
                          <button type="button" className="btn-cancel press" onClick={() => setIsLoggingSession(false)}>
                            {t.cancel}
                          </button>
                          <button type="button" className="btn-save press" onClick={handleLogDeliveredSession} data-testid="btn-confirm-session">
                            {t.confirmSession}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Past Sessions History */}
                  {clientSessionsList.length > 0 && (
                    <div className="session-history-block">
                      <span className="detail-box-label">{t.sessionsHistory}</span>
                      <div className="session-cards-list">
                        {clientSessionsList.map(s => (
                          <div key={s.id} className="session-history-item">
                            <div className="session-history-date">{paperDate(s.date, fr)}{s.durationMin ? ` · ${t.minutes(s.durationMin)}` : ''}</div>
                            <div className="session-history-desc">
                              <strong>{s.type || t.sessionUntitled}</strong>
                              {s.notes ? <span>{s.notes}</span> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="detail-cards-grid">
                    <div className="detail-box">
                      <span className="detail-box-label">{t.goalsHead}</span>
                      <p>{selectedClient.goals || t.goalsNone}</p>
                    </div>
                    <div className="detail-box">
                      <span className="detail-box-label">{t.notesHead}</span>
                      <p>{selectedClient.notes || t.notesNone}</p>
                      <p className="office-hint is-quiet">{t.notesLocal}</p>
                    </div>
                  </div>

                  <div className="detail-action-buttons">
                    <button type="button" className="quick-suite-btn press" onClick={() => { hapticLight(); setActiveSubTab('nutrition'); }}>
                      <SvgSalad />{t.btnNutrition}
                    </button>
                    <button type="button" className="quick-suite-btn press" onClick={() => { hapticLight(); setActiveSubTab('accounting'); }}>
                      <SvgEuro />{t.btnInvoice}
                    </button>
                    <button type="button" className="quick-suite-btn press" onClick={() => { hapticLight(); setShowContractModal(true); }} data-testid="btn-open-contract">
                      <SvgDoc />{t.btnContract}
                    </button>
                  </div>

                  {/* The contract: a model to have read by a lawyer, never "conforme" (CTR-1). */}
                  {showContractModal && (
                    <div className="contract-modal-card" data-testid="contract-modal">
                      <div className="card-top-row">
                        <div>
                          <b>{t.ctrHead}</b>
                          <p className="section-subtext">{t.ctrSub}</p>
                        </div>
                        <button type="button" className="text-close-btn" onClick={() => setShowContractModal(false)} aria-label={t.close}><SvgClose /></button>
                      </div>

                      <div className="invoice-controls-row">
                        <div className="contract-controls-bar">
                          <label htmlFor="ctr-package">{t.ctrPackage}</label>
                          <select id="ctr-package" value={contractPackage} onChange={e => setContractPackage(e.target.value)}>
                            <option value="carnet">{t.ctrCarnet}</option>
                            <option value="single_session">{t.ctrSingle}</option>
                            <option value="monthly">{t.ctrMonthly}</option>
                          </select>
                        </div>
                        {(contractPackage === 'monthly'
                          ? [['perMonth', t.ctrPerMonth, 'numeric'], ['months', t.ctrMonths, 'numeric'], ['monthly', t.ctrMonthlyPrice, 'decimal']]
                          : contractPackage === 'carnet'
                            ? [['sessions', t.ctrSessions, 'numeric'], ['price', t.ctrPackPrice, 'decimal'], ['validity', t.ctrValidity, 'numeric']]
                            : [['price', t.ctrSinglePrice, 'decimal']]
                        ).map(([k, label, mode]) => (
                          <div key={k} className="contract-controls-bar">
                            <label htmlFor={`ctr-${k}`}>{label}</label>
                            <input id={`ctr-${k}`} type="text" inputMode={mode} value={contractForm[k]} onChange={setContract(k)} data-testid={`ctr-${k}`} />
                          </div>
                        ))}
                      </div>

                      {generatedContract ? (
                        <>
                          <div className="contract-paper-preview" lang="fr">
                            <pre className="contract-text">{generatedContract.text}</pre>
                          </div>
                          <div className="contract-modal-actions">
                            <button
                              type="button"
                              className="suite-action-btn press"
                              onClick={() => {
                                hapticLight();
                                Promise.resolve().then(() => navigator.clipboard.writeText(generatedContract.text))
                                  .then(() => setCopiedContract('ok'), () => setCopiedContract('fail'));
                              }}
                              data-testid="btn-copy-contract"
                            >
                              {copiedContract === 'ok' ? <><SvgCheck />{t.copied}</> : <><SvgCopy />{t.copyText}</>}
                            </button>
                            <button
                              type="button"
                              className="suite-action-btn press"
                              onClick={() => { hapticLight(); contractPdf.share(generatedContract.title, generatedContract.lines, `contrat-${selectedClient?.name || ''}`); }}
                              data-testid="btn-pdf-contract"
                            >
                              <SvgPrint />{t.pdf}
                            </button>
                            <button type="button" className="btn-cancel press" onClick={() => setShowContractModal(false)}>{t.close}</button>
                          </div>
                          {copiedContract === 'fail' && <p className="sc-frame-note" role="status">{t.copyFailed}</p>}
                          {contractPdf.note && <p className="sc-frame-note" role="status">{contractPdf.note}</p>}
                        </>
                      ) : (
                        <div className="office-missing" data-testid="contract-missing">
                          <p className="office-strong">{t.missingContract}</p>
                          <ul>{contractLacks.map(m => <li key={m}>{t.missing[m]}</li>)}</ul>
                          {contractLacks.some(m => ['coachName', 'siret', 'coachAddress', 'cartePro', 'mediator'].includes(m)) && <p className="section-subtext office-flush">{t.profileWhere}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: COMPTABILITÉ (CoachAccounting.jsx) ─── */}
      {activeSubTab === 'accounting' && coachProfile && (
        <CoachAccounting fr={fr} clients={clients} selectedClient={selectedClient} profile={coachProfile} onSaveProfile={handleSaveProfile} />
      )}

      {/* ─── TAB 3: NUTRITION (CoachNutrition.jsx) ─── */}
      {activeSubTab === 'nutrition' && (
        <CoachNutrition fr={fr} client={selectedClient} meals={clientMealHistory} onLogMeal={handleLogMeal} onUpdateClient={handleUpdateClient} />
      )}

      {/* ─── TAB 4: KINÉSITHÉRAPIE PAR ZONE ─── */}
      {activeSubTab === 'physio' && (
        <div className="suite-content-section" data-testid="section-physio">
          <div className="section-header-row">
            <div>
              <h3>{t.physioTitle}</h3>
              <p className="section-subtext">{t.physioSub}</p>
              <p className="sc-frame-note" data-testid="physio-note">{t.physioNote}</p>
            </div>
          </div>

          {/* Region Filter Chips */}
          <div className="physio-chips-row">
            {PHYSIO_REGIONS.map(reg => (
              <button
                key={reg.id}
                type="button"
                className={`physio-chip ${selectedPhysioRegion === reg.id ? 'active' : ''}`}
                onClick={() => { hapticLight(); setSelectedPhysioRegion(reg.id); }}
                data-testid={`physio-chip-${reg.id}`}
              >
                {fr ? reg.labelFr : reg.labelEn}
              </button>
            ))}
          </div>

          {/* Physio Cards Grid */}
          <div className="physio-cards-grid">
            {filteredPhysio.map(item => (
              <div key={item.key} className="physio-exercise-card" data-testid={`physio-item-${item.key}`}>
                <div className="physio-card-top">
                  <span className="physio-region-tag">{fr ? item.regionLabelFr : item.regionLabelEn}</span>
                  <span className="camera-view-tag">
                    <SvgVideo />{item.cameraView === 'side' ? t.viewSide : t.viewFront}
                  </span>
                </div>
                <h4 className="physio-ex-name">{fr ? item.nameFr : item.nameEn}</h4>
                <p className="physio-rationale">{t.physioMuscles}{fr ? '\u00A0: ' : ': '}{(fr ? item.primaryMuscles : item.primaryMusclesEn).join(', ')}</p>
                <div className="physio-progression-box">
                  <div className="prog-line">
                    <span className="prog-badge reg">{t.regression}</span>
                    <span>{fr ? item.regression : item.regressionEn}</span>
                  </div>
                  <div className="prog-line">
                    <span className="prog-badge prog">{t.progression}</span>
                    <span>{fr ? item.progression : item.progressionEn}</span>
                  </div>
                </div>
                {/* A hold the app does not count (the plank) cannot go into a programme (programmeOf drops it), so it
                    offers no button rather than one that adds nothing (assessment of 14 October 2026). */}
                {onAddToProgramme && programmable(item.key) && (
                  <button
                    type="button"
                    className="add-to-prog-btn press"
                    onClick={() => {
                      hapticLight();
                      onAddToProgramme(item.key);
                    }}
                    data-testid={`add-physio-${item.key}`}
                  >
                    + {t.physioAdd}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
