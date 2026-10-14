# WorkoutVision Demo Video Renderer

Ce dossier contient les outils d'extraction cinématique hors-ligne et de rendu vidéo pour les démonstrations biomécaniques de WorkoutVision.

---

## 1. Principes et Contraintes Strictes

1. **Aucun repère synthétique ou flottant :** Le squelette est tracé directement à partir des coordonnées réelles calculées image par image par MediaPipe Pose Landmarker en mode `VIDEO`.
2. **Plancher de visibilité à 0,5 :** Un segment (os) ou un point articulaire n'est rendu que si la confiance de visibilité (`visibility`) est d'au moins **0,50** (le seuil de sécurité de l'application). Aucun point occlus ou interpolé artificiellement n'est dessiné.
3. **Séparation stricte rendu / mesure :** Le script de rendu `render.py` ne calcule aucun chiffre, ne pose aucun diagnostic et n'embarque aucun texte en dur. Tous les bandeaux, labels, valeurs, marges d'erreur et motifs de refus proviennent exclusivement du fichier de mesures JSON rédigé par Claude.
4. **Charte visuelle fidèle à l'application :** Tracés fins, cartouche sombre semi-transparente en bas de cadre (`rgba(12, 14, 18, 0.88)`), typographie lisible sur écran de smartphone (390 px de large), aucun bandeau HUD agressif, aucune mention fallacieuse ("AI", "Neural Cloud", "GDPR Equine").

---

## 2. Installation de l'Environnement

Conformément au protocole de non-interférence, aucun paquet npm n'est installé dans le projet. L'exécution Python s'effectue dans l'environnement virtuel dédié :

```bash
# Activation de l'environnement externe
source ~/wv-tools/.venv/bin/activate

# Installation des dépendances
pip install -r scripts/demo-render/requirements.txt
```

### Dépendances requises :
* `opencv-python-headless` (I/O vidéo)
* `numpy` (calculs matriciels et normalisation)
* `Pillow` (composition graphique et typographie anti-aliasée)
* `mediapipe >= 0.10.0` (Pose Landmarker en mode VIDEO)
* `ffmpeg` (encodage final H.264 / yuv420p / faststart)

---

## 3. Guide d'Exécution

### Étape 1 : Extraction des Points Clés MediaPipe (Hors-Ligne)
L'extraction s'appuie sur le modèle officiel servi par l'application :
`public/mediapipe/pose_landmarker_full.task` (lu en lecture seule).

```bash
# Exemple d'extraction en mode VIDEO
python3 -c "
import cv2, json, mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

base_options = python.BaseOptions(model_asset_path='public/mediapipe/pose_landmarker_full.task')
options = vision.PoseLandmarkerOptions(
    base_options=base_options,
    running_mode=vision.RunningMode.VIDEO,
    num_poses=1
)
# Traitement de chaque frame avec t_ms croissant...
"
```
Les fichiers de points clés sont enregistrés dans :
`data/demo-v2/landmarks/<clip_id>.json`

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
* Si `value` est `null` et `refused` est renseigné : affiche le texte de refus en couleur ambre.
* Si `value` et `margin` sont présents : affiche `"value ± margin unit"`.
* Met en surbrillance (cercle or) exclusivement les articulations listées dans `joint`.

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
      "joint": [11, 12, 23, 24],
      "frames": [
        { "t_ms": 0, "value": 0, "margin": 0, "refused": null },
        { "t_ms": 2000, "value": null, "margin": null, "refused": "TOP OCCLUDED" }
      ]
    }
  ]
}
```

---

## 5. Table de Couverture du Suivi Articulaire (Tracking Coverage)

La couverture mesure la proportion d'images où **l'ensemble des 12 articulations majeures du corps** (épaules, coudes, poignets, hanches, genoux et chevilles bilatérales) présentent une confiance de visibilité $\ge 0{,}50$ :

| Séquence Vidéo | Vue de caméra | Fréquence & Durée | Total Frames | Couverture intégrale des 12 articulations majeures ($\text{vis} \ge 0{,}5$) | Explication biomécanique des occlusions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`golf_full_swing_dtl_16632575`** | Down-The-Line (DTL) | 60.00 fps / 5,30 s | 318 frames | **28,9 %** (92 / 318) | En vue DTL, le bras et le poignet arrière sont masqués par le buste au sommet du backswing et au finish. MediaPipe abaisse fidèlement la visibilité sous 0,5 sans hallucination. |
| **`golf_full_swing_face_on_14980434`** | Face-On (Face) | 29.97 fps / 6,01 s | 180 frames | **47,2 %** (85 / 180) | En vue de face, le croisement des bras à l'impact et au sommet réduit transitoirement la visibilité du coude/poignet arrière. |
