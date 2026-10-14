# Évaluation des Modèles de Pose Équine, Faisabilité Mobile et Littérature sur la Boiterie

> **Document de recherche officiel — WorkoutVision**  
> **Date de rédaction et vérification :** 14 octobre 2026  
> **Auteurs :** Équipe Antigravity / Recherche Biomécanique Équine  
> **Snapshots de référence :** consultables dans `docs/research/sources/`

---

## 1. Modèles de Pose Quadrupède et Analyse des Licences

Actuellement, l'application WorkoutVision n'embarque aucun modèle de détection d'équidé dans le navigateur. Dans le cadre de cette évaluation technique, nous avons analysé les deux architectures majeures de détection de points clés quadrupèdes disponibles dans la littérature scientifique.

### 1.1 DeepLabCut SuperAnimal-Quadruped (EPFL / Nature Communications 2024)
* **Publication scientifique :** Ye, S., Filippova, A., Lauer, J., Schneider, S., Vidal, M., Qiu, T., Mathis, A., & Mathis, M. W. (2024). *"SuperAnimal pretrained pose estimation models for behavioral analysis"*. *Nature Communications*, 15(1), 4879.  
  * **DOI :** [10.1038/s41467-024-48792-2](https://doi.org/10.1038/s41467-024-48792-2)
* **Licence logicielle :** La boîte à outils logicielle DeepLabCut est distribuée sous licence GNU LGPL v3.0 (`docs/research/sources/deeplabcut-license.txt`).
* **Licence des poids pré-entraînés du modèle SuperAnimal-Horse :**
  - **Verdict commercial : UTILISATION COMMERCIALE INTERDITE SOUS LA LICENCE PUBLIQUE.**
  - **Type de licence :** **Modified MIT, academic non-commercial**, stipulé sur le dépôt Hugging Face officiel (`docs/research/sources/superanimal-hf-license.txt`).
  - **Restrictions d'usage :** Les poids pré-entraînés sont expressément restreints à un usage académique et non commercial. Toute intégration dans une application commerciale nécessite un accord de licence commerciale distinct négocié auprès du Technology Transfer Office de l'EPFL (EPFL-TTO).
* **Faisabilité mobile :** Aucun runtime officiel ONNX ou TensorFlow.js léger n'est distribué pour une exécution WebAssembly/WebGPU directe dans le navigateur client.

---

### 1.2 OpenMMLab RTMPose-m / AP-10K
* **Publications scientifiques :**
  - **Jeu de données AP-10K :** Yu, H., Xu, Y., Zhang, J., Zhao, W., Guan, Z., & Tao, D. (2021). *"AP-10K: A Benchmark for Animal Pose Estimation in the Wild"*. *Thirty-fifth Conference on Neural Information Processing Systems (NeurIPS) Datasets and Benchmarks Track*. Dépôt officiel : `github.com/AlexTheBad/AP-10K` (`docs/research/sources/ap10k-github-readme.txt`).
  - **Architecture RTMPose :** Jiang, T., Lu, P., Zhang, L., Ma, N., Han, R., Lyu, C., Li, Y., & Chen, K. (2023). *"RTMPose: Real-Time Multi-Person Pose Estimation based on MMPose"*. *arXiv:2303.07399* (`docs/research/sources/rtmpose-arxiv-2303-07399.txt`).
* **Licences et chaîne de pré-entraînement :**
  - **Architecture RTMPose et codebase MMPose :** Distribuée sous licence **Apache 2.0**.
  - **Jeu de données AP-10K :** Distribué sous licence **CC-BY 4.0**.
  - **Chaîne de pré-entraînement :** Le modèle officiel `rtmpose-m_simcc-ap10k_pt-aic-coco_210e-256x256-7a041aa1_20230206` a fait l'objet d'un pré-entraînement sur **AI Challenger (AIC)** et **COCO**, suivi d'un entraînement sur AP-10K. Les termes des jeux de données sources AIC et COCO doivent être respectés en cas d'exploitation commerciale.
* **Topologie et convention anatomique AP-10K :**
  - Le modèle prédit 17 points clés standardisés AP-10K (`left_eye`, `right_eye`, `nose`, `neck`, `tail_root`, `left_shoulder`, `left_elbow`, `left_front_paw`, `right_shoulder`, `right_elbow`, `right_front_paw`, `left_hip`, `left_knee`, `left_back_paw`, `right_hip`, `right_knee`, `right_back_paw`).
  - **Avertissement anatomique AP-10K :** Selon la définition officielle d'AP-10K : pour les ongulés (unguligrades), *"hip"* désigne le grasset/genou anatomique (stifle) et *"knee"* désigne le jarret/cheville (hock).
  - **Distinction cruciale :** Aucun point clé AP-10K ne correspond au **garrot** (*withers*) ni à la **croupe / tubérosité sacrale** (*tuber sacrale*). Le point `neck` est situé à la base de l'encolure et `tail_root` à la racine de la queue.

---

## 2. Performances Hors-Ligne et Validation Manuelle sur Séquences Équines Montées

L'inférence top-down a été exécutée hors-ligne avec `scripts/demo-render/equine_keypoints.py` sur les deux séquences de trot monté. Conformément aux exigences de rigueur, aucun chiffre de couverture synthétique n'est extrapolé. Une validation manuelle image par image sur 20 images réparties uniformément par clip a été effectuée.

### 2.1 Modèle Exécuté
* **Fichier ONNX :** `rtmpose-m_ap10k_256.onnx` (54 478 120 octets, SHA-256 : `1cfd1c86e0d9e5d5f95178bcd95ee9a4e8386a624cd3c57519f27ff58cac7f28`).
* **Provenance :** `https://huggingface.co/hr16/UnJIT-DWPose/resolve/main/rtmpose-m_ap10k_256.onnx`.
* **Origine MMPose :** `rtmpose-m_simcc-ap10k_pt-aic-coco_210e-256x256-7a041aa1_20230206`.
* **Pipeline top-down :** boîte englobante interpolée linéairement, marge de 1,25, recadrage carré sans étirement, interpolation affine vers $256 \times 256$, normalisation (mean: `[123.675, 116.28, 103.53]`, std: `[58.395, 57.12, 57.375]`), décodage SimCC (split ratio 2), transformation affine inverse.
* **Score brut :** `score_raw` représente le logit SimCC minimal non-linéarisé (sans sigmoïde) ; il n'est en aucun cas désigné comme probabilité ou confiance.
* **Seuil d'affichage retenu :** $0{,}50$. À ce seuil, les yeux et le nez du cheval sur la vue arrière fuyante (`horse_ridden_trot_behind_30170927`) présentent un score inférieur à $0{,}50$ et ne sont fidèlement pas dessinés.

### 2.2 Synthèse des Séquences de Test et Fichiers Produits

| Séquence vidéo | Type d'allure | Définition & Fréquence | Total Frames | Validation Manuelle (20 frames) | Fichier CSV Manuel | Fichier JSON | Aperçu Vidéo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`horse_ridden_trot_behind_30170927`** | Trot monté (axe arrière) | $854 \times 480$ px @ 60,00 fps | 360 frames (6,00 s) | 20 frames inspectées à l'œil | `data/demo-v2/equine/manual/horse_ridden_trot_behind_30170927_manual.csv` | `data/demo-v2/equine/horse_ridden_trot_behind_30170927.json` | `public/demo/v2/horse/horse_ridden_trot_behind_30170927-keypoints.mp4` (2,18 Mo) |
| **`horse_ridden_trot_side_35971086`** | Trot monté (profil latéral) | $854 \times 480$ px @ 29,97 fps | 180 frames (6,01 s) | 20 frames inspectées à l'œil | `data/demo-v2/equine/manual/horse_ridden_trot_side_35971086_manual.csv` | `data/demo-v2/equine/horse_ridden_trot_side_35971086.json` | `public/demo/v2/horse/horse_ridden_trot_side_35971086-keypoints.mp4` (1,59 Mo) |

* **Planche de contact visuelle :** `docs/research/equine-keypoints-contact-sheet.png` (1,8 Mo, 20 vignettes annotées).

### 2.3 Distribution des Scores Bruts (`score_raw`)

Sur la vue arrière (`horse_ridden_trot_behind_30170927`) :
* `tail_root` : score moyen $0{,}765$ (93,6 % $\ge 0{,}50$)
* `neck` : score moyen $0{,}687$ (89,2 % $\ge 0{,}50$)
* `left_back_paw` : score moyen $0{,}765$ (99,4 % $\ge 0{,}50$)
* `nose` : score moyen $0{,}395$ (seulement 15,0 % $\ge 0{,}50$ — occlus par la tête et le buste du cavalier).

Sur la vue de profil (`horse_ridden_trot_side_35971086`) :
* `neck` : score moyen $1{,}005$ (100,0 % $\ge 0{,}50$)
* `tail_root` : score moyen $0{,}856$ (99,4 % $\ge 0{,}50$)
* `left_eye` : score moyen $0{,}916$ (99,4 % $\ge 0{,}50$)
* `nose` : score moyen $1{,}013$ (97,2 % $\ge 0{,}50$)
* `left_front_paw` : score moyen $0{,}985$ (98,3 % $\ge 0{,}50$)
* `left_back_paw` : score moyen $0{,}763$ (83,3 % $\ge 0{,}50$)

---

## 3. Littérature Scientifique : Évaluation Objective de la Boiterie Équine

### 3.1 Système Inertiel et Seuils Historiques (McCracken et al., 2012)
* **Référence :** McCracken, M. J., Kramer, J., Keegan, K. G., Lopes, M., Wilson, D. A., Reed, S. K., LaCarrubba, A., & Rasch, M. (2012). *"Comparison of an inertial sensor system of lameness quantification with subjective lameness evaluation"*. *Equine Veterinary Journal*, 44(6), pp. 652–656. DOI : [10.1111/j.2042-3306.2012.00571.x](https://doi.org/10.1111/j.2042-3306.2012.00571.x) (`docs/research/sources/mccracken-2012.txt`).
* **Statut des seuils millimétriques :** **NON VÉRIFIÉ DANS LE RÉSUMÉ (UNSOURCED)**. Conformément à la règle d'honnêteté documentaire R8, aucun seuil millimétrique numérique précis n'est affirmé sans citation textuelle vérifiée dans le texte complet de l'article.

---

### 3.2 Rôle du Garrot dans la Détection des Boiteries (Rhodin et al., 2018)
* **Référence :** Rhodin, M., Persson-Sjödin, E., Egenvall, A., Serra Bragança, F. M., Pfau, T., Roepstorff, L., Weishaupt, M. A., Thomsen, M. H., van Weeren, P. R., & Hernlund, E. (2018). *"Vertical movement symmetry of the withers in horses with induced forelimb and hindlimb lameness at trot"*. *Equine Veterinary Journal*, 50(6), pp. 818–824. DOI : [10.1111/evj.12844](https://doi.org/10.1111/evj.12844) (`docs/research/sources/rhodin-2018-withers.txt`).
* **Constat clinique majeur :** L'asymétrie du déplacement vertical de la tête est fréquemment contaminée par des mouvements compensatoires induits par une boiterie postérieure. L'asymétrie mesurée au garrot (*withers*) permet de discriminer une véritable boiterie antérieure primaire des compensations induites par l'arrière-main.

---

### 3.3 Mesure Markerless sur Smartphone (Järemo Lawin et al., 2023 / Sleip)
* **Référence :** Järemo Lawin, F., Rhodin, M., Blom, K., Westring, C.-J., Persson-Sjodin, E., & Hernlund, E. (2023). *"Is Markerless More or Less? Comparing a Smartphone Computer Vision Method for Equine Lameness Assessment to Multi-Camera Motion Capture"*. *Animals*, 13(3), 390. DOI : [10.3390/ani13030390](https://doi.org/10.3390/ani13030390) (`docs/research/sources/sleip-animals-2023.txt`).
* **Résultat clé de l'étude (citation textuelle du résumé) :**
  > « The trial mean difference between the smartphone-based markerless computer vision system and the multi-camera optical system was 2.2 mm (ranging from 0.0–8.7 mm for the head and 0.0–6.5 mm for the pelvis). »
* **Portée et limites :** Cette concordance de 2,2 mm a été mesurée dans des conditions strictes d'enregistrement (trot en ligne droite en main, caméra orthogonale à hauteur standardisée, opérateur fixe, fond dégagé). Elle ne s'applique pas directement à des vidéos récréatives prises sous des angles obliques ou avec une caméra en mouvement.

---

## 4. Recommandations Architecturales pour WorkoutVision

1. **Aucun diagnostic clinique automatisé :** La détection d'une boiterie relève de l'exercice vétérinaire. L'application ne doit jamais formuler de verdict diagnostique du type *"Cheval à 97 % sain"* ou *"Boiterie antérieure gauche détectée"*.
2. **Distinction anatomique rigoureuse :** Les points clés prédits par les modèles de vision généralistes comme AP-10K (`neck`, `tail_root`) ne doivent jamais être présentés comme le garrot ou le tuber sacrale sans validation géométrique explicite.
3. **Piste d'implémentation future :** Si une fonctionnalité équine est envisagée, elle requiert un modèle spécifiquement entraîné sur des repères anatomiques vétérinaires (garrot, tubérosité sacrale, couronne du sabot) et un protocole de cadrage strict (trépied fixe, vue orthogonale à 90°, trot en ligne droite en main).
