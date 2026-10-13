import { useState, useEffect, useMemo } from 'react';
import { useT } from '../../lib/LanguageContext';
import {
  getAllClients,
  saveClient,
  deleteClient,
  getClientWorkouts,
} from '../../lib/coachStorage';
import {
  calculateCoachAccounting,
  generateFrenchInvoice,
} from '../../lib/accounting';
import {
  getDailyTargets,
  calculateAdherenceScore,
} from '../../lib/nutrition';
import {
  PHYSIO_CATALOG,
  PHYSIO_REGIONS,
} from '../../lib/physioCatalog';
import { hapticLight, hapticTap } from '../../lib/haptics';
import './CoachSuite.css';

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

  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  // ─── 2. Accounting State ───
  const [monthlyRent, setMonthlyRent] = useState(650);
  const [regime, setRegime] = useState('micro'); // 'micro' | 'reel'
  const [sessionPrice, setSessionPrice] = useState(50);
  const [sessionsCount, setSessionsCount] = useState(40);
  const [coachSiret, setCoachSiret] = useState('');
  const [coachName, setCoachName] = useState('Coach Thomas');
  const [copiedInvoice, setCopiedInvoice] = useState(false);

  const accounting = useMemo(() => {
    return calculateCoachAccounting({
      monthlyRent,
      regime,
      averageSessionPrice: sessionPrice,
      monthlySessionsCount: sessionsCount,
    });
  }, [monthlyRent, regime, sessionPrice, sessionsCount]);

  // Invoice builder
  const [invoiceType, setInvoiceType] = useState('coaching_pack'); // coaching_session | coaching_pack | biomech_assessment
  const generatedInvoice = useMemo(() => {
    const items = [];
    if (invoiceType === 'coaching_session') {
      items.push({ description: fr ? 'Séance de Coaching Sportif Individuel (1h)' : 'Individual Personal Training Session (1h)', quantity: 1, unitPriceHt: sessionPrice });
    } else if (invoiceType === 'coaching_pack') {
      items.push({ description: fr ? 'Forfait 10 Séances de Coaching Personnalisé' : '10-Session Personal Training Pack', quantity: 1, unitPriceHt: sessionPrice * 10 });
    } else {
      items.push({ description: fr ? 'Bilan Postural & Analyse Biomécanique WorkoutVision' : 'WorkoutVision Biomechanical & Postural Assessment', quantity: 1, unitPriceHt: 60 });
    }

    return generateFrenchInvoice({
      invoiceNumber: `F-${new Date().getFullYear()}-00${Math.floor(Math.random() * 90) + 10}`,
      coach: {
        name: coachName,
        siret: coachSiret || '842 918 203 00018',
        address: 'France',
        gymFacility: 'Basic-Fit',
      },
      client: {
        name: selectedClient ? selectedClient.name : 'Client Particulier',
      },
      regime,
      items,
    });
  }, [invoiceType, sessionPrice, coachName, coachSiret, selectedClient, regime, fr]);

  const handleCopyInvoice = () => {
    hapticLight();
    const text = `=== FACTURE N° ${generatedInvoice.invoiceNumber} ===\n` +
      `Date d'émission\u00A0: ${generatedInvoice.issueDate}\n` +
      `Émetteur\u00A0: ${generatedInvoice.coach.name} (SIRET\u00A0: ${generatedInvoice.coach.siret})\n` +
      `Lieu d'exercice\u00A0: ${generatedInvoice.coach.gymFacility}\n` +
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

  // ─── 3. Nutrition State ───
  const [nutritionGoal, setNutritionGoal] = useState('cut'); // 'cut' | 'maintain' | 'bulk'
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
          <span>👥 {fr ? 'Clients & Suivi' : 'Clients & Records'}</span>
        </button>
        <button
          type="button"
          className={`suite-tab-btn ${activeSubTab === 'accounting' ? 'active' : ''}`}
          onClick={() => { hapticLight(); setActiveSubTab('accounting'); }}
          data-testid="tab-accounting"
        >
          <span>💶 {fr ? 'Comptabilité (Basic-Fit)' : 'Accounting & Invoicing'}</span>
        </button>
        <button
          type="button"
          className={`suite-tab-btn ${activeSubTab === 'nutrition' ? 'active' : ''}`}
          onClick={() => { hapticLight(); setActiveSubTab('nutrition'); }}
          data-testid="tab-nutrition"
        >
          <span>🥗 {fr ? 'Nutrition & Cibles' : 'Nutrition & Macros'}</span>
        </button>
        <button
          type="button"
          className={`suite-tab-btn ${activeSubTab === 'physio' ? 'active' : ''}`}
          onClick={() => { hapticLight(); setActiveSubTab('physio'); }}
          data-testid="tab-physio"
        >
          <span>🩺 {fr ? 'Kiné par Zone' : 'Physio by Joint'}</span>
        </button>
      </div>

      {/* ─── TAB 1: CLIENTS & SUIVI ─── */}
      {activeSubTab === 'clients' && (
        <div className="suite-content-section" data-testid="section-clients">
          <div className="section-header-row">
            <div>
              <h3>{fr ? 'Gestion Multi-Clients' : 'Multi-Client Management'}</h3>
              <p className="section-subtext">
                {fr
                  ? 'Historique isolé, notes d’entraînement et télémétrie biomécanique chiffrée sur cet appareil.'
                  : 'Isolated workout history, coach notes, and on-device biomechanical telemetry.'}
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
                <button type="button" className="text-close-btn" onClick={() => setIsAddingClient(false)}>✕</button>
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
                    onClick={() => { hapticLight(); setSelectedClientId(cl.id); }}
                    data-testid={`client-${cl.id}`}
                  >
                    <div className="client-initials">
                      {cl.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div className="client-card-info">
                      <span className="client-card-name">{cl.name}</span>
                      <span className="client-card-sub">
                        {cl.weight ? `${cl.weight} kg` : ''} • {clientWorkoutCounts[cl.id] || 0} {fr ? 'séances' : 'sessions'}
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
                        {selectedClient.weight ? ` • ${selectedClient.weight} kg` : ''}
                        {selectedClient.height ? ` • ${selectedClient.height} cm` : ''}
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
                      🥗 {fr ? 'Calculer les Macros' : 'Macro Targets'}
                    </button>
                    <button
                      type="button"
                      className="quick-suite-btn press"
                      onClick={() => {
                        hapticLight();
                        setActiveSubTab('accounting');
                      }}
                    >
                      💶 {fr ? 'Générer une Facture' : 'Create Invoice'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: COMPTABILITÉ & LOYER BASIC-FIT ─── */}
      {activeSubTab === 'accounting' && (
        <div className="suite-content-section" data-testid="section-accounting">
          <div className="section-header-row">
            <div>
              <h3>{fr ? 'Comptabilité Coach & Loyer Salle' : 'Coach Freelance Accounting & Rent Simulator'}</h3>
              <p className="section-subtext">
                {fr
                  ? 'Gestion de la redevance Basic-Fit (650 €/mois), cotisations URSSAF et générateur de factures légales conformes.'
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

          {/* Interactive Accounting Tuner */}
          <div className="accounting-tuners-card">
            <div className="tuner-row">
              <div className="tuner-item">
                <div className="tuner-label">
                  <span>{fr ? 'Loyer Mensuel Basic-Fit (Redevance)' : 'Monthly Gym Rent'}</span>
                  <b>{monthlyRent} €</b>
                </div>
                <input
                  type="range"
                  min="300"
                  max="1200"
                  step="50"
                  value={monthlyRent}
                  onChange={e => setMonthlyRent(Number(e.target.value))}
                />
              </div>

              <div className="tuner-item">
                <div className="tuner-label">
                  <span>{fr ? 'Tarif par Séance (Prix Moyen)' : 'Average Session Price'}</span>
                  <b>{sessionPrice} €</b>
                </div>
                <input
                  type="range"
                  min="30"
                  max="120"
                  step="5"
                  value={sessionPrice}
                  onChange={e => setSessionPrice(Number(e.target.value))}
                />
              </div>

              <div className="tuner-item">
                <div className="tuner-label">
                  <span>{fr ? 'Nombre de Séances / Mois' : 'Monthly Sessions Conducted'}</span>
                  <b>{sessionsCount}</b>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={sessionsCount}
                  onChange={e => setSessionsCount(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Financial Breakdown HUD */}
          <div className="financial-hud-grid">
            <div className="hud-card">
              <span className="hud-label">{fr ? 'Chiffre d’Affaires Brut' : 'Gross Revenue'}</span>
              <span className="hud-num">{accounting.grossRevenueHt} €</span>
              <span className="hud-sub">{sessionsCount} séances × {sessionPrice} €</span>
            </div>

            <div className="hud-card rent-card">
              <span className="hud-label">{fr ? 'Loyer Salle Déduit' : 'Facility Rent Paid'}</span>
              <span className="hud-num negative">- {accounting.gymRent} €</span>
              <span className="hud-sub">{fr ? 'Redevance contractuelle' : 'Contractual gym lease'}</span>
            </div>

            <div className="hud-card">
              <span className="hud-label">{fr ? 'Cotisations Sociales (URSSAF)' : 'Social Contributions'}</span>
              <span className="hud-num negative">- {accounting.socialContributions} €</span>
              <span className="hud-sub">{regime === 'micro' ? '21.3 % du CA brut' : '40 % du bénéfice'}</span>
            </div>

            <div className="hud-card take-home-card">
              <span className="hud-label">{fr ? 'Reste à Vivre Net Réel' : 'Net Take-Home Pay'}</span>
              <span className="hud-num positive">{accounting.netTakeHomePay} €</span>
              <span className="hud-sub">{fr ? 'Après loyer, URSSAF & impôt' : 'After rent, tax & charges'}</span>
            </div>
          </div>

          {/* Break-Even Insight Banner */}
          <div className="break-even-banner">
            <span className="be-icon">💡</span>
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
                <h4>{fr ? 'Générateur de Factures Légales (Art. L441-9 Code de Commerce)' : 'Compliant French Legal Invoice Generator'}</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(232, 230, 225, 0.6)' }}>
                  {fr
                    ? 'Conforme aux exigences fiscales françaises (numéro séquentiel, mentions pénalités et art. 293 B CGI).'
                    : 'Legally compliant with French tax and commercial code.'}
                </p>
              </div>
              <button
                type="button"
                className="copy-invoice-btn press"
                onClick={handleCopyInvoice}
                data-testid="btn-copy-invoice"
              >
                {copiedInvoice ? (fr ? '✓ Facture Copiée' : '✓ Copied') : (fr ? 'Copier la Facture' : 'Copy Text')}
              </button>
            </div>

            <div className="invoice-controls-row">
              <div className="invoice-field">
                <label>{fr ? 'Type de Prestation' : 'Service Item'}</label>
                <select value={invoiceType} onChange={e => setInvoiceType(e.target.value)}>
                  <option value="coaching_session">{fr ? 'Séance individuelle (1h)' : 'Single Session (1h)'}</option>
                  <option value="coaching_pack">{fr ? 'Pack 10 séances' : '10-Session Pack'}</option>
                  <option value="biomech_assessment">{fr ? 'Bilan biomécanique WorkoutVision' : 'Biomechanical Assessment'}</option>
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
            </div>

            {/* Rendered Invoice Paper Preview */}
            <div className="invoice-preview-sheet">
              <div className="inv-top">
                <span className="inv-num">FACTURE N° {generatedInvoice.invoiceNumber}</span>
                <span className="inv-date">Date{fr ? '\u00A0:' : ':'} {generatedInvoice.issueDate}</span>
              </div>
              <div className="inv-parties">
                <div>
                  <strong>{generatedInvoice.coach.name}</strong>
                  <span>SIRET{fr ? '\u00A0:' : ':'} {generatedInvoice.coach.siret}</span>
                  <span>{fr ? 'Lieu\u00A0:' : 'Facility:'} {generatedInvoice.coach.gymFacility}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong>{fr ? 'Client\u00A0:' : 'Client:'} {generatedInvoice.client.name}</strong>
                  <span>{fr ? 'Mode de règlement\u00A0: Virement / CB' : 'Payment: Bank Transfer / Card'}</span>
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
                      <td>{it.unitPriceHt} €</td>
                      <td>{it.quantity * it.unitPriceHt} €</td>
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
                  <span>Total HT{fr ? '\u00A0:' : ':'} {generatedInvoice.totalHt} €</span>
                  {generatedInvoice.tvaRate > 0 && <span>TVA 20%{fr ? '\u00A0:' : ':'} {generatedInvoice.totalTva} €</span>}
                  <b className="total-ttc">TOTAL TTC{fr ? '\u00A0:' : ':'} {generatedInvoice.totalTtc} €</b>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: NUTRITION & CIBLES CLIENT ─── */}
      {activeSubTab === 'nutrition' && (
        <div className="suite-content-section" data-testid="section-nutrition">
          <div className="section-header-row">
            <div>
              <h3>{fr ? 'Nutrition & Cibles Macronutriments' : 'Client Nutrition Targets & Adherence'}</h3>
              <p className="section-subtext">
                {fr
                  ? 'Directives métaboliques selon les recommandations scientifiques (Schoenfeld, Morton 1.6-2.2 g/kg).'
                  : 'Evidence-based metabolic guidance and macro targets for personal training clients.'}
              </p>
            </div>
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
          </div>

          {clientTargets ? (
            <div className="nutrition-cards-layout">
              <div className="client-target-summary">
                <span className="summary-client-name">
                  {fr ? 'Cibles pour\u00A0: ' : 'Targets for: '}
                  <b>{selectedClient ? selectedClient.name : 'Client'}</b> ({selectedClient?.weight || 75} kg)
                </span>
                <div className="target-macros-grid">
                  <div className="macro-card cal-card">
                    <span className="macro-val">{clientTargets.calories}</span>
                    <span className="macro-unit">kcal / jour</span>
                    <span className="macro-name">{fr ? 'Énergie Totale' : 'Total Energy'}</span>
                  </div>
                  <div className="macro-card protein-card">
                    <span className="macro-val">{clientTargets.protein} g</span>
                    <span className="macro-unit">
                      {(clientTargets.protein / parseFloat(selectedClient?.weight || '75')).toFixed(1)} g/kg
                    </span>
                    <span className="macro-name">{fr ? 'Protéines' : 'Protein'}</span>
                  </div>
                  <div className="macro-card carbs-card">
                    <span className="macro-val">{clientTargets.carbs} g</span>
                    <span className="macro-unit">{Math.round((clientTargets.carbs * 4 / clientTargets.calories) * 100)}% cal</span>
                    <span className="macro-name">{fr ? 'Glucides' : 'Carbs'}</span>
                  </div>
                  <div className="macro-card fat-card">
                    <span className="macro-val">{clientTargets.fat} g</span>
                    <span className="macro-unit">{Math.round((clientTargets.fat * 9 / clientTargets.calories) * 100)}% cal</span>
                    <span className="macro-name">{fr ? 'Lipides' : 'Fats'}</span>
                  </div>
                </div>
              </div>

              {/* Compliance / Observance Rating Card */}
              <div className="adherence-card">
                <div className="adherence-header">
                  <b>{fr ? 'Observance Nutritionnelle Client (7 derniers jours)' : 'Weekly Client Compliance'}</b>
                  <span className="adherence-score-pill">{sampleAdherence.complianceRatePct}%</span>
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
                    📹 {item.cameraView === 'side' ? (fr ? 'Vue Profil' : 'Side View') : (fr ? 'Vue Face' : 'Front View')}
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
