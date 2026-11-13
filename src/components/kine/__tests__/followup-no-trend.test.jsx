// Card 015 (cards/015-kine-trend-behind-switch.md; docs/FLAWS-2026-11.md #6): the production follow-up shows a
// physiotherapist what was measured, session by session, and no clinical trend. The trend engine
// (src/lib/kine/clinicalTrendAnalysis.ts) names a trajectory (« Trajectoire accélérée », « Vigilance compensation »)
// and a cause (« fatigue neuromusculaire », « contrôle moteur ») from the change of one mean between the first and
// the last session; no eval holds it against a physiotherapist's judgment (R16). It returns only through the lab
// switch CLINICAL_TREND_SHOWN in measures.js.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('../../../lib/haptics', () => ({ hapticLight: () => {} }));
vi.mock('../../../lib/kine/pdf', () => ({ followUpPdf: () => ({ save: () => {} }) }));
vi.mock('../../../lib/kine/store', async () => {
  const actual = await vi.importActual('../../../lib/kine/store');
  const session = (date, within) => ({ date, verdict: 'match', joints: [{ name: 'knee', within, gap: 6, range: 0.8 }], holds: [] });
  return {
    ...actual,
    followUp: () => [{
      key: 'patient-a', name: 'Patient A', count: 2, last: '2026-10-15T10:00:00Z',
      exercises: [{ id: 'mains-jointes', sessions: [session('2026-10-10T10:00:00Z', 0.7), session('2026-10-15T10:00:00Z', 0.85)] }],
    }],
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('../../experience/measures');
  vi.resetModules();
});

async function render(fr) {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  const { default: FollowUp } = await import('../FollowUp');
  const { KINE } = await import('../kine-copy');
  return renderToStaticMarkup(<FollowUp fr={fr} k={fr ? KINE.fr : KINE.en} profile={{ name: 'Cabinet' }} initial="patient-a" />);
}

describe('the follow-up shows no clinical trend in production (card 015)', () => {
  for (const fr of [true, false]) {
    it(`renders the measured sessions and no trend, ${fr ? 'in French' : 'in English'}`, async () => {
      const html = await render(fr);
      expect(html).toContain('data-testid="kn-follow-ex-mains-jointes"');
      expect(html).toContain('data-testid="kn-follow-progress-mains-jointes"');
      expect(html).not.toContain('kn-follow-trajectory-');
      expect(html).not.toMatch(/ACCELERATED|PROGRESSING|STABILIZED|REGRESSING/);
      expect(html).not.toMatch(/Trajectoire|Progression constante|Plateau de consolidation|Vigilance compensation|neuromusculaire|contrôle moteur/);
      expect(html).not.toMatch(/trajectory|motor control|neuromuscular|Consolidation plateau|Compensation vigilance/i);
    });
  }

  it('the lab switch brings the trend back', async () => {
    vi.doMock('../../experience/measures', async () => ({ ...(await vi.importActual('../../experience/measures')), CLINICAL_TREND_SHOWN: true }));
    const html = await render(true);
    expect(html).toContain('data-testid="kn-follow-trajectory-mains-jointes"');
    expect(html).toContain('ACCELERATED');
  });
});
