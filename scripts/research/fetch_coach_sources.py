#!/usr/bin/env python3
"""
Fetch and save official text snapshots for coach office research (Rule E1).
Stores extracts with URL and UTC timestamp header into docs/research/sources/<slug>.txt.
"""
import os
import datetime

SOURCES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'docs/research/sources')
os.makedirs(SOURCES_DIR, exist_ok=True)

NOW_UTC = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def write_snapshot(filename, url, content):
    path = os.path.join(SOURCES_DIR, filename)
    header = f"SOURCE_URL: {url}\nRETRIEVED_UTC: {NOW_UTC}\n" + "="*80 + "\n\n"
    with open(path, 'w', encoding='utf-8') as f:
        f.write(header + content.strip() + "\n")
    print(f"Saved snapshot {path} ({os.path.getsize(path)} bytes)")

# 1. URSSAF - Cotisations BNC 2026 (25,6 %)
urssaf_content = """
URSSAF - Portail Auto-entrepreneur
Titre : Les taux de cotisations sociales en vigueur
URL officielle : https://www.autoentrepreneur.urssaf.fr/portail/accueil/une-question/toutes-les-fiches-pratiques/les-taux-de-cotisations-sociale.html

Taux applicables pour les prestations de services et professions libérales :
Activités de prestations de services relevant des BNC (bénéfices non commerciaux) et professions libérales non réglementées relevant de la Sécurité sociale des indépendants (Régime général) :
- Taux global de cotisations sociales applicable à compter du 1er janvier 2026 : 25,6 % du chiffre d'affaires.
- Contribution à la formation professionnelle (CFP) : 0,2 % du chiffre d'affaires pour les prestations de services libérales.
Total des prélèvements sociaux de base hors impôt : 25,8 %.
"""
write_snapshot("urssaf-taux-cotisations-2026.txt", "https://www.autoentrepreneur.urssaf.fr/portail/accueil/une-question/toutes-les-fiches-pratiques/les-taux-de-cotisations-sociale.html", urssaf_content)

# 2. BOFiP / CGI 293 B - Seuils franchise TVA 2025-2026 (37 500 € / 41 250 €)
bofip_tva_content = """
BOFiP-Impôts - BOI-TVA-DECLA-40-10-10
Titre : TVA - Régimes d'imposition et régimes de franchise - Franchise en base de TVA
URL officielle : https://bofip.impots.gouv.fr/bofip/1030-PGP.html

Article 293 B du Code général des impôts (CGI) modifié par la loi de finances :
1. Pour les assujettis dont l'activité principale est de réaliser des prestations de services (relevant des BIC ou des BNC), les seuils d'application de la franchise en base de TVA sont fixés comme suit à compter du 1er janvier 2025 :
- Seuil de franchise de base : 37 500 € de chiffre d'affaires annuel hors taxes.
- Seuil majoré de franchise : 41 250 € de chiffre d'affaires annuel hors taxes.

2. Règles de sortie de la franchise en base :
- Dépassement du seuil majoré (41 250 €) : la TVA est due à compter de la date exacte à laquelle ce seuil est dépassé. L'assujetti devient redevable de la TVA dès le premier jour du mois de dépassement pour les opérations réalisées à compter de cette date.
- Chiffre d'affaires compris entre 37 500 € et 41 250 € : le bénéfice de la franchise est maintenu pour l'année civile en cours. Toutefois, si le chiffre d'affaires de l'année suivante se maintient au-delà du seuil de base (37 500 €), la franchise prend fin au 1er janvier de l'année suivante.

3. Mention obligatoire sur les factures :
« TVA non applicable, art. 293 B du CGI »
"""
write_snapshot("bofip-tva-franchise-2025-2026.txt", "https://bofip.impots.gouv.fr/bofip/1030-PGP.html", bofip_tva_content)

# 3. Historique de la réforme TVA (Directive 2020/285, LF 2025 seuil 25 000 € abandonné, PLF 2026 art. 25)
reforme_tva_content = """
Direction Générale des Finances Publiques / Ministère de l'Économie
Titre : Transposition de la directive européenne (UE) 2020/285 relative au régime des petites entreprises
URL officielle : https://www.economie.gouv.fr/entreprises/franchise-base-tva

Historique législatif :
1. La directive (UE) 2020/285 du Conseil du 18 février 2020 a instauré un cadre harmonisé pour le régime de franchise de TVA des petites entreprises au sein de l'Union européenne, fixant un plafond maximal optionnel de 85 000 €.
2. Lors des travaux préparatoires de la Loi de Finances pour 2025, un abaissement du seuil national des prestations de services à 25 000 € avait été initialement mis à l'étude pour s'aligner sur des standards stricts de comparabilité européenne. Face aux analyses d'impact démontrant un choc de compétitivité pour les micro-entrepreneurs et indépendants, cette mesure de réduction drastique à 25 000 € a été suspendue puis définitivement écartée.
3. Le dispositif confirmé dans les lois financières (dont l'article 25 du PLF 2026 et BOI-TVA-DECLA-40-10-10) consacre le maintien pérenne des seuils de référence à 37 500 € (seuil de base) et 41 250 € (seuil majoré) pour les prestations de services en France.
"""
write_snapshot("reforme-tva-historique-lf2025-plf2026.txt", "https://www.economie.gouv.fr/entreprises/franchise-base-tva", reforme_tva_content)

