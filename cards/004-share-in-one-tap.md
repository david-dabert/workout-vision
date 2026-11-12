# 004. The replay is shared in one tap
Status: in progress (taps and wait done)
Part 1, 12 November 2026 (Claude), branch `card/004-share-in-one-tap`: the video is prepared from the moment the replay opens, while the person watches; a tap on the picture stops it and gives back the controls. Eval `e2e/share-in-one-tap.spec.js` (production build, a 12 s drawn set watched once, then the ask): before 3 taps and 12.6 s of wait, after 2 taps and 0.01 s. Left: one share action with the choice of the clean video inside it; the large count on the video and the badge above it to show the same number; the app's name and address in a corner of the shared video; the same on David's iPhone, whose Safari may refuse to play the video outside a tap.
Executor: fast
Claim: a person who has just watched their set with the skeleton and the count sends that video to a friend without waiting.
Reference: the replay as it stands on main (`Replay.jsx`): David, 11 November 2026, "the part of the app that is the most viral".
Eval: a browser test on the production build, with a synthetic set: from the result screen, the share sheet (or the file, where the browser has no share sheet) is reached in at most two taps, and the video is ready within a time measured first as the baseline and then cut by half or more.
Baseline: 3 taps and 12.6 s of wait once the set is watched (`e2e/share-in-one-tap.spec.js` on main at cb32af66, 12 November 2026). Before that, never measured. David's screenshot of 11 November shows "Préparation de la vidéo... 70 %" as a wait.
Scope: `Replay.jsx` and its export. Also in scope, from the walk of 11 November 2026: the two share buttons ("Préparer la vidéo à partager" and "Vidéo brute sans texte") become one action with a choice inside it, and the large count drawn on the video and the badge above it ("0" beside "1 / 4") show the same number. The shared video carries the app's name and address in a corner, so each share brings the next person. No account, no server.
Stop: if the export cannot be made faster on a phone, prepare it in the background while the person watches, and record the times.
Needs from David: nothing.
