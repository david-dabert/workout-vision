/**
 * The session report: its words (shared by the sheet on screen and the PDF),
 * its file name, its line breaking, and the PDF itself.
 */
import { describe, it, expect } from 'vitest';
import { reportSheet, reportFileName, setMeasures } from '../report-sheet';
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
    // A discreet line, the only mention of the app (David, 29 September): a coach's client reads the coach's report.
    expect(s.foot).toBe('Analysé avec Workout Vision');
    expect(s.brand).toBe('');
    expect(reportSheet({ ...base, source: 'manual' }).foot).toBe('Saisi avec Workout Vision');
    expect(reportSheet({ ...base, lang: 'en', source: 'manual' }).foot).toBe('Entered with Workout Vision');
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
    expect(reportSheet({ ...base, count: 12, counted: 10 }).corrected).toBe(`Compté par l'app${NBSP}: 10. Corrigé${NBSP}: 12.`);
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

  it('adds the time under tension and how the concentric speed changed from the first two reps to the last two', () => {
    // Concentric speeds 112.5, 97.8 … 76.4, 68.3 °/s: the last two average 31% below the first two.
    const s = reportSheet({ ...base, reps, first: 'concentric' });
    expect(s.summary.join('\n')).toContain(`Temps sous tension${NBSP}: 9,5${NBSP}s`);
    expect(s.summary.join('\n')).toContain(`\u221231${NBSP}%`);
  });

  it('gives one item per line, as a client who is not a coach reads it (Luc, 29 September)', () => {
    const prev = { count: 8, reps: Array.from({ length: 8 }, (_, i) => rep(i * 3, 2.0, 92, 0.9, 1.0)), date: new Date(2026, 8, 20) };
    const lines = reportSheet({ ...base, reps, first: 'concentric', previousSet: prev }).summary;
    expect(lines.map(l => l.split(`${NBSP}:`)[0])).toEqual(['Temps sous tension', 'Vitesse concentrique', 'Tempo', 'Durée', 'Série du 20 sept.']);
    for (const l of lines) expect(l).not.toContain(' · ');
  });

  it('shows the set tempo as the average of each phase across reps', () => {
    const s = reportSheet({ ...base, reps, first: 'concentric' });
    expect(s.summary.join('\n')).toContain('Tempo');
    // The tempo line has 4 numbers separated by dashes.
    expect(s.summary.join('\n')).toMatch(/Tempo\s*.*\d.*-.*\d.*-.*\d.*-.*\d/);
  });

  it('shows how the rep duration changed from the first two to the last two', () => {
    const s = reportSheet({ ...base, reps, first: 'concentric' });
    // All reps here are 1.9 s, so duration change is 0.
    expect(s.summary.join('\n')).toMatch(/0,0\s*s/);
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
