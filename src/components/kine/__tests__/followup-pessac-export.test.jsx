import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../../../lib/haptics', () => ({ hapticLight: () => {} }));
vi.mock('../../../lib/kine/pdf', () => ({ followUpPdf: () => ({ save: () => {} }) }));
vi.mock('../../../lib/kine/store', async () => {
  const actual = await vi.importActual('../../../lib/kine/store');
  return {
    ...actual,
    followUp: () => [
      {
        key: 'patient-dupont',
        name: 'Jean Dupont',
        count: 3,
        last: '2026-10-15T10:00:00Z',
        exercises: [
          {
            id: 'mains-jointes',
            sessions: [
              {
                date: '2026-10-10T10:00:00Z',
                verdict: 'match',
                joints: [{ name: 'knee', within: 0.70, gap: 8, range: 0.75 }],
                holds: [],
              },
              {
                date: '2026-10-15T10:00:00Z',
                verdict: 'match',
                joints: [{ name: 'knee', within: 0.85, gap: 4, range: 0.9 }],
                holds: [],
              },
            ],
          },
        ],
      },
    ],
    readProfile: () => ({ name: 'Olivier Martin', phone: '0556000000', email: 'olivier@pessac.fr' }),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('FollowUp and KineWorkspace Pessac Clinic Dossier Export', () => {
  it('renders the Pessac BDK quick export button in KineWorkspace', async () => {
    vi.stubGlobal('localStorage', { getItem: k => ({ wv_lang: 'fr' })[k] ?? null, setItem() {}, removeItem() {} });
    const { LanguageProvider } = await import('../../../lib/LanguageContext');
    const { default: KineWorkspace } = await import('../KineWorkspace');
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <KineWorkspace onClose={() => {}} />
      </LanguageProvider>
    );
    expect(html).toContain('data-testid="kn-workspace-pessac-export"');
    expect(html).toContain('Dossier Clinique BDK');
  });

  it('renders the 8-pole specialty dropdown and export button for a patient in FollowUp', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
    const { LanguageProvider } = await import('../../../lib/LanguageContext');
    const { default: FollowUp } = await import('../FollowUp');
    const { KINE } = await import('../kine-copy');
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <FollowUp
          fr={true}
          k={KINE.fr}
          profile={{ name: 'Olivier Martin' }}
          initial="patient-dupont"
        />
      </LanguageProvider>
    );
    expect(html).toContain('data-testid="kn-follow-pessac-section"');
    expect(html).toContain('data-testid="kn-follow-pessac-select"');
    expect(html).toContain('data-testid="kn-follow-pessac-export"');
    expect(html).toContain('data-testid="kn-follow-trajectory-mains-jointes"');
    expect(html).toContain('ACCELERATED');
    expect(html).toContain('Dossier Clinique Pessac (8 Pôles BDK)');
    expect(html).toContain('Épaule &amp; Scapula');
    expect(html).toContain('Genou &amp; LCA');
    expect(html).toContain('Rachis Lombaire');
  });

  it('renders correctly in English for English practitioners', async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
    const { LanguageProvider } = await import('../../../lib/LanguageContext');
    const { default: FollowUp } = await import('../FollowUp');
    const { KINE } = await import('../kine-copy');
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <FollowUp
          fr={false}
          k={KINE.en}
          profile={{ name: 'Olivier Martin' }}
          initial="patient-dupont"
        />
      </LanguageProvider>
    );
    expect(html).toContain('Print Pessac Clinical Dossier (8-Pole BDK)');
    expect(html).toContain('Shoulder &amp; Scapula');
  });
});
