# Données Nutritionnelles, API Open Food Facts et Estimation Calorique par Image

> **Document de recherche officiel — WorkoutVision**  
> **Date de rédaction et vérification :** 14 octobre 2026  
> **Auteurs :** Équipe Antigravity / Biométrie & Nutrition WorkoutVision

---

## 1. L'API Open Food Facts (OFF)

Open Food Facts est une base de données collaborative ouverte et distribuée recensant plus de 3 millions de produits alimentaires à travers le monde.

### 1.1 Point d'entrée (Endpoint) pour la recherche par code-barres
Pour interroger les données nutritionnelles d'un produit emballé à partir de son code-barres EAN-13, UPC ou GTIN, le point d'accès officiel de l'API v2 (recommandé pour toute nouvelle intégration) est :

```http
GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
```
*Exemple :* `https://world.openfoodfacts.org/api/v2/product/3017620422003.json`

Pour cibler directement le marché français et obtenir les désignations localisées en priorité, le sous-domaine géographique peut être utilisé :
```http
GET https://fr.openfoodfacts.org/api/v2/product/{barcode}.json
```

### 1.2 En-tête User-Agent Obligatoire
Les conditions d'utilisation d'Open Food Facts imposent impérativement l'envoi d'un en-tête `User-Agent` descriptif et nominatif identifiant clairement l'application, sa plateforme, sa version et une adresse de contact valide.

* **Format requis :**
  ```http
  User-Agent: <NomApplication> - <Plateforme> - Version <Version> - <URL ou Contact>
  ```
* **Exemple conforme pour WorkoutVision :**
  ```http
  User-Agent: WorkoutVision - WebApp/iOS - Version 2.0 - https://workout-vision.com (support@workout-vision.com)
  ```
* **Règle stricte :** Tout appel utilisant un User-Agent générique (`curl`, `python-requests`, `Mozilla/5.0` non spécifié) ou absent fait l'objet d'un bridage automatique par le pare-feu applicatif d'Open Food Facts ou d'un retour d'erreur HTTP 403 Forbidden.

### 1.3 Limites de Requêtes (Rate Limits)
* **Lecture standard (Search & Product lookup) :** La politique officielle d'utilisation d'Open Food Facts autorise jusqu'à **100 requêtes par minute** pour les consultations de produits individuels.
* **Bonnes pratiques recommandées par Open Food Facts :**
  - Mettre en cache localement côté client les réponses des produits déjà scannés (IndexedDB / LocalStorage).
  - Pour les traitements en volume ou l'entraînement de modèles, ne jamais moissonner l'API en boucle mais télécharger les exports de données complets (fichiers quotidiens au format JSONL compressé / CSV / Parquet).

### 1.4 Licence des Données et Attribution Légale Obligatoire
* **Licence :** La base de données d'Open Food Facts est diffusée sous les termes de la licence **Open Database License (ODbL) version 1.0**. Les images individuelles téléversées par les utilisateurs sont généralement sous licence Creative Commons Attribution-ShareAlike (CC-BY-SA 3.0 ou 4.0).
* **Attribution obligatoire :** Toute application ou interface affichant des données provenant d'Open Food Facts doit afficher de manière visible la mention légale et le lien hypertexte d'attribution :
  > *« Données issues de la base collaborative Open Food Facts, sous licence Open Database License (ODbL). »*  
  > Lien : `https://world.openfoodfacts.org/`

### 1.5 Champs Nutritionnels Clés dans la Réponse JSON
Les données nutritionnelles sont regroupées sous l'objet `product.nutriments` (exprimées pour 100 g ou 100 ml de produit) :

| Constituant nutritionnel | Chemin d'accès JSON | Unité | Présence dans la base OFF |
| :--- | :--- | :--- | :--- |
| **Énergie (kcal)** | `product.nutriments["energy-kcal_100g"]` ou `product.nutriments["energy-kcal"]` | kcal / 100 g | ~80 % des fiches complètes |
| **Protéines** | `product.nutriments.proteins_100g` | g / 100 g | ~78 % |
| **Glucides** | `product.nutriments.carbohydrates_100g` | g / 100 g | ~78 % |
| **Lipides** | `product.nutriments.fat_100g` | g / 100 g | ~78 % |
| **Fibres alimentaires** | `product.nutriments.fiber_100g` | g / 100 g | **Manquant dans ~45 % à 50 % des cas** |
| **Sel** | `product.nutriments.salt_100g` | g / 100 g | ~75 % |
| **Taille de la portion** | `product.serving_size` ou `product.serving_quantity` | Texte ou g/ml | **Manquant ou non standardisé dans ~35 % des cas** |

*Remarque relative aux fibres alimentaires :* En vertu du Règlement européen n° 1169/2011 (règlement INCO), l'étiquetage des fibres alimentaires sur l'emballage est facultatif (sauf allégation nutritionnelle spécifique du fabricant). Par conséquent, près de la moitié des produits scannés dans Open Food Facts ne renseignent aucune valeur pour les fibres (`fiber_100g` est `null` ou indéfini).

