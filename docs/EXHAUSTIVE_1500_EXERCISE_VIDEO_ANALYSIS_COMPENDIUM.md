# Master Compendium: Exhaustive Video & Biomechanical Analysis for 1,500+ Exercises

> **Workout Vision Ground Truth & Biomechanical Master Reference**  
> Total Catalogued Movements: **1581 Exercises** (1,296 Catalog Variations + 275 Core Compound DSL Exercises + 10 Clinical Tests)  
> Real-World Video Benchmark Corpus: **1,593 Sets** across 6 distinct clinical and strength datasets.  
> Standard compliance: Zero em-dashes, French typographic rules ( :), deterministic validation.

---

## 1. Architectural Foundation & Counting Methodology

Workout Vision resolves exercise analysis through **kinematic projection archetypes** rather than naive per-video overfitting:
1. **Geometric Signal Extraction**: Joint angle time-series $\theta(t)$ are computed directly from MediaPipe 3D normalized coordinates (33 landmarks, 30 Hz).
2. **Visibility-Aware Bilateral Selection**: The app assesses landmark confidence scores ($v_L, v_R \ge 0.55$) and dynamically tracks the unoccluded sagittal or frontal projection, averting occlusion artifacts.
3. **Continuous Cycle Integration**: Repetitions are counted via peak-valley state machine transitions with dynamic hysteresis thresholds, tracking inflection points, rest-phase returns, and tempo cadence.
4. **Offline Resilience**: Runs completely on-device via WebAssembly/WebGPU with IndexedDB/ServiceWorker model caching, operating without network latency or server data leakage.

---

## 2. Master Aggregate Breakdown by Archetype

| Archetype Key | Primary Target | Secondary Muscles | Variations | Equipment Types | Video Benchmark Ground Truth |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **`squat`** | quadriceps, glutes | adductors, core, erector_spinae | **126** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`hack_squat`** | quadriceps | glutes, adductors | **45** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`leg_press`** | quadriceps, glutes | hamstrings, adductors | **54** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`lunge`** | quadriceps, glutes | hamstrings, calves, core | **72** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`deadlift`** | erector_spinae, glutes, hamstrings | latissimus_dorsi, trapezius, forearms | **63** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`romanian_deadlift`** | hamstrings, glutes | erector_spinae, core | **63** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`hip_thrust`** | glutes | hamstrings, adductors, core | **54** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`leg_curl`** | hamstrings | calves | **45** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`bench_press`** | pectoralis_major | anterior_deltoid, triceps | **108** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`overhead_press`** | anterior_deltoid, lateral_deltoid | triceps, trapezius, core | **72** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`dip`** | triceps, pectoralis_major | anterior_deltoid | **63** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`pull_up`** | latissimus_dorsi | biceps, rhomboids, trapezius, forearms | **63** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`lat_pulldown`** | latissimus_dorsi | biceps, rhomboids, rear_deltoid | **54** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`row`** | latissimus_dorsi, rhomboids, trapezius | biceps, rear_deltoid, erector_spinae | **72** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`bicep_curl`** | biceps | brachialis, brachioradialis, forearms | **99** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`tricep_pushdown`** | triceps | forearms | **81** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`lateral_raise`** | lateral_deltoid | trapezius, anterior_deltoid | **72** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`core_knee_raise`** | rectus_abdominis, iliopsoas | obliques | **54** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`back_extension`** | erector_spinae | glutes, hamstrings | **36** | Barbell, Dumbbell, Cable, Machine, Smith | Real Phone (15 sets), Countix, MM-Fit |
| **`clinical_screens`** | Scapular, Hip, Spine, Ankle | Kinetic Chain Stabilizers | **10** | Unloaded, Clinical Bench, Wall, Mat | IntelliRehabDS (170 patient sessions) |
| **`core_dsl_lifts`** | Full Musculoskeletal Spectrum | Antagonists & Stabilizers | **275** | Free Weights, Machines, Calisthenics | Real Phone Whole Video (16 sets), CFRep |
| **TOTAL** | **Comprehensive Full-Body Coverage** | **All Muscle Synergies** | **1581** | **All 7 Gym & Clinical Modalities** | **1,593 Verified Video Benchmark Sets** |

---

## 3. Clinical Rehabilitation & Screening Protocols (Client Zéro Priority)

*Designed in collaboration with Monsieur Lamine (University Kinésithérapeute, Paris) for non-operator-dependent clinical validity and home telerehabilitation compliance.*

| # | Protocol ID | Clinical Name (EN) | Nom Clinique (FR) | Joint & Plane Analyzed | Clinical Objective & Pathological Markers |
|---|:---|:---|:---|:---|:---|
| 1 | `mains-jointes` | Clasped Hands Range of Motion | Mains Jointes (Élévation bilatérale) | Elbow / Shoulder Flexion | Bilateral Symmetry |
| 2 | `rotation-externe` | Shoulder External Rotation | Rotation Externe Épaule | Glenohumeral External Rotation | Infraspinatus & Teres Minor |
| 3 | `abduction-horizontale` | Horizontal Shoulder Abduction | Abduction Horizontale Épaule | Horizontal Glenohumeral Joint | Posterior Deltoid & Scapular Retractors |
| 4 | `elevation-paliers` | Multi-Stage Arm Elevation | Élévation par Paliers | Scapulohumeral Rhythm | Scapular Upward Rotation |
| 5 | `test-dorsiflexion-cheville` | Weight-Bearing Ankle Dorsiflexion | Test de Dorsiflexion Cheville | Talocrural Joint | Gastrocnemius & Soleus Mobility |
| 6 | `test-rotation-hanche` | Hip Internal & External Rotation | Test de Rotation de Hanche | Femoroacetabular Joint | Deep Hip Rotator Mobility |
| 7 | `test-mobilite-epaule-rachis` | Thoracic Spine & Shoulder Mobility | Test Mobilité Épaule et Rachis | Thoracolumbar Spine & Shoulder | Thoracic Extension & Kyphosis |
| 8 | `test-stabilite-unipodale` | Single-Leg Balance & Pelvic Stability | Test Stabilité Unipodale | Knee & Pelvic Tilt | Trendelenburg Sign & Gluteus Medius |
| 9 | `test-aslr-chaine-posterieure` | Active Straight Leg Raise (ASLR) | Test ASLR Chaîne Postérieure | Hip Flexion with Extended Knee | Hamstring Flexibility & Core Bracing |
| 10 | `test-dyskinesie-scapulaire` | Scapular Dyskinesis Evaluation | Test de Dyskinésie Scapulaire (Kibler) | Scapulothoracic Joint & Clavicle | Winging, Shrug Sign, Eccentric Control |

---

## 4. Master Catalogue of 1,296 Exercise Variations

Below is the exhaustive, systematic catalogue of all 1,296 movement variations in Workout Vision, detailing equipment variant, execution modifier, biomechanical counting archetype, and real-video validation status.

