# Dossier de Validation Clinique & Preuves Scientifiques (Sports & Kinésithérapie)

**Référence Documentaire**: `CLINICAL_VALIDATION_AND_EVIDENCE_DOSSIER.md`  
**Gouvernance**: Conforme aux règles cliniques de `DIRECTIVES.md` et `PLAN.md`. Politique stricte de zéro tiret cadratin.  
**Public Cible**: David Dabert, Monsieur Lamine (Masseur-Kinésithérapeute DE, Clinique de Pessac), Médecins du Sport, Évaluateurs Indépendants.

---

## 1. Cadre Méthodologique & Évaluation Indépendante

Toute mesure cinématique fournie par Workout Vision repose sur le tracking 3D MediaPipe sans marqueur et doit satisfaire trois impératifs cardinaux :
1. **Validité Scientifique**: Ancrage direct dans la littérature médico-sportive indexée (PubMed / MEDLINE).
2. **Bornes de Mesure & Taux de Confiance**: Refus explicite de la mesure si la visibilité des repères anatomiques est inférieure à 70% ou si l'angle de vue présente une déviation géométrique excessive.
3. **Contrôle Indépendant**: Séparation stricte entre les algorithmes de calcul (`src/lib/kine/pessacClinicalSpecialties.ts`) et le validateur de preuves (`src/lib/kine/clinicalEvidenceValidator.ts`).

---

## 2. Registre des Métriques & Normes Cliniques par Pôle

### Pôle 1 : Épaule & Scapula (Conflit Sous-Acromial & Instabilité)
* **Classification Kibler**: Kibler WB, McMullen J. *Scapular dyskinesis and its relation to shoulder pain.* J Am Acad Orthop Surg. 2002.
  - *Grade 0*: Mouvement scapulaire symétrique et fluide.
  - *Grade I*: Décollement de l'angle inférieur de la scapula.
  - *Grade II*: Décollement du bord médial entier.
  - *Grade III*: Élévation excessive précoce du bord supéro-médial.
* **Signe du Haussement (Shrug Sign)**: Neer CS. *Impingement lesions.* Clin Orthop Relat Res. 1983.
  - *Seuil pathologique*: Élévation de la ceinture scapulaire avant 60 degrés d'abduction gléno-humérale active.

### Pôle 2 : Genou & Ligament Croisé Antérieur (LCA)
* **Valgus Dynamique au Squat Monopodal (FPPA)**: Hewett TE, et al. *Biomechanical measures of neuromuscular control and valgus loading of the knee predict anterior cruciate ligament injury risk.* Am J Sports Med. 2005.
  - *Norme physiologique*: FPPA <= 4.0 degrés.
  - *Seuil d'alerte clinique*: FPPA > 8.0 degrés (indique une contrainte majeure en cisaillement sur le greffon LCA ou le cartilage fémoro-patellaire).
* **Indice de Symétrie du Membre (Limb Symmetry Index, LSI)**: Noyes FR, Barber-Westin SD. *Neuromuscular retraining in female athletes.* Sports Health. 2012.
  - *Critère de reprise sportive (Return to Play)*: LSI >= 90.0% sur test de saut ou force fonctionnelle.
  - *Risque de récidive*: LSI < 85.0% multiplie par 3.8 le risque de rupture itérative du LCA.

### Pôle 3 : Rachis Lombaire & Bassin (Lombalgie & Instabilité)
* **Ratio Lombo-Pelvien en Flexion Antérieure**: Esola MA, et al. *Analysis of lumbar spine and hip motion during forward bending.* Spine. 1996.
  - *Norme*: Ratio 1.0 à 1.4 en phase précoce de flexion.
  - *Inversion du rythme*: Ratio > 1.8 (inversion caractérisée avec hyper-sollicitation charnière L4-S1 et sous-utilisation coxo-fémorale).
* **Dévers Pelvien Unilatéral (Test de Trendelenburg)**: Hardcastle P, Nade S. *The significance of the Trendelenburg test.* J Bone Joint Surg Br. 1985.
  - *Norme*: Bascule pelvienne controlatérale <= 2.5 degrés.
  - *Déficit moyen fessier*: Dévers > 3.0 degrés signe une insuffisance des abducteurs stabilisateurs de hanche.

### Pôle 4 : Hanche & Conflit Fémoro-Acétabulaire (CFA)
* **Test FADIR (Flexion, Adduction, Rotation Interne)**: Ganz R, et al. *Femoroacetabular impingement: a cause for osteoarthritis of the hip.* Clin Orthop Relat Res. 2003.
  - *Norme de rotation interne à 90 degrés de flexion*: >= 35.0 degrés.
  - *Déficit significatif*: Rotation interne < 20.0 degrés associée à une douleur inguinale (suspicion de CFA type Came/Pince).
* **Test de Thomas (Rétraction Psoas-Iliaque)**: Harvey D. *Assessment of the flexibility of elite athletes using the Thomas test.* Br J Sports Med. 1998.
  - *Norme*: Extension coxo-fémorale relative >= 10.0 degrés en décubitus.
  - *Rétraction*: Angle négatif (cuisse n'atteignant pas l'horizontale).

### Pôle 5 : Cheville & Tendon d'Achille
* **Test de Fente en Charge (Weight-Bearing Lunge Test, WBLT)**: Bennell KL, et al. *Intra-rater and inter-rater reliability of a weight-bearing lunge measure of ankle dorsiflexion.* Aust J Physiother. 1998.
  - *Norme*: Flexion dorsale tibia-sol >= 35.0 degrés (distance genou-mur >= 10.0 cm).
  - *Déficit fonctionnel*: Dorsiflexion < 30.0 degrés, facteur de risque majeur de tendinopathie rotulienne et fasciite plantaire.
* **Test Heel-Rise Unilatéral (Endurance Soléaire/Gastrocnémien)**: Hébert-Losier K, et al. *Updated norms for the heel-rise test.* Phys Ther Sport. 2017.
  - *Norme athlète adulte*: 25 à 30 répétitions complètes et contrôlées.

### Pôle 6 : Rachis Cervical & Céphalées
* **Angle Cranio-Vertébral (CVA)**: Yip CH, et al. *The relationship between head posture and severity and disability of patients with neck pain.* Man Ther. 2008.
  - *Norme posturale*: CVA >= 50.0 degrés.
  - *Projection céphalique antérieure (Forward Head Posture)*: CVA < 45.0 degrés, augmentant la charge mécanique sous-occipitale jusqu'à 27 kg.
* **Test de Flexion-Rotation (FRT, C1-C2)**: Hall T, Robinson K. *The flexion-rotation test and its relationship in headache.* Cephalalgia. 2004.
  - *Norme*: Rotation bilatérale symétrique >= 40.0 degrés de chaque côté en flexion maximale.

---

## 3. Conformité Haute Autorité de Santé (HAS) & Fiches BDK

Le module de génération du Bilan Diagnostic Kinésithérapique (BDK) respecte les directives de la Haute Autorité de Santé (HAS) et de l'Assurance Maladie :
1. **Identification Praticien & Patient**: Numéro RPPS/ADELI, initiales du patient, date d'évaluation.
2. **Bilan des Déficiences**: Mesures chiffrées reproductibles avec valeur active, norme de référence et déficit relatif.
3. **Bilan des Limitations d'Activités**: Score fonctionnel et retentissement gestuel.
4. **Objectifs Thérapeutiques Définis**: Nombre de séances préconisées et réévaluation programmée.
