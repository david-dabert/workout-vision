// node test/real-phone/kine-labels/faults/analyse.mjs <renders dir>
// Card 063, track C (plan.md): the comparison as shipped on the planted-fault renders; writes result.txt beside it.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReference, compareAttempt } from '../../../../src/lib/reference/compare.js';

const HERE = dirname(fileURLToPath(import.meta.url)), DIR = process.argv[2];
const read = id => JSON.parse(gunzipSync(readFileSync(resolve(DIR, `${id}.json.gz`))).toString());
const sec = ts => ts; // erratum: the renders' timestamps are already in seconds (synth.js); dividing by 1000 gave compare.js about one sample per set
const ids = readdirSync(DIR).filter(f => f.endsWith('.json.gz')).map(f => f.replace('.json.gz', ''));
const rows = [];
for (const refId of ids.filter(i => i.endsWith('-reference'))) {
  const cell = refId.replace('-reference', ''), ref = read(refId);
  const reference = buildReference(ref.worldLandmarks, sec(ref.timestamps));
  for (const id of ids.filter(i => i.startsWith(cell + '-') && i !== refId)) {
    const a = read(id), r = compareAttempt(reference, a.worldLandmarks, sec(a.timestamps));
    const role = id.slice(cell.length + 1).replace(/^correct\d+$/, 'correct'); // erratum: the fault names range70 and lean20 keep their digits
    rows.push({ cell, exercise: cell.split('-')[1], view: cell.split('-')[2], role, verdict: r.verdict, reasons: (r.reasons ?? []).join(' ') });
  }
}
const pct = (k, n) => (n ? `${Math.round((100 * k) / n)} %` : 'n/a');
const L = [`# Card 063, track C (analyse.mjs, plan.md): ${rows.length} attempts in ${new Set(rows.map(r => r.cell)).size} cells`];
let pass = true;
for (const role of ['correct', 'range70', 'lateRight', 'lean20', 'pause2s']) {
  const g = rows.filter(r => r.role === role), j = g.filter(r => r.verdict !== 'refused'), rev = j.filter(r => r.verdict === 'revise').length;
  const ok = role === 'correct' ? rev <= 0.05 * j.length : rev >= 0.9 * j.length;
  pass &&= ok;
  const by = k => [...new Set(g.map(r => r[k]))].map(v => { const h = g.filter(r => r[k] === v && r.verdict !== 'refused'); return `${v} ${h.filter(r => r.verdict === 'revise').length}/${h.length}`; }).join(', ');
  L.push(`${role}: ${g.length} attempts, ${g.length - j.length} refused; « À revoir » on ${rev} of ${j.length} judged (${pct(rev, j.length)}): ${ok ? 'PASS' : 'FAIL'} (${role === 'correct' ? 'false alarms at most 5 %' : 'found on at least 90 %'}); by exercise ${by('exercise')}; by view ${by('view')}`);
}
L.push(`Track C: ${pass ? 'PASS' : 'FAIL'} by plan.md's bars.`, '', ...rows.map(r => `${r.cell} ${r.role}: ${r.verdict}${r.reasons ? ` (${r.reasons})` : ''}`));
writeFileSync(resolve(HERE, 'result.txt'), L.join('\n') + '\n');
process.stdout.write(L.slice(0, 8).join('\n') + '\n');
