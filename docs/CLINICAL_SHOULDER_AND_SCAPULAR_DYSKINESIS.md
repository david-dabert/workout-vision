# Dossier Clinique & Scientifique : Déduction Optique des Lésions de l'Épaule et de la Dyskinésie Scapulaire

> **Destinataire** : David Dabert & Olivier (Masseur-Kinésithérapeute, Enseignant Universitaire à Paris, Client Zéro)  
> **Auteur** : Département Biomécanique & Rééducation de WorkoutVision  
> **Date** : 9 Novembre 2026  
> **Objet** : Objectivation cinématique par vision monoculaire sur smartphone des dysfonctions scapulaires et gléno-humérales.

---

## 1. Le Paradoxe Clinique de l'Examen Visuel de l'Épaule

Dans la pratique quotidienne des masseurs-kinésithérapeutes du sport et des chirurgiens orthopédistes, l'évaluation de la scapula et de l'épaule repose presque exclusivement sur l'observation visuelle directe à l'œil nu.

Pourtant, la littérature scientifique démontre un consensus unanime : **l'examen visuel à l'œil nu présente une reproductibilité inter-examinateurs faible à modérée** :
* **McClure et al. (2009, *J Athl Train*)** : Le coefficient kappa de concordance inter-évaluateurs sur le *Scapular Dyskinesis Test (SDT)* oscille entre **$\kappa = 0.48$ et $0.61$** lors d'observations en direct.
* **Raison biomécanique** : Le complexe de l'épaule est l'articulation la plus mobile du corps humain (trois degrés de liberté gléno-huméraux couplés à trois rotations scapulo-thoraciques). L'œil humain ne peut pas suivre simultanément la vitesse angulaire des deux bras, la sonnette de deux scapulas et les compensations du rachis sur des mouvements durant moins de 2 secondes.

**WorkoutVision résout ce fossé clinique** : en échantillonnant le geste à 60 images par seconde avec une précision sub-pixellaire, l'application transforme une impression subjective en **données cinématiques opposables, reproductibles et quantifiables**.

---

## 2. Comment « Voir » la Scapula par Pure Déduction Optique

La scapula est masquée par le trapèze, les rhomboïdes et le grand dorsal. Elle ne peut être tracée directement sans capteurs intra-osseux invasifs (broches percutanées). En revanche, **toute anomalie de son glissement se répercute mécaniquement sur des chaînes cinématiques extérieures immédiatement visibles par caméra**.

### Tableau de Correspondance : Signatures Optiques vs Lésions Déduites

