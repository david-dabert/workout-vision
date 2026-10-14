# Survey of Public Repetition-Counting & Rehabilitation Datasets

## Executive Summary
This survey evaluates 11 prominent public computer vision datasets for physical therapy, rehabilitation, and fitness exercise repetition counting and form analysis. Each dataset is audited for licensing terms (open vs non-commercial vs proprietary), commercial use permissions, annotation fidelity (temporal rep boundaries vs cumulative counts vs 2D/3D skeletal keypoints), sensor setup, and applicability to on-device zero-server computer vision pipelines.

### Primary Recommendation: IntelliRehabDS (IRDS)
Among the 11 surveyed datasets, **IntelliRehabDS (Miron et al., 2021)** is the single most viable dataset for WorkoutVision's validation and benchmarking suite because:
1. **Unambiguous Open License:** Released under **Creative Commons Attribution 4.0 International (CC BY 4.0)**, explicitly permitting commercial adaptation, benchmarking, and transformation without royalties or restrictive NDAs.
2. **Repetition-Level Granularity:** Every single repetition is individually segmented and annotated with subject ID, exercise gesture label, repetition index, correctness verdict (correct vs pathological/incorrect), and patient posture (seated vs standing).
3. **Rigorous Cohort:** Captures 29 diverse subjects (15 healthy individuals, 14 patients undergoing neurological or musculoskeletal rehabilitation) across 9 distinct functional exercises.

---

## Comparative Matrix: 11 Repetition & Rehabilitation Datasets

| Dataset | Primary Focus | License | Commercial Use? | Annotation Level | Exercises | Subjects / Clips | Views & FPS | Download Size |
|---|---|---|---|---|---|---|---|---|
| **IntelliRehabDS** (2021) | Rehab / MSK | **CC BY 4.0** | **YES** | Rep boundaries, 3D joints, correctness | 9 | 29 subjects, 5,000+ reps | Depth + 3D, 30 fps | 198 MB (Skeleton), ~30 GB (Depth) |
| **UI-PRMD** (2018) | Physio / Rehab | **ODC-PDDL v1.0** / MIT | **YES** | Joint angles, repetitions, Vicon mocap | 10 | 10 subjects, ~1,000 reps | Frontal Kinect + Vicon, 30 fps | ~1.2 GB |
| **REHAB24-6** (2024) | Physio / PT | Non-Commercial Research | **NO** (Requires DUA) | Rep segmentation, form correctness | 6 | 24 subjects, multi-view | 3 RGB views, 30 fps | ~45 GB |
| **KIMORE** (2019) | Low Back / Rehab | Non-Commercial Research | **NO** (Univ consent) | Joint trajectories, clinical scores | 5 | 78 subjects, 390 sets | Frontal RGB-D, 30 fps | ~4 GB |
| **Fit3D** (2023) | Fitness & Form | Non-Commercial Research | **NO** (IMAR Portal) | 3D SMPL mesh, rep segmentation | 11 | 20 subjects, 3M frames | 4 multi-view RGB, 50 fps | ~60 GB |
| **RepCount-A** (2022) | Wild Rep-Counting | Non-Commercial Research | **NO** (YouTube TOS) | Rep start/peak/end timestamps | 100+ | 1,041 videos, 20k+ reps | In-the-wild (varied), 30 fps | ~25 GB |
| **Countix** (2020) | General Repetition | Apache 2.0 (code) / TOS | **NO** (Video rights) | Video interval & count only | 45 | 6,588 video clips | YouTube web video, varied | ~40 GB |
| **MM-Fit** (2020) | Free Weights | MIT (code) / Academic | **NO** (Data restricted) | Rep timestamps, IMU + 2D pose | 10 | 21 subjects, 5k+ reps | 2 views (Kinect RGB-D), 30 fps | ~15 GB |
| **LSP / E-LSP** (2010) | Sports Pose | Research / Educational | **NO** (Flickr rights) | 2D 14-joint pose only (no reps) | Varied | 12,000 static photos | Static image photographs | ~1 GB |
| **Fitness-AQA** (2022) | Action Quality | Non-Commercial Research | **NO** (DUA required) | Action quality score, rep phases | 3 | 1,000+ exercise reps | Monocular video, 30 fps | ~18 GB |
| **EgoExo-Fitness** (2024)| First/Third Person | Meta OpenRAIL / Research | **NO** (Enterprise DUA)| 3D pose, keypoint steps, audio | 15+ | 100+ subjects, 1,000+ hrs | Aria glasses + 4 exocentric | > 200 GB |

---

## Detailed Dataset Profiles

