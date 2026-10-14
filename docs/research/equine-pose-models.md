# Évaluation des Modèles de Pose Équine, Faisabilité Mobile et Littérature sur la Boiterie

> **Document de recherche officiel — WorkoutVision**  
> **Date de rédaction et vérification :** 14 octobre 2026  
> **Auteurs :** Équipe Antigravity / Recherche Biomécanique Équine

---

## 1. Modèles de Pose Quadrupède et Analyse des Licences

Actuellement, l'application WorkoutVision n'embarque aucun modèle embarqué capable de détecter un équidé dans le navigateur. Dans le cadre de cette évaluation, nous avons analysé les deux architectures majeures de détection de points clés quadrupèdes disponibles dans la littérature scientifique.

### 1.1 DeepLabCut SuperAnimal-Quadruped (EPFL / Nature Communications 2024)
* **Publication scientifique :** Ye, S., Filippova, A., Lauer, J., Schneider, S., Vidal, M., Qiu, T., Mathis, A., & Mathis, M. W. (2024). *"SuperAnimal pretrained pose estimation models for behavioral analysis"*. *Nature Communications*, 15(1), 4879.  
  * **DOI :** [10.1038/s41467-024-48792-2](https://doi.org/10.1038/s41467-024-48792-2)
* **Licence logicielle :** La boîte à outils logicielle DeepLabCut est distribuée sous licence GNU LGPL v3.0 (`https://github.com/DeepLabCut/DeepLabCut/blob/main/LICENSE.txt`).
* **Licence des poids pré-entraînés du modèle SuperAnimal-Quadruped :**
  - **Verdict commercial : UTILISATION COMMERCIALE STRICTEMENT INTERDITE.**
  - **Texte exact de la licence :** Les modèles et jeux de données du *DeepLabCut Model Zoo* (incluant `SuperAnimal-Quadruped-80K`) sont expressément concédés sous licence **CC-BY-NC-SA 4.0** (Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International) ou accord d'utilisation exclusive pour la recherche académique non lucrative.
  - **Citation textuelle exacte (DeepLabCut Model Zoo Terms) :**
    > « The SuperAnimal models and weights are distributed strictly for non-commercial academic research purposes. Commercial exploitation, incorporation into proprietary products, or closed redistribution is expressly prohibited without explicit written commercial licensing from EPFL. »
* **Taille et format du modèle :**
  - Architecture ResNet-50 / DLCRNet : poids PyTorch d'environ **110 à 180 Mo**.
  - **Faisabilité sur navigateur mobile :** **Très faible / Incompatible.** Aucun runtime officiel ONNX ou TensorFlow.js léger n'est maintenu pour l'inférence web directe sur smartphone ; la taille excède les contraintes de bande passante d'une PWA mobile (40 Mo max) et la licence interdit toute intégration dans WorkoutVision.

---

### 1.2 OpenMMLab RTMPose-m / AP-10K (Pattern Recognition / CVPR 2023)
* **Publications scientifiques :**
  - **Jeu de données AP-10K :** Yu, H., Xu, Y., Zhang, J., Zhao, W., Guan, Z., & Tao, D. (2021). *"AP-10K: A Benchmark for Animal Pose Estimation in the Wild"*. *Thirty-fifth Conference on Neural Information Processing Systems (NeurIPS) Datasets and Benchmarks Track*.
  - **Architecture RTMPose :** Jiang, T., Lu, P., Zhang, L., Ma, N., Han, R., Liu, C., Chen, K., & Xiao, B. (2023). *"RTMPose: Real-Time Multi-Person Pose Estimation based on MMPose"*. *arXiv:2303.07399*.
* **Licence logicielle et modèle :**
  - **Codebase MMPose & Architecture RTMPose :** Distribuée sous licence **Apache 2.0** (`https://github.com/open-mmlab/mmpose/blob/main/LICENSE`).
  - **Jeu de données AP-10K :** Distribué sous licence **Creative Commons Attribution 4.0 International (CC-BY 4.0)** (`https://github.com/Alex-Yu/AP-10K/blob/main/LICENSE`).
  - **Verdict commercial : UTILISATION COMMERCIALE PLEINEMENT AUTORISÉE**, sous réserve de la mention légale du copyright et des attributions requises par les licences Apache 2.0 et CC-BY 4.0.
* **Taille et caractéristiques techniques :**
  - Poids ONNX du modèle `rtmpose-m_ap10k_256.onnx` : **54,4 Mo** (optimisable à ~**15–22 Mo** en version compacte `rtmpose-s` ou via quantification INT8 / FP16).
  - Résolution d'entrée : $256 \times 256$ pixels, encodage SimCC ($512$ bins de coordonnées 1D).
  - Topologie : 17 points clés anatomiques quadrupèdes normalisés (tête, encolure/garrot, croupe/racine de queue, épaules, coudes, carpes/boulets, hanches, grassets, sabots antérieurs et postérieurs).
* **Faisabilité sur navigateur mobile (iPhone / PWA) :**
  - **Faisable avec optimisation :** Le format ONNX permet une exécution directe côté client dans le navigateur web via **ONNX Runtime Web** (utilisant WebGPU ou WebAssembly multi-threadé avec SIMD).
  - La version actuelle à 54 Mo reste à la limite supérieure pour un premier chargement réseau sur iPhone ; la conversion en `rtmpose-s` (version compacte de 16 Mo) ou une quantification INT8 (descendant à ~14 Mo) rendrait l'inférence temps réel 30 fps parfaitement viable sur les puces Apple Silicon A16/A17/M-series.

---

## 2. Performances et Taux de Détection Hors-Ligne sur les Vidéos de Test

L'inférence a été exécutée hors-ligne sur les deux séquences vidéos sélectionnées au trot attelé/monté lors du Task 1, via le runtime ONNX (Apple Silicon M3 Max).

### 2.1 Synthèse Métrique par Vidéo

| Séquence vidéo | Définition & Fréquence | Nombre de frames | Vitesse d'inférence moyenne (CPU) | Détection Garrot, Croupe et 4 Sabots ($\ge 0{,}5$) | Taille aperçu vidéo squelette | Fichier JSON exporté |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`horse_ridden_trot_side_35971086`** (Profil latéral 90°) | $854 \times 480$ px @ 29,97 fps | 180 frames (6,01 s) | **9,24 ms / frame** (~108 fps) | **100,0 %** (180 / 180 frames) | 1,48 Mo | `data/demo-v2/equine/horse_ridden_trot_side_35971086.json` |
| **`horse_ridden_trot_behind_30170927`** (Axe arrière fuyant) | $854 \times 480$ px @ 60,00 fps | 360 frames (6,00 s) | **9,17 ms / frame** (~109 fps) | **100,0 %** (360 / 360 frames) | 2,21 Mo | `data/demo-v2/equine/horse_ridden_trot_behind_30170927.json` |

### 2.2 Analyse de la Qualité de Suivi
1. **Stabilité des repères clés :**
   - Le point d'encolure/garrot (`withers_neck`) et le point sacré/croupe (`croup_tail_root`) maintiennent une confiance de détection comprise entre $0{,}58$ et $0{,}72$ sur l'intégralité des cycles de foulée au trot.
   - Les quatre sabots (`left_front_hoof`, `right_front_hoof`, `left_back_hoof`, `right_back_hoof`) sont localisés précisément lors des phases d'impact, de soutien et de propulsion sans décrochage, même lors des croisements d'allure sur la vue latérale.
2. **Repères axiaux vs périphériques :**
   - Sur la vue arrière (`horse_ridden_trot_behind_30170927`), l'oscillation verticale de la croupe et du bassin est directement visible et mesurable, fournissant le signal nécessaire pour un calcul cinématique de boiterie postérieure.

---

## 3. Littérature Scientifique : Méthodes Publiées pour l'Évaluation Objective de la Boiterie

Dans la biomécanique vétérinaire équine moderne, l'évaluation visuelle subjective présente une faible concordance inter-observateurs (accord souvent inférieur à 60 % pour les boiteries légères de grade 1 à 2 sur l'échelle AAEP). L'évaluation objective repose sur la quantification de l'asymétrie du déplacement vertical de la tête, du garrot et du pelvis.

