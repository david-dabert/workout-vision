/**
 * The session report: its words (shared by the sheet on screen and the PDF),
 * its file name, its line breaking, and the PDF itself.
 */
import { describe, it, expect, vi } from 'vitest';
import { reportSheet, reportFileName, setMeasures, measuresFile } from '../report-sheet';
import { SIDES_VERSION } from '../../../lib/counting/symmetry';
import { reportPdf, wrapText } from '../report-pdf';

const day = new Date(2026, 8, 26, 14, 32);
const base = { lang: 'fr', date: day, name: '', context: '', partner: '', level: '', notes: '', liftName: 'Élévations latérales', count: 10, counted: 10, arm: 'right' };
const NBSP = ' ';

describe('reportSheet', () => {
  it('writes the prototype’s words, with a long date, and nothing where nothing was filled in', () => {
    const s = reportSheet(base);
    expect(s.date).toBe('26 septembre 2026');
    expect(s.people).toEqual([]);
    expect(s.notes).toBe('');
    expect(s.title).toBe('Rapport de séance');
    expect(s.word).toBe('répétitions');
    expect(s.arm).toBe(`Bras suivi${NBSP}: droit`);
    // The report names no app (David, 29 September: the name is not final; the tool spreads by being useful).
    expect(s.foot).toBe('');
    expect(s.brand).toBe('');
    expect(reportSheet({ ...base, source: 'manual' }).foot).toBe('');
    expect(JSON.stringify(reportSheet({ ...base, lang: 'en', source: 'manual' }))).not.toContain('WorkoutVision');
    expect(JSON.stringify(s)).not.toContain('…');
  });

  // Step 1 (PLAN.md, GROWTH): the sheet no longer assumes a coach. The user says whether they
  // trained alone, with a friend or with a coach, and at which level; every name is optional, and
  // the sheet shows only what was filled in.
  it('assumes no coach: it names only the people and the level the user gave', () => {
    expect(reportSheet({ ...base, name: 'Anaïs Lefèvre' }).people).toEqual([['Nom', 'Anaïs Lefèvre']]);
    expect(reportSheet({ ...base, context: 'alone' }).people).toEqual([['Entraînement', 'En solo']]);
    expect(reportSheet({ ...base, lang: 'en', context: 'alone' }).people).toEqual([['Training', 'Alone']]);
    expect(reportSheet({ ...base, context: 'friend' }).people).toEqual([['Entraînement', 'En binôme']]);
    expect(reportSheet({ ...base, lang: 'en', context: 'coach', partner: 'Luc' }).people).toEqual([['Training', 'With a coach'], ['Coach', 'Luc']]);
    expect(reportSheet({ ...base, context: 'friend', partner: 'Sam' }).people).toEqual([['Entraînement', 'En binôme'], ['Partenaire', 'Sam']]);
    expect(reportSheet({ ...base, lang: 'en', context: 'friend', partner: 'Sam' }).people).toEqual([['Training', 'With a friend'], ['Friend', 'Sam']]);
    expect(reportSheet({ ...base, context: 'physio', partner: 'Dr. Dubois' }).people).toEqual([['Entraînement', 'Séance kiné'], ['Kinésithérapeute', 'Dr. Dubois']]);
    expect(reportSheet({ ...base, lang: 'en', context: 'physio', partner: 'Dr. Dubois' }).people).toEqual([['Training', 'Physiotherapy'], ['Physiotherapist', 'Dr. Dubois']]);
  });

  it('prints the person\'s own pain and effort as theirs, never graded, on every sheet (honesty audit, 14 October 2026)', () => {
    const reps = [{ startTime: 0, endTime: 2, romDegrees: 80, concentricSec: 1, eccentricSec: 1 }];
    const fr = reportSheet({ ...base, context: 'physio', pain: 7, rpe: 8, reps });
    expect(fr.own).toEqual([['Douleur, selon la personne', '7 sur 10'], ['Effort perçu (RPE), selon la personne', '8 sur 10']]);
    expect(reportSheet({ ...base, pain: 0, reps }).own).toEqual([['Douleur, selon la personne', '0 sur 10']]);
    expect(reportSheet({ ...base, lang: 'en', pain: 10, rpe: 6, reps }).own).toEqual([['Pain, as the person rated it', '10 out of 10'], ['Perceived exertion (RPE), as the person rated it', '6 out of 10']]);
    // No grade of the answer ("légère", "sévère"), and nothing of it among the app's measures.
    expect(JSON.stringify(fr)).not.toMatch(/légère|modérée|sévère|EVA/);
    // A set with no measured rep (typed by hand after a refusal, flagged by the body check, saved before step 3c) keeps
    // the answers: they were silently dropped before (audit, missed item on report-sheet.js:339).
    for (const extra of [{ reps: [] }, { reps: null }, { reps: [], source: 'manual', afterRefusal: true, counted: null }, { reps, measures: false }]) {
      expect(reportSheet({ ...base, pain: 6, rpe: 9, ...extra }).own).toEqual([['Douleur, selon la personne', '6 sur 10'], ['Effort perçu (RPE), selon la personne', '9 sur 10']]);
    }
    expect(reportSheet({ ...base, reps }).own).toEqual([]);
    // The PDF sets them as labelled pairs, like the count's details.
    expect(reportPdf(fr)).toBeInstanceOf(Blob);
  });

  it('prints none of the withdrawn lines, whatever a caller passes (honesty audit, 14 October 2026)', () => {
    const reps = [{ startTime: 0, endTime: 2, romDegrees: 90, concentricSec: 1, eccentricSec: 1 }, { startTime: 3, endTime: 5, romDegrees: 92, concentricSec: 1, eccentricSec: 1 }];
    const withdrawn = {
      symmetry: { symmetryScore: 82, status: 'notable_asymmetry', dominantSide: 'left', romDiffDeg: 22, trunkShift: { hasShift: true, maxTrunkTiltDeg: 7.5 }, coaching: { hasNotableAsymmetry: true, adviceFr: 'haltères', adviceEn: 'dumbbell' } },
      consistency: { score: 88, rating: 'high' }, smoothness: { avgSparc: -1.75, quality: 'very_smooth' },
      formChecks: { squatDepth: { allParallel: true }, kneeValgus: { detected: false }, lockout: { fullLockout: true } },
      kinetics: { totalWorkJoules: 671, maxL5S1ShearN: 433.4, maxKneeShearN: 250.1 }, compliance: { verified: true, certificateId: 'WV-EB858634-9R' },
      vbt: { velocityLossPercent: 18, fatigueZone: 'optimal', estimatedRir: '1-2', stickingAngleDeg: 92, slowestRepIndex: 5, cueFr: 'Zone idéale', cueEn: 'Ideal' },
      ergonomics: { estimatedL5S1CompressionNewtons: 2850, liftingIndexLI: 1.45, riskCategory: 'moderate' }, spinalLoad: { compressionN: 3650 },
      isometric: { isHold: true, tutSeconds: 42.5, stabilityDeg: 2.1 }, partialCount: 13, partials: [{ partialType: 'lengthened' }],
    };
    for (const lang of ['fr', 'en']) {
      const s = JSON.stringify(reportSheet({ ...base, lang, reps, first: 'concentric', ...withdrawn }));
      for (const word of ['Symétrie', 'symmetry', 'Régularité', 'consistency', 'SPARC', 'Fluidité', 'Smoothness', 'Profondeur', 'Squat depth', 'valgus', 'Verrouillage', 'lockout',
        'Cisaillement', 'shear', 'Travail', 'work', 'NIOSH', 'Compression', 'Certificat', 'WV-EB858634', 'VBT', 'RIR', 'friction', 'Sticking', 'partielles', 'Partial reps', 'isométrique', 'Isometric', '433', '2850']) {
        expect(s).not.toContain(word);
      }
    }
  });

  it('gives the level in the user\'s words, and leaves it out when none was chosen', () => {
    expect(reportSheet({ ...base, level: 'beginner' }).people).toEqual([['Niveau', 'Débutant']]);
    expect(reportSheet({ ...base, level: 'intermediate' }).people).toEqual([['Niveau', 'Intermédiaire']]);
    expect(reportSheet({ ...base, level: 'expert' }).people).toEqual([['Niveau', 'Confirmé']]);
    expect(reportSheet({ ...base, lang: 'en', level: 'expert' }).people).toEqual([['Level', 'Expert']]);
    expect(reportSheet({ ...base, level: 'other' }).people).toEqual([]);
  });

  it('keeps no partner\'s name for a set trained alone or with no answer', () => {
    expect(reportSheet({ ...base, context: 'alone', partner: 'Luc' }).people).toEqual([['Entraînement', 'En solo']]);
    expect(reportSheet({ ...base, partner: 'Luc' }).people).toEqual([]);
  });

  it('orders everything filled in: name, training, partner, level', () => {
    expect(reportSheet({ ...base, lang: 'en', name: 'Ana', context: 'coach', partner: 'Luc', level: 'beginner' }).people)
      .toEqual([['Name', 'Ana'], ['Training', 'With a coach'], ['Coach', 'Luc'], ['Level', 'Beginner']]);
  });

  it('states a correction only when the visitor changed the count', () => {
    expect(reportSheet({ ...base, count: 12, counted: 10 }).corrected).toBe(`Compté par l’appli${NBSP}: 10. Corrigé${NBSP}: 12.`);
    expect(reportSheet({ ...base, count: 10, counted: 10 }).corrected).toBe('');
    expect(reportSheet({ ...base, lang: 'en', count: 9, counted: 10 }).corrected).toBe('Counted by the app: 10. Corrected: 9.');
  });

  it('puts one and none in the singular in French, and only one in English', () => {
    expect(reportSheet({ ...base, count: 1, counted: 1 }).word).toBe('répétition');
    expect(reportSheet({ ...base, count: 0, counted: 0 }).word).toBe('répétition');
    expect(reportSheet({ ...base, lang: 'en', count: 1, counted: 1 }).word).toBe('rep');
    expect(reportSheet({ ...base, lang: 'en', count: 0, counted: 0 }).word).toBe('reps');
  });

  it('tidies the names and keeps the lines of the notes', () => {
    const s = reportSheet({ ...base, name: '  Anaïs   Lefèvre ', context: 'coach', partner: 'Luc\n', notes: '  Tempo lent.\r\nCoudes fléchis.  ' });
    expect(s.people).toEqual([['Nom', 'Anaïs Lefèvre'], ['Entraînement', 'Avec un coach'], ['Coach', 'Luc']]);
    expect(s.notes).toBe('Tempo lent.\nCoudes fléchis.');
  });

  // The opener: one sentence at the top that sums up the set (set-opener.js), and none on a count that does not stand.
  it('opens with one sentence that sums up the set, the user\'s count when they corrected it', () => {
    expect(reportSheet(base).opener).toBe('Série de 10 répétitions.');
    expect(reportSheet({ ...base, lang: 'en' }).opener).toBe('A set of 10 reps.');
    expect(reportSheet({ ...base, count: 12, counted: 10 }).opener).toBe('Vous avez compté 12 répétitions.');
    expect(reportSheet({ ...base, lang: 'en', count: 12, counted: 10 }).opener).toBe('You counted 12 reps.');
    expect(reportSheet({ ...base, count: null }).opener).toBe('');
  });

  it('leaves the arm out when the set does not say which', () => {
    expect(reportSheet({ ...base, arm: undefined }).arm).toBe('');
    expect(reportSheet({ ...base, lang: 'en', arm: 'left' }).arm).toBe('Arm tracked: left');
  });
});

