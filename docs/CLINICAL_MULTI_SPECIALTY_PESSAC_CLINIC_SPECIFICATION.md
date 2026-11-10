# Dossier Clinique & Scientifique : Bilan Cinématique Multi-Spécialités pour la Clinique de Kinésithérapie de Pessac

> **Destinataires** : David Dabert, Monsieur Lamine, et le collège des spécialistes kinésithérapeutes de la clinique de Pessac  
> **Auteur** : Département Recherche Biomécanique & Rééducation WorkoutVision  
> **Date** : 10 Novembre 2026  
> **Objet** : Déploiement de l'évaluation cinématique optique sur smartphone pour l'ensemble des pôles spécialisés (Genou, Rachis Lombaire, Hanche, Cheville, Rachis Cervical).  
> **Conformité** : Zéro tiret cadratin, typographie française (\u00A0:), 100% calcul local sur smartphone sans transfert d'images.

---

## 1. Vision Stratégique pour la Clinique de Pessac

La clinique de rééducation de Pessac rassemble des praticiens de pointe organisés par pôles d'expertise anatomique. Tout comme le pôle Épaule a bénéficié d'une modélisation objective de la dyskinésie scapulaire (signe du haussement, lâchage excentrique, indice SPARC), chaque pôle spécialisé de la clinique doit disposer de ses outils d'objectivation cinématique immédiats sur smartphone.

L'objectif partagé avec Lamine est de fournir à chaque confrère spécialiste un **tableau de bord clinique opposable** qui :
1. Mesure les déficits articulaires et musculaires en moins de 15 secondes sans capteur externe.
2. Établit le score de symétrie bilatérale (*Limb Symmetry Index* - LSI) indispensable aux critères de retour au sport (*Return to Play*).
3. Quantifie l'adhésion et la qualité d'exécution des exercices prescrits à domicile.
4. Génère des comptes-rendus PDF aux normes de la Haute Autorité de Santé (HAS) valorisant l'expertise du cabinet.

---

## 2. Pôle Genou & Rééducation LCA / Fémoro-Patellaire

### 2.1 Problématique Clinique
Le suivi des ruptures du ligament croisé antérieur (LCA) et des syndromes fémoro-patellaires (SFP) souffre du manque d'outils de terrain pour quantifier le **valgus dynamique** et le **déficit d'extension terminale** (flessum résiduel), premier facteur d'arthrose fémoro-tibiale précoce (Shelbourne et al., 2012).

### 2.2 Chaîne de Déduction Optique
À partir des repères 3D hanche (23/24), genou (25/26) et cheville (27/28) :
* **Angle de Valgus Dynamique ($\theta_{\text{valgus}}$)** : Projection frontale de l'axe fémoro-tibial lors de l'amorti du saut ou du *Single-Leg Squat*.
  $$\theta_{\text{valgus}} = 180^\circ - \arccos\left(\frac{\vec{u}_{\text{fémur}} \cdot \vec{u}_{\text{tibia}}}{\|\vec{u}_{\text{fémur}}\| \|\vec{u}_{\text{tibia}}\|}\right)$$
  * *Seuil critique d'alerte* : Déviation médiale $> 8^\circ$ par rapport à l'axe neutre (Hewett et al., 2005, *Am J Sports Med*).
* **Indice de Symétrie Membre Inférieur (LSI Genou)** :
  $$\text{LSI}_{\text{extension}} = \frac{\text{ROM}_{\text{opéré}}}{\text{ROM}_{\text{sain}}} \times 100$$
  * *Critère HAS de reprise de course* : $\text{LSI} \ge 90\%$ avec flessum résiduel $< 2^\circ$.

---

## 3. Pôle Rachis Lombaire & Pelvis (Lombalgies, Hernies & McKenzie)

### 3.1 Problématique Clinique
Dans la prise en charge des lombalgies chroniques et des sciatalgies, la dissociation lombo-pelvienne est le pivot de la méthode McKenzie et de la stabilisation de McGill. L'œil humain ne peut isoler la part de courbure lombaire de la flexion de hanche lors du ramassage d'une charge.

### 3.2 Chaîne de Déduction Optique
À partir de la ligne acromiale (11/12), du grand trochanter (23/24) et de la tubérosité tibiale (25/26) :
* **Ratio de Rythme Lombo-Pelvien ($\text{LPR}$)** :
  $$\text{LPR} = \frac{\Delta\theta_{\text{rachis}}}{\Delta\theta_{\text{bassin}}}$$
  * Une inversion précoce du ratio ($\text{LPR} > 1.8$ dans les premiers $40^\circ$ de flexion) révèle un verrouillage pelvien réflexe et un cisaillement vertébral L4-L5/L5-S1 destructeur.
* **Signe de Trendelenburg Optique (Faiblesse du Moyen Fessier)** :
  Dévers de la ligne des hanches sur appui monopodal.
  * *Alerte* : Chute de l'hémibassin controlatéral $> 4^\circ$ pendant la station unipodale de 10 secondes.