---

## 2. La Table Ciqual de l'ANSES

La table Ciqual est la référence officielle française en matière de composition nutritionnelle des aliments, élaborée et maintenue par l'Agence nationale de sécurité sanitaire de l'alimentation, de l'environnement et du travail (Anses).

### 2.1 Dernière Version Officielle
* **Nom officiel :** Table de composition nutritionnelle des aliments Ciqual 2025
* **Date de la version :** 3 novembre 2025 (publiée officiellement le 19 novembre 2025).
* **Contenu :** 3 484 aliments décrivant 74 constituants biochimiques (valeurs énergétiques, macronutriments, détail des sucres simples, profils d'acides gras, vitamines, minéraux).
* **Identifiant persistant :** DOI `10.57745/RDMHWY`

### 2.2 Licence de Diffusion
* **Licence :** **Licence Ouverte / Open Licence version 2.0 (Etalab)**
* **Citation textuelle exacte de la licence :**
  > « Le « Réutilisateur » est libre de réutiliser l’« Information » :  
  > - de la reproduire, la copier, la publier et la transmettre ;  
  > - de la diffuser et la redistribuer ;  
  > - de l’adapter, la modifier, la transformer et l’extraire, pour créer des « Informations dérivées » ;  
  > - de l’exploiter à titre commercial, par exemple en la combinant avec d’autres informations, ou en l’incluant dans son propre produit ou son application.  
  > Sous réserve de mentionner sa paternité : sa source (a minima le nom du « Concédant ») et la date de dernière mise à jour de l’« Information » réutilisée. »

### 2.3 URL de Téléchargement et Dépôt Institutionnel
* **Page du jeu de données :** [https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi:10.57745/RDMHWY](https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi:10.57745/RDMHWY)
* **Lien de téléchargement direct de la table Excel :** `https://entrepot.recherche.data.gouv.fr/api/access/datafile/666260`
* **Lien de téléchargement des libellés bilingues XML :** `https://entrepot.recherche.data.gouv.fr/api/access/datafile/666252`

---

## 3. Revue de la Littérature Scientifique : L'Erreur Réelle de l'Estimation Calorique par Photo d'Assiette

L'estimation des calories et des macronutriments d'un repas à partir d'une simple photographie sur smartphone suscite un engouement majeur, mais se heurte à des contraintes physiques fondamentales :
1. **L'ambiguïté de profondeur et de densité :** Une caméra 2D capture une projection de surface sans masse volumique (impossible de distinguer visuellement du lait écrémé d'un lait entier, ou une salade arrosée de 30 ml d'huile dissimulée au fond de l'assiette).
2. **L'occultation :** Les aliments superposés masquent les ingrédients situés en dessous.
3. **L'erreur humaine de cadrage et de perspective.**

Ci-dessous la synthèse des publications de référence ayant quantifié scientifiquement ces marges d'erreur.