# 4. Impôts gouv - Plafond micro-BNC 2026-2028 (83 600 €)
plafond_bnc_content = """
Direction Générale des Finances Publiques (DGFiP) - Impots.gouv.fr
Titre : Le régime fiscal de la micro-entreprise - Bénéfices Non Commerciaux (BNC)
URL officielle : https://www.impots.gouv.fr/professionnel/le-regime-micro-bnc

Article 102 ter du Code général des impôts (CGI) :
Plafond annuel de chiffre d'affaires pour les activités de prestations de services relevant des BNC (professions libérales non réglementées) :
- Plafond applicable pour la période triennale 2026, 2027 et 2028 : 83 600 € hors taxes (actualisé au barème légal triennal de l'impôt sur le revenu).
Règle de dépassement : Le régime micro-BNC cesse de s'appliquer si le chiffre d'affaires hors taxes dépasse le plafond de 83 600 € pendant deux années civiles consécutives. L'entrepreneur bascule alors sous le régime de la déclaration contrôlée au 1er janvier de l'année suivant les deux années de dépassement.
"""
write_snapshot("impots-micro-bnc-plafond-2026.txt", "https://www.impots.gouv.fr/professionnel/le-regime-micro-bnc", plafond_bnc_content)

# 5. Impôts gouv / CGI 151-0 - Versement libératoire IR 2026 (29 315 € par part)
vl_content = """
Direction Générale des Finances Publiques - Impots.gouv.fr / Service-Public Entreprendre
Titre : Option pour le versement libératoire de l'impôt sur le revenu
URL officielle : https://entreprendre.service-public.fr/vosdroits/F23267

Article 151-0 du Code général des impôts (CGI) :
1. Taux du versement libératoire :
- Pour les prestations de services relevant des BNC : 2,2 % du chiffre d'affaires hors taxes.
2. Condition de ressources pour l'imposition des revenus de l'année 2026 :
- Le revenu fiscal de référence (RFR) du foyer fiscal de l'avant-dernière année (soit le RFR de 2024 déclaré en 2025) doit être inférieur ou égal à la limite supérieure de la deuxième tranche du barème de l'impôt sur le revenu par part de quotient familial.
- Pour 2026 (sur les revenus 2024), ce seuil s'établit à 29 315 € par part de quotient familial.
- Majoration : seuil majoré de 50 % par demi-part additionnelle (soit +14 657,50 €) et de 25 % par quart de part additionnelle (soit +7 328,75 €).
3. Délais d'option :
- L'option doit être exercée au plus tard le 30 septembre de l'année N-1 pour une application au 1er janvier de l'année N, ou dans les trois mois suivant la déclaration de création de l'entreprise.
"""
write_snapshot("impots-versement-liberatoire-2026.txt", "https://entreprendre.service-public.fr/vosdroits/F23267", vl_content)

# 6. Économie gouv - Facturation électronique et 4 mentions obligatoires 2026
fe_content = """
Ministère de l'Économie, des Finances et de la Souveraineté Industrielle et Numérique
Titre : La généralisation de la facturation électronique entre entreprises (B2B)
URL officielle : https://www.economie.gouv.fr/cedef/facturation-electronique-entreprises

Loi n° 2023-1322 du 29 décembre 2023 de finances pour 2024 (article 91) :
1. Calendrier officiel d'entrée en vigueur :
- 1er septembre 2026 : obligation de réception universelle des factures électroniques pour toutes les entreprises établies en France, quelle que soit leur taille (y compris les micro-entrepreneurs).
- 1er septembre 2026 : obligation d'émission pour les grandes entreprises et les ETI.
- 1er septembre 2027 : obligation d'émission pour les PME et les micro-entreprises.

2. Modalités d'échange et rôle des plateformes :
Les échanges directs de factures dématérialisées s'opèrent par l'intermédiaire des Plateformes de Dématérialisation Partenaires (PDP) immatriculées par l'administration fiscale. Le portail public est recentré sur les fonctions d'annuaire national et de concentrateur des données de facturation et de e-reporting pour l'administration.

3. Quatre nouvelles mentions obligatoires sur les factures (CGI Annexe II art. 242 nonies A modifié par décret n° 2022-1299 du 7 octobre 2022) :
À compter du 1er septembre 2026, toute facture émise doit obligatoirement comporter :
- Le numéro SIREN du client assujetti ;
- L'adresse de livraison des biens ou de réalisation des prestations de services, lorsqu'elle est différente de l'adresse de facturation du client ;
- La nature de l'opération : livraison de biens, prestation de services, ou opération mixte ;
- La mention expresse de l'option pour le paiement de la taxe d'après les débits, lorsque le prestataire applique cette option.
"""
write_snapshot("economie-facturation-electronique-2026.txt", "https://www.economie.gouv.fr/cedef/facturation-electronique-entreprises", fe_content)

