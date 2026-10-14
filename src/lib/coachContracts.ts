/**
 * A model of coaching contract (CoachSuite.jsx, Contrat), for a coach in micro-entreprise under the VAT franchise and
 * a client who is a consumer. A model to have read by a lawyer before use: the screen says so, and claims no
 * conformity (honesty pass of 14 October 2026, wave 2B, CTR-1).
 *
 * Changed from the first version: no identity default; nothing asserted for the coach that the app cannot know (the
 * qualifications are the carte pro number the coach typed, the insurance only when typed); the VAT line is the
 * franchise's, the only regime the office handles; no clause giving jurisdiction to the coach's courts (art. 48 CPC
 * keeps such clauses to traders; literature, text not opened by us); a consumer mediator line (C. consom. L612-1 and
 * L616-1; literature, texts not opened by us); one article 5, the same everywhere; article 6 promises what the coach
 * does with the client's data, nothing about the app; no em dash, no trademark sign. The 14-day withdrawal (C. consom.
 * L221-18) is left to the lawyer's reading: whether it applies depends on where the contract is signed.
 * French copy of the contract: awaiting David's approval (R10).
 */
import { eiName, euros, paperDate, siretText, localIsoDate, type CoachIdentity } from './accounting';

export type PackageType = 'single_session' | 'carnet' | 'monthly';

export interface CoachingContractData {
  issueDate?: string;
  coach: CoachIdentity;
  client: { name?: string; address?: string };
  packageType: PackageType;
  sessionsCount: number;
  totalPrice: number;
  validityMonths: number;
}

export type ContractMissing = 'coachName' | 'siret' | 'coachAddress' | 'cartePro' | 'mediator' | 'clientName' | 'totalPrice' | 'sessions' | 'validity';

const text = (s?: string) => String(s || '').trim();

/** What the contract still lacks, or []: no contract text is made before. */
export function contractMissing(data: CoachingContractData, siretOk: (s: string) => boolean): ContractMissing[] {
  const out: ContractMissing[] = [];
  if (!text(data.coach?.name)) out.push('coachName');
  if (!siretOk(text(data.coach?.siret))) out.push('siret');
  if (!text(data.coach?.address)) out.push('coachAddress');
  if (!text(data.coach?.cartePro)) out.push('cartePro');
  if (!text(data.coach?.mediator)) out.push('mediator');
  if (!text(data.client?.name)) out.push('clientName');
  if (!(Number(data.totalPrice) > 0)) out.push('totalPrice');
  if (!(Number.isInteger(Number(data.sessionsCount)) && Number(data.sessionsCount) > 0)) out.push('sessions');
  if (!(Number.isInteger(Number(data.validityMonths)) && Number(data.validityMonths) > 0)) out.push('validity');
  return out;
}

const PACKAGE_LABEL: Record<PackageType, (n: number) => string> = {
  single_session: () => 'Séance de coaching individuel',
  carnet: n => `Carnet de ${n} séances de coaching individuel`,
  monthly: () => 'Suivi mensuel',
};

/** The contract's text, article by article. Call it only once contractMissing is empty. */
export function generateCoachingContract(data: CoachingContractData): { title: string; text: string; lines: string[] } {
  const issueDate = data.issueDate || localIsoDate();
  const legal = eiName(text(data.coach.name));
  const n = Number(data.sessionsCount);
  const what = `${PACKAGE_LABEL[data.packageType]?.(n) ?? 'Coaching sportif'} (${n} ${n > 1 ? 'séances' : 'séance'})`;
  const insurance = text(data.coach.rcpPro);
  const gym = text(data.coach.gym);
  const lines = [
    'CONTRAT DE PRESTATION DE COACHING SPORTIF',
    `Établi le ${paperDate(issueDate)}`,
    '',
    'ENTRE',
    `${legal}, éducateur sportif, entrepreneur individuel`,
    `SIRET\u00A0: ${siretText(text(data.coach.siret))}`,
    text(data.coach.address),
    `Carte professionnelle d’éducateur sportif n° ${text(data.coach.cartePro)}`,
    ...(insurance ? [`Assurance responsabilité civile professionnelle\u00A0: ${insurance}`] : []),
    ...(gym ? [`Lieu d’exercice\u00A0: ${gym}`] : []),
    'ci-après «\u00A0le Coach\u00A0»,',
    '',
    'ET',
    text(data.client.name),
    ...(text(data.client.address) ? [text(data.client.address)] : []),
    'ci-après «\u00A0le Client\u00A0».',
    '',
    'Article 1. Objet',
    `Le Coach fournit au Client des séances d’entraînement personnalisées\u00A0: ${what}.`,
    '',
    'Article 2. Le Coach',
    `Le Coach exerce en entreprise individuelle et déclare être titulaire de la carte professionnelle d’éducateur sportif n° ${text(data.coach.cartePro)}.${insurance ? ` Il déclare être assuré en responsabilité civile professionnelle auprès de\u00A0: ${insurance}.` : ''}`,
    '',
    'Article 3. Prix et paiement',
    `Le prix total est de ${euros(Number(data.totalPrice))}. TVA non applicable, art. 293 B du CGI. Le paiement se fait selon la facture remise au Client. Les séances sont à utiliser dans les ${Number(data.validityMonths)} mois qui suivent la signature.`,
    '',
    'Article 4. Annulation',
    'Une séance annulée par le Client moins de 24 heures à l’avance est due, sauf cas de force majeure.',
    '',
    'Article 5. Santé',
    'Le Client déclare ne connaître aucune contre-indication médicale à la pratique proposée. Il informe le Coach sans délai de toute douleur, pathologie ou restriction.',
    '',
    'Article 6. Données personnelles',
    'Les informations de santé et les vidéos que le Client confie au Coach servent uniquement à son suivi. Le Coach ne les cède à personne.',
    '',
    'Article 7. Litiges',
    `Le contrat est régi par le droit français. En cas de litige, les parties cherchent d’abord une solution amiable. Le Client peut recourir gratuitement au médiateur de la consommation\u00A0: ${text(data.coach.mediator)}.`,
    '',
    'Fait en deux exemplaires.',
    '',
    `Le Coach (${legal})`,
    'Signature :',
    '',
    `Le Client (${text(data.client.name)}), signature précédée de «\u00A0Lu et approuvé\u00A0»\u00A0:`,
  ];
  return { title: `Contrat de coaching\u00A0: ${text(data.client.name)}`, text: lines.join('\n'), lines };
}
