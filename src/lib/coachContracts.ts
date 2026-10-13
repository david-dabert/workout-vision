/**
 * French Legal Coaching Contract Generator
 * (Contrat de Prestation de Services de Coaching Sportif et Accompagnement Physique)
 *
 * Implements French legal standards:
 * - Code civil (Art. 1101 et suivants) : Droit des contrats et obligations
 * - Décret n° 2022-725 : Mention statutaire obligatoire "Entreprise Individuelle" (EI)
 * - Code du Sport (Art. L212-1 & L321-1) : Carte Pro DRAJES et Assurance RCP Pro obligatoire
 * - Code de la Consommation & Code de Commerce : Politique d'annulation 24h et pénalités de retard
 * - RGPD (Règlement UE 2016/679) : Confidentialité des données biomécaniques sur l'appareil
 *
 * 100% on-device processing.
 */

export interface CoachingContractData {
  contractNumber: string;
  issueDate: string; // YYYY-MM-DD
  coach: {
    name: string;
    legalName?: string;
    siret: string;
    address: string;
    cartePro: string;
    rcpPro: string;
    gymFacility?: string;
    phone?: string;
    email?: string;
  };
  client: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    emergencyContact?: string;
  };
  packageType: 'single_session' | 'carnet_10' | 'monthly_retainer' | 'biomech_pack';
  sessionsCount: number;
  totalPriceEur: number;
  validityMonths: number;
}

export interface GeneratedContract {
  contractNumber: string;
  issueDate: string;
  title: string;
  contractText: string;
  htmlContent: string;
  summaryClause: string;
}