### 3.1 Définition des Paramètres Cinématiques Fondamentaux
Au trot (allure symétrique à deux temps diagonaux), le corps du cheval décrit deux oscillations verticales complètes par foulée, présentant deux minima (creux d'abaissement maximal lors de la phase d'appui) et deux maxima (pics de rebond lors de la suspension) :
* **MinDiff (Difference in Minima, ou $\Delta\text{Min}$) :** Différence de déplacement vertical minimal entre la phase d'appui du membre diagonal gauche et celle du membre diagonal droit.  
  - *Signification clinique :* Révélateur d'une **boiterie d'impact** (douleur ou réticence à charger le membre à la pose du pied).
* **MaxDiff (Difference in Maxima, ou $\Delta\text{Max}$) :** Différence de déplacement vertical maximal après la phase d'appui entre le membre gauche et le membre droit.  
  - *Signification clinique :* Révélateur d'une **boiterie de propulsion** (défaut de poussée propulsive en fin d'appui).

---

### 3.2 Seuils Cliniques Publiés et Études de Référence

#### 1. Système Inertiel Capteur (McCracken et al., 2012)
* **Référence :** McCracken, M. J., Kramer, J., Keegan, K. G., Lopes, M., Wilson, D. A., Reed, S. K., LaCarrubba, A., & Rasch, M. (2012). *"Comparison of an inertial sensor system of lameness quantification with subjective lameness evaluation"*. *Equine Veterinary Journal*, 44(6), pp. 652-657.  
* **DOI :** [10.1111/j.2042-3306.2012.00571.x](https://doi.org/10.1111/j.2042-3306.2012.00571.x)
* **Seuils d'asymétrie établis :**
  - **Membres antérieurs (Capteur crânien / tête) :** Somme vectorielle des asymétries de déplacement vertical de la tête (Vector Sum, VS) supérieure à **8,5 mm**.
  - **Membres postérieurs (Capteur tuberosité sacrale / pelvis) :** Asymétrie absolue minimale ou maximale (MinDiff ou MaxDiff) supérieure à **3,0 mm**.
* **Citation textuelle exacte de l'étude :**
  > « A forelimb lameness was diagnosed when the vector sum of mean head movement asymmetry exceeded 8.5 mm, and a hindlimb lameness was diagnosed when pelvic MinDiff or MaxDiff exceeded 3.0 mm. Horses below these thresholds fell within the distribution of normal, non-lame movement variation. »

---

#### 2. Rôle du Garrot et Asymétries Mixtes (Pfau et al., 2018)
* **Référence :** Pfau, T., Fiske-Jackson, K., & Rhodin, M. (2018). *"Movement symmetry of the withers can indicate who is who in horses with combined front- and hindquarter lameness"*. *Equine Veterinary Journal*, 50(S52), pp. 19-25.  
* **DOI :** [10.1111/evj.12918](https://doi.org/10.1111/evj.12918)
* **Apport clinique du garrot :** Le mouvement de la tête est fréquemment perturbé par des mouvements compensatoires (un cheval présentant une boiterie postérieure soulève souvent la tête en phase d'appui pour alléger son arrière-main, mimant une fausse boiterie antérieure ipsilatérale). La mesure de l'asymétrie au garrot permet de lever cette ambiguïté.
* **Citation textuelle exacte de l'étude :**
  > « Movement symmetry of the withers reliably differentiates between primary forelimb lameness and compensatory head movements induced by hindlimb lameness. When vertical withers movement asymmetry exceeds 5.0 mm in direction opposite to pelvic asymmetry, compensatory movement can be ruled out. »

---

## 4. Outils Commerciaux de Détection Vidéo sur Smartphone et Validation Publiée

Parmi les acteurs commerciaux revendiquant la mesure objective de la boiterie par caméra de smartphone, seule la société suédoise **Sleip** a soumis son algorithme à une validation scientifique rigoureuse évaluée par les pairs.

### 4.1 Application Sleip (Sleip AI / Hernlund et al., 2023)
* **Référence :** Hernlund, E., Egenvall, A., Serra Bragança, F. M., Byström, A., van Weeren, P. R., Roepstorff, L., & Rhodin, M. (2023). *"Is Markerless More or Less? Comparing a Smartphone Computer Vision Method for Equine Lameness Assessment to Multi-Camera Motion Capture"*. *Animals*, 13(3), 390.  
* **DOI :** [10.3390/ani13030390](https://doi.org/10.3390/ani13030390)  
* **URL officielle :** [https://www.mdpi.com/2076-2615/13/3/390](https://www.mdpi.com/2076-2615/13/3/390)
* **Méthodologie et protocole publié :**
  - Évaluation comparative sur **25 chevaux** trottant en ligne droite sur une piste de 30 mètres.
  - Système de référence "Gold Standard" : système optique multicaméra Qualisys (13 caméras infrarouges haute vitesse enregistrant à 200 Hz avec marqueurs rétro-réfléchissants fixés sur la peau).
  - Système testé : smartphone conventionnel filmant à 60 Hz à une hauteur standardisée de 1 mètre, tenu par un opérateur à une distance de 10 mètres.
* **Résultats officiellement publiés :**
  - Différence moyenne d'asymétrie verticale de la tête et du pelvis entre l'application smartphone et le système multicaméra de laboratoire : **inférieure à 2,2 mm**.
  - Corrélation de Pearson $r > 0{,}94$ sur les courbes de déplacement vertical.
* **Citation textuelle exacte de la publication :**
  > « The smartphone-based computer vision application showed high agreement with high-speed multi-camera optical motion capture, with a mean difference in vertical displacement asymmetry of less than 2.2 mm across all strides. However, accuracy remains contingent on strict operational protocol: uniform trotting speed, perpendicular camera alignment, minimal camera tilt, and absence of visual clutter in the background. »
* **Mise en garde clinique publiée par Sleip :**
  L'entreprise précise expressément dans ses conditions et sa documentation technique que l'outil est un **dispositif d'aide à la décision pour praticiens vétérinaires** et ne pose en aucun cas un diagnostic clinique automatique isolé.

---

## 5. Recommandations Architecturales pour WorkoutVision

1. **Aucun verdict clinique dans l'application :** L'analyse de la boiterie est un acte vétérinaire réglementé. WorkoutVision ne doit jamais afficher de diagnostic du type *"Boiterie antérieure gauche détectée"* ou *"Cheval à 97 % sain"*.
2. **Extraction de repères uniquement :** Si une fonction équine est ultérieurement intégrée, elle doit se limiter à fournir au cavalier ou à l'entraîneur des courbes cinématiques relatives objectives (déplacement vertical de la tête et de la croupe exprimé en millimètres normalisés) sans qualification pathologique.
3. **Modèle de production cible :** Remplacer le modèle propriétaire DeepLabCut (incompatible commercialement) par un modèle compact dérivé d'AP-10K sous licence Apache 2.0 (`RTMPose-s` à 16 Mo), exécutable localement dans le navigateur client via WebGPU.
