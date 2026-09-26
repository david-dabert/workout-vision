/**
 * The coach's report: its words (shared by the sheet on screen and the PDF),
 * its file name, its line breaking, and the PDF itself.
 */
import { describe, it, expect } from 'vitest';
import { reportSheet, reportFileName } from '../report-sheet';
import { reportPdf, wrapText } from '../report-pdf';

const day = new Date(2026, 8, 26, 14, 32);
const base = { lang: 'fr', date: day, client: '', coach: '', notes: '', liftName: 'Élévations latérales', count: 10, counted: 10, arm: 'right' };
const NBSP = ' ';

describe('reportSheet', () => {
  it('writes the prototype’s words, with a long date and an ellipsis where nothing was typed', () => {
    const s = reportSheet(base);
    expect(s.date).toBe('26 septembre 2026');
    expect([s.client, s.coach, s.notes]).toEqual(['…', '…', '…']);
    expect(s.title).toBe('Rapport de séance');
    expect(s.word).toBe('répétitions');
    expect(s.arm).toBe(`Bras suivi${NBSP}: droit`);
    expect(s.foot).toBe('Comptage automatique sur le téléphone. Version de test. Aucun score de forme.');
  });

  it('states a correction only when the visitor changed the count', () => {
    expect(reportSheet({ ...base, count: 12, counted: 10 }).corrected).toBe(`Compté par l’app${NBSP}: 10. Corrigé${NBSP}: 12.`);
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
    const s = reportSheet({ ...base, client: '  Anaïs   Lefèvre ', coach: 'Luc\n', notes: '  Tempo lent.\r\nCoudes fléchis.  ' });
    expect(s.client).toBe('Anaïs Lefèvre');
    expect(s.coach).toBe('Luc');
    expect(s.notes).toBe('Tempo lent.\nCoudes fléchis.');
  });

  it('leaves the arm out when the set does not say which', () => {
    expect(reportSheet({ ...base, arm: undefined }).arm).toBe('');
    expect(reportSheet({ ...base, lang: 'en', arm: 'left' }).arm).toBe('Arm tracked: left');
  });
});

describe('reportFileName', () => {
  it('names the file in ASCII after the client and the day', () => {
    expect(reportFileName({ lang: 'fr', date: day, client: 'Camille Martin' })).toBe('rapport-seance-camille-martin-2026-09-26.pdf');
    expect(reportFileName({ lang: 'fr', date: day, client: 'Anaïs Lefèvre-Dubœuf' })).toBe('rapport-seance-anais-lefevre-duboeuf-2026-09-26.pdf');
    expect(reportFileName({ lang: 'en', date: day, client: '' })).toBe('session-report-2026-09-26.pdf');
    expect(reportFileName({ lang: 'fr', date: day, client: 'Жанна' })).toBe('rapport-seance-2026-09-26.pdf');
  });

  it('shortens a long name at a word, never in the middle of one', () => {
    expect(reportFileName({ lang: 'fr', date: day, client: 'Marie-Christine de La Rochefoucauld-Montmorency' }))
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
    const text = await pdfText(reportPdf(reportSheet({ ...base, client: 'Camille Martin', coach: 'Luc', count: 12 })));
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text).toMatch(/\/MediaBox \[0 0 419\.5[23]\d* 595\.2[78]\d*\]/); // A5, as jsPDF prints it
    for (const face of ['InstrumentSerif-Regular', 'Geist-Regular', 'Geist-Medium', 'GeistMono-Regular']) expect(text).toContain(`/BaseFont /${face}`);
    expect(text.match(/\/Type \/Page\b/g)).toHaveLength(1);
  });

  it('runs long notes onto the next page', async () => {
    const notes = Array.from({ length: 40 }, (_, i) => `Ligne ${i + 1}.`).join('\n');
    const text = await pdfText(reportPdf(reportSheet({ ...base, notes })));
    expect(text.match(/\/Type \/Page\b/g).length).toBeGreaterThan(1);
  });
});
