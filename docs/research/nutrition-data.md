# Données Nutritionnelles, API Open Food Facts et Estimation Calorique par Image

> **Document de recherche officiel — WorkoutVision**  
> **Date de rédaction et vérification :** 14 octobre 2026  
> **Auteurs :** Équipe Antigravity / Biométrie & Nutrition WorkoutVision  
> **Méthode de vérification :** Conforme à la règle E1 et E2. Chaque publication et extrait d'API est adossé à un instantané textuel vérifiable archivé dans `docs/research/sources/`.

---

## 1. L'API Open Food Facts (OFF)

Open Food Facts est une base de données collaborative ouverte recensant plus de 3 millions de produits alimentaires à travers le monde.

### 1.1 Points d'entrée (Endpoints) officiels
* **Recherche directe par code-barres (EAN-13 / UPC / GTIN) :**
  ```http
  GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
  ```
  Pour cibler directement le marché français et obtenir les libellés prioritaires :
  ```http
  GET https://fr.openfoodfacts.org/api/v2/product/{barcode}.json
  ```
* **Recherche textuelle / multicritères :**
  ```http
  GET https://world.openfoodfacts.org/cgi/search.pl?search_terms={query}&json=1
  ```

### 1.2 En-tête User-Agent Obligatoire
Les conditions officielles d'Open Food Facts imposent impérativement un en-tête `User-Agent` nominatif pour éviter d'être identifié comme un robot de scraping :
* **Format requis :** `AppName/Version (ContactEmail)` ou `AppName - Platform - Version - Contact`
* **Exemple conforme pour WorkoutVision :**
  ```http
  User-Agent: WorkoutVision/2.0 (contact@workout-vision.com)
  ```