---

## 4. Pôle Hanche & Conflit Fémoro-Acétabulaire (CFA)

### 4.1 Problématique Clinique
Le conflit fémoro-acétabulaire (effet Came ou Tenaille) provoque une limitation douloureuse précoce de la rotation interne et de la flexion, fréquemment compensée par une antéversion du bassin ou une hyperlordose de compensation (Philippon et al., 2007).

### 4.2 Chaîne de Déduction Optique
* **Test FADIR Optique (Flexion-Adduction-Rotation Interne)** :
  Mesure angulaire en plan transverse lors de la flexion à $90^\circ$.
  * *Alerte* : Restriction bilatérale de rotation interne $> 15^\circ$ ou décrochage de vitesse par évitement de la douleur.
* **Extension de Hanche & Test de Thomas Optique** :
  Mesure de l'angle cuisse-table lors de la rétroflexion controlatérale.
  * *Alerte* : Déficit d'extension $< 0^\circ$ (flexum persistant de hanche), signant la rétraction du psoas-iliaque et du droit fémoral.

---

## 5. Pôle Cheville & Tendon d'Achille (Entorses & Ruptures)

### 5.1 Problématique Clinique
Après entorse de cheville ou chirurgie du tendon calcanéen, le facteur prédictif numéro un de récidive est la perte de flexion dorsale en chaîne fermée (Konor et al., 2012).

### 5.2 Chaîne de Déduction Optique
* **Weight-Bearing Lunge Test (WBLT)** :
  Le patient avance le genou vers un repère vertical en fente avant sans décoller le talon.
  $$\text{Angle DF} = 90^\circ - \text{Angle Tibia/Sol}$$
  * *Norme clinique fonctionnelle* : $\ge 35^\circ$ (équivalent à 10 cm mur-orteil). Une asymétrie $> 5^\circ$ contre-indique la reprise des sauts et des changements de direction.
* **Endurance et Hauteur du Heel-Rise Test** :
  Comptage automatique des montées sur pointes avec mesure de la hauteur d'élévation du calcanéum à chaque répétition.
  * *Alerte* : Fatigue prématurée avec chute de hauteur $> 25\%$ avant la 20e répétition.

---

## 6. Pôle Rachis Cervical & Céphalées Cervicogéniques

### 6.1 Problématique Clinique
La projection antérieure de la tête (*Forward Head Posture*) surcharge les facettes articulaires C1-C2-C3 et le muscle trapèze supérieur, générant céphalées de tension et névralgies d'Arnold.

### 6.2 Chaîne de Déduction Optique
* **Angle Cranio-Vertébral ($\text{CVA}$)** :
  Angle formé entre la droite tragus-C7 et l'horizontale passant par C7.
  * *Norme clinique* : $\text{CVA} \ge 50^\circ$. Un angle $< 45^\circ$ signe une projection majeure avec doublement des contraintes mécaniques sur le rachis cervical inférieur.
* **Symétrie de Rotation Cervicale Active** :
  Évaluation de la cinématique de rotation gauche/droite à vitesse constante.
  * *Alerte* : Différence bilatérale $> 12^\circ$ signant un blocage articulaire C1-C2 ou un spasme unilatéral de l'angulaire de la scapula.

---

## 7. Synthèse : La Boîte à Outils Clinique Clé en Main

| Pôle Pessac | Examen Cinématique WorkoutVision | Norme HAS / Littérature | Alerte Clinique Générée |
|---|---|---|---|
| **Épaule** | Scaption & Indice de Haussement | $\text{HI} < 0.22$, pas de saut excentrique | Dyskinésie Kibler Type I/II, Conflit sous-acromial |
| **Genou** | Valgus dynamique au squat/saut | Déviation médiale $< 8^\circ$, $\text{LSI} \ge 90\%$ | Risque rupture LCA, Syndrome fémoro-patellaire |
| **Lombaire** | Ratio Lombo-Pelvien & Trendelenburg | $\text{LPR} < 1.8$, dévers bassin $< 4^\circ$ | Cisaillement discal L4-S1, Déficit moyen fessier |
| **Hanche** | FADIR & Test de Thomas optique | Rotation interne $\ge 25^\circ$, extension $\ge 10^\circ$ | Conflit Fémoro-Acétabulaire, Rétraction psoas |
| **Cheville** | Weight-Bearing Lunge & Heel-Rise | Flexion dorsale $\ge 35^\circ$, $\text{LSI} \ge 90\%$ | Raideur talo-crurale, Faiblesse triceps sural |
| **Cervical** | Angle Cranio-Vertébral & Rotation | $\text{CVA} \ge 50^\circ$, asymétrie $< 10^\circ$ | Projection céphalique, Dysfonction C1-C2 |

Ce document scientifique sert de base directe aux modules logiciels déployés dans l'espace kiné de l'application.
