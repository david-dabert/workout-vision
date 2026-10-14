import { useState, useEffect, useMemo, useRef } from 'react';
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
import {
  getDailyTargets,
  calculateAdherenceScore,
} from '../../lib/nutrition';
import {
  analyzePlatePixels,
  lookupBarcodeProduct,
} from '../../lib/nutritionVision';
import {
  PHYSIO_CATALOG,
  PHYSIO_REGIONS,
} from '../../lib/physioCatalog';
import { hapticLight, hapticTap } from '../../lib/haptics';
import { DemoTag } from '../experience/Showcase';
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
const SvgCamera = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const SvgBarcode = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14"/></svg>;
const SvgSave = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const SvgTarget = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
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
    const created = await saveClient({ ...newClient, name: newClient.name.trim() });
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
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractPackage, setContractPackage] = useState('carnet');
  const [contractSessions, setContractSessions] = useState('10');
  const [contractPrice, setContractPrice] = useState('');
  const [contractValidity, setContractValidity] = useState('6');
  const [copiedContract, setCopiedContract] = useState('');
  const contractPdf = useOfficePdf(fr);
  const contractData = {
    coach: coachProfile || {},
    client: { name: selectedClient?.name || '', address: selectedClient?.address || '' },
    packageType: contractPackage,
    sessionsCount: contractPackage === 'carnet' ? Number(contractSessions) : 1,
    totalPrice: Number(String(contractPrice).replace(',', '.')),
    validityMonths: Number(contractValidity),
  };
  const contractLacks = contractMissing(contractData, isValidSiret);
  const generatedContract = contractLacks.length ? null : generateCoachingContract(contractData);

  // ─── 3. Nutrition & Vision State ───
  const [nutritionGoal, setNutritionGoal] = useState('cut'); // 'cut' | 'maintain' | 'bulk'
  const [nutritionSubMode, setNutritionSubMode] = useState('targets'); // 'targets' | 'vision_plate' | 'barcode'

  // Vision Plate State
  const plateCanvasRef = useRef(null);
  const plateFileInputRef = useRef(null);
  const [plateImageSrc, setPlateImageSrc] = useState(null);
  const [plateAnalysis, setPlateAnalysis] = useState(null);

  // Barcode State
  const [barcodeInput, setBarcodeInput] = useState('5060746500000');
  const [scannedProduct, setScannedProduct] = useState(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);

  const clientTargets = useMemo(() => {
    if (!selectedClient) return null;
    return getDailyTargets(
      {
        weight: selectedClient.weight || '75',
        height: selectedClient.height || '175',
        age: selectedClient.age || '30',
        sex: selectedClient.sex || 'male',
        activityLevel: 'moderate',
      },
      nutritionGoal
    );
  }, [selectedClient, nutritionGoal]);

  const sampleAdherence = useMemo(() => {
    return calculateAdherenceScore([
      { date: '2026-10-07', adherent: true },
      { date: '2026-10-08', adherent: true },
      { date: '2026-10-09', adherent: false },
      { date: '2026-10-10', adherent: true },
      { date: '2026-10-11', adherent: true },
      { date: '2026-10-12', adherent: true },
      { date: '2026-10-13', adherent: true },
    ]);
  }, []);

  const handlePlatePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    hapticTap();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = plateCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 240;
        canvas.height = 240;
        ctx.drawImage(img, 0, 0, 240, 240);

        const imgData = ctx.getImageData(0, 0, 240, 240);
        const analysis = analyzePlatePixels(imgData.data, 240, 240);
        setPlateAnalysis(analysis);
        setPlateImageSrc(ev.target?.result);
      };
      img.src = ev.target?.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveVisionMeal = async () => {
    if (!selectedClientId || !plateAnalysis) return;
    hapticTap();
    const meal = {
      dateStr: new Date().toISOString().slice(0, 10),
      mealType: 'lunch',
      source: 'vision_plate',
      title: fr ? 'Repas Détecté par Vision Assiette' : 'Vision Analyzed Meal',
      calories: plateAnalysis.totalCalories,
      proteinG: plateAnalysis.totalProteinG,
      carbsG: plateAnalysis.totalCarbsG,
      fatG: plateAnalysis.totalFatG,
    };
    const logged = await logClientMeal(selectedClientId, meal);
    setClientMealHistory(prev => [logged, ...prev]);
    setPlateAnalysis(null);
    setPlateImageSrc(null);
  };

  const handleLookupBarcode = async (codeToSearch) => {
    const code = codeToSearch || barcodeInput;
    if (!code) return;
    hapticLight();
    setBarcodeLoading(true);
    const prod = await lookupBarcodeProduct(code);
    setBarcodeLoading(false);
    if (prod) {
      setScannedProduct(prod);
    }
  };

  const handleSaveBarcodeMeal = async () => {
    if (!selectedClientId || !scannedProduct) return;
    hapticTap();
    const meal = {
      dateStr: new Date().toISOString().slice(0, 10),
      mealType: 'snack',
      source: 'barcode',
      title: `${scannedProduct.name} (${scannedProduct.brand})`,
      calories: scannedProduct.calories,
      proteinG: scannedProduct.proteinG,
      carbsG: scannedProduct.carbsG,
      fatG: scannedProduct.fatG,
      barcode: scannedProduct.barcode,
    };
    const logged = await logClientMeal(selectedClientId, meal);
    setClientMealHistory(prev => [logged, ...prev]);
    setScannedProduct(null);
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
          <span><SvgSalad />{fr ? 'Vision Assiette & Nutrition' : 'Nutrition Vision & Macros'}</span>
        </button>
        <button
          type="button"
          className={`suite-tab-btn ${activeSubTab === 'physio' ? 'active' : ''}`}
          onClick={() => { hapticLight(); setActiveSubTab('physio'); }}
          data-testid="tab-physio"
        >
          <span><SvgStetho />{fr ? 'Kiné par Zone' : 'Physio by Joint'}</span>
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
              + {fr ? 'Nouveau Client' : 'Add Client'}
            </button>
          </div>

          {/* Add Client Modal/Card: every field empty, emptied again after a save */}
          {isAddingClient && (
            <form className="add-client-card" onSubmit={handleSaveNewClient} data-testid="add-client-form">
              <div className="card-top-row">
                <b>{fr ? 'Fiche Nouveau Client' : 'New Client Profile'}</b>
                <button type="button" className="text-close-btn" onClick={() => setIsAddingClient(false)} aria-label={t.close}><SvgClose /></button>
              </div>
              <div className="form-grid">
                <div className="input-group">
                  <label htmlFor="nc-name">{fr ? 'Prénom & Nom' : 'Full Name'}</label>
                  <input id="nc-name" type="text" required placeholder={fr ? 'ex : Alexandre Dupont' : 'e.g. Alex Smith'} value={newClient.name} onChange={setNew('name')} />
                </div>
                <div className="input-group">
                  <label htmlFor="nc-age">{fr ? 'Âge & Sexe' : 'Age & Sex'}</label>
                  <div className="inline-inputs">
                    <input id="nc-age" type="number" inputMode="numeric" placeholder={fr ? 'Âge' : 'Age'} value={newClient.age} onChange={setNew('age')} />
                    <select value={newClient.sex} onChange={setNew('sex')} aria-label={fr ? 'Sexe' : 'Sex'}>
                      <option value="">{t.sexUnknown}</option>
                      <option value="female">{fr ? 'Femme' : 'Female'}</option>
                      <option value="male">{fr ? 'Homme' : 'Male'}</option>
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <label htmlFor="nc-weight">{fr ? 'Poids (kg) & Taille (cm)' : 'Weight (kg) & Height (cm)'}</label>
                  <div className="inline-inputs">
                    <input id="nc-weight" type="number" inputMode="decimal" placeholder={fr ? 'Poids (kg)' : 'Weight (kg)'} value={newClient.weight} onChange={setNew('weight')} />
                    <input type="number" inputMode="numeric" placeholder={fr ? 'Taille (cm)' : 'Height (cm)'} aria-label={fr ? 'Taille (cm)' : 'Height (cm)'} value={newClient.height} onChange={setNew('height')} />
                  </div>
                </div>
                <div className="input-group">
                  <label htmlFor="nc-address">{t.fClientAddress}</label>
                  <input id="nc-address" type="text" placeholder={t.fAddressPh} value={newClient.address} onChange={setNew('address')} />
                </div>
                <div className="input-group">
                  <label htmlFor="nc-goals">{fr ? 'Objectifs' : 'Goals'}</label>
                  <input id="nc-goals" type="text" placeholder={fr ? 'ex : Hypertrophie dorsaux, rééducation épaule' : 'e.g. back hypertrophy'} value={newClient.goals} onChange={setNew('goals')} />
                </div>
                <div className="input-group full-width">
                  <label htmlFor="nc-notes">{fr ? 'Notes & Contraintes' : 'Coach Notes'}</label>
                  <textarea id="nc-notes" rows={2} placeholder={fr ? 'Antécédents articulaires, consignes spécifiques...' : 'Joint history, specific instructions...'} value={newClient.notes} onChange={setNew('notes')} />
                  <span className="office-hint is-quiet">{t.notesLocal}</span>
                </div>
              </div>
              <div className="form-actions-row">
                <button type="button" className="btn-cancel press" onClick={() => setIsAddingClient(false)}>
                  {fr ? 'Annuler' : 'Cancel'}
                </button>
                <button type="submit" className="btn-save press">
                  {fr ? 'Enregistrer le Client' : 'Save Client'}
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
                      </span>
                    </div>
                    {!confirmDelete && (
                      <button
                        type="button"
                        className="delete-client-btn press"
                        onClick={() => { hapticLight(); setConfirmDelete(true); }}
                        data-testid="btn-delete-client"
                      >
                        {fr ? 'Supprimer' : 'Delete'}
                      </button>
                    )}
                  </div>

                  {confirmDelete && (
                    <div className="office-missing" role="alertdialog" aria-label={t.deleteAsk(selectedClient.name)} data-testid="confirm-delete">
                      <p className="office-strong">{t.deleteAsk(selectedClient.name)}</p>
                      <div className="form-actions-row">
                        <button type="button" className="btn-cancel press" onClick={() => setConfirmDelete(false)}>{fr ? 'Annuler' : 'Cancel'}</button>
                        <button type="button" className="btn-save press" onClick={() => handleDeleteClient(selectedClient.id)} data-testid="btn-delete-yes">{fr ? 'Supprimer' : 'Delete'}</button>
                      </div>
                    </div>
                  )}

                  {/* The pack: none until the coach records a purchase (CLI-1) */}
                  <div className="carnet-status-card" data-testid="carnet-card">
                    {clientCarnet ? (
                      <>
                        <div className="carnet-top-row">
                          <div>
                            <span className="carnet-label">{fr ? 'Carnet Coaching (Pack)' : 'Coaching Pack Credits'}</span>
                            <div className="carnet-fraction">
                              <b>{Math.min(clientCarnet.completedCount, clientCarnet.totalPurchased)}</b> / {clientCarnet.totalPurchased} {fr ? 'séances effectuées' : 'sessions delivered'}
                            </div>
                            <span className="client-card-sub">{t.carnetBought(paperDate(clientCarnet.boughtOn || '', fr), clientCarnet.pricePerPack ? euros(clientCarnet.pricePerPack, fr) : '')}</span>
                          </div>
                          <span className="carnet-remaining-badge">
                            {carnetLeft} {fr ? 'restantes' : 'remaining'}
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
                          <button type="button" className="btn-cancel press" onClick={() => setCarnetForm(null)}>{fr ? 'Annuler' : 'Cancel'}</button>
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
                        + {fr ? 'Décompter une Séance Livrée' : 'Log Delivered Session'}
                      </button>
                    </div>

                    {isLoggingSession && (
                      <div className="log-session-box">
                        <label htmlFor="ls-type">{fr ? 'Type de Séance & Notes' : 'Session Notes'}</label>
                        <input id="ls-type" type="text" value={sessionTypeInput} onChange={e => setSessionTypeInput(e.target.value)} placeholder={fr ? 'Coaching 1 h' : 'Coaching 1 h'} />
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
                          placeholder={fr ? 'Charge augmentée, excellente technique squat...' : 'Progression notes...'}
                          aria-label={fr ? 'Notes' : 'Notes'}
                        />
                        <div className="form-actions-row">
                          <button type="button" className="btn-cancel press" onClick={() => setIsLoggingSession(false)}>
                            {fr ? 'Annuler' : 'Cancel'}
                          </button>
                          <button type="button" className="btn-save press" onClick={handleLogDeliveredSession} data-testid="btn-confirm-session">
                            {fr ? 'Confirmer la séance' : 'Confirm Session'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Past Sessions History */}
                  {clientSessionsList.length > 0 && (
                    <div className="session-history-block">
                      <span className="detail-box-label">{fr ? 'Historique des Séances Livrées' : 'Delivered Session Log'}</span>
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
                      <span className="detail-box-label">{fr ? 'Objectifs Déclarés' : 'Training Goals'}</span>
                      <p>{selectedClient.goals || t.goalsNone}</p>
                    </div>
                    <div className="detail-box">
                      <span className="detail-box-label">{fr ? 'Observations & Pathologies' : 'Coach Notes'}</span>
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
                        {contractPackage === 'carnet' && (
                          <div className="contract-controls-bar">
                            <label htmlFor="ctr-sessions">{t.ctrSessions}</label>
                            <input id="ctr-sessions" type="number" inputMode="numeric" min="1" value={contractSessions} onChange={e => setContractSessions(e.target.value)} />
                          </div>
                        )}
                        <div className="contract-controls-bar">
                          <label htmlFor="ctr-price">{t.ctrPrice}</label>
                          <input id="ctr-price" type="text" inputMode="decimal" value={contractPrice} onChange={e => setContractPrice(e.target.value)} data-testid="ctr-price" />
                        </div>
                        <div className="contract-controls-bar">
                          <label htmlFor="ctr-validity">{t.ctrValidity}</label>
                          <input id="ctr-validity" type="number" inputMode="numeric" min="1" value={contractValidity} onChange={e => setContractValidity(e.target.value)} />
                        </div>
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

      {/* ─── TAB 3: VISION ASSIETTE & NUTRITION ─── */}
      {activeSubTab === 'nutrition' && (
        <div className="suite-content-section" data-testid="section-nutrition">
          <div className="section-header-row">
            <div>
              <h3>{fr ? 'Nutrition & Analyse Vision d’Assiette' : 'Nutrition & Plate Computer Vision Studio'}</h3>
              <p className="section-subtext">
                {fr
                  ? 'Calcul métabolique (Schoenfeld/Morton), estimation volumétrique d’assiette par caméra et scan code-barres Open Food Facts.'
                  : 'Evidence-based metabolic targets, plate computer vision macro estimator, and barcode scanner.'}
              </p>
            </div>
            <div className="nutrition-mode-switcher">
              <button
                type="button"
                className={`mode-btn ${nutritionSubMode === 'targets' ? 'active' : ''}`}
                onClick={() => { hapticLight(); setNutritionSubMode('targets'); }}
              >
                <SvgTarget />{fr ? 'Cibles Carence' : 'Macro Targets'}
              </button>
              <button
                type="button"
                className={`mode-btn ${nutritionSubMode === 'vision_plate' ? 'active' : ''}`}
                onClick={() => { hapticLight(); setNutritionSubMode('vision_plate'); }}
                data-testid="btn-mode-vision"
              >
                <SvgCamera />{fr ? 'Vision Assiette' : 'Plate Vision'}
              </button>
              <button
                type="button"
                className={`mode-btn ${nutritionSubMode === 'barcode' ? 'active' : ''}`}
                onClick={() => { hapticLight(); setNutritionSubMode('barcode'); }}
                data-testid="btn-mode-barcode"
              >
                <SvgBarcode />{fr ? 'Scanner Code-Barres' : 'Barcode Scan'}
              </button>
            </div>
          </div>

          {/* Sub-mode 1: Targets & Compliance */}
          {nutritionSubMode === 'targets' && (
            <div>
              <div className="nutrition-goal-selector">
                <button
                  type="button"
                  className={`goal-btn ${nutritionGoal === 'cut' ? 'active' : ''}`}
                  onClick={() => { hapticLight(); setNutritionGoal('cut'); }}
                >
                  {fr ? 'Sèche (Déficit 20%)' : 'Fat Loss (20% Cut)'}
                </button>
                <button
                  type="button"
                  className={`goal-btn ${nutritionGoal === 'maintain' ? 'active' : ''}`}
                  onClick={() => { hapticLight(); setNutritionGoal('maintain'); }}
                >
                  {fr ? 'Maintien' : 'Maintenance'}
                </button>
                <button
                  type="button"
                  className={`goal-btn ${nutritionGoal === 'bulk' ? 'active' : ''}`}
                  onClick={() => { hapticLight(); setNutritionGoal('bulk'); }}
                >
                  {fr ? 'Prise de Masse' : 'Muscle Gain'}
                </button>
              </div>

              {clientTargets ? (
                <div className="nutrition-cards-layout">
                  <div className="client-target-summary">
                    <span className="summary-client-name">
                      {fr ? 'Cibles pour\u00A0: ' : 'Targets for: '}
                      <b>{selectedClient ? selectedClient.name : 'Client'}</b> ({selectedClient?.weight || 75}{'\u00A0'}kg)
                    </span>
                    <div className="target-macros-grid">
                      <div className="macro-card cal-card">
                        <span className="macro-val">{clientTargets.calories}</span>
                        <span className="macro-unit">kcal / jour</span>
                        <span className="macro-name">{fr ? 'Énergie Totale' : 'Total Energy'}</span>
                      </div>
                      <div className="macro-card protein-card">
                        <span className="macro-val">{clientTargets.protein}{'\u00A0'}g</span>
                        <span className="macro-unit">
                          {(clientTargets.protein / parseFloat(selectedClient?.weight || '75')).toFixed(1)} g/kg
                        </span>
                        <span className="macro-name">{fr ? 'Protéines' : 'Protein'}</span>
                      </div>
                      <div className="macro-card carbs-card">
                        <span className="macro-val">{clientTargets.carbs}{'\u00A0'}g</span>
                        <span className="macro-unit">{Math.round((clientTargets.carbs * 4 / clientTargets.calories) * 100)}% cal</span>
                        <span className="macro-name">{fr ? 'Glucides' : 'Carbs'}</span>
                      </div>
                      <div className="macro-card fat-card">
                        <span className="macro-val">{clientTargets.fat}{'\u00A0'}g</span>
                        <span className="macro-unit">{Math.round((clientTargets.fat * 9 / clientTargets.calories) * 100)}% cal</span>
                        <span className="macro-name">{fr ? 'Lipides' : 'Fats'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Compliance / Observance Rating Card */}
                  <div className="adherence-card">
                    <div className="adherence-header">
                      <b>{fr ? 'Observance Nutritionnelle Client (7 derniers jours)' : 'Weekly Client Compliance'}</b>
                      <span className="adherence-tags">
                        <span className="adherence-score-pill">{sampleAdherence.complianceRatePct}{fr ? '\u202F' : ''}%</span>
                        {/* The week shown is a sample written in the code, not the client's log (R8). */}
                        <DemoTag fr={fr} />
                      </span>
                    </div>
                    <div className="adherence-bar-container">
                      <div
                        className="adherence-bar-fill"
                        style={{ width: `${sampleAdherence.complianceRatePct}%` }}
                      />
                    </div>
                    <p className="adherence-comment">
                      {fr
                        ? `${sampleAdherence.adherentDays} jours sur ${sampleAdherence.daysLogged} respectés. Excellente discipline sur les apports protéiques cibles.`
                        : `${sampleAdherence.adherentDays} of ${sampleAdherence.daysLogged} target days met. High consistency on daily protein minimums.`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="empty-clients-box">
                  <p>{fr ? 'Veuillez sélectionner ou ajouter un client dans l’onglet Clients pour calculer ses macros.' : 'Select or add a client in the Clients tab to calculate targets.'}</p>
                </div>
              )}
            </div>
          )}

          {/* Sub-mode 2: Vision Assiette (Plate Computer Vision Analyzer) */}
          {nutritionSubMode === 'vision_plate' && (
            <div className="vision-plate-section" data-testid="section-vision-plate">
              <input
                type="file"
                ref={plateFileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handlePlatePhotoUpload}
              />

              <div className="vision-upload-header">
                <div>
                  <h4>{fr ? 'Analyseur Visuel d’Assiette par Caméra' : 'Plate Computer Vision Macro Estimator'}</h4>
                  <p className="section-subtext">
                    {fr
                      ? 'Prenez une photo de l’assiette. L’algorithme segmente les protéines, féculents et légumes et calcule les portions en grammes.'
                      : 'Snap or upload a meal photo. On-device vision segments food clusters and estimates macros.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="suite-action-btn press"
                  onClick={() => plateFileInputRef.current?.click()}
                  data-testid="btn-upload-plate"
                >
                  <SvgCamera />{fr ? 'Prendre Photo de l’Assiette' : 'Upload Meal Photo'}
                </button>
              </div>

              <div className="vision-plate-workbench">
                <div className="canvas-wrapper">
                  <canvas ref={plateCanvasRef} className="plate-canvas" width="240" height="240" />
                  {!plateImageSrc && (
                    <div className="canvas-placeholder" onClick={() => plateFileInputRef.current?.click()}>
                      <span><SvgSalad /></span>
                      <p>{fr ? 'Cliquez pour charger la photo d’un repas' : 'Click to analyze a meal photo'}</p>
                    </div>
                  )}
                </div>

                {plateAnalysis && (
                  <div className="plate-results-pane">
                    <div className="plate-summary-top">
                      <div>
                        <span className="plate-cal-num">{plateAnalysis.totalCalories}{'\u00A0'}kcal</span>
                        <span className="plate-grams-sub">~ {plateAnalysis.totalGrams}{'\u00A0'}g {fr ? 'pesée estimée' : 'estimated meal'}</span>
                      </div>
                      <span className="plate-tags">
                        <span className="plate-conf-tag">
                          {fr ? 'Confiance Vision\u00A0: Élevée' : 'Vision Confidence: High'}
                        </span>
                        {/* The confidence is a fixed word in the code, not a measure of this photo (R8). */}
                        <DemoTag fr={fr} />
                      </span>
                    </div>

                    <div className="components-list">
                      {plateAnalysis.components.map((c, i) => (
                        <div key={i} className="comp-row">
                          <div className="comp-header">
                            <span className="comp-dot" style={{ backgroundColor: c.colorHex }} />
                            <strong className="comp-name">{fr ? c.labelFr : c.label}</strong>
                            <span className="comp-grams">{c.estimatedGrams}{'\u00A0'}g</span>
                          </div>
                          <div className="comp-macros-mini">
                            <span>{c.calories}{'\u00A0'}kcal</span>
                            {c.proteinG > 0 && <span>• {c.proteinG}g P</span>}
                            {c.carbsG > 0 && <span>• {c.carbsG}g G</span>}
                            {c.fatG > 0 && <span>• {c.fatG}g L</span>}
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="analysis-note-text">
                      {fr ? plateAnalysis.analysisNoteFr : plateAnalysis.analysisNoteEn}
                    </p>

                    <button
                      type="button"
                      className="suite-action-btn press"
                      onClick={handleSaveVisionMeal}
                      data-testid="btn-save-vision-meal"
                    >
                      <SvgSave />{fr ? `Enregistrer dans le journal de ${selectedClient ? selectedClient.name : 'Client'}` : 'Save Meal to Client Log'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sub-mode 3: Barcode / QR Scanner */}
          {nutritionSubMode === 'barcode' && (
            <div className="barcode-scanner-section" data-testid="section-barcode-scan">
              <div className="barcode-header-row">
                <div>
                  <h4>{fr ? 'Scanner de Code-Barres & Produits (Open Food Facts)' : 'Food Packaging Barcode Scanner'}</h4>
                  <p className="section-subtext">
                    {fr
                      ? 'Recherche instantanée des données nutritionnelles officielles via base Open Food Facts avec cache hors-ligne pour la salle.'
                      : 'Instant official packaging nutrition lookup with offline cache for fitness staples.'}
                  </p>
                </div>
              </div>

              <div className="barcode-input-bar">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={e => setBarcodeInput(e.target.value)}
                  placeholder="Code-barres EAN-13 (ex: 5060746500000)"
                />
                <button
                  type="button"
                  className="suite-action-btn press"
                  onClick={() => handleLookupBarcode()}
                  data-testid="btn-search-barcode"
                >
                  {barcodeLoading ? (fr ? 'Recherche...' : 'Searching...') : (fr ? 'Scanner / Rechercher' : 'Lookup')}
                </button>
              </div>

              {/* Quick Preset Buttons for Common Gym Staples */}
              <div className="staples-chips-row">
                <span className="staples-label">
                  {fr ? 'Staples Musculation\u00A0: ' : 'Gym Staples: '}
                </span>
                <button type="button" className="staple-chip" onClick={() => { setBarcodeInput('5060746500000'); handleLookupBarcode('5060746500000'); }}>
                  Whey Optimum Nutrition
                </button>
                <button type="button" className="staple-chip" onClick={() => { setBarcodeInput('3228857000166'); handleLookupBarcode('3228857000166'); }}>
                  Blanc de Poulet Fleury Michon
                </button>
                <button type="button" className="staple-chip" onClick={() => { setBarcodeInput('3033491484085'); handleLookupBarcode('3033491484085'); }}>
                  Skyr Nature Danone
                </button>
                <button type="button" className="staple-chip" onClick={() => { setBarcodeInput('3250390001421'); handleLookupBarcode('3250390001421'); }}>
                  Riz Basmati Taureau Ailé
                </button>
              </div>

              {scannedProduct && (
                <div className="scanned-product-card" data-testid="scanned-product-card">
                  <div className="prod-top-row">
                    <div>
                      <span className="prod-brand">{scannedProduct.brand}</span>
                      <h4 className="prod-name">{scannedProduct.name}</h4>
                      <span className="prod-sub">{scannedProduct.servingGrams}g portion • EAN {scannedProduct.barcode}</span>
                    </div>
                    {scannedProduct.nutriScore && (
                      <span className={`nutriscore-badge ns-${scannedProduct.nutriScore.toLowerCase()}`}>
                        Nutri-Score {scannedProduct.nutriScore}
                      </span>
                    )}
                  </div>

                  <div className="prod-macros-grid">
                    <div className="prod-m-box">
                      <b>{scannedProduct.calories}</b>
                      <span>kcal</span>
                    </div>
                    <div className="prod-m-box">
                      <b>{scannedProduct.proteinG}g</b>
                      <span>{fr ? 'Protéines' : 'Protein'}</span>
                    </div>
                    <div className="prod-m-box">
                      <b>{scannedProduct.carbsG}g</b>
                      <span>{fr ? 'Glucides' : 'Carbs'}</span>
                    </div>
                    <div className="prod-m-box">
                      <b>{scannedProduct.fatG}g</b>
                      <span>{fr ? 'Lipides' : 'Fat'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="suite-action-btn press"
                    onClick={handleSaveBarcodeMeal}
                    data-testid="btn-save-barcode-meal"
                  >
                    <SvgSave />{fr ? `Ajouter au journal de ${selectedClient ? selectedClient.name : 'Client'}` : 'Add to Client Log'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Client Meal Log History */}
          {clientMealHistory.length > 0 && (
            <div className="meal-history-section">
              <h4>{fr ? 'Journal Alimentaire Récemment Enregistré' : 'Recently Logged Meals'}</h4>
              <div className="meals-list">
                {clientMealHistory.map(m => (
                  <div key={m.id} className="meal-history-card">
                    <div className="meal-h-left">
                      <span className="meal-source-tag">
                        {m.source === 'vision_plate' ? <><SvgCamera />Vision</> : <><SvgBarcode />Scan</>}
                      </span>
                      <strong>{m.title}</strong>
                      <span className="meal-date-str">{m.dateStr}</span>
                    </div>
                    <div className="meal-h-right">
                      <b>{m.calories}{'\u00A0'}kcal</b>
                      <span>{m.proteinG}g P • {m.carbsG}g G • {m.fatG}g L</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: KINÉSITHÉRAPIE PAR ZONE ─── */}
      {activeSubTab === 'physio' && (
        <div className="suite-content-section" data-testid="section-physio">
          <div className="section-header-row">
            <div>
              <h3>{fr ? 'Rééducation par Zone Anatomique' : 'Physiotherapy & Joint Rehab Catalog'}</h3>
              <p className="section-subtext">
                {fr
                  ? 'Exercices thérapeutiques validés avec angles de vue caméra recommandés et filières de progression.'
                  : 'Clinically validated exercises with camera angle guidelines and progression hierarchies.'}
              </p>
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
                    <SvgVideo />{item.cameraView === 'side' ? (fr ? 'Vue Profil' : 'Side View') : (fr ? 'Vue Face' : 'Front View')}
                  </span>
                </div>
                <h4 className="physio-ex-name">{fr ? item.nameFr : item.nameEn}</h4>
                <p className="physio-rationale">{fr ? item.clinicalRationaleFr : item.clinicalRationaleEn}</p>
                <div className="physio-progression-box">
                  <div className="prog-line">
                    <span className="prog-badge reg">{fr ? 'Régression' : 'Regression'}</span>
                    <span>{item.regression}</span>
                  </div>
                  <div className="prog-line">
                    <span className="prog-badge prog">{fr ? 'Progression' : 'Progression'}</span>
                    <span>{item.progression}</span>
                  </div>
                </div>
                {onAddToProgramme && (
                  <button
                    type="button"
                    className="add-to-prog-btn press"
                    onClick={() => {
                      hapticLight();
                      onAddToProgramme(item.key);
                    }}
                    data-testid={`add-physio-${item.key}`}
                  >
                    + {fr ? 'Ajouter à la fiche d’exercices' : 'Add to Programme'}
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
