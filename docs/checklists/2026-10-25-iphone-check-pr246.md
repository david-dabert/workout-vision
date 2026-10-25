# One-Page iPhone Checklist — PR #246 (`22da6efd`)

**Goal**: Verify on David's iPhone (Safari / installed PWA on `https://david-dabert.github.io/workout-vision/`) that a set flagged by `bodyCheck` (`agreement < 0.5`) withholds its analysis before confirmation and **shows its full per-rep analysis with the caution banner immediately after David confirms or corrects the count** ([PR #246](https://github.com/david-dabert/workout-vision/pull/246), commit `22da6efd`, merged as `19db97d6`).

Only David's real-phone check removes the `"Not verified"` line on PR #246 (R3, R7).

---

## 1. Pick or Film One Flagged Set on the iPhone

Choose **any one** of these existing videos from the iPhone Photos library (`Choisir une vidéo`), all of which trigger `bodyCheck.flagged = true`:

| Exercise to select in the app | Video in iPhone Photos (date & reps) | Core count | `bodyCheck` agreement | Expected prompt |
|---|---|---:|---:|---|
| **Squat pendulaire** (`pendulum_squat`) | 7 Oct — 7 reps (`pendulum_squat_7`) | 14 | `0.08` (flagged) | Asks to confirm `14` (you can correct to `7` with `-`) |
| **Squat barre** (`barbell_squat`) | 7 Oct — 9 reps (`barbell_squat_9_a` or `9_b`) | 9 | `0.19` / `0.20` (flagged) | Asks to confirm `9` |
| **Traction nuque** (`behind_neck_chin_up`) | 7 Oct — 5 reps (`behind_neck_chin_up_5`) | 6 | `0.20` (flagged) | Asks to confirm `6` (or correct to `5` with `-`) |
| **Extension lombaire assise machine** | 5 Oct (8 reps) or 6 Oct (13 reps) | 8 / 12 | `-0.12` / `0.40` (flagged) | Asks to confirm `8` / `12` |

*(To test both **Confirm as-is** and **Correct with `-`/`+`**, run once on `barbell_squat_9_a` tapping **Confirmer 9 répétitions**, and once on `pendulum_squat_7` adjusting `14` $\rightarrow$ `7` before tapping **Enregistrer 7 répétitions**.)*

---

## 2. Six-Point Verification on the iPhone

### [ ] Step 1 — Result Card BEFORE Confirming
- **Status badge**: shows `« À confirmer »` (or `« À vous de compter »` once adjusted with `-` / `+`).
- **Headline**: `« L’appli n’a pas pu compter cette série avec certitude. »`
- **Reason**: `« Sur cette série, l’angle <du genou / du coude / de l’épaule / de la hanche> ne bouge pas comme le reste de votre corps. L’appli a pu mal le lire. »`
- **Count box**: shows the app's count with `« Vérifiez ce nombre avant d’enregistrer. »` and `-` / `+` buttons (`Une de moins`, `Une de plus`).
- **No premature analysis**: **no** grade badge, **no** per-rep bars, **no** angle wave, and **no** tempo/amplitude table appear before you tap `Confirmer N répétitions` / `Enregistrer N répétitions`.

### [ ] Step 2 — Result Card AFTER Confirming (or Correcting)
- **Saved banner**: `« Merci. Série enregistrée sur votre téléphone. »` (or `« Compté par l’appli : X. Corrigé : Y. »` if corrected).
- **Caution banner (`res-doubted`)**: immediately visible above the measures:
  > `« À prendre avec précaution : sur cette série, l’angle <du genou / du coude / de l’épaule / de la hanche> ne bouge pas comme le reste de votre corps. »`
- **Re-measure note (when corrected to `Y`)**: shows either `« Mesures relues pour vos Y répétitions. »` (when a sensitivity recount matches `Y`) or `« Mesures lues sur les X repères de l’appli (votre compte : Y). »`.
- **Full per-rep analysis shown**:
  - Per-rep amplitude/duration bars (`.bars`),
  - Joint angle wave (`.res-wave`),
  - Narrative summary (`set-account`) and expandable per-rep table (`Détail par répétition`).

### [ ] Step 3 — Video Replay (`Revoir la vidéo`)
- Tap any rep bar or `Revoir la vidéo`:
  - The video seeks to the rep boundaries, and the replay card displays the caution line (`replay-doubted`):
    > `« À prendre avec précaution : sur cette série, l’angle <...> ne bouge pas comme le reste de votre corps. »`

### [ ] Step 4 — Session Report & PDF (`Rapport de séance`)
- Tap `Rapport de séance` at the bottom of the result screen:
  - The set entry displays its angle wave (`.sh-wave`), amplitude & tempo summary, and the caution note in `.sh-details`:
    > `« À prendre avec précaution : l’angle <...> ne bougeait pas comme le reste du corps »`
- Tap `Enregistrer en PDF / Imprimer`:
  - iOS print preview renders the sheet with the wave and caution line intact.

### [ ] Step 5 — JSON Measures Download (`Télécharger les mesures (JSON)`)
- On the result card (inside `Détail par répétition`), tap `Télécharger les mesures (JSON)`:
  - Downloads `mesures-<exercice>-<date>.json` where each rep object and `sides` carry the `caution` string.

### [ ] Step 6 — CSV Export (`Exporter mes séries (CSV)`)
- Export sets to CSV from History / Report:
  - Column `Mesures à prendre avec précaution` is `oui` on this row.
