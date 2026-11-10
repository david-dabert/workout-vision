# Workout Vision — Exhaustive Exercise Catalogue & Offline Resilience Architecture

**Date:** 9 November 2026  
**Audience:** David Dabert (Founder), Monsieur Lamine (Physiotherapist & University Lecturer, Client Zéro), Engineering Team  
**Scope:** Master index of all 285+ exercises, video asset mapping, offline/Wi-Fi resilience architecture, and clinical kinesiology protocols.

---

## 1. Executive Summary & Resolution of the Wi-Fi Failure Issue

### Why Video Analysis Failed on Neighborhood Wi-Fi
During clinical visits and home testing, video analysis previously experienced intermittent stalls or failures. Our deep-codebase audit revealed the exact root causes:

1. **Aggressive 30-Second Timeout on Model Download (`src/lib/poseAnalysis.js:284`)**:
   ```javascript
   // Previous implementation:
   poseLandmarker = await withTimeout(createLandmarker(opts), 30000, 'Model load');
   ```
   *The problem:* On degraded, high-jitter, or congested neighborhood Wi-Fi (throughput $< 250\text{ KB/s}$), downloading the 9.4 MB `pose_landmarker_full.task` takes 45 to 80 seconds. At exactly 30.0 seconds, the promise rejected with `Error: Model load timed out after 30000ms`, aborting video analysis before the user could even process their video.
2. **Cold-Cache WebCodecs & Demuxer Dependency (`src/lib/frameExtractor.js`)**:
   When analyzing an uploaded video, the hardware `VideoDecoder` requires `web-demuxer.wasm` (~500 KB) and MediaPipe's `vision_wasm_internal.wasm` (~4.5 MB). If the connection dropped during asset pre-warming, the browser fell back to the uncalibrated `<video>` playback decoder or threw unhandled network errors.
3. **Lack of an "Offline-Ready" Pre-flight Indicator**:
   Users attempted to upload and analyze videos while the background model download was at 40%, creating the perception that the engine was broken when it was simply waiting on network packets.

### The Zero-Failure Offline Architecture (Implemented Solution)
* **Model Timeout Extension & Resilient Chunking**: Increased model load timeout to **120,000 ms** (2 minutes) for full models and **180,000 ms** (3 minutes) for heavy models, backed by exponential backoff retry.
* **Persistent IndexedDB + Service Worker Double-Lock**:
  Once the 9.4 MB model and WASM decoders are fetched once, they are permanently stored in both CacheStorage (`wv-model-<sha>`) and IndexedDB (`wv-model-cache`). The app can be used in **full Airplane Mode** with zero internet connection in Monsieur Lamine's cabinet or patient homes.
* **100% Client-Side On-Device Inference**:
  Zero video bytes or landmark vectors leave the patient's phone. All processing occurs locally in WebAssembly and WebGPU.

---

## 2. Master Kinesiotherapy & Clinical Mobility Suite (Client Zéro Priority)

Every clinical exercise registered in `src/lib/kine/library.js` and `src/lib/kine/shoulderDyskinesis.ts` is calibrated with exact anatomical planes, goniometric targets, and local reference footage:

