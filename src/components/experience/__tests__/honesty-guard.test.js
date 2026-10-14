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

// R13: the README's numbers are the scoreboards' own. A commit that moves a count updates the README with it.
describe('the README quotes the scoreboards, and only them', () => {
  const root = f => readFileSync(resolve(__dirname, '../../../..', f), 'utf8');
  const readme = root('README.md');
  it('makes none of the claims of 13 October 2026', () => {
    expect(readme).not.toMatch(/100\s?%|74\/74|clinical-grade|Sub-Degree|McNemar Invariant|HIPAA|zero tolerance|certified judge|Wolf|Israetel|Bilateral Asymmetry Index/i);
    // Nor a figure no committed scoreboard file holds (second round of the honesty pass, 14 October 2026): the partial-rep
    // detector's count on synthetic sets came from uncommitted research, and no file is dated 14 October.
    expect(readme).not.toMatch(/reports 180|run again on 14 October/);
  });
  it('gives the stored sets, the real videos, the public half and the synthetic sets as the files do', () => {
    const board = root('test/real-phone/accuracy/scoreboard.txt');
    const [, decide, exact] = board.match(/of the (\d+) sets in the baseline that decide, (\d+) exact now/);
    expect(readme).toContain(`${exact} of the ${decide} that decide are exact`);
    const [, videos, videoExact] = board.match(/Real video, 7 October[^\n]*?of the (\d+) sets in the baseline, (\d+) exact now/);
    const [, refused] = board.match(/Real video, 7 October[^\n]*?; (\d+) refused of/);
    expect(readme).toContain(`${videoExact} of ${videos} exact, ${refused} refused`);
    const [, sets, pubExact, pct] = root('test/real-phone/accuracy/public-scoreboard.txt').match(/(\d+) build sets, (\d+) exact \((\d+)%\)/);
    expect(readme).toContain(`${sets} sets, ${pubExact} exact (${pct} %)`);
    const [, n, synthExact, synthPct, off3] = root('test/real-phone/synth/synth.txt').match(/^all\s+n\s+(\d+)\s+count exact\s+(\d+) \((\d+) %\), off >= 3: (\d+)/m);
    expect(readme).toContain(`${n} sets: ${synthExact} exact (${synthPct} %), ${off3} off by 3 or more`);
  });
});

// The Manifesto's promise is the one the app keeps, with the dated scoreboard (R13), and it makes no injury claim (R9).
describe('the Manifesto', () => {
  it('quotes the real-video figure of the scoreboard, and no injury, tendinopathy or 10 % / 15 % rule', async () => {
    const { MANIFESTO } = await import('../manifesto-copy');
    const board = readFileSync(resolve(__dirname, '../../../../test/real-phone/accuracy/scoreboard.txt'), 'utf8');
    const [, videos, exact] = board.match(/Real video, 7 October[^\n]*?of the (\d+) sets in the baseline, (\d+) exact now/);
    expect(MANIFESTO.fr.conclusion.text1).toContain(`Sur les ${videos} vraies vidéos filmées par le créateur de l’appli, elle trouve le bon nombre sur ${exact} (tableau du`);
    expect(MANIFESTO.en.conclusion.text1).toContain(`On the ${videos} real videos filmed by the app’s maker, it finds the right number on ${exact} (scoreboard of`);
    // When it doubts it may propose a number to check (Result.jsx): the promise says so, never "no number".
    expect(MANIFESTO.fr.conclusion.text1).toContain('Quand elle doute, elle le dit\u00A0: tout au plus, elle vous propose un nombre à vérifier, jamais une note.');
    expect(MANIFESTO.en.conclusion.text1).toContain('When it is unsure, it says so: at most it suggests a number for you to check, never a grade.');
    expect(MANIFESTO.fr.conclusion.text1).not.toMatch(/ne donne pas de chiffre/);
    expect(MANIFESTO.en.conclusion.text1).not.toMatch(/gives no number/);
    const all = JSON.stringify(MANIFESTO);
    // The eccentric prescription the app's own set note contradicts (set-notes.js, source 3) is gone.
    expect(all).not.toMatch(/2 to 3 seconds|2 à 3 secondes/);
    expect(all).not.toMatch(/injury rates|risque de blessure|tendinopathy|protège les articulations|exactitude absolue|approximations|below 10%|inférieure à 10/);
    // Its buttons open the lift for filming, which counts reps: no "line of pull", tempo or turnaround to test.
    for (const lang of ['fr', 'en']) for (const r of MANIFESTO[lang].chapter4.rules) expect(r.liftLabel).toMatch(/^(Filmer|Film) (un|a) /);
    // The left-right gap is the app's own: relative to the mean of the two ranges (sides-line.js), not to the larger.
    for (const lang of ['fr', 'en']) expect(MANIFESTO[lang].chapter3.principles[3].formula).not.toContain('\\max');
  });
});
