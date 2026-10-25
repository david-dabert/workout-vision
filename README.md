# WorkoutVision

Film one set on your phone. The phone counts the reps, shows what it saw, and asks you to confirm.
The video is analysed on the phone; the app sends it nowhere.

**Live app (test version):** [david-dabert.github.io/workout-vision](https://david-dabert.github.io/workout-vision/)

Every number on this page comes from the scoreboard files in the repository, with their date (CLAUDE.md, R13).

## What it does

- Counts the reps of 183 exercises, and scores two fitness tests over 30 seconds (the chair stand and the arm curl, src/lib/fitness-tests.js). You choose the exercise; the app does not guess it. Six are Beta: biceps curl, lat pulldown, squat, hip thrust, Romanian deadlift and leg press (src/lib/liftTiers.js). All the others are Experimental and say so on the result. No exercise has passed the exam PLAN.md requires; the exam sets are still to be filmed (test/real-phone/exam/README.md).
- Shows the count and asks you to confirm it or give the true number. When most of the set cannot be seen, it says so and shows no count; where it can, it offers a number marked "Proposition de l'appli", to confirm, with no grade and no measure.
- The guide lists 309 exercises. The 126 the counter does not offer are marked "Non compté": for those the app at most proposes a number to check, offered as one key under an empty slot, and gives none when the joints it would need were seen on fewer than half the samples, or for a hold such as the plank, whose time it does not measure (src/lib/universalProposal.js).
- Shows, under an experimental label (none of them is validated on real phone video, src/components/experience/measures.js): each rep's range of motion in degrees, its duration, concentric and eccentric time and tempo, the angle over the whole set with each rep marked, and, for a lateral raise filmed from the front only, the range of each side (src/lib/counting/symmetry.ts).
- Replays the set with the tracked body drawn over the video, the counting joint lit, and each rep marked on a timeline.
- Builds a session report, on screen and as a PDF shared from the phone: lift, date, people, count and how it was made (counted, corrected or typed), the measures above, and the person's own pain (0 to 10) and perceived effort (RPE), printed as theirs. The same set can be saved as a JSON file that says where each value comes from.
- Keeps saved sets in a history on the phone, with the reps of the last sets and personal bests per exercise, and exports them as spreadsheet files for a coach.
- Works in French and English.

Other sections (sports, equine, coaches, chat, nutrition, workplace ergonomics) were added on 12-14 October 2026. None of them is measured by the scoreboards below; read their numbers as demonstrations unless the screen says they come from your own data.

## What the rep counter does not do

These hold for the rep counter, its result screen, its report, its PDF, its JSON file and the history. The other sections listed above are not covered here.

- It does not score form, judge safety, predict injury, estimate strength or certify a set.
- It does not measure bar speed in metres per second, joint loads or forces; its speeds are joint angles per second, and the change of speed across a set is not shown (on identical synthetic reps it could not be told from noise).
- It does not count partial reps. A detector exists in the code for research and is shown nowhere: it reports partial reps on synthetic sets built with none.
- It does not compare left and right except on a lateral raise filmed from the front.

## Accuracy

Labelled sets are counted by the same code the app runs, in CI on every push and pull request (npm run scoreboard, .github/workflows/ci.yml). Labels come from David or from human-annotated public datasets (R1).

**David's sets** (test/real-phone/accuracy/scoreboard.txt, 25 October 2026):
- stored landmark sets: 13 of the 15 that decide are exact; the 5 bench and overhead press sets are measured and decide nothing (PLAN.md);
- real videos read whole by the built app: 12 of 16 exact, 2 refused, and 0 known errors of 3 or more (the pendulum squat error of 14 for 7 resolved to 7 exact, back extension 17 to 18 exact, sissy squat 5_5011 refused to 5 exact, sissy squat 7_5006 5 to 7 exact).

**Public build half** (test/real-phone/accuracy/public-scoreboard.txt, 25 October 2026): 1064 sets, 517 exact (49 %). Per dataset: Countix cut to its labelled window 203 of 447 exact (45 %), Countix whole 189 of 447 (42 %), CFRep 8 of 12, MM-Fit 117 of 158 (74 %). 44 of the 946 counted sets are off by 3 or more. Countix's two readings of a clip are not independent; by distinct clip, both readings are exact on 172 of 447 (38 %), either reading on 220 (49 %). Since 18 October a last rep the video stops at its working end counts (David's convention): Countix, whose labels count it, gained; MM-Fit, whose labels count whole reps only, lost 10. Since 20 October that rule reads the set's depth from one earlier rep instead of two, so a clip of two or three reps cut at its last working end counts that rep: Countix gained 12, no dataset lost a set. Since 25 October overlong reps in two-cycle sets (shorter cycle at least 0.8 s) and on the first sample are split, and the head return compares against one accepted rep: Countix gained 3 exact, off by 3 or more fell by 1.

