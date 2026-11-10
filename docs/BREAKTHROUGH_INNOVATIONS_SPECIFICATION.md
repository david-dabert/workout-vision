# Specification: Breakthrough Biomechanical & Clinical Innovations

> **Workout Vision Product & Engineering Blueprint**  
> Moving beyond generic repetition counters into high-margin, clinically defensible, viral biomechanical intelligence.  
> Standard compliance: Zero em-dashes, French typographic rules (\u00A0:), 100% on-device privacy.

---

## 1. The Strategy: The Uncontested Market Niche

Most fitness applications (Whoop, Apple Fitness, Fitbod, generic form trackers) suffer from three fatal flaws:
1. **Skeletal Blindness**: They treat every user as possessing identical limbs, forcing tall and short lifters into the same artificial norms.
2. **Clinical Disconnection**: They provide no actionable data to physiotherapists, orthopedists, or strength coaches.
3. **Passive Metric Logging**: They log metrics post-workout without intervening in real time when an acute injury or tear is imminent.

Workout Vision solves this by operationalizing its on-device 3D computer vision engine into four high-impact breakthrough modules:

---

## 2. The 4 Breakthrough Modules

### Module 1: The Morphological Fingerprint Engine
* **Path**: `src/lib/biomechanics/morphologyFingerprint.ts`
* **Unit Tests**: `src/lib/biomechanics/__tests__/morphologyFingerprint.test.ts` (3/3 passing)
* **What It Does**:
  - Automatically calculates 3D limb ratios: Femur-to-Tibia ($r_{FT}$), Torso-to-Leg ($r_{TL}$), Bi-acromial shoulder width, and carrying angles from a 5-second standing calibration.
  - Generates personalized lifting prescriptions:
    * **Long Femur / Short Torso**: Recommends wider stance ($1.25\times$ shoulders), $30^\circ$ toe flare, natural forward trunk inclination ($42^\circ - 55^\circ$), heel wedge elevation, and Sumo / Trap Bar deadlifts to eliminate lumbar shear.
    * **Short Femur / Long Torso**: Recommends compact vertical squat stance with minimal forward trunk displacement.
    * **Wide Acromial Shoulders**: Recommends $1.5\times$ biacromial bench grip and $55^\circ$ elbow tuck to eliminate subacromial impingement.
* **Why Users Pay**: Delivers the value of an expensive private biomechanics screening in 5 seconds on their phone.

### Module 2: Kiné-Connect Asynchronous Prescription Suite
* **Path**: `src/lib/kine/kinePrescription.ts`
* **Unit Tests**: `src/lib/kine/__tests__/kinePrescription.test.ts` (3/3 passing)
* **What It Does**:
  - Co-designed for practitioners (Client Zéro: Monsieur Lamine, University Kinésithérapeute, Paris).
  - Enables practitioners to prescribe targeted home telerehabilitation batteries using simple access codes (e.g., `LAMINE-402`).
  - Solves the **80% patient non-compliance problem** by providing real-time audio guidance and contralateral mirror avatars.
  - Generates executive clinical summaries summarizing weekly compliance, ROM gain ($\Delta\text{ROM}$), bilateral symmetry %, and compensation incidents (scapular shrug signs).
  - **Zero Video Frame Upload**: Only aggregated mathematical telemetry is stored, preserving 100% CNIL / GDPR privacy.
* **Why Kinés Pay**: Practitioners can bill for remote tele-monitoring, save hours of manual patient documentation, and acquire objective clinical proof of treatment success (€49 to €149 / month B2B subscription).

### Module 3: The Intelligent Safety Spotter
* **Path**: `src/lib/coaching/intelligentSpotter.ts`
* **Unit Tests**: `src/lib/coaching/__tests__/intelligentSpotter.test.ts` (4/4 passing)
* **What It Does**:
  - Real-time neuromuscular fatigue & injury prevention engine.
  - Monitors repetition velocity loss ($V_{current} / V_{baseline}$) and bilateral asymmetry drift frame-by-frame.
  - Intervenes dynamically through headphones:
    * **Warning (Velocity Loss > 25%)**: *"Velocity down 28%. One more controlled repetition maximum."*
    * **Critical Abort (Velocity Loss > 45% or Shrug Sign / Asymmetry > 10°)**: *"Stop recommended: velocity down 40% with motor compensation. Do not attempt the next rep."*
* **Why Lifters Pay**: Protects athletes from catastrophic muscle tears (pectoralis, rotator cuff, disc herniation) while allowing them to train safely to true effective hypertrophy ($14.99 / month consumer tier).

### Module 4: Biomechanical X-Ray Progression Exporter
* **Path**: `src/lib/biomechanics/biomechanicalXRay.ts`
* **Unit Tests**: `src/lib/biomechanics/__tests__/biomechanicalXRay.test.ts` (1/1 passing)
* **What It Does**:
  - Compiles before/after kinematic transformation overlays (Day 1 vs Day 30).
  - Highlights objective gains: e.g. `Mobilité +26° | Symétrie +23% | 7 Compensations Éliminées`.
  - Generates ready-to-share social formats for TikTok, Instagram Reels, and LinkedIn.
* **Why It Drives Growth**: Creates self-sustaining viral loops driven by real clinical and athletic results without ad spend.

---

## 3. Verification & Test Evidence

- `npm run typecheck`: **0 errors**
- `npx vitest run src/lib/biomechanics/`: **36/36 tests passed**
- `npx vitest run src/lib/kine/`: **81/81 tests passed**
- `npx vitest run src/lib/coaching/`: **4/4 tests passed**
- `npm run check:css-tokens`: **178/178 tokens passed**
