// A guard over the core product's sources (honesty audit of 14 October 2026): the screens, the report, the export, the
// history and the analysis never read or produce again the fields of the engines withdrawn that day (bilateral symmetry
// score, consistency, SPARC, form checks, joint loads, the "certificate", VBT, the isometric hold line, partial reps).
// Their modules stay for research (src/lib), read by none of these files. A field may come back only measured against
// known truth, with its source and status (R8, R9), and this list then changes in the same commit.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = f => readFileSync(resolve(__dirname, '..', f), 'utf8')
  // Comments say why a field is gone; only code counts.
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const FIELDS = /\.(symmetry|smoothness|consistency|formChecks|kinetics|compliance|vbt|isometric|partialCount|partials)\b|symmetryAvg|vbtLossAvg|estimateRir/;
const FILES = ['Result.jsx', 'report-sheet.js', 'report-pdf.js', 'Report.jsx', 'History.jsx', 'progress.js', 'ExerciseProgress.jsx', 'saved-set.js', 'set-account.js', '../CoreUpload.jsx', '../LiveSession.jsx'];

describe('the withdrawn fields reach no screen of the core product', () => {
  for (const f of FILES) it(`${f} reads none of them`, () => {
    const hit = src(f).split('\n').find(l => FIELDS.test(l));
    expect(hit ?? null).toBeNull();
  });
  it('the analysis runs none of the withdrawn engines', () => {
    const a = src('../../lib/coreAnalysis.js');
    for (const m of ['asymmetryCoaching', 'smoothness', 'jointTorqueEngine', 'complianceEngine', 'vbtEngine']) expect(a).not.toContain(`./${m}`);
  });
  it('no certificate, safety or VBT wording is left in the result, the report or the history', () => {
    for (const f of ['Result.jsx', 'report-sheet.js', 'Report.jsx', 'History.jsx', 'ExerciseProgress.jsx', 'result-copy.js']) {
      expect(src(f)).not.toMatch(/Intégrité vérifiée|Certificat|Certifié|Exécution sécurisée|Safe execution|\(VBT\)|Coaching VBT|Point de friction|Données brutes|telemetrie/);
    }
  });
});
