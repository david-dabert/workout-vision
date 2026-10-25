# Backlog Triage Against R16 (25 October 2026)

Source: `HANDOFF.md` Task T8 (commit `9e621539`), `BACKLOG.md`, and `CLAUDE.md` R7 / R16.

> **R16 (The standard, David, 18 October 2026):**
> - *"Accuracy is defined so it can be proven: the app is right whenever it says it is sure, says plainly when it is not, and is sure more often each month."*
> - *"Every measure is held against a named reference of the best in the world (rep counts: published results and commercial counters; joint angles: optical motion capture; physiotherapy: the physiotherapist's own judgment); a measure without a reference stays labelled experimental (R8, R9)."*
> - *"The core is proven before the product widens: a new area waits until the counting and the comparison it depends on pass their gates (R2, R7)."*

---

## 1. Summary Table of the Seven Named Long-Standing Items in `HANDOFF.md` (T8)

| Backlog item (date) | Current state in repo (`9e621539`) | Depends on counting / core passing its exam (R16)? | Other gate before opening (R3, R7, R8, R9, D16) | Recommendation for David |
|---|---|---|---|---|
| **1. Physiotherapy section & Olivier's reference exercises** (5 Oct, 15 Oct) | `#kine`, `#kine-p=`, `#kine-r=` built (`PR #203`); Olivier's 4 videos on R2 (`PR #219`); attempt upload disabled (`PR #247`). Tolerances in `src/lib/reference/compare.js` are experimental/UNSOURCED; refs 2 & 3 need re-filming. | **Yes (R16).** Adding rehab exercises to the counting catalogue requires counting exam sets; widening `#kine` requires `compare.js` tolerances to pass an agreement gate against **Olivier's own judgment** (R16's named reference for physiotherapy). | **EU MDR gate (6 Oct / D16):** No clinical or rehabilitation-monitoring claim until a regulatory adviser confirms intended purpose & class. | **Hold widening.** Keep `#kine` strictly as wellness/programme-following (`"angle atteint"`) and collect Olivier's blind judgments on attempts for refs 1 & 4 before building new screens. |
| **2. Physiotherapy & the EU MDR reasoning** (6 Oct) | Documented in `BACKLOG.md` (6 Oct) and `docs/SPEC-production.md` (WP2.1, D16, D19); `public/manifest.json` declares `"fitness"` only. | **No (legal/regulatory gate, not a software build).** Seeking a regulatory opinion does not depend on the counting exam, **but blocks** any medical/rehabilitation positioning of the app. | External regulatory adviser confirmation of Regulation (EU) 2017/745 Art. 2(1) and Annex VIII Rule 11 (MDCG 2019-11). | **Independent legal step.** Can be consulted whenever David chooses; until answered, D16 keeps all patient/rehab positioning closed. |
| **3. Coach mode (Luc) & Program builder (Zine)** (29 Sep, 6 Oct) | First version of `#pro` (`Pro.jsx`) and `#programme=` (`Programme.jsx`, `programme-pdf.js`) is in tree (6 Oct), unconfirmed on David's iPhone. Combined multi-video client report (29 Sep) is not built. | **Yes (R16).** A coach's combined report or programme loop ("the coach sees what was done, not what was ticked") is only as trustworthy as the rep count and the right-when-sure gate (`sure.ts`). Widening coach workflows before the counting core passes its unseen exam violates R16. | David's iPhone check of `#pro` (R3) and showing the existing one-line report to Luc and coaches first (`BACKLOG.md` l.53). | **Hold until counting passes its exam** and David tests `#pro` on his iPhone and gathers Luc's feedback on the single-set report. |
| **4. Counting partial reps** (9 Oct) | Not built. `core.ts` (`detectReps`, `MIN_ROM_DEGREES`) intentionally drops excursions that do not cross both thresholds and span the per-rep floor. | **Yes (R16).** Directly depends on full-rep counting and landmark stability (`pose-pipeline-9oct.md`). Lowering excursion floors before full reps pass their exam confuses tracking wobble with partial reps. | Blind labels of sets containing partial reps counted by David (R1). | **Hold until full-rep counting passes its exam** and blind-labelled partial-rep sets exist. |
| **5. The phone's own chips beyond browser GPU (`PoseBench`, WebGPU)** (9 Oct) | Documented in `docs/IPHONE-CHIPS.md`. Not yet run on David's Mac + iPhone. | **No — this serves the core exam itself.** On real video (`sets-07oct-video`), the core is 8/16 exact because browser pose landmarks jitter/drop (`pose-pipeline-9oct.md`). Testing Apple Vision 2D/3D or native MediaPipe on the 16 videos measures whether better pose input raises the core's exact rate under the R2 gate. | Needs David's Mac (Xcode) and iPhone to run `PoseBench` on the 16 videos. | **Can be opened as a core measurement step** whenever David wants to benchmark native iOS pose against `corePoseWorker.js`. |
| **6. Golf, baseball & tennis on rendered bodies (and EquiVision / sports lab)** (14 Oct) | Sports and Equine screens ship as labelled `"Aperçu de l'objectif"` demos (R8 amendment, `#181`). Golf demo clip prepared from `File:Golfputt.ogv`. | **Yes (R16).** Textbook case of *"The core is proven before the product widens"*. Moving sports from labelled previews to measured biomechanics waits until gym counting passes its exam, then requires Level 2 rendered-body truth labs (`test/real-phone/synth/`) and optical motion capture reference (R16). | Volleyball Level 1 iPhone check (R3); per-sport labelled datasets and error tables (R8, R9). | **Hold until gym counting passes its exam.** Keep sports/equine screens as honest `"Aperçu"` previews until then. |
| **7. The coach's office (URSSAF accounting, barcode/photo nutrition, client CRM)** (14 Oct) | Moved from `docs/VISION.md` Phase 3 to `BACKLOG.md` on 14 Oct. None built. | **Yes (R16).** R16 states: *"first a reliable proof of concept, then a business... The core is proven before the product widens: a new area waits until the counting and the comparison it depends on pass their gates (R2, R7)."* Accounting and nutrition are unrelated product verticals. | Sourced URSSAF rates, CIQUAL error ranges, and David opening the phase (R7, R8, R9). | **Hold until after the counting proof of concept passes its exam.** |

