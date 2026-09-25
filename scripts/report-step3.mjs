// Generate measured values and screen transcripts from saved runs, never hand-enter them.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const dir = 'test/real-phone/step3';
const read = name => readFileSync(`${dir}/${name}`, 'utf8').trimEnd();
const reports = readdirSync(dir).filter(name => /^(chrome|webkit-iphone)-(bicep_curl|lat_pulldown|lateral_raise|bench_press|overhead_press)\.json$/.test(name)).sort().map(name => ({ name, ...JSON.parse(read(name)) }));
const lines = [
  '# Step 3 STOP — NOT PASSED', '',
  'The approved lifts are wired to the unchanged core through worker-based pose inference. Both production browsers show the expected counts for the approved clips. Exact committed-landmark parity fails in Chrome, so Step 3 is not passed. The strict console test also fails on the lat-pulldown source timestamp diagnostic. Neither failure is skipped or marked expected.', '',
  '## Changes', '',
  '- PLAN.md records the git-lock stop rule, synthetic-first parameter rule, three-lift selector, parked presses and Step 3 STOP.',
  '- The noisy-setup overhead-press synthetic test is it.fails with its reason. No core parameter changed.',
  '- Analyze now requires curl, lateral raise or lat pulldown. Automatic and other lifts are absent. The old upload/counter code remains in the repository.',
  '- Results show the count, verification question, chosen arm and per-rep core details. No form score is rendered. Only a strict majority of unavailable raw joint angles causes a counting refusal; technical failures are reported separately.',
  '- The worker imports the harness’s shared CPU/IMAGE detection and filtering. Model and WASM are local. The existing decoding function and extraction settings are unchanged.',
  '- The production worker uses the classic-worker bundle because MediaPipe’s loader failed in a module worker. The CSP now permits unsafe-eval because the existing WebCodecs/demuxer path was blocked by the production CSP; this weakens that script restriction and remains a build tradeoff to review.',
  '- The worker maps only TFLite’s exact informational XNNPACK startup stderr line to console.info. Actual errors remain errors, including the demuxer timestamp diagnostic.',
  '- Node type declarations were added for the existing TypeScript tests; typecheck now passes.', '',
  '## Production results', '',
  'The test seeds a completed local profile, then opens the real production Analyze screen. First-visit experience work is deferred. Bench/overhead clips are passed through the same lift-independent inference with curl selected solely to compare landmarks; their resulting curl counts are not presented as press results or approval.', '',
  '| Browser | Clip | App count | Samples | Decoder | Seconds | Timestamps equal | Image equal | World equal | Console errors | Failed requests |',
  '|---|---|---:|---:|---|---:|---|---|---|---:|---:|',
];
for (const r of reports) lines.push(`| ${r.browser} | ${r.lift} | ${r.count ?? 'not offered; parity only'} | ${r.samples} | ${r.decoder} | ${r.elapsed} | ${r.comparisons.timestamps} | ${r.comparisons.imageLandmarks} | ${r.comparisons.worldLandmarks} | ${r.errors.length} | ${r.failed.length} |`);
lines.push('', 'The selector assertion reads every option from the DOM and requires exactly the placeholder, bicep_curl, lateral_raise and lat_pulldown. Backend validation also rejects Automatic and both parked presses.', '', '## Console diagnostic (not suppressed)', '');
for (const r of reports.filter(r => r.errors.length)) lines.push(`**${r.browser} / ${r.lift}**`, '```text', ...r.errors, '```', '');
lines.push('ffprobe identifies stream 1 in this source as H.264 video. The cause of its invalid packet timestamps is unresolved; the source clip was not modified.', '', '## Chrome diagnostic', '', 'Production worker compared with the main-thread development harness on the same Chrome installation, using curl. This is additional diagnosis, not a replacement for the production tests. It does not establish the cause of the difference.', '```json', read('chrome-parity-diagnostic.json'), '```', '', '## Git / iCloud', '', 'xattr -l .git/index:', '```text', read('index-xattrs.txt'), '```', 'Foundation resource values:', '```text', read('icloud-resource-values.txt'), '```', 'Documents also carries an iCloud Drive file-provider identifier and an iCloud desktop marker. The older CloudDocs/Documents path is absent. The Foundation result confirms that the repository and index are iCloud items, but does not prove that iCloud caused the previous locks. Older index 2 through index 6 files exist. No files were moved and no index-recovery command was run.', '');
const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(p => /\.(mov|mp4|m4v|webm|avi|mkv)$/i.test(p));
lines.push(`Tracked video files: ${tracked.length}`, '', '## Validation output', '');
for (const name of ['unit-output.txt', 'core-output.txt', 'typecheck-output.txt', 'lint-output.txt', 'build-output.txt', 'production-test-output.txt']) lines.push(`### ${name}`, '', '```text', read(name), '```', '');
lines.push('## Screenshots and exact screen text', '');
for (const r of reports.filter(r => r.count !== null)) lines.push(`### ${r.browser} / ${r.lift}`, '', `![${r.browser} ${r.lift}](${r.browser}-${r.lift}.png)`, '', '```text', r.screen, '```', '');
lines.push('### Selector', '', '![WebKit iPhone selector](webkit-iphone-selector.png)', '', '![Chrome selector](chrome-selector.png)', '', 'STOP. No main change, deployment, Step 3a, experience work or preview was performed. Step 3 remains unpassed pending resolution of the landmark-equality failure.');
writeFileSync(`${dir}/REPORT.md`, lines.join('\n') + '\n');
console.log(lines.slice(lines.indexOf('| Browser | Clip | App count | Samples | Decoder | Seconds | Timestamps equal | Image equal | World equal | Console errors | Failed requests |'), lines.indexOf('The selector assertion reads every option from the DOM and requires exactly the placeholder, bicep_curl, lateral_raise and lat_pulldown. Backend validation also rejects Automatic and both parked presses.')).join('\n'));