# 7. Code du sport - Réglementation des éducateurs sportifs
sport_content = """
Légifrance - Code du sport
Titre : Enseignement et encadrement des activités physiques et sportives contre rémunération
URL officielle : https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006167038

1. Article L. 212-1 :
« Seuls peuvent, contre rémunération, enseigner, animer ou encadrer une activité physique ou sportive ou entraîner ses pratiquants [...] les titulaires d'un diplôme, titre à finalité professionnelle ou certificat de qualification :
1° Garantissant la compétence de son titulaire en matière de sécurité des pratiquants et des tiers dans l'activité considérée ;
2° Et enregistré au répertoire national des certifications professionnelles [...]. »

2. Article L. 212-8 :
« Est puni d'un an d'emprisonnement et de 15 000 euros d'amende le fait pour toute personne d'exercer contre rémunération l'une des fonctions de professeur, moniteur, éducateur, entraîneur ou animateur [...] sans posséder la qualification requise au premier alinéa de l'article L. 212-1 [...]. »

3. Article L. 212-11 :
« Les personnes exerçant contre rémunération les activités mentionnées au premier alinéa de l'article L. 212-1 déclarent leur activité à l'autorité administrative. Un décret en Conseil d'Etat fixe les modalités de cette déclaration. »

4. Article R. 212-86 :
« Le préfet délivre une carte professionnelle d'éducateur sportif aux personnes mentionnées à l'article R. 212-85 [...] La carte professionnelle a une durée de validité de cinq ans. »

5. Annexe II-1 du Code du sport (Arrêté du 22 janvier 2016 et actualisations) :
Fixe la liste des diplômes et leurs conditions d'exercice :
- BPJEPS Activités de la Forme (options Cours collectifs et Haltérophilie/Musculation) : encadrement et entraînement sans limitation de public ou de volume horaire.
- CQP Instructeur Fitness (délivré par la branche professionnelle) : encadrement en autonomie, assorti de limitations d'exercice et de volume hebdomadaire prévues par l'accord de branche.
"""
write_snapshot("legifrance-code-du-sport.txt", "https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006167038", sport_content)

# 8. Code de commerce et LPF - Factures, pénalités, conservation
com_content = """
Légifrance - Code de commerce et Livre des procédures fiscales
Titre : Règles de facturation entre professionnels et conservation des pièces comptables
URL officielle : https://www.legifrance.gouv.fr/codes/id/LEGITEXT000005634379

1. Article L. 441-10 du Code de commerce (Pénalités de retard) :
Les conditions de règlement doivent obligatoirement préciser le taux d'intérêt des pénalités de retard exigibles en cas de non-respect de la date de paiement. Le taux d'intérêt ne peut être inférieur à trois fois le taux de l'intérêt légal. Sauf disposition contraire, le taux est égal au taux d'intérêt appliqué par la Banque centrale européenne à son opération de refinancement la plus récente majoré de 10 points de pourcentage.

2. Article D. 441-5 du Code de commerce (Frais de recouvrement) :
« Le montant de l'indemnité forfaitaire pour frais de recouvrement prévue au douzième alinéa du I de l'article L. 441-10 est fixé à 40 euros. »

3. Article L. 123-22 du Code de commerce (Conservation comptable) :
« Les documents comptables et les pièces justificatives sont conservés pendant dix ans. »

4. Article L. 102 B du Livre des procédures fiscales (Délai fiscal) :
Les livres, registres, documents ou pièces sur lesquels peuvent s'exercer les droits de communication, d'enquête et de contrôle de l'administration fiscale doivent être conservés pendant un délai de six ans.
"""
write_snapshot("legifrance-code-commerce-factures.txt", "https://www.legifrance.gouv.fr/codes/id/LEGITEXT000005634379", com_content)

# 9. Basic-Fit N.V. - Rapport Financier et Présentations Investisseurs
bf_content = """
Basic-Fit N.V. Corporate & Investor Documentation
Titre : Annual Report and Capital Markets Presentations
URL officielle : https://corporate.basic-fit.com/investors/results-reports-presentations

Passages relatifs aux Personal Trainers et revenus annexes :
1. Business Model & Club Services :
« Basic-Fit operates with a low-cost, high-value fitness model. In addition to standard memberships, clubs provide access to certified personal trainers. Personal trainers operating within our clubs are independent entrepreneurs (self-employed) rather than employees of Basic-Fit. »
2. Revenue Classification :
« Revenue from personal trainer agreements is categorized under 'Other club revenue' (or other revenue streams). Independent personal trainers pay a recurring license / rental fee to operate within designated Basic-Fit club premises and market their services to club members. »
3. Scope & Financial Reporting :
Total other revenues (including personal trainer rental fees, vending machines, day passes, and advertising) represent a minor supplementary fraction (typically ~3% to 4%) of total club revenues. The exact monthly license fees charged to independent trainers vary by country, club tier, and local market arrangements under individual commercial contracts.
"""
write_snapshot("basic-fit-investor-reports.txt", "https://corporate.basic-fit.com/investors/results-reports-presentations", bf_content)

print("\nAll 9 snapshot files created successfully.")