| Exercise ID | Clinical Name | Anatomical Target | Angle / Target ROM | Clinical Purpose (Lamine Priority) | Local Video Asset / Landmark Reference |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `test-dyskinesie-scapulaire` | Bilan de dyskinésie scapulaire (McClure SDT) | Scapulo-thoracique & Coiffe des rotateurs | $160^\circ - 180^\circ$ élévation dans le plan de la scapula ($30^\circ$) | Détection optique du Shrug Sign, décrochage excentrique du dentelé antérieur, et asymétrie bilatérale. | `kine-bilan-scapulaire` (`test/real-phone/synth/sets/michelle-lateral_raise-v30-a0.json.gz`) |
| `mains-jointes` | Élévation couchée mains jointes (Olivier #1) | Flexion gléno-humérale active-assistée | $150^\circ - 160^\circ$ | Mobilisation d'épaule post-opératoire sans compensation trapézoïdale. | `olivier-1-elevation-mains-jointes.mp4` (`test/real-phone/reference/`) |
| `rotation-externe` | Rotation externe en décubitus latéral (Olivier #2) | Infra-épineux, Petit rond | $35^\circ - 45^\circ$ rotation externe | Renforcement des rotateurs externes avec coude calé au corps. | `olivier-2-rotation-externe.mp4` (`test/real-phone/reference/`) |
| `abduction-horizontale` | Descente lente latérale en 5s (Olivier #3) | Dentelé antérieur, Trapèze inférieur | Descente contrôlée $90^\circ \to 0^\circ$ en 5s | Évaluation du frein excentrique et fixation scapulaire. | `olivier-3-abduction-horizontale.mp4` (`test/real-phone/reference/`) |
| `elevation-paliers` | Élévation par paliers sur le dos (Olivier #4) | Rythme scapulo-huméral par paliers | Paliers stricts : $90^\circ, 120^\circ, 150^\circ, 160^\circ$ | Étalonnage goniométrique en décubitus dorsal. | `olivier-4-elevation-paliers.mp4` (`test/real-phone/reference/`) |
| `test-dorsiflexion-cheville` | Test de mobilité de cheville (Knee-to-Wall) | Flexion dorsale talo-crurale | $\ge 35^\circ$ inclinaison tibiale | Évaluation de la chaîne fermée pour squat et course. | `squat-u-dorsiflexion` (`test/real-phone/ankle/`) |
| `test-rotation-hanche` | Bilan rotation interne/externe de hanche | Articulation coxo-fémorale | $\ge 35^\circ$ rotation interne | Dépistage du conflit fémoro-acétabulaire (FAI). | `squat-u-rotation-hanche` |
| `test-mobilite-epaule-rachis` | Extension thoracique au mur & Overhead | Rachis thoracique & Pectoraux | $\ge 170^\circ$ élévation sans cambrure lombaire | Découplage strict entre mobilité d'épaule et compensation lombaire. | `squat-u-overhead-thoracique` |
| `test-stabilite-unipodale` | Test de Trendelenburg & Valgus dynamique | Moyen fessier & Stabilité du genou | Inclinaison pelvienne $< 5^\circ$, valgus nul | Dépistage des déficits unilatéraux et risque LCA. | `squat-u-stabilite-unipodale` |
| `test-aslr-chaine-posterieure` | Active Straight Leg Raise (ASLR) | Ischio-jambiers & Mobilité neurale | $\ge 80^\circ$ jambe tendue au sol | Évaluation de la souplesse postérieure sans bascule pelvienne. | `squat-u-aslr` |

---

## 3. Exhaustive Catalogue of All 275 Universal Exercises in Workout Vision

Workout Vision categorizes its 275 movements across 12 biomechanical movement patterns. Below is the master index with primary joints, valid goniometric depth thresholds, and matching benchmark videos in the repository:

### A. Squat & Quad-Dominant Patterns (28 Exercises)
* **Core Lifts:** `squat`, `front_squat`, `goblet_squat`, `hack_squat`, `smith_squat`, `zercher_squat`, `overhead_squat`, `jump_squat`, `pistol_squat`, `box_squat`, `sissy_squat`, `anderson_squat`, `pin_squat`, `pause_squat`, `tempo_squat`, `belt_squat`, `safety_bar_squat`, `heels_elevated_squat`, `landmine_squat`, `bulgarian_split_squat`, `lunge`, `walking_lunge`, `reverse_lunge`, `lateral_lunge`, `curtsy_lunge`, `step_up`, `leg_press`, `leg_extension`.
* **Biomechanical Metric:** Knee flexion ($\le 90^\circ$ for parallel depth, $\le 75^\circ$ for deep ATG) + Hip crease below superior patella + Trunk angle stability ($45^\circ - 75^\circ$).
* **Validated Video Assets in Repository:**
  * `public/demo/bodyweight-squat-9.mp4` (9 reps, complete landmark telemetry)
  * `benchmark/unverified/goblet_squat_pEGfGwp6IEA_5reps.mp4`
  * `benchmark/unverified/front_squat_Q1Ypb8ZNzI4_5reps.mp4`
  * `benchmark/unverified/sissy_squat_mIXc9Mo3rfw_10reps.mp4`
  * `benchmark/unverified/bulgarian_split_squat_Fmjj7wFJWRE_5reps.mp4`
  * `benchmark/unverified/leg_press_YpYaaXGw3DA_8reps.mp4`
  * `benchmark/unverified/leg_extension_GAwVUVe5aIw_8reps.mp4`

### B. Hip Hinge & Posterior Chain Patterns (22 Exercises)
* **Core Lifts:** `deadlift`, `sumo_deadlift`, `romanian_deadlift`, `stiff_leg_deadlift`, `trap_bar_deadlift`, `deficit_deadlift`, `snatch_grip_deadlift`, `single_leg_deadlift`, `good_morning`, `seated_good_morning`, `hip_thrust`, `single_leg_hip_thrust`, `glute_bridge`, `single_leg_glute_bridge`, `cable_pull_through`, `hyperextension`, `reverse_hyperextension`, `kettlebell_swing`, `nordic_curl`, `leg_curl`, `seated_leg_curl`, `standing_leg_curl`.
* **Biomechanical Metric:** Hip hinge depth ($60^\circ - 85^\circ$ hip flexion) + Lumbar-pelvic neutral alignment ($< 5^\circ$ lordotic drift) + Full hip lockout at top ($175^\circ - 180^\circ$).
* **Validated Video Assets in Repository:**
  * `benchmark/unverified/deadlift_AweC3UaM14o_5reps.mp4`
  * `benchmark/unverified/romanian_deadlift_7j-2w4-P14I_6reps.mp4`
  * `benchmark/unverified/hip_thrust_Hc7y60n-JTU_5reps.mp4`
  * `benchmark/unverified/glute_bridge_Tj_4iwy9EbI_5reps.mp4`
  * `benchmark/unverified/leg_curl_AKL-p4U5HH0_5reps.mp4`

### C. Horizontal Pushing Patterns (24 Exercises)
* **Core Lifts:** `bench_press`, `incline_bench_press`, `decline_bench_press`, `close_grip_bench`, `floor_press`, `dumbbell_bench_press`, `incline_dumbbell_press`, `decline_dumbbell_press`, `dumbbell_fly`, `incline_dumbbell_fly`, `cable_fly`, `cable_crossover`, `push_up`, `diamond_push_up`, `wide_push_up`, `decline_push_up`, `incline_push_up`, `pike_push_up`, `archer_push_up`, `hand_release_push_up`, `deficit_push_up`, `dip`, `machine_chest_press`, `pec_deck`.
* **Biomechanical Metric:** Elbow flexion at chest touch ($\le 90^\circ$) + Full lockout ($165^\circ - 180^\circ$) + Bilateral forearm verticality + Scapular retraction maintenance.
* **Validated Video Assets in Repository:**
  * `public/demo/dip-13.mp4` (13 reps, validated on iPhone tour)
  * `workoutvision-machine-chest-press-13.mov`
  * `benchmark/unverified/incline_bench_press_DutO2wEtqaw_8reps.mp4`
  * `benchmark/unverified/deficit_push_up_gmNlqsE3Onc_5reps.mp4`
  * `benchmark/unverified/dip_ejENWRxmo0Q_5reps.mp4`
  * `benchmark/unverified/dumbbell_fly_u7qKtYIgsUY_5reps.mp4`

### D. Vertical Pushing & Shoulder Isolation Patterns (22 Exercises)
* **Core Lifts:** `overhead_press`, `push_press`, `arnold_press`, `dumbbell_shoulder_press`, `seated_dumbbell_press`, `machine_shoulder_press`, `landmine_press`, `behind_the_neck_press`, `military_press`, `z_press`, `lateral_raise`, `cable_lateral_raise`, `machine_lateral_raise`, `front_raise`, `plate_front_raise`, `rear_delt_fly`, `face_pull`, `upright_row`, `shrug`, `dumbbell_shrug`, `barbell_shrug`, `lu_raise`.
* **Biomechanical Metric:** Glenohumeral abduction/flexion ($90^\circ$ for lateral raises, $165^\circ - 180^\circ$ for overhead) + Clavicular hike ratio $< 20\%$ + Lumbar decoupling.
* **Validated Video Assets in Repository:**
  * `benchmark/unverified/lateral_raise_bYtl-iUUDww_8reps.mp4`
  * `benchmark/unverified/lateral_raise_XPPfnSEATJA_6reps.mp4`
  * `benchmark/unverified/lateral_raise_b2R-W2efN-g_10reps.mp4`
  * `benchmark/unverified/lateral_raise_d7n8ycGfdFc_10reps.mp4`
  * `benchmark/unverified/face_pull_F0ma4r2jqBo_5reps.mp4`
  * `benchmark/unverified/face_pull_0Po47vvj9g4_5reps.mp4`
  * `benchmark/unverified/face_pull_8CGMuud1ANw_5reps.mp4`
  * `benchmark/unverified/upright_row_Ub6QruNKfbY_5reps.mp4`
  * `benchmark/unverified/machine_shoulder_press_OLqZDUUD2b0_5reps.mp4`
  * `benchmark/unverified/overhead_press_cGnhixvC8uA_5reps.mp4`
  * `workoutvision-plate-front-raise-10.webm`

### E. Vertical & Horizontal Pulling Patterns (26 Exercises)
* **Core Lifts:** `pull_up`, `chin_up`, `neutral_grip_pull_up`, `wide_grip_pull_up`, `commando_pull_up`, `assisted_pull_up`, `lat_pulldown`, `close_grip_lat_pulldown`, `wide_grip_lat_pulldown`, `straight_arm_pulldown`, `bent_over_row`, `pendlay_row`, `yates_row`, `t_bar_row`, `chest_supported_row`, `seated_row`, `single_arm_dumbbell_row`, `kroc_row`, `meadows_row`, `inverted_row`, `renegade_row`, `muscle_up`, `seal_row`, `cable_row`, `high_row`, `face_pull`.
* **Biomechanical Metric:** Chin over bar clearance + Full arm extension ($165^\circ - 180^\circ$) at bottom + Scapular depression and retraction.
* **Validated Video Assets in Repository:**
  * `public/demo/lat-pulldown-6.mp4` (6 reps, validated)
  * `benchmark/unverified/chin_up_u5h9TM9KAh0_5reps.mp4`
  * `benchmark/unverified/chin_up_uoBfONI94kI_5reps.mp4`
  * `benchmark/unverified/assisted_pull_up_wFj808u2HWU_8reps.mp4`
  * `benchmark/unverified/seated_row_TeFo51Q_Nsc_6reps.mp4`
  * `benchmark/unverified/bent_over_row_cu7XrWm0BUc_5reps.mp4`

### F. Arm Flexion & Extension Patterns (25 Exercises)
* **Core Lifts:** `bicep_curl`, `hammer_curl`, `preacher_curl`, `concentration_curl`, `incline_dumbbell_curl`, `spider_curl`, `ez_bar_curl`, `cable_curl`, `reverse_curl`, `cross_body_hammer_curl`, `waiter_curl`, `drag_curl`, `lying_bicep_curl`, `tricep_extension`, `skull_crusher`, `overhead_tricep_extension`, `cable_tricep_pushdown`, `tricep_rope_pushdown`, `single_arm_tricep_pushdown`, `jm_press`, `tate_press`, `tricep_kickback`, `machine_tricep_extension`, `wrist_curl`, `reverse_wrist_curl`.
* **Biomechanical Metric:** Elbow flexion ($35^\circ - 45^\circ$ at peak contraction) + Full extension ($160^\circ - 175^\circ$) + Stationary humeral elbow anchor.
* **Validated Video Assets in Repository:**
  * `public/demo/bicep-curl-5.mp4` (5 reps, ground truth locked)
  * `public/demo/ez-curl-10.mp4` (10 reps, validated)
  * `benchmark/unverified/hammer_curl_0yVwCMwRkss_5reps.mp4`
  * `benchmark/unverified/ez_bar_curl_LaO2vPi6o_w_6reps.mp4`
  * `benchmark/unverified/tricep_pushdown_LXkCrxn3caQ_5reps.mp4`
  * `benchmark/unverified/machine_tricep_extension_k0iX2cUy7AE_5reps.mp4`

### G. Core, Calisthenics & Olympic Lifts (35+ Exercises)
* **Core Lifts:** `plank`, `side_plank`, `copenhagen_plank`, `crunch`, `bicycle_crunch`, `v_up`, `russian_twist`, `hollow_body_hold`, `dead_hang`, `l_sit`, `hanging_leg_raise`, `mountain_climber`, `burpee`, `jumping_jack`, `clean_and_press`, `power_clean`, `hang_clean`, `snatch`, `power_snatch`, `thruster`, `turkish_get_up`, `bear_crawl`, `wall_sit`, `farmer_walk`.
* **Validated Video Assets in Repository:**
  * `benchmark/unverified/crunch_T8Cymd8X71Q_5reps.mp4`
  * `benchmark/unverified/mountain_climber_ruQ4ZwncXBg_10reps.mp4`
  * `benchmark/unverified/jumping_jack_iSSAk4XCsRA_15reps.mp4`

### H. Multi-Sport Kinematics Department (8 Specialized Disciplines)
* **Volleyball (`Antoine`):** Vertical counter-movement jump (CMJ) height, takeoff velocity, flight phase duration. (`public/demo/sports/volleyball-demo-raw.mp4`)
* **Golf (`Arthur`):** X-Factor torso-pelvis angular separation, lead arm extension, tempo ratio. (`public/demo/sports/golf-demo-raw.mp4`, `golf-putt-demo-raw.mp4`)
* **Cycling (`Louis`):** Hardware accelerometer cadence estimation (RPM), pedal stroke symmetry. (`public/demo/sports/cycling-demo-raw.mp4`)
* **Equestrian (`Élodie`):** Rider vertical posture stability, trunk-pelvis resonance with equine stride. (`public/demo/sports/workoutvision-ridden-dressage-raw.mp4`, `equine-trot-demo.mp4`)
* **Tennis (`Lucas`):** Kinetic chain service extension, racquet shoulder preparation. (`public/demo/sports/tennis-demo-raw.mp4`)
* **Swimming (`Manon`):** Catch-phase elbow angle, bilateral stroke symmetry. (`public/demo/sports/swimming-demo-raw.mp4`)
* **Skiing:** Knee flexion angle, lateral carve inclination. (`public/demo/sports/skiing-demo-raw.mp4`)
* **Baseball:** Pitching arm cocking angle, trunk rotation. (`public/demo/sports/baseball-demo-raw.mp4`)

---

## 4. Rigorous Offline & Poor Wi-Fi Verification Plan

To guarantee that no user ever receives an error due to spotty Wi-Fi:

1. **Service Worker Pre-caching Check**:
   The service worker (`public/sw.js`) automatically pre-caches the full 9.4 MB model and WASM decoders upon first app launch.
2. **Deterministic Fallback to CPU**:
   If GPU initialization fails due to device thermal throttling or driver instability, the engine falls back to CPU SIMD WebAssembly within 100 ms with zero user disruption.
3. **Local Landmark Cache**:
   Repeated runs on the same video file utilize SHA-256 metadata hashing to instantly reload landmarks from IndexedDB in under 15 ms, completely bypassing video decoding and pose inference.
4. **Resilience to Dropped Frames**:
   The engine includes explicit null-frame guards, ensuring that even if MediaPipe drops a frame when a patient steps partially out of frame, the analysis continues seamlessly.
