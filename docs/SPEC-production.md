# WorkoutVision: production-readiness spec

Written 3 October 2026 against branch `claude/generate-architecture-md-inw479` at `99bcce2` (PR #66, open) and production `origin/main` at `7facf4b`. **Revision 2, 3 October 2026**: revised against four critiques (release and iOS platform; product; engineering and testability; privacy and regulation). Every critique item is either applied below or listed, with its reason, in Appendix C. The previous text is kept beside this file as `SPEC-production.v1.md`. Old work-package numbers are mapped to new ones in Appendix B.
Sources: five read-only audits (reliability, counting trust, UX, engineering, business), four critiques, and the files cited below, read at those commits.
This spec changes nothing in the repository. PLAN.md on counter-core prevails over it, but that PLAN.md is out of date (fact 13), so decision D0 comes before any phase. Where the spec proposes something PLAN.md or CLAUDE.md forbids or reserves to David, it says so and lists it under section 4.

How to check a claim: every statement about the current state names a file, a symbol, a command or a commit. Line numbers drift, so symbols are given where they exist. "Measured" means the command was run for this spec; "per audit" or "per critique" means a review reported it and this spec did not re-run it; "not verified" marks iOS behaviour recalled by a reviewer and still to be checked on the phone.

---

## 0. Current state in fifteen checkable facts

1. **Production is 49 commits behind the branch.** `git rev-list --count origin/main..HEAD` = 49 (measured). Among them: `acada78` (frozen-read guard, draw before pause on the playback path), `f661184` (a count of 0 is asked for, not shown), `dcbf07c` (decoder WASM routed to the versioned WASM cache), `2841a8a` (live frozen-read rule), `0b87a99`, `8ff7313`, `dacba14`, `f530795`, `eb7ef60`, `16e8d67` (counting changes), `57557b8` (live counting), `ae34a10`/`6d17f6f` (usage counts), `4f38aba` (contribution ask after the first saved set). The PR also changes `.github/workflows/ci.yml`, `deploy.yml` and `playwright.config.js` (`git diff --stat origin/main HEAD -- .github playwright.config.js`, per critique).
2. **Production counts with an older core than the README describes, and two quoted figures are not printed by any scoreboard.** `git show origin/main:test/real-phone/accuracy/scoreboard.txt` reads "of the 14 sets in the baseline, 7 exact"; `git show origin/main:test/real-phone/accuracy/public-scoreboard.txt` reads "894 build sets, 286 exact (32%)". The branch's first lines read "of the 9 sets in the baseline that decide, 8 exact" and "894 build sets, 355 exact (40%)" (measured). "9 of 14" (8 deciding sets plus the overhead press) and "71.8 % within one" were derived by hand (awk over `public-scoreboard.txt`); no scoreboard prints them, so under R13 they are **not quotable** until a scoreboard prints them (WP4.7). All branch figures describe the branch, not what users run today.
3. **Production may serve a stale web-demuxer WASM across deploys.** On `origin/main`, `public/sw.js` routes `/mediapipe/` to the hashed `WASM_CACHE`; `/web-demuxer.wasm` (3,150,317 B, unversioned URL) falls to the final stale-while-revalidate branch, which `cache.put`s it into `CACHE_NAME` (`wv-v<hash>`) and serves it from there. Production does keep it offline after the first fetch; the defect is that an older `wv-v*` cache can hand the old WASM to newer JavaScript. The branch routes it to `WASM_CACHE` (`url.pathname.endsWith('/web-demuxer.wasm')`, measured). web-demuxer fetches the WASM from inside a `blob:` worker, falling back to a `data:` worker (`node_modules/web-demuxer/dist/web-demuxer.js`, `createObjectURL`, `"data:text/javascript;base64,"`, measured); whether iOS routes that fetch through the service worker is not verified.
4. **Production shows a frozen or empty read as a measured "0".** `origin/main:src/components/experience/Result.jsx` has no `unsure` path; the branch's `Result.jsx` sets `const unsure = !result.refused && result.count === 0` and opens on the correction step (measured), headed "Nous n'avons pas pu compter cette série." also for a genuine zero-movement set (copy decision D25). Production `liftTiers.js` still has `lateral_raise: 'beta'`; the branch has `'experimental'` (`tiers.txt`: `lateral_raise_9` counts 8).
5. **The frozen-read guards only catch reads frozen on more than half their samples, and use exact equality.** `src/lib/frozenRead.js`: `FROZEN_SHARE = 0.5`, `FROZEN_MIN_SAMPLES = 30`; `canvasFingerprint` is FNV-1a over `getImageData` and a repeat needs `print === last`. The skeleton backstop (`coreAnalysis.js`, `FrozenSkeletonsError`, `sameSkeleton`) and the live final count (`liveCounter.js`, `2841a8a`) also use exact equality. `frozenRead.js` documents that the three CI journey videos repeat 8, 11 and 20 % of their decoded pictures in still holds.
6. **The 3 October demo's root cause is not established, and the evidence that would name it exists.** Production also tries WebCodecs first (`origin/main` `extractFramesStreaming`); the same clip decoded through WebCodecs gave 460 distinct samples (per critique). So at the demo WebCodecs failed or was bypassed before the playback (RVFC) path ran. `extractFramesStreaming` returns `method: \`${before}rvfc\``, where `before` reads "webcodecs failed after N samples (msg), then " (`frameExtractor.js`), and the report mail already carries it (`Result.jsx` `reportFor({ … decoder: result.metadata?.method, read })`, measured).
7. **No device gate covers the incident.** `src/lib/check-baseline.json` holds five clips (curl, hip thrust, leg press, RDL, bench); no lateral raise. `check-main.js` renders one row per baseline clip and keys results by lift (`done[mode].delete(clip.lift)`), so it has no row for an arbitrary video and cannot hold two clips of one lift.
8. **CI is solid for counting, blind for iPhone.** `.github/workflows/ci.yml` runs lint, typecheck, unit tests, `npm run scoreboard`, `npm run scoreboard:public` and the 96 synthetic sets, then e2e, the WebKit tour and the Chromium journey (`test/real-phone/synth/smoke.mjs`, `STRICT=1`, axe WCAG 2.1 AA). No job decodes HEVC/.mov, uses Low Power Mode, a real camera, wake lock, storage eviction or iOS memory limits.
9. **No release safety net.** `git tag | wc -l` = 0 (measured). main has no branch protection (per audit). The `deploy` job declares `environment: github-pages` (measured), which `actions/deploy-pages` needs; it rebuilds rather than shipping the tested artifact and has `permissions: contents: read`. PR #66's author is `david-dabert` (per critique: agent PRs are opened under David's account, so he cannot be their required reviewer). The Vercel preview "does not rebuild on push" (PLAN.md step 4), and the build hash is visible only on `Profile.jsx`, `reportLinks.js` and `check.html`.
10. **Usage analytics are one repository variable away, and whether it is set is unknown.** The branch's `deploy.yml` builds with `VITE_EVENTS_URL: ${{ vars.VITE_EVENTS_URL }}`; production's has no such line and no `events.js`. `startEvents` calls `track('open')` on load and `events.js` reads `wv_lang` from localStorage. The Actions variables API returned 403 to agent sessions (per critique). Entry says "Rien ne quitte votre téléphone sans votre accord." (`Entry.jsx` `COPY.fr[2]`).
11. **Contributions already flow in production with no privacy notice.** `git show origin/main:src/lib/contribute.js` exists (measured). The file carries image and world landmarks per frame and `deviceInfo` (user agent, platform, cores, memory, screen) and leaves through the share sheet, normally by mail to `REPORT_EMAIL = 'pr.dabertdavid@gmail.com'` (`reportLinks.js`, measured), so it arrives with the sender's address. `contribute-copy.js` `what` nevertheless says "Jamais la vidéo, ni votre nom." No "mentions légales", "politique de confidentialité" or "privacy policy" string exists in `src/`, `public/` or the HTML pages (measured with grep).
12. **An open write endpoint and identifiable third-party data sit in the public repository.** `feedback-worker/worker.js` `/ingest` is unauthenticated (`Access-Control-Allow-Origin: *`), stores free text and `ip_hash` with the constant salt `':wv-salt-2026'` in a public repository, with no retention (per critique); `wrangler.toml` has `database_id = ""` (measured), so whether it is deployed is unknown. The in-app sender `FeedbackPanel.jsx` is unreachable (`scripts/unreachable.mjs`). `test/real-phone/public` holds 898 files of per-frame pose of YouTube uploaders named by video ID (per critique); `scripts/public/countix.mjs` notes the Countix archive "states no licence". `src/lib/storage.js` still declares `medical`, `food` and `personalRecords` IndexedDB stores.
13. **The PLAN.md that prevails is out of date.** counter-core (`952fc87`) is 122 commits behind main; David's standing order of 2 October, the 1 October copy approval and the learned-counter gate exist only in the branch's PLAN.md (`git diff origin/counter-core HEAD -- PLAN.md`, per critique). PLAN.md RULES say "Nothing about the user leaves the phone"; PLAN.md LIFT TIERS requires the GitHub report link.
14. **The gym loop is broken at its first step.** `CoreUpload.jsx` and `LiveSession.jsx` pass `onNewSet={onClose}`, and `App.jsx` maps `onClose` to `backToChoice` (measured): "Nouvelle série" returns to the exercise list after every set.
15. **Counting has plateaued on current data, and most offered lifts are unmeasured.** TRIED.md, "Accuracy push, second round" (3 October): seven experiments, none shipped; the next gains need David's cut-rep convention (D15), better pose input or more labelled sets. Of 181 exercises offered, 175 are Experimental and counted by movement pattern only (`offer.js` header); each of the six Beta lifts has 1 or 2 of David's sets, one person, one phone (`tiers.txt`).

---

## 1. Product definition

### 1.1 Who

| Segment | Need | What it requires of the app |
|---|---|---|
| Gym-goer, beginner to expert (launch segment; about 7 million gym members in France, founder's figure, UNSOURCED here) | Log a set without counting aloud; keep a history; see "last time" | Same-exercise repeat loop, confirm faster than typing (PROD-1), history that survives, load optional |
| Coach (in person or online) | A set's reps and tempo to review with a client | Report and PDF that state how trustworthy the count is |

**Not in the launch segment:** kinésithérapeutes and patients. Demoing to kinés as a patient adherence tool is evidence of a medical intended purpose (MDR Rule 11), and personal health data in a care follow-up triggers HDS hosting in France (CSP art. L.1111-8). Until D16 and D19 are answered and a regulatory opinion exists, the intended purpose is "fitness logging for healthy adults; not for patients' care or monitoring" (WP2.1), patients are excluded from contributions and any data-sending feature, and no sales material targets health professionals.

Primary platform: iPhone, Safari and home-screen web app. Secondary: Android Chrome, desktop. Languages: French first, English.

### 1.2 The job

"I just did a set. Count it for me, let me fix the number in one tap if it is wrong, keep it, and get me to my next set." The loop is film, count, confirm, next set; Phase 1 ships it before any other user-visible work.

### 1.3 What the app promises

- It counts the reps of one set of an exercise the person chooses, from a video filmed or picked on the phone, analysed on the phone (`coreAnalysis.js`, `corePoseWorker.js`). The video never leaves the phone.
- Every count is the person's to confirm or correct (`Result.jsx`, ask card), and both numbers are kept (`src/components/experience/sets.js`: `reps`, `machineResult`, `corrected`; schema version in `src/lib/storage.js`, `SCHEMA_VERSION = 1`).
- When it cannot count, it says so with one reason and one fix (`refusal.js`), shows no number (`PartialReadError`, `FrozenReadError`, the `unsure` path), and lets the person type the number (WP1.6).
- It says how far each exercise is trusted: Beta or Experimental (`liftTiers.js`, `offer.js`), with the number of sets and people behind each Beta lift, published and dated (R13).
- Saved sets stay on the phone; the person can export and back them up (`ExportSets.jsx`, `KeepSets.jsx`, `src/lib/keep-sets.js`).

### 1.4 What it does not promise (and must not say)

- No form score, form correction, injury prevention or prediction, clinical reading, diagnosis, rehabilitation outcome or patient monitoring (PLAN.md RULES; DIRECTIVES.md Part 1).
- No measured range of motion, speed or tempo as validated: these show under "Mesures expérimentales" (`measures.js`).
- No accuracy figure other than one printed by the latest scoreboard, with its date and the commit it describes (R13); "mesuré" only with the number of sets and people behind it.
- No automatic exercise detection (the person chooses).
- Live counting is not offered in production until WP6.1-6.3 pass on David's iPhone (hidden by a build flag from WP0.3).
- No use filming other gym members: the person films themself; the notice and Film advice say so (REL-9).

### 1.5 Outcomes (PROD)

No outcome below can be measured by anonymous aggregate analytics alone: return visits need an identifier, which this spec does not add. They are measured in the gym-goer trial (WP1.9) and, for PROD-1 and PROD-2, re-measured on David's iPhone per release.

| ID | Outcome | Measured by | Target |
|---|---|---|---|
| PROD-1 | Median seconds from the end of a set (stop recording or pick the video) to a logged set, on iPhone, on the WebCodecs path and on the playback path; compared with typing the number by hand in the same app (`ManualLog.jsx`) | Trial (screen recording, timed from the video) and David's per-release check | Below the hand-typed median on WebCodecs. If not met after Phase 1, D26 (reposition, for example around replay and tempo) is opened. |
| PROD-2 | Share of counts kept without correction, per tier | Trial; usage events `result_kept`/`result_corrected` only if D6 | Report-only until the first trial gives a baseline |
| PROD-3 | Taps from opening the app to a logged set, first set and repeat set | Tour script on the WebKit iPhone profile (counts taps in the journey) | Repeat set ≤ 4 taps after Phase 1 |
| PROD-4 | Sets per visit, and whether a trial participant comes back within 7 and 30 days | Trial log only | Report-only |

---

## 2. Quality bar: acceptance criteria

Each criterion names how it is measured and who measures it: **CI** (a job in `ci.yml` or `deploy.yml`), **Script** (a committed script run by hand), or **iPhone** (David, recorded per WP1.2, with phone model and iOS version). "Today" is the measured or audited state. Where a CI test cannot reach the real condition, its limit is stated.

### 2.1 Reliability

| ID | Criterion | Measured by | Today |
|---|---|---|---|
| REL-1 | On the playback path, the extractor records per sample whether its picture repeats the previous one while the video clock advanced. After counting, `analyzeCoreVideo` refuses with `FrozenReadError` when, inside the span from the start of the first counted rep to the end of the last, at least `N_RUNS` runs of at least `RUN_LEN` repeated samples occur, or the existing share rule holds. A zero-rep read has no span and goes to the existing `unsure` question. `N_RUNS` and `RUN_LEN` are experimental and UNSOURCED (R9), fixed only after measuring the run distribution on the must-not-refuse set (below). The same rule, with the same constants, applies to the skeleton backstop (`FrozenSkeletonsError`) and the live final count (`liveCounter.js`), with landmark equality within an epsilon if WP3.2's self-test shows noisy readback. | CI: unit tests on synthetic streams (frozen runs inside the rep span refused; the same runs in rest outside it accepted; a stream whose metadata advances while pixels do not is flagged). Must not refuse: the three CI journey videos (`smoke.mjs` stays green), the 96 synthetic renders, David's 14 sets decoded on the phone on both paths, a screen recording, a WhatsApp re-encode and a variable-frame-rate low-light clip. iPhone: the incident clip and the check-page frozen injection (WP0.2) | Only reads > 50 % frozen are refused, exact pixel equality (fact 5) |
| REL-2 | A read shorter than `floor(duration × 15)` on WebCodecs tries the playback path, guarded by REL-1, before refusing | CI: `pipeline-errors.test.js` case with a stubbed short decode | Refused directly (`PartialReadError`) (per audit) |
| REL-3 | Every analysis records `{decoder, fallbackReason, rotationDecision, readShare, repeatShare}` as structured fields in the result metadata, the report e-mail and (after WP2.4's consent bump) the contribution | CI: unit test on the `analyzeCoreVideo` result shape; e2e reads `wv:core-result` | `decoder` (the `metadata.method` string, which already embeds the fallback reason) and the read share (`read: {read, expected}`) are already in the report mail (`Result.jsx` `reportFor`); missing as fields: `fallbackReason`, `repeatShare`, `rotationDecision` |
| REL-4 | An analysis lost to the OS killing the app while visible (memory pressure), a reload or a service-worker update is detected on next load and named, using the existing `AnalysisInterrupted` screen and copy | CI: e2e that writes the breadcrumb and reloads | A page hidden during analysis is already handled (`watchInterruption`, `AnalysisInterrupted`, `e2e/interrupted.spec.js`); an OS kill while visible reloads to Choice with no notice (ARCHITECTURE.md §9) |
| REL-5 | A count shown but not yet confirmed survives a reload or a service-worker update, in a draft store that no reader of saved sets sees | CI: e2e reloads on the result screen and finds the draft; one unit test per reader of saved sets proves drafts are excluded | Lost (`doSave` only on tap) |
| REL-6 | The decoder WASM load, the model download and the model compile each have a named failure. The download timeout is a stall timeout (no bytes for 20 s), not a total one. Expected outcomes: unthrottled → completes; 2 Mbit/s (24 MB ≈ 96 s) → completes with download progress shown; stalled or offline → error naming "téléchargement" | CI: Playwright with throttling at a local proxy (DevTools emulation does not apply to service-worker fetches), test timeout 240 s, asserting each outcome. iPhone: first run on 4G from a cold cache (Safari website data cleared). Limit: neither reproduces a gym Wi-Fi captive portal or iOS dropping the connection in the background; those are recorded as iPhone observations | No timeout on `demuxer.load`; a 30 s total timeout on the 9.4 MB download (`poseAnalysis.js` `withTimeout`) |
| REL-7 | The reduced decode matrix (WP3.5) passes on David's iPhone (model and iOS version recorded) and, before "market-ready", on two borrowed older iPhones (for example an A12 and an A14 model): every row shows its labelled count, or its expected refusal | iPhone, `check.html` | 5 clips, normal and forced playback, one device (`test/real-phone/decoder/11-david-check-normal.txt`) |
| REL-8 | WebAssembly unavailable (Lockdown Mode) is detected in the page and in `corePoseWorker.js` before analysis and named, with no "reload" advice | CI: e2e with `WebAssembly` deleted in an init script (limit: reaches `window` only) plus a worker-level unit test that runs the pose worker's start-up with `WebAssembly` undefined. iPhone: Lockdown Mode on, required before "market-ready" | "Rechargez la page" loop (per audit) |
| REL-9 | When the tracked person changes during a set (torso scale or centroid jumps between consecutive samples while landmarks are confident), the set is refused with a named reason. Constants experimental, UNSOURCED, measured on the matrix passer-by clip; the rule refuses no set in the three counting gates | CI: unit test on a spliced landmark stream; the three gates show no newly refused set. iPhone: the passer-by clip | Not handled; pose runs with `numPoses: 1` (`poseAnalysis.js`) |

### 2.2 Counting honesty

| ID | Criterion | Measured by | Today |
|---|---|---|---|
| HON-1 | The three counting gates never regress: `npm run scoreboard` (no exact set lost, none newly off by 3+, none newly refused), `npm run scoreboard:public` (same), synthetic (`synth.txt` unchanged; an improvement must be committed in the same PR, because `ci.yml` runs `git diff --exit-code test/real-phone/synth/synth.txt`) | CI quality job (exists) | Green at 99bcce2 per audit |
| HON-2 | Production never shows "0" as a measured count | CI: `e2e/uncounted.spec.js` (exists on branch); iPhone: incident clip | Fails on production; passes on branch in CI |
| HON-3 | Result, history row, report, PDF and CSV show the lift tier and how the count was settled (confirmed, corrected, typed by hand, unconfirmed); the live screen shows the tier only (nothing is settled before the set ends) | CI: unit tests on `report-sheet.js`, `sets-csv.js`; e2e asserts the tier text on each screen | Settlement is partly done: the report carries `sheet.corrected` and every PDF page the experimental label (`report-pdf.js`). Gap: the lift tier on report, PDF, history, CSV and live; "typed by hand" outside the CSV; "unconfirmed" (needs REL-5) |
| HON-4 | README figures are generated from the machine-readable scoreboard summaries at the commit the README is in, and say which commit and date they describe; any figure quoted outside the repository (site, claims sheet, deck) comes from the summaries at `origin/main`, the deployed commit | CI: a test fails when README's figures differ from `scoreboard.json` / `public-scoreboard.json` at HEAD or omit the commit line | README states branch numbers; production runs 7/14 and 286/894 (fact 2) |
| HON-5 | A Beta tier meets the written bar decided by David (D3), applied only once WP0.6's sets exist, checked by `tiers.test.ts` | CI | Bar = "every one of David's sets exact", 1 or 2 sets per lift |
| HON-6 | Field accuracy is observable: corrections carry a signed error bucket per lift and tier (only if D6 approves analytics) | CI: `usage-schema` test; worker test | Kept/corrected only (`usage-schema.js`) |
| HON-7 | Live count and final count differ on at most 10 % of the 96 synthetic sets, and on none by 2 or more (proposed threshold, binding once D12 adopts it; report-only until then) | Script on synthetic sets; iPhone on 10 live sets | Not measured |

### 2.3 Performance

| ID | Criterion | Measured by | Today |
|---|---|---|---|
| PERF-1 | No lazy chunk > 250 KB gzip without a recorded reason; entry JS and CSS sizes reported per build, not gated | CI size report | `report-pdf` chunk 538 KB raw (per audit); entry 37.9 KB gz |
| PERF-2 | First-count payload (model + vision WASM + demuxer WASM) ≤ 24 MB, and nothing copied to `dist/` that the app cannot load | CI size gate | 9.40 + 11.15 + 3.15 MB (`ls -l public/`); `vision_wasm_module_internal.*` copied but unused (per audit); `dist` 65 MB (measured) |
| PERF-3 | On WebCodecs, time to result ≤ clip duration (PLAN.md Step 1, David's decision of 29 September) | iPhone, `?perf=1` and `check.html` | Met on 5 clips (decoder/11) |
| PERF-4 | On the playback path, the app shows an estimated remaining time after 20 samples; no length limit exists without being stated before the analysis | CI: unit test of the estimator; iPhone: 60 s and 3 min clips in Low Power Mode, estimate within ±30 % | No estimate, `MAX_FRAMES = Infinity` (`extractionConfig.js`) |
| PERF-5 | Cold first analysis on 4G: tap to first sample ≤ 45 s on David's iPhone (proposed, experimental); recorded per release with model and iOS | iPhone, `?perf=1` | Not measured |
| PERF-6 | Live: ms per sample (Safari and home-screen app; normal, Low Power, after 3 min preview, after 10 min of use) leaves the queue below `MAX_BACKLOG` for a 2-minute set | iPhone | Not measured; `MAX_BACKLOG = 2 * TARGET_FPS` (`liveEngine.js`) |

PROD-1 (section 1.5) is the time-per-set bar on both paths.

### 2.4 Accessibility

| ID | Criterion | Measured by | Today |
|---|---|---|---|
| A11Y-1 | Zero axe WCAG 2.1 A/AA violations on every journey screen | CI journey (`smoke.mjs`, `STRICT=1`, exists) | Enforced |
| A11Y-2 | Tap targets ≥ 44 pt; pressed state within 100 ms | CI tactility specs (exist) | Enforced (PLAN.md 3b) |
| A11Y-3 | Text set in rem; Result, Film and Choice usable at 200 % text with no clipped control. iOS Larger Text does not reach web text unless the CSS uses `font: -apple-system-body` (none in `src`, per critique); whether to adopt it is D27 | CI: Playwright with the root `font-size: 200%`. iPhone: Safari page zoom 200 % (aA menu); if D27 adopts `-apple-system-body`, also Larger Text in the home-screen app (which has no page zoom) | Labels at 10.5 px fixed (`Entry.css`, per audit) |
| A11Y-4 | Reduce Motion: no count-up animation, the question shown at once | CI tour at Reduce Motion + new assertion | Count animates before the question (BACKLOG.md, 1 Oct) |
| A11Y-5 | VoiceOver reads the count, the tier and the question in that order on the result | iPhone: VoiceOver on, swipe right from the top of the result, write the first three announcements in the WP1.2 record | Not checked |

### 2.5 Privacy

The legal bases named here are the reviewers' proposals; the lawyer review (WP2.1) confirms or replaces them.

| ID | Criterion | Measured by | Today |
|---|---|---|---|
| PRIV-1 | No request leaves the origin during use except the usage endpoint when configured; CSP `connect-src 'self' blob:` plus that endpoint only; every HTML page in production `dist/` carries the CSP meta, or `collect.html` and `collect-batch.html` are not in production `dist/` | CI: `e2e/offline.spec.js`, `events.spec.js` (exist); a test over `dist/*.html` | Holds for `index.html` and `check.html`; `collect.html`, `collect-batch.html` have no CSP (grep count 0, measured) |
| PRIV-2 | A French and English legal notice and privacy notice exist in the app, linked from Entry and Choice, with for each processing (usage counts, host logs, report mails, contributions) a heading for purpose, legal basis, retention, recipients and transfers; approved by David (R10) and reviewed by a lawyer before analytics or contributions run in production | CI: e2e opens both from both screens and asserts each heading in both languages | Absent (fact 11) |
| PRIV-3 | The notice lists every `USAGE_EVENTS` field (generated from `usage-schema.js`) and names the events host; the deploy job fails when `VITE_EVENTS_URL` is set and the built notice does not name its host; Entry's line is true for the build | CI: deploy-job step; unit test comparing notice and schema | `deploy.yml` passes the variable unchecked (fact 10) |
| PRIV-4 | No usage event, including the first `open`, is sent when GPC, DNT or the opt-out (`wv_count_off`) is set; events carry the UI language from React state, not read from `wv_lang` | CI: `events.spec.js` and unit tests | `track('open')` on load; `wv_lang` read from localStorage (`events.js`) |
| PRIV-5 | Retention is written and enforced for the data that identifies people: report mails and contributions (deleted on request; all deleted at most 24 months after receipt), the `feedback` table (dropped, D24). Daily aggregate rows with no identifier need no purge | Script: the controller's register shows a dry-run deletion; CI: worker test that `/ingest` is gone | No retention anywhere (per critique) |
| PRIV-6 | A contribution file carries one file-level block `consent: {date (day only), textVersion, lang, age15plus}` and a random `fileId` shown to the user on "Envoyer"; no per-set timestamp | CI: unit test on `contributionsFile()`; `contribute.test.js` pin updated with the `what` copy | No consent record (`contribute.js`) |
| PRIV-7 | No IP hash with a public salt is stored, and no unauthenticated write endpoint exists | CI: worker test | `/ingest` with constant salt (fact 12) |
| PRIV-8 | Every origin that serves the app or a preview (GitHub Pages, Vercel, the preview host, Cloudflare) is named in the notice with its role and its data-processing terms | CI: notice test lists the hosts in a committed `hosts.json` | Not covered |
| PRIV-9 | Any change to the fields of `contribution()`, `reportLines` or `USAGE_EVENTS` fails CI unless the consent `textVersion` is bumped and the notice and `what` copy are updated in the same PR (David approves the copy, R10) | CI: snapshot test of the three field lists keyed to `textVersion` | Only `contribute.test.js` pins `what` against contribution fields |
| PRIV-10 | Contribution copy says the file arrives with the sender's e-mail address; `deviceInfo` is reduced to device class and OS major | CI: unit test on `deviceInfo` output | Full UA, screen, cores, memory; copy says "ni votre nom" (fact 11) |
| PRIV-11 | `/stats` and `/dashboard` suppress cells with fewer than 5 events; diagnostic fields (WP4.6) are aggregated weekly | CI: worker test | Not applicable until D6 |
| PRIV-12 | The notice says the app is not intended for under-15s; a stored contribution consent with no or an older `textVersion` is treated as "ask again" and waiting contributions cannot be sent until re-confirmed | CI: e2e on a seeded old consent | `wv_contribute = 'yes'` kept from older copy |

---

## 3. Work packages, by phase

Rules for every phase:
- One branch per WP (R4); CI green including the three counting gates unchanged (HON-1); David's iPhone check (R3, R6); then main.
- No WP changes `src/lib/counting/` unless it says "counting change"; those follow PLAN.md's full method (synthetic test that fails first, reviewer, verifier, R2 per-clip diff).
- French copy waits for David (R10). Under David's standing order of 2 October (recorded only in the branch's PLAN.md, fact 13, so D0 first), copy of "the same kind" as the six changes he approved may ship when measured and reported; privacy, legal or clinical copy needs his explicit approval.
- Sizes: S ≤ 1 day, M 2-4 days, L 1-2 weeks of one agent. David's time is the scarcer resource; it is estimated per phase below and batched into **one weekly session** (iPhone checks of all WPs waiting, copy approvals, decisions). A WP waiting for that session does not block the next WP's agent work.
- Any feature that sends data stays off in production until Phase 2 is done: analytics pinned empty (WP0.3), contributions paused (WP0.4).

| Phase | David's hours (estimate) | Main items |
|---|---|---|
| 0 | 6-8 h, plus 1 h per 10 sets filmed and labelled (WP0.6) | Diagnosis, incident clip and label, checklist, D0-D1, D24 |
| 1 | 4 h, plus 4-6 h running the trial | Loop checks, ruleset approval, trial recruiting and debrief |
| 2 | 6 h, plus the lawyer's time | Notice copy, DPIA answers, consent copy, decisions D6, D8-D10, D19-D21 |
| 3 | 6 h | Matrix filming (about 8 short sets), check-page runs |
| 4 | 3 h | D3, D18, result copy |
| 5 | 3 h | Per-WP checks, copy |
| 6 | 4 h | Live measurements |
| 7 | 1 h | Preview host account, rollback rehearsal |

### Phase 0. Stop the demo failure and the unconsented data flows

Prerequisite for any further professional demo. Order: WP0.1 and WP0.2 first, then WP0.3 and WP0.4 in the same release; WP0.5 applies at once; WP0.6 runs in parallel and continues.

**WP0.1 Name the demo's root cause** (no code)
- Goal: know why the 3 October read froze before choosing guards.
- Steps: (0) get the `method` string of the demo analysis: from the report mail if one was sent, else run the incident clip on production with Safari Web Inspector attached and read `result.metadata.method`. (1) Run `VideoDecoder.isConfigSupported` on that clip's decoder config in the console (the iPhone camera's default HDR is Dolby Vision HEVC; an unsupported codec string is one candidate). (2) Record codec, frame rate, duration and dimensions as the app reads them, phone model, iOS version, Low Power state, normal (not Private) browsing. (3) Record any `play()` rejection name (`NotAllowedError` is suspected under Low Power Mode, not verified). (4) Run the clip on the playback path of the branch with the frozen injection off and on (needs WP0.2).
- Acceptance: a dated note in `test/real-phone/decoder/` names one cause among: WebCodecs config unsupported, demuxer WASM failed to load, decode error, other, with the pasted evidence; or "not reproduced" with each attempt listed. Low Power Mode is a hypothesis until this note.
- Dependencies: the incident video from David. Size: S (David 1-2 h).

**WP0.2 Put the incident on the check page**
- Goal: the device gate covers the failure that happened, and the guard is seen firing on the phone.
- Scope: built on PR #66's head and merged into it before WP0.3's iPhone check. `check-main.js` keys rows by clip id (not lift); a lateral-raise row; per row, the repeat share and the fallback reason; a check-page-only test hook (`check.html?inject=frozen`) that feeds a synthetic frozen stream on the playback path. Ground truth: the clip's landmarks from a healthy collector read (never the frozen read) in `test/real-phone/sets-03oct/`, with David's label (R1). `check-baseline.test.ts` loads from any `sets-*` directory instead of the hard-coded `sets-29sep`.
- Effect on gates, committed in the same PR: `npm run scoreboard` gains a set; baselines regenerated with `SCOREBOARD_UPDATE=1`; `tiers.txt` and README's "of N sets" regenerated; the R2 per-clip diff in the report. If the core misses the new set by 3 or more, stop and report to David (R12): the set is new evidence, not a regression, and he decides.
- CI acceptance: `check-baseline.test.ts` passes with the new row (`d.count === label`, `floor(duration*15) === samples`); unit test that the page renders repeat share and that two rows of one lift do not overwrite each other.
- iPhone: the new row on both paths, Low Power on and off; the frozen injection row shows a refusal. Dependencies: David provides video, collector read and label. Size: S.

**WP0.3 Ship PR #66 to production, with data flows and live pinned off**
- Goal: production refuses frozen reads, asks instead of showing 0, keeps the decoder WASM versioned, labels the lateral raise Experimental, and sends nothing new.
- Scope: PR #66 as a whole (the hotfix route is dropped: Appendix C, critique 3.1), plus three small commits on it: `deploy.yml` pins `VITE_EVENTS_URL: ''` until D6 and WP2.3; a build flag hides the Live entry in production (`Film.jsx` `liveOffered` also requires `import.meta.env.VITE_LIVE === '1'`, unset in `deploy.yml`) until Phase 6; WP0.4's pause. Reviewed scope includes the workflow changes (`ci.yml`, `deploy.yml`, `playwright.config.js`): the first push to main runs the new gate and deploy logic.
- CI acceptance: existing quality, e2e, tour and journey jobs green; `frozen-read.test.js`, `pipeline-errors.test.js`, `sw-wasm.test.js`, `e2e/uncounted.spec.js`, `tiers.test.ts` pass; scoreboard and scoreboard:public at or above the base branch's baseline; the deploy job prints the length of `VITE_EVENTS_URL` (0) and a step fails if `dist/` contains an events URL; e2e asserts no Live entry when `VITE_LIVE` is unset.
- iPhone checklist (David; record model, iOS version, power mode, normal browsing):
  1. The incident video, normal path: the count equals David's label, or the set is refused, or the question is asked. Record the count shown and the decoder string. A count off by 1 or more fails the item.
  2. The incident row and the frozen-injection row on `check.html`, playback path forced, Low Power Mode on: the injection is refused as frozen; the incident row counts its label or is refused.
  3. The five `check.html` clips, both paths: every row as before.
  4. After one analysis: airplane mode, force-quit the home-screen app, relaunch, analyse a clip on the WebCodecs path. Pass: it completes (the WASM fetch from web-demuxer's `blob:` worker is served offline). If it fails, WP3.7 fixes the WASM delivery before anything else in Phase 3.
  5. The Film screen shows no Live entry; contributions show no ask card and no "Envoyer".
- The stale-WASM defect (fact 3) is covered by `sw-wasm.test.js` in CI; on the phone it is tested the next time web-demuxer's WASM changes (WP3.7).
- Dependencies: WP0.2 (items 2), WP0.4, D1. Risk: production gets 49 commits at once, including counting changes; the gates and the checklist are the control. Size: S.

**WP0.4 Pause contributions and close the open write channel**
- Goal: no personal data reaches David without a notice and a recorded consent.
- Scope: hide `ContributeAsk.jsx` and the "Envoyer" action in production (same flag mechanism as Live; landmarks already waiting stay on the phone); `feedback-worker/worker.js` `/ingest` removed; establish whether the worker is deployed (Cloudflare dashboard, David) and whether the `feedback` table holds rows; with David's approval (R5, D24), export then drop the table; list the contribution files and report mails already received (count, dates) for D20.
- CI acceptance: e2e (production flags) finds no ask card and no send action; worker test that `/ingest` returns 404.
- iPhone: item 5 of WP0.3. Dependencies: D20, D24. Size: S.

**WP0.5 Demo rule until Phase 0 ships** (no code; owner David)
- Before a demo, open `check.html` on the demo build and compare its hash with the commit intended (99bcce2 or later); if they differ, demo from production only after WP0.3.
- Demo only clips that are exact on the build being demoed (`check.html` rows marked exact), Beta lifts only. Today on production's core, curl (4 of 5) and leg press (12 of 13) are not exact and bench is Experimental, so none of the five check clips except hip thrust and RDL qualify on production (per critique; re-check on the demo build).
- No patient or kiné positioning in demos (section 1.1).

**WP0.6 More labelled sets** (data; runs in parallel, continues through Phase 3)
- Goal: the evidence needed to apply D3 and to lift the plateau (fact 15).
- Target: for 10 lifts chosen by David as the most common in his gyms (frequency UNSOURCED), including bench press and overhead press, 5 sets × 2 people, filmed with default iPhone camera settings; plus one machine or cable variant for each lift family that has one (the incident was a machine lateral raise). Labels by David only, from watching each video (R1). Landmarks through the batch collector. Blind exam sets as PLAN.md defines them.
- Second person: written consent to filming and to the use of their landmarks; their landmarks are committed to the public repository only if that consent covers publication (otherwise blocked by D21); no other gym member in frame (D14).
- Acceptance: `npm run scoreboard` lists the new sets; `tiers.txt` shows sets and people per lift; R2 per-clip diff on the PR that adds them.
- Dependencies: D3 is not applied before this target is met. Size: L of David's time (about 100 sets; 1 h per 10).

### Phase 1. Minimum gym loop, on a protected main

User-visible. Each item is a small PR with its own iPhone check; WP1.1 and WP1.2 land first. Until the separate-origin preview (WP7.1) exists, David checks each PR on the Vercel preview after confirming its hash on `check.html` equals the PR head; if it does not, the session asks for a rebuild.

**WP1.1 Protect main (light)**
- Scope: repository ruleset on `main`: PR required; the four `ci.yml` checks required; branch must be up to date before merging; no force push, no deletion; no bypass actors. No required review (David authors the agent PRs and GitHub forbids self-approval); his gate is WP1.2's environment approval. counter-core per D0.
- CI acceptance: `gh api repos/david-dabert/workout-vision/rulesets` returns the ruleset; a direct push to main with the session token is rejected (pasted once in evidence).
- Dependencies: D0, D2. Size: S.

**WP1.2 iPhone check as a recorded approval**
- Scope: `test/real-phone/IPHONE_CHECK.md` (checklist template: phone model, iOS version, Safari or home-screen, power mode, the tree hash `git rev-parse HEAD^{tree}` checked, items and outcomes); David added as required reviewer on the existing `github-pages` environment ("prevent self-review" off), so every deploy waits for his approval; the deploy job prints main's tree hash, which must equal a recorded one (a squash or rebase merge of an up-to-date branch keeps the tree). No PR-body lint and no second environment.
- CI acceptance: the environment rule is visible in `gh api …/environments/github-pages`; a deploy run shows the approval wait.
- Dependencies: WP1.1. Size: S.

**WP1.3 Repeat loop**
- Scope: `CoreUpload.jsx` and `LiveSession.jsx` pass `onNewSet` = return to Film of the same lift (`backToFilm`) instead of `onClose`; "Changer d'exercice" separate; Film intro skipped on return.
- CI acceptance: e2e: after save, "Nouvelle série" lands on `#film` with the same lift. iPhone: three sets of one lift in a row. Size: S.

**WP1.4 Never lose a set at close**
- Scope: `Result.jsx` Topbar `onClose` and hash-router back on an unsaved result ask "Garder cette série ?" (keep / discard). The draft store comes later (WP3.4).
- CI acceptance: e2e: X before confirm asks; keep saves, discard does not. iPhone: edge-swipe back on a result. Size: S.

**WP1.5 Recents**
- Scope: `Choice.jsx`: "Récents" (last 3 lifts, one tap to Film); "Dernière série : X" becomes a button.
- CI acceptance: e2e: recents after two sets; tour layout checks. iPhone: pick a recent lift in one tap. Size: S.

**WP1.6 Refused set logged by hand**
- Scope: `Result.jsx` refused screen adds "Saisir mon nombre" opening the existing `fix` step; saved with `source: 'manual'`, `machineResult: null`, `corrected: true`; `countedBy` (`sets.js`) returns null when `source === 'manual'`; `History.jsx`, `Report.jsx` and `sets-csv.js` show "saisi à la main" and no app count.
- CI acceptance: unit test on `countedBy` for a manual record; e2e on a refused synthetic set saves the typed count and history shows it as typed by hand; contributions keep `labelKind: 'after-app'` and are excluded from any gate (R1).
- iPhone: refuse a set (camera too close), enter 8, see it as typed in history. Size: S.

**WP1.7 Keep sets on iPhone** (extends `src/lib/keep-sets.js` and `KeepSets.jsx`)
- Scope: on iOS Safari (not standalone), the home-screen card shows after the first analysis and before the first save, so nothing is stranded; if sets already exist in Safari, the card offers a one-tap backup and a restore in the home-screen app (Safari and the home-screen app are believed to keep separate storage, not verified). Backup reminder every N sets. `navigator.storage.persisted()` recorded in both contexts.
- CI acceptance: e2e (WebKit iPhone profile) shows the card once, never in standalone mode; backup then restore round-trips the sets.
- iPhone: (1) save a set in Safari, add to home screen from the card, open the app: record whether history is there, then restore from the backup and confirm it is; (2) record `persisted()` in Safari and in the app; (3) no visit for 8 days in Safari, then confirm history is still there (Safari's 7-day deletion; `keep-sets.js` header marks its protection UNSOURCED). Size: S-M.

**WP1.8 Measure the loop** (PROD-1, PROD-3)
- Scope: a tap-count assertion in the WebKit tour for first and repeat set; a timing protocol in `IPHONE_CHECK.md`: David screen-records five sets on each path and five hand-typed sets; times read from the recording.
- Acceptance: the numbers are in the WP1.2 record. Size: S.

**WP1.9 Gym-goer trial** (gate before Phase 3 priorities are fixed)
- Scope: two weeks, 5 to 10 iPhone gym-goers outside David's circle, beginners and regulars, on production after WP1.3-WP1.7. Written consent to the trial (what is observed, that the app sends nothing). Observed by debrief and their own screen recordings shared voluntarily, not by analytics. Recorded: drop-off point, corrections per set (PROD-2), time per set (PROD-1), sets per visit and return within 7 and 30 days (PROD-4), lifts chosen (input to D18).
- Acceptance: a dated trial note; Phases 3-5 re-ordered by David in light of it (BACKLOG.md 2 October: "Pivots worth testing with one real user each before any code").
- Dependencies: WP1.3-WP1.7. Size: M of David's time.

Also in Phase 1 (no code): add to BACKLOG.md, dated, under R7: a minimal "today's session" grouping in History and "last time: N × load" shown on Film for the same lift, to be scheduled at the Phase 1 boundary in light of WP1.9.

### Phase 2. Legal and privacy floor

Blocker for any wider audience, for analytics (D6) and for re-enabling contributions.

**WP2.1 DPIA, register, intended purpose, lawyer review**
- Scope: a DPIA (Art. 35: movement data possibly Art. 9, on-device pose AI), an Art. 30 register (the under-250 exemption does not cover special-category data), and an intended-purpose statement signed by David ("fitness logging for healthy adults; not for patients' care or monitoring"), all in the repository (`docs/legal/`); the age rationale ("15+" self-declared is a reasonable effort, not proof); the Cloudflare and GitHub data-processing terms and the US transfer mechanism (EU-US Data Privacy Framework) recorded; a lawyer reviews DPIA, register and the notice before analytics or contributions run in production.
- Acceptance: the three documents exist and are dated; the lawyer's review is recorded (date, scope). Dependencies: D8, D19. Size: M (mostly David and the lawyer).

**WP2.2 Legal notice and privacy notice**
- Scope: new `src/components/experience/Legal.jsx` (static, lazy), route `#legal` in `useHashRouter.js`, links from `Entry.jsx` and the Choice footer. Content per PRIV-2 and PRIV-8: publisher (D8); hosts with role and terms; on-device processing; the usage counts (fields generated from `usage-schema.js`, opt-out, exemption conditions); report mails and contributions (basis, retention, erasure procedure with `fileId`); local storage disclosure **generated from code** (a script lists `localStorage` keys and IndexedDB stores, and the transport: keepalive `fetch` first, beacon fallback, `99bcce2`), tested against the notice; not intended for under-15s; filming oneself only, no bystanders; rights and CNIL complaint. `collect.html` and `collect-batch.html` get the CSP meta or leave production `dist/` (PRIV-1).
- CI acceptance: PRIV-1, PRIV-2, PRIV-8 tests; axe clean; tour shots at the three sizes.
- iPhone: open both links; read on 375 px. Dependencies: WP2.1, D8, D9. Size: M.

**WP2.3 Make the promises true before analytics go live**
- Scope: `Entry.jsx` `COPY` line rewritten (D9); `events.js`: no event, including `open`, under GPC, DNT or `wv_count_off`; language from React state, not `wv_lang`; deploy step per PRIV-3; `feedback-worker/README.md` lists the CNIL audience-measurement exemption conditions (publisher-only purpose, no cross-referencing, notice plus objection, IP truncated or not kept by the processor) each as a checked item with its evidence.
- CI acceptance: PRIV-3, PRIV-4 tests. Dependencies: WP2.2, D6 (and the PLAN.md RULES conflict in D6). Size: S.

**WP2.4 Contribution consent that holds up, then re-enable**
- Scope: `contribute-copy.js` (`what` says the file arrives with the sender's e-mail address; no "ni votre nom"; the consent block listed); `ContributeAsk.jsx` (15+ statement); `contribute.js` (`contributionsFile()` adds the file-level consent block and `fileId` per PRIV-6, `deviceInfo` reduced per PRIV-10; the new REL-3 fields only with a `textVersion` bump, PRIV-9); re-consent per PRIV-12; `reportLinks.js` to the project mailbox (D8), never a consumer mailbox for movement data; the erasure procedure written in the register and dry-run once; patients excluded per D19. Proof of consent (Art. 7(1)) is the received file plus its mail; the notice says so. Contributions re-enabled in production only after WP2.1's lawyer review.
- CI acceptance: PRIV-6, PRIV-9, PRIV-10, PRIV-12 tests; `e2e/contribute.spec.js` asserts the age statement is required and the file carries the block; `labelKind: 'after-app'` still set (R1).
- iPhone: one contribution end to end; the mail arrives at the project address with its `fileId`. Dependencies: WP2.1, WP2.2, D8, D10, D19. Size: M.

**WP2.5 Dormant health stores out of the code**
- Scope: remove `saveMedicalRecord`, `getMedicalRecords` and the `food` and `personalRecords` functions from `src/lib/storage.js` and stop creating those stores on new installs, without raising the IndexedDB version (an older build cannot open a higher version, so a version bump would make rollback impossible); existing installs keep the empty stores, which the generated storage disclosure lists as "empty legacy store".
- CI acceptance: unit test that a fresh install has no `medical` store and an existing v1 database still opens. Dependencies: D13 for the deletion of code (R5 covers files under test/ and benchmark/ only; this touches `src/`). Size: S.

**WP2.6 Claims sheet and forbidden claims**
- Scope: `scripts/claims-sheet.mjs` writes `docs/claims.fr.md` and `docs/claims.en.md` from the scoreboard summaries and `tiers.txt` at `origin/main`, run in the deploy job (not a byte-identical CI gate); lists allowed and forbidden claims (form, injury, clinical, patient, "précis", "validé", "mesuré" without sets and people), applying to sales material for health professionals as well; strips the dormant claim strings from `src/locales/*.json` (FINDING-035, D-approved).
- CI acceptance: a test scans the string literals of every module reachable from `src/main.jsx` (reachability from `scripts/unreachable.mjs`) and the locale keys for forbidden words.
- Dependencies: WP4.7's summaries for the figures (the sheet ships without figures until then). Size: S.

### Phase 3. Analysis reliability on iPhone

All decoding changes are "a change to decoding" under PLAN.md METHOD (verifier, check page on David's iPhone, both paths). Order: 3.1 → 3.2 → 3.3, then 3.4; 3.5 → 3.6; 3.7, 3.8 and 3.9 independent. Re-ordered by David after WP1.9 if the trial says so.

**WP3.1 Structured diagnostics**
- Scope: `frameExtractor.js` (parse the `before` string into `fallbackReason`; return `rotationDecision`), `coreAnalysis.js` (`metadata.repeatShare`), `reportLinks.js` (report mail lines), Result "Détails" line for the decoder (internal wording). The contribution gains `fallbackReason` only with WP2.4's `textVersion` bump (PRIV-9).
- CI acceptance: REL-3 unit test; journey reads the fields from `wv:core-result`.
- iPhone: the report mail of one analysis shows `fallbackReason`, `repeatShare` and `rotationDecision` (decoder and read share are already there). Size: S.

**WP3.2 Stale frames caught sample by sample**
- Goal: REL-1.
- Scope: `frameExtractor.js` RVFC path records per-sample pixel repetition (the primary signal: the suspected failure is `drawImage(video)` returning a stale picture while the callback's metadata says a new frame was presented, so metadata alone would call every sample fresh); `metadata.presentedFrames`/`mediaTime` are recorded only to flag the separate case "callback skipped a sample interval". `check.html` gains a readback self-test: draw the same frame twice and compare hashes; if they differ on the device, `frozenRead.js` switches to a tolerance (mean absolute difference on a downsampled grid) and `sameSkeleton` to an epsilon. `frozenRead.js` gains the run rule; `coreAnalysis.js` applies it after counting inside the counted reps' span; the skeleton backstop and `liveCounter.js` use the same rule (REL-1). Constants fixed only after the measurement listed in REL-1, committed as a table in `test/real-phone/partial-read/`.
- CI acceptance: REL-1 tests, including metadata-advances-pixels-do-not; the CI journey stays green (it can go red and must not); scoreboard, scoreboard:public and synthetic unchanged (the rule acts on decoding output; if stored-landmark gates move, the WP is wrong).
- iPhone: the self-test row and the incident clip, both paths, Low Power on, in **normal browsing** on David's iOS version (Safari's Advanced Fingerprinting Protection may add canvas noise; it is on in Private Browsing and possibly for all browsing in recent Safari, not verified) and once in Private Browsing.
- Dependencies: WP3.1, WP0.2. Risk: false refusals; the must-not-refuse set is the control. Size: M.

**WP3.3 WebCodecs short read falls back; duration; timeouts**
- Goal: REL-2, REL-6.
- Scope: `frameExtractor.js` (early end throws a typed error so the cascade tries RVFC, now guarded by WP3.2; duration from the video stream when web-demuxer gives it, both recorded; `withTimeout` around `demuxer.load`), `poseAnalysis.js` (download stall timeout and separate compile timeout; progress callback), `Watch.jsx` ("Préparation du modèle (une seule fois)" with progress, D-copy). Includes `check.js` `rowVerdict`, `check-baseline.json` and `check-baseline.test.ts` (which assert `c.duration === d.metadata.duration` and `floor(duration*15) === samples`), updated together.
- CI acceptance: `pipeline-errors.test.js`: short decode → RVFC attempted; container longer than the video stream by 0.5 s → not refused; demuxer load stalls 20 s → named error. REL-6 proxy test.
- iPhone: a screen recording with sound (longer audio track); the check-page rows both paths; first run on 4G from a cold cache. Dependencies: WP3.2. Size: M.

**WP3.4 The interruption gap and the draft result**
- Goal: REL-4 (gap only), REL-5.
- Scope: `src/lib/breadcrumb.js` (localStorage `wv_analysis_run = {stage, decoder, lift, startedAt}`), set in `CoreUpload.jsx` and `LiveSession.jsx`; cleared only on a result or a non-interruption error; on `INTERRUPTED` it records `stage: 'interrupted'` and stays. `App.jsx` on next load opens the existing `AnalysisInterrupted` screen and copy. Drafts: a separate IndexedDB store `drafts` (not the sets store), written when a result is shown and moved to sets on confirm or correction. Every reader of saved sets is listed and tested to exclude drafts: History (shows drafts in their own "À confirmer" block read from `drafts`), `previousSet`, `progress.js` and records, "Dernière série", `sets-csv.js`, `keep-sets.js` backups, `contribute.js`, `ContributeAsk` trigger, `result_kept` events. `main.jsx` defers service-worker reloads while a draft exists. The two new storage items are added to the generated disclosure (WP2.2).
- CI acceptance: REL-4 and REL-5 e2e; one unit test per reader; `smoke.mjs` stored-set assertion accepts draft then confirmed record.
- iPhone: start an analysis, force-quit the app (not a swipe from the app switcher while visible, which triggers the existing interruption path), relaunch: the interrupted screen appears; show a result, force-quit, relaunch: the draft is offered.
- Dependencies: D5, WP1.4. Size: M.

**WP3.5 iPhone decode matrix, reduced**
- Goal: REL-7 on the formats people actually produce.
- Scope: `check-baseline.json` gains matrix rows (keyed by clip id, WP0.2): default iPhone camera settings (HEVC, Dolby Vision HDR on) in portrait and in landscape; the same clip picked from Photos and from Files (the Photos picker may transcode, for example HEVC to H.264 under "Most Compatible"); a screen recording; a WhatsApp re-encode; a gym clip with a passer-by (REL-9); one machine and one cable variant. For each source the row records codec, frame rate and duration as the app reads them. Rotation check per lift: the expected orientation comes from the lift's view (lying and reclined lifts such as bench, hip thrust, leg press, push-ups are not "shoulders above hips"), tested on rotated video frames run through pose, not on rotated landmark arrays. Slow motion is a product decision (D22), tested on the exported file. Each row has David's count.
- CI acceptance: `rotation.test.js` cases for `frame.rotation` present/absent × drawImage applying/not applying; per-lift orientation unit test.
- iPhone: run the matrix once per iOS major, after any decoding change, and on two borrowed older iPhones before "market-ready" (REL-7). Dependencies: David films about 8 short sets. Size: M.

**WP3.6 Time estimate and length limit**
- Goal: PERF-4.
- Scope: `Watch.jsx` (remaining time after 20 samples), `extractionConfig.js` (`MAX_DURATION_SEC` from WP3.5 timings in Low Power Mode, marked validated once measured), `Film.jsx` (states the limit), `CoreUpload.jsx` (refuse above it before decoding, one reason one fix).
- CI acceptance: estimator unit test; e2e with a synthetic video above the limit refused before any sample.
- iPhone: 60 s and 3 min clips in Low Power Mode. Dependencies: WP3.5. Size: S.

**WP3.7 Platform modes and cache coherence**
- Goal: REL-8; no page meets WASM or chunks from another build.
- Scope: WebAssembly and SIMD pre-check in `CoreUpload.jsx`/`Live.jsx` and in `corePoseWorker.js` (typed error), plain message without reload advice. WASM and loaders get content-hashed URLs (`scripts/copy-models.js` copies `vision_wasm_internal.<hash>.wasm`, `web-demuxer.<hash>.wasm`), so an old page always gets the WASM its glue code expects. If WP0.3 item 4 failed, the page fetches the demuxer WASM itself and hands web-demuxer the bytes or URL it accepts, or the service worker proxies it. A failed lazy-chunk import (a page open across more than two deploys loses its chunks: the `wv-meta` keep list is `.slice(-2)`) reloads once with a notice.
- CI acceptance: worker-level WebAssembly test; `sw-wasm.test.js` asserts hashed WASM URLs are cached and served; e2e deletes a lazy chunk from the server and sees one reload with the notice.
- iPhone: Lockdown Mode on (REL-8, required before "market-ready"); the next deploy that changes web-demuxer's WASM: an analysis after the update completes. Size: M.

**WP3.8 Payload budget**
- Goal: PERF-1, PERF-2, PERF-5.
- Scope: `scripts/size-gate.mjs` (payload cap and chunk cap; entry sizes reported); `scripts/copy-models.js` stops copying `vision_wasm_module_internal.*` (and `nosimd` if D11 sets Safari 16.4+); `vite.config.js` aliases jsPDF's optional `html2canvas` and `dompurify` out if unused, keeping the warm-up in `Report.jsx` so the share stays within the user's tap; `?perf=1` records cold model load, first sample, first count.
- CI acceptance: size gate fails over budget; report specs pass (PDF renders).
- iPhone: `?perf=1` cold run on 4G (PERF-5); the share sheet opens on the first tap on "Partager". Size: S-M.

**WP3.9 Another person in the frame**
- Goal: REL-9.
- Scope: `coreAnalysis.js` identity-jump rule (refusal reason "Une autre personne est passée dans l'image", D-copy); Film advice line "Filmez-vous dans un coin dégagé"; notice line (WP2.2). Constants experimental, UNSOURCED.
- CI acceptance: REL-9 unit test; the three gates show no newly refused set.
- iPhone: the passer-by matrix row. Dependencies: WP3.5. Size: S-M.

### Phase 4. Counting honesty on every surface

**WP4.1 Tier and settlement on every surface**
- Goal: HON-3.
- Scope: `report-sheet.js`, `report-pdf.js`, `Report.jsx`, `History.jsx`, `sets-csv.js`: tier, "Compté par l'app, confirmé" / "corrigé" / "saisi à la main" / "à confirmer", app version; `Live.jsx`: tier only. `fitness-tests.js` screens: "Outil d'entraînement, pas un dispositif médical" and the safety line. `public/manifest.json` category `fitness` only.
- CI acceptance: unit tests on sheet and CSV contain tier and status; `e2e/report.spec.js` and `fitness-tests.spec.js` assert the lines. iPhone: a PDF from a Beta and an Experimental set. Size: S.

**WP4.2 Experimental counts presented as proposals; equal-weight confirm**
- Scope: `Result.jsx`: Experimental numeral outlined, no count-up (none for any tier under Reduce Motion, A11Y-4), headline "L'app a compté N. C'est juste ?"; "Oui" and "Non" equal weight; "Revoir la série" inside the ask card.
- CI acceptance: tour layout checks; `tiers.spec.js`; journey saves a typed correction. Dependencies: D3 wording, D4. Size: S-M.

**WP4.3 Apply the Beta bar** (D3)
- Scope: once WP0.6's target is met: `liftTiers.js`, `tiers.test.ts`, `e2e/tiers.spec.js`, the Beta-pinned ordering in `Choice`/`ExerciseList`, the tour, and the figures of WP4.7 (generated, not copy) updated in one PR; a lift that newly misses goes "under review" for one release.
- CI acceptance: `tiers.test.ts` enforces D3's bar on `tiers.txt`. Dependencies: D3, WP0.6. Size: S.

**WP4.4 Measured lifts first** (D18)
- Scope: `Choice.jsx`/`ExerciseList.jsx`: per D18, Beta lifts and recents by default, the other lifts behind search under "Expérimental"; each catalogue position shows the expected exact rate where a scoreboard gives one, otherwise "non mesuré".
- CI acceptance: e2e and tour. Dependencies: D18, WP1.9 lift data. Size: S.

**WP4.5 Edge warning (uncertainty signal)**
- Scope: `coreAnalysis.js` exposes `edgeFlag` from the core result (no count change); one line under the count in `Result.jsx`. Not a refusal (R8).
- CI acceptance: counts unchanged on all three gates; the flag rate and, among flagged sets, exact / off by 1 / off by 2+ go into the JSON summaries (WP4.7), not new lines in the `.txt` first line. Ship only if it fires on a minority of David's sets (TRIED.md: an earlier warning fired on 12 of 14).
- iPhone: a set filmed starting mid-rep shows the line. Dependencies: D4, WP4.7. Size: S.

**WP4.6 Correction loop that measures field error** (only if D6)
- Scope: `usage-schema.js` adds `errorBucket` to `result_corrected` (`≤-3, -2, -1, +1, +2, ≥+3`) and enum-only `decoder`, `failureKind`, `mode`, `lengthBucket`; `contribute_*` events; `Live.jsx` give-ups. Diagnostic fields aggregated weekly, cells under 5 suppressed (PRIV-11); notice and `textVersion` updated in the same PR (PRIV-9).
- CI acceptance: schema tests reject fields outside the enums; worker tests including suppression; `events.spec.js`. Dependencies: Phase 2, D6. Size: S.

**WP4.7 Scoreboard summaries and public claims**
- Scope: `npm run scoreboard` and `scoreboard:public` also write `scoreboard.json` and `public-scoreboard.json` (date, commit, all-sets exact and total, deciding-sets exact, within one, off by 2, off by 3+, refused, per-lift sets and people, edge-flag rates); the `.txt` first line stays for humans; README's figures and WP2.6's sheet read the JSON. Public wording: "N exercices testés sur M séries filmées par P personnes ; les autres en expérimental", never "mesuré" alone; numbers from `origin/main` for anything outside the repository (HON-4).
- CI acceptance: HON-4 test; schema test on the JSON. Size: S.

### Phase 5. The rest of the gym loop

User-visible, no counting change, one small PR each; order revisited after WP1.9.

| WP | Goal | Scope | CI acceptance | iPhone | Size |
|---|---|---|---|---|---|
| WP5.1 Find the exercise fast | Search first, Guide merged, one catalogue | `Choice.jsx`, `ExerciseList.jsx`, Guide | e2e: search reachable without scroll at 390×664; tour | Find a lift by search | M |
| WP5.2 Say what the app does on arrival | One functional line under the brand line; Enter shown at once | `Entry.jsx` `COPY`, `Entry.css` | tour; axe | First visit | S (copy D) |
| WP5.3 Level before the first set | Beginner path reachable on set 1 | `level.js` (`shouldAskLevel`), skippable one-tap question; remove duplicate level field from `Report.jsx` | e2e: beginner → guide before Film | First visit as beginner | S |
| WP5.4 Lighter result for first-time users | Count, question, Revoir; measures behind "Détails"; short-rep tip off until ROM is validated | `Result.jsx`, `level.js` `resultBlocks`, `set-account.js` | unit tests on `resultBlocks`; tour | Beginner and expert result | S |
| WP5.5 Load on Result | A load input (kg, prefilled from the last set of the lift, skippable) on Result writing the existing `weight` field (`ManualLog.jsx`, `analyzeVideo.js`); no schema migration; whether "Record : N, charge non notée" (`progress.js`) stays is D7 | `Result.jsx`, `History.jsx`, CSV | e2e save with and without load; existing `progress.js` tests unchanged unless D7 changes them | Save 3 sets with loads | S-M |
| WP5.6 Small frictions | FR/EN switch on Choice; rest clock only on tap or after a just-filmed set; one "Signaler" action (the GitHub link stays until D23, PLAN.md LIFT TIERS requires it); "Bilan de la série"; labels ≥ 12 px in rem | `Choice.jsx`, `Result.jsx`, `Report.jsx`, `Entry.css` | A11Y-3 test; tour | Safari page zoom 200 % | S |
| WP5.7 Framing check before recording | Live preview shows the counting joint green/red before the recorder opens | `Film.jsx`, `liveCamera.js`, `liveEngine.js` | e2e with Chromium fake camera; tour | Frame a curl, then record | M (after WP6.1) |

### Phase 6. Live counting fit for users

Live is hidden in production by `VITE_LIVE` (WP0.3) until WP6.1-WP6.3 pass; WP6.5 lifts the flag with D12.

**WP6.1 Measure on the device first** (no code)
- iPhone, in Safari and in the home-screen app: ms per sample (normal, Low Power, after 3 min of preview, after 10 min of use for thermal throttling of CPU MediaPipe); whether the wake lock holds 2 minutes untouched; whether the camera permission is asked again on each launch of the home-screen app; whether speech (`liveVoice.js`) is silenced by the silent switch; that `navigator.vibrate` is absent on iOS, so reps give no haptic feedback (decide a visual substitute). Recorded per WP1.2. Decides WP6.2 and D12.

**WP6.2 A slow phone keeps the set**
- Scope: `liveEngine.js` (over `MAX_BACKLOG`, stop sampling, keep samples), `Live.jsx` ("Voir le compte jusqu'ici"), `liveCounter.js` (`finish` on the partial set, marked partial).
- CI acceptance: `e2e/live.spec.js` with a slowed fake worker reaches a partial result; final count equals `summarizeCount` on the kept samples. iPhone: Low Power Mode, 2-minute set. Size: S-M.

**WP6.3 Camera stalls and wake lock**
- Scope: listen to track `mute`, `unmute`, `ended` and video `waiting` (none today, measured with grep); pause as for a hidden page with the reason; check `holdScreenAwake()` (`interruption.js`) and warn when refused.
- CI acceptance: e2e dispatches a synthetic `mute` event and sees the pause message (limit: tests the listener only; `track.muted` cannot be set from a test). iPhone: a phone call during a live set. Size: S.

**WP6.4 Hands-free set boundaries** (counting-adjacent)
- Scope: `COUNTDOWN_SEC` 3/5/10 (`Live.jsx`); trimming the trailing walk is a counting change: synthetic test first, R2 per-clip diff, all three gates. Dependencies: D12. Size: M.

**WP6.5 Live honesty and release**
- Scope: tier tag on the live screen; script measuring HON-7; with D12 and HON-7 met, `VITE_LIVE=1` in `deploy.yml`. Size: S.

### Phase 7. Release tooling and engineering hygiene

No user-visible change. After the loop (critique 2.1); WP7.1 may move earlier if hash mismatches on the Vercel preview keep blocking checks.

**WP7.1 Preview per PR head, on another origin**
- Scope: `.github/workflows/preview.yml` checks out `github.event.pull_request.head.sha` (not the merge ref), builds with `VITE_BASE` set to its real path, publishes to a different registrable origin (for example `<sha>.wv-preview.pages.dev`, Cloudflare Pages under David's account). **A preview must never be served from `*.github.io` of the same account**: it would share production's origin, its IndexedDB sets, localStorage and Cache Storage, its service-worker `activate` would delete production's `wv-model-*` and `wv-wasm-*` caches, and a schema change would migrate David's real sets. The build hash shows on `check.html` and behind `?build=1`, not on Entry. The PR comment carries the URL and the WP1.2 checklist. The host is named in the notice (PRIV-8); the Vercel preview on a third person's account is retired (D8).
- CI acceptance: a Playwright smoke opens the URL and reads the hash equal to the PR head SHA. Dependencies: D8. Size: M.

**WP7.2 Light rollback**
- Scope: rollback = revert on main and redeploy through the normal flow; `deploy.yml` tags `prod-YYYYMMDD-<sha>` with `contents: write` on the tagging step only. Before any rollback, the schema rule: `storage.js` `checkAndMigrateSchema` never lowers a stored `schemaVersion` (an older build that sees a newer version leaves it and runs read-only-compatible), and migrations are idempotent (unit tests); rollback across an IndexedDB version bump is unsupported and stated in `IPHONE_CHECK.md`. No manual `CACHE_NAME` bump (it is generated by `scripts/inject-sw-precache.js` as `wv-v<hash>`; a rolled-back build already has a different `sw.js`).
- CI acceptance: unit tests on the schema rule; a test that the rollback build's `sw.js` differs from the current one.
- iPhone: rollback rehearsal: after the redeploy, force-quit the home-screen app and relaunch (bringing it back from the app switcher does not reload); `check.html` shows the previous build hash. Size: S.

**WP7.3 State block from committed files**
- Scope: `scripts/state.mjs` writes STATE.md's machine part from committed files at HEAD only (scoreboard summaries, `tiers.txt`, module counts from `scripts/unreachable.mjs`); remote state (main and counter-core SHAs, CI and deploy runs) goes into a generated artifact, not a gate; historical scorecards moved to `docs/history/`; stale figures removed from BACKLOG.md.
- CI acceptance: a job fails when the block differs from the script's output at HEAD. Dependencies: David's leave to edit STATE.md (ARCHITECTURE.md §9). Size: S.

**WP7.4 Dormant code out of `src/`**
- Scope: only files listed by `scripts/unreachable.mjs` that have no importer under `test/`, `benchmark/` or `scripts/`; `src/lib/counting/` (learned, HMM, `repCounter/*`, `valleyCounter.*`, `hysteresisCounter.ts`) and the old counter are excluded (PLAN.md: "Leave the old counter's code unchanged"; used by `learned-span.test.ts`, `hmm-eval.test.ts`, `agreement/counts.test.ts`, `benchmark/replay-*.mjs`). Archived on tag `dormant-2026-10` first. Split `poseAnalysis.js` so the live path imports only what it uses.
- CI acceptance: `unreachable.mjs` as a CI check on the remaining list; all gates unchanged; `npm run test:benchmark` passes. Dependencies: D13. Size: M.

**WP7.5 Type-check the live JS** — `// @ts-check` or `tsconfig.live.json` with `checkJs` over the reachable list; `npm run typecheck` covers them. Size: M.

**WP7.6 Tests for the shell** — hash-router transitions, `main.jsx` service-worker deferral (never during analysis or with a draft), `LiveSession` result shape equal to `CoreUpload`'s. Size: S.

**WP7.7 Real clips in CI**
- Scope: David's five check clips transcoded to H.264 (Playwright's Linux Chromium does not decode HEVC .mov), kept in a private store fetched with a secret, never uploaded as a CI artifact (the repository is public, so artifacts and LFS objects are public). The expected counts are landmarks produced in Chromium once and committed, not the iPhone `before`.
- CI acceptance: the job decodes the five clips in Chromium and matches the Chromium baseline. Dependencies: D14. Size: M.

---

## 4. Decisions only David can make

| ID | Decision | Recommended answer | Consequence |
|---|---|---|---|
| D0 | counter-core's PLAN.md (122 commits behind main; missing the 2 October order, the 1 October copy approval, the learned-counter gate) | Bring it up to date from the branch now, or retire counter-core and make main's PLAN.md the one that prevails (CLAUDE.md line 1 amended) | Every rule this spec leans on has a source that prevails |
| D1 | How the guards reach production | Whole PR #66 (WP0.3) with analytics pinned empty, Live hidden and contributions paused; the hotfix route is dropped (cherry-picks conflict and `tiers.test.ts` fails on main's core) | Production gets 49 commits, including counting changes (David's sets 7 → 8 of the 9 deciding; public 286 → 355); nothing new leaves the phone |
| D2 | The release flow | PRs into main from one branch per task; up-to-date branch required; David's approval on the `github-pages` environment; agent PRs from a bot identity if he wants a review step | PLAN.md, ruleset (WP1.1) and practice match |
| D3 | The Beta bar | At least 5 labelled sets from at least 2 people, including blind exam sets, all exact, none off by 3+ on public data for that lift; a new miss puts a lift "under review" for one release; applied only once WP0.6's sets exist | Without WP0.6, most Beta lifts would return to Experimental; with it, "Beta" is defensible to professionals |
| D4 | Uncertainty warning when the video starts or ends inside a movement (WP4.5) | Yes, as a warning that hides no number, if it fires on a minority of David's sets | More honest results; some exact results carry a nudge |
| D5 | Keep a shown count as a draft before the tap (WP3.4) | Yes, in a separate store, shown in its own "À confirmer" block, one tap to discard | No count lost to a reload; no reader of sets sees drafts |
| D6 | Switch on anonymous usage counts, and with what fields; resolve PLAN.md RULES "Nothing about the user leaves the phone" | Yes, only after Phase 2 and the lawyer review; PLAN.md rule restated as "nothing that identifies the user" | Field accuracy visible (WP4.6); notice lists each field |
| D7 | Load on a set; keep the load-less record line | Load optional, prefilled, skippable (WP5.5); keep "Record : N, charge non notée" | Gym-goers get a usable log; no migration |
| D8 | Publisher identity, mailbox, preview host | Project mailbox now (contact@, data@), never a consumer mailbox for movement data; publish as David until a company exists; preview on David's own account (WP7.1) | Unblocks WP2.1-WP2.4 |
| D9 | Entry line and register | "Vos vidéos et vos mouvements ne quittent votre téléphone que si vous les partagez." and confirm "vous" | Entry stays true once analytics are on |
| D10 | Contribution basis, age, retention | Explicit consent (Arts. 6(1)(a), 9(2)(a)), 15+ statement, retention "until the counter is retrained, at most 24 months", erasure by `fileId` | Contributions usable with a defensible record |
| D11 | Minimum iOS / Safari version | Safari 16.4+, stated on the help page | Drop the no-SIMD WASM (PERF-2) |
| D12 | Live counting: offer it, HON-7 threshold, how sets end | Hidden until WP6.1-6.3 pass; then on with a 5 s countdown if HON-7's proposed threshold holds | Live does not reach users before it is measured |
| D13 | Remove dormant code from `src/` (WP2.5, WP7.4) | Yes, archived on a tag first, `counting/` and anything imported by tests or benchmarks excluded | Smaller search space; PLAN.md's old-counter rule respected |
| D14 | Real-phone clips for CI | Yes, his own clips only, no other person in frame, in a private store (WP7.7) | Decode-to-count gated on real footage |
| D15 | What a cut rep is | Decide (a) a last rep the video stops on during its return and (b) a last rep cut at the bottom; then the core follows the full counting method | TRIED.md: +16 and +13 exact on public half A if the convention matches Countix's |
| D16 | Positioning toward health professionals | No patient-facing positioning or demo until a regulatory opinion exists; sign the intended-purpose statement (WP2.1) | MDR exposure follows the stated purpose |
| D17 | Licence and brand before any paid offer | Entity, INPI/EUIPO search, whether future work stays MIT; a lawyer reviews terms of sale | Not built now (R7) |
| D18 | What a new user sees first | Beta lifts and recents by default; the other 175 behind search under "Expérimental"; or film the most-used lifts first (WP0.6) | Fewer "is this right?" questions on first sets |
| D19 | Patients in scope for any data flow | No, until an HDS-certified store and a regulatory opinion exist | Patients excluded from contributions and data-sending features |
| D20 | Contribution files and report mails already received | Keep them with a retroactive notice by reply mail, or delete them; recorded in the register | Data already held gets a basis or goes |
| D21 | Countix/Kinetics landmarks of YouTube uploaders in the public repository | Before any commercial step: make the repository private or hash file names, and record the research basis and the Art. 14(5)(b) position | Licensing and third-party data risk handled |
| D22 | Slow-motion video | Refuse with a reason, or count in real time; tested on the exported file (WP3.5) | Defines what happens to a stretched set |
| D23 | GitHub report link for end users (PLAN.md LIFT TIERS requires it) | Keep it until PLAN.md is amended; then one "Signaler" action by mail | WP5.6 waits on it |
| D24 | The `feedback` table and the `/ingest` endpoint (R5) | Export, then drop the table; remove the endpoint | No unconsented pseudonymous data kept |
| D25 | Wording for a genuine zero-movement set on the `unsure` path | Keep "Nous n'avons pas pu compter cette série." or a distinct line | Honest headline when nothing was done |
| D26 | Repositioning if PROD-1 fails | Opened only if confirming a count is not faster than typing it after Phase 1 | Product direction |
| D27 | Adopt `font: -apple-system-body` (iOS Larger Text) | Yes, with rem-based sizes, if WP5.6's tour shows no layout fault | Larger Text works in the home-screen app |

---

## 5. Out of scope, explicitly

- **Counting accuracy work on current data.** No further tuning of `core.ts` on these landmarks until D15, new labelled sets (WP0.6) or better pose input.
- **The learned counter, the HMM counter, the period counter.** Research only (`counting/learned.ts`, `counting/hmm.ts`); not deleted by WP7.4.
- **Bench press and overhead press counting changes** until WP0.6's sets exist (PLAN.md, 30 September).
- **The patient and kinésithérapeute segment**, fitness tests in patient demos, any HDS hosting (D16, D19).
- **Form scoring, injury risk, velocity in m/s, coaching beyond what R9 sources allow, challenges, badges, social features.** Frozen (DIRECTIVES.md Part 1).
- **Monetisation, payment, accounts, server-side storage of sets, cloud sync.** Frozen; sets stay on the phone.
- **Native apps.** The product is the PWA.
- **Automatic exercise detection.**
- **New exercises.** The 181 stay offered; which are shown first is D18.
- **Moved to BACKLOG (R7), dated 3 October 2026:** 4K60 and upside-down rows of the decode matrix; cloud iOS nightly runs; the copy-catalogue refactor (the forbidden-word test scans string literals instead); a byte-identical claims-sheet CI gate; an entry-JS size gate; a 25-month purge of identifier-free aggregate rows; "today's session" grouping and "last time" on Film (scheduled at the Phase 1 boundary).
- **Replacing David's iPhone check with any CI job** (R6).
- **Any change to labels or test clips** (R1), and any destructive operation without David's approval (R5).

---

## Appendix A: dependency graph and what each phase leaves true

Arrows read "needs". A WP not listed needs only its phase's start.

```
WP0.1 -> WP0.2 (item 4 of the diagnosis)
WP0.3 -> WP0.2, WP0.4, D1
WP0.4 -> D20, D24
WP4.3 -> WP0.6, D3
Phase 1 -> WP0.3 on main
WP1.2 -> WP1.1 -> D0, D2
WP1.9 -> WP1.3..WP1.7
WP2.2 -> WP2.1 -> D8, D19
WP2.3 -> WP2.2, D6, D9
WP2.4 -> WP2.1, WP2.2, D8, D10, D19
WP2.6 (figures) -> WP4.7
WP3.1 -> WP3.2 -> WP3.3
WP3.2 -> WP0.2
WP3.4 -> WP1.4, D5
WP3.5 -> WP3.6, WP3.9
WP4.5 -> WP4.7, D4
WP4.6 -> Phase 2, D6
WP4.4 -> D18, WP1.9
WP5.7 -> WP6.1
WP6.5 -> WP6.1..WP6.3, D12
WP7.1 -> D8
WP7.4 -> D13
WP7.7 -> D14
```

| Phase | CI after | Counting gates | iPhone gate |
|---|---|---|---|
| 0 Guards and data flows | Green; workflow changes of PR #66 reviewed; events URL pinned empty | Branch baselines become production's (D1); WP0.2 adds one labelled set with its R2 diff | WP0.3 checklist |
| 1 Minimum gym loop | Green, ruleset, environment approval | Unchanged | Per-WP items; PROD-1/3 recorded; trial |
| 2 Legal and privacy floor | Green, PRIV tests | Unchanged | Read notices; one contribution end to end |
| 3 Analysis reliability | Green, REL tests, size gate | Unchanged (decoding only); REL-9 refuses no gate set | Check page, both paths, reduced matrix |
| 4 Honesty on every surface | Green, HON tests, JSON summaries | Unchanged; WP4.3 changes tiers, not counts | Result and PDF per tier |
| 5 Rest of the loop | Green, tour layout checks | Unchanged | Per-WP item |
| 6 Live counting | Green, live specs | Unchanged except WP6.4 (full counting method) | WP6.1 measurements |
| 7 Tooling and hygiene | Green, unreachable check, wider typecheck | Unchanged | Rollback rehearsal; preview hash |

## Appendix B: old to new work-package numbers

| Old | New | Old | New | Old | New |
|---|---|---|---|---|---|
| WP0.1 | WP0.3 (+ WP0.1 diagnosis) | WP3.1 | WP3.1 | WP5.1 | WP1.3 |
| WP0.2 | WP0.2 | WP3.2 | WP3.4 | WP5.2 | WP1.4 (+ WP3.4) |
| WP0.3 | WP0.5 | WP3.3 | WP3.2 | WP5.3 | WP1.5 (recents) + WP5.1 |
| WP1.1 | WP1.1 | WP3.4 | WP3.3 | WP5.4 | WP5.2 |
| WP1.2 | WP7.1 | WP3.5 | WP3.6 | WP5.5 | WP5.3 |
| WP1.3 | WP1.2 | WP3.6 | WP3.5 | WP5.6 | WP1.7 |
| WP1.4 | WP7.2 | WP3.7 | WP3.7 | WP5.7 | WP5.7 |
| WP1.5 | WP7.3 | WP3.8 | WP3.8 | WP5.8 | WP5.4 |
| WP2.1 | WP2.2 (+ WP2.1 DPIA) | WP4.1 | WP4.1 | WP5.9 | WP5.5 |
| WP2.2 | WP2.3 | WP4.2 | WP4.2 | WP5.10 | WP5.6 |
| WP2.3 | WP2.4 | WP4.3 | WP4.5 | WP5.11 | BACKLOG |
| WP2.4 | WP2.6 | WP4.4 | WP1.6 | WP6.x | WP6.x |
| | | WP4.5 | WP4.6 | WP7.1-7.4 | WP7.4-7.7 |
| | | WP4.6 | WP4.7 | WP7.5 | BACKLOG |

New: WP0.1, WP0.4, WP0.6, WP1.8, WP1.9, WP2.1, WP2.5, WP3.9, WP4.3, WP4.4.

## Appendix C: critiques not adopted, or adopted in part (3 October 2026)

Critique sets: (1) release and iOS platform, (2) product, (3) engineering and testability, (4) privacy and regulation. Every other item of the four sets is applied in the text above.

- **(1.22) Generate README figures from `origin/main`.** Not adopted; (3.14) is adopted instead: README figures come from the summaries at the commit the README is in and name that commit; numbers quoted outside the repository come from `origin/main` (HON-4). On a branch, a README describing main's numbers would be wrong for that branch once merged.
- **(2.20) Drop the per-SHA preview.** Not adopted; moved to Phase 7 and simplified (WP7.1). David's iPhone gate and demos need a build whose hash he can verify (2.11, 3.9); the third-person Vercel preview is a privacy and control gap (D8).
- **(2.20) WP1.3 as a checklist only.** Adopted in part: the PR-body lint and the second environment are dropped, but David's approval on the `github-pages` environment stays, because (3.8) shows a required review is impossible and nothing else would enforce R6.
- **(2.20) "A revert and a cache-name bump is enough" for rollback.** Revert adopted (WP7.2); the cache-name bump is not, because `CACHE_NAME` is generated per build (1.3, 3.11).
- **(2.20) Shrink WP3.6 to default camera settings plus Photos versus Files.** Adopted in part: the screen recording, WhatsApp re-encode, passer-by and machine/cable rows stay, because other critiques (1.8, 1.12, 2.6, 2.7) need them as must-not-refuse or must-refuse evidence; 4K60 and upside-down go to BACKLOG.
- **(2.20) Move WP2.4 (claims sheet) to BACKLOG.** Adopted in part: the byte-identical generator gate is dropped; the forbidden-claims list stays in Phase 2 (WP2.6) because David demos to professionals now and (4.4) extends the list to sales material.
- **(2.3) Trial as a gate before Phase 5 priorities.** Adopted with a change: the trial runs after the minimum gym loop ships (otherwise it would measure the broken "Nouvelle série") and gates Phases 3-5.
- **(2.4) "Top 10 gym lifts by frequency".** Adopted with the list chosen by David: no frequency source was found; marked UNSOURCED.
- **(3.1) Hotfix route with a corrected dependency set.** Not adopted; the alternative it offers, the whole PR as the only route, is adopted (D1). Making curl and leg press Experimental on main's core for a hotfix would be a tier change for a release that the whole PR makes unnecessary.
- **(3.5) Detect rotation with a frame-orientation model.** Not adopted (a new model, out of the current phase); per-lift expected orientation and container rotation are used.
- **(3.7) Fast-forward push through a bypass actor.** Not adopted; the alternative (key approval on the tree hash) is used, so the ruleset has no bypass actor and (3.8)'s rejection test holds.
- **(1.17) Page tells the worker its build hash.** Not adopted; content-hashed WASM URLs, the other proposed fix, are simpler and need no worker state.
- **(1.16) Show the card before the first save, or a backup handover.** Both adopted together (WP1.7), not as alternatives.
- **(4.16) Lawyer review before WP2.1 (now WP2.2) ships.** Adopted in part: the notice ships when David approves the copy, because a reviewed-later notice is better than none while nothing is collected (analytics pinned off, contributions paused); the lawyer review gates analytics, contributions and any wider audience.
- **(4.3) Or require an HDS-certified store.** Not adopted for launch: patients are excluded instead (D19), which removes the need.
- **(4.12) Art. 6(1)(f) as the basis for usage counts; (4.2) bases per purpose.** Recorded as proposals for the lawyer (section 2.5 header), not as settled law.
- **(4.15) Remove the `medical` stores.** Adopted, but without deleting existing stores, because raising the IndexedDB version would make any rollback fail (WP2.5).
- **(1.6) Safari 26 turned Advanced Fingerprinting Protection on for all browsing; (1.9) `play()` rejects under Low Power Mode; (1.12) slow-motion export behaviour; (1.16) separate Safari and home-screen storage.** Adopted as tests on the phone, not as facts, because none was verified here.
- **(1.21) WP7.5 (cloud iOS nightly) as part of REL-7.** Not adopted; two borrowed older iPhones are (REL-7), and the cloud nightly goes to BACKLOG with (2.20).
- **(2.21) Reposition around replay and tempo if PROD-1 fails.** Recorded as decision D26, not planned work.
- **(2.16) Workout grouping scheduled at the next phase boundary.** Adopted as a dated BACKLOG entry (R7 forbids building it in the current phase).