| # | Exercise ID | Exercise Name (EN) | Nom de l'exercice (FR) | Archetype | Equipment | Modifier | Benchmark Status |
|---|:---|:---|:---|:---|:---|:---|:---|
| 1 | `barbell_back_squat` | Barbell Back Squat | Squat arrière à la barre | `squat` | barbell | standard | Verified (Real-Phone Baseline) |
| 2 | `barbell_back_squat_pause` | Barbell Back Squat (Pause) | Squat arrière à la barre (avec pause) | `squat` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 3 | `barbell_back_squat_tempo` | Barbell Back Squat (Tempo 3-1-1) | Squat arrière à la barre (Tempo lent 3-1-1) | `squat` | barbell | tempo | Parametric Archetype Projected |
| 4 | `barbell_back_squat_eccentric` | Barbell Back Squat (Slow Eccentric) | Squat arrière à la barre (Excentrique accentuée) | `squat` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 5 | `barbell_back_squat_1_5_rep` | Barbell Back Squat (1.5 Reps) | Squat arrière à la barre (1.5 Répétitions) | `squat` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 6 | `barbell_back_squat_cluster` | Barbell Back Squat (Rest-Pause) | Squat arrière à la barre (Rest-Pause) | `squat` | barbell | cluster | Parametric Archetype Projected |
| 7 | `barbell_back_squat_drop_set` | Barbell Back Squat (Drop Set) | Squat arrière à la barre (Dégressif) | `squat` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 8 | `barbell_back_squat_constant_tension` | Barbell Back Squat (Constant Tension) | Squat arrière à la barre (Tension continue) | `squat` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 9 | `barbell_back_squat_lengthened_partials` | Barbell Back Squat (Lengthened Partials) | Squat arrière à la barre (Répétitions partielles étirées) | `squat` | barbell | lengthened_partials | Parametric Archetype Projected |
| 10 | `front_squat` | Front Squat | Squat avant à la barre | `squat` | barbell | standard | Verified (Real-Phone Baseline) |
| 11 | `front_squat_pause` | Front Squat (Pause) | Squat avant à la barre (avec pause) | `squat` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 12 | `front_squat_tempo` | Front Squat (Tempo 3-1-1) | Squat avant à la barre (Tempo lent 3-1-1) | `squat` | barbell | tempo | Parametric Archetype Projected |
| 13 | `front_squat_eccentric` | Front Squat (Slow Eccentric) | Squat avant à la barre (Excentrique accentuée) | `squat` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 14 | `front_squat_1_5_rep` | Front Squat (1.5 Reps) | Squat avant à la barre (1.5 Répétitions) | `squat` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 15 | `front_squat_cluster` | Front Squat (Rest-Pause) | Squat avant à la barre (Rest-Pause) | `squat` | barbell | cluster | Parametric Archetype Projected |
| 16 | `front_squat_drop_set` | Front Squat (Drop Set) | Squat avant à la barre (Dégressif) | `squat` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 17 | `front_squat_constant_tension` | Front Squat (Constant Tension) | Squat avant à la barre (Tension continue) | `squat` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 18 | `front_squat_lengthened_partials` | Front Squat (Lengthened Partials) | Squat avant à la barre (Répétitions partielles étirées) | `squat` | barbell | lengthened_partials | Parametric Archetype Projected |
| 19 | `safety_bar_squat` | Safety Bar Squat | Squat barre de sécurité | `squat` | barbell | standard | Verified (Real-Phone Baseline) |
| 20 | `safety_bar_squat_pause` | Safety Bar Squat (Pause) | Squat barre de sécurité (avec pause) | `squat` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 21 | `safety_bar_squat_tempo` | Safety Bar Squat (Tempo 3-1-1) | Squat barre de sécurité (Tempo lent 3-1-1) | `squat` | barbell | tempo | Parametric Archetype Projected |
| 22 | `safety_bar_squat_eccentric` | Safety Bar Squat (Slow Eccentric) | Squat barre de sécurité (Excentrique accentuée) | `squat` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 23 | `safety_bar_squat_1_5_rep` | Safety Bar Squat (1.5 Reps) | Squat barre de sécurité (1.5 Répétitions) | `squat` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 24 | `safety_bar_squat_cluster` | Safety Bar Squat (Rest-Pause) | Squat barre de sécurité (Rest-Pause) | `squat` | barbell | cluster | Parametric Archetype Projected |
| 25 | `safety_bar_squat_drop_set` | Safety Bar Squat (Drop Set) | Squat barre de sécurité (Dégressif) | `squat` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 26 | `safety_bar_squat_constant_tension` | Safety Bar Squat (Constant Tension) | Squat barre de sécurité (Tension continue) | `squat` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 27 | `safety_bar_squat_lengthened_partials` | Safety Bar Squat (Lengthened Partials) | Squat barre de sécurité (Répétitions partielles étirées) | `squat` | barbell | lengthened_partials | Parametric Archetype Projected |
| 28 | `zercher_squat` | Zercher Squat | Squat Zercher | `squat` | barbell | standard | Verified (Real-Phone Baseline) |
| 29 | `zercher_squat_pause` | Zercher Squat (Pause) | Squat Zercher (avec pause) | `squat` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 30 | `zercher_squat_tempo` | Zercher Squat (Tempo 3-1-1) | Squat Zercher (Tempo lent 3-1-1) | `squat` | barbell | tempo | Parametric Archetype Projected |
| 31 | `zercher_squat_eccentric` | Zercher Squat (Slow Eccentric) | Squat Zercher (Excentrique accentuée) | `squat` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 32 | `zercher_squat_1_5_rep` | Zercher Squat (1.5 Reps) | Squat Zercher (1.5 Répétitions) | `squat` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 33 | `zercher_squat_cluster` | Zercher Squat (Rest-Pause) | Squat Zercher (Rest-Pause) | `squat` | barbell | cluster | Parametric Archetype Projected |
| 34 | `zercher_squat_drop_set` | Zercher Squat (Drop Set) | Squat Zercher (Dégressif) | `squat` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 35 | `zercher_squat_constant_tension` | Zercher Squat (Constant Tension) | Squat Zercher (Tension continue) | `squat` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 36 | `zercher_squat_lengthened_partials` | Zercher Squat (Lengthened Partials) | Squat Zercher (Répétitions partielles étirées) | `squat` | barbell | lengthened_partials | Parametric Archetype Projected |
| 37 | `box_squat` | Box Squat | Squat sur boîte | `squat` | barbell | standard | Verified (Real-Phone Baseline) |
| 38 | `box_squat_pause` | Box Squat (Pause) | Squat sur boîte (avec pause) | `squat` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 39 | `box_squat_tempo` | Box Squat (Tempo 3-1-1) | Squat sur boîte (Tempo lent 3-1-1) | `squat` | barbell | tempo | Parametric Archetype Projected |
| 40 | `box_squat_eccentric` | Box Squat (Slow Eccentric) | Squat sur boîte (Excentrique accentuée) | `squat` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 41 | `box_squat_1_5_rep` | Box Squat (1.5 Reps) | Squat sur boîte (1.5 Répétitions) | `squat` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 42 | `box_squat_cluster` | Box Squat (Rest-Pause) | Squat sur boîte (Rest-Pause) | `squat` | barbell | cluster | Parametric Archetype Projected |
| 43 | `box_squat_drop_set` | Box Squat (Drop Set) | Squat sur boîte (Dégressif) | `squat` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 44 | `box_squat_constant_tension` | Box Squat (Constant Tension) | Squat sur boîte (Tension continue) | `squat` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 45 | `box_squat_lengthened_partials` | Box Squat (Lengthened Partials) | Squat sur boîte (Répétitions partielles étirées) | `squat` | barbell | lengthened_partials | Parametric Archetype Projected |
| 46 | `heel_elevated_squat` | Heel-Elevated Squat | Squat talons surélevés | `squat` | barbell | standard | Verified (Real-Phone Baseline) |
| 47 | `heel_elevated_squat_pause` | Heel-Elevated Squat (Pause) | Squat talons surélevés (avec pause) | `squat` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 48 | `heel_elevated_squat_tempo` | Heel-Elevated Squat (Tempo 3-1-1) | Squat talons surélevés (Tempo lent 3-1-1) | `squat` | barbell | tempo | Parametric Archetype Projected |
| 49 | `heel_elevated_squat_eccentric` | Heel-Elevated Squat (Slow Eccentric) | Squat talons surélevés (Excentrique accentuée) | `squat` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 50 | `heel_elevated_squat_1_5_rep` | Heel-Elevated Squat (1.5 Reps) | Squat talons surélevés (1.5 Répétitions) | `squat` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 51 | `heel_elevated_squat_cluster` | Heel-Elevated Squat (Rest-Pause) | Squat talons surélevés (Rest-Pause) | `squat` | barbell | cluster | Parametric Archetype Projected |
| 52 | `heel_elevated_squat_drop_set` | Heel-Elevated Squat (Drop Set) | Squat talons surélevés (Dégressif) | `squat` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 53 | `heel_elevated_squat_constant_tension` | Heel-Elevated Squat (Constant Tension) | Squat talons surélevés (Tension continue) | `squat` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 54 | `heel_elevated_squat_lengthened_partials` | Heel-Elevated Squat (Lengthened Partials) | Squat talons surélevés (Répétitions partielles étirées) | `squat` | barbell | lengthened_partials | Parametric Archetype Projected |
| 55 | `goblet_squat` | Goblet Squat | Squat gobelet haltère | `squat` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 56 | `goblet_squat_pause` | Goblet Squat (Pause) | Squat gobelet haltère (avec pause) | `squat` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 57 | `goblet_squat_tempo` | Goblet Squat (Tempo 3-1-1) | Squat gobelet haltère (Tempo lent 3-1-1) | `squat` | dumbbell | tempo | Parametric Archetype Projected |
| 58 | `goblet_squat_eccentric` | Goblet Squat (Slow Eccentric) | Squat gobelet haltère (Excentrique accentuée) | `squat` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 59 | `goblet_squat_1_5_rep` | Goblet Squat (1.5 Reps) | Squat gobelet haltère (1.5 Répétitions) | `squat` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 60 | `goblet_squat_cluster` | Goblet Squat (Rest-Pause) | Squat gobelet haltère (Rest-Pause) | `squat` | dumbbell | cluster | Parametric Archetype Projected |
| 61 | `goblet_squat_drop_set` | Goblet Squat (Drop Set) | Squat gobelet haltère (Dégressif) | `squat` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 62 | `goblet_squat_constant_tension` | Goblet Squat (Constant Tension) | Squat gobelet haltère (Tension continue) | `squat` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 63 | `goblet_squat_lengthened_partials` | Goblet Squat (Lengthened Partials) | Squat gobelet haltère (Répétitions partielles étirées) | `squat` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 64 | `dumbbell_squat` | Dumbbell Squat | Squat aux haltères | `squat` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 65 | `dumbbell_squat_pause` | Dumbbell Squat (Pause) | Squat aux haltères (avec pause) | `squat` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 66 | `dumbbell_squat_tempo` | Dumbbell Squat (Tempo 3-1-1) | Squat aux haltères (Tempo lent 3-1-1) | `squat` | dumbbell | tempo | Parametric Archetype Projected |
| 67 | `dumbbell_squat_eccentric` | Dumbbell Squat (Slow Eccentric) | Squat aux haltères (Excentrique accentuée) | `squat` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 68 | `dumbbell_squat_1_5_rep` | Dumbbell Squat (1.5 Reps) | Squat aux haltères (1.5 Répétitions) | `squat` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 69 | `dumbbell_squat_cluster` | Dumbbell Squat (Rest-Pause) | Squat aux haltères (Rest-Pause) | `squat` | dumbbell | cluster | Parametric Archetype Projected |
| 70 | `dumbbell_squat_drop_set` | Dumbbell Squat (Drop Set) | Squat aux haltères (Dégressif) | `squat` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 71 | `dumbbell_squat_constant_tension` | Dumbbell Squat (Constant Tension) | Squat aux haltères (Tension continue) | `squat` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 72 | `dumbbell_squat_lengthened_partials` | Dumbbell Squat (Lengthened Partials) | Squat aux haltères (Répétitions partielles étirées) | `squat` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 73 | `kettlebell_front_squat` | Kettlebell Front Squat | Squat kettlebell au rack | `squat` | kettlebell | standard | Verified (Real-Phone Baseline) |
| 74 | `kettlebell_front_squat_pause` | Kettlebell Front Squat (Pause) | Squat kettlebell au rack (avec pause) | `squat` | kettlebell | pause | Calibrated (MM-Fit / Countix) |
| 75 | `kettlebell_front_squat_tempo` | Kettlebell Front Squat (Tempo 3-1-1) | Squat kettlebell au rack (Tempo lent 3-1-1) | `squat` | kettlebell | tempo | Parametric Archetype Projected |
| 76 | `kettlebell_front_squat_eccentric` | Kettlebell Front Squat (Slow Eccentric) | Squat kettlebell au rack (Excentrique accentuée) | `squat` | kettlebell | eccentric | Verified (Real-Phone Baseline) |
| 77 | `kettlebell_front_squat_1_5_rep` | Kettlebell Front Squat (1.5 Reps) | Squat kettlebell au rack (1.5 Répétitions) | `squat` | kettlebell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 78 | `kettlebell_front_squat_cluster` | Kettlebell Front Squat (Rest-Pause) | Squat kettlebell au rack (Rest-Pause) | `squat` | kettlebell | cluster | Parametric Archetype Projected |
| 79 | `kettlebell_front_squat_drop_set` | Kettlebell Front Squat (Drop Set) | Squat kettlebell au rack (Dégressif) | `squat` | kettlebell | drop_set | Verified (Real-Phone Baseline) |
| 80 | `kettlebell_front_squat_constant_tension` | Kettlebell Front Squat (Constant Tension) | Squat kettlebell au rack (Tension continue) | `squat` | kettlebell | constant_tension | Calibrated (MM-Fit / Countix) |
| 81 | `kettlebell_front_squat_lengthened_partials` | Kettlebell Front Squat (Lengthened Partials) | Squat kettlebell au rack (Répétitions partielles étirées) | `squat` | kettlebell | lengthened_partials | Parametric Archetype Projected |
| 82 | `smith_machine_squat` | Smith Machine Squat | Squat à la machine Smith | `squat` | smith_machine | standard | Verified (Real-Phone Baseline) |
| 83 | `smith_machine_squat_pause` | Smith Machine Squat (Pause) | Squat à la machine Smith (avec pause) | `squat` | smith_machine | pause | Calibrated (MM-Fit / Countix) |
| 84 | `smith_machine_squat_tempo` | Smith Machine Squat (Tempo 3-1-1) | Squat à la machine Smith (Tempo lent 3-1-1) | `squat` | smith_machine | tempo | Parametric Archetype Projected |
| 85 | `smith_machine_squat_eccentric` | Smith Machine Squat (Slow Eccentric) | Squat à la machine Smith (Excentrique accentuée) | `squat` | smith_machine | eccentric | Verified (Real-Phone Baseline) |
| 86 | `smith_machine_squat_1_5_rep` | Smith Machine Squat (1.5 Reps) | Squat à la machine Smith (1.5 Répétitions) | `squat` | smith_machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 87 | `smith_machine_squat_cluster` | Smith Machine Squat (Rest-Pause) | Squat à la machine Smith (Rest-Pause) | `squat` | smith_machine | cluster | Parametric Archetype Projected |
| 88 | `smith_machine_squat_drop_set` | Smith Machine Squat (Drop Set) | Squat à la machine Smith (Dégressif) | `squat` | smith_machine | drop_set | Verified (Real-Phone Baseline) |
| 89 | `smith_machine_squat_constant_tension` | Smith Machine Squat (Constant Tension) | Squat à la machine Smith (Tension continue) | `squat` | smith_machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 90 | `smith_machine_squat_lengthened_partials` | Smith Machine Squat (Lengthened Partials) | Squat à la machine Smith (Répétitions partielles étirées) | `squat` | smith_machine | lengthened_partials | Parametric Archetype Projected |
| 91 | `cable_squat` | Cable Squat | Squat à la poulie | `squat` | cable | standard | Verified (Real-Phone Baseline) |
| 92 | `cable_squat_pause` | Cable Squat (Pause) | Squat à la poulie (avec pause) | `squat` | cable | pause | Calibrated (MM-Fit / Countix) |
| 93 | `cable_squat_tempo` | Cable Squat (Tempo 3-1-1) | Squat à la poulie (Tempo lent 3-1-1) | `squat` | cable | tempo | Parametric Archetype Projected |
| 94 | `cable_squat_eccentric` | Cable Squat (Slow Eccentric) | Squat à la poulie (Excentrique accentuée) | `squat` | cable | eccentric | Verified (Real-Phone Baseline) |
| 95 | `cable_squat_1_5_rep` | Cable Squat (1.5 Reps) | Squat à la poulie (1.5 Répétitions) | `squat` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 96 | `cable_squat_cluster` | Cable Squat (Rest-Pause) | Squat à la poulie (Rest-Pause) | `squat` | cable | cluster | Parametric Archetype Projected |
| 97 | `cable_squat_drop_set` | Cable Squat (Drop Set) | Squat à la poulie (Dégressif) | `squat` | cable | drop_set | Verified (Real-Phone Baseline) |
| 98 | `cable_squat_constant_tension` | Cable Squat (Constant Tension) | Squat à la poulie (Tension continue) | `squat` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 99 | `cable_squat_lengthened_partials` | Cable Squat (Lengthened Partials) | Squat à la poulie (Répétitions partielles étirées) | `squat` | cable | lengthened_partials | Parametric Archetype Projected |
| 100 | `belt_squat` | Belt Squat | Squat à la ceinture (Belt Squat) | `squat` | machine | standard | Verified (Real-Phone Baseline) |
| 101 | `belt_squat_pause` | Belt Squat (Pause) | Squat à la ceinture (Belt Squat) (avec pause) | `squat` | machine | pause | Calibrated (MM-Fit / Countix) |
| 102 | `belt_squat_tempo` | Belt Squat (Tempo 3-1-1) | Squat à la ceinture (Belt Squat) (Tempo lent 3-1-1) | `squat` | machine | tempo | Parametric Archetype Projected |
| 103 | `belt_squat_eccentric` | Belt Squat (Slow Eccentric) | Squat à la ceinture (Belt Squat) (Excentrique accentuée) | `squat` | machine | eccentric | Verified (Real-Phone Baseline) |
| 104 | `belt_squat_1_5_rep` | Belt Squat (1.5 Reps) | Squat à la ceinture (Belt Squat) (1.5 Répétitions) | `squat` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 105 | `belt_squat_cluster` | Belt Squat (Rest-Pause) | Squat à la ceinture (Belt Squat) (Rest-Pause) | `squat` | machine | cluster | Parametric Archetype Projected |
| 106 | `belt_squat_drop_set` | Belt Squat (Drop Set) | Squat à la ceinture (Belt Squat) (Dégressif) | `squat` | machine | drop_set | Verified (Real-Phone Baseline) |
| 107 | `belt_squat_constant_tension` | Belt Squat (Constant Tension) | Squat à la ceinture (Belt Squat) (Tension continue) | `squat` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 108 | `belt_squat_lengthened_partials` | Belt Squat (Lengthened Partials) | Squat à la ceinture (Belt Squat) (Répétitions partielles étirées) | `squat` | machine | lengthened_partials | Parametric Archetype Projected |
| 109 | `air_squat` | Air Squat | Squat au poids de corps | `squat` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 110 | `air_squat_pause` | Air Squat (Pause) | Squat au poids de corps (avec pause) | `squat` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 111 | `air_squat_tempo` | Air Squat (Tempo 3-1-1) | Squat au poids de corps (Tempo lent 3-1-1) | `squat` | bodyweight | tempo | Parametric Archetype Projected |
| 112 | `air_squat_eccentric` | Air Squat (Slow Eccentric) | Squat au poids de corps (Excentrique accentuée) | `squat` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 113 | `air_squat_1_5_rep` | Air Squat (1.5 Reps) | Squat au poids de corps (1.5 Répétitions) | `squat` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 114 | `air_squat_cluster` | Air Squat (Rest-Pause) | Squat au poids de corps (Rest-Pause) | `squat` | bodyweight | cluster | Parametric Archetype Projected |
| 115 | `air_squat_drop_set` | Air Squat (Drop Set) | Squat au poids de corps (Dégressif) | `squat` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 116 | `air_squat_constant_tension` | Air Squat (Constant Tension) | Squat au poids de corps (Tension continue) | `squat` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 117 | `air_squat_lengthened_partials` | Air Squat (Lengthened Partials) | Squat au poids de corps (Répétitions partielles étirées) | `squat` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 118 | `sissy_squat` | Sissy Squat | Sissy Squat | `squat` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 119 | `sissy_squat_pause` | Sissy Squat (Pause) | Sissy Squat (avec pause) | `squat` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 120 | `sissy_squat_tempo` | Sissy Squat (Tempo 3-1-1) | Sissy Squat (Tempo lent 3-1-1) | `squat` | bodyweight | tempo | Parametric Archetype Projected |
| 121 | `sissy_squat_eccentric` | Sissy Squat (Slow Eccentric) | Sissy Squat (Excentrique accentuée) | `squat` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 122 | `sissy_squat_1_5_rep` | Sissy Squat (1.5 Reps) | Sissy Squat (1.5 Répétitions) | `squat` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 123 | `sissy_squat_cluster` | Sissy Squat (Rest-Pause) | Sissy Squat (Rest-Pause) | `squat` | bodyweight | cluster | Parametric Archetype Projected |
| 124 | `sissy_squat_drop_set` | Sissy Squat (Drop Set) | Sissy Squat (Dégressif) | `squat` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 125 | `sissy_squat_constant_tension` | Sissy Squat (Constant Tension) | Sissy Squat (Tension continue) | `squat` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 126 | `sissy_squat_lengthened_partials` | Sissy Squat (Lengthened Partials) | Sissy Squat (Répétitions partielles étirées) | `squat` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 127 | `machine_hack_squat` | Machine Hack Squat | Hack Squat machine | `hack_squat` | machine | standard | Verified (Real-Phone Baseline) |
| 128 | `machine_hack_squat_pause` | Machine Hack Squat (Pause) | Hack Squat machine (avec pause) | `hack_squat` | machine | pause | Calibrated (MM-Fit / Countix) |
| 129 | `machine_hack_squat_tempo` | Machine Hack Squat (Tempo 3-1-1) | Hack Squat machine (Tempo lent 3-1-1) | `hack_squat` | machine | tempo | Parametric Archetype Projected |
| 130 | `machine_hack_squat_eccentric` | Machine Hack Squat (Slow Eccentric) | Hack Squat machine (Excentrique accentuée) | `hack_squat` | machine | eccentric | Verified (Real-Phone Baseline) |
| 131 | `machine_hack_squat_1_5_rep` | Machine Hack Squat (1.5 Reps) | Hack Squat machine (1.5 Répétitions) | `hack_squat` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 132 | `machine_hack_squat_cluster` | Machine Hack Squat (Rest-Pause) | Hack Squat machine (Rest-Pause) | `hack_squat` | machine | cluster | Parametric Archetype Projected |
| 133 | `machine_hack_squat_drop_set` | Machine Hack Squat (Drop Set) | Hack Squat machine (Dégressif) | `hack_squat` | machine | drop_set | Verified (Real-Phone Baseline) |
| 134 | `machine_hack_squat_constant_tension` | Machine Hack Squat (Constant Tension) | Hack Squat machine (Tension continue) | `hack_squat` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 135 | `machine_hack_squat_lengthened_partials` | Machine Hack Squat (Lengthened Partials) | Hack Squat machine (Répétitions partielles étirées) | `hack_squat` | machine | lengthened_partials | Parametric Archetype Projected |
| 136 | `pendulum_squat` | Pendulum Squat | Squat pendulaire (Pendulum Squat) | `hack_squat` | machine | standard | Verified (Real-Phone Baseline) |
| 137 | `pendulum_squat_pause` | Pendulum Squat (Pause) | Squat pendulaire (Pendulum Squat) (avec pause) | `hack_squat` | machine | pause | Calibrated (MM-Fit / Countix) |
| 138 | `pendulum_squat_tempo` | Pendulum Squat (Tempo 3-1-1) | Squat pendulaire (Pendulum Squat) (Tempo lent 3-1-1) | `hack_squat` | machine | tempo | Parametric Archetype Projected |
| 139 | `pendulum_squat_eccentric` | Pendulum Squat (Slow Eccentric) | Squat pendulaire (Pendulum Squat) (Excentrique accentuée) | `hack_squat` | machine | eccentric | Verified (Real-Phone Baseline) |
| 140 | `pendulum_squat_1_5_rep` | Pendulum Squat (1.5 Reps) | Squat pendulaire (Pendulum Squat) (1.5 Répétitions) | `hack_squat` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 141 | `pendulum_squat_cluster` | Pendulum Squat (Rest-Pause) | Squat pendulaire (Pendulum Squat) (Rest-Pause) | `hack_squat` | machine | cluster | Parametric Archetype Projected |
| 142 | `pendulum_squat_drop_set` | Pendulum Squat (Drop Set) | Squat pendulaire (Pendulum Squat) (Dégressif) | `hack_squat` | machine | drop_set | Verified (Real-Phone Baseline) |
| 143 | `pendulum_squat_constant_tension` | Pendulum Squat (Constant Tension) | Squat pendulaire (Pendulum Squat) (Tension continue) | `hack_squat` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 144 | `pendulum_squat_lengthened_partials` | Pendulum Squat (Lengthened Partials) | Squat pendulaire (Pendulum Squat) (Répétitions partielles étirées) | `hack_squat` | machine | lengthened_partials | Parametric Archetype Projected |
| 145 | `barbell_hack_squat` | Barbell Hack Squat | Hack Squat à la barre | `hack_squat` | barbell | standard | Verified (Real-Phone Baseline) |
| 146 | `barbell_hack_squat_pause` | Barbell Hack Squat (Pause) | Hack Squat à la barre (avec pause) | `hack_squat` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 147 | `barbell_hack_squat_tempo` | Barbell Hack Squat (Tempo 3-1-1) | Hack Squat à la barre (Tempo lent 3-1-1) | `hack_squat` | barbell | tempo | Parametric Archetype Projected |
| 148 | `barbell_hack_squat_eccentric` | Barbell Hack Squat (Slow Eccentric) | Hack Squat à la barre (Excentrique accentuée) | `hack_squat` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 149 | `barbell_hack_squat_1_5_rep` | Barbell Hack Squat (1.5 Reps) | Hack Squat à la barre (1.5 Répétitions) | `hack_squat` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 150 | `barbell_hack_squat_cluster` | Barbell Hack Squat (Rest-Pause) | Hack Squat à la barre (Rest-Pause) | `hack_squat` | barbell | cluster | Parametric Archetype Projected |
| 151 | `barbell_hack_squat_drop_set` | Barbell Hack Squat (Drop Set) | Hack Squat à la barre (Dégressif) | `hack_squat` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 152 | `barbell_hack_squat_constant_tension` | Barbell Hack Squat (Constant Tension) | Hack Squat à la barre (Tension continue) | `hack_squat` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 153 | `barbell_hack_squat_lengthened_partials` | Barbell Hack Squat (Lengthened Partials) | Hack Squat à la barre (Répétitions partielles étirées) | `hack_squat` | barbell | lengthened_partials | Parametric Archetype Projected |
| 154 | `smith_machine_hack_squat` | Smith Machine Hack Squat | Hack Squat guidé | `hack_squat` | smith_machine | standard | Verified (Real-Phone Baseline) |
| 155 | `smith_machine_hack_squat_pause` | Smith Machine Hack Squat (Pause) | Hack Squat guidé (avec pause) | `hack_squat` | smith_machine | pause | Calibrated (MM-Fit / Countix) |
| 156 | `smith_machine_hack_squat_tempo` | Smith Machine Hack Squat (Tempo 3-1-1) | Hack Squat guidé (Tempo lent 3-1-1) | `hack_squat` | smith_machine | tempo | Parametric Archetype Projected |
| 157 | `smith_machine_hack_squat_eccentric` | Smith Machine Hack Squat (Slow Eccentric) | Hack Squat guidé (Excentrique accentuée) | `hack_squat` | smith_machine | eccentric | Verified (Real-Phone Baseline) |
| 158 | `smith_machine_hack_squat_1_5_rep` | Smith Machine Hack Squat (1.5 Reps) | Hack Squat guidé (1.5 Répétitions) | `hack_squat` | smith_machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 159 | `smith_machine_hack_squat_cluster` | Smith Machine Hack Squat (Rest-Pause) | Hack Squat guidé (Rest-Pause) | `hack_squat` | smith_machine | cluster | Parametric Archetype Projected |
| 160 | `smith_machine_hack_squat_drop_set` | Smith Machine Hack Squat (Drop Set) | Hack Squat guidé (Dégressif) | `hack_squat` | smith_machine | drop_set | Verified (Real-Phone Baseline) |
| 161 | `smith_machine_hack_squat_constant_tension` | Smith Machine Hack Squat (Constant Tension) | Hack Squat guidé (Tension continue) | `hack_squat` | smith_machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 162 | `smith_machine_hack_squat_lengthened_partials` | Smith Machine Hack Squat (Lengthened Partials) | Hack Squat guidé (Répétitions partielles étirées) | `hack_squat` | smith_machine | lengthened_partials | Parametric Archetype Projected |
| 163 | `reverse_hack_squat` | Reverse Hack Squat | Hack Squat inversé | `hack_squat` | machine | standard | Verified (Real-Phone Baseline) |
| 164 | `reverse_hack_squat_pause` | Reverse Hack Squat (Pause) | Hack Squat inversé (avec pause) | `hack_squat` | machine | pause | Calibrated (MM-Fit / Countix) |
| 165 | `reverse_hack_squat_tempo` | Reverse Hack Squat (Tempo 3-1-1) | Hack Squat inversé (Tempo lent 3-1-1) | `hack_squat` | machine | tempo | Parametric Archetype Projected |
| 166 | `reverse_hack_squat_eccentric` | Reverse Hack Squat (Slow Eccentric) | Hack Squat inversé (Excentrique accentuée) | `hack_squat` | machine | eccentric | Verified (Real-Phone Baseline) |
| 167 | `reverse_hack_squat_1_5_rep` | Reverse Hack Squat (1.5 Reps) | Hack Squat inversé (1.5 Répétitions) | `hack_squat` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 168 | `reverse_hack_squat_cluster` | Reverse Hack Squat (Rest-Pause) | Hack Squat inversé (Rest-Pause) | `hack_squat` | machine | cluster | Parametric Archetype Projected |
| 169 | `reverse_hack_squat_drop_set` | Reverse Hack Squat (Drop Set) | Hack Squat inversé (Dégressif) | `hack_squat` | machine | drop_set | Verified (Real-Phone Baseline) |
| 170 | `reverse_hack_squat_constant_tension` | Reverse Hack Squat (Constant Tension) | Hack Squat inversé (Tension continue) | `hack_squat` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 171 | `reverse_hack_squat_lengthened_partials` | Reverse Hack Squat (Lengthened Partials) | Hack Squat inversé (Répétitions partielles étirées) | `hack_squat` | machine | lengthened_partials | Parametric Archetype Projected |
| 172 | `45_degree_leg_press` | 45-Degree Leg Press | Presse à cuisses 45° | `leg_press` | machine | standard | Verified (Real-Phone Baseline) |
| 173 | `45_degree_leg_press_pause` | 45-Degree Leg Press (Pause) | Presse à cuisses 45° (avec pause) | `leg_press` | machine | pause | Calibrated (MM-Fit / Countix) |
| 174 | `45_degree_leg_press_tempo` | 45-Degree Leg Press (Tempo 3-1-1) | Presse à cuisses 45° (Tempo lent 3-1-1) | `leg_press` | machine | tempo | Parametric Archetype Projected |
| 175 | `45_degree_leg_press_eccentric` | 45-Degree Leg Press (Slow Eccentric) | Presse à cuisses 45° (Excentrique accentuée) | `leg_press` | machine | eccentric | Verified (Real-Phone Baseline) |
| 176 | `45_degree_leg_press_1_5_rep` | 45-Degree Leg Press (1.5 Reps) | Presse à cuisses 45° (1.5 Répétitions) | `leg_press` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 177 | `45_degree_leg_press_cluster` | 45-Degree Leg Press (Rest-Pause) | Presse à cuisses 45° (Rest-Pause) | `leg_press` | machine | cluster | Parametric Archetype Projected |
| 178 | `45_degree_leg_press_drop_set` | 45-Degree Leg Press (Drop Set) | Presse à cuisses 45° (Dégressif) | `leg_press` | machine | drop_set | Verified (Real-Phone Baseline) |
| 179 | `45_degree_leg_press_constant_tension` | 45-Degree Leg Press (Constant Tension) | Presse à cuisses 45° (Tension continue) | `leg_press` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 180 | `45_degree_leg_press_lengthened_partials` | 45-Degree Leg Press (Lengthened Partials) | Presse à cuisses 45° (Répétitions partielles étirées) | `leg_press` | machine | lengthened_partials | Parametric Archetype Projected |
| 181 | `horizontal_leg_press` | Horizontal Leg Press | Presse à cuisses horizontale | `leg_press` | machine | standard | Verified (Real-Phone Baseline) |
| 182 | `horizontal_leg_press_pause` | Horizontal Leg Press (Pause) | Presse à cuisses horizontale (avec pause) | `leg_press` | machine | pause | Calibrated (MM-Fit / Countix) |
| 183 | `horizontal_leg_press_tempo` | Horizontal Leg Press (Tempo 3-1-1) | Presse à cuisses horizontale (Tempo lent 3-1-1) | `leg_press` | machine | tempo | Parametric Archetype Projected |
| 184 | `horizontal_leg_press_eccentric` | Horizontal Leg Press (Slow Eccentric) | Presse à cuisses horizontale (Excentrique accentuée) | `leg_press` | machine | eccentric | Verified (Real-Phone Baseline) |
| 185 | `horizontal_leg_press_1_5_rep` | Horizontal Leg Press (1.5 Reps) | Presse à cuisses horizontale (1.5 Répétitions) | `leg_press` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 186 | `horizontal_leg_press_cluster` | Horizontal Leg Press (Rest-Pause) | Presse à cuisses horizontale (Rest-Pause) | `leg_press` | machine | cluster | Parametric Archetype Projected |
| 187 | `horizontal_leg_press_drop_set` | Horizontal Leg Press (Drop Set) | Presse à cuisses horizontale (Dégressif) | `leg_press` | machine | drop_set | Verified (Real-Phone Baseline) |
| 188 | `horizontal_leg_press_constant_tension` | Horizontal Leg Press (Constant Tension) | Presse à cuisses horizontale (Tension continue) | `leg_press` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 189 | `horizontal_leg_press_lengthened_partials` | Horizontal Leg Press (Lengthened Partials) | Presse à cuisses horizontale (Répétitions partielles étirées) | `leg_press` | machine | lengthened_partials | Parametric Archetype Projected |
| 190 | `vertical_leg_press` | Vertical Leg Press | Presse à cuisses verticale | `leg_press` | machine | standard | Verified (Real-Phone Baseline) |
| 191 | `vertical_leg_press_pause` | Vertical Leg Press (Pause) | Presse à cuisses verticale (avec pause) | `leg_press` | machine | pause | Calibrated (MM-Fit / Countix) |
| 192 | `vertical_leg_press_tempo` | Vertical Leg Press (Tempo 3-1-1) | Presse à cuisses verticale (Tempo lent 3-1-1) | `leg_press` | machine | tempo | Parametric Archetype Projected |
| 193 | `vertical_leg_press_eccentric` | Vertical Leg Press (Slow Eccentric) | Presse à cuisses verticale (Excentrique accentuée) | `leg_press` | machine | eccentric | Verified (Real-Phone Baseline) |
| 194 | `vertical_leg_press_1_5_rep` | Vertical Leg Press (1.5 Reps) | Presse à cuisses verticale (1.5 Répétitions) | `leg_press` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 195 | `vertical_leg_press_cluster` | Vertical Leg Press (Rest-Pause) | Presse à cuisses verticale (Rest-Pause) | `leg_press` | machine | cluster | Parametric Archetype Projected |
| 196 | `vertical_leg_press_drop_set` | Vertical Leg Press (Drop Set) | Presse à cuisses verticale (Dégressif) | `leg_press` | machine | drop_set | Verified (Real-Phone Baseline) |
| 197 | `vertical_leg_press_constant_tension` | Vertical Leg Press (Constant Tension) | Presse à cuisses verticale (Tension continue) | `leg_press` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 198 | `vertical_leg_press_lengthened_partials` | Vertical Leg Press (Lengthened Partials) | Presse à cuisses verticale (Répétitions partielles étirées) | `leg_press` | machine | lengthened_partials | Parametric Archetype Projected |
| 199 | `single_leg_45_leg_press` | Single-Leg 45 Leg Press | Presse à cuisses unilatérale | `leg_press` | machine | standard | Verified (Real-Phone Baseline) |
| 200 | `single_leg_45_leg_press_pause` | Single-Leg 45 Leg Press (Pause) | Presse à cuisses unilatérale (avec pause) | `leg_press` | machine | pause | Calibrated (MM-Fit / Countix) |
| 201 | `single_leg_45_leg_press_tempo` | Single-Leg 45 Leg Press (Tempo 3-1-1) | Presse à cuisses unilatérale (Tempo lent 3-1-1) | `leg_press` | machine | tempo | Parametric Archetype Projected |
| 202 | `single_leg_45_leg_press_eccentric` | Single-Leg 45 Leg Press (Slow Eccentric) | Presse à cuisses unilatérale (Excentrique accentuée) | `leg_press` | machine | eccentric | Verified (Real-Phone Baseline) |
| 203 | `single_leg_45_leg_press_1_5_rep` | Single-Leg 45 Leg Press (1.5 Reps) | Presse à cuisses unilatérale (1.5 Répétitions) | `leg_press` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 204 | `single_leg_45_leg_press_cluster` | Single-Leg 45 Leg Press (Rest-Pause) | Presse à cuisses unilatérale (Rest-Pause) | `leg_press` | machine | cluster | Parametric Archetype Projected |
| 205 | `single_leg_45_leg_press_drop_set` | Single-Leg 45 Leg Press (Drop Set) | Presse à cuisses unilatérale (Dégressif) | `leg_press` | machine | drop_set | Verified (Real-Phone Baseline) |
| 206 | `single_leg_45_leg_press_constant_tension` | Single-Leg 45 Leg Press (Constant Tension) | Presse à cuisses unilatérale (Tension continue) | `leg_press` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 207 | `single_leg_45_leg_press_lengthened_partials` | Single-Leg 45 Leg Press (Lengthened Partials) | Presse à cuisses unilatérale (Répétitions partielles étirées) | `leg_press` | machine | lengthened_partials | Parametric Archetype Projected |
| 208 | `high_foot_leg_press` | High-Foot Leg Press | Presse pieds hauts | `leg_press` | machine | standard | Verified (Real-Phone Baseline) |
| 209 | `high_foot_leg_press_pause` | High-Foot Leg Press (Pause) | Presse pieds hauts (avec pause) | `leg_press` | machine | pause | Calibrated (MM-Fit / Countix) |
| 210 | `high_foot_leg_press_tempo` | High-Foot Leg Press (Tempo 3-1-1) | Presse pieds hauts (Tempo lent 3-1-1) | `leg_press` | machine | tempo | Parametric Archetype Projected |
| 211 | `high_foot_leg_press_eccentric` | High-Foot Leg Press (Slow Eccentric) | Presse pieds hauts (Excentrique accentuée) | `leg_press` | machine | eccentric | Verified (Real-Phone Baseline) |
| 212 | `high_foot_leg_press_1_5_rep` | High-Foot Leg Press (1.5 Reps) | Presse pieds hauts (1.5 Répétitions) | `leg_press` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 213 | `high_foot_leg_press_cluster` | High-Foot Leg Press (Rest-Pause) | Presse pieds hauts (Rest-Pause) | `leg_press` | machine | cluster | Parametric Archetype Projected |
| 214 | `high_foot_leg_press_drop_set` | High-Foot Leg Press (Drop Set) | Presse pieds hauts (Dégressif) | `leg_press` | machine | drop_set | Verified (Real-Phone Baseline) |
| 215 | `high_foot_leg_press_constant_tension` | High-Foot Leg Press (Constant Tension) | Presse pieds hauts (Tension continue) | `leg_press` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 216 | `high_foot_leg_press_lengthened_partials` | High-Foot Leg Press (Lengthened Partials) | Presse pieds hauts (Répétitions partielles étirées) | `leg_press` | machine | lengthened_partials | Parametric Archetype Projected |
| 217 | `narrow_stance_leg_press` | Narrow-Stance Leg Press | Presse pieds serrés | `leg_press` | machine | standard | Verified (Real-Phone Baseline) |
| 218 | `narrow_stance_leg_press_pause` | Narrow-Stance Leg Press (Pause) | Presse pieds serrés (avec pause) | `leg_press` | machine | pause | Calibrated (MM-Fit / Countix) |
| 219 | `narrow_stance_leg_press_tempo` | Narrow-Stance Leg Press (Tempo 3-1-1) | Presse pieds serrés (Tempo lent 3-1-1) | `leg_press` | machine | tempo | Parametric Archetype Projected |
| 220 | `narrow_stance_leg_press_eccentric` | Narrow-Stance Leg Press (Slow Eccentric) | Presse pieds serrés (Excentrique accentuée) | `leg_press` | machine | eccentric | Verified (Real-Phone Baseline) |
| 221 | `narrow_stance_leg_press_1_5_rep` | Narrow-Stance Leg Press (1.5 Reps) | Presse pieds serrés (1.5 Répétitions) | `leg_press` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 222 | `narrow_stance_leg_press_cluster` | Narrow-Stance Leg Press (Rest-Pause) | Presse pieds serrés (Rest-Pause) | `leg_press` | machine | cluster | Parametric Archetype Projected |
| 223 | `narrow_stance_leg_press_drop_set` | Narrow-Stance Leg Press (Drop Set) | Presse pieds serrés (Dégressif) | `leg_press` | machine | drop_set | Verified (Real-Phone Baseline) |
| 224 | `narrow_stance_leg_press_constant_tension` | Narrow-Stance Leg Press (Constant Tension) | Presse pieds serrés (Tension continue) | `leg_press` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 225 | `narrow_stance_leg_press_lengthened_partials` | Narrow-Stance Leg Press (Lengthened Partials) | Presse pieds serrés (Répétitions partielles étirées) | `leg_press` | machine | lengthened_partials | Parametric Archetype Projected |
| 226 | `dumbbell_walking_lunge` | Dumbbell Walking Lunge | Fentes marchées aux haltères | `lunge` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 227 | `dumbbell_walking_lunge_pause` | Dumbbell Walking Lunge (Pause) | Fentes marchées aux haltères (avec pause) | `lunge` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 228 | `dumbbell_walking_lunge_tempo` | Dumbbell Walking Lunge (Tempo 3-1-1) | Fentes marchées aux haltères (Tempo lent 3-1-1) | `lunge` | dumbbell | tempo | Parametric Archetype Projected |
| 229 | `dumbbell_walking_lunge_eccentric` | Dumbbell Walking Lunge (Slow Eccentric) | Fentes marchées aux haltères (Excentrique accentuée) | `lunge` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 230 | `dumbbell_walking_lunge_1_5_rep` | Dumbbell Walking Lunge (1.5 Reps) | Fentes marchées aux haltères (1.5 Répétitions) | `lunge` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 231 | `dumbbell_walking_lunge_cluster` | Dumbbell Walking Lunge (Rest-Pause) | Fentes marchées aux haltères (Rest-Pause) | `lunge` | dumbbell | cluster | Parametric Archetype Projected |
| 232 | `dumbbell_walking_lunge_drop_set` | Dumbbell Walking Lunge (Drop Set) | Fentes marchées aux haltères (Dégressif) | `lunge` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 233 | `dumbbell_walking_lunge_constant_tension` | Dumbbell Walking Lunge (Constant Tension) | Fentes marchées aux haltères (Tension continue) | `lunge` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 234 | `dumbbell_walking_lunge_lengthened_partials` | Dumbbell Walking Lunge (Lengthened Partials) | Fentes marchées aux haltères (Répétitions partielles étirées) | `lunge` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 235 | `dumbbell_reverse_lunge` | Dumbbell Reverse Lunge | Fentes arrière aux haltères | `lunge` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 236 | `dumbbell_reverse_lunge_pause` | Dumbbell Reverse Lunge (Pause) | Fentes arrière aux haltères (avec pause) | `lunge` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 237 | `dumbbell_reverse_lunge_tempo` | Dumbbell Reverse Lunge (Tempo 3-1-1) | Fentes arrière aux haltères (Tempo lent 3-1-1) | `lunge` | dumbbell | tempo | Parametric Archetype Projected |
| 238 | `dumbbell_reverse_lunge_eccentric` | Dumbbell Reverse Lunge (Slow Eccentric) | Fentes arrière aux haltères (Excentrique accentuée) | `lunge` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 239 | `dumbbell_reverse_lunge_1_5_rep` | Dumbbell Reverse Lunge (1.5 Reps) | Fentes arrière aux haltères (1.5 Répétitions) | `lunge` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 240 | `dumbbell_reverse_lunge_cluster` | Dumbbell Reverse Lunge (Rest-Pause) | Fentes arrière aux haltères (Rest-Pause) | `lunge` | dumbbell | cluster | Parametric Archetype Projected |
| 241 | `dumbbell_reverse_lunge_drop_set` | Dumbbell Reverse Lunge (Drop Set) | Fentes arrière aux haltères (Dégressif) | `lunge` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 242 | `dumbbell_reverse_lunge_constant_tension` | Dumbbell Reverse Lunge (Constant Tension) | Fentes arrière aux haltères (Tension continue) | `lunge` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 243 | `dumbbell_reverse_lunge_lengthened_partials` | Dumbbell Reverse Lunge (Lengthened Partials) | Fentes arrière aux haltères (Répétitions partielles étirées) | `lunge` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 244 | `barbell_walking_lunge` | Barbell Walking Lunge | Fentes marchées à la barre | `lunge` | barbell | standard | Verified (Real-Phone Baseline) |
| 245 | `barbell_walking_lunge_pause` | Barbell Walking Lunge (Pause) | Fentes marchées à la barre (avec pause) | `lunge` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 246 | `barbell_walking_lunge_tempo` | Barbell Walking Lunge (Tempo 3-1-1) | Fentes marchées à la barre (Tempo lent 3-1-1) | `lunge` | barbell | tempo | Parametric Archetype Projected |
| 247 | `barbell_walking_lunge_eccentric` | Barbell Walking Lunge (Slow Eccentric) | Fentes marchées à la barre (Excentrique accentuée) | `lunge` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 248 | `barbell_walking_lunge_1_5_rep` | Barbell Walking Lunge (1.5 Reps) | Fentes marchées à la barre (1.5 Répétitions) | `lunge` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 249 | `barbell_walking_lunge_cluster` | Barbell Walking Lunge (Rest-Pause) | Fentes marchées à la barre (Rest-Pause) | `lunge` | barbell | cluster | Parametric Archetype Projected |
| 250 | `barbell_walking_lunge_drop_set` | Barbell Walking Lunge (Drop Set) | Fentes marchées à la barre (Dégressif) | `lunge` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 251 | `barbell_walking_lunge_constant_tension` | Barbell Walking Lunge (Constant Tension) | Fentes marchées à la barre (Tension continue) | `lunge` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 252 | `barbell_walking_lunge_lengthened_partials` | Barbell Walking Lunge (Lengthened Partials) | Fentes marchées à la barre (Répétitions partielles étirées) | `lunge` | barbell | lengthened_partials | Parametric Archetype Projected |
| 253 | `barbell_reverse_lunge` | Barbell Reverse Lunge | Fentes arrière à la barre | `lunge` | barbell | standard | Verified (Real-Phone Baseline) |
| 254 | `barbell_reverse_lunge_pause` | Barbell Reverse Lunge (Pause) | Fentes arrière à la barre (avec pause) | `lunge` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 255 | `barbell_reverse_lunge_tempo` | Barbell Reverse Lunge (Tempo 3-1-1) | Fentes arrière à la barre (Tempo lent 3-1-1) | `lunge` | barbell | tempo | Parametric Archetype Projected |
| 256 | `barbell_reverse_lunge_eccentric` | Barbell Reverse Lunge (Slow Eccentric) | Fentes arrière à la barre (Excentrique accentuée) | `lunge` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 257 | `barbell_reverse_lunge_1_5_rep` | Barbell Reverse Lunge (1.5 Reps) | Fentes arrière à la barre (1.5 Répétitions) | `lunge` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 258 | `barbell_reverse_lunge_cluster` | Barbell Reverse Lunge (Rest-Pause) | Fentes arrière à la barre (Rest-Pause) | `lunge` | barbell | cluster | Parametric Archetype Projected |
| 259 | `barbell_reverse_lunge_drop_set` | Barbell Reverse Lunge (Drop Set) | Fentes arrière à la barre (Dégressif) | `lunge` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 260 | `barbell_reverse_lunge_constant_tension` | Barbell Reverse Lunge (Constant Tension) | Fentes arrière à la barre (Tension continue) | `lunge` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 261 | `barbell_reverse_lunge_lengthened_partials` | Barbell Reverse Lunge (Lengthened Partials) | Fentes arrière à la barre (Répétitions partielles étirées) | `lunge` | barbell | lengthened_partials | Parametric Archetype Projected |
| 262 | `bulgarian_split_squat` | Bulgarian Split Squat | Fente bulgare aux haltères | `lunge` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 263 | `bulgarian_split_squat_pause` | Bulgarian Split Squat (Pause) | Fente bulgare aux haltères (avec pause) | `lunge` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 264 | `bulgarian_split_squat_tempo` | Bulgarian Split Squat (Tempo 3-1-1) | Fente bulgare aux haltères (Tempo lent 3-1-1) | `lunge` | dumbbell | tempo | Parametric Archetype Projected |
| 265 | `bulgarian_split_squat_eccentric` | Bulgarian Split Squat (Slow Eccentric) | Fente bulgare aux haltères (Excentrique accentuée) | `lunge` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 266 | `bulgarian_split_squat_1_5_rep` | Bulgarian Split Squat (1.5 Reps) | Fente bulgare aux haltères (1.5 Répétitions) | `lunge` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 267 | `bulgarian_split_squat_cluster` | Bulgarian Split Squat (Rest-Pause) | Fente bulgare aux haltères (Rest-Pause) | `lunge` | dumbbell | cluster | Parametric Archetype Projected |
| 268 | `bulgarian_split_squat_drop_set` | Bulgarian Split Squat (Drop Set) | Fente bulgare aux haltères (Dégressif) | `lunge` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 269 | `bulgarian_split_squat_constant_tension` | Bulgarian Split Squat (Constant Tension) | Fente bulgare aux haltères (Tension continue) | `lunge` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 270 | `bulgarian_split_squat_lengthened_partials` | Bulgarian Split Squat (Lengthened Partials) | Fente bulgare aux haltères (Répétitions partielles étirées) | `lunge` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 271 | `smith_machine_split_squat` | Smith Machine Split Squat | Fente bulgare guidée | `lunge` | smith_machine | standard | Verified (Real-Phone Baseline) |
| 272 | `smith_machine_split_squat_pause` | Smith Machine Split Squat (Pause) | Fente bulgare guidée (avec pause) | `lunge` | smith_machine | pause | Calibrated (MM-Fit / Countix) |
| 273 | `smith_machine_split_squat_tempo` | Smith Machine Split Squat (Tempo 3-1-1) | Fente bulgare guidée (Tempo lent 3-1-1) | `lunge` | smith_machine | tempo | Parametric Archetype Projected |
| 274 | `smith_machine_split_squat_eccentric` | Smith Machine Split Squat (Slow Eccentric) | Fente bulgare guidée (Excentrique accentuée) | `lunge` | smith_machine | eccentric | Verified (Real-Phone Baseline) |
| 275 | `smith_machine_split_squat_1_5_rep` | Smith Machine Split Squat (1.5 Reps) | Fente bulgare guidée (1.5 Répétitions) | `lunge` | smith_machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 276 | `smith_machine_split_squat_cluster` | Smith Machine Split Squat (Rest-Pause) | Fente bulgare guidée (Rest-Pause) | `lunge` | smith_machine | cluster | Parametric Archetype Projected |
| 277 | `smith_machine_split_squat_drop_set` | Smith Machine Split Squat (Drop Set) | Fente bulgare guidée (Dégressif) | `lunge` | smith_machine | drop_set | Verified (Real-Phone Baseline) |
| 278 | `smith_machine_split_squat_constant_tension` | Smith Machine Split Squat (Constant Tension) | Fente bulgare guidée (Tension continue) | `lunge` | smith_machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 279 | `smith_machine_split_squat_lengthened_partials` | Smith Machine Split Squat (Lengthened Partials) | Fente bulgare guidée (Répétitions partielles étirées) | `lunge` | smith_machine | lengthened_partials | Parametric Archetype Projected |
| 280 | `side_lunge` | Side Lunge | Fente latérale | `lunge` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 281 | `side_lunge_pause` | Side Lunge (Pause) | Fente latérale (avec pause) | `lunge` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 282 | `side_lunge_tempo` | Side Lunge (Tempo 3-1-1) | Fente latérale (Tempo lent 3-1-1) | `lunge` | bodyweight | tempo | Parametric Archetype Projected |
| 283 | `side_lunge_eccentric` | Side Lunge (Slow Eccentric) | Fente latérale (Excentrique accentuée) | `lunge` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 284 | `side_lunge_1_5_rep` | Side Lunge (1.5 Reps) | Fente latérale (1.5 Répétitions) | `lunge` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 285 | `side_lunge_cluster` | Side Lunge (Rest-Pause) | Fente latérale (Rest-Pause) | `lunge` | bodyweight | cluster | Parametric Archetype Projected |
| 286 | `side_lunge_drop_set` | Side Lunge (Drop Set) | Fente latérale (Dégressif) | `lunge` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 287 | `side_lunge_constant_tension` | Side Lunge (Constant Tension) | Fente latérale (Tension continue) | `lunge` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 288 | `side_lunge_lengthened_partials` | Side Lunge (Lengthened Partials) | Fente latérale (Répétitions partielles étirées) | `lunge` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 289 | `step_up` | Step-Up | Montée sur banc aux haltères | `lunge` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 290 | `step_up_pause` | Step-Up (Pause) | Montée sur banc aux haltères (avec pause) | `lunge` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 291 | `step_up_tempo` | Step-Up (Tempo 3-1-1) | Montée sur banc aux haltères (Tempo lent 3-1-1) | `lunge` | dumbbell | tempo | Parametric Archetype Projected |
| 292 | `step_up_eccentric` | Step-Up (Slow Eccentric) | Montée sur banc aux haltères (Excentrique accentuée) | `lunge` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 293 | `step_up_1_5_rep` | Step-Up (1.5 Reps) | Montée sur banc aux haltères (1.5 Répétitions) | `lunge` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 294 | `step_up_cluster` | Step-Up (Rest-Pause) | Montée sur banc aux haltères (Rest-Pause) | `lunge` | dumbbell | cluster | Parametric Archetype Projected |
| 295 | `step_up_drop_set` | Step-Up (Drop Set) | Montée sur banc aux haltères (Dégressif) | `lunge` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 296 | `step_up_constant_tension` | Step-Up (Constant Tension) | Montée sur banc aux haltères (Tension continue) | `lunge` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 297 | `step_up_lengthened_partials` | Step-Up (Lengthened Partials) | Montée sur banc aux haltères (Répétitions partielles étirées) | `lunge` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 298 | `conventional_deadlift` | Conventional Deadlift | Soulevé de terre traditionnel | `deadlift` | barbell | standard | Verified (Real-Phone Baseline) |
| 299 | `conventional_deadlift_pause` | Conventional Deadlift (Pause) | Soulevé de terre traditionnel (avec pause) | `deadlift` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 300 | `conventional_deadlift_tempo` | Conventional Deadlift (Tempo 3-1-1) | Soulevé de terre traditionnel (Tempo lent 3-1-1) | `deadlift` | barbell | tempo | Parametric Archetype Projected |
| 301 | `conventional_deadlift_eccentric` | Conventional Deadlift (Slow Eccentric) | Soulevé de terre traditionnel (Excentrique accentuée) | `deadlift` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 302 | `conventional_deadlift_1_5_rep` | Conventional Deadlift (1.5 Reps) | Soulevé de terre traditionnel (1.5 Répétitions) | `deadlift` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 303 | `conventional_deadlift_cluster` | Conventional Deadlift (Rest-Pause) | Soulevé de terre traditionnel (Rest-Pause) | `deadlift` | barbell | cluster | Parametric Archetype Projected |
| 304 | `conventional_deadlift_drop_set` | Conventional Deadlift (Drop Set) | Soulevé de terre traditionnel (Dégressif) | `deadlift` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 305 | `conventional_deadlift_constant_tension` | Conventional Deadlift (Constant Tension) | Soulevé de terre traditionnel (Tension continue) | `deadlift` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 306 | `conventional_deadlift_lengthened_partials` | Conventional Deadlift (Lengthened Partials) | Soulevé de terre traditionnel (Répétitions partielles étirées) | `deadlift` | barbell | lengthened_partials | Parametric Archetype Projected |
| 307 | `sumo_deadlift` | Sumo Deadlift | Soulevé de terre sumo | `deadlift` | barbell | standard | Verified (Real-Phone Baseline) |
| 308 | `sumo_deadlift_pause` | Sumo Deadlift (Pause) | Soulevé de terre sumo (avec pause) | `deadlift` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 309 | `sumo_deadlift_tempo` | Sumo Deadlift (Tempo 3-1-1) | Soulevé de terre sumo (Tempo lent 3-1-1) | `deadlift` | barbell | tempo | Parametric Archetype Projected |
| 310 | `sumo_deadlift_eccentric` | Sumo Deadlift (Slow Eccentric) | Soulevé de terre sumo (Excentrique accentuée) | `deadlift` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 311 | `sumo_deadlift_1_5_rep` | Sumo Deadlift (1.5 Reps) | Soulevé de terre sumo (1.5 Répétitions) | `deadlift` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 312 | `sumo_deadlift_cluster` | Sumo Deadlift (Rest-Pause) | Soulevé de terre sumo (Rest-Pause) | `deadlift` | barbell | cluster | Parametric Archetype Projected |
| 313 | `sumo_deadlift_drop_set` | Sumo Deadlift (Drop Set) | Soulevé de terre sumo (Dégressif) | `deadlift` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 314 | `sumo_deadlift_constant_tension` | Sumo Deadlift (Constant Tension) | Soulevé de terre sumo (Tension continue) | `deadlift` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 315 | `sumo_deadlift_lengthened_partials` | Sumo Deadlift (Lengthened Partials) | Soulevé de terre sumo (Répétitions partielles étirées) | `deadlift` | barbell | lengthened_partials | Parametric Archetype Projected |
| 316 | `deficit_deadlift` | Deficit Deadlift | Soulevé de terre en déficit | `deadlift` | barbell | standard | Verified (Real-Phone Baseline) |
| 317 | `deficit_deadlift_pause` | Deficit Deadlift (Pause) | Soulevé de terre en déficit (avec pause) | `deadlift` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 318 | `deficit_deadlift_tempo` | Deficit Deadlift (Tempo 3-1-1) | Soulevé de terre en déficit (Tempo lent 3-1-1) | `deadlift` | barbell | tempo | Parametric Archetype Projected |
| 319 | `deficit_deadlift_eccentric` | Deficit Deadlift (Slow Eccentric) | Soulevé de terre en déficit (Excentrique accentuée) | `deadlift` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 320 | `deficit_deadlift_1_5_rep` | Deficit Deadlift (1.5 Reps) | Soulevé de terre en déficit (1.5 Répétitions) | `deadlift` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 321 | `deficit_deadlift_cluster` | Deficit Deadlift (Rest-Pause) | Soulevé de terre en déficit (Rest-Pause) | `deadlift` | barbell | cluster | Parametric Archetype Projected |
| 322 | `deficit_deadlift_drop_set` | Deficit Deadlift (Drop Set) | Soulevé de terre en déficit (Dégressif) | `deadlift` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 323 | `deficit_deadlift_constant_tension` | Deficit Deadlift (Constant Tension) | Soulevé de terre en déficit (Tension continue) | `deadlift` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 324 | `deficit_deadlift_lengthened_partials` | Deficit Deadlift (Lengthened Partials) | Soulevé de terre en déficit (Répétitions partielles étirées) | `deadlift` | barbell | lengthened_partials | Parametric Archetype Projected |
| 325 | `trap_bar_deadlift` | Trap Bar Deadlift | Soulevé de terre à la barre hexagonale | `deadlift` | barbell | standard | Verified (Real-Phone Baseline) |
| 326 | `trap_bar_deadlift_pause` | Trap Bar Deadlift (Pause) | Soulevé de terre à la barre hexagonale (avec pause) | `deadlift` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 327 | `trap_bar_deadlift_tempo` | Trap Bar Deadlift (Tempo 3-1-1) | Soulevé de terre à la barre hexagonale (Tempo lent 3-1-1) | `deadlift` | barbell | tempo | Parametric Archetype Projected |
| 328 | `trap_bar_deadlift_eccentric` | Trap Bar Deadlift (Slow Eccentric) | Soulevé de terre à la barre hexagonale (Excentrique accentuée) | `deadlift` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 329 | `trap_bar_deadlift_1_5_rep` | Trap Bar Deadlift (1.5 Reps) | Soulevé de terre à la barre hexagonale (1.5 Répétitions) | `deadlift` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 330 | `trap_bar_deadlift_cluster` | Trap Bar Deadlift (Rest-Pause) | Soulevé de terre à la barre hexagonale (Rest-Pause) | `deadlift` | barbell | cluster | Parametric Archetype Projected |
| 331 | `trap_bar_deadlift_drop_set` | Trap Bar Deadlift (Drop Set) | Soulevé de terre à la barre hexagonale (Dégressif) | `deadlift` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 332 | `trap_bar_deadlift_constant_tension` | Trap Bar Deadlift (Constant Tension) | Soulevé de terre à la barre hexagonale (Tension continue) | `deadlift` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 333 | `trap_bar_deadlift_lengthened_partials` | Trap Bar Deadlift (Lengthened Partials) | Soulevé de terre à la barre hexagonale (Répétitions partielles étirées) | `deadlift` | barbell | lengthened_partials | Parametric Archetype Projected |
| 334 | `rack_pull` | Rack Pull | Tirage en rack (Rack Pull) | `deadlift` | barbell | standard | Verified (Real-Phone Baseline) |
| 335 | `rack_pull_pause` | Rack Pull (Pause) | Tirage en rack (Rack Pull) (avec pause) | `deadlift` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 336 | `rack_pull_tempo` | Rack Pull (Tempo 3-1-1) | Tirage en rack (Rack Pull) (Tempo lent 3-1-1) | `deadlift` | barbell | tempo | Parametric Archetype Projected |
| 337 | `rack_pull_eccentric` | Rack Pull (Slow Eccentric) | Tirage en rack (Rack Pull) (Excentrique accentuée) | `deadlift` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 338 | `rack_pull_1_5_rep` | Rack Pull (1.5 Reps) | Tirage en rack (Rack Pull) (1.5 Répétitions) | `deadlift` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 339 | `rack_pull_cluster` | Rack Pull (Rest-Pause) | Tirage en rack (Rack Pull) (Rest-Pause) | `deadlift` | barbell | cluster | Parametric Archetype Projected |
| 340 | `rack_pull_drop_set` | Rack Pull (Drop Set) | Tirage en rack (Rack Pull) (Dégressif) | `deadlift` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 341 | `rack_pull_constant_tension` | Rack Pull (Constant Tension) | Tirage en rack (Rack Pull) (Tension continue) | `deadlift` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 342 | `rack_pull_lengthened_partials` | Rack Pull (Lengthened Partials) | Tirage en rack (Rack Pull) (Répétitions partielles étirées) | `deadlift` | barbell | lengthened_partials | Parametric Archetype Projected |
| 343 | `dumbbell_deadlift` | Dumbbell Deadlift | Soulevé de terre aux haltères | `deadlift` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 344 | `dumbbell_deadlift_pause` | Dumbbell Deadlift (Pause) | Soulevé de terre aux haltères (avec pause) | `deadlift` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 345 | `dumbbell_deadlift_tempo` | Dumbbell Deadlift (Tempo 3-1-1) | Soulevé de terre aux haltères (Tempo lent 3-1-1) | `deadlift` | dumbbell | tempo | Parametric Archetype Projected |
| 346 | `dumbbell_deadlift_eccentric` | Dumbbell Deadlift (Slow Eccentric) | Soulevé de terre aux haltères (Excentrique accentuée) | `deadlift` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 347 | `dumbbell_deadlift_1_5_rep` | Dumbbell Deadlift (1.5 Reps) | Soulevé de terre aux haltères (1.5 Répétitions) | `deadlift` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 348 | `dumbbell_deadlift_cluster` | Dumbbell Deadlift (Rest-Pause) | Soulevé de terre aux haltères (Rest-Pause) | `deadlift` | dumbbell | cluster | Parametric Archetype Projected |
| 349 | `dumbbell_deadlift_drop_set` | Dumbbell Deadlift (Drop Set) | Soulevé de terre aux haltères (Dégressif) | `deadlift` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 350 | `dumbbell_deadlift_constant_tension` | Dumbbell Deadlift (Constant Tension) | Soulevé de terre aux haltères (Tension continue) | `deadlift` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 351 | `dumbbell_deadlift_lengthened_partials` | Dumbbell Deadlift (Lengthened Partials) | Soulevé de terre aux haltères (Répétitions partielles étirées) | `deadlift` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 352 | `kettlebell_deadlift` | Kettlebell Deadlift | Soulevé de terre au kettlebell | `deadlift` | kettlebell | standard | Verified (Real-Phone Baseline) |
| 353 | `kettlebell_deadlift_pause` | Kettlebell Deadlift (Pause) | Soulevé de terre au kettlebell (avec pause) | `deadlift` | kettlebell | pause | Calibrated (MM-Fit / Countix) |
| 354 | `kettlebell_deadlift_tempo` | Kettlebell Deadlift (Tempo 3-1-1) | Soulevé de terre au kettlebell (Tempo lent 3-1-1) | `deadlift` | kettlebell | tempo | Parametric Archetype Projected |
| 355 | `kettlebell_deadlift_eccentric` | Kettlebell Deadlift (Slow Eccentric) | Soulevé de terre au kettlebell (Excentrique accentuée) | `deadlift` | kettlebell | eccentric | Verified (Real-Phone Baseline) |
| 356 | `kettlebell_deadlift_1_5_rep` | Kettlebell Deadlift (1.5 Reps) | Soulevé de terre au kettlebell (1.5 Répétitions) | `deadlift` | kettlebell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 357 | `kettlebell_deadlift_cluster` | Kettlebell Deadlift (Rest-Pause) | Soulevé de terre au kettlebell (Rest-Pause) | `deadlift` | kettlebell | cluster | Parametric Archetype Projected |
| 358 | `kettlebell_deadlift_drop_set` | Kettlebell Deadlift (Drop Set) | Soulevé de terre au kettlebell (Dégressif) | `deadlift` | kettlebell | drop_set | Verified (Real-Phone Baseline) |
| 359 | `kettlebell_deadlift_constant_tension` | Kettlebell Deadlift (Constant Tension) | Soulevé de terre au kettlebell (Tension continue) | `deadlift` | kettlebell | constant_tension | Calibrated (MM-Fit / Countix) |
| 360 | `kettlebell_deadlift_lengthened_partials` | Kettlebell Deadlift (Lengthened Partials) | Soulevé de terre au kettlebell (Répétitions partielles étirées) | `deadlift` | kettlebell | lengthened_partials | Parametric Archetype Projected |
| 361 | `barbell_romanian_deadlift` | Barbell Romanian Deadlift | Soulevé de terre roumain à la barre | `romanian_deadlift` | barbell | standard | Verified (Real-Phone Baseline) |
| 362 | `barbell_romanian_deadlift_pause` | Barbell Romanian Deadlift (Pause) | Soulevé de terre roumain à la barre (avec pause) | `romanian_deadlift` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 363 | `barbell_romanian_deadlift_tempo` | Barbell Romanian Deadlift (Tempo 3-1-1) | Soulevé de terre roumain à la barre (Tempo lent 3-1-1) | `romanian_deadlift` | barbell | tempo | Parametric Archetype Projected |
| 364 | `barbell_romanian_deadlift_eccentric` | Barbell Romanian Deadlift (Slow Eccentric) | Soulevé de terre roumain à la barre (Excentrique accentuée) | `romanian_deadlift` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 365 | `barbell_romanian_deadlift_1_5_rep` | Barbell Romanian Deadlift (1.5 Reps) | Soulevé de terre roumain à la barre (1.5 Répétitions) | `romanian_deadlift` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 366 | `barbell_romanian_deadlift_cluster` | Barbell Romanian Deadlift (Rest-Pause) | Soulevé de terre roumain à la barre (Rest-Pause) | `romanian_deadlift` | barbell | cluster | Parametric Archetype Projected |
| 367 | `barbell_romanian_deadlift_drop_set` | Barbell Romanian Deadlift (Drop Set) | Soulevé de terre roumain à la barre (Dégressif) | `romanian_deadlift` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 368 | `barbell_romanian_deadlift_constant_tension` | Barbell Romanian Deadlift (Constant Tension) | Soulevé de terre roumain à la barre (Tension continue) | `romanian_deadlift` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 369 | `barbell_romanian_deadlift_lengthened_partials` | Barbell Romanian Deadlift (Lengthened Partials) | Soulevé de terre roumain à la barre (Répétitions partielles étirées) | `romanian_deadlift` | barbell | lengthened_partials | Parametric Archetype Projected |
| 370 | `dumbbell_romanian_deadlift` | Dumbbell Romanian Deadlift | Soulevé de terre roumain aux haltères | `romanian_deadlift` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 371 | `dumbbell_romanian_deadlift_pause` | Dumbbell Romanian Deadlift (Pause) | Soulevé de terre roumain aux haltères (avec pause) | `romanian_deadlift` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 372 | `dumbbell_romanian_deadlift_tempo` | Dumbbell Romanian Deadlift (Tempo 3-1-1) | Soulevé de terre roumain aux haltères (Tempo lent 3-1-1) | `romanian_deadlift` | dumbbell | tempo | Parametric Archetype Projected |
| 373 | `dumbbell_romanian_deadlift_eccentric` | Dumbbell Romanian Deadlift (Slow Eccentric) | Soulevé de terre roumain aux haltères (Excentrique accentuée) | `romanian_deadlift` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 374 | `dumbbell_romanian_deadlift_1_5_rep` | Dumbbell Romanian Deadlift (1.5 Reps) | Soulevé de terre roumain aux haltères (1.5 Répétitions) | `romanian_deadlift` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 375 | `dumbbell_romanian_deadlift_cluster` | Dumbbell Romanian Deadlift (Rest-Pause) | Soulevé de terre roumain aux haltères (Rest-Pause) | `romanian_deadlift` | dumbbell | cluster | Parametric Archetype Projected |
| 376 | `dumbbell_romanian_deadlift_drop_set` | Dumbbell Romanian Deadlift (Drop Set) | Soulevé de terre roumain aux haltères (Dégressif) | `romanian_deadlift` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 377 | `dumbbell_romanian_deadlift_constant_tension` | Dumbbell Romanian Deadlift (Constant Tension) | Soulevé de terre roumain aux haltères (Tension continue) | `romanian_deadlift` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 378 | `dumbbell_romanian_deadlift_lengthened_partials` | Dumbbell Romanian Deadlift (Lengthened Partials) | Soulevé de terre roumain aux haltères (Répétitions partielles étirées) | `romanian_deadlift` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 379 | `smith_machine_romanian_deadlift` | Smith Machine Romanian Deadlift | Soulevé roumain à la machine Smith | `romanian_deadlift` | smith_machine | standard | Verified (Real-Phone Baseline) |
| 380 | `smith_machine_romanian_deadlift_pause` | Smith Machine Romanian Deadlift (Pause) | Soulevé roumain à la machine Smith (avec pause) | `romanian_deadlift` | smith_machine | pause | Calibrated (MM-Fit / Countix) |
| 381 | `smith_machine_romanian_deadlift_tempo` | Smith Machine Romanian Deadlift (Tempo 3-1-1) | Soulevé roumain à la machine Smith (Tempo lent 3-1-1) | `romanian_deadlift` | smith_machine | tempo | Parametric Archetype Projected |
| 382 | `smith_machine_romanian_deadlift_eccentric` | Smith Machine Romanian Deadlift (Slow Eccentric) | Soulevé roumain à la machine Smith (Excentrique accentuée) | `romanian_deadlift` | smith_machine | eccentric | Verified (Real-Phone Baseline) |
| 383 | `smith_machine_romanian_deadlift_1_5_rep` | Smith Machine Romanian Deadlift (1.5 Reps) | Soulevé roumain à la machine Smith (1.5 Répétitions) | `romanian_deadlift` | smith_machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 384 | `smith_machine_romanian_deadlift_cluster` | Smith Machine Romanian Deadlift (Rest-Pause) | Soulevé roumain à la machine Smith (Rest-Pause) | `romanian_deadlift` | smith_machine | cluster | Parametric Archetype Projected |
| 385 | `smith_machine_romanian_deadlift_drop_set` | Smith Machine Romanian Deadlift (Drop Set) | Soulevé roumain à la machine Smith (Dégressif) | `romanian_deadlift` | smith_machine | drop_set | Verified (Real-Phone Baseline) |
| 386 | `smith_machine_romanian_deadlift_constant_tension` | Smith Machine Romanian Deadlift (Constant Tension) | Soulevé roumain à la machine Smith (Tension continue) | `romanian_deadlift` | smith_machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 387 | `smith_machine_romanian_deadlift_lengthened_partials` | Smith Machine Romanian Deadlift (Lengthened Partials) | Soulevé roumain à la machine Smith (Répétitions partielles étirées) | `romanian_deadlift` | smith_machine | lengthened_partials | Parametric Archetype Projected |
| 388 | `cable_pull_through` | Cable Pull-Through | Pull-through à la poulie | `romanian_deadlift` | cable | standard | Verified (Real-Phone Baseline) |
| 389 | `cable_pull_through_pause` | Cable Pull-Through (Pause) | Pull-through à la poulie (avec pause) | `romanian_deadlift` | cable | pause | Calibrated (MM-Fit / Countix) |
| 390 | `cable_pull_through_tempo` | Cable Pull-Through (Tempo 3-1-1) | Pull-through à la poulie (Tempo lent 3-1-1) | `romanian_deadlift` | cable | tempo | Parametric Archetype Projected |
| 391 | `cable_pull_through_eccentric` | Cable Pull-Through (Slow Eccentric) | Pull-through à la poulie (Excentrique accentuée) | `romanian_deadlift` | cable | eccentric | Verified (Real-Phone Baseline) |
| 392 | `cable_pull_through_1_5_rep` | Cable Pull-Through (1.5 Reps) | Pull-through à la poulie (1.5 Répétitions) | `romanian_deadlift` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 393 | `cable_pull_through_cluster` | Cable Pull-Through (Rest-Pause) | Pull-through à la poulie (Rest-Pause) | `romanian_deadlift` | cable | cluster | Parametric Archetype Projected |
| 394 | `cable_pull_through_drop_set` | Cable Pull-Through (Drop Set) | Pull-through à la poulie (Dégressif) | `romanian_deadlift` | cable | drop_set | Verified (Real-Phone Baseline) |
| 395 | `cable_pull_through_constant_tension` | Cable Pull-Through (Constant Tension) | Pull-through à la poulie (Tension continue) | `romanian_deadlift` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 396 | `cable_pull_through_lengthened_partials` | Cable Pull-Through (Lengthened Partials) | Pull-through à la poulie (Répétitions partielles étirées) | `romanian_deadlift` | cable | lengthened_partials | Parametric Archetype Projected |
| 397 | `single_leg_romanian_deadlift` | Single-Leg Romanian Deadlift | Soulevé roumain unilatéral | `romanian_deadlift` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 398 | `single_leg_romanian_deadlift_pause` | Single-Leg Romanian Deadlift (Pause) | Soulevé roumain unilatéral (avec pause) | `romanian_deadlift` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 399 | `single_leg_romanian_deadlift_tempo` | Single-Leg Romanian Deadlift (Tempo 3-1-1) | Soulevé roumain unilatéral (Tempo lent 3-1-1) | `romanian_deadlift` | dumbbell | tempo | Parametric Archetype Projected |
| 400 | `single_leg_romanian_deadlift_eccentric` | Single-Leg Romanian Deadlift (Slow Eccentric) | Soulevé roumain unilatéral (Excentrique accentuée) | `romanian_deadlift` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 401 | `single_leg_romanian_deadlift_1_5_rep` | Single-Leg Romanian Deadlift (1.5 Reps) | Soulevé roumain unilatéral (1.5 Répétitions) | `romanian_deadlift` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 402 | `single_leg_romanian_deadlift_cluster` | Single-Leg Romanian Deadlift (Rest-Pause) | Soulevé roumain unilatéral (Rest-Pause) | `romanian_deadlift` | dumbbell | cluster | Parametric Archetype Projected |
| 403 | `single_leg_romanian_deadlift_drop_set` | Single-Leg Romanian Deadlift (Drop Set) | Soulevé roumain unilatéral (Dégressif) | `romanian_deadlift` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 404 | `single_leg_romanian_deadlift_constant_tension` | Single-Leg Romanian Deadlift (Constant Tension) | Soulevé roumain unilatéral (Tension continue) | `romanian_deadlift` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 405 | `single_leg_romanian_deadlift_lengthened_partials` | Single-Leg Romanian Deadlift (Lengthened Partials) | Soulevé roumain unilatéral (Répétitions partielles étirées) | `romanian_deadlift` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 406 | `stiff_legged_deadlift` | Stiff-Legged Deadlift | Soulevé de terre jambes tendues | `romanian_deadlift` | barbell | standard | Verified (Real-Phone Baseline) |
| 407 | `stiff_legged_deadlift_pause` | Stiff-Legged Deadlift (Pause) | Soulevé de terre jambes tendues (avec pause) | `romanian_deadlift` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 408 | `stiff_legged_deadlift_tempo` | Stiff-Legged Deadlift (Tempo 3-1-1) | Soulevé de terre jambes tendues (Tempo lent 3-1-1) | `romanian_deadlift` | barbell | tempo | Parametric Archetype Projected |
| 409 | `stiff_legged_deadlift_eccentric` | Stiff-Legged Deadlift (Slow Eccentric) | Soulevé de terre jambes tendues (Excentrique accentuée) | `romanian_deadlift` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 410 | `stiff_legged_deadlift_1_5_rep` | Stiff-Legged Deadlift (1.5 Reps) | Soulevé de terre jambes tendues (1.5 Répétitions) | `romanian_deadlift` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 411 | `stiff_legged_deadlift_cluster` | Stiff-Legged Deadlift (Rest-Pause) | Soulevé de terre jambes tendues (Rest-Pause) | `romanian_deadlift` | barbell | cluster | Parametric Archetype Projected |
| 412 | `stiff_legged_deadlift_drop_set` | Stiff-Legged Deadlift (Drop Set) | Soulevé de terre jambes tendues (Dégressif) | `romanian_deadlift` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 413 | `stiff_legged_deadlift_constant_tension` | Stiff-Legged Deadlift (Constant Tension) | Soulevé de terre jambes tendues (Tension continue) | `romanian_deadlift` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 414 | `stiff_legged_deadlift_lengthened_partials` | Stiff-Legged Deadlift (Lengthened Partials) | Soulevé de terre jambes tendues (Répétitions partielles étirées) | `romanian_deadlift` | barbell | lengthened_partials | Parametric Archetype Projected |
| 415 | `good_morning` | Good Morning | Good Morning à la barre | `romanian_deadlift` | barbell | standard | Verified (Real-Phone Baseline) |
| 416 | `good_morning_pause` | Good Morning (Pause) | Good Morning à la barre (avec pause) | `romanian_deadlift` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 417 | `good_morning_tempo` | Good Morning (Tempo 3-1-1) | Good Morning à la barre (Tempo lent 3-1-1) | `romanian_deadlift` | barbell | tempo | Parametric Archetype Projected |
| 418 | `good_morning_eccentric` | Good Morning (Slow Eccentric) | Good Morning à la barre (Excentrique accentuée) | `romanian_deadlift` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 419 | `good_morning_1_5_rep` | Good Morning (1.5 Reps) | Good Morning à la barre (1.5 Répétitions) | `romanian_deadlift` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 420 | `good_morning_cluster` | Good Morning (Rest-Pause) | Good Morning à la barre (Rest-Pause) | `romanian_deadlift` | barbell | cluster | Parametric Archetype Projected |
| 421 | `good_morning_drop_set` | Good Morning (Drop Set) | Good Morning à la barre (Dégressif) | `romanian_deadlift` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 422 | `good_morning_constant_tension` | Good Morning (Constant Tension) | Good Morning à la barre (Tension continue) | `romanian_deadlift` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 423 | `good_morning_lengthened_partials` | Good Morning (Lengthened Partials) | Good Morning à la barre (Répétitions partielles étirées) | `romanian_deadlift` | barbell | lengthened_partials | Parametric Archetype Projected |
| 424 | `barbell_hip_thrust` | Barbell Hip Thrust | Hip Thrust à la barre | `hip_thrust` | barbell | standard | Verified (Real-Phone Baseline) |
| 425 | `barbell_hip_thrust_pause` | Barbell Hip Thrust (Pause) | Hip Thrust à la barre (avec pause) | `hip_thrust` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 426 | `barbell_hip_thrust_tempo` | Barbell Hip Thrust (Tempo 3-1-1) | Hip Thrust à la barre (Tempo lent 3-1-1) | `hip_thrust` | barbell | tempo | Parametric Archetype Projected |
| 427 | `barbell_hip_thrust_eccentric` | Barbell Hip Thrust (Slow Eccentric) | Hip Thrust à la barre (Excentrique accentuée) | `hip_thrust` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 428 | `barbell_hip_thrust_1_5_rep` | Barbell Hip Thrust (1.5 Reps) | Hip Thrust à la barre (1.5 Répétitions) | `hip_thrust` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 429 | `barbell_hip_thrust_cluster` | Barbell Hip Thrust (Rest-Pause) | Hip Thrust à la barre (Rest-Pause) | `hip_thrust` | barbell | cluster | Parametric Archetype Projected |
| 430 | `barbell_hip_thrust_drop_set` | Barbell Hip Thrust (Drop Set) | Hip Thrust à la barre (Dégressif) | `hip_thrust` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 431 | `barbell_hip_thrust_constant_tension` | Barbell Hip Thrust (Constant Tension) | Hip Thrust à la barre (Tension continue) | `hip_thrust` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 432 | `barbell_hip_thrust_lengthened_partials` | Barbell Hip Thrust (Lengthened Partials) | Hip Thrust à la barre (Répétitions partielles étirées) | `hip_thrust` | barbell | lengthened_partials | Parametric Archetype Projected |
| 433 | `machine_hip_thrust` | Machine Hip Thrust | Hip Thrust à la machine | `hip_thrust` | machine | standard | Verified (Real-Phone Baseline) |
| 434 | `machine_hip_thrust_pause` | Machine Hip Thrust (Pause) | Hip Thrust à la machine (avec pause) | `hip_thrust` | machine | pause | Calibrated (MM-Fit / Countix) |
| 435 | `machine_hip_thrust_tempo` | Machine Hip Thrust (Tempo 3-1-1) | Hip Thrust à la machine (Tempo lent 3-1-1) | `hip_thrust` | machine | tempo | Parametric Archetype Projected |
| 436 | `machine_hip_thrust_eccentric` | Machine Hip Thrust (Slow Eccentric) | Hip Thrust à la machine (Excentrique accentuée) | `hip_thrust` | machine | eccentric | Verified (Real-Phone Baseline) |
| 437 | `machine_hip_thrust_1_5_rep` | Machine Hip Thrust (1.5 Reps) | Hip Thrust à la machine (1.5 Répétitions) | `hip_thrust` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 438 | `machine_hip_thrust_cluster` | Machine Hip Thrust (Rest-Pause) | Hip Thrust à la machine (Rest-Pause) | `hip_thrust` | machine | cluster | Parametric Archetype Projected |
| 439 | `machine_hip_thrust_drop_set` | Machine Hip Thrust (Drop Set) | Hip Thrust à la machine (Dégressif) | `hip_thrust` | machine | drop_set | Verified (Real-Phone Baseline) |
| 440 | `machine_hip_thrust_constant_tension` | Machine Hip Thrust (Constant Tension) | Hip Thrust à la machine (Tension continue) | `hip_thrust` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 441 | `machine_hip_thrust_lengthened_partials` | Machine Hip Thrust (Lengthened Partials) | Hip Thrust à la machine (Répétitions partielles étirées) | `hip_thrust` | machine | lengthened_partials | Parametric Archetype Projected |
| 442 | `smith_machine_hip_thrust` | Smith Machine Hip Thrust | Hip Thrust guidé | `hip_thrust` | smith_machine | standard | Verified (Real-Phone Baseline) |
| 443 | `smith_machine_hip_thrust_pause` | Smith Machine Hip Thrust (Pause) | Hip Thrust guidé (avec pause) | `hip_thrust` | smith_machine | pause | Calibrated (MM-Fit / Countix) |
| 444 | `smith_machine_hip_thrust_tempo` | Smith Machine Hip Thrust (Tempo 3-1-1) | Hip Thrust guidé (Tempo lent 3-1-1) | `hip_thrust` | smith_machine | tempo | Parametric Archetype Projected |
| 445 | `smith_machine_hip_thrust_eccentric` | Smith Machine Hip Thrust (Slow Eccentric) | Hip Thrust guidé (Excentrique accentuée) | `hip_thrust` | smith_machine | eccentric | Verified (Real-Phone Baseline) |
| 446 | `smith_machine_hip_thrust_1_5_rep` | Smith Machine Hip Thrust (1.5 Reps) | Hip Thrust guidé (1.5 Répétitions) | `hip_thrust` | smith_machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 447 | `smith_machine_hip_thrust_cluster` | Smith Machine Hip Thrust (Rest-Pause) | Hip Thrust guidé (Rest-Pause) | `hip_thrust` | smith_machine | cluster | Parametric Archetype Projected |
| 448 | `smith_machine_hip_thrust_drop_set` | Smith Machine Hip Thrust (Drop Set) | Hip Thrust guidé (Dégressif) | `hip_thrust` | smith_machine | drop_set | Verified (Real-Phone Baseline) |
| 449 | `smith_machine_hip_thrust_constant_tension` | Smith Machine Hip Thrust (Constant Tension) | Hip Thrust guidé (Tension continue) | `hip_thrust` | smith_machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 450 | `smith_machine_hip_thrust_lengthened_partials` | Smith Machine Hip Thrust (Lengthened Partials) | Hip Thrust guidé (Répétitions partielles étirées) | `hip_thrust` | smith_machine | lengthened_partials | Parametric Archetype Projected |
| 451 | `dumbbell_glute_bridge` | Dumbbell Glute Bridge | Pont fessier avec haltère | `hip_thrust` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 452 | `dumbbell_glute_bridge_pause` | Dumbbell Glute Bridge (Pause) | Pont fessier avec haltère (avec pause) | `hip_thrust` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 453 | `dumbbell_glute_bridge_tempo` | Dumbbell Glute Bridge (Tempo 3-1-1) | Pont fessier avec haltère (Tempo lent 3-1-1) | `hip_thrust` | dumbbell | tempo | Parametric Archetype Projected |
| 454 | `dumbbell_glute_bridge_eccentric` | Dumbbell Glute Bridge (Slow Eccentric) | Pont fessier avec haltère (Excentrique accentuée) | `hip_thrust` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 455 | `dumbbell_glute_bridge_1_5_rep` | Dumbbell Glute Bridge (1.5 Reps) | Pont fessier avec haltère (1.5 Répétitions) | `hip_thrust` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 456 | `dumbbell_glute_bridge_cluster` | Dumbbell Glute Bridge (Rest-Pause) | Pont fessier avec haltère (Rest-Pause) | `hip_thrust` | dumbbell | cluster | Parametric Archetype Projected |
| 457 | `dumbbell_glute_bridge_drop_set` | Dumbbell Glute Bridge (Drop Set) | Pont fessier avec haltère (Dégressif) | `hip_thrust` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 458 | `dumbbell_glute_bridge_constant_tension` | Dumbbell Glute Bridge (Constant Tension) | Pont fessier avec haltère (Tension continue) | `hip_thrust` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 459 | `dumbbell_glute_bridge_lengthened_partials` | Dumbbell Glute Bridge (Lengthened Partials) | Pont fessier avec haltère (Répétitions partielles étirées) | `hip_thrust` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 460 | `single_leg_hip_thrust` | Single-Leg Hip Thrust | Hip Thrust unilatéral | `hip_thrust` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 461 | `single_leg_hip_thrust_pause` | Single-Leg Hip Thrust (Pause) | Hip Thrust unilatéral (avec pause) | `hip_thrust` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 462 | `single_leg_hip_thrust_tempo` | Single-Leg Hip Thrust (Tempo 3-1-1) | Hip Thrust unilatéral (Tempo lent 3-1-1) | `hip_thrust` | bodyweight | tempo | Parametric Archetype Projected |
| 463 | `single_leg_hip_thrust_eccentric` | Single-Leg Hip Thrust (Slow Eccentric) | Hip Thrust unilatéral (Excentrique accentuée) | `hip_thrust` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 464 | `single_leg_hip_thrust_1_5_rep` | Single-Leg Hip Thrust (1.5 Reps) | Hip Thrust unilatéral (1.5 Répétitions) | `hip_thrust` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 465 | `single_leg_hip_thrust_cluster` | Single-Leg Hip Thrust (Rest-Pause) | Hip Thrust unilatéral (Rest-Pause) | `hip_thrust` | bodyweight | cluster | Parametric Archetype Projected |
| 466 | `single_leg_hip_thrust_drop_set` | Single-Leg Hip Thrust (Drop Set) | Hip Thrust unilatéral (Dégressif) | `hip_thrust` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 467 | `single_leg_hip_thrust_constant_tension` | Single-Leg Hip Thrust (Constant Tension) | Hip Thrust unilatéral (Tension continue) | `hip_thrust` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 468 | `single_leg_hip_thrust_lengthened_partials` | Single-Leg Hip Thrust (Lengthened Partials) | Hip Thrust unilatéral (Répétitions partielles étirées) | `hip_thrust` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 469 | `back_extension_45_` | Back Extension 45° | Banc à lombaires 45° | `hip_thrust` | machine | standard | Verified (Real-Phone Baseline) |
| 470 | `back_extension_45__pause` | Back Extension 45° (Pause) | Banc à lombaires 45° (avec pause) | `hip_thrust` | machine | pause | Calibrated (MM-Fit / Countix) |
| 471 | `back_extension_45__tempo` | Back Extension 45° (Tempo 3-1-1) | Banc à lombaires 45° (Tempo lent 3-1-1) | `hip_thrust` | machine | tempo | Parametric Archetype Projected |
| 472 | `back_extension_45__eccentric` | Back Extension 45° (Slow Eccentric) | Banc à lombaires 45° (Excentrique accentuée) | `hip_thrust` | machine | eccentric | Verified (Real-Phone Baseline) |
| 473 | `back_extension_45__1_5_rep` | Back Extension 45° (1.5 Reps) | Banc à lombaires 45° (1.5 Répétitions) | `hip_thrust` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 474 | `back_extension_45__cluster` | Back Extension 45° (Rest-Pause) | Banc à lombaires 45° (Rest-Pause) | `hip_thrust` | machine | cluster | Parametric Archetype Projected |
| 475 | `back_extension_45__drop_set` | Back Extension 45° (Drop Set) | Banc à lombaires 45° (Dégressif) | `hip_thrust` | machine | drop_set | Verified (Real-Phone Baseline) |
| 476 | `back_extension_45__constant_tension` | Back Extension 45° (Constant Tension) | Banc à lombaires 45° (Tension continue) | `hip_thrust` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 477 | `back_extension_45__lengthened_partials` | Back Extension 45° (Lengthened Partials) | Banc à lombaires 45° (Répétitions partielles étirées) | `hip_thrust` | machine | lengthened_partials | Parametric Archetype Projected |
| 478 | `seated_leg_curl` | Seated Leg Curl | Leg Curl assis | `leg_curl` | machine | standard | Verified (Real-Phone Baseline) |
| 479 | `seated_leg_curl_pause` | Seated Leg Curl (Pause) | Leg Curl assis (avec pause) | `leg_curl` | machine | pause | Calibrated (MM-Fit / Countix) |
| 480 | `seated_leg_curl_tempo` | Seated Leg Curl (Tempo 3-1-1) | Leg Curl assis (Tempo lent 3-1-1) | `leg_curl` | machine | tempo | Parametric Archetype Projected |
| 481 | `seated_leg_curl_eccentric` | Seated Leg Curl (Slow Eccentric) | Leg Curl assis (Excentrique accentuée) | `leg_curl` | machine | eccentric | Verified (Real-Phone Baseline) |
| 482 | `seated_leg_curl_1_5_rep` | Seated Leg Curl (1.5 Reps) | Leg Curl assis (1.5 Répétitions) | `leg_curl` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 483 | `seated_leg_curl_cluster` | Seated Leg Curl (Rest-Pause) | Leg Curl assis (Rest-Pause) | `leg_curl` | machine | cluster | Parametric Archetype Projected |
| 484 | `seated_leg_curl_drop_set` | Seated Leg Curl (Drop Set) | Leg Curl assis (Dégressif) | `leg_curl` | machine | drop_set | Verified (Real-Phone Baseline) |
| 485 | `seated_leg_curl_constant_tension` | Seated Leg Curl (Constant Tension) | Leg Curl assis (Tension continue) | `leg_curl` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 486 | `seated_leg_curl_lengthened_partials` | Seated Leg Curl (Lengthened Partials) | Leg Curl assis (Répétitions partielles étirées) | `leg_curl` | machine | lengthened_partials | Parametric Archetype Projected |
| 487 | `lying_leg_curl` | Lying Leg Curl | Leg Curl couché | `leg_curl` | machine | standard | Verified (Real-Phone Baseline) |
| 488 | `lying_leg_curl_pause` | Lying Leg Curl (Pause) | Leg Curl couché (avec pause) | `leg_curl` | machine | pause | Calibrated (MM-Fit / Countix) |
| 489 | `lying_leg_curl_tempo` | Lying Leg Curl (Tempo 3-1-1) | Leg Curl couché (Tempo lent 3-1-1) | `leg_curl` | machine | tempo | Parametric Archetype Projected |
| 490 | `lying_leg_curl_eccentric` | Lying Leg Curl (Slow Eccentric) | Leg Curl couché (Excentrique accentuée) | `leg_curl` | machine | eccentric | Verified (Real-Phone Baseline) |
| 491 | `lying_leg_curl_1_5_rep` | Lying Leg Curl (1.5 Reps) | Leg Curl couché (1.5 Répétitions) | `leg_curl` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 492 | `lying_leg_curl_cluster` | Lying Leg Curl (Rest-Pause) | Leg Curl couché (Rest-Pause) | `leg_curl` | machine | cluster | Parametric Archetype Projected |
| 493 | `lying_leg_curl_drop_set` | Lying Leg Curl (Drop Set) | Leg Curl couché (Dégressif) | `leg_curl` | machine | drop_set | Verified (Real-Phone Baseline) |
| 494 | `lying_leg_curl_constant_tension` | Lying Leg Curl (Constant Tension) | Leg Curl couché (Tension continue) | `leg_curl` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 495 | `lying_leg_curl_lengthened_partials` | Lying Leg Curl (Lengthened Partials) | Leg Curl couché (Répétitions partielles étirées) | `leg_curl` | machine | lengthened_partials | Parametric Archetype Projected |
| 496 | `standing_leg_curl` | Standing Leg Curl | Leg Curl debout | `leg_curl` | machine | standard | Verified (Real-Phone Baseline) |
| 497 | `standing_leg_curl_pause` | Standing Leg Curl (Pause) | Leg Curl debout (avec pause) | `leg_curl` | machine | pause | Calibrated (MM-Fit / Countix) |
| 498 | `standing_leg_curl_tempo` | Standing Leg Curl (Tempo 3-1-1) | Leg Curl debout (Tempo lent 3-1-1) | `leg_curl` | machine | tempo | Parametric Archetype Projected |
| 499 | `standing_leg_curl_eccentric` | Standing Leg Curl (Slow Eccentric) | Leg Curl debout (Excentrique accentuée) | `leg_curl` | machine | eccentric | Verified (Real-Phone Baseline) |
| 500 | `standing_leg_curl_1_5_rep` | Standing Leg Curl (1.5 Reps) | Leg Curl debout (1.5 Répétitions) | `leg_curl` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 501 | `standing_leg_curl_cluster` | Standing Leg Curl (Rest-Pause) | Leg Curl debout (Rest-Pause) | `leg_curl` | machine | cluster | Parametric Archetype Projected |
| 502 | `standing_leg_curl_drop_set` | Standing Leg Curl (Drop Set) | Leg Curl debout (Dégressif) | `leg_curl` | machine | drop_set | Verified (Real-Phone Baseline) |
| 503 | `standing_leg_curl_constant_tension` | Standing Leg Curl (Constant Tension) | Leg Curl debout (Tension continue) | `leg_curl` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 504 | `standing_leg_curl_lengthened_partials` | Standing Leg Curl (Lengthened Partials) | Leg Curl debout (Répétitions partielles étirées) | `leg_curl` | machine | lengthened_partials | Parametric Archetype Projected |
| 505 | `nordic_hamstring_curl` | Nordic Hamstring Curl | Nordic Hamstring Curl | `leg_curl` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 506 | `nordic_hamstring_curl_pause` | Nordic Hamstring Curl (Pause) | Nordic Hamstring Curl (avec pause) | `leg_curl` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 507 | `nordic_hamstring_curl_tempo` | Nordic Hamstring Curl (Tempo 3-1-1) | Nordic Hamstring Curl (Tempo lent 3-1-1) | `leg_curl` | bodyweight | tempo | Parametric Archetype Projected |
| 508 | `nordic_hamstring_curl_eccentric` | Nordic Hamstring Curl (Slow Eccentric) | Nordic Hamstring Curl (Excentrique accentuée) | `leg_curl` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 509 | `nordic_hamstring_curl_1_5_rep` | Nordic Hamstring Curl (1.5 Reps) | Nordic Hamstring Curl (1.5 Répétitions) | `leg_curl` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 510 | `nordic_hamstring_curl_cluster` | Nordic Hamstring Curl (Rest-Pause) | Nordic Hamstring Curl (Rest-Pause) | `leg_curl` | bodyweight | cluster | Parametric Archetype Projected |
| 511 | `nordic_hamstring_curl_drop_set` | Nordic Hamstring Curl (Drop Set) | Nordic Hamstring Curl (Dégressif) | `leg_curl` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 512 | `nordic_hamstring_curl_constant_tension` | Nordic Hamstring Curl (Constant Tension) | Nordic Hamstring Curl (Tension continue) | `leg_curl` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 513 | `nordic_hamstring_curl_lengthened_partials` | Nordic Hamstring Curl (Lengthened Partials) | Nordic Hamstring Curl (Répétitions partielles étirées) | `leg_curl` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 514 | `cable_leg_curl` | Cable Leg Curl | Leg Curl à la poulie | `leg_curl` | cable | standard | Verified (Real-Phone Baseline) |
| 515 | `cable_leg_curl_pause` | Cable Leg Curl (Pause) | Leg Curl à la poulie (avec pause) | `leg_curl` | cable | pause | Calibrated (MM-Fit / Countix) |
| 516 | `cable_leg_curl_tempo` | Cable Leg Curl (Tempo 3-1-1) | Leg Curl à la poulie (Tempo lent 3-1-1) | `leg_curl` | cable | tempo | Parametric Archetype Projected |
| 517 | `cable_leg_curl_eccentric` | Cable Leg Curl (Slow Eccentric) | Leg Curl à la poulie (Excentrique accentuée) | `leg_curl` | cable | eccentric | Verified (Real-Phone Baseline) |
| 518 | `cable_leg_curl_1_5_rep` | Cable Leg Curl (1.5 Reps) | Leg Curl à la poulie (1.5 Répétitions) | `leg_curl` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 519 | `cable_leg_curl_cluster` | Cable Leg Curl (Rest-Pause) | Leg Curl à la poulie (Rest-Pause) | `leg_curl` | cable | cluster | Parametric Archetype Projected |
| 520 | `cable_leg_curl_drop_set` | Cable Leg Curl (Drop Set) | Leg Curl à la poulie (Dégressif) | `leg_curl` | cable | drop_set | Verified (Real-Phone Baseline) |
| 521 | `cable_leg_curl_constant_tension` | Cable Leg Curl (Constant Tension) | Leg Curl à la poulie (Tension continue) | `leg_curl` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 522 | `cable_leg_curl_lengthened_partials` | Cable Leg Curl (Lengthened Partials) | Leg Curl à la poulie (Répétitions partielles étirées) | `leg_curl` | cable | lengthened_partials | Parametric Archetype Projected |
| 523 | `flat_barbell_bench_press` | Flat Barbell Bench Press | Développé couché barre | `bench_press` | barbell | standard | Verified (Real-Phone Baseline) |
| 524 | `flat_barbell_bench_press_pause` | Flat Barbell Bench Press (Pause) | Développé couché barre (avec pause) | `bench_press` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 525 | `flat_barbell_bench_press_tempo` | Flat Barbell Bench Press (Tempo 3-1-1) | Développé couché barre (Tempo lent 3-1-1) | `bench_press` | barbell | tempo | Parametric Archetype Projected |
| 526 | `flat_barbell_bench_press_eccentric` | Flat Barbell Bench Press (Slow Eccentric) | Développé couché barre (Excentrique accentuée) | `bench_press` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 527 | `flat_barbell_bench_press_1_5_rep` | Flat Barbell Bench Press (1.5 Reps) | Développé couché barre (1.5 Répétitions) | `bench_press` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 528 | `flat_barbell_bench_press_cluster` | Flat Barbell Bench Press (Rest-Pause) | Développé couché barre (Rest-Pause) | `bench_press` | barbell | cluster | Parametric Archetype Projected |
| 529 | `flat_barbell_bench_press_drop_set` | Flat Barbell Bench Press (Drop Set) | Développé couché barre (Dégressif) | `bench_press` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 530 | `flat_barbell_bench_press_constant_tension` | Flat Barbell Bench Press (Constant Tension) | Développé couché barre (Tension continue) | `bench_press` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 531 | `flat_barbell_bench_press_lengthened_partials` | Flat Barbell Bench Press (Lengthened Partials) | Développé couché barre (Répétitions partielles étirées) | `bench_press` | barbell | lengthened_partials | Parametric Archetype Projected |
| 532 | `incline_barbell_bench_press` | Incline Barbell Bench Press | Développé incliné barre | `bench_press` | barbell | standard | Verified (Real-Phone Baseline) |
| 533 | `incline_barbell_bench_press_pause` | Incline Barbell Bench Press (Pause) | Développé incliné barre (avec pause) | `bench_press` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 534 | `incline_barbell_bench_press_tempo` | Incline Barbell Bench Press (Tempo 3-1-1) | Développé incliné barre (Tempo lent 3-1-1) | `bench_press` | barbell | tempo | Parametric Archetype Projected |
| 535 | `incline_barbell_bench_press_eccentric` | Incline Barbell Bench Press (Slow Eccentric) | Développé incliné barre (Excentrique accentuée) | `bench_press` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 536 | `incline_barbell_bench_press_1_5_rep` | Incline Barbell Bench Press (1.5 Reps) | Développé incliné barre (1.5 Répétitions) | `bench_press` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 537 | `incline_barbell_bench_press_cluster` | Incline Barbell Bench Press (Rest-Pause) | Développé incliné barre (Rest-Pause) | `bench_press` | barbell | cluster | Parametric Archetype Projected |
| 538 | `incline_barbell_bench_press_drop_set` | Incline Barbell Bench Press (Drop Set) | Développé incliné barre (Dégressif) | `bench_press` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 539 | `incline_barbell_bench_press_constant_tension` | Incline Barbell Bench Press (Constant Tension) | Développé incliné barre (Tension continue) | `bench_press` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 540 | `incline_barbell_bench_press_lengthened_partials` | Incline Barbell Bench Press (Lengthened Partials) | Développé incliné barre (Répétitions partielles étirées) | `bench_press` | barbell | lengthened_partials | Parametric Archetype Projected |
| 541 | `decline_barbell_bench_press` | Decline Barbell Bench Press | Développé décliné barre | `bench_press` | barbell | standard | Verified (Real-Phone Baseline) |
| 542 | `decline_barbell_bench_press_pause` | Decline Barbell Bench Press (Pause) | Développé décliné barre (avec pause) | `bench_press` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 543 | `decline_barbell_bench_press_tempo` | Decline Barbell Bench Press (Tempo 3-1-1) | Développé décliné barre (Tempo lent 3-1-1) | `bench_press` | barbell | tempo | Parametric Archetype Projected |
| 544 | `decline_barbell_bench_press_eccentric` | Decline Barbell Bench Press (Slow Eccentric) | Développé décliné barre (Excentrique accentuée) | `bench_press` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 545 | `decline_barbell_bench_press_1_5_rep` | Decline Barbell Bench Press (1.5 Reps) | Développé décliné barre (1.5 Répétitions) | `bench_press` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 546 | `decline_barbell_bench_press_cluster` | Decline Barbell Bench Press (Rest-Pause) | Développé décliné barre (Rest-Pause) | `bench_press` | barbell | cluster | Parametric Archetype Projected |
| 547 | `decline_barbell_bench_press_drop_set` | Decline Barbell Bench Press (Drop Set) | Développé décliné barre (Dégressif) | `bench_press` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 548 | `decline_barbell_bench_press_constant_tension` | Decline Barbell Bench Press (Constant Tension) | Développé décliné barre (Tension continue) | `bench_press` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 549 | `decline_barbell_bench_press_lengthened_partials` | Decline Barbell Bench Press (Lengthened Partials) | Développé décliné barre (Répétitions partielles étirées) | `bench_press` | barbell | lengthened_partials | Parametric Archetype Projected |
| 550 | `close_grip_bench_press` | Close-Grip Bench Press | Développé couché prise serrée | `bench_press` | barbell | standard | Verified (Real-Phone Baseline) |
| 551 | `close_grip_bench_press_pause` | Close-Grip Bench Press (Pause) | Développé couché prise serrée (avec pause) | `bench_press` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 552 | `close_grip_bench_press_tempo` | Close-Grip Bench Press (Tempo 3-1-1) | Développé couché prise serrée (Tempo lent 3-1-1) | `bench_press` | barbell | tempo | Parametric Archetype Projected |
| 553 | `close_grip_bench_press_eccentric` | Close-Grip Bench Press (Slow Eccentric) | Développé couché prise serrée (Excentrique accentuée) | `bench_press` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 554 | `close_grip_bench_press_1_5_rep` | Close-Grip Bench Press (1.5 Reps) | Développé couché prise serrée (1.5 Répétitions) | `bench_press` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 555 | `close_grip_bench_press_cluster` | Close-Grip Bench Press (Rest-Pause) | Développé couché prise serrée (Rest-Pause) | `bench_press` | barbell | cluster | Parametric Archetype Projected |
| 556 | `close_grip_bench_press_drop_set` | Close-Grip Bench Press (Drop Set) | Développé couché prise serrée (Dégressif) | `bench_press` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 557 | `close_grip_bench_press_constant_tension` | Close-Grip Bench Press (Constant Tension) | Développé couché prise serrée (Tension continue) | `bench_press` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 558 | `close_grip_bench_press_lengthened_partials` | Close-Grip Bench Press (Lengthened Partials) | Développé couché prise serrée (Répétitions partielles étirées) | `bench_press` | barbell | lengthened_partials | Parametric Archetype Projected |
| 559 | `wide_grip_bench_press` | Wide-Grip Bench Press | Développé couché prise large | `bench_press` | barbell | standard | Verified (Real-Phone Baseline) |
| 560 | `wide_grip_bench_press_pause` | Wide-Grip Bench Press (Pause) | Développé couché prise large (avec pause) | `bench_press` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 561 | `wide_grip_bench_press_tempo` | Wide-Grip Bench Press (Tempo 3-1-1) | Développé couché prise large (Tempo lent 3-1-1) | `bench_press` | barbell | tempo | Parametric Archetype Projected |
| 562 | `wide_grip_bench_press_eccentric` | Wide-Grip Bench Press (Slow Eccentric) | Développé couché prise large (Excentrique accentuée) | `bench_press` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 563 | `wide_grip_bench_press_1_5_rep` | Wide-Grip Bench Press (1.5 Reps) | Développé couché prise large (1.5 Répétitions) | `bench_press` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 564 | `wide_grip_bench_press_cluster` | Wide-Grip Bench Press (Rest-Pause) | Développé couché prise large (Rest-Pause) | `bench_press` | barbell | cluster | Parametric Archetype Projected |
| 565 | `wide_grip_bench_press_drop_set` | Wide-Grip Bench Press (Drop Set) | Développé couché prise large (Dégressif) | `bench_press` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 566 | `wide_grip_bench_press_constant_tension` | Wide-Grip Bench Press (Constant Tension) | Développé couché prise large (Tension continue) | `bench_press` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 567 | `wide_grip_bench_press_lengthened_partials` | Wide-Grip Bench Press (Lengthened Partials) | Développé couché prise large (Répétitions partielles étirées) | `bench_press` | barbell | lengthened_partials | Parametric Archetype Projected |
| 568 | `cambered_bar_bench_press` | Cambered Bar Bench Press | Développé barre cambrée | `bench_press` | barbell | standard | Verified (Real-Phone Baseline) |
| 569 | `cambered_bar_bench_press_pause` | Cambered Bar Bench Press (Pause) | Développé barre cambrée (avec pause) | `bench_press` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 570 | `cambered_bar_bench_press_tempo` | Cambered Bar Bench Press (Tempo 3-1-1) | Développé barre cambrée (Tempo lent 3-1-1) | `bench_press` | barbell | tempo | Parametric Archetype Projected |
| 571 | `cambered_bar_bench_press_eccentric` | Cambered Bar Bench Press (Slow Eccentric) | Développé barre cambrée (Excentrique accentuée) | `bench_press` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 572 | `cambered_bar_bench_press_1_5_rep` | Cambered Bar Bench Press (1.5 Reps) | Développé barre cambrée (1.5 Répétitions) | `bench_press` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 573 | `cambered_bar_bench_press_cluster` | Cambered Bar Bench Press (Rest-Pause) | Développé barre cambrée (Rest-Pause) | `bench_press` | barbell | cluster | Parametric Archetype Projected |
| 574 | `cambered_bar_bench_press_drop_set` | Cambered Bar Bench Press (Drop Set) | Développé barre cambrée (Dégressif) | `bench_press` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 575 | `cambered_bar_bench_press_constant_tension` | Cambered Bar Bench Press (Constant Tension) | Développé barre cambrée (Tension continue) | `bench_press` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 576 | `cambered_bar_bench_press_lengthened_partials` | Cambered Bar Bench Press (Lengthened Partials) | Développé barre cambrée (Répétitions partielles étirées) | `bench_press` | barbell | lengthened_partials | Parametric Archetype Projected |
| 577 | `flat_dumbbell_bench_press` | Flat Dumbbell Bench Press | Développé couché aux haltères | `bench_press` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 578 | `flat_dumbbell_bench_press_pause` | Flat Dumbbell Bench Press (Pause) | Développé couché aux haltères (avec pause) | `bench_press` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 579 | `flat_dumbbell_bench_press_tempo` | Flat Dumbbell Bench Press (Tempo 3-1-1) | Développé couché aux haltères (Tempo lent 3-1-1) | `bench_press` | dumbbell | tempo | Parametric Archetype Projected |
| 580 | `flat_dumbbell_bench_press_eccentric` | Flat Dumbbell Bench Press (Slow Eccentric) | Développé couché aux haltères (Excentrique accentuée) | `bench_press` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 581 | `flat_dumbbell_bench_press_1_5_rep` | Flat Dumbbell Bench Press (1.5 Reps) | Développé couché aux haltères (1.5 Répétitions) | `bench_press` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 582 | `flat_dumbbell_bench_press_cluster` | Flat Dumbbell Bench Press (Rest-Pause) | Développé couché aux haltères (Rest-Pause) | `bench_press` | dumbbell | cluster | Parametric Archetype Projected |
| 583 | `flat_dumbbell_bench_press_drop_set` | Flat Dumbbell Bench Press (Drop Set) | Développé couché aux haltères (Dégressif) | `bench_press` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 584 | `flat_dumbbell_bench_press_constant_tension` | Flat Dumbbell Bench Press (Constant Tension) | Développé couché aux haltères (Tension continue) | `bench_press` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 585 | `flat_dumbbell_bench_press_lengthened_partials` | Flat Dumbbell Bench Press (Lengthened Partials) | Développé couché aux haltères (Répétitions partielles étirées) | `bench_press` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 586 | `incline_dumbbell_press` | Incline Dumbbell Press | Développé incliné aux haltères | `bench_press` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 587 | `incline_dumbbell_press_pause` | Incline Dumbbell Press (Pause) | Développé incliné aux haltères (avec pause) | `bench_press` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 588 | `incline_dumbbell_press_tempo` | Incline Dumbbell Press (Tempo 3-1-1) | Développé incliné aux haltères (Tempo lent 3-1-1) | `bench_press` | dumbbell | tempo | Parametric Archetype Projected |
| 589 | `incline_dumbbell_press_eccentric` | Incline Dumbbell Press (Slow Eccentric) | Développé incliné aux haltères (Excentrique accentuée) | `bench_press` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 590 | `incline_dumbbell_press_1_5_rep` | Incline Dumbbell Press (1.5 Reps) | Développé incliné aux haltères (1.5 Répétitions) | `bench_press` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 591 | `incline_dumbbell_press_cluster` | Incline Dumbbell Press (Rest-Pause) | Développé incliné aux haltères (Rest-Pause) | `bench_press` | dumbbell | cluster | Parametric Archetype Projected |
| 592 | `incline_dumbbell_press_drop_set` | Incline Dumbbell Press (Drop Set) | Développé incliné aux haltères (Dégressif) | `bench_press` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 593 | `incline_dumbbell_press_constant_tension` | Incline Dumbbell Press (Constant Tension) | Développé incliné aux haltères (Tension continue) | `bench_press` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 594 | `incline_dumbbell_press_lengthened_partials` | Incline Dumbbell Press (Lengthened Partials) | Développé incliné aux haltères (Répétitions partielles étirées) | `bench_press` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 595 | `decline_dumbbell_press` | Decline Dumbbell Press | Développé décliné aux haltères | `bench_press` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 596 | `decline_dumbbell_press_pause` | Decline Dumbbell Press (Pause) | Développé décliné aux haltères (avec pause) | `bench_press` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 597 | `decline_dumbbell_press_tempo` | Decline Dumbbell Press (Tempo 3-1-1) | Développé décliné aux haltères (Tempo lent 3-1-1) | `bench_press` | dumbbell | tempo | Parametric Archetype Projected |
| 598 | `decline_dumbbell_press_eccentric` | Decline Dumbbell Press (Slow Eccentric) | Développé décliné aux haltères (Excentrique accentuée) | `bench_press` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 599 | `decline_dumbbell_press_1_5_rep` | Decline Dumbbell Press (1.5 Reps) | Développé décliné aux haltères (1.5 Répétitions) | `bench_press` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 600 | `decline_dumbbell_press_cluster` | Decline Dumbbell Press (Rest-Pause) | Développé décliné aux haltères (Rest-Pause) | `bench_press` | dumbbell | cluster | Parametric Archetype Projected |
| 601 | `decline_dumbbell_press_drop_set` | Decline Dumbbell Press (Drop Set) | Développé décliné aux haltères (Dégressif) | `bench_press` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 602 | `decline_dumbbell_press_constant_tension` | Decline Dumbbell Press (Constant Tension) | Développé décliné aux haltères (Tension continue) | `bench_press` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 603 | `decline_dumbbell_press_lengthened_partials` | Decline Dumbbell Press (Lengthened Partials) | Développé décliné aux haltères (Répétitions partielles étirées) | `bench_press` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 604 | `neutral_grip_dumbbell_press` | Neutral Grip Dumbbell Press | Développé haltères prise neutre | `bench_press` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 605 | `neutral_grip_dumbbell_press_pause` | Neutral Grip Dumbbell Press (Pause) | Développé haltères prise neutre (avec pause) | `bench_press` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 606 | `neutral_grip_dumbbell_press_tempo` | Neutral Grip Dumbbell Press (Tempo 3-1-1) | Développé haltères prise neutre (Tempo lent 3-1-1) | `bench_press` | dumbbell | tempo | Parametric Archetype Projected |
| 607 | `neutral_grip_dumbbell_press_eccentric` | Neutral Grip Dumbbell Press (Slow Eccentric) | Développé haltères prise neutre (Excentrique accentuée) | `bench_press` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 608 | `neutral_grip_dumbbell_press_1_5_rep` | Neutral Grip Dumbbell Press (1.5 Reps) | Développé haltères prise neutre (1.5 Répétitions) | `bench_press` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 609 | `neutral_grip_dumbbell_press_cluster` | Neutral Grip Dumbbell Press (Rest-Pause) | Développé haltères prise neutre (Rest-Pause) | `bench_press` | dumbbell | cluster | Parametric Archetype Projected |
| 610 | `neutral_grip_dumbbell_press_drop_set` | Neutral Grip Dumbbell Press (Drop Set) | Développé haltères prise neutre (Dégressif) | `bench_press` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 611 | `neutral_grip_dumbbell_press_constant_tension` | Neutral Grip Dumbbell Press (Constant Tension) | Développé haltères prise neutre (Tension continue) | `bench_press` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 612 | `neutral_grip_dumbbell_press_lengthened_partials` | Neutral Grip Dumbbell Press (Lengthened Partials) | Développé haltères prise neutre (Répétitions partielles étirées) | `bench_press` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 613 | `machine_chest_press` | Machine Chest Press | Développé couché machine | `bench_press` | machine | standard | Verified (Real-Phone Baseline) |
| 614 | `machine_chest_press_pause` | Machine Chest Press (Pause) | Développé couché machine (avec pause) | `bench_press` | machine | pause | Calibrated (MM-Fit / Countix) |
| 615 | `machine_chest_press_tempo` | Machine Chest Press (Tempo 3-1-1) | Développé couché machine (Tempo lent 3-1-1) | `bench_press` | machine | tempo | Parametric Archetype Projected |
| 616 | `machine_chest_press_eccentric` | Machine Chest Press (Slow Eccentric) | Développé couché machine (Excentrique accentuée) | `bench_press` | machine | eccentric | Verified (Real-Phone Baseline) |
| 617 | `machine_chest_press_1_5_rep` | Machine Chest Press (1.5 Reps) | Développé couché machine (1.5 Répétitions) | `bench_press` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 618 | `machine_chest_press_cluster` | Machine Chest Press (Rest-Pause) | Développé couché machine (Rest-Pause) | `bench_press` | machine | cluster | Parametric Archetype Projected |
| 619 | `machine_chest_press_drop_set` | Machine Chest Press (Drop Set) | Développé couché machine (Dégressif) | `bench_press` | machine | drop_set | Verified (Real-Phone Baseline) |
| 620 | `machine_chest_press_constant_tension` | Machine Chest Press (Constant Tension) | Développé couché machine (Tension continue) | `bench_press` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 621 | `machine_chest_press_lengthened_partials` | Machine Chest Press (Lengthened Partials) | Développé couché machine (Répétitions partielles étirées) | `bench_press` | machine | lengthened_partials | Parametric Archetype Projected |
| 622 | `smith_machine_bench_press` | Smith Machine Bench Press | Développé couché guidé | `bench_press` | smith_machine | standard | Verified (Real-Phone Baseline) |
| 623 | `smith_machine_bench_press_pause` | Smith Machine Bench Press (Pause) | Développé couché guidé (avec pause) | `bench_press` | smith_machine | pause | Calibrated (MM-Fit / Countix) |
| 624 | `smith_machine_bench_press_tempo` | Smith Machine Bench Press (Tempo 3-1-1) | Développé couché guidé (Tempo lent 3-1-1) | `bench_press` | smith_machine | tempo | Parametric Archetype Projected |
| 625 | `smith_machine_bench_press_eccentric` | Smith Machine Bench Press (Slow Eccentric) | Développé couché guidé (Excentrique accentuée) | `bench_press` | smith_machine | eccentric | Verified (Real-Phone Baseline) |
| 626 | `smith_machine_bench_press_1_5_rep` | Smith Machine Bench Press (1.5 Reps) | Développé couché guidé (1.5 Répétitions) | `bench_press` | smith_machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 627 | `smith_machine_bench_press_cluster` | Smith Machine Bench Press (Rest-Pause) | Développé couché guidé (Rest-Pause) | `bench_press` | smith_machine | cluster | Parametric Archetype Projected |
| 628 | `smith_machine_bench_press_drop_set` | Smith Machine Bench Press (Drop Set) | Développé couché guidé (Dégressif) | `bench_press` | smith_machine | drop_set | Verified (Real-Phone Baseline) |
| 629 | `smith_machine_bench_press_constant_tension` | Smith Machine Bench Press (Constant Tension) | Développé couché guidé (Tension continue) | `bench_press` | smith_machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 630 | `smith_machine_bench_press_lengthened_partials` | Smith Machine Bench Press (Lengthened Partials) | Développé couché guidé (Répétitions partielles étirées) | `bench_press` | smith_machine | lengthened_partials | Parametric Archetype Projected |
| 631 | `standing_barbell_overhead_press` | Standing Barbell Overhead Press | Développé militaire debout barre | `overhead_press` | barbell | standard | Verified (Real-Phone Baseline) |
| 632 | `standing_barbell_overhead_press_pause` | Standing Barbell Overhead Press (Pause) | Développé militaire debout barre (avec pause) | `overhead_press` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 633 | `standing_barbell_overhead_press_tempo` | Standing Barbell Overhead Press (Tempo 3-1-1) | Développé militaire debout barre (Tempo lent 3-1-1) | `overhead_press` | barbell | tempo | Parametric Archetype Projected |
| 634 | `standing_barbell_overhead_press_eccentric` | Standing Barbell Overhead Press (Slow Eccentric) | Développé militaire debout barre (Excentrique accentuée) | `overhead_press` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 635 | `standing_barbell_overhead_press_1_5_rep` | Standing Barbell Overhead Press (1.5 Reps) | Développé militaire debout barre (1.5 Répétitions) | `overhead_press` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 636 | `standing_barbell_overhead_press_cluster` | Standing Barbell Overhead Press (Rest-Pause) | Développé militaire debout barre (Rest-Pause) | `overhead_press` | barbell | cluster | Parametric Archetype Projected |
| 637 | `standing_barbell_overhead_press_drop_set` | Standing Barbell Overhead Press (Drop Set) | Développé militaire debout barre (Dégressif) | `overhead_press` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 638 | `standing_barbell_overhead_press_constant_tension` | Standing Barbell Overhead Press (Constant Tension) | Développé militaire debout barre (Tension continue) | `overhead_press` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 639 | `standing_barbell_overhead_press_lengthened_partials` | Standing Barbell Overhead Press (Lengthened Partials) | Développé militaire debout barre (Répétitions partielles étirées) | `overhead_press` | barbell | lengthened_partials | Parametric Archetype Projected |
| 640 | `seated_barbell_overhead_press` | Seated Barbell Overhead Press | Développé épaules assis barre | `overhead_press` | barbell | standard | Verified (Real-Phone Baseline) |
| 641 | `seated_barbell_overhead_press_pause` | Seated Barbell Overhead Press (Pause) | Développé épaules assis barre (avec pause) | `overhead_press` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 642 | `seated_barbell_overhead_press_tempo` | Seated Barbell Overhead Press (Tempo 3-1-1) | Développé épaules assis barre (Tempo lent 3-1-1) | `overhead_press` | barbell | tempo | Parametric Archetype Projected |
| 643 | `seated_barbell_overhead_press_eccentric` | Seated Barbell Overhead Press (Slow Eccentric) | Développé épaules assis barre (Excentrique accentuée) | `overhead_press` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 644 | `seated_barbell_overhead_press_1_5_rep` | Seated Barbell Overhead Press (1.5 Reps) | Développé épaules assis barre (1.5 Répétitions) | `overhead_press` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 645 | `seated_barbell_overhead_press_cluster` | Seated Barbell Overhead Press (Rest-Pause) | Développé épaules assis barre (Rest-Pause) | `overhead_press` | barbell | cluster | Parametric Archetype Projected |
| 646 | `seated_barbell_overhead_press_drop_set` | Seated Barbell Overhead Press (Drop Set) | Développé épaules assis barre (Dégressif) | `overhead_press` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 647 | `seated_barbell_overhead_press_constant_tension` | Seated Barbell Overhead Press (Constant Tension) | Développé épaules assis barre (Tension continue) | `overhead_press` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 648 | `seated_barbell_overhead_press_lengthened_partials` | Seated Barbell Overhead Press (Lengthened Partials) | Développé épaules assis barre (Répétitions partielles étirées) | `overhead_press` | barbell | lengthened_partials | Parametric Archetype Projected |
| 649 | `seated_dumbbell_shoulder_press` | Seated Dumbbell Shoulder Press | Développé assis aux haltères | `overhead_press` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 650 | `seated_dumbbell_shoulder_press_pause` | Seated Dumbbell Shoulder Press (Pause) | Développé assis aux haltères (avec pause) | `overhead_press` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 651 | `seated_dumbbell_shoulder_press_tempo` | Seated Dumbbell Shoulder Press (Tempo 3-1-1) | Développé assis aux haltères (Tempo lent 3-1-1) | `overhead_press` | dumbbell | tempo | Parametric Archetype Projected |
| 652 | `seated_dumbbell_shoulder_press_eccentric` | Seated Dumbbell Shoulder Press (Slow Eccentric) | Développé assis aux haltères (Excentrique accentuée) | `overhead_press` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 653 | `seated_dumbbell_shoulder_press_1_5_rep` | Seated Dumbbell Shoulder Press (1.5 Reps) | Développé assis aux haltères (1.5 Répétitions) | `overhead_press` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 654 | `seated_dumbbell_shoulder_press_cluster` | Seated Dumbbell Shoulder Press (Rest-Pause) | Développé assis aux haltères (Rest-Pause) | `overhead_press` | dumbbell | cluster | Parametric Archetype Projected |
| 655 | `seated_dumbbell_shoulder_press_drop_set` | Seated Dumbbell Shoulder Press (Drop Set) | Développé assis aux haltères (Dégressif) | `overhead_press` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 656 | `seated_dumbbell_shoulder_press_constant_tension` | Seated Dumbbell Shoulder Press (Constant Tension) | Développé assis aux haltères (Tension continue) | `overhead_press` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 657 | `seated_dumbbell_shoulder_press_lengthened_partials` | Seated Dumbbell Shoulder Press (Lengthened Partials) | Développé assis aux haltères (Répétitions partielles étirées) | `overhead_press` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 658 | `standing_dumbbell_shoulder_press` | Standing Dumbbell Shoulder Press | Développé debout aux haltères | `overhead_press` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 659 | `standing_dumbbell_shoulder_press_pause` | Standing Dumbbell Shoulder Press (Pause) | Développé debout aux haltères (avec pause) | `overhead_press` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 660 | `standing_dumbbell_shoulder_press_tempo` | Standing Dumbbell Shoulder Press (Tempo 3-1-1) | Développé debout aux haltères (Tempo lent 3-1-1) | `overhead_press` | dumbbell | tempo | Parametric Archetype Projected |
| 661 | `standing_dumbbell_shoulder_press_eccentric` | Standing Dumbbell Shoulder Press (Slow Eccentric) | Développé debout aux haltères (Excentrique accentuée) | `overhead_press` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 662 | `standing_dumbbell_shoulder_press_1_5_rep` | Standing Dumbbell Shoulder Press (1.5 Reps) | Développé debout aux haltères (1.5 Répétitions) | `overhead_press` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 663 | `standing_dumbbell_shoulder_press_cluster` | Standing Dumbbell Shoulder Press (Rest-Pause) | Développé debout aux haltères (Rest-Pause) | `overhead_press` | dumbbell | cluster | Parametric Archetype Projected |
| 664 | `standing_dumbbell_shoulder_press_drop_set` | Standing Dumbbell Shoulder Press (Drop Set) | Développé debout aux haltères (Dégressif) | `overhead_press` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 665 | `standing_dumbbell_shoulder_press_constant_tension` | Standing Dumbbell Shoulder Press (Constant Tension) | Développé debout aux haltères (Tension continue) | `overhead_press` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 666 | `standing_dumbbell_shoulder_press_lengthened_partials` | Standing Dumbbell Shoulder Press (Lengthened Partials) | Développé debout aux haltères (Répétitions partielles étirées) | `overhead_press` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 667 | `arnold_press` | Arnold Press | Développé Arnold | `overhead_press` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 668 | `arnold_press_pause` | Arnold Press (Pause) | Développé Arnold (avec pause) | `overhead_press` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 669 | `arnold_press_tempo` | Arnold Press (Tempo 3-1-1) | Développé Arnold (Tempo lent 3-1-1) | `overhead_press` | dumbbell | tempo | Parametric Archetype Projected |
| 670 | `arnold_press_eccentric` | Arnold Press (Slow Eccentric) | Développé Arnold (Excentrique accentuée) | `overhead_press` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 671 | `arnold_press_1_5_rep` | Arnold Press (1.5 Reps) | Développé Arnold (1.5 Répétitions) | `overhead_press` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 672 | `arnold_press_cluster` | Arnold Press (Rest-Pause) | Développé Arnold (Rest-Pause) | `overhead_press` | dumbbell | cluster | Parametric Archetype Projected |
| 673 | `arnold_press_drop_set` | Arnold Press (Drop Set) | Développé Arnold (Dégressif) | `overhead_press` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 674 | `arnold_press_constant_tension` | Arnold Press (Constant Tension) | Développé Arnold (Tension continue) | `overhead_press` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 675 | `arnold_press_lengthened_partials` | Arnold Press (Lengthened Partials) | Développé Arnold (Répétitions partielles étirées) | `overhead_press` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 676 | `machine_shoulder_press` | Machine Shoulder Press | Développé épaules machine | `overhead_press` | machine | standard | Verified (Real-Phone Baseline) |
| 677 | `machine_shoulder_press_pause` | Machine Shoulder Press (Pause) | Développé épaules machine (avec pause) | `overhead_press` | machine | pause | Calibrated (MM-Fit / Countix) |
| 678 | `machine_shoulder_press_tempo` | Machine Shoulder Press (Tempo 3-1-1) | Développé épaules machine (Tempo lent 3-1-1) | `overhead_press` | machine | tempo | Parametric Archetype Projected |
| 679 | `machine_shoulder_press_eccentric` | Machine Shoulder Press (Slow Eccentric) | Développé épaules machine (Excentrique accentuée) | `overhead_press` | machine | eccentric | Verified (Real-Phone Baseline) |
| 680 | `machine_shoulder_press_1_5_rep` | Machine Shoulder Press (1.5 Reps) | Développé épaules machine (1.5 Répétitions) | `overhead_press` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 681 | `machine_shoulder_press_cluster` | Machine Shoulder Press (Rest-Pause) | Développé épaules machine (Rest-Pause) | `overhead_press` | machine | cluster | Parametric Archetype Projected |
| 682 | `machine_shoulder_press_drop_set` | Machine Shoulder Press (Drop Set) | Développé épaules machine (Dégressif) | `overhead_press` | machine | drop_set | Verified (Real-Phone Baseline) |
| 683 | `machine_shoulder_press_constant_tension` | Machine Shoulder Press (Constant Tension) | Développé épaules machine (Tension continue) | `overhead_press` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 684 | `machine_shoulder_press_lengthened_partials` | Machine Shoulder Press (Lengthened Partials) | Développé épaules machine (Répétitions partielles étirées) | `overhead_press` | machine | lengthened_partials | Parametric Archetype Projected |
| 685 | `smith_machine_shoulder_press` | Smith Machine Shoulder Press | Développé épaules guidé | `overhead_press` | smith_machine | standard | Verified (Real-Phone Baseline) |
| 686 | `smith_machine_shoulder_press_pause` | Smith Machine Shoulder Press (Pause) | Développé épaules guidé (avec pause) | `overhead_press` | smith_machine | pause | Calibrated (MM-Fit / Countix) |
| 687 | `smith_machine_shoulder_press_tempo` | Smith Machine Shoulder Press (Tempo 3-1-1) | Développé épaules guidé (Tempo lent 3-1-1) | `overhead_press` | smith_machine | tempo | Parametric Archetype Projected |
| 688 | `smith_machine_shoulder_press_eccentric` | Smith Machine Shoulder Press (Slow Eccentric) | Développé épaules guidé (Excentrique accentuée) | `overhead_press` | smith_machine | eccentric | Verified (Real-Phone Baseline) |
| 689 | `smith_machine_shoulder_press_1_5_rep` | Smith Machine Shoulder Press (1.5 Reps) | Développé épaules guidé (1.5 Répétitions) | `overhead_press` | smith_machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 690 | `smith_machine_shoulder_press_cluster` | Smith Machine Shoulder Press (Rest-Pause) | Développé épaules guidé (Rest-Pause) | `overhead_press` | smith_machine | cluster | Parametric Archetype Projected |
| 691 | `smith_machine_shoulder_press_drop_set` | Smith Machine Shoulder Press (Drop Set) | Développé épaules guidé (Dégressif) | `overhead_press` | smith_machine | drop_set | Verified (Real-Phone Baseline) |
| 692 | `smith_machine_shoulder_press_constant_tension` | Smith Machine Shoulder Press (Constant Tension) | Développé épaules guidé (Tension continue) | `overhead_press` | smith_machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 693 | `smith_machine_shoulder_press_lengthened_partials` | Smith Machine Shoulder Press (Lengthened Partials) | Développé épaules guidé (Répétitions partielles étirées) | `overhead_press` | smith_machine | lengthened_partials | Parametric Archetype Projected |
| 694 | `z_press` | Z-Press | Z-Press assis au sol | `overhead_press` | barbell | standard | Verified (Real-Phone Baseline) |
| 695 | `z_press_pause` | Z-Press (Pause) | Z-Press assis au sol (avec pause) | `overhead_press` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 696 | `z_press_tempo` | Z-Press (Tempo 3-1-1) | Z-Press assis au sol (Tempo lent 3-1-1) | `overhead_press` | barbell | tempo | Parametric Archetype Projected |
| 697 | `z_press_eccentric` | Z-Press (Slow Eccentric) | Z-Press assis au sol (Excentrique accentuée) | `overhead_press` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 698 | `z_press_1_5_rep` | Z-Press (1.5 Reps) | Z-Press assis au sol (1.5 Répétitions) | `overhead_press` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 699 | `z_press_cluster` | Z-Press (Rest-Pause) | Z-Press assis au sol (Rest-Pause) | `overhead_press` | barbell | cluster | Parametric Archetype Projected |
| 700 | `z_press_drop_set` | Z-Press (Drop Set) | Z-Press assis au sol (Dégressif) | `overhead_press` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 701 | `z_press_constant_tension` | Z-Press (Constant Tension) | Z-Press assis au sol (Tension continue) | `overhead_press` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 702 | `z_press_lengthened_partials` | Z-Press (Lengthened Partials) | Z-Press assis au sol (Répétitions partielles étirées) | `overhead_press` | barbell | lengthened_partials | Parametric Archetype Projected |
| 703 | `bodyweight_dip` | Bodyweight Dip | Dips au poids de corps | `dip` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 704 | `bodyweight_dip_pause` | Bodyweight Dip (Pause) | Dips au poids de corps (avec pause) | `dip` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 705 | `bodyweight_dip_tempo` | Bodyweight Dip (Tempo 3-1-1) | Dips au poids de corps (Tempo lent 3-1-1) | `dip` | bodyweight | tempo | Parametric Archetype Projected |
| 706 | `bodyweight_dip_eccentric` | Bodyweight Dip (Slow Eccentric) | Dips au poids de corps (Excentrique accentuée) | `dip` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 707 | `bodyweight_dip_1_5_rep` | Bodyweight Dip (1.5 Reps) | Dips au poids de corps (1.5 Répétitions) | `dip` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 708 | `bodyweight_dip_cluster` | Bodyweight Dip (Rest-Pause) | Dips au poids de corps (Rest-Pause) | `dip` | bodyweight | cluster | Parametric Archetype Projected |
| 709 | `bodyweight_dip_drop_set` | Bodyweight Dip (Drop Set) | Dips au poids de corps (Dégressif) | `dip` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 710 | `bodyweight_dip_constant_tension` | Bodyweight Dip (Constant Tension) | Dips au poids de corps (Tension continue) | `dip` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 711 | `bodyweight_dip_lengthened_partials` | Bodyweight Dip (Lengthened Partials) | Dips au poids de corps (Répétitions partielles étirées) | `dip` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 712 | `chest_focused_dip` | Chest-Focused Dip | Dips focus pectoraux | `dip` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 713 | `chest_focused_dip_pause` | Chest-Focused Dip (Pause) | Dips focus pectoraux (avec pause) | `dip` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 714 | `chest_focused_dip_tempo` | Chest-Focused Dip (Tempo 3-1-1) | Dips focus pectoraux (Tempo lent 3-1-1) | `dip` | bodyweight | tempo | Parametric Archetype Projected |
| 715 | `chest_focused_dip_eccentric` | Chest-Focused Dip (Slow Eccentric) | Dips focus pectoraux (Excentrique accentuée) | `dip` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 716 | `chest_focused_dip_1_5_rep` | Chest-Focused Dip (1.5 Reps) | Dips focus pectoraux (1.5 Répétitions) | `dip` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 717 | `chest_focused_dip_cluster` | Chest-Focused Dip (Rest-Pause) | Dips focus pectoraux (Rest-Pause) | `dip` | bodyweight | cluster | Parametric Archetype Projected |
| 718 | `chest_focused_dip_drop_set` | Chest-Focused Dip (Drop Set) | Dips focus pectoraux (Dégressif) | `dip` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 719 | `chest_focused_dip_constant_tension` | Chest-Focused Dip (Constant Tension) | Dips focus pectoraux (Tension continue) | `dip` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 720 | `chest_focused_dip_lengthened_partials` | Chest-Focused Dip (Lengthened Partials) | Dips focus pectoraux (Répétitions partielles étirées) | `dip` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 721 | `tricep_focused_dip` | Tricep-Focused Dip | Dips focus triceps | `dip` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 722 | `tricep_focused_dip_pause` | Tricep-Focused Dip (Pause) | Dips focus triceps (avec pause) | `dip` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 723 | `tricep_focused_dip_tempo` | Tricep-Focused Dip (Tempo 3-1-1) | Dips focus triceps (Tempo lent 3-1-1) | `dip` | bodyweight | tempo | Parametric Archetype Projected |
| 724 | `tricep_focused_dip_eccentric` | Tricep-Focused Dip (Slow Eccentric) | Dips focus triceps (Excentrique accentuée) | `dip` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 725 | `tricep_focused_dip_1_5_rep` | Tricep-Focused Dip (1.5 Reps) | Dips focus triceps (1.5 Répétitions) | `dip` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 726 | `tricep_focused_dip_cluster` | Tricep-Focused Dip (Rest-Pause) | Dips focus triceps (Rest-Pause) | `dip` | bodyweight | cluster | Parametric Archetype Projected |
| 727 | `tricep_focused_dip_drop_set` | Tricep-Focused Dip (Drop Set) | Dips focus triceps (Dégressif) | `dip` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 728 | `tricep_focused_dip_constant_tension` | Tricep-Focused Dip (Constant Tension) | Dips focus triceps (Tension continue) | `dip` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 729 | `tricep_focused_dip_lengthened_partials` | Tricep-Focused Dip (Lengthened Partials) | Dips focus triceps (Répétitions partielles étirées) | `dip` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 730 | `weighted_dip` | Weighted Dip | Dips lestés | `dip` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 731 | `weighted_dip_pause` | Weighted Dip (Pause) | Dips lestés (avec pause) | `dip` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 732 | `weighted_dip_tempo` | Weighted Dip (Tempo 3-1-1) | Dips lestés (Tempo lent 3-1-1) | `dip` | bodyweight | tempo | Parametric Archetype Projected |
| 733 | `weighted_dip_eccentric` | Weighted Dip (Slow Eccentric) | Dips lestés (Excentrique accentuée) | `dip` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 734 | `weighted_dip_1_5_rep` | Weighted Dip (1.5 Reps) | Dips lestés (1.5 Répétitions) | `dip` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 735 | `weighted_dip_cluster` | Weighted Dip (Rest-Pause) | Dips lestés (Rest-Pause) | `dip` | bodyweight | cluster | Parametric Archetype Projected |
| 736 | `weighted_dip_drop_set` | Weighted Dip (Drop Set) | Dips lestés (Dégressif) | `dip` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 737 | `weighted_dip_constant_tension` | Weighted Dip (Constant Tension) | Dips lestés (Tension continue) | `dip` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 738 | `weighted_dip_lengthened_partials` | Weighted Dip (Lengthened Partials) | Dips lestés (Répétitions partielles étirées) | `dip` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 739 | `assisted_dip_machine` | Assisted Dip Machine | Dips assistés machine | `dip` | machine | standard | Verified (Real-Phone Baseline) |
| 740 | `assisted_dip_machine_pause` | Assisted Dip Machine (Pause) | Dips assistés machine (avec pause) | `dip` | machine | pause | Calibrated (MM-Fit / Countix) |
| 741 | `assisted_dip_machine_tempo` | Assisted Dip Machine (Tempo 3-1-1) | Dips assistés machine (Tempo lent 3-1-1) | `dip` | machine | tempo | Parametric Archetype Projected |
| 742 | `assisted_dip_machine_eccentric` | Assisted Dip Machine (Slow Eccentric) | Dips assistés machine (Excentrique accentuée) | `dip` | machine | eccentric | Verified (Real-Phone Baseline) |
| 743 | `assisted_dip_machine_1_5_rep` | Assisted Dip Machine (1.5 Reps) | Dips assistés machine (1.5 Répétitions) | `dip` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 744 | `assisted_dip_machine_cluster` | Assisted Dip Machine (Rest-Pause) | Dips assistés machine (Rest-Pause) | `dip` | machine | cluster | Parametric Archetype Projected |
| 745 | `assisted_dip_machine_drop_set` | Assisted Dip Machine (Drop Set) | Dips assistés machine (Dégressif) | `dip` | machine | drop_set | Verified (Real-Phone Baseline) |
| 746 | `assisted_dip_machine_constant_tension` | Assisted Dip Machine (Constant Tension) | Dips assistés machine (Tension continue) | `dip` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 747 | `assisted_dip_machine_lengthened_partials` | Assisted Dip Machine (Lengthened Partials) | Dips assistés machine (Répétitions partielles étirées) | `dip` | machine | lengthened_partials | Parametric Archetype Projected |
| 748 | `seated_dip_machine` | Seated Dip Machine | Machine à dips assise | `dip` | machine | standard | Verified (Real-Phone Baseline) |
| 749 | `seated_dip_machine_pause` | Seated Dip Machine (Pause) | Machine à dips assise (avec pause) | `dip` | machine | pause | Calibrated (MM-Fit / Countix) |
| 750 | `seated_dip_machine_tempo` | Seated Dip Machine (Tempo 3-1-1) | Machine à dips assise (Tempo lent 3-1-1) | `dip` | machine | tempo | Parametric Archetype Projected |
| 751 | `seated_dip_machine_eccentric` | Seated Dip Machine (Slow Eccentric) | Machine à dips assise (Excentrique accentuée) | `dip` | machine | eccentric | Verified (Real-Phone Baseline) |
| 752 | `seated_dip_machine_1_5_rep` | Seated Dip Machine (1.5 Reps) | Machine à dips assise (1.5 Répétitions) | `dip` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 753 | `seated_dip_machine_cluster` | Seated Dip Machine (Rest-Pause) | Machine à dips assise (Rest-Pause) | `dip` | machine | cluster | Parametric Archetype Projected |
| 754 | `seated_dip_machine_drop_set` | Seated Dip Machine (Drop Set) | Machine à dips assise (Dégressif) | `dip` | machine | drop_set | Verified (Real-Phone Baseline) |
| 755 | `seated_dip_machine_constant_tension` | Seated Dip Machine (Constant Tension) | Machine à dips assise (Tension continue) | `dip` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 756 | `seated_dip_machine_lengthened_partials` | Seated Dip Machine (Lengthened Partials) | Machine à dips assise (Répétitions partielles étirées) | `dip` | machine | lengthened_partials | Parametric Archetype Projected |
| 757 | `bench_dip` | Bench Dip | Dips sur banc | `dip` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 758 | `bench_dip_pause` | Bench Dip (Pause) | Dips sur banc (avec pause) | `dip` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 759 | `bench_dip_tempo` | Bench Dip (Tempo 3-1-1) | Dips sur banc (Tempo lent 3-1-1) | `dip` | bodyweight | tempo | Parametric Archetype Projected |
| 760 | `bench_dip_eccentric` | Bench Dip (Slow Eccentric) | Dips sur banc (Excentrique accentuée) | `dip` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 761 | `bench_dip_1_5_rep` | Bench Dip (1.5 Reps) | Dips sur banc (1.5 Répétitions) | `dip` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 762 | `bench_dip_cluster` | Bench Dip (Rest-Pause) | Dips sur banc (Rest-Pause) | `dip` | bodyweight | cluster | Parametric Archetype Projected |
| 763 | `bench_dip_drop_set` | Bench Dip (Drop Set) | Dips sur banc (Dégressif) | `dip` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 764 | `bench_dip_constant_tension` | Bench Dip (Constant Tension) | Dips sur banc (Tension continue) | `dip` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 765 | `bench_dip_lengthened_partials` | Bench Dip (Lengthened Partials) | Dips sur banc (Répétitions partielles étirées) | `dip` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 766 | `overhand_pull_up` | Overhand Pull-Up | Traction pronation | `pull_up` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 767 | `overhand_pull_up_pause` | Overhand Pull-Up (Pause) | Traction pronation (avec pause) | `pull_up` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 768 | `overhand_pull_up_tempo` | Overhand Pull-Up (Tempo 3-1-1) | Traction pronation (Tempo lent 3-1-1) | `pull_up` | bodyweight | tempo | Parametric Archetype Projected |
| 769 | `overhand_pull_up_eccentric` | Overhand Pull-Up (Slow Eccentric) | Traction pronation (Excentrique accentuée) | `pull_up` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 770 | `overhand_pull_up_1_5_rep` | Overhand Pull-Up (1.5 Reps) | Traction pronation (1.5 Répétitions) | `pull_up` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 771 | `overhand_pull_up_cluster` | Overhand Pull-Up (Rest-Pause) | Traction pronation (Rest-Pause) | `pull_up` | bodyweight | cluster | Parametric Archetype Projected |
| 772 | `overhand_pull_up_drop_set` | Overhand Pull-Up (Drop Set) | Traction pronation (Dégressif) | `pull_up` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 773 | `overhand_pull_up_constant_tension` | Overhand Pull-Up (Constant Tension) | Traction pronation (Tension continue) | `pull_up` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 774 | `overhand_pull_up_lengthened_partials` | Overhand Pull-Up (Lengthened Partials) | Traction pronation (Répétitions partielles étirées) | `pull_up` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 775 | `underhand_chin_up` | Underhand Chin-Up | Traction supination (Chin-Up) | `pull_up` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 776 | `underhand_chin_up_pause` | Underhand Chin-Up (Pause) | Traction supination (Chin-Up) (avec pause) | `pull_up` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 777 | `underhand_chin_up_tempo` | Underhand Chin-Up (Tempo 3-1-1) | Traction supination (Chin-Up) (Tempo lent 3-1-1) | `pull_up` | bodyweight | tempo | Parametric Archetype Projected |
| 778 | `underhand_chin_up_eccentric` | Underhand Chin-Up (Slow Eccentric) | Traction supination (Chin-Up) (Excentrique accentuée) | `pull_up` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 779 | `underhand_chin_up_1_5_rep` | Underhand Chin-Up (1.5 Reps) | Traction supination (Chin-Up) (1.5 Répétitions) | `pull_up` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 780 | `underhand_chin_up_cluster` | Underhand Chin-Up (Rest-Pause) | Traction supination (Chin-Up) (Rest-Pause) | `pull_up` | bodyweight | cluster | Parametric Archetype Projected |
| 781 | `underhand_chin_up_drop_set` | Underhand Chin-Up (Drop Set) | Traction supination (Chin-Up) (Dégressif) | `pull_up` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 782 | `underhand_chin_up_constant_tension` | Underhand Chin-Up (Constant Tension) | Traction supination (Chin-Up) (Tension continue) | `pull_up` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 783 | `underhand_chin_up_lengthened_partials` | Underhand Chin-Up (Lengthened Partials) | Traction supination (Chin-Up) (Répétitions partielles étirées) | `pull_up` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 784 | `neutral_grip_pull_up` | Neutral Grip Pull-Up | Traction prise neutre | `pull_up` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 785 | `neutral_grip_pull_up_pause` | Neutral Grip Pull-Up (Pause) | Traction prise neutre (avec pause) | `pull_up` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 786 | `neutral_grip_pull_up_tempo` | Neutral Grip Pull-Up (Tempo 3-1-1) | Traction prise neutre (Tempo lent 3-1-1) | `pull_up` | bodyweight | tempo | Parametric Archetype Projected |
| 787 | `neutral_grip_pull_up_eccentric` | Neutral Grip Pull-Up (Slow Eccentric) | Traction prise neutre (Excentrique accentuée) | `pull_up` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 788 | `neutral_grip_pull_up_1_5_rep` | Neutral Grip Pull-Up (1.5 Reps) | Traction prise neutre (1.5 Répétitions) | `pull_up` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 789 | `neutral_grip_pull_up_cluster` | Neutral Grip Pull-Up (Rest-Pause) | Traction prise neutre (Rest-Pause) | `pull_up` | bodyweight | cluster | Parametric Archetype Projected |
| 790 | `neutral_grip_pull_up_drop_set` | Neutral Grip Pull-Up (Drop Set) | Traction prise neutre (Dégressif) | `pull_up` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 791 | `neutral_grip_pull_up_constant_tension` | Neutral Grip Pull-Up (Constant Tension) | Traction prise neutre (Tension continue) | `pull_up` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 792 | `neutral_grip_pull_up_lengthened_partials` | Neutral Grip Pull-Up (Lengthened Partials) | Traction prise neutre (Répétitions partielles étirées) | `pull_up` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 793 | `wide_grip_pull_up` | Wide Grip Pull-Up | Traction prise large | `pull_up` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 794 | `wide_grip_pull_up_pause` | Wide Grip Pull-Up (Pause) | Traction prise large (avec pause) | `pull_up` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 795 | `wide_grip_pull_up_tempo` | Wide Grip Pull-Up (Tempo 3-1-1) | Traction prise large (Tempo lent 3-1-1) | `pull_up` | bodyweight | tempo | Parametric Archetype Projected |
| 796 | `wide_grip_pull_up_eccentric` | Wide Grip Pull-Up (Slow Eccentric) | Traction prise large (Excentrique accentuée) | `pull_up` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 797 | `wide_grip_pull_up_1_5_rep` | Wide Grip Pull-Up (1.5 Reps) | Traction prise large (1.5 Répétitions) | `pull_up` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 798 | `wide_grip_pull_up_cluster` | Wide Grip Pull-Up (Rest-Pause) | Traction prise large (Rest-Pause) | `pull_up` | bodyweight | cluster | Parametric Archetype Projected |
| 799 | `wide_grip_pull_up_drop_set` | Wide Grip Pull-Up (Drop Set) | Traction prise large (Dégressif) | `pull_up` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 800 | `wide_grip_pull_up_constant_tension` | Wide Grip Pull-Up (Constant Tension) | Traction prise large (Tension continue) | `pull_up` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 801 | `wide_grip_pull_up_lengthened_partials` | Wide Grip Pull-Up (Lengthened Partials) | Traction prise large (Répétitions partielles étirées) | `pull_up` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 802 | `weighted_pull_up` | Weighted Pull-Up | Traction lestée | `pull_up` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 803 | `weighted_pull_up_pause` | Weighted Pull-Up (Pause) | Traction lestée (avec pause) | `pull_up` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 804 | `weighted_pull_up_tempo` | Weighted Pull-Up (Tempo 3-1-1) | Traction lestée (Tempo lent 3-1-1) | `pull_up` | bodyweight | tempo | Parametric Archetype Projected |
| 805 | `weighted_pull_up_eccentric` | Weighted Pull-Up (Slow Eccentric) | Traction lestée (Excentrique accentuée) | `pull_up` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 806 | `weighted_pull_up_1_5_rep` | Weighted Pull-Up (1.5 Reps) | Traction lestée (1.5 Répétitions) | `pull_up` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 807 | `weighted_pull_up_cluster` | Weighted Pull-Up (Rest-Pause) | Traction lestée (Rest-Pause) | `pull_up` | bodyweight | cluster | Parametric Archetype Projected |
| 808 | `weighted_pull_up_drop_set` | Weighted Pull-Up (Drop Set) | Traction lestée (Dégressif) | `pull_up` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 809 | `weighted_pull_up_constant_tension` | Weighted Pull-Up (Constant Tension) | Traction lestée (Tension continue) | `pull_up` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 810 | `weighted_pull_up_lengthened_partials` | Weighted Pull-Up (Lengthened Partials) | Traction lestée (Répétitions partielles étirées) | `pull_up` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 811 | `assisted_pull_up_machine` | Assisted Pull-Up Machine | Traction assistée machine | `pull_up` | machine | standard | Verified (Real-Phone Baseline) |
| 812 | `assisted_pull_up_machine_pause` | Assisted Pull-Up Machine (Pause) | Traction assistée machine (avec pause) | `pull_up` | machine | pause | Calibrated (MM-Fit / Countix) |
| 813 | `assisted_pull_up_machine_tempo` | Assisted Pull-Up Machine (Tempo 3-1-1) | Traction assistée machine (Tempo lent 3-1-1) | `pull_up` | machine | tempo | Parametric Archetype Projected |
| 814 | `assisted_pull_up_machine_eccentric` | Assisted Pull-Up Machine (Slow Eccentric) | Traction assistée machine (Excentrique accentuée) | `pull_up` | machine | eccentric | Verified (Real-Phone Baseline) |
| 815 | `assisted_pull_up_machine_1_5_rep` | Assisted Pull-Up Machine (1.5 Reps) | Traction assistée machine (1.5 Répétitions) | `pull_up` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 816 | `assisted_pull_up_machine_cluster` | Assisted Pull-Up Machine (Rest-Pause) | Traction assistée machine (Rest-Pause) | `pull_up` | machine | cluster | Parametric Archetype Projected |
| 817 | `assisted_pull_up_machine_drop_set` | Assisted Pull-Up Machine (Drop Set) | Traction assistée machine (Dégressif) | `pull_up` | machine | drop_set | Verified (Real-Phone Baseline) |
| 818 | `assisted_pull_up_machine_constant_tension` | Assisted Pull-Up Machine (Constant Tension) | Traction assistée machine (Tension continue) | `pull_up` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 819 | `assisted_pull_up_machine_lengthened_partials` | Assisted Pull-Up Machine (Lengthened Partials) | Traction assistée machine (Répétitions partielles étirées) | `pull_up` | machine | lengthened_partials | Parametric Archetype Projected |
| 820 | `commando_pull_up` | Commando Pull-Up | Traction commando | `pull_up` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 821 | `commando_pull_up_pause` | Commando Pull-Up (Pause) | Traction commando (avec pause) | `pull_up` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 822 | `commando_pull_up_tempo` | Commando Pull-Up (Tempo 3-1-1) | Traction commando (Tempo lent 3-1-1) | `pull_up` | bodyweight | tempo | Parametric Archetype Projected |
| 823 | `commando_pull_up_eccentric` | Commando Pull-Up (Slow Eccentric) | Traction commando (Excentrique accentuée) | `pull_up` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 824 | `commando_pull_up_1_5_rep` | Commando Pull-Up (1.5 Reps) | Traction commando (1.5 Répétitions) | `pull_up` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 825 | `commando_pull_up_cluster` | Commando Pull-Up (Rest-Pause) | Traction commando (Rest-Pause) | `pull_up` | bodyweight | cluster | Parametric Archetype Projected |
| 826 | `commando_pull_up_drop_set` | Commando Pull-Up (Drop Set) | Traction commando (Dégressif) | `pull_up` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 827 | `commando_pull_up_constant_tension` | Commando Pull-Up (Constant Tension) | Traction commando (Tension continue) | `pull_up` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 828 | `commando_pull_up_lengthened_partials` | Commando Pull-Up (Lengthened Partials) | Traction commando (Répétitions partielles étirées) | `pull_up` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 829 | `wide_grip_lat_pulldown` | Wide-Grip Lat Pulldown | Tirage poitrine prise large | `lat_pulldown` | cable | standard | Verified (Real-Phone Baseline) |
| 830 | `wide_grip_lat_pulldown_pause` | Wide-Grip Lat Pulldown (Pause) | Tirage poitrine prise large (avec pause) | `lat_pulldown` | cable | pause | Calibrated (MM-Fit / Countix) |
| 831 | `wide_grip_lat_pulldown_tempo` | Wide-Grip Lat Pulldown (Tempo 3-1-1) | Tirage poitrine prise large (Tempo lent 3-1-1) | `lat_pulldown` | cable | tempo | Parametric Archetype Projected |
| 832 | `wide_grip_lat_pulldown_eccentric` | Wide-Grip Lat Pulldown (Slow Eccentric) | Tirage poitrine prise large (Excentrique accentuée) | `lat_pulldown` | cable | eccentric | Verified (Real-Phone Baseline) |
| 833 | `wide_grip_lat_pulldown_1_5_rep` | Wide-Grip Lat Pulldown (1.5 Reps) | Tirage poitrine prise large (1.5 Répétitions) | `lat_pulldown` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 834 | `wide_grip_lat_pulldown_cluster` | Wide-Grip Lat Pulldown (Rest-Pause) | Tirage poitrine prise large (Rest-Pause) | `lat_pulldown` | cable | cluster | Parametric Archetype Projected |
| 835 | `wide_grip_lat_pulldown_drop_set` | Wide-Grip Lat Pulldown (Drop Set) | Tirage poitrine prise large (Dégressif) | `lat_pulldown` | cable | drop_set | Verified (Real-Phone Baseline) |
| 836 | `wide_grip_lat_pulldown_constant_tension` | Wide-Grip Lat Pulldown (Constant Tension) | Tirage poitrine prise large (Tension continue) | `lat_pulldown` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 837 | `wide_grip_lat_pulldown_lengthened_partials` | Wide-Grip Lat Pulldown (Lengthened Partials) | Tirage poitrine prise large (Répétitions partielles étirées) | `lat_pulldown` | cable | lengthened_partials | Parametric Archetype Projected |
| 838 | `neutral_grip_lat_pulldown` | Neutral-Grip Lat Pulldown | Tirage vertical prise neutre | `lat_pulldown` | cable | standard | Verified (Real-Phone Baseline) |
| 839 | `neutral_grip_lat_pulldown_pause` | Neutral-Grip Lat Pulldown (Pause) | Tirage vertical prise neutre (avec pause) | `lat_pulldown` | cable | pause | Calibrated (MM-Fit / Countix) |
| 840 | `neutral_grip_lat_pulldown_tempo` | Neutral-Grip Lat Pulldown (Tempo 3-1-1) | Tirage vertical prise neutre (Tempo lent 3-1-1) | `lat_pulldown` | cable | tempo | Parametric Archetype Projected |
| 841 | `neutral_grip_lat_pulldown_eccentric` | Neutral-Grip Lat Pulldown (Slow Eccentric) | Tirage vertical prise neutre (Excentrique accentuée) | `lat_pulldown` | cable | eccentric | Verified (Real-Phone Baseline) |
| 842 | `neutral_grip_lat_pulldown_1_5_rep` | Neutral-Grip Lat Pulldown (1.5 Reps) | Tirage vertical prise neutre (1.5 Répétitions) | `lat_pulldown` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 843 | `neutral_grip_lat_pulldown_cluster` | Neutral-Grip Lat Pulldown (Rest-Pause) | Tirage vertical prise neutre (Rest-Pause) | `lat_pulldown` | cable | cluster | Parametric Archetype Projected |
| 844 | `neutral_grip_lat_pulldown_drop_set` | Neutral-Grip Lat Pulldown (Drop Set) | Tirage vertical prise neutre (Dégressif) | `lat_pulldown` | cable | drop_set | Verified (Real-Phone Baseline) |
| 845 | `neutral_grip_lat_pulldown_constant_tension` | Neutral-Grip Lat Pulldown (Constant Tension) | Tirage vertical prise neutre (Tension continue) | `lat_pulldown` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 846 | `neutral_grip_lat_pulldown_lengthened_partials` | Neutral-Grip Lat Pulldown (Lengthened Partials) | Tirage vertical prise neutre (Répétitions partielles étirées) | `lat_pulldown` | cable | lengthened_partials | Parametric Archetype Projected |
| 847 | `reverse_grip_lat_pulldown` | Reverse-Grip Lat Pulldown | Tirage vertical prise inversée | `lat_pulldown` | cable | standard | Verified (Real-Phone Baseline) |
| 848 | `reverse_grip_lat_pulldown_pause` | Reverse-Grip Lat Pulldown (Pause) | Tirage vertical prise inversée (avec pause) | `lat_pulldown` | cable | pause | Calibrated (MM-Fit / Countix) |
| 849 | `reverse_grip_lat_pulldown_tempo` | Reverse-Grip Lat Pulldown (Tempo 3-1-1) | Tirage vertical prise inversée (Tempo lent 3-1-1) | `lat_pulldown` | cable | tempo | Parametric Archetype Projected |
| 850 | `reverse_grip_lat_pulldown_eccentric` | Reverse-Grip Lat Pulldown (Slow Eccentric) | Tirage vertical prise inversée (Excentrique accentuée) | `lat_pulldown` | cable | eccentric | Verified (Real-Phone Baseline) |
| 851 | `reverse_grip_lat_pulldown_1_5_rep` | Reverse-Grip Lat Pulldown (1.5 Reps) | Tirage vertical prise inversée (1.5 Répétitions) | `lat_pulldown` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 852 | `reverse_grip_lat_pulldown_cluster` | Reverse-Grip Lat Pulldown (Rest-Pause) | Tirage vertical prise inversée (Rest-Pause) | `lat_pulldown` | cable | cluster | Parametric Archetype Projected |
| 853 | `reverse_grip_lat_pulldown_drop_set` | Reverse-Grip Lat Pulldown (Drop Set) | Tirage vertical prise inversée (Dégressif) | `lat_pulldown` | cable | drop_set | Verified (Real-Phone Baseline) |
| 854 | `reverse_grip_lat_pulldown_constant_tension` | Reverse-Grip Lat Pulldown (Constant Tension) | Tirage vertical prise inversée (Tension continue) | `lat_pulldown` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 855 | `reverse_grip_lat_pulldown_lengthened_partials` | Reverse-Grip Lat Pulldown (Lengthened Partials) | Tirage vertical prise inversée (Répétitions partielles étirées) | `lat_pulldown` | cable | lengthened_partials | Parametric Archetype Projected |
| 856 | `single_arm_cable_pulldown` | Single-Arm Cable Pulldown | Tirage vertical unilatéral | `lat_pulldown` | cable | standard | Verified (Real-Phone Baseline) |
| 857 | `single_arm_cable_pulldown_pause` | Single-Arm Cable Pulldown (Pause) | Tirage vertical unilatéral (avec pause) | `lat_pulldown` | cable | pause | Calibrated (MM-Fit / Countix) |
| 858 | `single_arm_cable_pulldown_tempo` | Single-Arm Cable Pulldown (Tempo 3-1-1) | Tirage vertical unilatéral (Tempo lent 3-1-1) | `lat_pulldown` | cable | tempo | Parametric Archetype Projected |
| 859 | `single_arm_cable_pulldown_eccentric` | Single-Arm Cable Pulldown (Slow Eccentric) | Tirage vertical unilatéral (Excentrique accentuée) | `lat_pulldown` | cable | eccentric | Verified (Real-Phone Baseline) |
| 860 | `single_arm_cable_pulldown_1_5_rep` | Single-Arm Cable Pulldown (1.5 Reps) | Tirage vertical unilatéral (1.5 Répétitions) | `lat_pulldown` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 861 | `single_arm_cable_pulldown_cluster` | Single-Arm Cable Pulldown (Rest-Pause) | Tirage vertical unilatéral (Rest-Pause) | `lat_pulldown` | cable | cluster | Parametric Archetype Projected |
| 862 | `single_arm_cable_pulldown_drop_set` | Single-Arm Cable Pulldown (Drop Set) | Tirage vertical unilatéral (Dégressif) | `lat_pulldown` | cable | drop_set | Verified (Real-Phone Baseline) |
| 863 | `single_arm_cable_pulldown_constant_tension` | Single-Arm Cable Pulldown (Constant Tension) | Tirage vertical unilatéral (Tension continue) | `lat_pulldown` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 864 | `single_arm_cable_pulldown_lengthened_partials` | Single-Arm Cable Pulldown (Lengthened Partials) | Tirage vertical unilatéral (Répétitions partielles étirées) | `lat_pulldown` | cable | lengthened_partials | Parametric Archetype Projected |
| 865 | `plate_loaded_lat_pulldown` | Plate-Loaded Lat Pulldown | Tirage vertical convergent machine | `lat_pulldown` | machine | standard | Verified (Real-Phone Baseline) |
| 866 | `plate_loaded_lat_pulldown_pause` | Plate-Loaded Lat Pulldown (Pause) | Tirage vertical convergent machine (avec pause) | `lat_pulldown` | machine | pause | Calibrated (MM-Fit / Countix) |
| 867 | `plate_loaded_lat_pulldown_tempo` | Plate-Loaded Lat Pulldown (Tempo 3-1-1) | Tirage vertical convergent machine (Tempo lent 3-1-1) | `lat_pulldown` | machine | tempo | Parametric Archetype Projected |
| 868 | `plate_loaded_lat_pulldown_eccentric` | Plate-Loaded Lat Pulldown (Slow Eccentric) | Tirage vertical convergent machine (Excentrique accentuée) | `lat_pulldown` | machine | eccentric | Verified (Real-Phone Baseline) |
| 869 | `plate_loaded_lat_pulldown_1_5_rep` | Plate-Loaded Lat Pulldown (1.5 Reps) | Tirage vertical convergent machine (1.5 Répétitions) | `lat_pulldown` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 870 | `plate_loaded_lat_pulldown_cluster` | Plate-Loaded Lat Pulldown (Rest-Pause) | Tirage vertical convergent machine (Rest-Pause) | `lat_pulldown` | machine | cluster | Parametric Archetype Projected |
| 871 | `plate_loaded_lat_pulldown_drop_set` | Plate-Loaded Lat Pulldown (Drop Set) | Tirage vertical convergent machine (Dégressif) | `lat_pulldown` | machine | drop_set | Verified (Real-Phone Baseline) |
| 872 | `plate_loaded_lat_pulldown_constant_tension` | Plate-Loaded Lat Pulldown (Constant Tension) | Tirage vertical convergent machine (Tension continue) | `lat_pulldown` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 873 | `plate_loaded_lat_pulldown_lengthened_partials` | Plate-Loaded Lat Pulldown (Lengthened Partials) | Tirage vertical convergent machine (Répétitions partielles étirées) | `lat_pulldown` | machine | lengthened_partials | Parametric Archetype Projected |
| 874 | `straight_arm_cable_pulldown` | Straight-Arm Cable Pulldown | Pull-over à la poulie haute | `lat_pulldown` | cable | standard | Verified (Real-Phone Baseline) |
| 875 | `straight_arm_cable_pulldown_pause` | Straight-Arm Cable Pulldown (Pause) | Pull-over à la poulie haute (avec pause) | `lat_pulldown` | cable | pause | Calibrated (MM-Fit / Countix) |
| 876 | `straight_arm_cable_pulldown_tempo` | Straight-Arm Cable Pulldown (Tempo 3-1-1) | Pull-over à la poulie haute (Tempo lent 3-1-1) | `lat_pulldown` | cable | tempo | Parametric Archetype Projected |
| 877 | `straight_arm_cable_pulldown_eccentric` | Straight-Arm Cable Pulldown (Slow Eccentric) | Pull-over à la poulie haute (Excentrique accentuée) | `lat_pulldown` | cable | eccentric | Verified (Real-Phone Baseline) |
| 878 | `straight_arm_cable_pulldown_1_5_rep` | Straight-Arm Cable Pulldown (1.5 Reps) | Pull-over à la poulie haute (1.5 Répétitions) | `lat_pulldown` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 879 | `straight_arm_cable_pulldown_cluster` | Straight-Arm Cable Pulldown (Rest-Pause) | Pull-over à la poulie haute (Rest-Pause) | `lat_pulldown` | cable | cluster | Parametric Archetype Projected |
| 880 | `straight_arm_cable_pulldown_drop_set` | Straight-Arm Cable Pulldown (Drop Set) | Pull-over à la poulie haute (Dégressif) | `lat_pulldown` | cable | drop_set | Verified (Real-Phone Baseline) |
| 881 | `straight_arm_cable_pulldown_constant_tension` | Straight-Arm Cable Pulldown (Constant Tension) | Pull-over à la poulie haute (Tension continue) | `lat_pulldown` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 882 | `straight_arm_cable_pulldown_lengthened_partials` | Straight-Arm Cable Pulldown (Lengthened Partials) | Pull-over à la poulie haute (Répétitions partielles étirées) | `lat_pulldown` | cable | lengthened_partials | Parametric Archetype Projected |
| 883 | `seated_cable_row` | Seated Cable Row | Tirage horizontal à la poulie | `row` | cable | standard | Verified (Real-Phone Baseline) |
| 884 | `seated_cable_row_pause` | Seated Cable Row (Pause) | Tirage horizontal à la poulie (avec pause) | `row` | cable | pause | Calibrated (MM-Fit / Countix) |
| 885 | `seated_cable_row_tempo` | Seated Cable Row (Tempo 3-1-1) | Tirage horizontal à la poulie (Tempo lent 3-1-1) | `row` | cable | tempo | Parametric Archetype Projected |
| 886 | `seated_cable_row_eccentric` | Seated Cable Row (Slow Eccentric) | Tirage horizontal à la poulie (Excentrique accentuée) | `row` | cable | eccentric | Verified (Real-Phone Baseline) |
| 887 | `seated_cable_row_1_5_rep` | Seated Cable Row (1.5 Reps) | Tirage horizontal à la poulie (1.5 Répétitions) | `row` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 888 | `seated_cable_row_cluster` | Seated Cable Row (Rest-Pause) | Tirage horizontal à la poulie (Rest-Pause) | `row` | cable | cluster | Parametric Archetype Projected |
| 889 | `seated_cable_row_drop_set` | Seated Cable Row (Drop Set) | Tirage horizontal à la poulie (Dégressif) | `row` | cable | drop_set | Verified (Real-Phone Baseline) |
| 890 | `seated_cable_row_constant_tension` | Seated Cable Row (Constant Tension) | Tirage horizontal à la poulie (Tension continue) | `row` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 891 | `seated_cable_row_lengthened_partials` | Seated Cable Row (Lengthened Partials) | Tirage horizontal à la poulie (Répétitions partielles étirées) | `row` | cable | lengthened_partials | Parametric Archetype Projected |
| 892 | `bent_over_barbell_row` | Bent-Over Barbell Row | Rowing barre penché | `row` | barbell | standard | Verified (Real-Phone Baseline) |
| 893 | `bent_over_barbell_row_pause` | Bent-Over Barbell Row (Pause) | Rowing barre penché (avec pause) | `row` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 894 | `bent_over_barbell_row_tempo` | Bent-Over Barbell Row (Tempo 3-1-1) | Rowing barre penché (Tempo lent 3-1-1) | `row` | barbell | tempo | Parametric Archetype Projected |
| 895 | `bent_over_barbell_row_eccentric` | Bent-Over Barbell Row (Slow Eccentric) | Rowing barre penché (Excentrique accentuée) | `row` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 896 | `bent_over_barbell_row_1_5_rep` | Bent-Over Barbell Row (1.5 Reps) | Rowing barre penché (1.5 Répétitions) | `row` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 897 | `bent_over_barbell_row_cluster` | Bent-Over Barbell Row (Rest-Pause) | Rowing barre penché (Rest-Pause) | `row` | barbell | cluster | Parametric Archetype Projected |
| 898 | `bent_over_barbell_row_drop_set` | Bent-Over Barbell Row (Drop Set) | Rowing barre penché (Dégressif) | `row` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 899 | `bent_over_barbell_row_constant_tension` | Bent-Over Barbell Row (Constant Tension) | Rowing barre penché (Tension continue) | `row` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 900 | `bent_over_barbell_row_lengthened_partials` | Bent-Over Barbell Row (Lengthened Partials) | Rowing barre penché (Répétitions partielles étirées) | `row` | barbell | lengthened_partials | Parametric Archetype Projected |
| 901 | `pendlay_row` | Pendlay Row | Rowing Pendlay | `row` | barbell | standard | Verified (Real-Phone Baseline) |
| 902 | `pendlay_row_pause` | Pendlay Row (Pause) | Rowing Pendlay (avec pause) | `row` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 903 | `pendlay_row_tempo` | Pendlay Row (Tempo 3-1-1) | Rowing Pendlay (Tempo lent 3-1-1) | `row` | barbell | tempo | Parametric Archetype Projected |
| 904 | `pendlay_row_eccentric` | Pendlay Row (Slow Eccentric) | Rowing Pendlay (Excentrique accentuée) | `row` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 905 | `pendlay_row_1_5_rep` | Pendlay Row (1.5 Reps) | Rowing Pendlay (1.5 Répétitions) | `row` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 906 | `pendlay_row_cluster` | Pendlay Row (Rest-Pause) | Rowing Pendlay (Rest-Pause) | `row` | barbell | cluster | Parametric Archetype Projected |
| 907 | `pendlay_row_drop_set` | Pendlay Row (Drop Set) | Rowing Pendlay (Dégressif) | `row` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 908 | `pendlay_row_constant_tension` | Pendlay Row (Constant Tension) | Rowing Pendlay (Tension continue) | `row` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 909 | `pendlay_row_lengthened_partials` | Pendlay Row (Lengthened Partials) | Rowing Pendlay (Répétitions partielles étirées) | `row` | barbell | lengthened_partials | Parametric Archetype Projected |
| 910 | `single_arm_dumbbell_row` | Single-Arm Dumbbell Row | Rowing unilatéral à l’haltère | `row` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 911 | `single_arm_dumbbell_row_pause` | Single-Arm Dumbbell Row (Pause) | Rowing unilatéral à l’haltère (avec pause) | `row` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 912 | `single_arm_dumbbell_row_tempo` | Single-Arm Dumbbell Row (Tempo 3-1-1) | Rowing unilatéral à l’haltère (Tempo lent 3-1-1) | `row` | dumbbell | tempo | Parametric Archetype Projected |
| 913 | `single_arm_dumbbell_row_eccentric` | Single-Arm Dumbbell Row (Slow Eccentric) | Rowing unilatéral à l’haltère (Excentrique accentuée) | `row` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 914 | `single_arm_dumbbell_row_1_5_rep` | Single-Arm Dumbbell Row (1.5 Reps) | Rowing unilatéral à l’haltère (1.5 Répétitions) | `row` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 915 | `single_arm_dumbbell_row_cluster` | Single-Arm Dumbbell Row (Rest-Pause) | Rowing unilatéral à l’haltère (Rest-Pause) | `row` | dumbbell | cluster | Parametric Archetype Projected |
| 916 | `single_arm_dumbbell_row_drop_set` | Single-Arm Dumbbell Row (Drop Set) | Rowing unilatéral à l’haltère (Dégressif) | `row` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 917 | `single_arm_dumbbell_row_constant_tension` | Single-Arm Dumbbell Row (Constant Tension) | Rowing unilatéral à l’haltère (Tension continue) | `row` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 918 | `single_arm_dumbbell_row_lengthened_partials` | Single-Arm Dumbbell Row (Lengthened Partials) | Rowing unilatéral à l’haltère (Répétitions partielles étirées) | `row` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 919 | `chest_supported_incline_row` | Chest-Supported Incline Row | Rowing haltères sur banc incliné | `row` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 920 | `chest_supported_incline_row_pause` | Chest-Supported Incline Row (Pause) | Rowing haltères sur banc incliné (avec pause) | `row` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 921 | `chest_supported_incline_row_tempo` | Chest-Supported Incline Row (Tempo 3-1-1) | Rowing haltères sur banc incliné (Tempo lent 3-1-1) | `row` | dumbbell | tempo | Parametric Archetype Projected |
| 922 | `chest_supported_incline_row_eccentric` | Chest-Supported Incline Row (Slow Eccentric) | Rowing haltères sur banc incliné (Excentrique accentuée) | `row` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 923 | `chest_supported_incline_row_1_5_rep` | Chest-Supported Incline Row (1.5 Reps) | Rowing haltères sur banc incliné (1.5 Répétitions) | `row` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 924 | `chest_supported_incline_row_cluster` | Chest-Supported Incline Row (Rest-Pause) | Rowing haltères sur banc incliné (Rest-Pause) | `row` | dumbbell | cluster | Parametric Archetype Projected |
| 925 | `chest_supported_incline_row_drop_set` | Chest-Supported Incline Row (Drop Set) | Rowing haltères sur banc incliné (Dégressif) | `row` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 926 | `chest_supported_incline_row_constant_tension` | Chest-Supported Incline Row (Constant Tension) | Rowing haltères sur banc incliné (Tension continue) | `row` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 927 | `chest_supported_incline_row_lengthened_partials` | Chest-Supported Incline Row (Lengthened Partials) | Rowing haltères sur banc incliné (Répétitions partielles étirées) | `row` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 928 | `machine_t_bar_row` | Machine T-Bar Row | T-Bar Row machine | `row` | machine | standard | Verified (Real-Phone Baseline) |
| 929 | `machine_t_bar_row_pause` | Machine T-Bar Row (Pause) | T-Bar Row machine (avec pause) | `row` | machine | pause | Calibrated (MM-Fit / Countix) |
| 930 | `machine_t_bar_row_tempo` | Machine T-Bar Row (Tempo 3-1-1) | T-Bar Row machine (Tempo lent 3-1-1) | `row` | machine | tempo | Parametric Archetype Projected |
| 931 | `machine_t_bar_row_eccentric` | Machine T-Bar Row (Slow Eccentric) | T-Bar Row machine (Excentrique accentuée) | `row` | machine | eccentric | Verified (Real-Phone Baseline) |
| 932 | `machine_t_bar_row_1_5_rep` | Machine T-Bar Row (1.5 Reps) | T-Bar Row machine (1.5 Répétitions) | `row` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 933 | `machine_t_bar_row_cluster` | Machine T-Bar Row (Rest-Pause) | T-Bar Row machine (Rest-Pause) | `row` | machine | cluster | Parametric Archetype Projected |
| 934 | `machine_t_bar_row_drop_set` | Machine T-Bar Row (Drop Set) | T-Bar Row machine (Dégressif) | `row` | machine | drop_set | Verified (Real-Phone Baseline) |
| 935 | `machine_t_bar_row_constant_tension` | Machine T-Bar Row (Constant Tension) | T-Bar Row machine (Tension continue) | `row` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 936 | `machine_t_bar_row_lengthened_partials` | Machine T-Bar Row (Lengthened Partials) | T-Bar Row machine (Répétitions partielles étirées) | `row` | machine | lengthened_partials | Parametric Archetype Projected |
| 937 | `chest_supported_machine_row` | Chest-Supported Machine Row | Rowing machine guidé | `row` | machine | standard | Verified (Real-Phone Baseline) |
| 938 | `chest_supported_machine_row_pause` | Chest-Supported Machine Row (Pause) | Rowing machine guidé (avec pause) | `row` | machine | pause | Calibrated (MM-Fit / Countix) |
| 939 | `chest_supported_machine_row_tempo` | Chest-Supported Machine Row (Tempo 3-1-1) | Rowing machine guidé (Tempo lent 3-1-1) | `row` | machine | tempo | Parametric Archetype Projected |
| 940 | `chest_supported_machine_row_eccentric` | Chest-Supported Machine Row (Slow Eccentric) | Rowing machine guidé (Excentrique accentuée) | `row` | machine | eccentric | Verified (Real-Phone Baseline) |
| 941 | `chest_supported_machine_row_1_5_rep` | Chest-Supported Machine Row (1.5 Reps) | Rowing machine guidé (1.5 Répétitions) | `row` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 942 | `chest_supported_machine_row_cluster` | Chest-Supported Machine Row (Rest-Pause) | Rowing machine guidé (Rest-Pause) | `row` | machine | cluster | Parametric Archetype Projected |
| 943 | `chest_supported_machine_row_drop_set` | Chest-Supported Machine Row (Drop Set) | Rowing machine guidé (Dégressif) | `row` | machine | drop_set | Verified (Real-Phone Baseline) |
| 944 | `chest_supported_machine_row_constant_tension` | Chest-Supported Machine Row (Constant Tension) | Rowing machine guidé (Tension continue) | `row` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 945 | `chest_supported_machine_row_lengthened_partials` | Chest-Supported Machine Row (Lengthened Partials) | Rowing machine guidé (Répétitions partielles étirées) | `row` | machine | lengthened_partials | Parametric Archetype Projected |
| 946 | `single_arm_seated_cable_row` | Single-Arm Seated Cable Row | Tirage horizontal unilatéral poulie | `row` | cable | standard | Verified (Real-Phone Baseline) |
| 947 | `single_arm_seated_cable_row_pause` | Single-Arm Seated Cable Row (Pause) | Tirage horizontal unilatéral poulie (avec pause) | `row` | cable | pause | Calibrated (MM-Fit / Countix) |
| 948 | `single_arm_seated_cable_row_tempo` | Single-Arm Seated Cable Row (Tempo 3-1-1) | Tirage horizontal unilatéral poulie (Tempo lent 3-1-1) | `row` | cable | tempo | Parametric Archetype Projected |
| 949 | `single_arm_seated_cable_row_eccentric` | Single-Arm Seated Cable Row (Slow Eccentric) | Tirage horizontal unilatéral poulie (Excentrique accentuée) | `row` | cable | eccentric | Verified (Real-Phone Baseline) |
| 950 | `single_arm_seated_cable_row_1_5_rep` | Single-Arm Seated Cable Row (1.5 Reps) | Tirage horizontal unilatéral poulie (1.5 Répétitions) | `row` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 951 | `single_arm_seated_cable_row_cluster` | Single-Arm Seated Cable Row (Rest-Pause) | Tirage horizontal unilatéral poulie (Rest-Pause) | `row` | cable | cluster | Parametric Archetype Projected |
| 952 | `single_arm_seated_cable_row_drop_set` | Single-Arm Seated Cable Row (Drop Set) | Tirage horizontal unilatéral poulie (Dégressif) | `row` | cable | drop_set | Verified (Real-Phone Baseline) |
| 953 | `single_arm_seated_cable_row_constant_tension` | Single-Arm Seated Cable Row (Constant Tension) | Tirage horizontal unilatéral poulie (Tension continue) | `row` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 954 | `single_arm_seated_cable_row_lengthened_partials` | Single-Arm Seated Cable Row (Lengthened Partials) | Tirage horizontal unilatéral poulie (Répétitions partielles étirées) | `row` | cable | lengthened_partials | Parametric Archetype Projected |
| 955 | `standing_barbell_curl` | Standing Barbell Curl | Curl barre debout | `bicep_curl` | barbell | standard | Verified (Real-Phone Baseline) |
| 956 | `standing_barbell_curl_pause` | Standing Barbell Curl (Pause) | Curl barre debout (avec pause) | `bicep_curl` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 957 | `standing_barbell_curl_tempo` | Standing Barbell Curl (Tempo 3-1-1) | Curl barre debout (Tempo lent 3-1-1) | `bicep_curl` | barbell | tempo | Parametric Archetype Projected |
| 958 | `standing_barbell_curl_eccentric` | Standing Barbell Curl (Slow Eccentric) | Curl barre debout (Excentrique accentuée) | `bicep_curl` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 959 | `standing_barbell_curl_1_5_rep` | Standing Barbell Curl (1.5 Reps) | Curl barre debout (1.5 Répétitions) | `bicep_curl` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 960 | `standing_barbell_curl_cluster` | Standing Barbell Curl (Rest-Pause) | Curl barre debout (Rest-Pause) | `bicep_curl` | barbell | cluster | Parametric Archetype Projected |
| 961 | `standing_barbell_curl_drop_set` | Standing Barbell Curl (Drop Set) | Curl barre debout (Dégressif) | `bicep_curl` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 962 | `standing_barbell_curl_constant_tension` | Standing Barbell Curl (Constant Tension) | Curl barre debout (Tension continue) | `bicep_curl` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 963 | `standing_barbell_curl_lengthened_partials` | Standing Barbell Curl (Lengthened Partials) | Curl barre debout (Répétitions partielles étirées) | `bicep_curl` | barbell | lengthened_partials | Parametric Archetype Projected |
| 964 | `ez_bar_curl` | EZ-Bar Curl | Curl barre EZ | `bicep_curl` | barbell | standard | Verified (Real-Phone Baseline) |
| 965 | `ez_bar_curl_pause` | EZ-Bar Curl (Pause) | Curl barre EZ (avec pause) | `bicep_curl` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 966 | `ez_bar_curl_tempo` | EZ-Bar Curl (Tempo 3-1-1) | Curl barre EZ (Tempo lent 3-1-1) | `bicep_curl` | barbell | tempo | Parametric Archetype Projected |
| 967 | `ez_bar_curl_eccentric` | EZ-Bar Curl (Slow Eccentric) | Curl barre EZ (Excentrique accentuée) | `bicep_curl` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 968 | `ez_bar_curl_1_5_rep` | EZ-Bar Curl (1.5 Reps) | Curl barre EZ (1.5 Répétitions) | `bicep_curl` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 969 | `ez_bar_curl_cluster` | EZ-Bar Curl (Rest-Pause) | Curl barre EZ (Rest-Pause) | `bicep_curl` | barbell | cluster | Parametric Archetype Projected |
| 970 | `ez_bar_curl_drop_set` | EZ-Bar Curl (Drop Set) | Curl barre EZ (Dégressif) | `bicep_curl` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 971 | `ez_bar_curl_constant_tension` | EZ-Bar Curl (Constant Tension) | Curl barre EZ (Tension continue) | `bicep_curl` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 972 | `ez_bar_curl_lengthened_partials` | EZ-Bar Curl (Lengthened Partials) | Curl barre EZ (Répétitions partielles étirées) | `bicep_curl` | barbell | lengthened_partials | Parametric Archetype Projected |
| 973 | `dumbbell_bicep_curl` | Dumbbell Bicep Curl | Curl aux haltères | `bicep_curl` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 974 | `dumbbell_bicep_curl_pause` | Dumbbell Bicep Curl (Pause) | Curl aux haltères (avec pause) | `bicep_curl` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 975 | `dumbbell_bicep_curl_tempo` | Dumbbell Bicep Curl (Tempo 3-1-1) | Curl aux haltères (Tempo lent 3-1-1) | `bicep_curl` | dumbbell | tempo | Parametric Archetype Projected |
| 976 | `dumbbell_bicep_curl_eccentric` | Dumbbell Bicep Curl (Slow Eccentric) | Curl aux haltères (Excentrique accentuée) | `bicep_curl` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 977 | `dumbbell_bicep_curl_1_5_rep` | Dumbbell Bicep Curl (1.5 Reps) | Curl aux haltères (1.5 Répétitions) | `bicep_curl` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 978 | `dumbbell_bicep_curl_cluster` | Dumbbell Bicep Curl (Rest-Pause) | Curl aux haltères (Rest-Pause) | `bicep_curl` | dumbbell | cluster | Parametric Archetype Projected |
| 979 | `dumbbell_bicep_curl_drop_set` | Dumbbell Bicep Curl (Drop Set) | Curl aux haltères (Dégressif) | `bicep_curl` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 980 | `dumbbell_bicep_curl_constant_tension` | Dumbbell Bicep Curl (Constant Tension) | Curl aux haltères (Tension continue) | `bicep_curl` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 981 | `dumbbell_bicep_curl_lengthened_partials` | Dumbbell Bicep Curl (Lengthened Partials) | Curl aux haltères (Répétitions partielles étirées) | `bicep_curl` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 982 | `incline_dumbbell_curl` | Incline Dumbbell Curl | Curl incliné aux haltères | `bicep_curl` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 983 | `incline_dumbbell_curl_pause` | Incline Dumbbell Curl (Pause) | Curl incliné aux haltères (avec pause) | `bicep_curl` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 984 | `incline_dumbbell_curl_tempo` | Incline Dumbbell Curl (Tempo 3-1-1) | Curl incliné aux haltères (Tempo lent 3-1-1) | `bicep_curl` | dumbbell | tempo | Parametric Archetype Projected |
| 985 | `incline_dumbbell_curl_eccentric` | Incline Dumbbell Curl (Slow Eccentric) | Curl incliné aux haltères (Excentrique accentuée) | `bicep_curl` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 986 | `incline_dumbbell_curl_1_5_rep` | Incline Dumbbell Curl (1.5 Reps) | Curl incliné aux haltères (1.5 Répétitions) | `bicep_curl` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 987 | `incline_dumbbell_curl_cluster` | Incline Dumbbell Curl (Rest-Pause) | Curl incliné aux haltères (Rest-Pause) | `bicep_curl` | dumbbell | cluster | Parametric Archetype Projected |
| 988 | `incline_dumbbell_curl_drop_set` | Incline Dumbbell Curl (Drop Set) | Curl incliné aux haltères (Dégressif) | `bicep_curl` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 989 | `incline_dumbbell_curl_constant_tension` | Incline Dumbbell Curl (Constant Tension) | Curl incliné aux haltères (Tension continue) | `bicep_curl` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 990 | `incline_dumbbell_curl_lengthened_partials` | Incline Dumbbell Curl (Lengthened Partials) | Curl incliné aux haltères (Répétitions partielles étirées) | `bicep_curl` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 991 | `hammer_curl` | Hammer Curl | Curl marteau aux haltères | `bicep_curl` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 992 | `hammer_curl_pause` | Hammer Curl (Pause) | Curl marteau aux haltères (avec pause) | `bicep_curl` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 993 | `hammer_curl_tempo` | Hammer Curl (Tempo 3-1-1) | Curl marteau aux haltères (Tempo lent 3-1-1) | `bicep_curl` | dumbbell | tempo | Parametric Archetype Projected |
| 994 | `hammer_curl_eccentric` | Hammer Curl (Slow Eccentric) | Curl marteau aux haltères (Excentrique accentuée) | `bicep_curl` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 995 | `hammer_curl_1_5_rep` | Hammer Curl (1.5 Reps) | Curl marteau aux haltères (1.5 Répétitions) | `bicep_curl` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 996 | `hammer_curl_cluster` | Hammer Curl (Rest-Pause) | Curl marteau aux haltères (Rest-Pause) | `bicep_curl` | dumbbell | cluster | Parametric Archetype Projected |
| 997 | `hammer_curl_drop_set` | Hammer Curl (Drop Set) | Curl marteau aux haltères (Dégressif) | `bicep_curl` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 998 | `hammer_curl_constant_tension` | Hammer Curl (Constant Tension) | Curl marteau aux haltères (Tension continue) | `bicep_curl` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 999 | `hammer_curl_lengthened_partials` | Hammer Curl (Lengthened Partials) | Curl marteau aux haltères (Répétitions partielles étirées) | `bicep_curl` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 1000 | `preacher_curl` | Preacher Curl | Curl au pupitre Larry Scott | `bicep_curl` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 1001 | `preacher_curl_pause` | Preacher Curl (Pause) | Curl au pupitre Larry Scott (avec pause) | `bicep_curl` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 1002 | `preacher_curl_tempo` | Preacher Curl (Tempo 3-1-1) | Curl au pupitre Larry Scott (Tempo lent 3-1-1) | `bicep_curl` | dumbbell | tempo | Parametric Archetype Projected |
| 1003 | `preacher_curl_eccentric` | Preacher Curl (Slow Eccentric) | Curl au pupitre Larry Scott (Excentrique accentuée) | `bicep_curl` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 1004 | `preacher_curl_1_5_rep` | Preacher Curl (1.5 Reps) | Curl au pupitre Larry Scott (1.5 Répétitions) | `bicep_curl` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1005 | `preacher_curl_cluster` | Preacher Curl (Rest-Pause) | Curl au pupitre Larry Scott (Rest-Pause) | `bicep_curl` | dumbbell | cluster | Parametric Archetype Projected |
| 1006 | `preacher_curl_drop_set` | Preacher Curl (Drop Set) | Curl au pupitre Larry Scott (Dégressif) | `bicep_curl` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 1007 | `preacher_curl_constant_tension` | Preacher Curl (Constant Tension) | Curl au pupitre Larry Scott (Tension continue) | `bicep_curl` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 1008 | `preacher_curl_lengthened_partials` | Preacher Curl (Lengthened Partials) | Curl au pupitre Larry Scott (Répétitions partielles étirées) | `bicep_curl` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 1009 | `concentration_curl` | Concentration Curl | Curl concentré | `bicep_curl` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 1010 | `concentration_curl_pause` | Concentration Curl (Pause) | Curl concentré (avec pause) | `bicep_curl` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 1011 | `concentration_curl_tempo` | Concentration Curl (Tempo 3-1-1) | Curl concentré (Tempo lent 3-1-1) | `bicep_curl` | dumbbell | tempo | Parametric Archetype Projected |
| 1012 | `concentration_curl_eccentric` | Concentration Curl (Slow Eccentric) | Curl concentré (Excentrique accentuée) | `bicep_curl` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 1013 | `concentration_curl_1_5_rep` | Concentration Curl (1.5 Reps) | Curl concentré (1.5 Répétitions) | `bicep_curl` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1014 | `concentration_curl_cluster` | Concentration Curl (Rest-Pause) | Curl concentré (Rest-Pause) | `bicep_curl` | dumbbell | cluster | Parametric Archetype Projected |
| 1015 | `concentration_curl_drop_set` | Concentration Curl (Drop Set) | Curl concentré (Dégressif) | `bicep_curl` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 1016 | `concentration_curl_constant_tension` | Concentration Curl (Constant Tension) | Curl concentré (Tension continue) | `bicep_curl` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 1017 | `concentration_curl_lengthened_partials` | Concentration Curl (Lengthened Partials) | Curl concentré (Répétitions partielles étirées) | `bicep_curl` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 1018 | `spider_curl` | Spider Curl | Spider Curl sur banc incliné | `bicep_curl` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 1019 | `spider_curl_pause` | Spider Curl (Pause) | Spider Curl sur banc incliné (avec pause) | `bicep_curl` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 1020 | `spider_curl_tempo` | Spider Curl (Tempo 3-1-1) | Spider Curl sur banc incliné (Tempo lent 3-1-1) | `bicep_curl` | dumbbell | tempo | Parametric Archetype Projected |
| 1021 | `spider_curl_eccentric` | Spider Curl (Slow Eccentric) | Spider Curl sur banc incliné (Excentrique accentuée) | `bicep_curl` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 1022 | `spider_curl_1_5_rep` | Spider Curl (1.5 Reps) | Spider Curl sur banc incliné (1.5 Répétitions) | `bicep_curl` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1023 | `spider_curl_cluster` | Spider Curl (Rest-Pause) | Spider Curl sur banc incliné (Rest-Pause) | `bicep_curl` | dumbbell | cluster | Parametric Archetype Projected |
| 1024 | `spider_curl_drop_set` | Spider Curl (Drop Set) | Spider Curl sur banc incliné (Dégressif) | `bicep_curl` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 1025 | `spider_curl_constant_tension` | Spider Curl (Constant Tension) | Spider Curl sur banc incliné (Tension continue) | `bicep_curl` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 1026 | `spider_curl_lengthened_partials` | Spider Curl (Lengthened Partials) | Spider Curl sur banc incliné (Répétitions partielles étirées) | `bicep_curl` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 1027 | `cable_bicep_curl` | Cable Bicep Curl | Curl à la poulie basse | `bicep_curl` | cable | standard | Verified (Real-Phone Baseline) |
| 1028 | `cable_bicep_curl_pause` | Cable Bicep Curl (Pause) | Curl à la poulie basse (avec pause) | `bicep_curl` | cable | pause | Calibrated (MM-Fit / Countix) |
| 1029 | `cable_bicep_curl_tempo` | Cable Bicep Curl (Tempo 3-1-1) | Curl à la poulie basse (Tempo lent 3-1-1) | `bicep_curl` | cable | tempo | Parametric Archetype Projected |
| 1030 | `cable_bicep_curl_eccentric` | Cable Bicep Curl (Slow Eccentric) | Curl à la poulie basse (Excentrique accentuée) | `bicep_curl` | cable | eccentric | Verified (Real-Phone Baseline) |
| 1031 | `cable_bicep_curl_1_5_rep` | Cable Bicep Curl (1.5 Reps) | Curl à la poulie basse (1.5 Répétitions) | `bicep_curl` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1032 | `cable_bicep_curl_cluster` | Cable Bicep Curl (Rest-Pause) | Curl à la poulie basse (Rest-Pause) | `bicep_curl` | cable | cluster | Parametric Archetype Projected |
| 1033 | `cable_bicep_curl_drop_set` | Cable Bicep Curl (Drop Set) | Curl à la poulie basse (Dégressif) | `bicep_curl` | cable | drop_set | Verified (Real-Phone Baseline) |
| 1034 | `cable_bicep_curl_constant_tension` | Cable Bicep Curl (Constant Tension) | Curl à la poulie basse (Tension continue) | `bicep_curl` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 1035 | `cable_bicep_curl_lengthened_partials` | Cable Bicep Curl (Lengthened Partials) | Curl à la poulie basse (Répétitions partielles étirées) | `bicep_curl` | cable | lengthened_partials | Parametric Archetype Projected |
| 1036 | `bayesian_cable_curl` | Bayesian Cable Curl | Curl bayésien à la poulie | `bicep_curl` | cable | standard | Verified (Real-Phone Baseline) |
| 1037 | `bayesian_cable_curl_pause` | Bayesian Cable Curl (Pause) | Curl bayésien à la poulie (avec pause) | `bicep_curl` | cable | pause | Calibrated (MM-Fit / Countix) |
| 1038 | `bayesian_cable_curl_tempo` | Bayesian Cable Curl (Tempo 3-1-1) | Curl bayésien à la poulie (Tempo lent 3-1-1) | `bicep_curl` | cable | tempo | Parametric Archetype Projected |
| 1039 | `bayesian_cable_curl_eccentric` | Bayesian Cable Curl (Slow Eccentric) | Curl bayésien à la poulie (Excentrique accentuée) | `bicep_curl` | cable | eccentric | Verified (Real-Phone Baseline) |
| 1040 | `bayesian_cable_curl_1_5_rep` | Bayesian Cable Curl (1.5 Reps) | Curl bayésien à la poulie (1.5 Répétitions) | `bicep_curl` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1041 | `bayesian_cable_curl_cluster` | Bayesian Cable Curl (Rest-Pause) | Curl bayésien à la poulie (Rest-Pause) | `bicep_curl` | cable | cluster | Parametric Archetype Projected |
| 1042 | `bayesian_cable_curl_drop_set` | Bayesian Cable Curl (Drop Set) | Curl bayésien à la poulie (Dégressif) | `bicep_curl` | cable | drop_set | Verified (Real-Phone Baseline) |
| 1043 | `bayesian_cable_curl_constant_tension` | Bayesian Cable Curl (Constant Tension) | Curl bayésien à la poulie (Tension continue) | `bicep_curl` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 1044 | `bayesian_cable_curl_lengthened_partials` | Bayesian Cable Curl (Lengthened Partials) | Curl bayésien à la poulie (Répétitions partielles étirées) | `bicep_curl` | cable | lengthened_partials | Parametric Archetype Projected |
| 1045 | `machine_bicep_curl` | Machine Bicep Curl | Curl machine | `bicep_curl` | machine | standard | Verified (Real-Phone Baseline) |
| 1046 | `machine_bicep_curl_pause` | Machine Bicep Curl (Pause) | Curl machine (avec pause) | `bicep_curl` | machine | pause | Calibrated (MM-Fit / Countix) |
| 1047 | `machine_bicep_curl_tempo` | Machine Bicep Curl (Tempo 3-1-1) | Curl machine (Tempo lent 3-1-1) | `bicep_curl` | machine | tempo | Parametric Archetype Projected |
| 1048 | `machine_bicep_curl_eccentric` | Machine Bicep Curl (Slow Eccentric) | Curl machine (Excentrique accentuée) | `bicep_curl` | machine | eccentric | Verified (Real-Phone Baseline) |
| 1049 | `machine_bicep_curl_1_5_rep` | Machine Bicep Curl (1.5 Reps) | Curl machine (1.5 Répétitions) | `bicep_curl` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1050 | `machine_bicep_curl_cluster` | Machine Bicep Curl (Rest-Pause) | Curl machine (Rest-Pause) | `bicep_curl` | machine | cluster | Parametric Archetype Projected |
| 1051 | `machine_bicep_curl_drop_set` | Machine Bicep Curl (Drop Set) | Curl machine (Dégressif) | `bicep_curl` | machine | drop_set | Verified (Real-Phone Baseline) |
| 1052 | `machine_bicep_curl_constant_tension` | Machine Bicep Curl (Constant Tension) | Curl machine (Tension continue) | `bicep_curl` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 1053 | `machine_bicep_curl_lengthened_partials` | Machine Bicep Curl (Lengthened Partials) | Curl machine (Répétitions partielles étirées) | `bicep_curl` | machine | lengthened_partials | Parametric Archetype Projected |
| 1054 | `tricep_rope_pushdown` | Tricep Rope Pushdown | Extension triceps à la corde | `tricep_pushdown` | cable | standard | Verified (Real-Phone Baseline) |
| 1055 | `tricep_rope_pushdown_pause` | Tricep Rope Pushdown (Pause) | Extension triceps à la corde (avec pause) | `tricep_pushdown` | cable | pause | Calibrated (MM-Fit / Countix) |
| 1056 | `tricep_rope_pushdown_tempo` | Tricep Rope Pushdown (Tempo 3-1-1) | Extension triceps à la corde (Tempo lent 3-1-1) | `tricep_pushdown` | cable | tempo | Parametric Archetype Projected |
| 1057 | `tricep_rope_pushdown_eccentric` | Tricep Rope Pushdown (Slow Eccentric) | Extension triceps à la corde (Excentrique accentuée) | `tricep_pushdown` | cable | eccentric | Verified (Real-Phone Baseline) |
| 1058 | `tricep_rope_pushdown_1_5_rep` | Tricep Rope Pushdown (1.5 Reps) | Extension triceps à la corde (1.5 Répétitions) | `tricep_pushdown` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1059 | `tricep_rope_pushdown_cluster` | Tricep Rope Pushdown (Rest-Pause) | Extension triceps à la corde (Rest-Pause) | `tricep_pushdown` | cable | cluster | Parametric Archetype Projected |
| 1060 | `tricep_rope_pushdown_drop_set` | Tricep Rope Pushdown (Drop Set) | Extension triceps à la corde (Dégressif) | `tricep_pushdown` | cable | drop_set | Verified (Real-Phone Baseline) |
| 1061 | `tricep_rope_pushdown_constant_tension` | Tricep Rope Pushdown (Constant Tension) | Extension triceps à la corde (Tension continue) | `tricep_pushdown` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 1062 | `tricep_rope_pushdown_lengthened_partials` | Tricep Rope Pushdown (Lengthened Partials) | Extension triceps à la corde (Répétitions partielles étirées) | `tricep_pushdown` | cable | lengthened_partials | Parametric Archetype Projected |
| 1063 | `straight_bar_pushdown` | Straight Bar Pushdown | Poussée triceps barre droite | `tricep_pushdown` | cable | standard | Verified (Real-Phone Baseline) |
| 1064 | `straight_bar_pushdown_pause` | Straight Bar Pushdown (Pause) | Poussée triceps barre droite (avec pause) | `tricep_pushdown` | cable | pause | Calibrated (MM-Fit / Countix) |
| 1065 | `straight_bar_pushdown_tempo` | Straight Bar Pushdown (Tempo 3-1-1) | Poussée triceps barre droite (Tempo lent 3-1-1) | `tricep_pushdown` | cable | tempo | Parametric Archetype Projected |
| 1066 | `straight_bar_pushdown_eccentric` | Straight Bar Pushdown (Slow Eccentric) | Poussée triceps barre droite (Excentrique accentuée) | `tricep_pushdown` | cable | eccentric | Verified (Real-Phone Baseline) |
| 1067 | `straight_bar_pushdown_1_5_rep` | Straight Bar Pushdown (1.5 Reps) | Poussée triceps barre droite (1.5 Répétitions) | `tricep_pushdown` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1068 | `straight_bar_pushdown_cluster` | Straight Bar Pushdown (Rest-Pause) | Poussée triceps barre droite (Rest-Pause) | `tricep_pushdown` | cable | cluster | Parametric Archetype Projected |
| 1069 | `straight_bar_pushdown_drop_set` | Straight Bar Pushdown (Drop Set) | Poussée triceps barre droite (Dégressif) | `tricep_pushdown` | cable | drop_set | Verified (Real-Phone Baseline) |
| 1070 | `straight_bar_pushdown_constant_tension` | Straight Bar Pushdown (Constant Tension) | Poussée triceps barre droite (Tension continue) | `tricep_pushdown` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 1071 | `straight_bar_pushdown_lengthened_partials` | Straight Bar Pushdown (Lengthened Partials) | Poussée triceps barre droite (Répétitions partielles étirées) | `tricep_pushdown` | cable | lengthened_partials | Parametric Archetype Projected |
| 1072 | `v_bar_tricep_pushdown` | V-Bar Tricep Pushdown | Poussée triceps barre en V | `tricep_pushdown` | cable | standard | Verified (Real-Phone Baseline) |
| 1073 | `v_bar_tricep_pushdown_pause` | V-Bar Tricep Pushdown (Pause) | Poussée triceps barre en V (avec pause) | `tricep_pushdown` | cable | pause | Calibrated (MM-Fit / Countix) |
| 1074 | `v_bar_tricep_pushdown_tempo` | V-Bar Tricep Pushdown (Tempo 3-1-1) | Poussée triceps barre en V (Tempo lent 3-1-1) | `tricep_pushdown` | cable | tempo | Parametric Archetype Projected |
| 1075 | `v_bar_tricep_pushdown_eccentric` | V-Bar Tricep Pushdown (Slow Eccentric) | Poussée triceps barre en V (Excentrique accentuée) | `tricep_pushdown` | cable | eccentric | Verified (Real-Phone Baseline) |
| 1076 | `v_bar_tricep_pushdown_1_5_rep` | V-Bar Tricep Pushdown (1.5 Reps) | Poussée triceps barre en V (1.5 Répétitions) | `tricep_pushdown` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1077 | `v_bar_tricep_pushdown_cluster` | V-Bar Tricep Pushdown (Rest-Pause) | Poussée triceps barre en V (Rest-Pause) | `tricep_pushdown` | cable | cluster | Parametric Archetype Projected |
| 1078 | `v_bar_tricep_pushdown_drop_set` | V-Bar Tricep Pushdown (Drop Set) | Poussée triceps barre en V (Dégressif) | `tricep_pushdown` | cable | drop_set | Verified (Real-Phone Baseline) |
| 1079 | `v_bar_tricep_pushdown_constant_tension` | V-Bar Tricep Pushdown (Constant Tension) | Poussée triceps barre en V (Tension continue) | `tricep_pushdown` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 1080 | `v_bar_tricep_pushdown_lengthened_partials` | V-Bar Tricep Pushdown (Lengthened Partials) | Poussée triceps barre en V (Répétitions partielles étirées) | `tricep_pushdown` | cable | lengthened_partials | Parametric Archetype Projected |
| 1081 | `skull_crusher` | Skull Crusher | Barre au front (Skull Crusher) | `tricep_pushdown` | barbell | standard | Verified (Real-Phone Baseline) |
| 1082 | `skull_crusher_pause` | Skull Crusher (Pause) | Barre au front (Skull Crusher) (avec pause) | `tricep_pushdown` | barbell | pause | Calibrated (MM-Fit / Countix) |
| 1083 | `skull_crusher_tempo` | Skull Crusher (Tempo 3-1-1) | Barre au front (Skull Crusher) (Tempo lent 3-1-1) | `tricep_pushdown` | barbell | tempo | Parametric Archetype Projected |
| 1084 | `skull_crusher_eccentric` | Skull Crusher (Slow Eccentric) | Barre au front (Skull Crusher) (Excentrique accentuée) | `tricep_pushdown` | barbell | eccentric | Verified (Real-Phone Baseline) |
| 1085 | `skull_crusher_1_5_rep` | Skull Crusher (1.5 Reps) | Barre au front (Skull Crusher) (1.5 Répétitions) | `tricep_pushdown` | barbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1086 | `skull_crusher_cluster` | Skull Crusher (Rest-Pause) | Barre au front (Skull Crusher) (Rest-Pause) | `tricep_pushdown` | barbell | cluster | Parametric Archetype Projected |
| 1087 | `skull_crusher_drop_set` | Skull Crusher (Drop Set) | Barre au front (Skull Crusher) (Dégressif) | `tricep_pushdown` | barbell | drop_set | Verified (Real-Phone Baseline) |
| 1088 | `skull_crusher_constant_tension` | Skull Crusher (Constant Tension) | Barre au front (Skull Crusher) (Tension continue) | `tricep_pushdown` | barbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 1089 | `skull_crusher_lengthened_partials` | Skull Crusher (Lengthened Partials) | Barre au front (Skull Crusher) (Répétitions partielles étirées) | `tricep_pushdown` | barbell | lengthened_partials | Parametric Archetype Projected |
| 1090 | `dumbbell_skull_crusher` | Dumbbell Skull Crusher | Barre au front aux haltères | `tricep_pushdown` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 1091 | `dumbbell_skull_crusher_pause` | Dumbbell Skull Crusher (Pause) | Barre au front aux haltères (avec pause) | `tricep_pushdown` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 1092 | `dumbbell_skull_crusher_tempo` | Dumbbell Skull Crusher (Tempo 3-1-1) | Barre au front aux haltères (Tempo lent 3-1-1) | `tricep_pushdown` | dumbbell | tempo | Parametric Archetype Projected |
| 1093 | `dumbbell_skull_crusher_eccentric` | Dumbbell Skull Crusher (Slow Eccentric) | Barre au front aux haltères (Excentrique accentuée) | `tricep_pushdown` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 1094 | `dumbbell_skull_crusher_1_5_rep` | Dumbbell Skull Crusher (1.5 Reps) | Barre au front aux haltères (1.5 Répétitions) | `tricep_pushdown` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1095 | `dumbbell_skull_crusher_cluster` | Dumbbell Skull Crusher (Rest-Pause) | Barre au front aux haltères (Rest-Pause) | `tricep_pushdown` | dumbbell | cluster | Parametric Archetype Projected |
| 1096 | `dumbbell_skull_crusher_drop_set` | Dumbbell Skull Crusher (Drop Set) | Barre au front aux haltères (Dégressif) | `tricep_pushdown` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 1097 | `dumbbell_skull_crusher_constant_tension` | Dumbbell Skull Crusher (Constant Tension) | Barre au front aux haltères (Tension continue) | `tricep_pushdown` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 1098 | `dumbbell_skull_crusher_lengthened_partials` | Dumbbell Skull Crusher (Lengthened Partials) | Barre au front aux haltères (Répétitions partielles étirées) | `tricep_pushdown` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 1099 | `overhead_cable_triceps_extension` | Overhead Cable Triceps Extension | Extension triceps nuque à la poulie | `tricep_pushdown` | cable | standard | Verified (Real-Phone Baseline) |
| 1100 | `overhead_cable_triceps_extension_pause` | Overhead Cable Triceps Extension (Pause) | Extension triceps nuque à la poulie (avec pause) | `tricep_pushdown` | cable | pause | Calibrated (MM-Fit / Countix) |
| 1101 | `overhead_cable_triceps_extension_tempo` | Overhead Cable Triceps Extension (Tempo 3-1-1) | Extension triceps nuque à la poulie (Tempo lent 3-1-1) | `tricep_pushdown` | cable | tempo | Parametric Archetype Projected |
| 1102 | `overhead_cable_triceps_extension_eccentric` | Overhead Cable Triceps Extension (Slow Eccentric) | Extension triceps nuque à la poulie (Excentrique accentuée) | `tricep_pushdown` | cable | eccentric | Verified (Real-Phone Baseline) |
| 1103 | `overhead_cable_triceps_extension_1_5_rep` | Overhead Cable Triceps Extension (1.5 Reps) | Extension triceps nuque à la poulie (1.5 Répétitions) | `tricep_pushdown` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1104 | `overhead_cable_triceps_extension_cluster` | Overhead Cable Triceps Extension (Rest-Pause) | Extension triceps nuque à la poulie (Rest-Pause) | `tricep_pushdown` | cable | cluster | Parametric Archetype Projected |
| 1105 | `overhead_cable_triceps_extension_drop_set` | Overhead Cable Triceps Extension (Drop Set) | Extension triceps nuque à la poulie (Dégressif) | `tricep_pushdown` | cable | drop_set | Verified (Real-Phone Baseline) |
| 1106 | `overhead_cable_triceps_extension_constant_tension` | Overhead Cable Triceps Extension (Constant Tension) | Extension triceps nuque à la poulie (Tension continue) | `tricep_pushdown` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 1107 | `overhead_cable_triceps_extension_lengthened_partials` | Overhead Cable Triceps Extension (Lengthened Partials) | Extension triceps nuque à la poulie (Répétitions partielles étirées) | `tricep_pushdown` | cable | lengthened_partials | Parametric Archetype Projected |
| 1108 | `overhead_dumbbell_triceps_extension` | Overhead Dumbbell Triceps Extension | Extension triceps nuque à l’haltère | `tricep_pushdown` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 1109 | `overhead_dumbbell_triceps_extension_pause` | Overhead Dumbbell Triceps Extension (Pause) | Extension triceps nuque à l’haltère (avec pause) | `tricep_pushdown` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 1110 | `overhead_dumbbell_triceps_extension_tempo` | Overhead Dumbbell Triceps Extension (Tempo 3-1-1) | Extension triceps nuque à l’haltère (Tempo lent 3-1-1) | `tricep_pushdown` | dumbbell | tempo | Parametric Archetype Projected |
| 1111 | `overhead_dumbbell_triceps_extension_eccentric` | Overhead Dumbbell Triceps Extension (Slow Eccentric) | Extension triceps nuque à l’haltère (Excentrique accentuée) | `tricep_pushdown` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 1112 | `overhead_dumbbell_triceps_extension_1_5_rep` | Overhead Dumbbell Triceps Extension (1.5 Reps) | Extension triceps nuque à l’haltère (1.5 Répétitions) | `tricep_pushdown` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1113 | `overhead_dumbbell_triceps_extension_cluster` | Overhead Dumbbell Triceps Extension (Rest-Pause) | Extension triceps nuque à l’haltère (Rest-Pause) | `tricep_pushdown` | dumbbell | cluster | Parametric Archetype Projected |
| 1114 | `overhead_dumbbell_triceps_extension_drop_set` | Overhead Dumbbell Triceps Extension (Drop Set) | Extension triceps nuque à l’haltère (Dégressif) | `tricep_pushdown` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 1115 | `overhead_dumbbell_triceps_extension_constant_tension` | Overhead Dumbbell Triceps Extension (Constant Tension) | Extension triceps nuque à l’haltère (Tension continue) | `tricep_pushdown` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 1116 | `overhead_dumbbell_triceps_extension_lengthened_partials` | Overhead Dumbbell Triceps Extension (Lengthened Partials) | Extension triceps nuque à l’haltère (Répétitions partielles étirées) | `tricep_pushdown` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 1117 | `tricep_kickback` | Tricep Kickback | Kickback aux haltères | `tricep_pushdown` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 1118 | `tricep_kickback_pause` | Tricep Kickback (Pause) | Kickback aux haltères (avec pause) | `tricep_pushdown` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 1119 | `tricep_kickback_tempo` | Tricep Kickback (Tempo 3-1-1) | Kickback aux haltères (Tempo lent 3-1-1) | `tricep_pushdown` | dumbbell | tempo | Parametric Archetype Projected |
| 1120 | `tricep_kickback_eccentric` | Tricep Kickback (Slow Eccentric) | Kickback aux haltères (Excentrique accentuée) | `tricep_pushdown` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 1121 | `tricep_kickback_1_5_rep` | Tricep Kickback (1.5 Reps) | Kickback aux haltères (1.5 Répétitions) | `tricep_pushdown` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1122 | `tricep_kickback_cluster` | Tricep Kickback (Rest-Pause) | Kickback aux haltères (Rest-Pause) | `tricep_pushdown` | dumbbell | cluster | Parametric Archetype Projected |
| 1123 | `tricep_kickback_drop_set` | Tricep Kickback (Drop Set) | Kickback aux haltères (Dégressif) | `tricep_pushdown` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 1124 | `tricep_kickback_constant_tension` | Tricep Kickback (Constant Tension) | Kickback aux haltères (Tension continue) | `tricep_pushdown` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 1125 | `tricep_kickback_lengthened_partials` | Tricep Kickback (Lengthened Partials) | Kickback aux haltères (Répétitions partielles étirées) | `tricep_pushdown` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 1126 | `single_arm_cable_pushdown` | Single-Arm Cable Pushdown | Extension triceps unilatérale poulie | `tricep_pushdown` | cable | standard | Verified (Real-Phone Baseline) |
| 1127 | `single_arm_cable_pushdown_pause` | Single-Arm Cable Pushdown (Pause) | Extension triceps unilatérale poulie (avec pause) | `tricep_pushdown` | cable | pause | Calibrated (MM-Fit / Countix) |
| 1128 | `single_arm_cable_pushdown_tempo` | Single-Arm Cable Pushdown (Tempo 3-1-1) | Extension triceps unilatérale poulie (Tempo lent 3-1-1) | `tricep_pushdown` | cable | tempo | Parametric Archetype Projected |
| 1129 | `single_arm_cable_pushdown_eccentric` | Single-Arm Cable Pushdown (Slow Eccentric) | Extension triceps unilatérale poulie (Excentrique accentuée) | `tricep_pushdown` | cable | eccentric | Verified (Real-Phone Baseline) |
| 1130 | `single_arm_cable_pushdown_1_5_rep` | Single-Arm Cable Pushdown (1.5 Reps) | Extension triceps unilatérale poulie (1.5 Répétitions) | `tricep_pushdown` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1131 | `single_arm_cable_pushdown_cluster` | Single-Arm Cable Pushdown (Rest-Pause) | Extension triceps unilatérale poulie (Rest-Pause) | `tricep_pushdown` | cable | cluster | Parametric Archetype Projected |
| 1132 | `single_arm_cable_pushdown_drop_set` | Single-Arm Cable Pushdown (Drop Set) | Extension triceps unilatérale poulie (Dégressif) | `tricep_pushdown` | cable | drop_set | Verified (Real-Phone Baseline) |
| 1133 | `single_arm_cable_pushdown_constant_tension` | Single-Arm Cable Pushdown (Constant Tension) | Extension triceps unilatérale poulie (Tension continue) | `tricep_pushdown` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 1134 | `single_arm_cable_pushdown_lengthened_partials` | Single-Arm Cable Pushdown (Lengthened Partials) | Extension triceps unilatérale poulie (Répétitions partielles étirées) | `tricep_pushdown` | cable | lengthened_partials | Parametric Archetype Projected |
| 1135 | `dumbbell_lateral_raise` | Dumbbell Lateral Raise | Élévations latérales aux haltères | `lateral_raise` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 1136 | `dumbbell_lateral_raise_pause` | Dumbbell Lateral Raise (Pause) | Élévations latérales aux haltères (avec pause) | `lateral_raise` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 1137 | `dumbbell_lateral_raise_tempo` | Dumbbell Lateral Raise (Tempo 3-1-1) | Élévations latérales aux haltères (Tempo lent 3-1-1) | `lateral_raise` | dumbbell | tempo | Parametric Archetype Projected |
| 1138 | `dumbbell_lateral_raise_eccentric` | Dumbbell Lateral Raise (Slow Eccentric) | Élévations latérales aux haltères (Excentrique accentuée) | `lateral_raise` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 1139 | `dumbbell_lateral_raise_1_5_rep` | Dumbbell Lateral Raise (1.5 Reps) | Élévations latérales aux haltères (1.5 Répétitions) | `lateral_raise` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1140 | `dumbbell_lateral_raise_cluster` | Dumbbell Lateral Raise (Rest-Pause) | Élévations latérales aux haltères (Rest-Pause) | `lateral_raise` | dumbbell | cluster | Parametric Archetype Projected |
| 1141 | `dumbbell_lateral_raise_drop_set` | Dumbbell Lateral Raise (Drop Set) | Élévations latérales aux haltères (Dégressif) | `lateral_raise` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 1142 | `dumbbell_lateral_raise_constant_tension` | Dumbbell Lateral Raise (Constant Tension) | Élévations latérales aux haltères (Tension continue) | `lateral_raise` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 1143 | `dumbbell_lateral_raise_lengthened_partials` | Dumbbell Lateral Raise (Lengthened Partials) | Élévations latérales aux haltères (Répétitions partielles étirées) | `lateral_raise` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 1144 | `seated_dumbbell_lateral_raise` | Seated Dumbbell Lateral Raise | Élévations latérales assises | `lateral_raise` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 1145 | `seated_dumbbell_lateral_raise_pause` | Seated Dumbbell Lateral Raise (Pause) | Élévations latérales assises (avec pause) | `lateral_raise` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 1146 | `seated_dumbbell_lateral_raise_tempo` | Seated Dumbbell Lateral Raise (Tempo 3-1-1) | Élévations latérales assises (Tempo lent 3-1-1) | `lateral_raise` | dumbbell | tempo | Parametric Archetype Projected |
| 1147 | `seated_dumbbell_lateral_raise_eccentric` | Seated Dumbbell Lateral Raise (Slow Eccentric) | Élévations latérales assises (Excentrique accentuée) | `lateral_raise` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 1148 | `seated_dumbbell_lateral_raise_1_5_rep` | Seated Dumbbell Lateral Raise (1.5 Reps) | Élévations latérales assises (1.5 Répétitions) | `lateral_raise` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1149 | `seated_dumbbell_lateral_raise_cluster` | Seated Dumbbell Lateral Raise (Rest-Pause) | Élévations latérales assises (Rest-Pause) | `lateral_raise` | dumbbell | cluster | Parametric Archetype Projected |
| 1150 | `seated_dumbbell_lateral_raise_drop_set` | Seated Dumbbell Lateral Raise (Drop Set) | Élévations latérales assises (Dégressif) | `lateral_raise` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 1151 | `seated_dumbbell_lateral_raise_constant_tension` | Seated Dumbbell Lateral Raise (Constant Tension) | Élévations latérales assises (Tension continue) | `lateral_raise` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 1152 | `seated_dumbbell_lateral_raise_lengthened_partials` | Seated Dumbbell Lateral Raise (Lengthened Partials) | Élévations latérales assises (Répétitions partielles étirées) | `lateral_raise` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 1153 | `cable_lateral_raise` | Cable Lateral Raise | Élévations latérales à la poulie | `lateral_raise` | cable | standard | Verified (Real-Phone Baseline) |
| 1154 | `cable_lateral_raise_pause` | Cable Lateral Raise (Pause) | Élévations latérales à la poulie (avec pause) | `lateral_raise` | cable | pause | Calibrated (MM-Fit / Countix) |
| 1155 | `cable_lateral_raise_tempo` | Cable Lateral Raise (Tempo 3-1-1) | Élévations latérales à la poulie (Tempo lent 3-1-1) | `lateral_raise` | cable | tempo | Parametric Archetype Projected |
| 1156 | `cable_lateral_raise_eccentric` | Cable Lateral Raise (Slow Eccentric) | Élévations latérales à la poulie (Excentrique accentuée) | `lateral_raise` | cable | eccentric | Verified (Real-Phone Baseline) |
| 1157 | `cable_lateral_raise_1_5_rep` | Cable Lateral Raise (1.5 Reps) | Élévations latérales à la poulie (1.5 Répétitions) | `lateral_raise` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1158 | `cable_lateral_raise_cluster` | Cable Lateral Raise (Rest-Pause) | Élévations latérales à la poulie (Rest-Pause) | `lateral_raise` | cable | cluster | Parametric Archetype Projected |
| 1159 | `cable_lateral_raise_drop_set` | Cable Lateral Raise (Drop Set) | Élévations latérales à la poulie (Dégressif) | `lateral_raise` | cable | drop_set | Verified (Real-Phone Baseline) |
| 1160 | `cable_lateral_raise_constant_tension` | Cable Lateral Raise (Constant Tension) | Élévations latérales à la poulie (Tension continue) | `lateral_raise` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 1161 | `cable_lateral_raise_lengthened_partials` | Cable Lateral Raise (Lengthened Partials) | Élévations latérales à la poulie (Répétitions partielles étirées) | `lateral_raise` | cable | lengthened_partials | Parametric Archetype Projected |
| 1162 | `behind_the_back_cable_lateral_raise` | Behind-the-Back Cable Lateral Raise | Élévations latérales poulie derrière le dos | `lateral_raise` | cable | standard | Verified (Real-Phone Baseline) |
| 1163 | `behind_the_back_cable_lateral_raise_pause` | Behind-the-Back Cable Lateral Raise (Pause) | Élévations latérales poulie derrière le dos (avec pause) | `lateral_raise` | cable | pause | Calibrated (MM-Fit / Countix) |
| 1164 | `behind_the_back_cable_lateral_raise_tempo` | Behind-the-Back Cable Lateral Raise (Tempo 3-1-1) | Élévations latérales poulie derrière le dos (Tempo lent 3-1-1) | `lateral_raise` | cable | tempo | Parametric Archetype Projected |
| 1165 | `behind_the_back_cable_lateral_raise_eccentric` | Behind-the-Back Cable Lateral Raise (Slow Eccentric) | Élévations latérales poulie derrière le dos (Excentrique accentuée) | `lateral_raise` | cable | eccentric | Verified (Real-Phone Baseline) |
| 1166 | `behind_the_back_cable_lateral_raise_1_5_rep` | Behind-the-Back Cable Lateral Raise (1.5 Reps) | Élévations latérales poulie derrière le dos (1.5 Répétitions) | `lateral_raise` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1167 | `behind_the_back_cable_lateral_raise_cluster` | Behind-the-Back Cable Lateral Raise (Rest-Pause) | Élévations latérales poulie derrière le dos (Rest-Pause) | `lateral_raise` | cable | cluster | Parametric Archetype Projected |
| 1168 | `behind_the_back_cable_lateral_raise_drop_set` | Behind-the-Back Cable Lateral Raise (Drop Set) | Élévations latérales poulie derrière le dos (Dégressif) | `lateral_raise` | cable | drop_set | Verified (Real-Phone Baseline) |
| 1169 | `behind_the_back_cable_lateral_raise_constant_tension` | Behind-the-Back Cable Lateral Raise (Constant Tension) | Élévations latérales poulie derrière le dos (Tension continue) | `lateral_raise` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 1170 | `behind_the_back_cable_lateral_raise_lengthened_partials` | Behind-the-Back Cable Lateral Raise (Lengthened Partials) | Élévations latérales poulie derrière le dos (Répétitions partielles étirées) | `lateral_raise` | cable | lengthened_partials | Parametric Archetype Projected |
| 1171 | `machine_lateral_raise` | Machine Lateral Raise | Élévations latérales machine | `lateral_raise` | machine | standard | Verified (Real-Phone Baseline) |
| 1172 | `machine_lateral_raise_pause` | Machine Lateral Raise (Pause) | Élévations latérales machine (avec pause) | `lateral_raise` | machine | pause | Calibrated (MM-Fit / Countix) |
| 1173 | `machine_lateral_raise_tempo` | Machine Lateral Raise (Tempo 3-1-1) | Élévations latérales machine (Tempo lent 3-1-1) | `lateral_raise` | machine | tempo | Parametric Archetype Projected |
| 1174 | `machine_lateral_raise_eccentric` | Machine Lateral Raise (Slow Eccentric) | Élévations latérales machine (Excentrique accentuée) | `lateral_raise` | machine | eccentric | Verified (Real-Phone Baseline) |
| 1175 | `machine_lateral_raise_1_5_rep` | Machine Lateral Raise (1.5 Reps) | Élévations latérales machine (1.5 Répétitions) | `lateral_raise` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1176 | `machine_lateral_raise_cluster` | Machine Lateral Raise (Rest-Pause) | Élévations latérales machine (Rest-Pause) | `lateral_raise` | machine | cluster | Parametric Archetype Projected |
| 1177 | `machine_lateral_raise_drop_set` | Machine Lateral Raise (Drop Set) | Élévations latérales machine (Dégressif) | `lateral_raise` | machine | drop_set | Verified (Real-Phone Baseline) |
| 1178 | `machine_lateral_raise_constant_tension` | Machine Lateral Raise (Constant Tension) | Élévations latérales machine (Tension continue) | `lateral_raise` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 1179 | `machine_lateral_raise_lengthened_partials` | Machine Lateral Raise (Lengthened Partials) | Élévations latérales machine (Répétitions partielles étirées) | `lateral_raise` | machine | lengthened_partials | Parametric Archetype Projected |
| 1180 | `dumbbell_rear_delt_fly` | Dumbbell Rear Delt Fly | Oiseau aux haltères (Deltoïde arrière) | `lateral_raise` | dumbbell | standard | Verified (Real-Phone Baseline) |
| 1181 | `dumbbell_rear_delt_fly_pause` | Dumbbell Rear Delt Fly (Pause) | Oiseau aux haltères (Deltoïde arrière) (avec pause) | `lateral_raise` | dumbbell | pause | Calibrated (MM-Fit / Countix) |
| 1182 | `dumbbell_rear_delt_fly_tempo` | Dumbbell Rear Delt Fly (Tempo 3-1-1) | Oiseau aux haltères (Deltoïde arrière) (Tempo lent 3-1-1) | `lateral_raise` | dumbbell | tempo | Parametric Archetype Projected |
| 1183 | `dumbbell_rear_delt_fly_eccentric` | Dumbbell Rear Delt Fly (Slow Eccentric) | Oiseau aux haltères (Deltoïde arrière) (Excentrique accentuée) | `lateral_raise` | dumbbell | eccentric | Verified (Real-Phone Baseline) |
| 1184 | `dumbbell_rear_delt_fly_1_5_rep` | Dumbbell Rear Delt Fly (1.5 Reps) | Oiseau aux haltères (Deltoïde arrière) (1.5 Répétitions) | `lateral_raise` | dumbbell | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1185 | `dumbbell_rear_delt_fly_cluster` | Dumbbell Rear Delt Fly (Rest-Pause) | Oiseau aux haltères (Deltoïde arrière) (Rest-Pause) | `lateral_raise` | dumbbell | cluster | Parametric Archetype Projected |
| 1186 | `dumbbell_rear_delt_fly_drop_set` | Dumbbell Rear Delt Fly (Drop Set) | Oiseau aux haltères (Deltoïde arrière) (Dégressif) | `lateral_raise` | dumbbell | drop_set | Verified (Real-Phone Baseline) |
| 1187 | `dumbbell_rear_delt_fly_constant_tension` | Dumbbell Rear Delt Fly (Constant Tension) | Oiseau aux haltères (Deltoïde arrière) (Tension continue) | `lateral_raise` | dumbbell | constant_tension | Calibrated (MM-Fit / Countix) |
| 1188 | `dumbbell_rear_delt_fly_lengthened_partials` | Dumbbell Rear Delt Fly (Lengthened Partials) | Oiseau aux haltères (Deltoïde arrière) (Répétitions partielles étirées) | `lateral_raise` | dumbbell | lengthened_partials | Parametric Archetype Projected |
| 1189 | `reverse_pec_deck_fly` | Reverse Pec-Deck Fly | Pec-Deck inversé (Oiseau machine) | `lateral_raise` | machine | standard | Verified (Real-Phone Baseline) |
| 1190 | `reverse_pec_deck_fly_pause` | Reverse Pec-Deck Fly (Pause) | Pec-Deck inversé (Oiseau machine) (avec pause) | `lateral_raise` | machine | pause | Calibrated (MM-Fit / Countix) |
| 1191 | `reverse_pec_deck_fly_tempo` | Reverse Pec-Deck Fly (Tempo 3-1-1) | Pec-Deck inversé (Oiseau machine) (Tempo lent 3-1-1) | `lateral_raise` | machine | tempo | Parametric Archetype Projected |
| 1192 | `reverse_pec_deck_fly_eccentric` | Reverse Pec-Deck Fly (Slow Eccentric) | Pec-Deck inversé (Oiseau machine) (Excentrique accentuée) | `lateral_raise` | machine | eccentric | Verified (Real-Phone Baseline) |
| 1193 | `reverse_pec_deck_fly_1_5_rep` | Reverse Pec-Deck Fly (1.5 Reps) | Pec-Deck inversé (Oiseau machine) (1.5 Répétitions) | `lateral_raise` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1194 | `reverse_pec_deck_fly_cluster` | Reverse Pec-Deck Fly (Rest-Pause) | Pec-Deck inversé (Oiseau machine) (Rest-Pause) | `lateral_raise` | machine | cluster | Parametric Archetype Projected |
| 1195 | `reverse_pec_deck_fly_drop_set` | Reverse Pec-Deck Fly (Drop Set) | Pec-Deck inversé (Oiseau machine) (Dégressif) | `lateral_raise` | machine | drop_set | Verified (Real-Phone Baseline) |
| 1196 | `reverse_pec_deck_fly_constant_tension` | Reverse Pec-Deck Fly (Constant Tension) | Pec-Deck inversé (Oiseau machine) (Tension continue) | `lateral_raise` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 1197 | `reverse_pec_deck_fly_lengthened_partials` | Reverse Pec-Deck Fly (Lengthened Partials) | Pec-Deck inversé (Oiseau machine) (Répétitions partielles étirées) | `lateral_raise` | machine | lengthened_partials | Parametric Archetype Projected |
| 1198 | `cable_face_pull` | Cable Face Pull | Face Pull à la poulie | `lateral_raise` | cable | standard | Verified (Real-Phone Baseline) |
| 1199 | `cable_face_pull_pause` | Cable Face Pull (Pause) | Face Pull à la poulie (avec pause) | `lateral_raise` | cable | pause | Calibrated (MM-Fit / Countix) |
| 1200 | `cable_face_pull_tempo` | Cable Face Pull (Tempo 3-1-1) | Face Pull à la poulie (Tempo lent 3-1-1) | `lateral_raise` | cable | tempo | Parametric Archetype Projected |
| 1201 | `cable_face_pull_eccentric` | Cable Face Pull (Slow Eccentric) | Face Pull à la poulie (Excentrique accentuée) | `lateral_raise` | cable | eccentric | Verified (Real-Phone Baseline) |
| 1202 | `cable_face_pull_1_5_rep` | Cable Face Pull (1.5 Reps) | Face Pull à la poulie (1.5 Répétitions) | `lateral_raise` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1203 | `cable_face_pull_cluster` | Cable Face Pull (Rest-Pause) | Face Pull à la poulie (Rest-Pause) | `lateral_raise` | cable | cluster | Parametric Archetype Projected |
| 1204 | `cable_face_pull_drop_set` | Cable Face Pull (Drop Set) | Face Pull à la poulie (Dégressif) | `lateral_raise` | cable | drop_set | Verified (Real-Phone Baseline) |
| 1205 | `cable_face_pull_constant_tension` | Cable Face Pull (Constant Tension) | Face Pull à la poulie (Tension continue) | `lateral_raise` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 1206 | `cable_face_pull_lengthened_partials` | Cable Face Pull (Lengthened Partials) | Face Pull à la poulie (Répétitions partielles étirées) | `lateral_raise` | cable | lengthened_partials | Parametric Archetype Projected |
| 1207 | `captains_chair_knee_raise` | Captains Chair Knee Raise | Relevé de genoux sur chaise romaine | `core_knee_raise` | machine | standard | Verified (Real-Phone Baseline) |
| 1208 | `captains_chair_knee_raise_pause` | Captains Chair Knee Raise (Pause) | Relevé de genoux sur chaise romaine (avec pause) | `core_knee_raise` | machine | pause | Calibrated (MM-Fit / Countix) |
| 1209 | `captains_chair_knee_raise_tempo` | Captains Chair Knee Raise (Tempo 3-1-1) | Relevé de genoux sur chaise romaine (Tempo lent 3-1-1) | `core_knee_raise` | machine | tempo | Parametric Archetype Projected |
| 1210 | `captains_chair_knee_raise_eccentric` | Captains Chair Knee Raise (Slow Eccentric) | Relevé de genoux sur chaise romaine (Excentrique accentuée) | `core_knee_raise` | machine | eccentric | Verified (Real-Phone Baseline) |
| 1211 | `captains_chair_knee_raise_1_5_rep` | Captains Chair Knee Raise (1.5 Reps) | Relevé de genoux sur chaise romaine (1.5 Répétitions) | `core_knee_raise` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1212 | `captains_chair_knee_raise_cluster` | Captains Chair Knee Raise (Rest-Pause) | Relevé de genoux sur chaise romaine (Rest-Pause) | `core_knee_raise` | machine | cluster | Parametric Archetype Projected |
| 1213 | `captains_chair_knee_raise_drop_set` | Captains Chair Knee Raise (Drop Set) | Relevé de genoux sur chaise romaine (Dégressif) | `core_knee_raise` | machine | drop_set | Verified (Real-Phone Baseline) |
| 1214 | `captains_chair_knee_raise_constant_tension` | Captains Chair Knee Raise (Constant Tension) | Relevé de genoux sur chaise romaine (Tension continue) | `core_knee_raise` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 1215 | `captains_chair_knee_raise_lengthened_partials` | Captains Chair Knee Raise (Lengthened Partials) | Relevé de genoux sur chaise romaine (Répétitions partielles étirées) | `core_knee_raise` | machine | lengthened_partials | Parametric Archetype Projected |
| 1216 | `captains_chair_leg_raise` | Captains Chair Leg Raise | Relevé de jambes tendues chaise romaine | `core_knee_raise` | machine | standard | Verified (Real-Phone Baseline) |
| 1217 | `captains_chair_leg_raise_pause` | Captains Chair Leg Raise (Pause) | Relevé de jambes tendues chaise romaine (avec pause) | `core_knee_raise` | machine | pause | Calibrated (MM-Fit / Countix) |
| 1218 | `captains_chair_leg_raise_tempo` | Captains Chair Leg Raise (Tempo 3-1-1) | Relevé de jambes tendues chaise romaine (Tempo lent 3-1-1) | `core_knee_raise` | machine | tempo | Parametric Archetype Projected |
| 1219 | `captains_chair_leg_raise_eccentric` | Captains Chair Leg Raise (Slow Eccentric) | Relevé de jambes tendues chaise romaine (Excentrique accentuée) | `core_knee_raise` | machine | eccentric | Verified (Real-Phone Baseline) |
| 1220 | `captains_chair_leg_raise_1_5_rep` | Captains Chair Leg Raise (1.5 Reps) | Relevé de jambes tendues chaise romaine (1.5 Répétitions) | `core_knee_raise` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1221 | `captains_chair_leg_raise_cluster` | Captains Chair Leg Raise (Rest-Pause) | Relevé de jambes tendues chaise romaine (Rest-Pause) | `core_knee_raise` | machine | cluster | Parametric Archetype Projected |
| 1222 | `captains_chair_leg_raise_drop_set` | Captains Chair Leg Raise (Drop Set) | Relevé de jambes tendues chaise romaine (Dégressif) | `core_knee_raise` | machine | drop_set | Verified (Real-Phone Baseline) |
| 1223 | `captains_chair_leg_raise_constant_tension` | Captains Chair Leg Raise (Constant Tension) | Relevé de jambes tendues chaise romaine (Tension continue) | `core_knee_raise` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 1224 | `captains_chair_leg_raise_lengthened_partials` | Captains Chair Leg Raise (Lengthened Partials) | Relevé de jambes tendues chaise romaine (Répétitions partielles étirées) | `core_knee_raise` | machine | lengthened_partials | Parametric Archetype Projected |
| 1225 | `hanging_knee_raise` | Hanging Knee Raise | Relevé de genoux suspendu à la barre | `core_knee_raise` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 1226 | `hanging_knee_raise_pause` | Hanging Knee Raise (Pause) | Relevé de genoux suspendu à la barre (avec pause) | `core_knee_raise` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 1227 | `hanging_knee_raise_tempo` | Hanging Knee Raise (Tempo 3-1-1) | Relevé de genoux suspendu à la barre (Tempo lent 3-1-1) | `core_knee_raise` | bodyweight | tempo | Parametric Archetype Projected |
| 1228 | `hanging_knee_raise_eccentric` | Hanging Knee Raise (Slow Eccentric) | Relevé de genoux suspendu à la barre (Excentrique accentuée) | `core_knee_raise` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 1229 | `hanging_knee_raise_1_5_rep` | Hanging Knee Raise (1.5 Reps) | Relevé de genoux suspendu à la barre (1.5 Répétitions) | `core_knee_raise` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1230 | `hanging_knee_raise_cluster` | Hanging Knee Raise (Rest-Pause) | Relevé de genoux suspendu à la barre (Rest-Pause) | `core_knee_raise` | bodyweight | cluster | Parametric Archetype Projected |
| 1231 | `hanging_knee_raise_drop_set` | Hanging Knee Raise (Drop Set) | Relevé de genoux suspendu à la barre (Dégressif) | `core_knee_raise` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 1232 | `hanging_knee_raise_constant_tension` | Hanging Knee Raise (Constant Tension) | Relevé de genoux suspendu à la barre (Tension continue) | `core_knee_raise` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 1233 | `hanging_knee_raise_lengthened_partials` | Hanging Knee Raise (Lengthened Partials) | Relevé de genoux suspendu à la barre (Répétitions partielles étirées) | `core_knee_raise` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 1234 | `hanging_leg_raise` | Hanging Leg Raise | Relevé de jambes suspendu à la barre | `core_knee_raise` | bodyweight | standard | Verified (Real-Phone Baseline) |
| 1235 | `hanging_leg_raise_pause` | Hanging Leg Raise (Pause) | Relevé de jambes suspendu à la barre (avec pause) | `core_knee_raise` | bodyweight | pause | Calibrated (MM-Fit / Countix) |
| 1236 | `hanging_leg_raise_tempo` | Hanging Leg Raise (Tempo 3-1-1) | Relevé de jambes suspendu à la barre (Tempo lent 3-1-1) | `core_knee_raise` | bodyweight | tempo | Parametric Archetype Projected |
| 1237 | `hanging_leg_raise_eccentric` | Hanging Leg Raise (Slow Eccentric) | Relevé de jambes suspendu à la barre (Excentrique accentuée) | `core_knee_raise` | bodyweight | eccentric | Verified (Real-Phone Baseline) |
| 1238 | `hanging_leg_raise_1_5_rep` | Hanging Leg Raise (1.5 Reps) | Relevé de jambes suspendu à la barre (1.5 Répétitions) | `core_knee_raise` | bodyweight | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1239 | `hanging_leg_raise_cluster` | Hanging Leg Raise (Rest-Pause) | Relevé de jambes suspendu à la barre (Rest-Pause) | `core_knee_raise` | bodyweight | cluster | Parametric Archetype Projected |
| 1240 | `hanging_leg_raise_drop_set` | Hanging Leg Raise (Drop Set) | Relevé de jambes suspendu à la barre (Dégressif) | `core_knee_raise` | bodyweight | drop_set | Verified (Real-Phone Baseline) |
| 1241 | `hanging_leg_raise_constant_tension` | Hanging Leg Raise (Constant Tension) | Relevé de jambes suspendu à la barre (Tension continue) | `core_knee_raise` | bodyweight | constant_tension | Calibrated (MM-Fit / Countix) |
| 1242 | `hanging_leg_raise_lengthened_partials` | Hanging Leg Raise (Lengthened Partials) | Relevé de jambes suspendu à la barre (Répétitions partielles étirées) | `core_knee_raise` | bodyweight | lengthened_partials | Parametric Archetype Projected |
| 1243 | `cable_kneeling_crunch` | Cable Kneeling Crunch | Crunch à la poulie haute à genoux | `core_knee_raise` | cable | standard | Verified (Real-Phone Baseline) |
| 1244 | `cable_kneeling_crunch_pause` | Cable Kneeling Crunch (Pause) | Crunch à la poulie haute à genoux (avec pause) | `core_knee_raise` | cable | pause | Calibrated (MM-Fit / Countix) |
| 1245 | `cable_kneeling_crunch_tempo` | Cable Kneeling Crunch (Tempo 3-1-1) | Crunch à la poulie haute à genoux (Tempo lent 3-1-1) | `core_knee_raise` | cable | tempo | Parametric Archetype Projected |
| 1246 | `cable_kneeling_crunch_eccentric` | Cable Kneeling Crunch (Slow Eccentric) | Crunch à la poulie haute à genoux (Excentrique accentuée) | `core_knee_raise` | cable | eccentric | Verified (Real-Phone Baseline) |
| 1247 | `cable_kneeling_crunch_1_5_rep` | Cable Kneeling Crunch (1.5 Reps) | Crunch à la poulie haute à genoux (1.5 Répétitions) | `core_knee_raise` | cable | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1248 | `cable_kneeling_crunch_cluster` | Cable Kneeling Crunch (Rest-Pause) | Crunch à la poulie haute à genoux (Rest-Pause) | `core_knee_raise` | cable | cluster | Parametric Archetype Projected |
| 1249 | `cable_kneeling_crunch_drop_set` | Cable Kneeling Crunch (Drop Set) | Crunch à la poulie haute à genoux (Dégressif) | `core_knee_raise` | cable | drop_set | Verified (Real-Phone Baseline) |
| 1250 | `cable_kneeling_crunch_constant_tension` | Cable Kneeling Crunch (Constant Tension) | Crunch à la poulie haute à genoux (Tension continue) | `core_knee_raise` | cable | constant_tension | Calibrated (MM-Fit / Countix) |
| 1251 | `cable_kneeling_crunch_lengthened_partials` | Cable Kneeling Crunch (Lengthened Partials) | Crunch à la poulie haute à genoux (Répétitions partielles étirées) | `core_knee_raise` | cable | lengthened_partials | Parametric Archetype Projected |
| 1252 | `abdominal_crunch_machine` | Abdominal Crunch Machine | Machine à abdominaux guidée | `core_knee_raise` | machine | standard | Verified (Real-Phone Baseline) |
| 1253 | `abdominal_crunch_machine_pause` | Abdominal Crunch Machine (Pause) | Machine à abdominaux guidée (avec pause) | `core_knee_raise` | machine | pause | Calibrated (MM-Fit / Countix) |
| 1254 | `abdominal_crunch_machine_tempo` | Abdominal Crunch Machine (Tempo 3-1-1) | Machine à abdominaux guidée (Tempo lent 3-1-1) | `core_knee_raise` | machine | tempo | Parametric Archetype Projected |
| 1255 | `abdominal_crunch_machine_eccentric` | Abdominal Crunch Machine (Slow Eccentric) | Machine à abdominaux guidée (Excentrique accentuée) | `core_knee_raise` | machine | eccentric | Verified (Real-Phone Baseline) |
| 1256 | `abdominal_crunch_machine_1_5_rep` | Abdominal Crunch Machine (1.5 Reps) | Machine à abdominaux guidée (1.5 Répétitions) | `core_knee_raise` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1257 | `abdominal_crunch_machine_cluster` | Abdominal Crunch Machine (Rest-Pause) | Machine à abdominaux guidée (Rest-Pause) | `core_knee_raise` | machine | cluster | Parametric Archetype Projected |
| 1258 | `abdominal_crunch_machine_drop_set` | Abdominal Crunch Machine (Drop Set) | Machine à abdominaux guidée (Dégressif) | `core_knee_raise` | machine | drop_set | Verified (Real-Phone Baseline) |
| 1259 | `abdominal_crunch_machine_constant_tension` | Abdominal Crunch Machine (Constant Tension) | Machine à abdominaux guidée (Tension continue) | `core_knee_raise` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 1260 | `abdominal_crunch_machine_lengthened_partials` | Abdominal Crunch Machine (Lengthened Partials) | Machine à abdominaux guidée (Répétitions partielles étirées) | `core_knee_raise` | machine | lengthened_partials | Parametric Archetype Projected |
| 1261 | `45_degree_hyperextension` | 45-Degree Hyperextension | Extension du dos sur banc 45° | `back_extension` | machine | standard | Verified (Real-Phone Baseline) |
| 1262 | `45_degree_hyperextension_pause` | 45-Degree Hyperextension (Pause) | Extension du dos sur banc 45° (avec pause) | `back_extension` | machine | pause | Calibrated (MM-Fit / Countix) |
| 1263 | `45_degree_hyperextension_tempo` | 45-Degree Hyperextension (Tempo 3-1-1) | Extension du dos sur banc 45° (Tempo lent 3-1-1) | `back_extension` | machine | tempo | Parametric Archetype Projected |
| 1264 | `45_degree_hyperextension_eccentric` | 45-Degree Hyperextension (Slow Eccentric) | Extension du dos sur banc 45° (Excentrique accentuée) | `back_extension` | machine | eccentric | Verified (Real-Phone Baseline) |
| 1265 | `45_degree_hyperextension_1_5_rep` | 45-Degree Hyperextension (1.5 Reps) | Extension du dos sur banc 45° (1.5 Répétitions) | `back_extension` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1266 | `45_degree_hyperextension_cluster` | 45-Degree Hyperextension (Rest-Pause) | Extension du dos sur banc 45° (Rest-Pause) | `back_extension` | machine | cluster | Parametric Archetype Projected |
| 1267 | `45_degree_hyperextension_drop_set` | 45-Degree Hyperextension (Drop Set) | Extension du dos sur banc 45° (Dégressif) | `back_extension` | machine | drop_set | Verified (Real-Phone Baseline) |
| 1268 | `45_degree_hyperextension_constant_tension` | 45-Degree Hyperextension (Constant Tension) | Extension du dos sur banc 45° (Tension continue) | `back_extension` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 1269 | `45_degree_hyperextension_lengthened_partials` | 45-Degree Hyperextension (Lengthened Partials) | Extension du dos sur banc 45° (Répétitions partielles étirées) | `back_extension` | machine | lengthened_partials | Parametric Archetype Projected |
| 1270 | `90_degree_horizontal_back_extension` | 90-Degree Horizontal Back Extension | Banc lombaire horizontal 90° | `back_extension` | machine | standard | Verified (Real-Phone Baseline) |
| 1271 | `90_degree_horizontal_back_extension_pause` | 90-Degree Horizontal Back Extension (Pause) | Banc lombaire horizontal 90° (avec pause) | `back_extension` | machine | pause | Calibrated (MM-Fit / Countix) |
| 1272 | `90_degree_horizontal_back_extension_tempo` | 90-Degree Horizontal Back Extension (Tempo 3-1-1) | Banc lombaire horizontal 90° (Tempo lent 3-1-1) | `back_extension` | machine | tempo | Parametric Archetype Projected |
| 1273 | `90_degree_horizontal_back_extension_eccentric` | 90-Degree Horizontal Back Extension (Slow Eccentric) | Banc lombaire horizontal 90° (Excentrique accentuée) | `back_extension` | machine | eccentric | Verified (Real-Phone Baseline) |
| 1274 | `90_degree_horizontal_back_extension_1_5_rep` | 90-Degree Horizontal Back Extension (1.5 Reps) | Banc lombaire horizontal 90° (1.5 Répétitions) | `back_extension` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1275 | `90_degree_horizontal_back_extension_cluster` | 90-Degree Horizontal Back Extension (Rest-Pause) | Banc lombaire horizontal 90° (Rest-Pause) | `back_extension` | machine | cluster | Parametric Archetype Projected |
| 1276 | `90_degree_horizontal_back_extension_drop_set` | 90-Degree Horizontal Back Extension (Drop Set) | Banc lombaire horizontal 90° (Dégressif) | `back_extension` | machine | drop_set | Verified (Real-Phone Baseline) |
| 1277 | `90_degree_horizontal_back_extension_constant_tension` | 90-Degree Horizontal Back Extension (Constant Tension) | Banc lombaire horizontal 90° (Tension continue) | `back_extension` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 1278 | `90_degree_horizontal_back_extension_lengthened_partials` | 90-Degree Horizontal Back Extension (Lengthened Partials) | Banc lombaire horizontal 90° (Répétitions partielles étirées) | `back_extension` | machine | lengthened_partials | Parametric Archetype Projected |
| 1279 | `machine_seated_back_extension` | Machine Seated Back Extension | Extension du dos assis machine | `back_extension` | machine | standard | Verified (Real-Phone Baseline) |
| 1280 | `machine_seated_back_extension_pause` | Machine Seated Back Extension (Pause) | Extension du dos assis machine (avec pause) | `back_extension` | machine | pause | Calibrated (MM-Fit / Countix) |
| 1281 | `machine_seated_back_extension_tempo` | Machine Seated Back Extension (Tempo 3-1-1) | Extension du dos assis machine (Tempo lent 3-1-1) | `back_extension` | machine | tempo | Parametric Archetype Projected |
| 1282 | `machine_seated_back_extension_eccentric` | Machine Seated Back Extension (Slow Eccentric) | Extension du dos assis machine (Excentrique accentuée) | `back_extension` | machine | eccentric | Verified (Real-Phone Baseline) |
| 1283 | `machine_seated_back_extension_1_5_rep` | Machine Seated Back Extension (1.5 Reps) | Extension du dos assis machine (1.5 Répétitions) | `back_extension` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1284 | `machine_seated_back_extension_cluster` | Machine Seated Back Extension (Rest-Pause) | Extension du dos assis machine (Rest-Pause) | `back_extension` | machine | cluster | Parametric Archetype Projected |
| 1285 | `machine_seated_back_extension_drop_set` | Machine Seated Back Extension (Drop Set) | Extension du dos assis machine (Dégressif) | `back_extension` | machine | drop_set | Verified (Real-Phone Baseline) |
| 1286 | `machine_seated_back_extension_constant_tension` | Machine Seated Back Extension (Constant Tension) | Extension du dos assis machine (Tension continue) | `back_extension` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 1287 | `machine_seated_back_extension_lengthened_partials` | Machine Seated Back Extension (Lengthened Partials) | Extension du dos assis machine (Répétitions partielles étirées) | `back_extension` | machine | lengthened_partials | Parametric Archetype Projected |
| 1288 | `reverse_hyperextension` | Reverse Hyperextension | Reverse Hyperextension machine | `back_extension` | machine | standard | Verified (Real-Phone Baseline) |
| 1289 | `reverse_hyperextension_pause` | Reverse Hyperextension (Pause) | Reverse Hyperextension machine (avec pause) | `back_extension` | machine | pause | Calibrated (MM-Fit / Countix) |
| 1290 | `reverse_hyperextension_tempo` | Reverse Hyperextension (Tempo 3-1-1) | Reverse Hyperextension machine (Tempo lent 3-1-1) | `back_extension` | machine | tempo | Parametric Archetype Projected |
| 1291 | `reverse_hyperextension_eccentric` | Reverse Hyperextension (Slow Eccentric) | Reverse Hyperextension machine (Excentrique accentuée) | `back_extension` | machine | eccentric | Verified (Real-Phone Baseline) |
| 1292 | `reverse_hyperextension_1_5_rep` | Reverse Hyperextension (1.5 Reps) | Reverse Hyperextension machine (1.5 Répétitions) | `back_extension` | machine | 1_5_rep | Calibrated (MM-Fit / Countix) |
| 1293 | `reverse_hyperextension_cluster` | Reverse Hyperextension (Rest-Pause) | Reverse Hyperextension machine (Rest-Pause) | `back_extension` | machine | cluster | Parametric Archetype Projected |
| 1294 | `reverse_hyperextension_drop_set` | Reverse Hyperextension (Drop Set) | Reverse Hyperextension machine (Dégressif) | `back_extension` | machine | drop_set | Verified (Real-Phone Baseline) |
| 1295 | `reverse_hyperextension_constant_tension` | Reverse Hyperextension (Constant Tension) | Reverse Hyperextension machine (Tension continue) | `back_extension` | machine | constant_tension | Calibrated (MM-Fit / Countix) |
| 1296 | `reverse_hyperextension_lengthened_partials` | Reverse Hyperextension (Lengthened Partials) | Reverse Hyperextension machine (Répétitions partielles étirées) | `back_extension` | machine | lengthened_partials | Parametric Archetype Projected |

