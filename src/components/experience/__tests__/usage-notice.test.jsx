import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { USAGE_EVENTS, COMMON_FIELDS, DURATION_BUCKETS } from '../../../../feedback-worker/usage-schema.js';
import { FIELD_WORDS, EVENT_WORDS, NOTICE, schemaFields } from '../usage-notice-copy';

// The notice of the anonymous usage counts (UsageNotice.jsx; PRIV-3): what it lists is the schema, no more, no less.
vi.mock('../UsageNotice.css', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

const URL_ = 'https://wv-counts.example.workers.dev/event';
async function render(lang, { url = URL_, store = {}, nav = {} } = {}) {
  vi.stubEnv('VITE_EVENTS_URL', url);
  const s = { wv_lang: lang, ...store };
  vi.stubGlobal('localStorage', { getItem: k => s[k] ?? null, setItem: (k, v) => { s[k] = String(v); }, removeItem: k => { delete s[k]; } });
  vi.stubGlobal('navigator', { language: 'en-GB', ...nav });
  const { LanguageProvider } = await import('../../../lib/LanguageContext');
  const { default: UsageNotice } = await import('../UsageNotice');
  return renderToStaticMarkup(<LanguageProvider><UsageNotice onClose={() => {}} listAll /></LanguageProvider>);
}
const decode = s => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const attrs = (html, name) => [...html.matchAll(new RegExp(`${name}="([^"]*)"`, 'g'))].map(m => m[1]);

describe('the notice against the schema (PRIV-3)', () => {
  const schema = new Set(['event', ...COMMON_FIELDS, ...Object.values(USAGE_EVENTS).flat()]);

  it('lists every field an event may carry, and nothing the schema does not have', () => {
    expect(new Set(schemaFields())).toEqual(schema);
    expect(schemaFields()).toHaveLength(schema.size);
  });

  for (const lang of ['fr', 'en']) {
    it(`has words for every field and every event, and none for anything else (${lang})`, () => {
      expect(Object.keys(FIELD_WORDS[lang]).sort()).toEqual([...schema].sort());
      expect(Object.keys(EVENT_WORDS[lang]).sort()).toEqual(Object.keys(USAGE_EVENTS).sort());
      for (const [f, [name, values]] of Object.entries(FIELD_WORDS[lang])) {
        expect(name, f).toBeTruthy();
        expect(values, f).toBeTruthy();
      }
      for (const n of Object.keys(USAGE_EVENTS)) expect(EVENT_WORDS[lang][n], n).toBeTruthy();
    });
  }

  it('names the visit-length bands from the schema', () => {
    expect(DURATION_BUCKETS).toHaveLength(4);
    expect(FIELD_WORDS.fr.durationBucket[1]).toBe('moins d’1, 1 à 5, 5 à 15, plus de 15\u00A0min');
    expect(FIELD_WORDS.en.durationBucket[1]).toBe('under 1, 1 to 5, 5 to 15, over 15\u00A0min');
  });

  for (const lang of ['fr', 'en']) {
    it(`renders exactly the schema's fields and events, the host, and the way to stop (${lang})`, async () => {
      const html = decode(await render(lang)), c = NOTICE[lang];
      expect(attrs(html, 'data-field')).toEqual(schemaFields());
      expect(attrs(html, 'data-event')).toEqual(Object.keys(USAGE_EVENTS));
      expect(html).toContain('data-notice="wv-usage-notice"');
      expect(html).toContain(c.whereText('wv-counts.example.workers.dev'));
      expect(html).toContain(c.neverText);
      expect(html).toContain(c.stateOn);
      expect(html).toContain(`aria-label="${c.turnOffLabel}"`);
    });
  }

  it('says the counting is off after the opt-out, and offers to turn it back on', async () => {
    const html = decode(await render('fr', { store: { wv_count_off: '1' } }));
    expect(html).toContain(NOTICE.fr.stateOff);
    expect(html).toContain(`aria-label="${NOTICE.fr.turnOnLabel}"`);
  });

  it('says the browser refuses, with no switch, under Global Privacy Control', async () => {
    const html = decode(await render('fr', { nav: { globalPrivacyControl: true } }));
    expect(html).toContain(NOTICE.fr.stateBrowser);
    expect(html).not.toContain('data-testid="usage-notice-toggle"');
  });

  it('says this version counts nothing when the build names no server', async () => {
    const html = decode(await render('fr', { url: '' }));
    expect(html).toContain(NOTICE.fr.none);
    expect(html).not.toContain('data-field=');
  });
});
