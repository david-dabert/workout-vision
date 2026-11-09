# Reverse Engineering : Le Moteur Visuel d'Exercices de Strava

> **Objectif Stratégique — David Dabert (9 Novembre 2026)**  
> *« Rétro-ingénierie de Strava : ils ont des visuels remarquables qui montrent exactement aux utilisateurs comment exécuter un mouvement. Analyser leur psychologie visuelle, leur moteur cinématique et l'intégrer à WorkoutVision. »*

---

## 1. Déconstruction du Moteur Visuel de Strava & Recover Athletics

Lorsque Strava a racheté *Recover Athletics* et intégré ses modules de préparation physique, renforcement et mobilité pour coureurs et cyclistes, ils ont résolu un problème fondamental : **comment enseigner un mouvement complexe sur un écran de smartphone en moins de 3 secondes sans faire lire un pavé de texte ?**

Leur système repose sur 4 piliers visuels fondamentaux :

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ANATOMIE VISUELLE STRAVA                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   1. AVATAR VECTORIEL ÉPURÉ (60 FPS)                                  │
│      Silhouette sombre sur fond neutre. Zéro vidéo 4K de 50 Mo.        │
│      Rendu instantané même avec une mauvaise connexion 4G.             │
│                                                                        │
│   2. HIÉRARCHIE CHROMATIQUE (CODE COULEUR STRAVA)                      │
│      • Orange Néon (#FC4C02) : L'articulation motrice principale.       │
│      • Ambre atténué : Les muscles stabilisateurs secondaires.         │
│      • Ardoise / Cendre : Le reste du corps (neutre, immobile).        │
│                                                                        │
│   3. L'ARC DE TRAJECTOIRE FANTÔME (GHOST PATH)                         │
│      Une courbe lumineuse semi-transparente qui trace la trajectoire    │
│      idéale (bar path ou déplacement de l'articulation).               │
│                                                                        │
│   4. BASCULE « BIEN FAIT » VS « ERREUR CLASSIQUE » (DO VS DON'T)       │
│      Un toggle visuel instantané qui montre en 1 seconde le bon        │
│      alignement (vert) opposé au piège biomécanique fréquent (rouge).   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Les 4 Mécaniques Clés à Transposer dans WorkoutVision

### Mécanique 1 : L'Articulation Motrice Lumineuse
Sur une élévation latérale ou un curl biceps :
* **Dans WorkoutVision aujourd'hui** : Tout le squelette est rendu avec la même couleur uniforme de particules.
* **Le modèle Strava** :
  * Pour le **Squat** : Le bassin et les genoux s'illuminent en accent vif (orange/or), tandis que les bras et le cou restent en cendre sombre.
  * Pour le **Curl biceps** : Seul le coude et l'avant-bras sont mis en surbrillance dynamique proportionnelle à la flexion.
* **Gain psychologique** : L'œil du sportif comprend instantanément où doit se porter son attention motrice.

### Mécanique 2 : L'Arc de Trajectoire Fantôme (Ghost Arc)
Au lieu d'attendre la fin de la vidéo pour voir la vitesse :
* Une fine traînée lumineuse vectorielle dessine la courbe de déplacement de la barre ou de la main entre la position basse (*rest*) et la position haute (*top*).
* Si la trajectoire dévie vers l'avant (ex: coude qui avance au curl pour tricher avec le deltoïde antérieur), la traînée devient rouge orangé.

### Mécanique 3 : La Comparaison Instantanée « Bonne Forme » vs « Erreur Typique »
Une image animée vaut 1 000 mots d'explication textuelle. Pour chaque exercice :

| Exercice | Bonne Exécution (Modèle Idéal) | Erreur Typique à Éviter (Alerte Visuelle) |
|---|---|---|
| **Squat** | Dos neutre, genoux alignés sur les pointes de pied | **Valgus dynamique** (genoux qui rentrent vers l'intérieur) et **Butt Wink** |
| **Curl Biceps** | Coudes verrouillés le long des côtes | **Élan du buste** (balancier lombaire et coudes projetés en avant) |
| **Soulevé de Terre (RDL)** | Charnière de hanche pure, colonne droite | **Dos rond (flexion lombaire)** et barre éloignée des tibias |
| **Élévations Latérales** | Bras dans le plan scapulaire (30° en avant) | **Haubans trapéziens** (épaules haussées jusqu'aux oreilles) |
| **Développé Couché** | Trajectoire en arc régulier vers le sternum | **Coudes ouverts à 90°** (conflit sous-acromial de l'épaule) |

### Mécanique 4 : Le Système de Micro-Cues en 3 Mots (Pas de Pavé de Texte)
Strava brosse 3 consignes ultra-courtes qui se mémorisent en un coup d'œil avant d'appuyer sur Enregistrer :
1. **Placement** : *« Pieds vissés au sol »*
2. **Phase Excentrique** : *« Descente en 2 secondes »*
3. **Verrouillage** : *« Pousse sur les talons, expire »*

---

## 3. Implémentation & État Réel des Visuels d'Exercices dans WorkoutVision

Contrairement aux idées reçues ou aux estimations approximatives, **l'intégralité du catalogue d'exercices (309/309) possède déjà ses animations dans WorkoutVision** :

1. **Les 309 Boucles d'Animation Vectorielles (60 FPS, Squelettes 33 Points)** :
   * **9 mouvements cardinaux** dans `src/components/experience/lift-poses.json` (les cartes principales : squat, bench, RDL, bicep curl, lateral raise, etc.).
   * **300 mouvements du guide** dans `src/components/experience/guide-poses.json` (générés rigoureusement par `scripts/make-guide-figures.mjs`).
   * Ces 300 figures sont chargées à la demande par import dynamique (`import('./guide-poses.json')` dans `guide-figure.js`), ce qui maintient le bundle initial sous la barre stricte des 150 kB.
2. **Les 306 Décompositions Visuelles Pas-à-Pas (WebP)** :
   * Chaque dossier dans `public/guide/<exercice>/` contient 3 images WebP haute définition (`frame-1.webp`, `frame-2.webp`, `frame-3.webp`) montrant le début, l'inflexion et la fin du geste.
3. **Le Moteur Canvas Strava-Ready (`src/components/experience/lift-scenes.js`)** :
   * Les fonctions `lerpPose()` et `mapPose()` interpolent déjà à 60 fps sans consommer de mémoire sur iPhone Safari.
   * Il suffit d'activer la surbrillance dynamique sur les repères moteurs (`highlightJoints`) pour obtenir l'effet néon Strava sur les 309 exercices du catalogue.
4. **Poids et Budget Mémoire (< 150 kB)** :
   * Là où Strava ou d'autres applications téléchargent des vidéos MP4 de plusieurs mégaoctets qui saturent la 4G et font chauffer l'iPhone, notre encodage base-36 compresse un cycle de 48 poses en moins de 2 kilo-octets par exercice.
