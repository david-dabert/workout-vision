import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./Chat.css', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

async function render(lang) {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  });
  const { LanguageProvider } = await import('../../lib/LanguageContext');
  const { default: Chat } = await import('./Chat');
  return renderToStaticMarkup(
    <LanguageProvider>
      <Chat onClose={() => {}} />
    </LanguageProvider>
  );
}

const decode = s => s.replace(/&#x27;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

describe('P2P Encrypted Chat UI Component', () => {
  for (const lang of ['en', 'fr']) {
    it(`renders correctly with encrypted messaging and telemetry actions in ${lang}`, async () => {
      const rawHtml = await render(lang);
      const html = decode(rawHtml);

      expect(html).toContain('data-testid="chat-screen"');
      expect(html).toContain('data-testid="chat-input"');
      expect(html).toContain('data-testid="chat-send-btn"');
      expect(html).toContain('data-testid="attach-telemetry-btn"');
      expect(html).toContain('Coach Julien');
    });
  }
});
