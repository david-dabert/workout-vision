# WorkoutVision Demo Video Renderer

Ce dossier contient les outils d'extraction cinématique hors-ligne et de rendu vidéo pour les démonstrations biomécaniques de WorkoutVision.

---

## 1. Principes et Contraintes Strictes

1. **Aucun repère synthétique ou flottant :** Le squelette est tracé directement à partir des coordonnées réelles calculées image par image par MediaPipe Pose Landmarker en mode `VIDEO`.
2. **Plancher de visibilité à 0,5 :** Un segment (os) ou un point articulaire n'est rendu que si la confiance de visibilité (`visibility`) est d'au moins **0,50** (le seuil de sécurité de l'application). Aucun point occlus ou interpolé artificiellement n'est dessiné.
3. **Séparation stricte rendu / mesure :** Le script de rendu `render.py` ne calcule aucun chiffre, ne pose aucun diagnostic et n'embarque aucun texte en dur. Tous les bandeaux, labels, valeurs, marges d'erreur et motifs de refus proviennent exclusivement du fichier de mesures JSON rédigé par Claude.
4. **Charte visuelle fidèle à l'application :** Tracés fins anti-aliasés, cartouche sombre semi-transparente en bas de cadre (`rgba(12, 14, 18, 0.88)`), typographie lisible sur écran de smartphone (390 px de large), préservation de la casse exacte des chaînes, rendu intégral des motifs de refus.

---

## 2. Installation de l'Environnement

L'exécution Python s'effectue dans un environnement virtuel standard :

```bash
# Création et activation de l'environnement virtuel
python3 -m venv .venv
source .venv/bin/activate

# Installation des dépendances
pip install -r scripts/demo-render/requirements.txt
```

### Dépendances requises :
* `opencv-python-headless` (I/O vidéo)
* `numpy` (calculs matriciels et normalisation)
* `Pillow` (composition graphique et typographie anti-aliasée)
* `mediapipe == 1.1.0` (Pose Landmarker en mode VIDEO)
* `ffmpeg` (encodage final H.264 / yuv420p / faststart avec métadonnées BT.709)

---

## 3. Guide d'Exécution

### Étape 1 : Extraction des Points Clés MediaPipe (Hors-Ligne)
L'extraction s'appuie sur le modèle officiel de l'application :
`public/mediapipe/pose_landmarker_full.task` (SHA-256 : `5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1`).

```bash
python3 scripts/demo-render/extract.py \
  --video public/demo/v2/golf/golf_full_swing_dtl_16632575.mp4 \
  --out data/demo-v2/landmarks/golf_full_swing_dtl_16632575.json
```

---

### Étape 2 : Rendu Squelette Seul (Aperçu de Tracking)
Pour valider visuellement la qualité du verrouillage articulaire avant l'intégration des mesures :

```bash
python3 scripts/demo-render/render.py \
  --clip public/demo/v2/golf/golf_full_swing_dtl_16632575.mp4 \
  --landmarks data/demo-v2/landmarks/golf_full_swing_dtl_16632575.json \
  --measures none \
  --out public/demo/v2/golf/golf_full_swing_dtl_16632575-skeleton.mp4
```

---

### Étape 3 : Rendu Complet avec Fiche de Mesures
Lorsque Claude produit le fichier de mesures validé :

```bash
python3 scripts/demo-render/render.py \
  --clip public/demo/v2/golf/golf_full_swing_dtl_16632575.mp4 \
  --landmarks data/demo-v2/landmarks/golf_full_swing_dtl_16632575.json \
  --measures scripts/demo-render/example-golf-dtl.json \
  --out /tmp/golf_dtl_analyzed.mp4
```

---

## 4. Spécification du Fichier de Mesures (JSON)

Claude rédige ces fichiers ; le moteur de rendu applique les règles d'affichage suivantes :
* Si `refused` est une chaîne non vide : affiche l'explication intégrale du refus (ambre), sans jamais afficher de nombre.
* Si `value` et `margin` sont présents : affiche `"value ± margin unit"`, formaté avec le nombre de décimales spécifié dans `decimals` (défaut 0).
* Durée de vie : affiche la mesure de `t_ms` jusqu'au prochain `t_ms` (ou `until_ms`). Ne retient pas la dernière valeur indéfiniment sauf si `until_ms: null` est explicitement spécifié.
* Met en surbrillance (or ambre) exclusivement les articulations listées dans `joint`.
* Ajustement automatique : retour à la ligne et réduction progressive de la police afin qu'aucun texte ne soit tronqué.

```json
{
  "id": "example-golf-dtl",
  "title": "Golf Down-The-Line Swing",
  "subtitle": "Kinematic Sequence Analysis",
  "caption": "Synthetic demonstration template with zeroed values.",
  "badge": "EXAMPLE ONLY",
  "items": [
    {
      "key": "x_factor",
      "label": "X-Factor Separation",
      "unit": "deg",
      "decimals": 1,
      "joint": [11, 12, 23, 24],
      "frames": [
        { "t_ms": 0, "until_ms": 2000, "value": 0, "margin": 0, "refused": null },
        { "t_ms": 2000, "until_ms": 3000, "value": null, "margin": null, "refused": "TOP OCCLUDED" }
      ]
    }
  ]
}
```

---

## 5. Table de Couverture du Suivi Articulaire (Tracking Coverage)

La couverture mesure la proportion d'images où **l'ensemble des 12 articulations majeures du corps** (épaules, coudes, poignets, hanches, genoux et chevilles bilatérales) présentent une confiance de visibilité $\ge 0{,}50$ :

| Séquence Vidéo | Vue de caméra | Fréquence & Durée | Total Frames | Couverture intégrale ($\text{vis} \ge 0{,}5$) | Plages d'images avec articulations majeures occluses |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`golf_full_swing_dtl_16632575`** | Down-The-Line (DTL) | 60.00 fps / 5,30 s | 318 frames | **28,6 %** (91 / 318) | Frames 0 à 192 (0 à 3200 ms), frames 262 à 271 (4367 à 4517 ms), frames 294 à 317 (4900 à 5300 ms). |