describe('reportFileName', () => {
  it('names the file in ASCII after the user and the day', () => {
    expect(reportFileName({ lang: 'fr', date: day, name: 'Camille Martin' })).toBe('rapport-seance-camille-martin-2026-09-26.pdf');
    expect(reportFileName({ lang: 'fr', date: day, name: 'Anaïs Lefèvre-Dubœuf' })).toBe('rapport-seance-anais-lefevre-duboeuf-2026-09-26.pdf');
    expect(reportFileName({ lang: 'en', date: day, name: '' })).toBe('session-report-2026-09-26.pdf');
    expect(reportFileName({ lang: 'fr', date: day, name: 'Жанна' })).toBe('rapport-seance-2026-09-26.pdf');
  });

  it('shortens a long name at a word, never in the middle of one', () => {
    expect(reportFileName({ lang: 'fr', date: day, name: 'Marie-Christine de La Rochefoucauld-Montmorency' }))
      .toBe('rapport-seance-marie-christine-de-la-rochefoucauld-2026-09-26.pdf');
  });
});

describe('wrapText', () => {
  const six = s => [...s].length * 6; // every character six units wide

  it('breaks at spaces and after a hyphen between letters', () => {
    expect(wrapText('Marie-Christine de La Rochefoucauld-Montmorency', 151, six)).toEqual(['Marie-Christine de La', 'Rochefoucauld-Montmorency']);
    expect(wrapText('Jean-Pierre', 42, six)).toEqual(['Jean-', 'Pierre']);
  });

  it('keeps numbers joined by a hyphen together', () => {
    expect(wrapText('Série 3-4', 48, six)).toEqual(['Série', '3-4']);
    expect(wrapText('Série A-B', 48, six)).toEqual(['Série A-', 'B']);
  });

  it('cuts a word wider than the line between letters', () => {
    expect(wrapText('x'.repeat(60), 151, six)).toEqual(['x'.repeat(25), 'x'.repeat(25), 'x'.repeat(10)]);
  });

  it('keeps blank lines and spaces inside a line', () => {
    expect(wrapText('a\n\nb   c', 151, six)).toEqual(['a', '', 'b   c']);
  });
});