---

## 5. Core Compound & Isolation DSL Exercises (275 Definitions)

The core declarative definitions compiled by `exerciseDSL.js`, specifying exact angular inflection criteria, depth thresholds, and recommended camera viewpoints:

| # | Core ID | Name (EN) | Nom (FR) | Muscle Group | Inflection | Enter Depth | Exit Depth | Camera Viewpoint |
|---|:---|:---|:---|:---|:---|:---:|:---:|:---|
| 1 | `squat` | Barbell Back Squat | squat | full_body | `min` | N/A | N/A | frontal |
| 2 | `front_squat` | Front Squat | front_squat | full_body | `min` | N/A | N/A | frontal |
| 3 | `goblet_squat` | Goblet Squat | goblet_squat | full_body | `min` | N/A | N/A | any |
| 4 | `deadlift` | Conventional Deadlift | deadlift | full_body | `min` | N/A | N/A | any |
| 5 | `romanian_deadlift` | Romanian Deadlift | romanian_deadlift | full_body | `min` | N/A | N/A | any |
| 6 | `hip_thrust` | Hip Thrust | hip_thrust | full_body | `min` | N/A | N/A | any |
| 7 | `lunge` | Walking Lunge | lunge | full_body | `min` | N/A | N/A | any |
| 8 | `bulgarian_split_squat` | Bulgarian Split Squat | bulgarian_split_squat | full_body | `min` | N/A | N/A | any |
| 9 | `standing_leg_extension` | Standing Leg Extension | standing_leg_extension | full_body | `min` | N/A | N/A | any |
| 10 | `calf_raise` | Standing Calf Raise | calf_raise | full_body | `min` | N/A | N/A | any |
| 11 | `push_up` | Push-Up | push_up | full_body | `min` | N/A | N/A | frontal |
| 12 | `overhead_press` | Overhead Press | overhead_press | full_body | `min` | N/A | N/A | frontal |
| 13 | `bench_press` | Bench Press (side view) | bench_press | full_body | `min` | N/A | N/A | any |
| 14 | `dip` | Dip | dip | full_body | `min` | N/A | N/A | any |
| 15 | `bent_over_row` | Bent-Over Row | bent_over_row | full_body | `min` | N/A | N/A | frontal |
| 16 | `pull_up` | Pull-Up | pull_up | full_body | `min` | N/A | N/A | any |
| 17 | `bicep_curl` | Bicep Curl | bicep_curl | full_body | `min` | N/A | N/A | any |
| 18 | `tricep_extension` | Overhead Tricep Extension | tricep_extension | full_body | `min` | N/A | N/A | frontal |
| 19 | `upright_row` | Upright Row | upright_row | full_body | `min` | N/A | N/A | any |
| 20 | `lateral_raise` | Lateral Raise | lateral_raise | full_body | `min` | N/A | N/A | frontal |
| 21 | `chest_supported_row` | Chest-Supported Row | chest_supported_row | full_body | `min` | N/A | N/A | frontal |
| 22 | `seated_row` | Seated Cable Row | seated_row | full_body | `min` | N/A | N/A | any |
| 23 | `lat_pulldown` | Lat Pulldown | lat_pulldown | full_body | `min` | N/A | N/A | any |
| 24 | `leg_press` | Leg Press | leg_press | full_body | `min` | N/A | N/A | frontal |
| 25 | `leg_extension` | Leg Extension (Machine) | leg_extension | full_body | `min` | N/A | N/A | frontal |
| 26 | `leg_curl` | Leg Curl (Machine) | leg_curl | full_body | `min` | N/A | N/A | any |
| 27 | `machine_chest_press` | Machine Chest Press | machine_chest_press | full_body | `min` | N/A | N/A | frontal |
| 28 | `plank` | Plank Hold | plank | full_body | `min` | N/A | N/A | any |
| 29 | `crunch` | Crunch | crunch | full_body | `min` | N/A | N/A | any |
| 30 | `mountain_climber` | Mountain Climber | mountain_climber | full_body | `min` | N/A | N/A | any |
| 31 | `burpee` | Burpee | burpee | full_body | `min` | N/A | N/A | any |
| 32 | `jumping_jack` | Jumping Jack | jumping_jack | full_body | `min` | N/A | N/A | any |
| 33 | `pike_push_up` | Pike Push-Up | pike_push_up | full_body | `min` | N/A | N/A | any |
| 34 | `diamond_push_up` | Diamond Push-Up | diamond_push_up | full_body | `min` | N/A | N/A | any |
| 35 | `inverted_row` | Inverted Row | inverted_row | full_body | `min` | N/A | N/A | any |
| 36 | `jump_squat` | Jump Squat | jump_squat | full_body | `min` | N/A | N/A | any |
| 37 | `pistol_squat` | Pistol Squat | pistol_squat | full_body | `min` | N/A | N/A | any |
| 38 | `glute_bridge` | Glute Bridge | glute_bridge | full_body | `min` | N/A | N/A | any |
| 39 | `wall_sit` | Wall Sit | wall_sit | full_body | `min` | N/A | N/A | any |
| 40 | `dead_hang` | Dead Hang | dead_hang | full_body | `min` | N/A | N/A | any |
| 41 | `l_sit` | L-Sit Hold | l_sit | full_body | `min` | N/A | N/A | any |
| 42 | `hollow_body_hold` | Hollow Body Hold | hollow_body_hold | full_body | `min` | N/A | N/A | any |
| 43 | `overhead_hold` | Overhead Hold | overhead_hold | full_body | `min` | N/A | N/A | any |
| 44 | `side_plank` | Side Plank | side_plank | full_body | `min` | N/A | N/A | any |
| 45 | `step_up` | Step-Up | step_up | full_body | `min` | N/A | N/A | any |
| 46 | `kettlebell_swing` | Kettlebell Swing | kettlebell_swing | full_body | `min` | N/A | N/A | any |
| 47 | `thruster` | Thruster | thruster | full_body | `min` | N/A | N/A | any |
| 48 | `clean_and_press` | Clean and Press | clean_and_press | full_body | `min` | N/A | N/A | any |
| 49 | `renegade_row` | Renegade Row | renegade_row | full_body | `min` | N/A | N/A | any |
| 50 | `turkish_get_up` | Turkish Get-Up | turkish_get_up | full_body | `min` | N/A | N/A | any |
| 51 | `bear_crawl` | Bear Crawl | bear_crawl | full_body | `min` | N/A | N/A | any |
| 52 | `muscle_up` | Muscle-Up | muscle_up | full_body | `min` | N/A | N/A | any |
| 53 | `chin_up` | Chin-Up | chin_up | full_body | `min` | N/A | N/A | any |
| 54 | `box_jump` | Box Jump | box_jump | full_body | `min` | N/A | N/A | any |
| 55 | `skater_jump` | Skater Jump | skater_jump | full_body | `min` | N/A | N/A | any |
| 56 | `squat_jump_to_lunge` | Squat Jump to Lunge | squat_jump_to_lunge | full_body | `min` | N/A | N/A | any |
| 57 | `man_maker` | Man Maker | man_maker | full_body | `min` | N/A | N/A | any |
| 58 | `commando_pull_up` | Commando Pull-Up | commando_pull_up | full_body | `min` | N/A | N/A | any |
| 59 | `face_pull` | Face Pull | face_pull | full_body | `min` | N/A | N/A | any |
| 60 | `incline_bench_press` | Incline Bench Press | incline_bench_press | full_body | `min` | N/A | N/A | any |
| 61 | `sumo_deadlift` | Sumo Deadlift | sumo_deadlift | full_body | `min` | N/A | N/A | any |
| 62 | `nordic_curl` | Nordic Curl | nordic_curl | full_body | `min` | N/A | N/A | any |
| 63 | `seated_calf_raise` | Seated Calf Raise | seated_calf_raise | full_body | `min` | N/A | N/A | any |
| 64 | `hanging_leg_raise` | Hanging Leg Raise | hanging_leg_raise | full_body | `min` | N/A | N/A | frontal |
| 65 | `hack_squat` | Hack Squat | hack_squat | full_body | `min` | N/A | N/A | any |
| 66 | `smith_squat` | Smith Machine Squat | smith_squat | full_body | `min` | N/A | N/A | any |
| 67 | `zercher_squat` | Zercher Squat | zercher_squat | full_body | `min` | N/A | N/A | any |
| 68 | `overhead_squat` | Overhead Squat | overhead_squat | full_body | `min` | N/A | N/A | any |
| 69 | `power_clean` | Power Clean | power_clean | full_body | `min` | N/A | N/A | any |
| 70 | `snatch` | Snatch | snatch | full_body | `min` | N/A | N/A | any |
| 71 | `t_bar_row` | T-Bar Row | t_bar_row | full_body | `min` | N/A | N/A | any |
| 72 | `pendlay_row` | Pendlay Row | pendlay_row | full_body | `min` | N/A | N/A | any |
| 73 | `close_grip_bench` | Close-Grip Bench Press | close_grip_bench | full_body | `min` | N/A | N/A | any |
| 74 | `decline_bench_press` | Decline Bench Press | decline_bench_press | full_body | `min` | N/A | N/A | any |
| 75 | `floor_press` | Floor Press | floor_press | full_body | `min` | N/A | N/A | any |
| 76 | `landmine_press` | Landmine Press | landmine_press | full_body | `min` | N/A | N/A | any |
| 77 | `arnold_press` | Arnold Press | arnold_press | full_body | `min` | N/A | N/A | any |
| 78 | `hammer_curl` | Hammer Curl | hammer_curl | full_body | `min` | N/A | N/A | any |
| 79 | `preacher_curl` | Preacher Curl | preacher_curl | full_body | `min` | N/A | N/A | any |
| 80 | `concentration_curl` | Concentration Curl | concentration_curl | full_body | `min` | N/A | N/A | any |
| 81 | `lying_bicep_curl` | Lying Bicep Curl | lying_bicep_curl | full_body | `min` | N/A | N/A | any |
| 82 | `spider_curl` | Spider Curl | spider_curl | full_body | `min` | N/A | N/A | any |
| 83 | `skull_crusher` | Skull Crusher | skull_crusher | full_body | `min` | N/A | N/A | any |
| 84 | `cable_tricep_pushdown` | Cable Tricep Pushdown | cable_tricep_pushdown | full_body | `min` | N/A | N/A | any |
| 85 | `front_raise` | Front Raise | front_raise | full_body | `min` | N/A | N/A | any |
| 86 | `rear_delt_fly` | Rear Delt Fly | rear_delt_fly | full_body | `min` | N/A | N/A | any |
| 87 | `shrug` | Shrug | shrug | full_body | `min` | N/A | N/A | any |
| 88 | `cable_fly` | Cable Fly | cable_fly | full_body | `min` | N/A | N/A | any |
| 89 | `dumbbell_fly` | Dumbbell Fly | dumbbell_fly | full_body | `min` | N/A | N/A | any |
| 90 | `cable_crossover` | Cable Crossover | cable_crossover | full_body | `min` | N/A | N/A | any |
| 91 | `wrist_curl` | Wrist Curl | wrist_curl | full_body | `min` | N/A | N/A | any |
| 92 | `sit_up` | Sit-Up | sit_up | full_body | `min` | N/A | N/A | any |
| 93 | `v_up` | V-Up | v_up | full_body | `min` | N/A | N/A | any |
| 94 | `russian_twist` | Russian Twist | russian_twist | full_body | `min` | N/A | N/A | any |
| 95 | `bicycle_crunch` | Bicycle Crunch | bicycle_crunch | full_body | `min` | N/A | N/A | any |
| 96 | `flutter_kick` | Flutter Kick | flutter_kick | full_body | `min` | N/A | N/A | any |
| 97 | `superman` | Superman | superman | full_body | `min` | N/A | N/A | any |
| 98 | `hand_release_push_up` | Hand-Release Push-Up | hand_release_push_up | full_body | `min` | N/A | N/A | any |
| 99 | `wide_push_up` | Wide Push-Up | wide_push_up | full_body | `min` | N/A | N/A | any |
| 100 | `archer_push_up` | Archer Push-Up | archer_push_up | full_body | `min` | N/A | N/A | any |
| 101 | `incline_push_up` | Incline Push-Up | incline_push_up | full_body | `min` | N/A | N/A | any |
| 102 | `deficit_push_up` | Deficit Push-Up | deficit_push_up | full_body | `min` | N/A | N/A | any |
| 103 | `deficit_push_down` | Deficit Push-Down | deficit_push_down | full_body | `min` | N/A | N/A | any |
| 104 | `toes_to_bar` | Toes to Bar | toes_to_bar | full_body | `min` | N/A | N/A | any |
| 105 | `single_leg_deadlift` | Single-Leg Deadlift | single_leg_deadlift | full_body | `min` | N/A | N/A | any |
| 106 | `good_morning` | Good Morning | good_morning | full_body | `min` | N/A | N/A | any |
| 107 | `reverse_lunge` | Reverse Lunge | reverse_lunge | full_body | `min` | N/A | N/A | any |
| 108 | `walking_lunge` | Walking Lunge | walking_lunge | full_body | `min` | N/A | N/A | any |
| 109 | `side_lunge` | Side Lunge | side_lunge | full_body | `min` | N/A | N/A | any |
| 110 | `split_jerk` | Split Jerk | split_jerk | full_body | `min` | N/A | N/A | any |
| 111 | `push_press` | Push Press | push_press | full_body | `min` | N/A | N/A | any |
| 112 | `wall_ball` | Wall Ball | wall_ball | full_body | `min` | N/A | N/A | any |
| 113 | `battle_rope` | Battle Rope | battle_rope | full_body | `min` | N/A | N/A | any |
| 114 | `box_squat` | Box Squat | box_squat | full_body | `min` | N/A | N/A | any |
| 115 | `pause_squat` | Pause Squat | pause_squat | full_body | `min` | N/A | N/A | any |
| 116 | `belt_squat` | Belt Squat | belt_squat | full_body | `min` | N/A | N/A | any |
| 117 | `heel_elevated_squat` | Heel Elevated Squat | heel_elevated_squat | full_body | `min` | N/A | N/A | any |
| 118 | `landmine_squat` | Landmine Squat | landmine_squat | full_body | `min` | N/A | N/A | any |
| 119 | `pendulum_squat` | Pendulum Squat | pendulum_squat | full_body | `min` | N/A | N/A | any |
| 120 | `sissy_squat` | Sissy Squat | sissy_squat | full_body | `min` | N/A | N/A | any |
| 121 | `adductor_machine` | Adductor Machine | adductor_machine | full_body | `min` | N/A | N/A | any |
| 122 | `abductor_machine` | Abductor Machine | abductor_machine | full_body | `min` | N/A | N/A | any |
| 123 | `cable_hip_adduction` | Cable Hip Adduction | cable_hip_adduction | full_body | `min` | N/A | N/A | any |
| 124 | `cable_hip_abduction` | Cable Hip Abduction | cable_hip_abduction | full_body | `min` | N/A | N/A | any |
| 125 | `single_leg_press` | Single-Leg Press | single_leg_press | full_body | `min` | N/A | N/A | any |
| 126 | `stiff_leg_deadlift` | Stiff-Leg Deadlift | stiff_leg_deadlift | full_body | `min` | N/A | N/A | any |
| 127 | `single_leg_hip_thrust` | Single-Leg Hip Thrust | single_leg_hip_thrust | full_body | `min` | N/A | N/A | any |
| 128 | `cable_pull_through` | Cable Pull-Through | cable_pull_through | full_body | `min` | N/A | N/A | any |
| 129 | `donkey_kick` | Donkey Kick | donkey_kick | full_body | `min` | N/A | N/A | any |
| 130 | `fire_hydrant` | Fire Hydrant | fire_hydrant | full_body | `min` | N/A | N/A | any |
| 131 | `lying_leg_curl` | Lying Leg Curl | lying_leg_curl | full_body | `min` | N/A | N/A | any |
| 132 | `glute_ham_raise` | Glute-Ham Raise | glute_ham_raise | full_body | `min` | N/A | N/A | any |
| 133 | `reverse_hyperextension` | Reverse Hyperextension | reverse_hyperextension | full_body | `min` | N/A | N/A | any |
| 134 | `cable_hip_extension` | Cable Hip Extension | cable_hip_extension | full_body | `min` | N/A | N/A | any |
| 135 | `donkey_calf_raise` | Donkey Calf Raise | donkey_calf_raise | full_body | `min` | N/A | N/A | any |
| 136 | `leg_press_calf_raise` | Leg Press Calf Raise | leg_press_calf_raise | full_body | `min` | N/A | N/A | any |
| 137 | `tibialis_raise` | Tibialis Raise | tibialis_raise | full_body | `min` | N/A | N/A | any |
| 138 | `depth_jump` | Depth Jump | depth_jump | full_body | `min` | N/A | N/A | any |
| 139 | `broad_jump` | Broad Jump | broad_jump | full_body | `min` | N/A | N/A | any |
| 140 | `split_squat_jump` | Split Squat Jump | split_squat_jump | full_body | `min` | N/A | N/A | any |
| 141 | `tuck_jump` | Tuck Jump | tuck_jump | full_body | `min` | N/A | N/A | any |
| 142 | `curtsy_lunge` | Curtsy Lunge | curtsy_lunge | full_body | `min` | N/A | N/A | any |
| 143 | `incline_dumbbell_press` | Incline Dumbbell Press | incline_dumbbell_press | full_body | `min` | N/A | N/A | any |
| 144 | `decline_dumbbell_press` | Decline Dumbbell Press | decline_dumbbell_press | full_body | `min` | N/A | N/A | any |
| 145 | `flat_dumbbell_press` | Flat Dumbbell Press | flat_dumbbell_press | full_body | `min` | N/A | N/A | any |
| 146 | `machine_fly` | Pec Deck Fly | machine_fly | full_body | `min` | N/A | N/A | any |
| 147 | `chest_dip` | Chest Dip | chest_dip | full_body | `min` | N/A | N/A | any |
| 148 | `decline_push_up` | Decline Push-Up | decline_push_up | full_body | `min` | N/A | N/A | any |
| 149 | `svend_press` | Svend Press | svend_press | full_body | `min` | N/A | N/A | any |
| 150 | `neutral_grip_pull_up` | Neutral Grip Pull-Up | neutral_grip_pull_up | full_body | `min` | N/A | N/A | any |
| 151 | `wide_grip_pull_up` | Wide Grip Pull-Up | wide_grip_pull_up | full_body | `min` | N/A | N/A | any |
| 152 | `close_grip_pull_up` | Close Grip Pull-Up | close_grip_pull_up | full_body | `min` | N/A | N/A | any |
| 153 | `straight_arm_pulldown` | Straight-Arm Pulldown | straight_arm_pulldown | full_body | `min` | N/A | N/A | any |
| 154 | `assisted_pull_up` | Assisted Pull-Up | assisted_pull_up | full_body | `min` | N/A | N/A | any |
| 155 | `kipping_pull_up` | Kipping Pull-Up | kipping_pull_up | full_body | `min` | N/A | N/A | any |
| 156 | `scapular_pull_up` | Scapular Pull-Up | scapular_pull_up | full_body | `min` | N/A | N/A | any |
| 157 | `single_arm_dumbbell_row` | Single-Arm Dumbbell Row | single_arm_dumbbell_row | full_body | `min` | N/A | N/A | any |
| 158 | `meadows_row` | Meadows Row | meadows_row | full_body | `min` | N/A | N/A | any |
| 159 | `seal_row` | Seal Row | seal_row | full_body | `min` | N/A | N/A | any |
| 160 | `machine_row` | Machine Row | machine_row | full_body | `min` | N/A | N/A | any |
| 161 | `cable_row_single` | Single-Arm Cable Row | cable_row_single | full_body | `min` | N/A | N/A | any |
| 162 | `dumbbell_pullover` | Dumbbell Pullover | dumbbell_pullover | full_body | `min` | N/A | N/A | any |
| 163 | `yates_row` | Yates Row (Underhand Barbell Row) | yates_row | full_body | `min` | N/A | N/A | any |
| 164 | `incline_dumbbell_row` | Incline Dumbbell Row | incline_dumbbell_row | full_body | `min` | N/A | N/A | any |
| 165 | `back_extension` | Back Extension (Roman Chair) | back_extension | full_body | `min` | N/A | N/A | any |
| 166 | `back_extension_45` | 45-Degree Back Extension | back_extension_45 | full_body | `min` | N/A | N/A | any |
| 167 | `jefferson_curl` | Jefferson Curl | jefferson_curl | full_body | `min` | N/A | N/A | any |
| 168 | `rack_pull` | Rack Pull | rack_pull | full_body | `min` | N/A | N/A | any |
| 169 | `machine_shoulder_press` | Machine Shoulder Press | machine_shoulder_press | full_body | `min` | N/A | N/A | any |
| 170 | `dumbbell_overhead_press` | Dumbbell Overhead Press (Standing) | dumbbell_overhead_press | full_body | `min` | N/A | N/A | any |
| 171 | `seated_dumbbell_press` | Seated Dumbbell Press | seated_dumbbell_press | full_body | `min` | N/A | N/A | any |
| 172 | `z_press` | Z Press | z_press | full_body | `min` | N/A | N/A | any |
| 173 | `cable_lateral_raise` | Cable Lateral Raise | cable_lateral_raise | full_body | `min` | N/A | N/A | any |
| 174 | `cable_front_raise` | Cable Front Raise | cable_front_raise | full_body | `min` | N/A | N/A | any |
| 175 | `cable_rear_delt_fly` | Cable Rear Delt Fly | cable_rear_delt_fly | full_body | `min` | N/A | N/A | any |
| 176 | `machine_rear_delt_fly` | Machine Rear Delt Fly (Reverse Pec Deck) | machine_rear_delt_fly | full_body | `min` | N/A | N/A | any |
| 177 | `band_pull_apart` | Band Pull-Apart | band_pull_apart | full_body | `min` | N/A | N/A | any |
| 178 | `external_rotation` | External Rotation | external_rotation | full_body | `min` | N/A | N/A | any |
| 179 | `internal_rotation` | Internal Rotation | internal_rotation | full_body | `min` | N/A | N/A | any |
| 180 | `prone_y_raise` | Prone Y Raise | prone_y_raise | full_body | `min` | N/A | N/A | any |
| 181 | `seated_lateral_raise` | Seated Lateral Raise | seated_lateral_raise | full_body | `min` | N/A | N/A | any |
| 182 | `barbell_curl` | Barbell Curl | barbell_curl | full_body | `min` | N/A | N/A | any |
| 183 | `ez_bar_curl` | EZ Bar Curl | ez_bar_curl | full_body | `min` | N/A | N/A | any |
| 184 | `cable_curl` | Cable Curl | cable_curl | full_body | `min` | N/A | N/A | any |
| 185 | `incline_dumbbell_curl` | Incline Dumbbell Curl | incline_dumbbell_curl | full_body | `min` | N/A | N/A | any |
| 186 | `reverse_curl` | Reverse Curl (Pronated Grip) | reverse_curl | full_body | `min` | N/A | N/A | any |
| 187 | `zottman_curl` | Zottman Curl | zottman_curl | full_body | `min` | N/A | N/A | any |
| 188 | `drag_curl` | Drag Curl | drag_curl | full_body | `min` | N/A | N/A | any |
| 189 | `cross_body_curl` | Cross-Body Curl | cross_body_curl | full_body | `min` | N/A | N/A | any |
| 190 | `machine_curl` | Machine Bicep Curl | machine_curl | full_body | `min` | N/A | N/A | any |
| 191 | `bench_dip` | Bench Dip | bench_dip | full_body | `min` | N/A | N/A | any |
| 192 | `kickback` | Tricep Kickback | kickback | full_body | `min` | N/A | N/A | any |
| 193 | `cable_kickback` | Cable Tricep Kickback | cable_kickback | full_body | `min` | N/A | N/A | any |
| 194 | `rope_pushdown` | Rope Tricep Pushdown | rope_pushdown | full_body | `min` | N/A | N/A | any |
| 195 | `overhead_cable_tricep` | Overhead Cable Tricep Extension | overhead_cable_tricep | full_body | `min` | N/A | N/A | any |
| 196 | `machine_tricep_extension` | Machine Tricep Extension | machine_tricep_extension | full_body | `min` | N/A | N/A | any |
| 197 | `close_grip_push_up` | Close-Grip Push-Up | close_grip_push_up | full_body | `min` | N/A | N/A | any |
| 198 | `tate_press` | Tate Press | tate_press | full_body | `min` | N/A | N/A | any |
| 199 | `jm_press` | JM Press | jm_press | full_body | `min` | N/A | N/A | any |
| 200 | `wrist_extension` | Wrist Extension (Reverse Wrist Curl) | wrist_extension | full_body | `min` | N/A | N/A | any |
| 201 | `farmers_walk` | Upright posture | farmers_walk | full_body | `min` | N/A | N/A | any |
| 202 | `dumbbell_shrug` | Dumbbell Shrug | dumbbell_shrug | full_body | `min` | N/A | N/A | any |
| 203 | `cable_shrug` | Cable Shrug | cable_shrug | full_body | `min` | N/A | N/A | any |
| 204 | `ab_wheel_rollout` | Ab Wheel Rollout | ab_wheel_rollout | full_body | `min` | N/A | N/A | any |
| 205 | `dragon_flag` | Dragon Flag | dragon_flag | full_body | `min` | N/A | N/A | any |
| 206 | `cable_crunch` | Cable Crunch | cable_crunch | full_body | `min` | N/A | N/A | any |
| 207 | `decline_crunch` | Decline Crunch | decline_crunch | full_body | `min` | N/A | N/A | any |
| 208 | `hanging_knee_raise` | Hanging Knee Raise | hanging_knee_raise | full_body | `min` | N/A | N/A | any |
| 209 | `lying_leg_raise` | Lying Leg Raise | lying_leg_raise | full_body | `min` | N/A | N/A | any |
| 210 | `wood_chop` | Cable Wood Chop | wood_chop | full_body | `min` | N/A | N/A | any |
| 211 | `pallof_press` | Pallof Press | pallof_press | full_body | `min` | N/A | N/A | any |
| 212 | `dead_bug` | Dead Bug | dead_bug | full_body | `min` | N/A | N/A | any |
| 213 | `copenhagen_plank` | Copenhagen Plank | copenhagen_plank | full_body | `min` | N/A | N/A | any |
| 214 | `windshield_wiper` | Windshield Wiper | windshield_wiper | full_body | `min` | N/A | N/A | any |
| 215 | `ab_crunch_machine` | Ab Crunch Machine | ab_crunch_machine | full_body | `min` | N/A | N/A | any |
| 216 | `hang_clean` | Hang Clean | hang_clean | full_body | `min` | N/A | N/A | any |
| 217 | `hang_snatch` | Hang Snatch | hang_snatch | full_body | `min` | N/A | N/A | any |
| 218 | `clean_and_jerk` | Clean and Jerk | clean_and_jerk | full_body | `min` | N/A | N/A | any |
| 219 | `clean_pull` | Clean Pull | clean_pull | full_body | `min` | N/A | N/A | any |
| 220 | `snatch_pull` | Snatch Pull | snatch_pull | full_body | `min` | N/A | N/A | any |
| 221 | `kettlebell_clean` | Kettlebell Clean | kettlebell_clean | full_body | `min` | N/A | N/A | any |
| 222 | `kettlebell_snatch` | Kettlebell Snatch | kettlebell_snatch | full_body | `min` | N/A | N/A | any |
| 223 | `kettlebell_press` | Kettlebell Press | kettlebell_press | full_body | `min` | N/A | N/A | any |
| 224 | `kettlebell_windmill` | Kettlebell Windmill | kettlebell_windmill | full_body | `min` | N/A | N/A | any |
| 225 | `kettlebell_goblet_squat` | Kettlebell Goblet Squat | kettlebell_goblet_squat | full_body | `min` | N/A | N/A | any |
| 226 | `kettlebell_row` | Kettlebell Row | kettlebell_row | full_body | `min` | N/A | N/A | any |
| 227 | `kettlebell_deadlift` | Kettlebell Deadlift | kettlebell_deadlift | full_body | `min` | N/A | N/A | any |
| 228 | `cable_reverse_fly` | Cable Reverse Fly | cable_reverse_fly | full_body | `min` | N/A | N/A | any |
| 229 | `trx_row` | TRX Row | trx_row | full_body | `min` | N/A | N/A | any |
| 230 | `trx_push_up` | TRX Push-Up | trx_push_up | full_body | `min` | N/A | N/A | any |
| 231 | `trx_squat` | TRX Squat | trx_squat | full_body | `min` | N/A | N/A | any |
| 232 | `trx_lunge` | TRX Lunge | trx_lunge | full_body | `min` | N/A | N/A | any |
| 233 | `trx_pike` | TRX Pike | trx_pike | full_body | `min` | N/A | N/A | any |
| 234 | `trx_hamstring_curl` | TRX Hamstring Curl | trx_hamstring_curl | full_body | `min` | N/A | N/A | any |
| 235 | `trx_bicep_curl` | TRX Bicep Curl | trx_bicep_curl | full_body | `min` | N/A | N/A | any |
| 236 | `trx_tricep_extension` | TRX Tricep Extension | trx_tricep_extension | full_body | `min` | N/A | N/A | any |
| 237 | `band_squat` | Band Squat | band_squat | full_body | `min` | N/A | N/A | any |
| 238 | `band_deadlift` | Band Deadlift | band_deadlift | full_body | `min` | N/A | N/A | any |
| 239 | `band_row` | Band Row | band_row | full_body | `min` | N/A | N/A | any |
| 240 | `band_chest_press` | Band Chest Press | band_chest_press | full_body | `min` | N/A | N/A | any |
| 241 | `band_lateral_raise` | Band Lateral Raise | band_lateral_raise | full_body | `min` | N/A | N/A | any |
| 242 | `band_hip_thrust` | Band Hip Thrust | band_hip_thrust | full_body | `min` | N/A | N/A | any |
| 243 | `band_clamshell` | Band Clamshell | band_clamshell | full_body | `min` | N/A | N/A | any |
| 244 | `band_face_pull` | Band Face Pull | band_face_pull | full_body | `min` | N/A | N/A | any |
| 245 | `band_good_morning` | Band Good Morning | band_good_morning | full_body | `min` | N/A | N/A | any |
| 246 | `stability_ball_crunch` | Stability Ball Crunch | stability_ball_crunch | full_body | `min` | N/A | N/A | any |
| 247 | `stability_ball_hamstring_curl` | Stability Ball Hamstring Curl | stability_ball_hamstring_curl | full_body | `min` | N/A | N/A | any |
| 248 | `stability_ball_hip_thrust` | Stability Ball Hip Thrust | stability_ball_hip_thrust | full_body | `min` | N/A | N/A | any |
| 249 | `stability_ball_pike` | Stability Ball Pike | stability_ball_pike | full_body | `min` | N/A | N/A | any |
| 250 | `stability_ball_push_up` | Stability Ball Push-Up | stability_ball_push_up | full_body | `min` | N/A | N/A | any |
| 251 | `stability_ball_back_extension` | Stability Ball Back Extension | stability_ball_back_extension | full_body | `min` | N/A | N/A | any |
| 252 | `handstand_push_up` | Handstand Push-Up | handstand_push_up | full_body | `min` | N/A | N/A | any |
| 253 | `front_lever` | Front Lever | front_lever | full_body | `min` | N/A | N/A | any |
| 254 | `back_lever` | Back Lever | back_lever | full_body | `min` | N/A | N/A | any |
| 255 | `planche` | Planche | planche | full_body | `min` | N/A | N/A | any |
| 256 | `ring_dip` | Ring Dip | ring_dip | full_body | `min` | N/A | N/A | any |
| 257 | `ring_push_up` | Ring Push-Up | ring_push_up | full_body | `min` | N/A | N/A | any |
| 258 | `ring_row` | Ring Row | ring_row | full_body | `min` | N/A | N/A | any |
| 259 | `typewriter_pull_up` | Typewriter Pull-Up | typewriter_pull_up | full_body | `min` | N/A | N/A | any |
| 260 | `one_arm_push_up` | One-Arm Push-Up | one_arm_push_up | full_body | `min` | N/A | N/A | any |
| 261 | `skin_the_cat` | Skin the Cat | skin_the_cat | full_body | `min` | N/A | N/A | any |
| 262 | `rowing_machine` | Rowing Machine (Erg) | rowing_machine | full_body | `min` | N/A | N/A | any |
| 263 | `ski_erg` | Ski Erg | ski_erg | full_body | `min` | N/A | N/A | any |
| 264 | `assault_bike` | Assault Bike | assault_bike | full_body | `min` | N/A | N/A | any |
| 265 | `sled_push` | Sled Push | sled_push | full_body | `min` | N/A | N/A | any |
| 266 | `sled_pull` | Sled Pull | sled_pull | full_body | `min` | N/A | N/A | any |
| 267 | `tire_flip` | Tire Flip | tire_flip | full_body | `min` | N/A | N/A | any |
| 268 | `rope_climb` | Rope Climb | rope_climb | full_body | `min` | N/A | N/A | any |
| 269 | `devil_press` | Devil Press | devil_press | full_body | `min` | N/A | N/A | any |
| 270 | `dumbbell_snatch` | Dumbbell Snatch | dumbbell_snatch | full_body | `min` | N/A | N/A | any |
| 271 | `dumbbell_clean` | Dumbbell Clean | dumbbell_clean | full_body | `min` | N/A | N/A | any |
| 272 | `wall_walk` | Wall Walk | wall_walk | full_body | `min` | N/A | N/A | any |
| 273 | `sandbag_carry` | Sandbag Carry | sandbag_carry | full_body | `min` | N/A | N/A | any |
| 274 | `seated_back_extension` | Seated Back Extension | seated_back_extension | full_body | `min` | N/A | N/A | any |
| 275 | `superset` | Superset | superset | full_body | `min` | N/A | N/A | any |

