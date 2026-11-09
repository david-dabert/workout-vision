# Synthèse Stratégique & Clinique : Entretien avec Monsieur Lamine

> **Participants** : David Dabert (Fondateur WorkoutVision) & Monsieur Lamine (Masseur-Kinésithérapeute, Enseignant Universitaire)  
> **Date de l'échange** : 9 Novembre 2026  
> **Statut** : Document de référence produit & feuille de route clinique (Client Zéro).

---

## 1. Les Deux Attentes Majeures Exprimées par Monsieur Lamine

Lors de l'échange, Monsieur Lamine a identifié les deux verrous fondamentaux de la prise en charge kinésithérapique moderne :

```
┌────────────────────────────────────────────────────────────────────────┐
│            LES DEUX VERROUS IDENTIFIÉS PAR MONSIEUR LAMINE             │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   1. UN OUTIL DIAGNOSTIQUE « NON OPÉRATEUR-DÉPENDANT »                │
│      Aujourd'hui, si un kiné réalise un test manuel et que son collègue│
│      (ex: Christophe) passe derrière, la variabilité inter-évaluateur │
│      est trop forte. Un test opérateur-dépendant n'est pas scientifique│
│                                                                        │
│   2. RÉSOUDRE LE TROU NOIR DE L'OBSERVANCE À DOMICILE                  │
│      Le kiné prescrit des exercices à faire chez soi, mais n'a aucune  │
│      visibilité sur ce qui se passe réellement. La courbe de Gauss     │
│      montre que 80% des patients abandonnent ou trichent.              │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pilier 1 : La Mesure « Non Opérateur-Dépendante »

* **Le constat de Monsieur Lamine** :  
  *« Si moi je fais le test avec l'appareil et que mon collègue passe derrière... il ne faut pas qu'il y ait trop d'écart entre les deux. Certains tests cliniques sont opérateur-dépendants : moi je dis positif, l'autre derrière dit négatif... c'est pas valable du tout. »*
* **La réponse technique de WorkoutVision** :  
  * Le smartphone posé à hauteur fixe élimine totalement le biais de palpation ou d'appréciation humaine.
  * Les algorithmes de vision MediaPipe Pose extraient les 33 coordonnées anatomiques à 60 Hz avec une répétabilité géométrique absolue.
  * Que le test soit initié par Monsieur Lamine, son interne ou son collègue, les angles articulaires et le ratio de tassement acromial sont strictement identiques.

---

## 3. Pilier 2 : L'Observance à Domicile (« Keep Them Honest »)

* **Le constat de Monsieur Lamine** :  
  *« Vous n'avez pas de vue de ce qui se passe à la maison. On ne sait pas déjà s'ils se rappellent des exercices, on ne sait pas si on est dans la bonne amplitude, avec quelle intensité... l'observance dans ces cas-là est très mauvaise. »*
* **La réponse WorkoutVision : Le Double Bilan (Quantitatif + Qualitatif)** :
  1. **Volet Quantitatif** :
     * Horodatage cryptographique local de chaque session (nombre de séries réelles, jours d'entraînement effectifs).
     * Fin du simple déclaratif : le kiné sait exactement si le patient a fait sa séance.
  2. **Volet Qualitatif (Le Geste Beau et Contrôlé)** :
     * Amplitude articulaire réelle atteinte (ROM en degrés).
     * Détection des tricheries motrices (haussement du trapèze avant 60°, compensation du tronc).
     * Score de fluidité spectrale (SPARC).

---

## 4. Pilier 3 : La Révolution du Côté Sain comme Référence Miroir (L'Idée de David)

C'est l'apport conceptuel déterminant de l'échange :
* **L'approche classique (incomplète)** : Comparer le patient à un modèle générique ou à la vidéo du kiné. Problème : chaque morphologie est unique, et le kiné n'a pas la même souplesse que le patient.
* **L'approche WorkoutVision (Idée de David validée par Monsieur Lamine)** :
  * Le patient a presque toujours un côté sain et un côté lésé.
  * Le patient filme d'abord son **côté sain**.
  * Notre moteur (`src/lib/kine/mirrorReference.ts`) applique une symétrie axiale par rapport au plan sagittal et inverse les repères gauche/droite.
  * **Le patient devient son propre étalon anatomique** : son avatar de référence possède exactement la longueur de ses segments osseux et son amplitude physiologique naturelle !

---

## 5. Pilier 4 : L'Objectif Thérapeutique du Limb Symmetry Index (95% à 105%)

* **Le consensus de rééducation** :
  * Point de départ post-lésionnel : le côté pathologique est souvent à **50% - 60%** du côté sain.
  * Cible de récupération (LSI) : **95% à 105%** de l'amplitude et de la force du côté sain.
  * Au-delà de 105% : détection de surcompensation vicariante.
* **Mise en application dans WorkoutVision** :
  * La fonction `computeLsiProgress()` suit la trajectoire de récupération session après session et affiche la courbe de progression jusqu'au palier des 100%.

---

## 6. Pilier 5 : Groupes Homogènes de Patients (GHP)

Pour éviter que l'outil « parte dans tous les sens » comme l'a sagement souligné Monsieur Lamine, nous modélisons 3 profils cliniques homogènes :

| Profil Clinique Homogène | Pathologies Types | Objectif Cinématique Prioritaire |
|---|---|---|
| **Profil 1 : Réparation de Coiffe Post-Opératoire** | Rupture ou suture du supra-épineux | Contrôle strict du Shrug Sign (<20%) et montée progressive de 90° à 160° |
| **Profil 2 : Enraidissement Capsulaire** | Capsulite rétractile, raideur post-traumatique | Restauration de la rotation externe coude au corps et symétrie LSI >95% |
| **Profil 3 : Épaule Sportive / Conflit Antéro-Supérieur** | Sportifs overhead (tennis, volley, hand), instabilité | Contrôle excentrique fluide entre 120° et 60° (Scapular Dyskinesis Test) |

---

## 7. Pilier 6 : Conformité Totale RGPD & Secret Médical

Monsieur Lamine et David ont tous deux insisté sur la stricte régulation des données de santé :
* **Zéro flux vidéo sur serveur tiers** : Tout le pipeline d'intelligence artificielle (MediaPipe, WebAssembly, WebGPU) s'exécute localement sur la puce du smartphone.
* **Architecture Zero-Knowledge** : Les vidéos restent sur le téléphone du patient. Seuls les indices angulaires (scalaires chiffrés) voyagent dans le lien chiffré du programme partagé avec le praticien.
* Respect absolu des normes CNIL et du secret professionnel médical.