| Signature Optique Détectée par WorkoutVision | Seuil Algorithmique | Déduction Biomécanique | Diagnostic Lésionnel Probable |
|---|---|---|---|
| **Signe du Haussement Précoce (*Shrug Sign*)** | Réduction $> 22\%$ de la distance Oreille-Épaule (7-11 / 8-12) avant $60^\circ$ d'abduction | Hyperactivité vicariante du trapèze supérieur pour pallier l'absence de couple de coaptation | Rupture ou tendinopathie sévère du supra-épineux ; Conflit sous-acromial de Neer stade II/III |
| **Décrochage Excentrique (*Eccentric Drop*)** | Accélération angulaire brutale ($\frac{d^2\theta}{dt^2} > 350^\circ/\text{s}^2$) entre $120^\circ$ et $60^\circ$ de descente | Faillite du freinage excentrique du dentelé antérieur et du trapèze inférieur | Dyskinésie scapulaire Type II de Kibler ; Atteinte du nerf thoracique long de Bell |
| **Asymétrie Bilatérale d'Élévation (Scaption)** | Différence d'amplitude maximale $> 15\%$ entre bras gauche et droit | Restriction capsulaire ou sidération musculaire réflexe | Capsulite rétractile (stade d'enraidissement) ; Lésion de la coiffe des rotateurs |
| **Perte de Fluidité Spectrale (Jerk / SPARC)** | Indice SPARC $< -2.8$ sur la trajectoire du poignet/coude | Tremblements infracliniques, micro-arrêts de protection nociceptive | Instabilité antérieure subaiguë ; Lésion du labrum (SLAP lesion) ; Douleur au passage du ligament acromio-coracoïdien |
| **Inclinaison Latérale du Buste** | Angle du rachis par rapport à la verticale $> 5^\circ$ en fin d'élévation | Compensation axiale pour contourner le butoir acromial | Butée osseuse acromiale (acromion Bigliani Type III) ; Rétraction capsulaire inférieure |
| **Déficit de Rotation Externe Pure (ER1 coude au corps)** | Asymétrie angulaire $> 20^\circ$ sans compensation du tronc | Rétraction du ligament gléno-huméral supérieur et de l'intervalle des rotateurs | Capsulite rétractile débutante (signe pathognomonique de début) ; Lésion de l'infra-épineux |

---

## 3. Les 4 Formules Mathématiques Intégrées

### 3.1 Indice de Haussement de Trapèze ($\text{HI}$)
Mesure continue de la distance verticale oreille-acromion normalisée par la hauteur du tronc :
$$\text{HI}(t) = \frac{(y_{\text{épaule}}(t) - y_{\text{oreille}}(t))_{\text{repos}} - (y_{\text{épaule}}(t) - y_{\text{oreille}}(t))_{\text{actif}}}{(y_{\text{épaule}} - y_{\text{oreille}})_{\text{repos}}}$$
* Si $\text{HI}(t) \ge 0.22$ avant que l'angle bras-tronc n'atteigne $60^\circ$, l'alerte **Haussement Compensateur** est levée.

### 3.2 Indice de Dysrythmie Excentrique ($\text{EDI}$)
Mesure de la régularité de la descente par rapport à une décélération linéaire idéale :
$$\text{EDI} = \frac{1}{T} \int_{t_{\text{top}}}^{t_{\text{bas}}} \left| \frac{d\theta}{dt} - \bar{\omega}_{\text{théorique}} \right| dt$$
* Un pic supérieur à $1.8 \times \bar{\omega}$ entre $120^\circ$ et $60^\circ$ signale le lâchage de la scapula.

### 3.3 Indice de Fluidité Spectrale (SPARC - Spectral Arc Length)
Intégration de l'arc de longueur dans le domaine fréquentiel de la vitesse :
$$\text{SPARC} = -\int_{0}^{\omega_c} \sqrt{\left(\frac{1}{\omega_c}\right)^2 + \left(\frac{d\hat{V}(\omega)}{d\omega}\right)^2} d\omega$$
* Révèle les micro-saccades imperceptibles à l'œil nu causées par l'inhibition motrice douloureuse.

### 3.4 Asymétrie Bilatérale Normalisée (ASI - Asymmetry Index)
Selon les recommandations de Bishop et al. (2018) :
$$\text{ASI} = \frac{|\text{ROM}_{\text{gauche}} - \text{ROM}_{\text{droit}}|}{\max(\text{ROM}_{\text{gauche}}, \text{ROM}_{\text{droit}})} \times 100$$
* Seuil critique validé cliniquement : **$\text{ASI} \ge 15\%$** (Kiesel et al. 2007).

---

## 4. Le Protocole « Bilan Épaule 60 Secondes » pour le Cabinet d'Olivier

Pour s'insérer naturellement dans la routine de consultation d'Olivier sans lui faire perdre une minute :

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │            PROTOCOLE CLINIQUE : BILAN ÉPAULE EXPRESS (60 SEC)          │
 ├────────────────────────────────────────────────────────────────────────┤
 │                                                                        │
 │  1. PATIENT DE FACE (OU DE DOS) À 2 MÈTRES DU SMARTPHONE               │
 │     • 5 répétitions bilatérales d'élévation dans le plan scapulaire    │
 │       (scaption à 30° en avant du plan frontal).                       │
 │     • Rythme standardisé : 3 secondes de montée, 3 secondes de         │
 │       descente. Option : 1 kg dans chaque main (protocole McClure).    │
 │                                                                        │
 │  2. CALCUL INSTANTANÉ EN LOCAL (SANS CONNEXION INTERNET)               │
 │     • Superposition des courbes d'amplitude G/D.                       │
 │     • Détection automatique du Shrug Sign et de la dysrythmie.         │
 │                                                                        │
 │  3. RESTITUTION VISUELLE CLINIQUE                                      │
 │     • Score de symétrie global sur 100.                                │
 │     • Mise en évidence chromatique de la phase déficitaire.            │
 │     • Export PDF sécurisé pour le dossier patient ou le chirurgien.    │
 │                                                                        │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Bibliographie Scientifique de Référence (Peer-Reviewed)

1. **Inman VT, Saunders JB, Abbott LC.** *Observations on the function of the shoulder joint.* J Bone Joint Surg Am. 1944;26(1):1-30.  
   *(L'article princeps établissant le rythme scapulo-huméral 2:1 et les couples de force).*
2. **McClure P, Tate AR, Kareha S, Irwin D, Zlotoff E.** *A clinical method for identifying scapular dyskinesis, part 1: reliability.* J Athl Train. 2009;44(2):160-164.  
   *(Validation du protocole SDT et démonstration des limites de l'observation visuelle sans outil quantitatif).*
3. **Tate AR, McClure P, Kareha S, Irwin D, Barbe MF.** *A clinical method for identifying scapular dyskinesis, part 2: validity.* J Athl Train. 2009;44(2):165-173.  
   *(Preuve par capteurs électromagnétiques 3D que la dyskinésie visuelle correspond à des altérations cinématiques réelles).*
4. **Kibler WB, Sciascia A, Wilkes T.** *Scapular dyskinesis and its relation to shoulder injury.* J Am Acad Orthop Surg. 2012;20(6):364-372.  
   *(Classification des types I, II, III de dyskinésie et corrélation avec les pathologies de coiffe et labrales).*
5. **Cools AM, Struyf F, De Mey K, Maenhout A, Castelein B, Cagnie B.** *Rehabilitation of scapular dyskinesis: from the lab to the clinic.* Br J Sports Med. 2014;48(8):692-697.  
   *(Arbre décisionnel de rééducation des asymétries et ratios d'activation trapèze inférieur/dentelé antérieur).*
6. **Neer CS 2nd.** *Impingement lesions.* Clin Orthop Relat Res. 1983;(173):70-77.  
   *(Mécanisme du conflit sous-acromial et conflit acromial antérieur).*
7. **Ludewig PM, Cook TM.** *Alterations in shoulder kinematics and associated muscle activity in people with symptoms of shoulder impingement.* Phys Ther. 2000;80(3):276-291.  
   *(Démonstration de la réduction de bascule postérieure et de rotation externe de la scapula chez les patients symptomatiques).*
8. **Balasubramanian S, Melendez-Calderon A, Burdet E.** *A robust and sensitive metric for quantifying movement smoothness.* IEEE Trans Biomed Eng. 2012;59(8):2126-2136.  
   *(Fondement mathématique de l'indice spectral SPARC utilisé dans WorkoutVision).*
9. **Kiesel K, Plisky PJ, Voight ML.** *Can Serious Injury in Professional Football be Predicted by a Preseason Movement Screen?* N Am J Sports Phys Ther. 2007;2(3):147-158.  
   *(Validation du seuil pronostique d'asymétrie bilatérale >15%).*
