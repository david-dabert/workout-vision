# Saved-landmark diagnoses

Current core replay equals the saved count result exactly for each case. No video was opened and no parameter or label was changed.

## w00-squats-4040-4500

Count 9; side right; low 88.681°; high 142.899°. Missing raw angles: 0/229.

**Label-boundary / counting-convention mismatch.** The saved trace contains 9 completed threshold cycles and a final working excursion beginning at 14.133 s that reaches the working threshold but does not return through the resting threshold before the segment ends. The final angle is 130.209° at 15.200 s, below the high return threshold 142.899°. The unchanged counter requires that return. This explains the one-count gap without a lost complete threshold cycle. The dataset label apparently includes this terminal excursion; the annotator's intent cannot be proved from landmarks alone.

## w01-dumbbell_rows-37940-38553

Count 9; side right; low 91.161°; high 137.630°. Missing raw angles: 0/306.

**Label-boundary / counting-convention mismatch.** The saved trace contains 9 completed threshold cycles and a final working excursion beginning at 19.133 s that reaches the working threshold but does not return through the resting threshold before the segment ends. The final angle is 123.311° at 20.333 s, below the high return threshold 137.630°. The unchanged counter requires that return. This explains the one-count gap without a lost complete threshold cycle. The dataset label apparently includes this terminal excursion; the annotator's intent cannot be proved from landmarks alone.

## w00-tricep_extensions-46229-46625

Count 7; side right; low 126.857°; high 146.874°. Missing raw angles: 83/198.

**Counter / landmark-signal miss, not evidence of a label convention difference.** Internal excursions fail the unchanged threshold rules: one extension does not reach the high threshold, and two intervening returns stay above the low threshold, joining adjacent excursions. The visibility rule excludes this set from supplementary build use. Landmarks alone cannot separate shallow physical motion from pose-estimation error.

| Miss | Time (s) | Angle (°) | Required threshold (°) |
|---|---:|---:|---:|
| 1: extension peak too low | 3.867 | 146.322 | 146.874 |
| 2: return trough too high | 5.667 | 127.952 | 126.857 |
| 3: return trough too high | 9.333 | 128.576 | 126.857 |
