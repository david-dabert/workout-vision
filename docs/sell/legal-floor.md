# The legal floor before the first euro (card 062)

Draft of 19 November 2026 by Claude.
Not legal advice.
No line here is used, shown or signed before a lawyer has read it (card 062; PLAN.md, standing order of 18 November 2026: legal signatures stay with David).

## How far the sources were checked

Légifrance (legifrance.gouv.fr) and EUR-Lex (eur-lex.europa.eu) are refused by the network policy of the session that wrote this draft.
Every source below was therefore read only through secondary commentary (law firms, legal press), linked in its row.
Each row carries "Checked at the official text: no".
The card's rule holds: each source is checked at its official text before the draft is used.
Whoever checks one changes "no" to the date and the Légifrance or EUR-Lex link.

## Two questions for the lawyer before anything else

1. **Who sells.**
If the subscription is sold through Apple's App Store, Apple is the seller of record towards the buyer, and cancellation and refunds go through Apple's own interface.
Items 3 to 5 below would then bind Apple, not the entity, for those sales; they still bind the entity for any sale on its own website.
PLAN.md (amendment of 15 November 2026) names both an App Store version and a web subscription; the choice is not made.
Apple's terms on this point were not checked in this session.
2. **Content or service.**
The waiver of item 5 (L221-28, 13°) covers digital content not supplied on a tangible medium.
A subscription to an app that analyses the buyer's videos may instead be a digital service, for which the rules differ (L221-25: a service begun at the buyer's express request during the 14 days is paid pro rata if the buyer withdraws; L221-28, 1°: no withdrawal once the service is fully performed).
The card names 13°; that choice is the lawyer's, and the draft of item 5 gives both forms.

## The obligations