**Synthetic sets** (test/real-phone/synth/synth.txt, last written 6 October 2026): two rendered bodies read by the app's pose detection, 96 sets: 74 exact (77 %), 13 off by 3 or more. Ranges of motion read on average 29 degrees (30 %) below the skeleton's truth, and phase times about 0.6 s short. Synthetic bodies are not people: these figures bound what the pipeline can do in clean conditions.

## How it works

The video is decoded on the phone at 15 samples per second (src/lib/extractionConfig.js), and MediaPipe Pose Landmarker (full model, @mediapipe/tasks-vision 0.10.35) runs in a Web Worker on each sample.
One joint angle per lift is taken from the 3D landmarks, smoothed with a Savitzky-Golay filter over 0.333 s (about 5 samples), and counted as full cycles away from the rest position and back, with thresholds from the set's own range (src/lib/counting/core.ts).
A set is refused when the counted joint is seen on fewer than half the samples (src/lib/coreAnalysis.js).
See [ARCHITECTURE.md](ARCHITECTURE.md) for the modules and data flow.

## Privacy

Pose detection, counting, storage and the PDF run in the browser on the phone. The app never uploads the video, its frames or the landmarks. What leaves the phone leaves by a tap: a shared report, a shared or downloaded file, a report of a wrong count by e-mail or GitHub issue.
- Usage counts (src/lib/events.js) are off in the published build: VITE_EVENTS_URL is pinned empty in .github/workflows/deploy.yml.
- Contributions of sets to improve the count are paused in the published build (src/lib/buildFlags.js).
- The nutrition section's barcode lookup sends the barcode to Open Food Facts (src/lib/nutrition.js).
- Saved sets stay in the phone's browser storage.

The data-protection position of the app (GDPR and others) has not been reviewed; this README makes no compliance claim.

## Development

```bash
npm ci
npm run dev          # dev server, this computer only
npm test             # unit tests (Vitest)
npm run lint         # oxlint
npm run typecheck    # tsc --noEmit
npm run scoreboard   # count every labelled set; fails on a lost exact count or a new error of 3 or more
npm run build        # production build
```

Built with React 19, Vite 5, Vitest, Playwright and oxlint. Rules: [CLAUDE.md](CLAUDE.md); steps and current state: [PLAN.md](PLAN.md), [STATE.md](STATE.md).

## License

MIT: see [LICENSE](LICENSE). The bundled fonts and the MediaPipe pose model keep their own licences.

Public benchmark data. Only landmark files derived through the app's own pose path are kept (test/real-phone/public/); no video or frame is in the repository or redistributed. RepCount-A (Hu et al., TransRAC, CVPR 2022), read from its Hugging Face mirror lmms-lab-eval/repcounta-lance, licence "other": the videos are YouTube's and the counts and rep marks TransRAC's; used as a research benchmark only (test/real-phone/public/repcount/, scripts/public/fetch-repcount-lance.sh), it decides no gate. Countix and MM-Fit: see scripts/public/countix.mjs and test/real-phone/public/mmfit/ATTRIBUTION.txt.

EquiVision cites Dyson & Greve (2016), J Equine Vet Sci 38:1-7: subjective gait assessment of 57 sports horses in hand, on the lunge and ridden (EquiVision cites it for one point: a horse that moves evenly in a straight line can be lame on the lunge or ridden. The paper defines no asymmetry index or threshold).
