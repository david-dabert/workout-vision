import { useState, useEffect, useMemo, useRef } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  getAllClients,
  saveClient,
  deleteClient,
  getClientWorkouts,
  logClientSession,
  getClientSessions,
  saveClientCarnet,
  getClientCarnet,
  logClientMeal,
  getClientMeals,
  saveLivreRecettesEntry,
  getLivreRecettesEntries,
} from '../../lib/coachStorage';
import {
  calculateCoachAccounting,
  generateFrenchInvoice,
  exportLivreRecettesCsv,
  calculateCoachAnnualPl,
} from '../../lib/accounting';
import { generateCoachingContract } from '../../lib/coachContracts';
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
import { DemoTag, Range } from '../experience/Showcase';
import { num } from '../experience/showcase-text';
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
const SvgDownload = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const SvgCamera = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const SvgBarcode = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14"/></svg>;
const SvgSave = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const SvgTarget = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
const SvgBulb = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/></svg>;
const SvgVideo = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;

export default function CoachSuite({ onAddToProgramme, onSelectClient }) {
  const { lang } = useT();
  const fr = lang === 'fr';

  const [activeSubTab, setActiveSubTab] = useState('clients'); // 'clients' | 'accounting' | 'nutrition' | 'physio'

  // ─── 1. Clients State ───
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientAge, setNewClientAge] = useState('');
  const [newClientSex, setNewClientSex] = useState('male');
  const [newClientWeight, setNewClientWeight] = useState('75');
  const [newClientHeight, setNewClientHeight] = useState('175');
  const [newClientGoals, setNewClientGoals] = useState('');
  const [newClientNotes, setNewClientNotes] = useState('');
  const [clientWorkoutCounts, setClientWorkoutCounts] = useState({});

  // Client Session & Carnet Tracking
  const [clientCarnet, setClientCarnet] = useState({ totalPurchased: 10, completedCount: 0, pricePerPack: 500 });
  const [clientSessionsList, setClientSessionsList] = useState([]);
  const [clientMealHistory, setClientMealHistory] = useState([]);
  const [isLoggingSession, setIsLoggingSession] = useState(false);
  const [sessionNotesInput, setSessionNotesInput] = useState('');
  const [sessionTypeInput, setSessionTypeInput] = useState('Coaching 1h (Plateau Musculation)');

  useEffect(() => {
    let mounted = true;
    getAllClients().then(async (list) => {
      if (!mounted) return;
      setClients(list);
      if (list.length > 0 && !selectedClientId) {
        setSelectedClientId(list[0].id);
      }
      // Load workout counts
      const counts = {};
      for (const cl of list) {
        const wks = await getClientWorkouts(cl.id);
        counts[cl.id] = wks.length;
      }
      if (mounted) setClientWorkoutCounts(counts);
    });
    return () => { mounted = false; };
  }, [selectedClientId]);

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
    if (!newClientName.trim()) return;
    hapticTap();
    const created = await saveClient({
      name: newClientName.trim(),
      age: newClientAge,
      sex: newClientSex,
      weight: newClientWeight,
      height: newClientHeight,
      goals: newClientGoals,
      notes: newClientNotes,
    });
    setClients(prev => [created, ...prev]);
    setSelectedClientId(created.id);
    setIsAddingClient(false);
    setNewClientName('');
    setNewClientGoals('');
    setNewClientNotes('');
  };

  const handleDeleteClient = async (id) => {
    hapticLight();
    await deleteClient(id);
    setClients(prev => prev.filter(c => c.id !== id));
    if (selectedClientId === id) {
      setSelectedClientId(clients.find(c => c.id !== id)?.id || null);
    }
  };

  const handleLogDeliveredSession = async () => {
    if (!selectedClientId) return;
    hapticTap();
    const sessionDate = new Date().toISOString().slice(0, 10);
    const logged = await logClientSession(selectedClientId, {
      date: sessionDate,
      type: sessionTypeInput,
      durationMin: 60,
      notes: sessionNotesInput || (fr ? 'Séance effectuée avec succès' : 'Session completed successfully'),
    });
    const updatedSessions = [logged, ...clientSessionsList];
    setClientSessionsList(updatedSessions);

    // Update carnet
    const newCarnet = {
      ...clientCarnet,
      completedCount: clientCarnet.completedCount + 1,
    };
    await saveClientCarnet(selectedClientId, newCarnet);
    setClientCarnet(newCarnet);
    setIsLoggingSession(false);
    setSessionNotesInput('');
  };

  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // ─── 2. Accounting State ───
  const [monthlyRent, setMonthlyRent] = useState(650);
  const [regime, setRegime] = useState('micro'); // 'micro' | 'reel'
  const [sessionPrice, setSessionPrice] = useState(50);
  const [sessionsCount, setSessionsCount] = useState(40);
  const [coachSiret, setCoachSiret] = useState('842 918 203 00018');
  const [coachCartePro, setCoachCartePro] = useState('ED-75-2023-09418');
  const [coachRcpPro, setCoachRcpPro] = useState('MACSF Sport Pro N° 4920184');
  const [coachName, setCoachName] = useState('Coach Thomas');
  const [copiedInvoice, setCopiedInvoice] = useState(false);
  const [livreEntries, setLivreEntries] = useState([]);
  const [showAnnualPl, setShowAnnualPl] = useState(false);

  // Contract generator state
  const [showContractModal, setShowContractModal] = useState(false);
  const [contractPackage, setContractPackage] = useState('carnet_10');
  const [copiedContract, setCopiedContract] = useState(false);

  const generatedContract = useMemo(() => {
    const pkgPrice = contractPackage === 'carnet_10' ? sessionPrice * 10 :
      contractPackage === 'monthly_retainer' ? 350 :
      contractPackage === 'biomech_pack' ? 60 : sessionPrice;

    return generateCoachingContract({
      contractNumber: `CTR-${new Date().getFullYear()}-${selectedClientId ? String(selectedClientId).slice(-4) : '001'}`,
      coach: {
        name: coachName,
        siret: coachSiret,
        address: 'France',
        cartePro: coachCartePro,
        rcpPro: coachRcpPro,
        gymFacility: 'Basic-Fit',
      },
      client: {
        name: selectedClient ? selectedClient.name : 'Client Particulier',
        email: selectedClient?.email,
        phone: selectedClient?.phone,
      },
      packageType: contractPackage,
      sessionsCount: contractPackage === 'carnet_10' ? 10 : 1,
      totalPriceEur: pkgPrice,
      validityMonths: 6,
    });
  }, [selectedClient, selectedClientId, coachName, coachSiret, coachCartePro, coachRcpPro, contractPackage, sessionPrice]);

  // Load Livre des Recettes entries
  useEffect(() => {
    getLivreRecettesEntries().then(entries => {
      setLivreEntries(entries);
    });
  }, []);

  const accounting = useMemo(() => {
    return calculateCoachAccounting({
      monthlyRent,
      regime,
      averageSessionPrice: sessionPrice,
      monthlySessionsCount: sessionsCount,
    });
  }, [monthlyRent, regime, sessionPrice, sessionsCount]);

  const annualPl = useMemo(() => {
    return calculateCoachAnnualPl({
      monthlyRent,
      averageSessionPrice: sessionPrice,
      monthlySessionsCount: sessionsCount,
    });
  }, [monthlyRent, sessionPrice, sessionsCount]);

  // Invoice builder
  const [invoiceType, setInvoiceType] = useState('coaching_pack'); // coaching_session | coaching_pack | monthly_retainer | biomech_assessment | physio_prehab
  const generatedInvoice = useMemo(() => {
    const items = [];
    if (invoiceType === 'coaching_session') {
      items.push({ description: fr ? 'Séance de Coaching Sportif Individuel (1h)' : 'Individual Personal Training Session (1h)', quantity: 1, unitPriceHt: sessionPrice });
    } else if (invoiceType === 'coaching_pack') {
      items.push({ description: fr ? 'Forfait Carnet 10 Séances de Coaching Personnalisé' : '10-Session Personal Training Pack', quantity: 1, unitPriceHt: sessionPrice * 10 });
    } else if (invoiceType === 'monthly_retainer') {
      items.push({ description: fr ? 'Abonnement Mensuel Suivi & Programmation Illimitée' : 'Monthly Unlimited Coaching & Programming Retainer', quantity: 1, unitPriceHt: 350 });
    } else if (invoiceType === 'biomech_assessment') {
      items.push({ description: fr ? 'Bilan Postural & Analyse Biomécanique WorkoutVision' : 'WorkoutVision Biomechanical & Postural Assessment', quantity: 1, unitPriceHt: 60 });
    } else {
      items.push({ description: fr ? 'Séance de Réathlétisation & Prévention Kiné-Sport' : 'Physio Prehab & Return-to-Sport Movement Session', quantity: 1, unitPriceHt: 70 });
    }

    return generateFrenchInvoice({
      invoiceNumber: `F-${new Date().getFullYear()}-${selectedClientId ? String(selectedClientId).slice(-4) : '001'}`,
      coach: {
        name: coachName,
        siret: coachSiret,
        address: 'France',
        gymFacility: 'Basic-Fit',
        cartePro: coachCartePro,
        rcpPro: coachRcpPro,
      },
      client: {
        name: selectedClient ? selectedClient.name : 'Client Particulier',
      },
      regime,
      items,
    });
  }, [invoiceType, sessionPrice, coachName, coachSiret, coachCartePro, coachRcpPro, selectedClient, selectedClientId, regime, fr]);

  const handleCopyInvoice = () => {
    hapticLight();
    const text = `=== FACTURE N° ${generatedInvoice.invoiceNumber} ===\n` +
      `Date d'émission\u00A0: ${generatedInvoice.issueDate}\n` +
      `Émetteur\u00A0: ${generatedInvoice.coach.legalName} (SIRET\u00A0: ${generatedInvoice.coach.siret})\n` +
      `Lieu d'exercice\u00A0: ${generatedInvoice.coach.gymFacility}\n` +
      `Carte Pro DRAJES\u00A0: ${generatedInvoice.coach.cartePro}\n` +
      `Assurance RCP Pro\u00A0: ${generatedInvoice.coach.rcpPro}\n` +
      `Client\u00A0: ${generatedInvoice.client.name}\n` +
      `Prestation\u00A0: ${generatedInvoice.items.map(it => `${it.description} (${it.quantity} x ${it.unitPriceHt} €)`).join(', ')}\n` +
      `Total HT\u00A0: ${generatedInvoice.totalHt} €\n` +
      `TVA\u00A0: ${generatedInvoice.tvaRate === 0 ? '0 % (TVA non applicable, art. 293 B du CGI)' : `20 % (${generatedInvoice.totalTva} €)`}\n` +
      `Total TTC\u00A0: ${generatedInvoice.totalTtc} €\n\n` +
      `Mentions obligatoires\u00A0:\n` +
      generatedInvoice.legalMentions.join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopiedInvoice(true);
      setTimeout(() => setCopiedInvoice(false), 2500);
    });
  };

  const handleSaveToLivreRecettes = async () => {
    hapticTap();
    const entry = {
      date: generatedInvoice.issueDate,
      invoiceNumber: generatedInvoice.invoiceNumber,
      clientName: generatedInvoice.client.name,
      naturePrestation: generatedInvoice.items.map(i => i.description).join(' + '),
      montantHt: generatedInvoice.totalHt,
      modeReglement: 'Virement',
    };
    await saveLivreRecettesEntry(entry);
    setLivreEntries(prev => [entry, ...prev]);
  };

  const handleDownloadCsv = () => {
    hapticLight();
    const entriesToExport = livreEntries.length > 0 ? livreEntries : [
      {
        date: generatedInvoice.issueDate,
        invoiceNumber: generatedInvoice.invoiceNumber,
        clientName: generatedInvoice.client.name,
        naturePrestation: generatedInvoice.items[0]?.description || 'Coaching',
        montantHt: generatedInvoice.totalHt,
        modeReglement: 'Virement',
      }
    ];
    const csvContent = exportLivreRecettesCsv(entriesToExport);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `livre-recettes-${new Date().getFullYear()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
          <span><SvgUsers />{fr ? 'Clients & Suivi (Carnets)' : 'Clients & Records (Packs)'}</span>
        </button>
        <button
          type="button"
          className={`suite-tab-btn ${activeSubTab === 'accounting' ? 'active' : ''}`}
          onClick={() => { hapticLight(); setActiveSubTab('accounting'); }}
          data-testid="tab-accounting"
        >
          <span><SvgEuro />{fr ? 'Comptabilité Freelance (Basic-Fit)' : 'Freelance Accounting & Invoicing'}</span>
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

      {/* ─── TAB 1: CLIENTS & SUIVI (CARNETS & SÉANCES) ─── */}
      {activeSubTab === 'clients' && (
        <div className="suite-content-section" data-testid="section-clients">
          <div className="section-header-row">
            <div>
              <h3>{fr ? 'Gestion Multi-Clients & Carnets' : 'Multi-Client Management & Session Packs'}</h3>
              <p className="section-subtext">
                {fr
                  ? 'Suivi des carnets 10 séances, séances réalisées et télémétrie biomécanique isolée.'
                  : '10-session pack balances, delivered training sessions, and isolated telemetry.'}
              </p>
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

          {/* Add Client Modal/Card */}
          {isAddingClient && (
            <form className="add-client-card" onSubmit={handleSaveNewClient}>
              <div className="card-top-row">
                <b>{fr ? 'Fiche Nouveau Client' : 'New Client Profile'}</b>
                <button type="button" className="text-close-btn" onClick={() => setIsAddingClient(false)}><SvgClose /></button>
              </div>
              <div className="form-grid">
                <div className="input-group">
                  <label>{fr ? 'Prénom & Nom' : 'Full Name'}</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Alexandre Dupont"
                    value={newClientName}
                    onChange={e => setNewClientName(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>{fr ? 'Âge & Sexe' : 'Age & Sex'}</label>
                  <div className="inline-inputs">
                    <input
                      type="number"
                      placeholder="Âge"
                      value={newClientAge}
                      onChange={e => setNewClientAge(e.target.value)}
                    />
                    <select value={newClientSex} onChange={e => setNewClientSex(e.target.value)}>
                      <option value="male">{fr ? 'Homme' : 'Male'}</option>
                      <option value="female">{fr ? 'Femme' : 'Female'}</option>
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <label>{fr ? 'Poids (kg) & Taille (cm)' : 'Weight & Height'}</label>
                  <div className="inline-inputs">
                    <input
                      type="number"
                      placeholder="Poids (kg)"
                      value={newClientWeight}
                      onChange={e => setNewClientWeight(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Taille (cm)"
                      value={newClientHeight}
                      onChange={e => setNewClientHeight(e.target.value)}
                    />
                  </div>
                </div>
                <div className="input-group">
                  <label>{fr ? 'Objectifs' : 'Goals'}</label>
                  <input
                    type="text"
                    placeholder="ex: Hypertrophie dorsaux, rééducation épaule"
                    value={newClientGoals}
                    onChange={e => setNewClientGoals(e.target.value)}
                  />
                </div>
                <div className="input-group full-width">
                  <label>{fr ? 'Notes & Contraintes' : 'Coach Notes'}</label>
                  <textarea
                    rows={2}
                    placeholder="Antécédents articulaires, consignes spécifiques..."
                    value={newClientNotes}
                    onChange={e => setNewClientNotes(e.target.value)}
                  />
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
              <p>{fr ? 'Aucun client enregistré pour l’instant. Ajoutez votre premier client pour isoler ses séries.' : 'No clients saved yet. Add your first client to track their sets separately.'}</p>
            </div>
          ) : (
            <div className="clients-split-layout">
              <div className="clients-sidebar">
                {clients.map(cl => (
                  <div
                    key={cl.id}
                    className={`client-item-card press ${selectedClientId === cl.id ? 'active' : ''}`}
                    onClick={() => {
                      hapticLight();
                      setSelectedClientId(cl.id);
                      if (onSelectClient) onSelectClient(cl);
                    }}
                    data-testid={`client-${cl.id}`}
                  >
                    <div className="client-initials">
                      {cl.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="client-card-info">
                      <span className="client-card-name">{cl.name}</span>
                      <span className="client-card-sub">
                        {cl.weight ? `${cl.weight}\u00A0kg` : ''} • {clientWorkoutCounts[cl.id] || 0} {fr ? 'séances' : 'sessions'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {selectedClient && (
                <div className="client-detail-pane">
                  <div className="detail-pane-header">
                    <div>
                      <h4>{selectedClient.name}</h4>
                      <span className="detail-meta">
                        {selectedClient.sex === 'female' ? (fr ? 'Femme' : 'Female') : (fr ? 'Homme' : 'Male')}
                        {selectedClient.age ? ` • ${selectedClient.age} ${fr ? 'ans' : 'years'}` : ''}
                        {selectedClient.weight ? ` • ${selectedClient.weight}\u00A0kg` : ''}
                        {selectedClient.height ? ` • ${selectedClient.height}\u00A0cm` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="delete-client-btn press"
                      onClick={() => handleDeleteClient(selectedClient.id)}
                      title={fr ? 'Supprimer ce client' : 'Delete client'}
                    >
                      {fr ? 'Supprimer' : 'Delete'}
                    </button>
                  </div>

                  {/* Carnet 10 Séances Status HUD */}
                  <div className="carnet-status-card">
                    <div className="carnet-top-row">
                      <div>
                        <span className="carnet-label">{fr ? 'Carnet Coaching (Pack)' : 'Coaching Pack Credits'}</span>
                        <div className="carnet-fraction">
                          <b>{clientCarnet.completedCount}</b> / {clientCarnet.totalPurchased} {fr ? 'séances effectuées' : 'sessions delivered'}
                        </div>
                      </div>
                      <span className="carnet-remaining-badge">
                        {clientCarnet.totalPurchased - clientCarnet.completedCount} {fr ? 'restantes' : 'remaining'}
                      </span>
                    </div>
                    <div className="carnet-progress-bar">
                      <div
                        className="carnet-progress-fill"
                        style={{ width: `${Math.min(100, (clientCarnet.completedCount / clientCarnet.totalPurchased) * 100)}%` }}
                      />
                    </div>
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
                        <label>{fr ? 'Type de Séance & Notes' : 'Session Notes'}</label>
                        <input
                          type="text"
                          value={sessionTypeInput}
                          onChange={e => setSessionTypeInput(e.target.value)}
                          placeholder="Coaching 1h..."
                        />
                        <textarea
                          rows={2}
                          value={sessionNotesInput}
                          onChange={e => setSessionNotesInput(e.target.value)}
                          placeholder={fr ? 'Charge augmentée, excellente technique squat...' : 'Progression notes...'}
                        />
                        <div className="form-actions-row">
                          <button type="button" className="btn-cancel press" onClick={() => setIsLoggingSession(false)}>
                            {fr ? 'Annuler' : 'Cancel'}
                          </button>
                          <button type="button" className="btn-save press" onClick={handleLogDeliveredSession}>
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
                            <div className="session-history-date">{s.date}</div>
                            <div className="session-history-desc">
                              <strong>{s.type}</strong>
                              <span>{s.notes}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="detail-cards-grid">
                    <div className="detail-box">
                      <span className="detail-box-label">{fr ? 'Objectifs Déclarés' : 'Training Goals'}</span>
                      <p>{selectedClient.goals || (fr ? 'Général / Force & Hypertrophie' : 'General Fitness & Strength')}</p>
                    </div>
                    <div className="detail-box">
                      <span className="detail-box-label">{fr ? 'Observations & Pathologies' : 'Coach Clinical Notes'}</span>
                      <p>{selectedClient.notes || (fr ? 'Aucune restriction particulière signalée.' : 'No contraindications noted.')}</p>
                    </div>
                  </div>

                  <div className="detail-action-buttons">
                    <button
                      type="button"
                      className="quick-suite-btn press"
                      onClick={() => {
                        hapticLight();
                        setActiveSubTab('nutrition');
                      }}
                    >
                      <SvgSalad />{fr ? 'Vision Assiette & Macros' : 'Macro Targets'}
                    </button>
                    <button
                      type="button"
                      className="quick-suite-btn press"
                      onClick={() => {
                        hapticLight();
                        setActiveSubTab('accounting');
                      }}
                    >
                      <SvgEuro />{fr ? 'Générer une Facture' : 'Create Invoice'}
                    </button>
                    <button
                      type="button"
                      className="quick-suite-btn press"
                      onClick={() => {
                        hapticLight();
                        setShowContractModal(true);
                      }}
                      data-testid="btn-open-contract"
                    >
                      <SvgDoc />{fr ? 'Contrat de Coaching' : 'Coaching Contract'}
                    </button>
                  </div>

                  {/* Contract Generator Modal Card */}
                  {showContractModal && (
                    <div className="contract-modal-card" data-testid="contract-modal">
                      <div className="card-top-row">
                        <div>
                          <b>{fr ? 'Contrat de Prestation de Coaching Sportif' : 'Personal Training Agreement'}</b>
                          <p className="section-subtext">
                            {fr ? 'Conforme au Code civil (Art. 1101), Code du Sport (Art. L212-1) et clause d’annulation 24h.' : 'Compliant with French Sports Code, liability insurance, and 24h cancellation terms.'}
                          </p>
                        </div>
                        <button type="button" className="text-close-btn" onClick={() => setShowContractModal(false)}><SvgClose /></button>
                      </div>

                      <div className="contract-controls-bar">
                        <label>{fr ? 'Formule Souscrite\u00A0: ' : 'Package: '}</label>
                        <select value={contractPackage} onChange={e => setContractPackage(e.target.value)}>
                          <option value="carnet_10">{fr ? 'Carnet 10 Séances (Pack 10)' : '10-Session Pack'}</option>
                          <option value="single_session">{fr ? 'Séance Individuelle (1h)' : 'Single Session (1h)'}</option>
                          <option value="monthly_retainer">{fr ? 'Abonnement Mensuel Suivi Illimité' : 'Monthly Retainer'}</option>
                          <option value="biomech_pack">{fr ? 'Bilan Biomécanique WorkoutVision' : 'Biomechanical Pack'}</option>
                        </select>
                      </div>

                      <div className="contract-paper-preview">
                        <pre className="contract-text">
                          {generatedContract.contractText}
                        </pre>
                      </div>

                      <div className="contract-modal-actions">
                        <button
                          type="button"
                          className="suite-action-btn press"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedContract.contractText);
                            setCopiedContract(true);
                            setTimeout(() => setCopiedContract(false), 2500);
                          }}
                          data-testid="btn-copy-contract"
                        >
                          {copiedContract ? <><SvgCheck />{fr ? 'Contrat Copié' : 'Copied'}</> : <><SvgCopy />{fr ? 'Copier le Contrat' : 'Copy Text'}</>}
                        </button>
                        <button
                          type="button"
                          className="suite-action-btn press"
                          onClick={() => window.print()}
                          data-testid="btn-print-contract"
                        >
                          <SvgPrint />{fr ? 'Imprimer / PDF' : 'Print / PDF'}
                        </button>
                        <button
                          type="button"
                          className="btn-cancel press"
                          onClick={() => setShowContractModal(false)}
                        >
                          {fr ? 'Fermer' : 'Close'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: COMPTABILITÉ FREELANCE (BASIC-FIT) ─── */}
      {activeSubTab === 'accounting' && (
        <div className="suite-content-section" data-testid="section-accounting">
          <div className="section-header-row">
            <div>
              <h3>{fr ? 'Comptabilité Coach & Loyer Basic-Fit' : 'Coach Freelance Accounting & Basic-Fit Simulator'}</h3>
              <p className="section-subtext">
                {fr
                  ? 'Gestion de la redevance Basic-Fit (650 €/mois), cotisations URSSAF, mentions légales Décret 2022-725 et facturation conforme.'
                  : 'Basic-Fit facility rent deduction (€650/mo), French URSSAF charges, and compliant invoice generator.'}
              </p>
            </div>
            <div className="regime-toggle">
              <button
                type="button"
                className={`regime-btn ${regime === 'micro' ? 'active' : ''}`}
                onClick={() => { hapticLight(); setRegime('micro'); }}
              >
                Micro-BNC (21.1%)
              </button>
              <button
                type="button"
                className={`regime-btn ${regime === 'reel' ? 'active' : ''}`}
                onClick={() => { hapticLight(); setRegime('reel'); }}
              >
                EI Réel / SASU (20% TVA)
              </button>
            </div>
          </div>

          {/* Legal Compliance Checklist Badge Bar */}
          <div className="compliance-badge-bar">
            <span className="comp-badge"><SvgCheck />{fr ? 'Mention "EI" Décret 2022-725' : 'EI Legal Name'}</span>
            <span className="comp-badge"><SvgCheck />{fr ? 'Carte Pro DRAJES' : 'Sports License'}</span>
            <span className="comp-badge"><SvgCheck />{fr ? 'Assurance RCP Pro' : 'Liability Insured'}</span>
            <span className="comp-badge"><SvgCheck />{fr ? 'TVA Art. 293 B' : 'TVA Exemption'}</span>
            <span className="comp-badge"><SvgCheck />{fr ? 'Pénalités & 40 € Art. D441-5' : 'Statutory Late Fee'}</span>
          </div>

          {/* Interactive Accounting Tuner */}
          <div className="accounting-tuners-card">
            <div className="tuner-row sc-ranges">
              <Range
                label={fr ? 'Redevance Salle Basic-Fit' : 'Monthly Gym Rent'}
                display={`${monthlyRent}\u00A0€`}
                min="300"
                max="1200"
                step="50"
                value={monthlyRent}
                onChange={e => setMonthlyRent(Number(e.target.value))}
              />
              <Range
                label={fr ? 'Tarif Moyen par Séance' : 'Average Session Price'}
                display={`${sessionPrice}\u00A0€`}
                min="30"
                max="120"
                step="5"
                value={sessionPrice}
                onChange={e => setSessionPrice(Number(e.target.value))}
              />
              <Range
                label={fr ? 'Séances Livrées / Mois' : 'Monthly Sessions'}
                display={sessionsCount}
                min="10"
                max="100"
                step="5"
                value={sessionsCount}
                onChange={e => setSessionsCount(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Financial Breakdown HUD */}
          <div className="financial-hud-grid">
            <div className="hud-card">
              <span className="hud-label">{fr ? 'Chiffre d’Affaires Brut' : 'Gross Revenue'}</span>
              <span className="hud-num">{num(accounting.grossRevenueHt, fr)}{'\u00A0'}€</span>
              <span className="hud-sub">{sessionsCount} séances × {sessionPrice}{'\u00A0'}€</span>
            </div>

            <div className="hud-card rent-card">
              <span className="hud-label">{fr ? 'Loyer Basic-Fit Déduit' : 'Facility Rent Paid'}</span>
              <span className="hud-num negative">−{num(accounting.gymRent, fr)}{'\u00A0'}€</span>
              <span className="hud-sub">{fr ? 'Redevance contractuelle' : 'Contractual gym lease'}</span>
            </div>

            <div className="hud-card">
              <span className="hud-label">{fr ? 'Cotisations URSSAF + CFP' : 'Social Contributions'}</span>
              <span className="hud-num negative">−{num(accounting.socialContributions, fr)}{'\u00A0'}€</span>
              <span className="hud-sub">{regime === 'micro' ? '21.3 % du CA brut' : '40 % du bénéfice'}</span>
            </div>

            <div className="hud-card take-home-card">
              <span className="hud-label">{fr ? 'Reste à Vivre Net Réel' : 'Net Take-Home Pay'}</span>
              <span className="hud-num positive">{num(accounting.netTakeHomePay, fr)}{'\u00A0'}€</span>
              <span className="hud-sub">{fr ? 'Après loyer, URSSAF & impôt' : 'After rent, tax & charges'}</span>
            </div>
          </div>

          {/* Break-Even Insight Banner */}
          <div className="break-even-banner">
            <span className="be-icon"><SvgBulb /></span>
            <div>
              <strong>{fr ? 'Seuil de Rentabilité Loyer\u00A0: ' : 'Rent Break-Even: '}</strong>
              <span>
                {fr
                  ? `Il vous faut réaliser ${accounting.breakEvenSessionsForRent} séances par mois uniquement pour payer le loyer de 650\u00A0€ à Basic-Fit. Dès la ${accounting.breakEvenSessionsForRent + 1}e séance, vous dégagez votre propre revenu net.`
                  : `You must deliver ${accounting.breakEvenSessionsForRent} sessions/month solely to cover the €650 Basic-Fit rent. Every session past the ${accounting.breakEvenSessionsForRent + 1}th generates net income.`}
              </span>
            </div>
          </div>

          {/* Legal French Invoice Generator Card */}
          <div className="invoice-builder-card">
            <div className="invoice-builder-header">
              <div>
                <h4>{fr ? 'Générateur de Factures Légales (Art. L441-9 & Décret 2022-725)' : 'Compliant French Legal Invoice Generator'}</h4>
                <p className="section-subtext">
                  {fr
                    ? 'Conforme aux obligations micro-entrepreneur, mention EI, pénalités et indemnité 40 €.'
                    : 'Legally compliant with French tax and commercial code.'}
                </p>
              </div>
              <div className="invoice-actions">
                <button
                  type="button"
                  className="copy-invoice-btn press"
                  onClick={handleCopyInvoice}
                  data-testid="btn-copy-invoice"
                >
                  {copiedInvoice ? <><SvgCheck />{fr ? 'Facture Copiée' : 'Copied'}</> : (fr ? 'Copier le Texte' : 'Copy Text')}
                </button>
                <button
                  type="button"
                  className="suite-action-btn press"
                  onClick={() => window.print()}
                  data-testid="btn-print-invoice"
                >
                  <SvgPrint />{fr ? 'Imprimer / PDF' : 'Print / PDF'}
                </button>
                <button
                  type="button"
                  className="quick-suite-btn press"
                  onClick={handleSaveToLivreRecettes}
                  data-testid="btn-save-recette"
                >
                  <SvgDownload />{fr ? 'Enregistrer Recette' : 'Save Receipt'}
                </button>
              </div>
            </div>

            <div className="invoice-controls-row">
              <div className="invoice-field">
                <label>{fr ? 'Type de Prestation' : 'Service Item'}</label>
                <select value={invoiceType} onChange={e => setInvoiceType(e.target.value)}>
                  <option value="coaching_session">{fr ? 'Séance individuelle (1h)' : 'Single Session (1h)'}</option>
                  <option value="coaching_pack">{fr ? 'Carnet 10 séances' : '10-Session Pack'}</option>
                  <option value="monthly_retainer">{fr ? 'Forfait mensuel illimité' : 'Monthly Retainer'}</option>
                  <option value="biomech_assessment">{fr ? 'Bilan biomécanique WorkoutVision' : 'Biomechanical Assessment'}</option>
                  <option value="physio_prehab">{fr ? 'Réathlétisation & Prévention Kiné' : 'Physio Prehab'}</option>
                </select>
              </div>
              <div className="invoice-field">
                <label>{fr ? 'Nom du Coach' : 'Coach Name'}</label>
                <input
                  type="text"
                  value={coachName}
                  onChange={e => setCoachName(e.target.value)}
                  placeholder="Coach Thomas"
                />
              </div>
              <div className="invoice-field">
                <label>{fr ? 'Numéro SIRET' : 'SIRET'}</label>
                <input
                  type="text"
                  value={coachSiret}
                  onChange={e => setCoachSiret(e.target.value)}
                  placeholder="14 chiffres"
                />
              </div>
              <div className="invoice-field">
                <label>{fr ? 'Carte Pro DRAJES' : 'License ID'}</label>
                <input
                  type="text"
                  value={coachCartePro}
                  onChange={e => setCoachCartePro(e.target.value)}
                  placeholder="ED-75-..."
                />
              </div>
              <div className="invoice-field">
                <label>{fr ? 'Assurance RCP Pro' : 'Professional Liability'}</label>
                <input
                  type="text"
                  value={coachRcpPro}
                  onChange={e => setCoachRcpPro(e.target.value)}
                  placeholder="MACSF, MAAF, etc."
                />
              </div>
            </div>

            {/* Rendered Invoice Paper Preview */}
            <div className="invoice-preview-sheet">
              <div className="inv-top">
                <span className="inv-num">FACTURE N° {generatedInvoice.invoiceNumber}</span>
                <span className="inv-date">Date{fr ? '\u00A0:' : ':'} {generatedInvoice.issueDate}</span>
              </div>
              <div className="inv-parties">
                <div>
                  <strong>{generatedInvoice.coach.legalName}</strong>
                  <span>SIRET{fr ? '\u00A0:' : ':'} {generatedInvoice.coach.siret}</span>
                  <span>{fr ? 'Carte Pro\u00A0:' : 'Sports Card:'} {generatedInvoice.coach.cartePro}</span>
                  <span>{fr ? 'Lieu d’exercice\u00A0:' : 'Facility:'} {generatedInvoice.coach.gymFacility}</span>
                </div>
                <div className="inv-client">
                  <strong>{fr ? 'Client\u00A0:' : 'Client:'} {generatedInvoice.client.name}</strong>
                  <span>{fr ? 'Mode de règlement\u00A0: Virement / CB' : 'Payment: Bank Transfer / Card'}</span>
                  <span>Échéance{fr ? '\u00A0:' : ':'} {generatedInvoice.dueDate}</span>
                </div>
              </div>
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>{fr ? 'Désignation' : 'Description'}</th>
                    <th>Qté</th>
                    <th>Prix HT</th>
                    <th>Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedInvoice.items.map((it, idx) => (
                    <tr key={idx}>
                      <td>{it.description}</td>
                      <td>{it.quantity}</td>
                      <td>{it.unitPriceHt}{'\u00A0'}€</td>
                      <td>{it.quantity * it.unitPriceHt}{'\u00A0'}€</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="inv-total-row">
                <div className="inv-legal-mentions">
                  {generatedInvoice.legalMentions.map((m, i) => (
                    <small key={i}>{m}</small>
                  ))}
                </div>
                <div className="inv-amounts">
                  <span>Total HT{fr ? '\u00A0:' : ':'} {generatedInvoice.totalHt}{'\u00A0'}€</span>
                  {generatedInvoice.tvaRate > 0 && <span>TVA 20%{fr ? '\u00A0:' : ':'} {generatedInvoice.totalTva}{'\u00A0'}€</span>}
                  <b className="total-ttc">TOTAL TTC{fr ? '\u00A0:' : ':'} {generatedInvoice.totalTtc}{'\u00A0'}€</b>
                </div>
              </div>
            </div>
          </div>

          {/* Official Livre des Recettes (French Micro-Enterprise Log) */}
          <div className="livre-recettes-card">
            <div className="livre-header">
              <div>
                <h4>{fr ? 'Livre des Recettes Micro-Entrepreneur (Art. L123-28 C. com.)' : 'Official Receipts Ledger'}</h4>
                <p className="section-subtext">
                  {fr
                    ? 'Registre obligatoire des encaissements chronologiques pour les éducateurs sportifs auto-entrepreneurs.'
                    : 'Mandatory French chronological receipt registry for tax declaration.'}
                </p>
              </div>
              <button
                type="button"
                className="suite-action-btn press"
                onClick={handleDownloadCsv}
                data-testid="btn-download-csv"
              >
                <SvgDownload />{fr ? 'Télécharger le Livre des Recettes (CSV)' : 'Export Receipts (CSV)'}
              </button>
            </div>

            {livreEntries.length > 0 ? (
              <div className="livre-table-wrap">
                <table className="livre-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>N° Facture</th>
                      <th>Client</th>
                      <th>Prestation</th>
                      <th>Montant HT</th>
                      <th>Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {livreEntries.map((e, idx) => (
                      <tr key={idx}>
                        <td>{e.date}</td>
                        <td>{e.invoiceNumber}</td>
                        <td>{e.clientName}</td>
                        <td>{e.naturePrestation}</td>
                        <td><b>{e.montantHt}{'\u00A0'}€</b></td>
                        <td>{e.modeReglement}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="section-subtext">
                {fr ? 'Aucune recette enregistrée pour l’instant. Cliquez sur "Enregistrer Recette" ci-dessus pour archiver vos factures.' : 'No receipts saved yet.'}
              </p>
            )}
          </div>

          {/* 12-Month Annual P&L Projection */}
          <div className="annual-pl-card">
            <div className="annual-pl-header" onClick={() => setShowAnnualPl(!showAnnualPl)}>
              <div>
                <h4>{fr ? 'Projection Annuelle & Saisonnalité Fitness (12 Mois)' : '12-Month Cash-Flow & Seasonality Forecast'}</h4>
                <span className="section-subtext">
                  {fr ? 'Intègre les pics de septembre et janvier et le creux d’août avec la redevance Basic-Fit' : 'Incorporates September/January gym peaks and August slump'}
                </span>
              </div>
              <button type="button" className="text-toggle-btn">
                {showAnnualPl ? (fr ? 'Masquer ▲' : 'Hide ▲') : (fr ? 'Afficher les 12 mois ▼' : 'Show 12 Months ▼')}
              </button>
            </div>

            {showAnnualPl && (
              <div className="annual-table-wrap">
                <table className="annual-table">
                  <thead>
                    <tr>
                      <th>Mois</th>
                      <th>Séances</th>
                      <th>CA Brut</th>
                      <th>Loyer Basic-Fit</th>
                      <th>URSSAF (21.3%)</th>
                      <th>Net Réel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {annualPl.map(m => (
                      <tr key={m.monthIndex} className={m.seasonFactor > 1.2 ? 'peak-month' : ''}>
                        <td><strong>{m.monthName}</strong></td>
                        <td>{m.sessionsCount}</td>
                        <td>{m.grossRevenue}{'\u00A0'}€</td>
                        <td className="negative">−{m.gymRent}{'\u00A0'}€</td>
                        <td className="negative">−{m.urssafCharges}{'\u00A0'}€</td>
                        <td className="positive"><b>{m.netIncome}{'\u00A0'}€</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
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