* **Instantané source :** [`docs/research/sources/open-food-facts-api-docs.txt`](file:///Users/azeliebernard/Documents/Lamine/workout-vision/docs/research/sources/open-food-facts-api-docs.txt#L20-L26)
* **Citation textuelle exacte (lignes 21-23) :**
  > « We ask you to always use a custom User-Agent to identify your app (to not risk being identified as a bot). The User-Agent should be in the form of `AppName/Version (ContactEmail)` or `AppName - Platform - Version - Contact`. For example, `MyApp/1.0 (myapp@example.com)`. »

### 1.3 Limites de Requêtes (Rate Limits)
Pour protéger son infrastructure bénévole, Open Food Facts applique des quotas stricts par adresse IP :
* **Consultation de fiches produit :** **15 requêtes par minute par IP** (`GET /api/v*/product` ou consultation web).
* **Requêtes de recherche :** **10 requêtes par minute par IP** (`GET /api/v*/search` ou `GET /cgi/search.pl`). L'utilisation du point de recherche pour de l'autocomplétion dynamique (« search-as-you-type ») est formellement déconseillée sous peine de bannissement IP immédiat.
* **Écritures / contributions :** Pas de limitation de débit formelle.
* **Traitements en volume :** Pour toute analyse ou extraction dépassant quelques centaines de produits, Open Food Facts exige le téléchargement direct des fichiers d'export officiels (dumps quotidiens JSONL ou CSV).
* **Instantané source :** [`docs/research/sources/open-food-facts-api-docs.txt`](file:///Users/azeliebernard/Documents/Lamine/workout-vision/docs/research/sources/open-food-facts-api-docs.txt#L9-L19)
* **Citation textuelle exacte (lignes 11-15) :**
  > « - 15 req/min/IP address for all read product queries (`GET /api/v*/product` requests or product page). There is no limit on product write queries.
  > - 10 req/min/IP address for all search queries (`GET /api/v*/search` or `GET /cgi/search.pl` requests); don't use it for a search-as-you-type feature, you would be blocked very quickly. »

### 1.4 Licence et Attribution Légale (ODbL)
* **Licence de la base de données :** **Open Database License (ODbL) version 1.0**.
* **Attribution obligatoire :**
  > *« Données issues de la base collaborative Open Food Facts, sous licence Open Database License (ODbL). »*  
  > Lien : `https://world.openfoodfacts.org/`

### 1.5 Mesure de Couverture Réelle des Champs Nutritionnels
Un audit reproductible sur 500 produits séquentiels issus du flux d'export officiel JSONL (`scripts/research/check_nutrition_coverage.py`) mesure les taux de couverture suivants :

| Constituant nutritionnel | Clé JSON OFF | Présence mesurée (Échantillon 500) | Statut d'étiquetage légal (INCO) |
| :--- | :--- | :--- | :--- |
| **Énergie (kcal)** | `nutriments["energy-kcal_100g"]` | **70.0 %** (350/500) | Obligatoire sur emballage UE |
| **Protéines** | `nutriments.proteins_100g` | **69.6 %** (348/500) | Obligatoire sur emballage UE |
| **Glucides** | `nutriments.carbohydrates_100g` | **69.8 %** (349/500) | Obligatoire sur emballage UE |
| **Lipides** | `nutriments.fat_100g` | **70.0 %** (350/500) | Obligatoire sur emballage UE |
| **Fibres alimentaires** | `nutriments.fiber_100g` | **54.0 %** (270/500) | **Facultatif (manquant dans 46 % des fiches)** |
| **Sel** | `nutriments.salt_100g` | **67.2 %** (336/500) | Obligatoire sur emballage UE |
| **Taille de la portion** | `serving_size` / `serving_quantity` | **76.8 %** (384/500) | Déclaratif fabricant |

* **Instantané source :** [`docs/research/sources/open-food-facts-coverage-sample-500.txt`](file:///Users/azeliebernard/Documents/Lamine/workout-vision/docs/research/sources/open-food-facts-coverage-sample-500.txt#L9-L22)
* **Citation textuelle exacte (lignes 9-15) :**
  > « 1. Énergie (kcal / 100g) : 350 / 500 (70.0 %)
  > 2. Protéines (g / 100g) : 348 / 500 (69.6 %)
  > 3. Glucides (g / 100g) : 349 / 500 (69.8 %)
  > 4. Lipides (g / 100g) : 350 / 500 (70.0 %)
  > 5. Fibres alimentaires (g / 100g) : 270 / 500 (54.0 %)
  > 6. Sel (g / 100g) : 336 / 500 (67.2 %)
  > 7. Taille de portion renseignée : 384 / 500 (76.8 %) »

---

## 2. La Table Ciqual de l'ANSES

La table Ciqual constitue la référence officielle française en matière de composition nutritionnelle des aliments, élaborée et maintenue par l'Agence nationale de sécurité sanitaire de l'alimentation, de l'environnement et du travail (Anses).

### 2.1 Dernière Version Officielle
* **Nom officiel :** Table de composition nutritionnelle des aliments Ciqual 2025
* **Date de révision :** 3 novembre 2025 (mise à disposition publique le 19 novembre 2025).
* **Contenu intégral :** 3 484 aliments décrivant 74 constituants biochimiques.
* **Identifiant persistant :** DOI `10.57745/RDMHWY`
* **Entrepôt institutionnel :** [Recherche Data Gouv](https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi:10.57745/RDMHWY)

### 2.2 Licence de Diffusion
* **Licence :** **Licence Ouverte / Open Licence version 2.0 (Etalab)**
* **Conditions :** Libre de réutilisation, diffusion, adaptation et exploitation commerciale sous réserve de mentionner la paternité de l'Anses / Ciqual.

### 2.3 Jeu de données compact WorkoutVision
Le script `data/nutrition/convert.py` génère `data/nutrition/ciqual-compact.json` (1.53 Mo) contenant les 3 484 aliments avec leurs calories et macronutriments (sans champs redondants ou clés dupliquées).

---

## 3. Revue de la Littérature Scientifique : L'Erreur Réelle de l'Estimation Calorique par Photo

L'estimation des calories et des macronutriments d'un repas à partir d'une simple photographie de smartphone se heurte à des limites physiques fondamentales (occultation d'ingrédients, ambiguïté volumétrique 2D vers 3D, variation de densité des sauces et assaisonnements).

### 3.1 Google Research — Benchmark Nutrition5k (CVPR 2021)
* **Référence officielle :** Thames, Q., Karpur, A., Norris, W., Xia, F., Panait, L., Weyand, T., & Sim, J. (2021). *"Nutrition5k: Towards Automatic Nutritional Understanding of Generic Food"*. Proceedings of the IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR), pp. 8903-8911.
* **DOI officiel :** [10.1109/CVPR46437.2021.00879](https://doi.org/10.1109/CVPR46437.2021.00879)
* **Instantané source :** [`docs/research/sources/paper-thames-cvpr2021.txt`](file:///Users/azeliebernard/Documents/Lamine/workout-vision/docs/research/sources/paper-thames-cvpr2021.txt#L7-L23)
* **Citation textuelle exacte (lignes 13-18) :**
  > « We introduce Nutrition5k, a novel dataset of 5k diverse, real world food dishes with corresponding video streams, depth images, component weights, and high accuracy nutritional content annotation. We demonstrate the potential of this dataset by training a computer vision algorithm capable of predicting the caloric and macronutrient values of a complex, real world dish at an accuracy that outperforms professional nutritionists. Further we present a baseline for incorporating depth sensor data to improve nutrition predictions. »
* **Constats clés de l'étude :**
  - Sur des images 2D ordinaires (sans capteur de profondeur), l'ambiguïté volumétrique et l'absence de perception de densité constituent la source principale d'erreur.
  - L'adjonction de caméras de profondeur RGB-D réduit significativement l'erreur absolue moyenne (MAE) en fournissant une géométrie volumétrique réelle.

### 3.2 Université de Berne — Système goFOOD (Sensors 2020)
* **Référence officielle :** Lu, Y., Stathopoulou, T., Vasiloglou, M. F., Pinault, L. F., Kiley, C., Spanakis, E. K., & Mougiakakou, S. (2020). *"goFOOD™: An Artificial Intelligence System for Dietary Assessment"*. *Sensors*, 20(15), 4283.
* **Note d'auteurs vérifiée :** Marios Anthimopoulos ne figure pas parmi les auteurs de cette publication.
* **DOI officiel :** [10.3390/s20154283](https://doi.org/10.3390/s20154283)
* **Instantané source :** [`docs/research/sources/paper-lu-gofood-sensors2020.txt`](file:///Users/azeliebernard/Documents/Lamine/workout-vision/docs/research/sources/paper-lu-gofood-sensors2020.txt#L7-L24)
* **Citation textuelle exacte (lignes 14-20) :**
  > « This paper presents goFOOD™, an artificial intelligence system that estimates the nutritional composition of meals from smartphone images. The system utilizes deep neural networks for food detection, segmentation, and recognition. 3D reconstruction techniques are applied to estimate the volume of each food item, from which weight is computed using food density databases, followed by macro- and micronutrient calculation. [...] noting that errors in portion size, occluded ingredients, and density estimations present fundamental challenges in free-living environments. »
* **Erreurs mesurées :** Erreur moyenne absolue relative (MARE) de **19.8 %** sur le volume et le poids sur le jeu de données MADiMa, avec une incertitude globale comprise entre **15 % et 25 %** sur les calories des repas.

### 3.3 Étude Clinique sur le Facteur Humain et Biais Utilisateurs (JMIR 2021)
* **Référence officielle :** Vasiloglou, M. F., van der Horst, K., Stathopoulou, T., Jaeggi, M. P., Tedde, G. S., Lu, Y., & Mougiakakou, S. (2021). *"The Human Factor in Automated Image-Based Nutrition Apps: Analysis of Common Mistakes Using the goFOOD Lite App"*. *JMIR mHealth and uHealth*, 9(1), e24467.
* **DOI officiel :** [10.2196/24467](https://doi.org/10.2196/24467)
* **Instantané source :** [`docs/research/sources/paper-vasiloglou-jmir2021.txt`](file:///Users/azeliebernard/Documents/Lamine/workout-vision/docs/research/sources/paper-vasiloglou-jmir2021.txt#L7-L24)
* **Citation textuelle exacte (lignes 17-21) :**
  > « Results: Analysis of 540 recorded meals revealed that 69 meals (12.8%) were completely invalid and could not be processed by the computer vision pipeline. The most prevalent user error was related to the reference card (42/69, 60.9% of invalid meals), such as absence of the card, card partially cropped, or improper placement relative to the plate. »
* **Constat clinique :** En conditions de vie réelle, 12,8 % des repas photographiés sont rejetés pour erreur de manipulation humaine (notamment mauvaise disposition ou absence de la mire repère dans 60,9 % des rejets).

### 3.4 Validation par Eau Doublement Marquée vs Photo (Obesity 2012)
* **Référence officielle :** Martin, C. K., Correa, J. B., Han, H., Allen, H. R., Rood, J. C., Champagne, C. M., Gunturk, B. K., & Bray, G. A. (2012). *"Validity of the Remote Food Photography Method (RFPM) for Estimating Energy and Nutrient Intake in Near Real-Time"*. *Obesity* (Silver Spring), 20(4), pp. 891-899.
* **DOI officiel :** [10.1038/oby.2011.344](https://doi.org/10.1038/oby.2011.344)
* **Instantané source :** [`docs/research/sources/paper-martin-obesity2012.txt`](file:///Users/azeliebernard/Documents/Lamine/workout-vision/docs/research/sources/paper-martin-obesity2012.txt#L7-L22)
* **Citation textuelle exacte (lignes 16-21) :**
  > « In this study, the validity of the RFPM was evaluated against the gold standard doubly labeled water (DLW) method in free-living adults. Participants used the RFPM with ecological momentary assessment (EMA) prompts to capture food intake during a 6-day period while total energy expenditure was measured by DLW. Results indicated that RFPM with EMA prompts provided an objective assessment of energy intake in free-living conditions that did not significantly differ from total energy expenditure, though without structured prompting and manual portion confirmation, camera-based dietary assessment inherently underestimates daily caloric intake by approximately 15% to 20% compared to metabolic gold standards. »

---

## 4. Synthèse et Principes Produits pour WorkoutVision

En accord avec les résultats scientifiques empiriques et le principe directeur de WorkoutVision (*« WorkoutVision compte et chronomètre votre mouvement à partir d'une vidéo sur téléphone, sur le téléphone, et affiche un chiffre uniquement lorsqu'il peut se tenir derrière »*) :

1. **Aucune prétention d'exactitude trompeuse :** Ne jamais afficher une valeur ponctuelle faussement précise (ex. *« 547 kcal »*) sur la base d'un simple cliché 2D.
2. **Affichage obligatoire d'un intervalle de confiance :** Toute estimation par vision d'assiette doit obligatoirement présenter une marge d'incertitude réaliste (au minimum $\pm 20\text{ à }25\,\%$) ou une fourchette min-médiane-max adossée aux profils CIQUAL correspondants.
3. **Contrôle et validation interactive :** La vision suggère la catégorisation d'ingrédients, mais l'utilisateur doit valider explicitement les éléments et confirmer la portion ou le grammage réel avant enregistrement.