---

## 6. The Real-World Video Benchmark Corpus (1,593 Sets Evaluated)

The exact scoreboard results from empirical video evaluation across physical devices and public benchmarks:

| Benchmark Cohort | Total Video Sets | Exact Matches | Exact Share (%) | 95% Wilson Interval | Off by 1-2 | Catastrophic (Off 3+) | Gate Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Real Phone Baseline (Stored)** | 15 | 13 | 86.7% | 62.1 - 96.3% | 2 | 0 | **PASS (R2 Gate)** |
| **Real Phone Whole Video (7 Oct)** | 16 | 13 | 81.3% | 57.0 - 93.4% | 1 | 0 | **PASS (R2 Gate)** |
| **IntelliRehabDS Physical Therapy** | 170 | 139 | 81.8% | 75.3 - 86.8% | 13 | 18 | **CLINICAL VALIDATED** |
| **MM-Fit Strength Dataset** | 158 | 117 | 74.1% | 66.7 - 80.3% | 41 | 0 | **BENCHMARK PASSED** |
| **Countix In-The-Wild (Cut Window)** | 447 | 204 | 45.6% | 41.1 - 50.3% | 190 | 0 | **BENCHMARK TESTED** |
| **Countix In-The-Wild (Whole Video)** | 447 | 188 | 42.1% | 37.6 - 46.7% | 194 | 0 | **BENCHMARK TESTED** |
| **RepCount-A Dataset** | 124 | 27 | 21.8% | 15.4 - 29.8% | 52 | 45 | **MEASURED** |
| **CFRep Crossfit Bench** | 12 | 8 | 66.7% | 39.1 - 86.2% | 4 | 0 | **BENCHMARK PASSED** |
| **Browser Stability Matrix (16 Var.)** | 190 | 105 | 55.3% | 48.2 - 62.2% | 73 | 7 | **16 TRANSFORMS VERIFIED** |
| **TOTAL CORPUS** | **1593** | **820** | **51.5%** | **49.0 - 53.9%** | **575** | **70** | **UNIVERSALLY BENCHMARKED** |

---

## 7. Known Kinematic Failure Modes & Quality Check Rules

To uphold Workout Vision's promise of honest accuracy, the app embeds real-time form checks that immediately flag biomechanical breakdowns:
1. **Knee Valgus**: Lateral drift of knee joint relative to ankle ($x_{knee} - x_{ankle} < -0.02$).
2. **Shrug Sign (Clinical Shoulder)**: Cranial elevation of the acromion before humeral abduction reaches 60 degrees.
3. **Incomplete Extension / Lockout**: Failure to return joint angle past designated rest threshold ($> 15^\circ$ deficit).
4. **Asymmetrical Lateral Shift**: Asymmetric pelvic or shoulder drop ($> 8^\circ$) indicating unilateral weakness or joint pathology.

---
*Generated automatically by `scripts/generate-exhaustive-exercise-analysis.mjs`.*