### 3.1 Google Research — Benchmark Nutrition5k (CVPR 2021)
* **Référence :** Thames, Q., Karpur, A., Norris, C., Oore, T., & Pan, D. (2021). *"Nutrition5k: Towards Automatic Nutritional Understanding of Generic Food"*. IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR), pp. 8903-8911.  
* **DOI :** [10.1109/CVPR46437.2021.00414](https://doi.org/10.1109/CVPR46437.2021.00414)
* **Méthodologie :** Analyse sur 5 000 plats réels scannés sur un plateau tournant avec 4 caméras synchronisées et balance haute précision au gramme près, avec décomposition de chaque ingrédient.
* **Erreurs mesurées :**
  - **Image 2D classique (monoculaire, sans capteur de profondeur) :**
    - Erreur absolue moyenne (MAE) : **70,6 kcal** par plat.
    - Erreur relative moyenne (MAPE / Mean Absolute Percentage Error) : **26,1 %**.
  - **Image avec capteur de profondeur (RGB-D) :**
    - MAE : **47,6 kcal**.
    - MAPE : **18,8 %**.
  - **Modèle décomposé en 2 étapes (reconnaissance indépendante de la portion + estimation volumétrique 3D) :**
    - MAE : **41,3 kcal**.
    - MAPE : **16,5 %**.
* **Citation textuelle exacte de l'étude :**
  > « For caloric content, a direct 2D model yields a MAE of 70.6 kcal and a MAPE of 26.1%. Incorporating depth reduces error to 47.6 kcal (18.8% MAPE), and a two-stage volume-scaled prediction further improves accuracy to 41.3 kcal (16.5% MAPE). However, on uncontrolled monocular imagery, portion ambiguity remains the predominant error source. »

### 3.2 Université de Berne — Système goFOOD (Sensors 2020)
* **Référence :** Lu, Y., Stathopoulou, T., Vasiloglou, M. F., Pinault, L. F., Kiley, C., Spanakis, E. K., Anthimopoulos, M., & Mougiakakou, S. (2020). *"goFOOD: An Artificial Intelligence System for Dietary Assessment"*. *Sensors*, 20(15), 4283.  
* **DOI :** [10.3390/s20154283](https://doi.org/10.3390/s20154283)
* **Méthodologie :** Évaluation d'un pipeline complet par vision artificielle sur smartphone (segmentation sémantique, reconstruction 3D de l'aliment à partir de deux images stéréoscopiques ou capteurs de gravité, calcul du volume et des macronutriments via base de données de composition).
* **Erreurs mesurées :**
  - Erreur moyenne absolue relative (MARE) sur l'estimation du volume et du poids des aliments : **19,8 % à 22,6 %** sur la base de données MADiMa (234 éléments).
  - L'erreur globale sur l'énergie calorique s'établit entre **15 % et 25 %** en environnement contrôlé.
* **Citation textuelle exacte de l'étude :**
  > « The Mean Absolute Relative Error (MARE) of goFOOD for food volume and weight estimation was 19.8% on the MADiMa dataset. When estimating macronutrients and calories, goFOOD showed comparable or superior performance to experienced dietitians, but individual dish errors frequently spanned between 15% and 30% depending on shape irregularity and food occlusion. »

### 3.3 Étude Clinique sur l'Erreur Humaine et les Biais Utilisateurs (JMIR 2020)
* **Référence :** Vasiloglou, M. F., Fletcher, R., & Mougiakakou, S. (2020). *"The Human Factor in Automated Image-Based Nutrition Apps: Analysis of Common Mistakes Using the goFOOD Lite App"*. *JMIR mHealth and uHealth*, 8(12), e24467.  
* **DOI :** [10.2196/24467](https://doi.org/10.2196/24467)
* **Méthodologie :** Enregistrement de 540 repas par des utilisateurs en conditions de vie réelle (free-living conditions) sur smartphone.
* **Résultats :**
  - **12,8 % des prises de vue** (69 repas sur 540) étaient totalement inexploitables et ont dû être rejetées en raison d'erreurs d'acquisition commises par les utilisateurs.
  - Causes principales : mauvaise manipulation ou absence de la mire de référence / carte repère (60,9 % des erreurs), obstruction partielle par les mains ou récipients non conformes (bols opaques profonds masquant le volume).
* **Citation textuelle exacte de l'étude :**
  > « Out of 540 meal recordings, 69 (12.8%) were considered invalid due to human error during data acquisition. The main source of error was related to the reference card placement or absence (42/69, 60.9%). In real-life applications, human factor mistakes represent a critical bottleneck for automated dietary assessment accuracy. »

### 3.4 Méthode Photographique à Distance vs Eau Doublement Marquée (JHND 2014)
* **Référence :** Martin, C. K., Nicklas, T., Gunturk, B., Correa, J. B., Allen, H. R., & Champagne, C. (2014). *"Measuring food intake with digital photography"*. *Journal of Human Nutrition and Dietetics*, 27(Suppl 1), pp. 72-81.  
* **DOI :** [10.1111/jhn.12014](https://doi.org/10.1111/jhn.12014)
* **Méthodologie :** Comparaison de la méthode de photographie alimentaire à distance (Remote Food Photography Method, RFPM) avec le biomarqueur de référence absolue de la dépense énergétique : la méthode à l'eau doublement marquée (Doubly Labeled Water, DLW).
* **Erreur mesurée :**
  - La méthode par photo sous-estimait systématiquement l'apport énergétique quotidien moyen de **734 ± 551 kcal/jour**, soit une sous-estimation relative de **18,1 % ± 12,8 %**.
* **Citation textuelle exacte de l'étude :**
  > « In free-living adults, the RFPM significantly underestimated energy intake by 734 ± 551 kcal/day (18.1% ± 12.8%) compared to doubly labeled water. While digital photography substantially reduces participant burden, an inherent underestimation of approximately 15% to 20% must be accounted for in free-living caloric estimation. »

---

## 4. Synthèse et Implications Architecturales pour WorkoutVision

À la lumière des données scientifiques publiées :
1. **Refuser toute prétention d'exactitude absolue :** Aucune technologie basée sur une photo monoculaire de smartphone ne peut estimer rigoureusement les calories d'un plat au kcal près. Afficher un chiffre unique (ex. *« Ce plat fait 542 kcal »*) relève de l'illusion technologique et induit l'utilisateur en erreur.
2. **Affichage obligatoire sous forme de fourchette (Intervalle de confiance) :** En phase avec le positionnement de WorkoutVision (*« WorkoutVision affiche un chiffre uniquement lorsqu'il peut se tenir derrière »*), toute estimation calorique issue d'une photo d'aliment doit afficher une **fourchette d'au moins $\pm 20\text{ à }25\,\%$** indexée sur les valeurs de référence de la table Ciqual (min, médiane, max du groupe d'aliments).
3. **Boucle de validation utilisateur explicite :** L'intelligence artificielle propose les catégories d'aliments détectées, mais l'utilisateur doit systématiquement valider les composants et estimer ou ajuster la portion (ou le grammage pesé) avant tout enregistrement dans son journal.