describe('reportPdf', () => {
  const pdfText = async blob => Buffer.from(await blob.arrayBuffer()).toString('latin1');

  it('sets one A5 page in the app’s four faces', async () => {
    const text = await pdfText(reportPdf(reportSheet({ ...base, name: 'Camille Martin', context: 'coach', partner: 'Luc', level: 'intermediate', count: 12 })));
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text).toMatch(/\/MediaBox \[0 0 419\.5[23]\d* 595\.2[78]\d*\]/); // A5, as jsPDF prints it
    for (const face of ['InstrumentSerif-Regular', 'Geist-Regular', 'Geist-Medium', 'GeistMono-Regular']) expect(text).toContain(`/BaseFont /${face}`);
    expect(text.match(/\/Type \/Page\b/g)).toHaveLength(1);
  });

  it('sets a sheet with nothing filled in on one page', async () => {
    const text = await pdfText(reportPdf(reportSheet(base)));
    expect(text.match(/\/Type \/Page\b/g)).toHaveLength(1);
  });

  it('runs long notes onto the next page', async () => {
    const notes = Array.from({ length: 40 }, (_, i) => `Ligne ${i + 1}.`).join('\n');
    const text = await pdfText(reportPdf(reportSheet({ ...base, notes })));
    expect(text.match(/\/Type \/Page\b/g).length).toBeGreaterThan(1);
  });
});