export function generateCoachingContract(data: CoachingContractData): GeneratedContract {
  const coachLegalName = data.coach.legalName || (data.coach.name.startsWith('EI ') ? data.coach.name : `EI ${data.coach.name}`);
  const issueDate = data.issueDate || new Date().toISOString().slice(0, 10);
  const contractNumber = data.contractNumber || `CTR-${new Date().getFullYear()}-${Math.floor(Math.random() * 900) + 100}`;

  const packageLabels: Record<string, string> = {
    single_session: 'Séance de Coaching Individuel (1h)',
    carnet_10: 'Carnet de 10 Séances de Coaching Personnalisé',
    monthly_retainer: 'Abonnement Mensuel Suivi & Programmation Illimitée',
    biomech_pack: 'Pack Suivi & Bilan Biomécanique WorkoutVision™',
  };

  const packageLabel = packageLabels[data.packageType] || 'Prestation de Coaching Sportif';

  const contractText = `================================================================================
CONTRAT DE PRESTATION DE SERVICES DE COACHING SPORTIF ET ACCOMPAGNEMENT PHYSIQUE
N° ${contractNumber} — Fait le ${issueDate}
================================================================================

ENTRE LES SOUSSIGNÉS :

1. LE PRESTATAIRE :
${coachLegalName}, Éducateur Sportif Indépendant
Numéro SIRET : ${data.coach.siret}
Demeurant : ${data.coach.address || 'France'}
Titulaire de la Carte Professionnelle d'Éducateur Sportif n° : ${data.coach.cartePro}
Couvert par l'Assurance Responsabilité Civile Professionnelle : ${data.coach.rcpPro}
Lieu d'exercice habituel : ${data.coach.gymFacility || 'Basic-Fit'}
Ci-après dénommé « Le Coach »,

ET

2. LE CLIENT :
${data.client.name}
Adresse : ${data.client.address || 'Non communiquée'}
Email : ${data.client.email || 'Non communiqué'} | Téléphone : ${data.client.phone || 'Non communiqué'}
Ci-après dénommé « Le Client ».

IL A ÉTÉ CONVENU CE QUI SUIT :

ARTICLE 1 — OBJET DU CONTRAT
Le présent contrat a pour objet la fourniture de prestations personnalisées d'entraînement physique, d'analyse du mouvement et de conseil en condition physique, incluant l'utilisation de l'outil d'analyse biomécanique assisté par vision WorkoutVision™.
Prestation souscrite : ${packageLabel} (${data.sessionsCount} séance(s)).

ARTICLE 2 — STATUT JURIDIQUE ET MENTIONS LÉGALES
Le Coach exerce sous le statut d'Entreprise Individuelle (EI) déclarée. Conformément aux articles L212-1 et L321-1 du Code du Sport, il est titulaire des qualifications professionnelles requises délivrées par le Ministère des Sports et d'une assurance RCP en cours de validité.

ARTICLE 3 — CONDITIONS FINANCIÈRES
Le montant total convenu pour la prestation est fixé à ${data.totalPriceEur} € TTC (TVA non applicable, art. 293 B du CGI en micro-entreprise).
Le règlement s'effectue à la souscription par virement bancaire ou carte bancaire. Les séances souscrites ont une durée de validité de ${data.validityMonths || 6} mois à compter de la date de signature.

ARTICLE 4 — POLITIQUE D'ANNULATION ET REPORT (DÉLAI DE 24 HEURES)
Les créneaux horaires sont réservés d'un commun accord. Toute séance annulée ou modifiée par le Client moins de 24 heures à l'avance sera considérée comme due et automatiquement décomptée du carnet, sauf cas de force majeure justifié par écrit.

ARTICLE 5 — APTITUDE MÉDICALE ET DÉCHARGE
Le Client certifie avoir passé une visite médicale d'aptitude à la pratique d'activités physiques et sportives ou avoir rempli sans réserve le questionnaire de santé (QS-Sport). Le Client s'engage à informer sans délai le Coach de toute pathologie, douleur ou restriction articulaire survenant au cours du programme.

ARTICLE 6 — CONFIDENTIALITÉ ET PROTECTION DES DONNÉES (RGPD)
Les vidéos d'analyse du mouvement et données cinématiques traitées par l'application WorkoutVision™ sont analysées à 100 % en local sur l'appareil et ne sont cédées à aucun tiers.

ARTICLE 7 — DROIT APPLICABLE ET RÈGLEMENT DES LITIGES
Le présent contrat est régi par le droit français. En cas de litige, les parties s'engagent à rechercher prioritairement une solution amiable. À défaut, compétence est attribuée aux tribunaux compétents du ressort du domicile du Coach.

Fait en deux exemplaires originaux, le ${issueDate}.

Pour le Coach (${coachLegalName}) :                 Pour le Client (${data.client.name}) :
Signature :                                          Signature (précédée de « Lu et approuvé ») :
`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #111; max-width: 760px; margin: 0 auto; padding: 24px;">
      <div style="border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 0.05em;">Contrat de Prestation de Coaching Sportif</h2>
        <span style="font-size: 13px; color: #555;">N° ${contractNumber} — Date d'émission : ${issueDate}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 13px;">
        <div style="width: 48%;">
          <strong style="display: block; font-size: 14px; margin-bottom: 4px;">Le Coach :</strong>
          <div><b>${coachLegalName}</b></div>
          <div>SIRET : ${data.coach.siret}</div>
          <div>Carte Pro DRAJES : ${data.coach.cartePro}</div>
          <div>Assurance RCP : ${data.coach.rcpPro}</div>
          <div>Lieu d'exercice : ${data.coach.gymFacility || 'Basic-Fit'}</div>
        </div>
        <div style="width: 48%;">
          <strong style="display: block; font-size: 14px; margin-bottom: 4px;">Le Client :</strong>
          <div><b>${data.client.name}</b></div>
          <div>${data.client.email || 'Email non communiqué'}</div>
          <div>${data.client.phone || 'Téléphone non communiqué'}</div>
        </div>
      </div>
      <div style="background: #f8f8fa; border: 1px solid #e2e2e8; border-radius: 8px; padding: 14px; margin-bottom: 20px; font-size: 13px;">
        <strong>Prestation Souscrite :</strong> ${packageLabel} (${data.sessionsCount} séances)<br>
        <strong>Montant Total :</strong> <b style="font-size: 15px; color: #000;">${data.totalPriceEur} € TTC</b> (TVA non applicable, art. 293 B du CGI)<br>
        <strong>Délai d'Annulation :</strong> Minimum 24h avant la séance sous peine de décompte ferme.
      </div>
      <div style="font-size: 12px; color: #444; margin-bottom: 24px;">
        <p><b>Art. 4 — Politique 24h :</b> Toute séance annulée moins de 24 heures à l'avance est réputée due et décomptée.</p>
        <p><b>Art. 5 — Aptitude médicale :</b> Le Client atteste de l'absence de contre-indication médicale aux efforts prescrits.</p>
        <p><b>Art. 6 — RGPD & Vision :</b> Les données biomécaniques WorkoutVision™ demeurent sur cet appareil sans fuite cloud.</p>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px dashed #ccc; font-size: 13px;">
        <div>Signature du Coach :<br><br><br>___________________________</div>
        <div>Signature du Client (« Lu et approuvé ») :<br><br><br>___________________________</div>
      </div>
    </div>
  `;

  return {
    contractNumber,
    issueDate,
    title: `Contrat de Coaching Sportif — ${data.client.name}`,
    contractText,
    htmlContent,
    summaryClause: `Contrat ${packageLabel} (${data.totalPriceEur} €) souscrit pour ${data.client.name} avec politique d'annulation 24h et garantie RCP Pro.`,
  };
}
