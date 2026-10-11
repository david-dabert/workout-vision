import fs from 'node:fs';
const dir = 'test/real-phone/mmfit';
const results = JSON.parse(fs.readFileSync(dir + '/results.json'));
const rows = results.rows;
const tally = select => rows.filter(select).length;
const lines = [
  '# MM-Fit STOP report', '',
  'MM-Fit is supplementary build data only, never exam data. Admission requires both wrists and both ankles visible together in at least 90% of all samples. Excluded sets remain in this table and in the overall count result.', '',
  'Credit: David Strömbäck, Sangxia Huang and Valentin Radu, [MM-Fit, Zenodo](https://zenodo.org/records/7672767), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modification: labelled frame intervals extracted and reset to a local timeline; MPEG-4 Part 2 converted to H.264 with libx264 CRF 18 (lossy), with dimensions, frame rate, pixel format and aspect ratio preserved. Source files and labels are unchanged. Commands and output metadata are in results.json; source metadata and label hashes are in inventory.json.', '',
  `All ${rows.length} labelled sets were run in Chrome. Exact labelled count with no console/request error: ${tally(r => r.score === 'PASS')}; failures: ${tally(r => r.score === 'FAIL')}, including ${tally(r => r.lift === null)} unsupported sets. Supplementary build admission: ${tally(r => r.admitted)}; excluded: ${tally(r => !r.admitted)}. No exam was run or passed.`, '',
  `The harness maps only the exact XNNPACK startup stderr line to console.info, matching the app. Run evidence: ${rows.reduce((n, r) => n + r.xnnpackInfo, 0)} informational startup messages; ${rows.reduce((n, r) => n + r.consoleErrors.length, 0)} console/page errors; ${rows.reduce((n, r) => n + r.failedRequests.length, 0)} failed requests. Other errors remain failures (scripts/check-mmfit.mjs).`, '',
  `Execution recovery: ${rows.reduce((n, r) => n + (r.attemptFailures?.length || 0), 0)} failed attempts are preserved in results.json. Only sets without landmarks were retried, at reduced concurrency and with the same timeout and inference/conversion settings. Their table result remains FAIL even when the retry returns the labelled count.`, '',
  'No counter, pose, sampling or extraction parameter changed. The three diagnoses below use the original saved landmarks, not the fresh extraction. No labels were changed.', '',
  fs.readFileSync(dir + '/diagnosis.md', 'utf8'), '',
  '## Verification', '',
  '```text', fs.readFileSync(dir + '/checks.txt', 'utf8').trim(), '```', '',
  '```json', fs.readFileSync(dir + '/scope-check.json', 'utf8').trim(), '```', '',
  'Lint, typecheck, unit tests and production build outputs are saved alongside this report. Existing lint and build warnings remain. No video is tracked; videos and the full landmark archive stay under ~/Datasets/MM-Fit. The three saved diagnostic traces are committed as compressed landmarks.', '',
  'The throughput restart was discarded as a run, with its logs retained locally under ~/Datasets/MM-Fit/interrupted-attempt. The table below comes from the clean full run in all-sets-final; no row was selected by count or visibility.', '',
  'Independent reviewer and verifier agents were not run: this session permits delegation only when the user or an AGENTS.md/skill explicitly requests it. The repository request is in PLAN.md. Direct verification is recorded above; the independent METHOD review remains unmet.', '',
  '## Every set', '',
  'PASS means exact dataset count, no console/request error, and no failed attempt. FAIL includes unsupported lifts (count shown as —) and recovered execution failures. Admission is a separate visibility decision, not an accuracy pass.', '',
  fs.readFileSync(dir + '/table.md', 'utf8'), '',
  'STOP. Counter-core only. No main change or deployment. No counting parameter or label changed.', '',
];
fs.writeFileSync(dir + '/STOP.md', lines.join('\n'));