// Step 3c passed: each rep's time, range and phases, and what the set measured.
const rep = (start, len, rom, up, down, extra = {}) => ({
  startTime: start, endTime: start + len, romDegrees: rom,
  concentricSec: up, eccentricSec: down,
  peakSpeed: rom / Math.min(up, down), meanSpeed: rom / (up + down),
  ...extra,
});
const reps = [rep(0, 1.9, 90, 0.8, 1.0), rep(3, 1.9, 88, 0.9, 1.0), rep(6, 1.9, 86, 1.0, 1.0), rep(9, 1.9, 84, 1.1, 1.0), rep(12, 1.9, 82, 1.2, 1.0)];

describe('rep details', () => {
  it('lists each rep with tempo, range, peak and mean speed', () => {
    // first defaults to 'concentric': lifting=conc, lowering=ecc.
    // Rep 1: conc 0.8, ecc 1.0, working pause = 1.9 - 0.8 - 1.0 = 0.1, rest gap = 3.0 - 1.9 = 1.1
    // Tempo: lowering-bottom-lifting-top. Concentric first → lowering=ecc(second), bottom=restGap, lifting=conc(first), top=workingPause.
    const s = reportSheet({ ...base, reps, first: 'concentric' });
    expect(s.columns).toEqual(['Rép.', 'Tempo', 'Amplitude', 'Pic', 'Moy.']);
    // Rep 1: lowering=ecc 1.0, bottom=restGap 1.1, lifting=conc 0.8, top=workPause 0.1.
    // Moving phases to one decimal (comma in French); pauses in whole seconds.
    expect(s.rows[0][0]).toBe('1');
    expect(s.rows[0][1]).toBe('1,0-1-0,8-0');
    expect(s.rows[0][2]).toBe('90°');
    // Peak and mean are whole numbers with °/s
    expect(s.rows[0][3]).toMatch(/^\d+$/);
    expect(s.rows[0][4]).toMatch(/^\d+$/);
    const en = reportSheet({ ...base, lang: 'en', reps, first: 'concentric' });
    expect(en.columns).toEqual(['Rep', 'Tempo', 'Range', 'Peak', 'Mean']);
  });

  it('maps eccentric-first lifts correctly: lowering is the first phase', () => {
    // Squat-like: first=eccentric → lowering=ecc(first), bottom=workingPause, lifting=conc(second), top=restGap.
    // Rep 1: ecc 1.0, conc 0.8, working pause 0.1, rest gap 1.1
    const s = reportSheet({ ...base, reps, first: 'eccentric' });
    // Tempo: 1,0-0-0,8-1 (lowering-bottom-lifting-top) — phases one decimal, pauses whole
    expect(s.rows[0][1]).toBe('1,0-0-0,8-1');
  });

  it('never shows 0 for a moving phase: a 0.6 s lift reads 0,6, not 0', () => {
    const short = [rep(0, 2.0, 90, 0.6, 0.9), rep(3, 2.0, 88, 0.6, 0.9)];
    const s = reportSheet({ ...base, reps: short, first: 'concentric' });
    // Lifting = concentric = 0.6 s → must read '0,6', not '0' or '1'.
    const tempo = s.rows[0][1];
    const parts = tempo.split('-');
    expect(parts[2]).toBe('0,6');
    // English: dot
    const en = reportSheet({ ...base, lang: 'en', reps: short, first: 'concentric' });
    expect(en.rows[0][1].split('-')[2]).toBe('0.6');
  });

  it('gives a rep the recording cut its number and range, and no tempo or speed', () => {
    const s = reportSheet({ ...base, reps: [rep(0, 1.1, 95, 0.1, 1.0, { clipped: true }), ...reps.slice(1)], first: 'concentric' });
    expect(s.rows[0]).toEqual(['1', '…', '95°', '…', '…']);
  });

  it('marks a rep whose range is under 85% of the median as short', () => {
    // Median range of whole reps: sort [90, 88, 50, 86, 84] → [50, 84, 86, 88, 90] → median 86.
    // 85% of 86 = 73.1. Rep 3 (50°) is short.
    const short = [rep(0, 1.9, 90, 0.8, 1.0), rep(3, 1.9, 88, 0.9, 1.0), rep(6, 1.9, 50, 1.0, 1.0), rep(9, 1.9, 86, 1.1, 1.0), rep(12, 1.9, 84, 1.2, 1.0)];
    const s = reportSheet({ ...base, reps: short, first: 'concentric' });
    expect(s.rows[2][2]).toContain('▾');
    expect(s.rows[0][2]).not.toContain('▾');
    expect(s.shortRepNote).toBeTruthy();
  });

  it('adds the time under tension, and no longer the change of concentric speed (SPEED_CHANGE_SHOWN off)', () => {
    // Concentric speeds 112.5, 97.8 … 76.4, 68.3 °/s: a 31 % drop, within the noise of phase timing, so unsaid.
    const s = reportSheet({ ...base, reps, first: 'concentric' });
    expect(s.summary.join('\n')).toContain(`Temps sous tension${NBSP}: 9,5${NBSP}s`);
    expect(s.summary.join('\n')).not.toContain(`\u221231${NBSP}%`);
  });

  it('gives one item per line, as a client who is not a coach reads it (Luc, 29 September)', () => {
    const prev = { count: 8, reps: Array.from({ length: 8 }, (_, i) => rep(i * 3, 2.0, 92, 0.9, 1.0)), date: new Date(2026, 8, 20) };
    const lines = reportSheet({ ...base, reps, first: 'concentric', previousSet: prev }).summary;
    expect(lines.map(l => l.split(`${NBSP}:`)[0])).toEqual(['Temps sous tension', 'Tempo', 'Série du 20 sept.']);
    for (const l of lines) expect(l).not.toContain(' · ');
  });

  it('opens on what the reps showed, and no longer on their change of speed (SPEED_CHANGE_SHOWN off)', () => {
    // Concentric phases 0.8 … 1.2 s: once said "slower"; now the opener says only that no rep was short.
    expect(reportSheet({ ...base, count: 5, counted: 5, reps, first: 'concentric' }).opener).toBe('5 répétitions, aucune plus courte que les autres.');
    expect(reportSheet({ ...base, lang: 'en', count: 5, counted: 5, reps, first: 'concentric' }).opener).toBe('5 reps, none shorter than the others.');
  });

  // Review, 29 September: the opener never contradicts the table or the summary of the same sheet.
  it('counts the short reps as the table marks them, with an even number of reps', () => {
    const even = [rep(0, 3, 100, 1, 2), rep(3, 3, 100, 1, 2), rep(6, 3, 80, 1, 2), rep(9, 3, 60, 1, 2)];
    const s = reportSheet({ ...base, lang: 'en', count: 4, counted: 4, reps: even, first: 'concentric' });
    const marked = s.rows.filter(r => r[2].includes('▾')).length;
    expect(marked).toBe(1); // median 90, so only the 60° rep is under 85 %
    expect(s.opener).toBe('4 reps, one of them shorter than the others.');
  });
  it('never says "as fast" beside a speed that changed, nor slower or faster against its sign', () => {
    const shallower = [100, 100, 100, 100, 90, 90].map((rom, i) => rep(i * 3, 2, rom, 1, 1));
    const s = reportSheet({ ...base, lang: 'en', count: 6, counted: 6, reps: shallower, first: 'concentric' });
    expect(s.summary.some(l => /Concentric speed/.test(l))).toBe(false);
    expect(s.opener).not.toMatch(/as fast as|faster than/);
    const quicker = [100, 100, 100, 100, 70, 70].map((rom, i) => rep(i * 3, 2, rom, 1, i >= 4 ? 0.8 : 1));
    const q = reportSheet({ ...base, lang: 'en', count: 6, counted: 6, reps: quicker, first: 'concentric' });
    expect(q.opener).not.toMatch(/faster than/);
  });

  it('sets the opener on the PDF without running the sheet onto another page', async () => {
    const pages = async sheet => Buffer.from(await reportPdf(sheet).arrayBuffer()).toString('latin1').match(/\/Type \/Page\b/g).length;
    const plain = reportSheet(base);
    expect(await pages(plain)).toBe(await pages({ ...plain, opener: '' }));
    // The five-rep sheet ran to two pages with or without its opener before 2 October; with the speed and
    // duration lines gone it fits one page without the opener, and the opener takes it to two, no further
    // (BACKLOG.md, 2 October: fit it on one A5 page).
    const five = reportSheet({ ...base, count: 5, counted: 5, reps, first: 'concentric' });
    expect(await pages(five)).toBeLessThanOrEqual(2);
  });

  it('shows the set tempo as the average of each phase across reps', () => {
    const s = reportSheet({ ...base, reps, first: 'concentric' });
    expect(s.summary.join('\n')).toContain('Tempo');
    // The tempo line has 4 numbers separated by dashes.
    expect(s.summary.join('\n')).toMatch(/Tempo\s*.*\d.*-.*\d.*-.*\d.*-.*\d/);
  });

  it('no longer states how the rep duration changed from the first two to the last two (SPEED_CHANGE_SHOWN off)', () => {
    const s = reportSheet({ ...base, reps, first: 'concentric' });
    // All reps here are 1.9 s: the comparison was "0,0 s"; it is now unsaid with the speed change.
    expect(s.summary.join('\n')).not.toMatch(/du début à la fin/);
  });

  it('shows the comparison with a previous set when one is provided', () => {
    const prev = { count: 8, reps: Array.from({ length: 8 }, (_, i) => rep(i * 3, 2.0, 92, 0.9, 1.0)), date: new Date(2026, 8, 20) };
    const s = reportSheet({ ...base, reps, first: 'concentric', previousSet: prev });
    expect(s.summary.join('\n')).toContain('20');
    expect(s.summary.join('\n')).toContain('8');
  });

  it('omits the previous-set line when no previous set is provided', () => {
    const s = reportSheet({ ...base, reps, first: 'concentric' });
    expect(s.summary.join('\n')).not.toContain('20 sept');
  });

  it('measures whole reps only, and gives no speed change under four of them', () => {
    const cut = [rep(0, 1.1, 95, 0.1, 1.0, { clipped: true }), ...reps.slice(1, 4)];
    const m = setMeasures(cut);
    expect(m.tut).toBeCloseTo(5.7, 6);
    expect(m.speedChange).toBe(null);
  });

  it('shows no table and no measures for a set without rep details', () => {
    const s = reportSheet(base);
    expect(s.rows).toEqual([]);
    expect(s.summary).toEqual([]);
  });

  it('runs a long table onto the next page', async () => {
    const pdfText = async blob => Buffer.from(await blob.arrayBuffer()).toString('latin1');
    const many = Array.from({ length: 16 }, (_, i) => rep(i * 3, 1.9, 90, 0.8, 1.0));
    const text = await pdfText(reportPdf(reportSheet({ ...base, reps: many, first: 'concentric' })));
    expect(text.match(/\/Type \/Page\b/g).length).toBeGreaterThan(1);
  });
});

