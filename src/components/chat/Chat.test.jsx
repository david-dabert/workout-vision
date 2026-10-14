import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('./Chat.css', () => ({}));
vi.mock('../experience/exercise-info', () => ({ exerciseName: key => key }));
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

// Honesty pass of 14 October 2026 (CHT-1 to CHT-4): a demo that sends nothing and says so.
describe('the messaging demo', () => {
  for (const lang of ['en', 'fr']) {
    it(`claims no sending, no peer-to-peer and no encryption, and scripts no reply (${lang})`, async () => {
      const html = decode(await render(lang));
      expect(html).toContain('data-testid="chat-screen"');
      expect(html).toContain('data-testid="chat-input"');
      expect(html).toContain('data-testid="chat-send-btn"');
      expect(html).toContain('data-testid="demo-badge"');
      expect(html).toContain('data-testid="send-to-coach"');
      expect(html).toContain(lang === 'fr' ? 'Aucun message n’est envoyé.' : 'No message is sent.');
      expect(html).not.toMatch(/chiffr|encrypt|P2P|Coach Julien|DPT|vérifié|verified|Invitation|invitation|Score de Forme|Form Score|\[object Object\]/);
    });
  }
});
