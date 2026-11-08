# Blind counts (CLAUDE.md R1; Phase 6 of David's order of 6 November 2026)

A blind count is the number a person gives in the app before it shows its own (`src/lib/blind.js`, `BlindAsk.jsx`).
Since David's rulings it is a label: his own since 15 October 2026, and since 25 October 2026 that of a person he names, given on a phone carrying the `#collecte` flag.

- David's blind sets stay in the `test/real-phone/sets-*/` folder of the day he collected them.
- Testers' blind sets live here, one folder per tester: `test/real-phone/blind/<tester>/`, a name David gives (lowercase letters, digits, `-`, `_`).
  The repository is public: give a pseudonym (`t01`, `t02`), not the person's name.
  Until 8 November 2026 this folder was `test/real-phone/testers/`; it held no set.

## From the phone to the scoreboard

1. The tester opens the app at `…/workout-vision/#collecte` (the flag stays on that phone; `#collecte-off` removes it).
2. On a set read from a video, the app asks « Combien en avez-vous fait ? » while it reads, and shows its own count only after the answer, or after « Je ne sais pas ».
3. When the count is kept on the result screen, the phone keeps one file (`src/lib/phoneCollect.js`): the landmarks, never the video.
4. The file leaves the phone only when the tester taps « Envoyer les séries collectées (n) » in the history and sends it, through the share sheet.
5. David hands the files over and names the tester; an agent imports them (below).

## The file (`<lift>_<kept>_<view>_<hash8>.json.gz`, gzip JSON)

Read by one reader, `parse.mjs`, for the scoreboards, the lock, the exam and the import alike; the TypeScript tests read it through `schema.ts`, which gives it its types.
A record built apart from this file (the `createBlindRecord` of PR #334) was written by no phone and is gone: the phone writes the Phase 6 fields in this file.

| Field | Meaning | Rule |
|---|---|---|
| `blind.count` | the blind count: **the label** | whole number 1 to 99 (the person's field), or `null` for « Je ne sais pas » (no label) |
| `blind.p` | the share of sets the phone asks | in (0, 1], or absent |
| `lift` | the exercise key | required |
| `count` | the count kept after seeing the app's | whole number, 0 or more |
| `appCount` | the app's own count then | whole number, or `null` |
| `appRefused`, `proposal` | the app refused the set, and the count it proposed | optional; `proposal` a whole number, 1 or more |
| `videoSha256` | SHA-256 of the video's bytes, or of the landmarks when the video could not be read (`hashOf`) | 64 hex digits, required |
| `hashOf` | what `videoSha256` hashes | `video` or `landmarks`; read as `null` when absent |
| `recordedAt` | the day the count was kept, on the phone's calendar (`YYYY-MM-DD`): no hour, since the files are kept in a public repository | written since 8 November 2026 |
| `sessionId` | an anonymous id drawn on the phone for that page load (a random UUID): it groups the sets of one visit, says nothing of who, and leaves the phone only inside the files the share sheet sends | written since 8 November 2026 |
| `worldLandmarks`, `timestamps`, `imageLandmarks` | what the app measured, one entry per sample | same length |
| `labelKind` | `after-app`: a file kept on the result screen | required |

The file's name must match its exercise, kept count and hash.
A « Je ne sais pas » file carries no label and is held to the same schema: it is imported, locked and kept like the others.
A file kept before 8 November 2026 has no `recordedAt` or `sessionId`; it is read all the same.

## Import

```bash
node scripts/import-sets.mjs <folder> --tester <name>                  # plan only: names, duplicates, schema
node scripts/import-sets.mjs <folder> --tester <name> --write          # copy into test/real-phone/blind/<name>/
npm run exam:testers -- --record                                       # the one-shot exam: each set read once, unseen
LABELS_LOCK_UPDATE=1 npx vitest run test/real-phone/accuracy/labels-lock.test.ts   # lock the new sets
SCOREBOARD_UPDATE=1 npm run scoreboard                                  # record their counts in the baseline
npm run scoreboard:blind                                                # the blind table and its gate
```

The import refuses, and copies nothing, when a video is already in the repository, one video comes twice, or a file breaks the schema.

## The blind scoreboard (`npm run scoreboard:blind`, `test/real-phone/accuracy/scoreboard-blind.test.ts`, `compare.mjs`)

Every blind set, David's and the testers', against the app's outcome now (the live core on the stored landmarks, as `npm run scoreboard` reads it: `test/real-phone/accuracy/outcome.mjs`).
It reports, per section and per tester: exact, off by 3 or more, refused and the refusal rate.
It writes `test/real-phone/accuracy/scoreboard-blind.txt` when a count or a row changes.
The blind counts have one baseline, in `scoreboard-baseline.json`; `test/real-phone/accuracy/blind-baseline.json` is no longer read.

CI runs it against the base branch's baseline (`blindCounts`, `testerBlindCounts` in `test/real-phone/accuracy/scoreboard-baseline.json`) and fails when, for any one set:

- its error grows, or it gave a count and is now refused;
- it becomes off by 3 or more (from closer, or from refused);
- it is in the baseline and no longer on disk;
- its file breaks the schema.

A set new since the baseline is shown, and gated from the next change on.
Bench and overhead press sets are measured and decide nothing (PLAN.md).

## The lock

Every blind file is a line of `test/real-phone/labels.lock`: its SHA-256, its blind count (or `unsure` for « Je ne sais pas »), its path.
CI fails when a line of the base branch's lock is changed or removed, unless `test/real-phone/label-rulings.json` records David's ruling for that very line (`scripts/check-labels-lock.mjs`): the line word for word, the line it becomes (`now`, or `null` when he rules that the set goes), the date, his words and where he gave them.
The change must then hold exactly the line the ruling names.

Limit: every agent commits and posts under David's account, so no check in the repository can tell his ruling from an entry an agent wrote.
The check makes the change visible in CI and in the diff; only David rules on a label.
