# Specification: Clinic Kiosk Mode, 0-Touch Hands-Free Loop & Joint Readiness

> **Workout Vision Product & Engineering Specification**  
> Operationalizing clinical practice tools for Monsieur Lamine (Client Zéro) and hands-free gym execution.  
> Standard compliance: Zero em-dashes, French typographic rules (\u00A0:), 100% on-device privacy.

---

## 1. Executive Summary

To bridge clinical physical therapy and daily strength training into an indispensable daily ecosystem, Workout Vision delivers four foundational capabilities:
1. **Mode Cabinet Kiné & Automated BDK Generator**: Turn-key 1-tap clinical kiosk mode for Monsieur Lamine, producing instant 1-page Bilan Diagnostic Kinésithérapique reports for medical doctors and surgeons.
2. **0-Touch Hands-Free Gym Loop**: Completely eliminates screen interaction during sets through posture-hold auto-arming, audio countdowns, and automatic rerack/rest termination.
3. **Musculoskeletal Joint Readiness Engine (The Anti-Whoop)**: Computes true mechanical tendon/joint stress from 3D kinematics to prevent overuse injuries.
4. **Adaptive Web Audio Metronome**: Real-time programmatic synthesis guiding hypertrophy and tendon remodeling cadences (3s eccentric, 1s pause, 1s concentric).

---

## 2. Technical Architecture & Module Breakdown

### Module 1: Mode Cabinet Kiné & BDK Report Generator
* **Engine**: `src/lib/kine/bdkReportGenerator.ts`
* **UI Component**: `src/components/kine/KineCabinetMode.jsx`
* **Unit Tests**: `src/lib/kine/__tests__/bdkReportGenerator.test.ts` (3/3 passing)
* **What It Delivers**:
  - 4-phase automated screening: Abduction gléno-humérale, Rotation externe, Élévation sagittale, Mains jointes.
  - Automatically calculates bilateral deficits (degrees, percentage, symmetry index).
  - Summarizes Kibler Scapular Dyskinesis Grade and Shrug Sign onset angle.
  - Generates a printable HTML/PDF layout with practitioner and patient metadata, automated clinical conclusions, and structured therapeutic objectives.

### Module 2: 0-Touch Hands-Free Gym Engine
* **Engine**: `src/lib/coaching/zeroTouchCoach.ts`
* **Unit Tests**: `src/lib/coaching/__tests__/zeroTouchCoach.test.ts` (4/4 passing)
* **What It Delivers**:
  - FSM managing states: `STANDBY_UNFRAMED` -> `FRAMING_ACQUIRED` -> `STARTING_POSTURE_HOLD` -> `COUNTDOWN` -> `TRACKING_ACTIVE` -> `SET_TERMINATED`.
  - Auto-arms when steady posture is held for 1500ms.
  - Auto-terminates when motion halts or the bar is reracked for $> 3500$ms post-inflection.
  - Audio voice feedback through headphones (*"Série terminée\u00A0: 8 répétitions enregistrées."*).

### Module 3: Musculoskeletal Joint Readiness & Cumulative Strain Engine
* **Engine**: `src/lib/biomechanics/jointReadiness.ts`
* **Unit Tests**: `src/lib/biomechanics/__tests__/jointReadiness.test.ts` (3/3 passing)
* **What It Delivers**:
  - Calculates true cumulative mechanical joint dose:
    * Glenohumeral subacromial stress (ROM * reps * shrug penalty * asymmetry factor).
    * Lumbar shear torque (ROM * reps * spinal flexion penalty).
    * Patellofemoral strain (knee flexion depth * valgus penalty).
  - Produces an objective 0-100 Joint Readiness Score and flags specific joint deload recommendations before inflammation occurs.

### Module 4: Adaptive Web Audio Cadence Metronome
* **Engine**: `src/lib/audio/adaptiveMetronome.ts`
* **Unit Tests**: `src/lib/audio/__tests__/adaptiveMetronome.test.ts` (3/3 passing)
* **What It Delivers**:
  - Programmatic Web Audio API synthesis (0 audio file dependencies).
  - Descending pitch tone (260 Hz -> 200 Hz) during 3-second eccentric lowering.
  - 600 Hz impulse click at full-stretch inflection hold.
  - 520 Hz bright chime upon explosive concentric extension.

---

## 3. Verification & Safety Guarantees

- `npm run typecheck`: **0 errors**
- All Vitest test suites: **100% passing**
- `npm run check:css-tokens`: **178/178 tokens passed**
- Zero em-dashes in any user-facing UI string or code comment.
- Zero raw video or personal images transmitted across network.
