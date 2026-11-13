# 004. The replay is shared in one tap
Status: done (awaiting David on his iPhone, R3); the app's name on the video blocked on David
Merged 12 November 2026: #388 (271111f1) and #389 (b6f0f419) on green CI.
Part 1, 12 November 2026 (Claude): PR #388 merged (271111f1). The video is prepared while the person watches; before 3 taps and 12.6 s of wait, after 2 taps and 0.01 s (`e2e/share-in-one-tap.spec.js`).
Part 2, same night, branch `card/004-part2`: one action to share, the video without text a quiet choice beside it (2 buttons before, 1 after); the play button stays usable during the automatic preparation. The "0 beside 1 / 4" of the walk of 11 November is the frame counter drawn into the synthetic test video, not the app's: not a defect (screenshots of the replay at 6 s and 14 s, 12 November).
Needs David: the app's name and address on the shared video. His decision of 29 September 2026, "the report names no app", is followed by the video's caption (`replay-labels.js`); this card proposed the opposite and is not the place to overrule him. One line from him decides it.
Executor: fast
Claim: a person who has just watched their set with the skeleton and the count sends that video to a friend without waiting.
Reference: the replay as it stands on main (`Replay.jsx`): David, 11 November 2026, "the part of the app that is the most viral".
Eval: a browser test on the production build, with a synthetic set: from the result screen, the share sheet (or the file, where the browser has no share sheet) is reached in at most two taps, and the video is ready within a time measured first as the baseline and then cut by half or more.
Baseline: 3 taps and 12.6 s of wait once the set is watched (`e2e/share-in-one-tap.spec.js` on main at cb32af66, 12 November 2026). Before that, never measured. David's screenshot of 11 November shows "Préparation de la vidéo... 70 %" as a wait.
Scope: `Replay.jsx` and its export. Also in scope, from the walk of 11 November 2026: the two share buttons ("Préparer la vidéo à partager" and "Vidéo brute sans texte") become one action with a choice inside it, and the large count drawn on the video and the badge above it ("0" beside "1 / 4") show the same number. The shared video carries the app's name and address in a corner, so each share brings the next person. No account, no server.
Stop: if the export cannot be made faster on a phone, prepare it in the background while the person watches, and record the times.
Needs from David: whether the shared video may carry the app's name and address (his decision of 29 September 2026 says the report names no app).
