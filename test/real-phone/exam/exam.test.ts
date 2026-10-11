// EXAM=1 npx vitest run test/real-phone/exam/exam.test.ts
// PLAN.md: a lift is offered only once it counts right on sets it has never seen. Exam sets are run once,
// by this script; nothing else opens them. They are the collector's files (collect.html), labelled with
// the count a coach would give, filmed as the app shows, placed in test/real-phone/exam/<lift>/.
// A lift passes only if every one of its exam sets is counted exactly; the run fails if any lift fails, or
// if a set file lies outside a <lift>/ folder. Writes exam-result.txt with its date. After a miss the lift stays hidden, the fix goes through a synthetic test that fails first, the
// seen sets become build sets, and a new exam is filmed.
import { expect, test } from 'vitest';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { summarizeCount } from '../../../src/lib/coreAnalysis';

// EXAM_DIR points the script at a scratch folder, to check the script itself without opening an exam set.
const DIR = process.env.EXAM_DIR ? resolve(process.env.EXAM_DIR) : resolve(__dirname);
test.skipIf(!process.env.EXAM)('the exam', () => {
  // A set dropped beside the lift folders would be left out of the exam: it fails the run instead.
  expect(readdirSync(DIR).filter(f => f.endsWith('.json.gz')), 'exam sets outside a <lift>/ folder').toEqual([]);
  const lifts = readdirSync(DIR).filter(d => statSync(resolve(DIR, d)).isDirectory()).sort();
  const lines: string[] = [], failed: string[] = [];
  for (const lift of lifts) {
    const files = readdirSync(resolve(DIR, lift)).filter(f => f.endsWith('.json.gz')).sort();
    let exact = 0;
    for (const f of files) {
      const d = JSON.parse(gunzipSync(readFileSync(resolve(DIR, lift, f))).toString());
      expect(d.lift, `${lift}/${f} holds another lift`).toBe(lift);
      const r = summarizeCount(d.worldLandmarks, d.timestamps, d.lift);
      const ok = !r.refused && r.count === d.count;
      if (ok) exact++;
      lines.push(`  ${ok ? 'EXACT' : 'MISS '} ${lift}/${f}  label ${d.count}  counted ${r.refused ? 'refused' : r.count}`);
    }
    const pass = files.length >= 4 && exact === files.length;
    if (!pass) failed.push(lift);
    lines.splice(lines.length - files.length, 0, `${pass ? 'PASS' : 'FAIL'} ${lift}: ${exact}/${files.length} exact${files.length < 4 ? ' (fewer than four exam sets)' : ''}`);
  }
  const text = [`Exam ${new Date().toISOString().slice(0, 10)}: ${lifts.length - failed.length}/${lifts.length} lifts pass.`, ...lines].join('\n') + '\n';
  if (lifts.length) writeFileSync(resolve(DIR, 'exam-result.txt'), text);
  process.stdout.write(lifts.length ? text : 'No exam set yet.\n');
  // A green run means every lift passed (CLAUDE.md R3): a failed lift fails it.
  expect(failed, 'lifts that failed their exam').toEqual([]);
});