---

## 2. Other Dated Items in `BACKLOG.md` (Complete Inventory)

### A. Wait for Counting / Angle Calibration Exam (R16 — Product Widening or Uncalibrated Measures)
- **Reference movement animated figure beside the user's replay (6 Oct)** & **MuscleMimic muscle estimates (8 Oct)** & **Martin's motor-capacity assessment battery (15 Oct)**:
  - Each compares the user's measured joint angle range or tempo against a standard. On `test/real-phone/synth/synth.txt`, pose range is underestimated by 30% (`-29 deg`) and concentric/eccentric phase times by 45–54%. Under R16 (*"joint angles: optical motion capture"*), range and phase-time measures must be calibrated before any comparison band or 6-week assessment battery is shown.
- **HYROX distance/time stations and burpee broad jumps (3 Oct)**:
  - Out of scope for joint-angle counting; would require a new timer/station feature (widening).
- **Live counting additions: auto-stop on stillness, `live_start` worker schema, VIDEO mode in live, live clip recording (3 Oct)**:
  - Wait until video counting passes its exam and thresholds are measured on real-phone sets (R2, R9).

### B. Serve the Core Exam Directly (Can Be Used While Proving the Core)
- **Collecting sets from the result screen (`#collecte`, 6 Oct)**:
  - Built (`src/lib/phoneCollect.js`, `src/lib/blind.js`) and extended on 25 Oct with `--tester <name>` and `npm run exam:testers` (Task T1). Ready for David and external testers to generate unseen exam sets.
- **Four withdrawn floor exercises (dead bug, banded dead bug, bird dog, glute bridge march — 3 Oct)**:
  - Remain in `WITHDRAWN` (`src/lib/offer.js`) until David films front/profile/three-quarter exam sets showing a view that counts them without refusal or 3+ error.
- **Re-reading public build sets with today's pose path (10 Oct)** & **Dense4D offline landmark check (18 Oct, when code releases)**:
  - Core pose-input stability measurements; do not widen the product.

### C. Housekeeping & Existing-Screen Polish (Do Not Widen the Product, Wait for David Under R7)
- **Removing dormant code (`node scripts/unreachable.mjs`, 2 Oct)**: 92 unreachable legacy files (`en.json`/`fr.json`/CSS bloat, 14 legacy tests). Safe cleanup whenever David chooses to delete them (R5/R7).
- **One-page A5 PDF for 5-rep report & joint names in CSV headings (2 Oct)**: Small improvements on the existing report.
- **Astra's 1 Oct UX review proposals & 11 Oct Dieter Rams design notes**: Editorial/UI proposals on existing screens; wait for David to open individual items.
- **Smaller downloaded replay videos (6 Oct, Azélie)**: Judged not needed for now by David on 6 Oct.
