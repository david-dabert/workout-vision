import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Review, 30 September: the report screen says only what the user fills in appears on the PDF, so a
// level stored for the result screen is not written on the sheet unless chosen there.
// The lift drawings paint sprites on load, which a test without a DOM cannot; the report needs none.
vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null }));
afterEach(() => vi.unstubAllGlobals());
describe('the coach report and the stored level', () => {
  it('shows no level on the sheet until the user picks one', async () => {
    const store = { wv_level: 'beginner', wv_lang: 'fr' };
    vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
    const { LanguageProvider } = await import('../../../lib/LanguageContext');
    const { default: Report } = await import('../Report');
    const html = renderToStaticMarkup(<LanguageProvider><Report lift="bicep_curl" count={8} counted={8} arm="right" onBack={() => {}} /></LanguageProvider>);
    const sheet = html.slice(html.indexOf('class="sheet"'), html.indexOf('</article>'));
    expect(sheet.length).toBeGreaterThan(0);
    expect(sheet).not.toMatch(/Niveau|Level/); // the field's label above may say it; the sheet does not
  });

  // Inverted by card 013: the verdict, the metrics and the hypertrophy cues rest on the readings that are off in
  // production (measures.js, UNVALIDATED_BIOMECHANICS_SHOWN), so the report rendered as production renders it has none.
  it('renders no Coach Verdict, Biomechanics or coaching section on the preview sheet, reps present', async () => {
    const store = { wv_lang: 'fr' };
    vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } });
    const { LanguageProvider } = await import('../../../lib/LanguageContext');
    const { default: Report } = await import('../Report');
    const reps = [
      { startTime: 0, endTime: 1.5, romDegrees: 63.6, concentricSec: 1.0, eccentricSec: 0.5, peakSpeed: 120, meanSpeed: 80 },
      { startTime: 1.8, endTime: 3.2, romDegrees: 64.0, concentricSec: 0.93, eccentricSec: 0.5, peakSpeed: 125, meanSpeed: 82 },
      { startTime: 3.5, endTime: 4.9, romDegrees: 63.0, concentricSec: 0.93, eccentricSec: 0.5, peakSpeed: 118, meanSpeed: 79 },
      { startTime: 5.2, endTime: 6.9, romDegrees: 64.2, concentricSec: 1.27, eccentricSec: 0.5, peakSpeed: 110, meanSpeed: 75 },
      { startTime: 7.2, endTime: 8.6, romDegrees: 63.8, concentricSec: 0.88, eccentricSec: 0.5, peakSpeed: 122, meanSpeed: 81 },
      { startTime: 8.9, endTime: 10.3, romDegrees: 63.5, concentricSec: 0.95, eccentricSec: 0.5, peakSpeed: 121, meanSpeed: 80 },
    ];
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <Report lift="lateral_raise" count={6} counted={6} arm="left" reps={reps} onBack={() => {}} />
      </LanguageProvider>
    );
    expect(html).not.toContain('sh-coach-prescription');
    expect(html).not.toContain('Le Verdict du Coach');
    expect(html).not.toContain('sh-biomechanics-section');
    expect(html).not.toContain('sh-coaching-section');
    expect(html).not.toContain('Recommandations hypertrophie');
    expect(html).not.toContain('report-export-bvh-btn');
  });
});