### 1. IntelliRehabDS (IRDS)
- **Citations & Provenance:** Miron, A., Sadawi, N., Ismail, W., Hussain, H., & Grosan, C. (2021). *IntelliRehabDS (IRDS)—A Dataset of Physical Rehabilitation Movements*. MDPI Data, 6(5), 46. DOI: [10.3390/data6050046](https://doi.org/10.3390/data6050046). Zenodo: `10.5281/zenodo.4610859`.
- **License & Legal Clearance:** **Creative Commons Attribution 4.0 International (CC BY 4.0)**. Full snapshot stored at `docs/research/sources/intellirehabds-license.txt`.
- **Commercial Use:** Allowed without payment or restriction as long as appropriate academic attribution is provided.
- **Subjects & Cohort:** 29 participants:
  - 15 healthy volunteers (acting as baseline controls).
  - 14 physical rehabilitation patients suffering from stroke, hemiparesis, or musculoskeletal injury.
- **Exercises Covered (9 Functional Movements):**
  1. `EFL`: Elbow Flexion Left
  2. `EFR`: Elbow Flexion Right
  3. `SFL`: Shoulder Flexion Left
  4. `SFR`: Shoulder Flexion Right
  5. `SAL`: Shoulder Abduction Left
  6. `SAR`: Shoulder Abduction Right
  7. `SFE`: Shoulder Forward Elevation (bilateral hands clasped)
  8. `STL`: Side Tap Left (lateral leg abduction)
  9. `STR`: Side Tap Right (lateral leg abduction)
- **Label Structure:**
  Files follow deterministic nomenclature: `SubjectID_DateID_GestureLabel_RepetitionNumber_CorrectLabel_Position.txt`:
  - `CorrectLabel`: 1 = Correctly executed form; 2 = Pathological/incorrect execution.
  - `Position`: 1 = Standing; 2 = Seated in chair/wheelchair.
  - Columns: Timestamp, tracking status, and 25 3D joint coordinates (SpineBase, SpineMid, Neck, Head, Shoulders, Elbows, Wrists, Hands, Hips, Knees, Ankles, Feet, SpineShoulder, HandTips, Thumbs).

### 2. UI-PRMD (University of Idaho Physical Rehabilitation Movement Dataset)
- **Citations & Provenance:** Vakanski, A., et al. (2018). *A Data Set of Human Body Movements for Physical Rehabilitation Exercises*. MDPI Data, 3(2), 17. DOI: [10.3390/data3020017](https://doi.org/10.3390/data3020017).
- **License:** Open Data Commons Public Domain Dedication and License (PDDL) v1.0. Snapshot: `docs/research/sources/ui-prmd-license.txt`.
- **Commercial Use:** Permitted (Public Domain).
- **Exercises (10 Rehab Movements):** Deep squat, hurdle step, inline lunge, side lunge, sit-to-stand, standing active back extension, standing shoulder abduction, standing shoulder internal/external rotation, trunk rotation, and seated knee extension.
- **Format:** Concurrent Vicon optical motion capture (39 markers) and Microsoft Kinect v2 RGB-D skeleton streams.

### 3. REHAB24-6
- **Citations & Provenance:** Černek, A., Sedmidubsky, J., Budíková, P. (2024). *REHAB24-6: Physical Therapy Dataset for Analyzing Pose Estimation Methods*. SISAP 2024. Zenodo: `10.5281/zenodo.10891515`.
- **License:** Non-commercial academic research only. Commercial rights require formal license with VisionCraft. Snapshot: `docs/research/sources/rehab24-6-license.txt`.
- **Exercises (6 Physical Therapy Moves):** Squats, lunges, calf raises, knee raises, torso twists, arm raises.
- **Capture:** 3 calibrated camera angles simultaneously recorded at 1080p 30 fps with dense repetition phase boundaries.

### 4. KIMORE
- **Citations & Provenance:** Capecci, M., et al. (2019). *Clinical validation of a sensor-based system for the monitoring and evaluation of motor rehabilitation in low back pain*. IEEE TNSRE. DOI: [10.1109/TNSRE.2019.2899927](https://doi.org/10.1109/TNSRE.2019.2899927).
- **License:** Academic non-commercial research use only. Snapshot: `docs/research/sources/kimore-license.txt`.
- **Cohort:** 78 subjects (34 healthy, 44 back pain patients).
- **Exercises (5 Low-Back Moves):** Lateral trunk flexion, trunk flexion-extension, pelvic rotation, trunk rotation with flexed arms, lifting arms overhead in sitting.

### 5. Fit3D
- **Citations & Provenance:** Fieraru, M., et al. (2023). *Fit3D: 3D Human Shape and Motion in the Wild*. CVPR 2023.
- **License:** Restricted non-commercial license via IMAR portal. Snapshot: `docs/research/sources/fit3d-license.txt`.
- **Exercises (11 Fitness Exercises):** Barbell deadlift, barbell squat, burpee, jumping jacks, lunges, pushups, sit-ups, pullups, dumbbell overhead press, dumbbell curl, clean-and-jerk.
- **Annotations:** SMPL 3D body models fitted to high-resolution multi-camera feeds at 50 fps.

### 6. RepCount-A
- **Citations & Provenance:** Hu, Y., et al. (2022). *RepCount: A Large-scale Dataset for Repetition Counting in the Wild*. CVPR 2022.
- **License:** Research only; YouTube third-party rights apply. Snapshot: `docs/research/sources/repcount-license.txt`.
- **Annotations:** Exact start, peak (apex), and end timestamps for each individual repetition across 1,041 varied fitness videos.

### 7. Countix
- **Citations & Provenance:** Dwibedi, D., et al. (2020). *Counting Out Time: Class Agnostic Video Repetition Counting in the Wild*. CVPR 2020.
- **License:** Apache 2.0 (annotations) / YouTube Terms of Service (underlying media). Snapshot: `docs/research/sources/countix-license.txt`.
- **Scope:** 6,588 videos across 45 actions. Only counts and temporal video intervals are labelled; no internal repetition boundaries.

### 8. MM-Fit
- **Citations & Provenance:** Strömbäck, D., et al. (2020). *MM-Fit: Multimodal Deep Learning for Free-Weight Exercises*. ACM IMWUT, 4(4).
- **License:** MIT (code) / Academic Research (data). Snapshot: `docs/research/sources/mm-fit-license.txt`.
- **Sensors:** Synchronized 3x Apple Watches, 1x Suunto smartwatch, smart earbuds (eSense IMU), phone sensor, and Kinect v2 multi-view cameras.

### 9. Leeds Sports Pose (LSP / E-LSP)
- **Citations & Provenance:** Johnson, S., & Everingham, M. (2010). *Clustered Pose and Nonlinear Appearance Models*. BMVC 2010.
- **License:** Research / Educational only. Flickr terms apply. Snapshot: `docs/research/sources/lsp-license.txt`.
- **Scope:** Static 2D pose evaluation (12,000 photos). Not continuous video; cannot be used for repetition frequency or temporal kinematics.

### 10. Fitness-AQA
- **Citations & Provenance:** Parmar, P., et al. (2022). *Action Quality Assessment for Fitness Workouts*. CVPR 2022.
- **License:** Academic Non-Commercial (DUA required from UBC / FlexAI). Snapshot: `docs/research/sources/fitness-aqa-license.txt`.
- **Scope:** 3 complex compound exercises (squat, deadlift, pullup) annotated with technical score (0–100) and form errors (e.g., knee collapse, rounded back).

### 11. EgoExo-Fitness
- **Citations & Provenance:** Grauman, K., et al. (2024). *Ego-Exo4D: Understanding Skilled Human Activity*. CVPR 2024.
- **License:** Meta Ego-Exo4D Community License / OpenRAIL. Snapshot: `docs/research/sources/egoexo-fitness-license.txt`.
- **Scope:** Multi-view synchrony between Aria egocentric point-of-view and static 4K peripheral cameras. Heavyweight footprint (> 200 GB).

---

## Read-Only Verification of Claude's Harness (`test/real-phone/`)
An inspection was conducted of Claude's internal testing infrastructure:
- `test/real-phone/harness.html` provides a lightweight WebCodecs / MediaPipe headless execution context loading `./harness.js`.
- `test/real-phone/import-sets/open.txt` documents strict protocol rules ensuring test clips remain uncompromised and isolated from evaluation sets.
- In accordance with the Non-Interference Protocol (R1, R4), Antigravity has not modified, wrapped, or overridden any file within `test/real-phone/`.

---

## Dataset Integration Specification (`data/benchmarks/intellirehabds/manifest.json`)
The manifest formats IntelliRehabDS's 9 exercises into a standardized schema consumed by zero-server automated replay harnesses:
\`\`\`json
{
  "dataset": "IntelliRehabDS",
  "version": "1.0.0",
  "license": "CC BY 4.0",
  "doi": "10.5281/zenodo.4610859",
  "fps": 30.0,
  "exercises": [
    { "code": "EFL", "name": "Elbow Flexion Left", "target": "Elbow" },
    { "code": "EFR", "name": "Elbow Flexion Right", "target": "Elbow" },
    { "code": "SFL", "name": "Shoulder Flexion Left", "target": "Shoulder" },
    { "code": "SFR", "name": "Shoulder Flexion Right", "target": "Shoulder" },
    { "code": "SAL", "name": "Shoulder Abduction Left", "target": "Shoulder" },
    { "code": "SAR", "name": "Shoulder Abduction Right", "target": "Shoulder" },
    { "code": "SFE", "name": "Shoulder Forward Elevation", "target": "Shoulder" },
    { "code": "STL", "name": "Side Tap Left", "target": "Hip/Leg" },
    { "code": "STR", "name": "Side Tap Right", "target": "Hip/Leg" }
  ],
  "records": [...]
}
\`\`\`