describe('left/right line (front-view sets)', () => {
  it('lists both ranges and the noise note in the summary, only when measured and measures are shown', () => {
    const sides = { left: 92, right: 74, si: -17, reps: 10, v: 3 };
    const s = reportSheet({ ...base, reps, sides, lift: 'lateral_raise' });
    expect(s.summary).toContain('Amplitude de l’épaule\u00A0: gauche 92°\u00A0· droite 74°\u00A0· écart 17\u00A0%');
    expect(s.summary.some(l => l.startsWith('Série filmée bien de face'))).toBe(true);
    expect(reportSheet({ ...base, reps }).summary.some(l => l.includes('gauche'))).toBe(false);
    expect(reportSheet({ ...base, reps, sides, lift: 'overhead_press' }).summary.some(l => l.includes('gauche'))).toBe(false);
    expect(reportSheet({ ...base, reps, sides, lift: 'lateral_raise', measures: false }).summary.some(l => l.includes('gauche'))).toBe(false);
  });
});

// R8: every page that carries a measure carries the experimental label (audit of 3 October: the label was drawn
// once, on page 1, and the table of a long set ran onto pages without it).
import { jsPDF } from 'jspdf';
describe('the experimental label in a PDF of several pages', () => {
  it('stands on every page', () => {
    const long = Array.from({ length: 18 }, (_, i) => rep(i * 3, 1.9, 90 - i, 0.8 + i * 0.02, 1.0));
    // jsPDF tells its listeners of every text it sets and every page it adds (its events, as its plugins use them).
    const pages = new Map();
    let page = 1;
    const hooks = [['addPage', () => { page += 1; }], ['preProcessText', ({ text }) => { pages.set(page, (pages.get(page) || '') + (Array.isArray(text) ? text.join('') : text)); }]];
    jsPDF.API.events.push(...hooks);
    try { reportPdf(reportSheet({ ...base, reps: long, first: 'concentric' })); } finally { for (const h of hooks) jsPDF.API.events.splice(jsPDF.API.events.indexOf(h), 1); }
    expect(pages.size).toBeGreaterThan(1);
    for (const [p, text] of pages) expect(text, `page ${p}`).toContain('Mesures expérimentales');
  });
});