| # | Obligation | Source (secondary only) | Checked at the official text | Where in the app |
|---|---|---|---|---|
| 1 | Identify the publisher, its director of publication and its host | Loi n° 2004-575 du 21 juin 2004 (LCEN), art. 1-1, I, since loi n° 2024-449 du 21 mai 2024 (SREN), which moved it from art. 6, III; penalty art. 1-2 ([Simonnet Avocat](https://www.simonnetavocat.fr/mentions-legales-dun-site-internet-obligations-sanctions-et-modele/)) | no | « Mentions légales », one tap from every page footer and from Profil |
| 2 | Pre-contractual information and terms of sale | Code de la consommation, L111-1 and L221-5 (not searched in this session) | no | « Conditions générales de vente », linked on the payment screen before the buyer pays |
| 3 | Cancel the subscription online through a feature labelled « Résilier votre contrat » | L215-1-1 (loi n° 2022-1158 du 16 août 2022); D215-1 to D215-3 (décret n° 2023-417 du 31 mai 2023); fine L241-3-1 ([Seban Avocats](https://www.seban-associes.avocat.fr/la-resiliation-des-contrats-conclus-par-voie-electronique-en-trois-clics/?idLAJ=116581), [INC](https://www.inc-conso.fr/content/vous-pouvez-resilier-votre-contrat-dabonnement-en-quelques-clics)) | no | Profil, « Mon abonnement », visible without searching |
| 4 | A withdrawal feature during the 14 days, then a timestamped acknowledgment on a durable medium | Directive (UE) 2023/2673, applied from 19 June 2026; France: ordonnance n° 2026-2 du 5 janvier 2026 (L221-21) and décret n° 2026-3 du 5 janvier 2026 (D221-5) ([Bird & Bird](https://www.twobirds.com/fr/insights/2026/france/nouvelles-obligations-applicables-au-droit-de-r%C3%A9tractation), [Racine](https://www.racine.eu/entree-en-vigueur-des-nouvelles-regles-relatives-au-droit-de-retractation-pour-les-contrats-conclus-a-distance/), [Cadra](https://cadra.fr/contrats-conclus-avec-les-consommateurs-pensez-a-prevoir-la-possibilite-dune-retractation-en-ligne/)) | no | Profil, « Mon abonnement », shown during the 14 days only, and named in the terms of sale |
| 5 | Immediate access: the buyer's express prior consent and acknowledgment, confirmed on a durable medium | Content: L221-28, 13°, with L221-13, second paragraph, as amended by ordonnance n° 2021-1734 du 22 décembre 2021 (in force 28 May 2022). Service: L221-25 and L221-28, 1° ([INC, table of the Omnibus changes](https://inc-conso.fr/sites/default/files/pdf/tableau-omnibus-inc-2022_0.pdf), [french-business-law.com](https://french-business-law.com/french-legislation-art/article-l221-28-of-the-french-consumer-code)) | no | Payment screen, a box not ticked in advance, above the pay button; the confirmation e-mail |
| 6 | Name the consumer mediator the entity has joined | L612-1 and L616-1 (not searched in this session) | no | Terms of sale and « Mentions légales » |
| 7 | No claim the app cannot prove | L121-2 (misleading commercial practices); in the repository, R8 and R13 | no | Every paid screen, the store listing and the site: figures only from the latest scoreboard, with its date |
| 8 | Information on personal data | Règlement (UE) 2016/679, art. 13; the app's own audit grid, `docs/privacy/cnil-audience-grid.md` | no | « Confidentialité », linked beside the terms of sale |

## The draft texts

Blanks in square brackets are facts only David can give (card 062, "Needs from David").
French in the register of the app: « vous ».

### 1. Mentions légales

> **Mentions légales**
> Éditeur : [dénomination sociale], [forme juridique] au capital de [montant] €, immatriculée au RCS de [ville] sous le numéro [SIREN], dont le siège est situé [adresse].
> SIRET : [SIRET]. TVA intracommunautaire : [numéro].
> Contact : [adresse e-mail], [téléphone].
> Directeur de la publication : [nom et prénom].
> Hébergeur : [nom de l'hébergeur], [adresse], [téléphone].

The host of the current site is GitHub Pages; the host of the paid version is not chosen, so its name stays a blank.

### 2. Conditions générales de vente (outline only)

The lawyer writes the body.
The outline the obligations above require:
1. Identité du vendeur (renvoi aux mentions légales).
2. Description du service : ce que l'application mesure, et ce qu'elle ne mesure pas (renvoi à la page de précision publique, R13).
3. Prix toutes taxes comprises, durée, renouvellement, moyens de paiement.
4. Accès immédiat et droit de rétractation (texte 5).
5. Rétractation en ligne (texte 4).
6. Résiliation en ligne (texte 3).
7. Garantie légale de conformité des contenus et services numériques.
8. Données personnelles (renvoi à « Confidentialité »).
9. Médiation de la consommation : [nom du médiateur], [adresse du site du médiateur].
10. Droit applicable.

### 3. Résiliation

Button, on « Mon abonnement »:

> **Résilier votre contrat**

Then one page with what the buyer must give (identity, the contract), then a summary page whose button reads:

> **Confirmer la résiliation**

Acknowledgment, on screen and by e-mail:

> Votre résiliation a bien été enregistrée le [date] à [heure].
> Votre abonnement reste actif jusqu'au [date de fin de période].

The exact labels and steps follow D215-1 to D215-3 once checked; the commentary above gives « résilier votre contrat » as the required wording.

### 4. Rétractation

Shown on « Mon abonnement » during the 14 days after the purchase:

> **Renoncer au contrat ici**

Then one page with the buyer's identity and the contract, and a button:

> **Confirmer la rétractation**

Acknowledgment, on screen and by e-mail:

> Votre rétractation a bien été reçue le [date] à [heure].
> Le remboursement de [montant] € sera effectué dans un délai de 14 jours.

The two labels come from Racine, Cadra and Bird & Bird, not from D221-5 itself.

### 5. Accès immédiat

Form A, if the lawyer reads the subscription as digital content (L221-28, 13°):

> ☐ Je demande l'accès immédiat à l'abonnement et je reconnais perdre mon droit de rétractation dès que cet accès commence.

Form B, if the lawyer reads it as a digital service (L221-25):

> ☐ Je demande que le service commence avant la fin du délai de rétractation de 14 jours. Si je me rétracte, je paierai la part du service déjà fournie.

Either way the box is not ticked in advance, payment is impossible until it is ticked, and the confirmation e-mail repeats the sentence the buyer ticked (L221-13, second paragraph, as the commentary describes it).

### 6. to 8.

The mediator's name is a blank until the entity joins one.
Item 7 needs no new text: R8 and R13 already bind every screen.
Item 8 is written from `docs/privacy/cnil-audience-grid.md` once the entity exists.

## What David gives

- The legal entity: name, form, capital, address, SIREN, SIRET, VAT number, contact.
- The director of publication.
- The host of the paid version.
- The consumer mediator the entity joins.
- The sales channel: App Store, the entity's website, or both (question 1).
- A lawyer, who answers questions 1 and 2 and checks every row at its official text.
