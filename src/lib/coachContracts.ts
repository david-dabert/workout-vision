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
 * Second review (14 October 2026): each package in its own words, from the coach's own figures (see
 * CoachingContractData); "Signature" takes its no-break space.
 * French copy of the contract: awaiting David's approval (R10).
 */
import { eiName, euros, paperDate, siretText, localIsoDate, type CoachIdentity } from './accounting';

export type PackageType = 'single_session' | 'carnet' | 'monthly';

/**
 * What the coach typed. Each package reads its own fields (second review of 14 October 2026: every package other than
 * the pack printed "(1 séance)" and "à utiliser dans les 6 mois", false for a monthly follow-up and pointless for one
 * session): a single session, its price; a pack, its sessions, its price and the months to use them; a monthly
 * follow-up, its sessions a month, its months and its price a month.
 */
export interface CoachingContractData {
  issueDate?: string;
  coach: CoachIdentity;
  client: { name?: string; address?: string };
  packageType: PackageType;
  /** The pack's sessions. */
  sessionsCount?: number;
  /** The price of the single session or of the whole pack. */
  totalPrice?: number;
  /** The months in which the pack's sessions are used. */
  validityMonths?: number;
  /** The monthly follow-up: sessions a month, months, price of a month. */
  sessionsPerMonth?: number;
  months?: number;
  monthlyPrice?: number;
}

export type ContractMissing = 'coachName' | 'siret' | 'coachAddress' | 'cartePro' | 'mediator' | 'clientName'
  | 'totalPrice' | 'sessions' | 'validity' | 'sessionsPerMonth' | 'months' | 'monthlyPrice';

const text = (s?: string) => String(s || '').trim();
const whole = (v: unknown) => Number.isInteger(Number(v)) && Number(v) > 0;
const money = (v: unknown) => Number.isFinite(Number(v)) && Number(v) > 0;

/** What the contract still lacks, or []: no contract text is made before. */
export function contractMissing(data: CoachingContractData, siretOk: (s: string) => boolean): ContractMissing[] {
  const out: ContractMissing[] = [];
  if (!text(data.coach?.name)) out.push('coachName');
  if (!siretOk(text(data.coach?.siret))) out.push('siret');
  if (!text(data.coach?.address)) out.push('coachAddress');
  if (!text(data.coach?.cartePro)) out.push('cartePro');
  if (!text(data.coach?.mediator)) out.push('mediator');
  if (!text(data.client?.name)) out.push('clientName');
  if (data.packageType === 'monthly') {
    if (!whole(data.sessionsPerMonth)) out.push('sessionsPerMonth');
    if (!whole(data.months)) out.push('months');
    if (!money(data.monthlyPrice)) out.push('monthlyPrice');
    return out;
  }
  if (data.packageType === 'carnet' && !whole(data.sessionsCount)) out.push('sessions');
  if (!money(data.totalPrice)) out.push('totalPrice');
  if (data.packageType === 'carnet' && !whole(data.validityMonths)) out.push('validity');
  return out;
}

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

/** Article 1's object and article 3's price, in the package's own words. */
function packageTerms(data: CoachingContractData): { object: string; price: string[] } {
  const franchise = 'TVA non applicable, art. 293 B du CGI.';
  if (data.packageType === 'monthly') {
    const n = Number(data.sessionsPerMonth), m = Number(data.months), p = Number(data.monthlyPrice);
    return {
      object: `un suivi de ${n} ${plural(n, 'séance', 'séances')} d’entraînement personnalisé${n > 1 ? 'es' : 'e'} par mois, pendant ${m}\u00A0mois`,
      price: [
        `Le prix est de ${euros(p)} par mois, soit ${euros(p * m)} pour les ${m}\u00A0mois. ${franchise}`,
        'Le paiement se fait selon les factures remises au Client.',
        `Le suivi commence à la signature et prend fin au bout des ${m}\u00A0mois, sans reconduction tacite.`,
      ],
    };
  }
  if (data.packageType === 'carnet') {
    const n = Number(data.sessionsCount);
    return {
      object: `un carnet de ${n} ${plural(n, 'séance', 'séances')} d’entraînement personnalisé${n > 1 ? 'es' : 'e'}, en coaching individuel`,
      price: [
        `Le prix du carnet est de ${euros(Number(data.totalPrice))}. ${franchise}`,
        'Le paiement se fait selon la facture remise au Client.',
        `Les séances sont à utiliser dans les ${Number(data.validityMonths)}\u00A0mois qui suivent la signature.`,
      ],
    };
  }
  return {
    object: 'une séance d’entraînement personnalisée, en coaching individuel',
    price: [`Le prix de la séance est de ${euros(Number(data.totalPrice))}. ${franchise}`, 'Le paiement se fait selon la facture remise au Client.'],
  };
}

/** The contract's text, article by article. Call it only once contractMissing is empty. */
export function generateCoachingContract(data: CoachingContractData): { title: string; text: string; lines: string[] } {
  const issueDate = data.issueDate || localIsoDate();
  const legal = eiName(text(data.coach.name));
  const terms = packageTerms(data);
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
    `Le Coach fournit au Client ${terms.object}.`,
    '',
    'Article 2. Le Coach',
    `Le Coach exerce en entreprise individuelle et déclare être titulaire de la carte professionnelle d’éducateur sportif n° ${text(data.coach.cartePro)}.${insurance ? ` Il déclare être assuré en responsabilité civile professionnelle auprès de\u00A0: ${insurance}.` : ''}`,
    '',
    'Article 3. Prix et paiement',
    terms.price.join(' '),
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
    'Signature\u00A0:',
    '',
    `Le Client (${text(data.client.name)}), signature précédée de «\u00A0Lu et approuvé\u00A0»\u00A0:`,
  ];
  return { title: `Contrat de coaching\u00A0: ${text(data.client.name)}`, text: lines.join('\n'), lines };
}