// Audit of 6 October: the mono face has no ▾, so jsPDF dropped the short-rep mark from the table; it is drawn as a
// triangle instead, one on each short rep's row, and no ▾ goes to the font.
// Every triangle a reportPdf draws: jsPDF defines triangle on each document, so it is wrapped as each one starts
// (jsPDF's 'initialized' event, as its plugins use it).
function triangles(run) {
  const calls = [];
  const hook = ['initialized', function () { const own = this.triangle; this.triangle = (...a) => { calls.push(a); return own.apply(this, a); }; }];
  jsPDF.API.events.push(hook);
  try { run(); } finally { jsPDF.API.events.splice(jsPDF.API.events.indexOf(hook), 1); }
  return calls;
}

describe('the short-rep mark in the PDF', () => {
  it('is drawn as one triangle on each short rep’s row, never set as text', () => {
    const short = [rep(0, 1.9, 90, 0.8, 1.0), rep(3, 1.9, 88, 0.9, 1.0), rep(6, 1.9, 50, 1.0, 1.0), rep(9, 1.9, 86, 1.1, 1.0), rep(12, 1.9, 40, 1.2, 1.0)];
    const sheet = reportSheet({ ...base, reps: short, first: 'concentric' });
    const marked = sheet.rows.filter(r => r.some(v => v.endsWith('▾'))).length;
    expect(marked).toBe(2);
    const texts = [];
    const hook = ['preProcessText', ({ text }) => { texts.push(Array.isArray(text) ? text.join('') : String(text)); }];
    jsPDF.API.events.push(hook);
    let drawn;
    try { drawn = triangles(() => reportPdf(sheet)); } finally { jsPDF.API.events.splice(jsPDF.API.events.indexOf(hook), 1); }
    expect(drawn).toHaveLength(marked);
    for (const [, y1, , y2, , y3, style] of drawn) {
      expect(style).toBe('F');
      expect(y1).toBe(y2);      // a flat top
      expect(y3).toBeGreaterThan(y1); // pointing down
    }
    expect(texts.some(t => t.startsWith('50°'))).toBe(true);
    // The table's ranges (the footnote under the table is drawn by the browser when the face lacks a character).
    expect(texts.filter(t => /^\d+°/.test(t)).join('')).not.toContain('▾');
  });

  it('draws no triangle when no rep is short', () => {
    expect(triangles(() => reportPdf(reportSheet({ ...base, reps, first: 'concentric' })))).toEqual([]);
  });
});

