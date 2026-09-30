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
});