describe('wrapText and the no-break spaces', () => {
  const six = s => [...s].length * 6;
  it('keeps a number and its unit joined by U+00A0 or U+202F on one line', () => {
    // "écart 17 %" in a line just too short for it: the break falls before "17 %", never inside it.
    expect(wrapText('gauche 92° · écart 17 %', 6 * 21, six)).toEqual(['gauche 92° · écart', '17 %']);
    expect(wrapText('écart 17 %', 6 * 8, six)).toEqual(['écart 17', ' %']); // wider than the line: cut as overflow-wrap does
    expect(wrapText('écart 17 %', 6 * 10, six)).toEqual(['écart 17 %']);
    expect(wrapText('un écart 17 %', 6 * 10, six)).toEqual(['un', 'écart 17 %']);
  });
});

// The set as a JSON file ("Mesures de la série", Report.jsx; second round of the honesty pass, 14 October 2026).
describe('measuresFile', () => {
  const rep = (i, t) => ({ index: i, startTime: t + 0.0123, endTime: t + 1.5371, romDegrees: 88.40924395507963, concentricSec: 0.3959999999999999, eccentricSec: 0.7919999999999998, peakSpeed: 348.64004361885276, meanSpeed: 129.00875533482827, isPartial: false, partialType: 'lengthened', romFraction: 0.4 });
  const set = { lift: 'bicep_curl', date: day, count: 2, counted: 2, source: 'counter-core', reps: [rep(1, 0), { ...rep(2, 3), clipped: true }] };
  it('exports left and right only where the sheet prints them: this lift, the current rule', () => {
    // A curl saved before 2 October 2026 (no version): withdrawn, the sheet prints none, the file holds none.
    const old = { left: 120, right: 70, si: 53, reps: 7 };
    expect(reportSheet({ ...base, lift: 'bicep_curl', sides: old, reps: set.reps }).summary.join(' ')).not.toMatch(/gauche|droite/);
    expect(measuresFile({ ...set, fr: true, sides: old }).sides).toBeNull();
    expect(measuresFile({ ...set, fr: true, sides: { ...old, v: SIDES_VERSION } }).sides).toBeNull();
    expect(measuresFile({ ...set, fr: true, lift: 'lateral_raise', sides: { ...old, v: SIDES_VERSION - 1 } }).sides).toBeNull();
    // A lateral raise filmed from the front under the current rule: the two ranges and their gap, as the sheet says them.
    const raise = measuresFile({ ...set, fr: true, lift: 'lateral_raise', sides: { left: 80, right: 72, si: 10.5, reps: 7, v: SIDES_VERSION } });
    expect(raise.sides.value).toEqual({ left: 80, right: 72, gapPercent: 11 });
  });
  it('rounds the reps as the screen shows them, and keeps no partial-rep field', () => {
    const f = measuresFile({ ...set, fr: false });
    expect(f.reps.values[0]).toEqual({ index: 1, startTime: 0, endTime: 1.5, romDegrees: 88, concentricSec: 0.4, eccentricSec: 0.8, peakSpeed: 349, meanSpeed: 129 });
    expect(f.reps.values[1]).toMatchObject({ index: 2, startTime: 3, clipped: true });
    expect(JSON.stringify(f)).not.toMatch(/partial|romFraction/i);
    expect(JSON.stringify(f.reps)).not.toMatch(/\d\.\d{2,}/);
    expect(f.count).toEqual({ value: 2, source: 'counted by the app, confirmed by the person' });
  });
  it('says none for a set with no measured rep, and speaks the person\'s language', () => {
    const typed = measuresFile({ fr: true, lift: 'squat', date: day, count: 8, counted: null, source: 'manual', afterRefusal: true, reps: [], person: { pain: 3, rpe: 8 } });
    expect(typed.reps).toBeNull();
    expect(typed.countedByApp).toBeNull();
    expect(typed.count.source).toBe(`saisi par la personne${NBSP}: l’appli n’a pas pu compter la série`);
    expect(typed.person).toMatchObject({ source: 'saisi par la personne sur le formulaire du rapport', pain: 3, rpe: 8 });
    expect(measuresFile({ ...set, fr: true }).reps.source).toBe('mesuré par l’appli sur la vidéo, expérimental, non validé');
    expect(measuresFile({ ...set, fr: true, count: 3 }).count.source).toBe('corrigé par la personne');
  });
});
