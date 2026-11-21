import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { stores } = vi.hoisted(() => ({ stores: new Map() }));

vi.mock('localforage', () => ({
  default: {
    createInstance: ({ storeName }) => {
      if (!stores.has(storeName)) stores.set(storeName, new Map());
      const m = stores.get(storeName);
      return {
        getItem: async k => (m.has(k) ? structuredClone(m.get(k)) : null),
        setItem: async (k, v) => { m.set(k, structuredClone(v)); return v; },
        removeItem: async k => { m.delete(k); },
        iterate: async fn => { for (const [k, v] of m) fn(structuredClone(v), k); },
      };
    },
  },
}));

import { recordReceivedResults, seedSampleClients, getAllClients, getClientSessions } from '../../../lib/coachStorage';

vi.mock('../Report.css', () => ({}));
vi.mock('../Pro.css', () => ({}));
vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0, holdStage: () => {} }));
vi.mock('../sets', () => ({ useSets: () => [] }));

beforeEach(() => {
  for (const m of stores.values()) m.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('Client Hub & Received Sets intake', () => {
  it('records client session with reps, loads, RPE, and pain from results intake', async () => {
    const payload = {
      title: 'Renforcement & Posture',
      who: 'Lucas Botcazou',
      day: '2026-11-21',
      time: '11:00',
      items: [
        {
          key: 'squat',
          sets: 3,
          reps: 10,
          done: [10, 10, 10],
          loads: [80, 80, 80],
          efforts: [8, 8, 8.5],
          pains: [null, null, null],
        },
        {
          key: 'banded_face_pull',
          sets: 3,
          reps: 12,
          done: [12, 12, 12],
          loads: [15, 15, 15],
          efforts: [7, 7, 8],
          pains: [null, 'Tension scapulaire modérée', null],
        },
      ],
    };

    const res = await recordReceivedResults(payload);
    expect(res).not.toBeNull();
    expect(res.client.name).toBe('Lucas Botcazou');

    const clients = await getAllClients();
    expect(clients.length).toBe(1);
    expect(clients[0].name).toBe('Lucas Botcazou');

    const sessions = await getClientSessions(res.client.id);
    expect(sessions.length).toBe(1);
    expect(sessions[0].title).toBe('Renforcement & Posture');
    expect(sessions[0].items[0].loads).toEqual([80, 80, 80]);
    expect(sessions[0].items[0].efforts).toEqual([8, 8, 8.5]);
    expect(sessions[0].items[1].pains[1]).toBe('Tension scapulaire modérée');

    // Deduplication check
    const second = await recordReceivedResults(payload);
    expect(second.session.id).toBe(sessions[0].id);
    const afterDedupe = await getClientSessions(res.client.id);
    expect(afterDedupe.length).toBe(1);
  });

  it('seeds demo clients with realistic sessions for Bordeaux coaches', async () => {
    const seeded = await seedSampleClients();
    expect(seeded.length).toBe(3);
    expect(seeded.map(c => c.name)).toContain('Lucas Botcazou');
    expect(seeded.map(c => c.name)).toContain('Baptiste');
    expect(seeded.map(c => c.name)).toContain('Hugo Blondel');

    const lucas = seeded.find(c => c.name === 'Lucas Botcazou');
    const lucasSessions = await getClientSessions(lucas.id);
    expect(lucasSessions.length).toBe(1);
    expect(lucasSessions[0].title).toBe('Renforcement & Posture');
    expect(lucasSessions[0].items[0].key).toBe('squat');
    expect(lucasSessions[0].items[0].loads[0]).toBe(80);
    expect(lucasSessions[0].items[0].efforts[0]).toBe(8);

    const baptiste = seeded.find(c => c.name === 'Baptiste');
    const baptisteSessions = await getClientSessions(baptiste.id);
    expect(baptisteSessions.length).toBe(1);
    expect(baptisteSessions[0].title).toBe('Épaule & Mobilité');
    expect(baptisteSessions[0].items[2].pains[1]).toContain('Légère tension');
  });

  it('renders client roster tab navigation on Pro screen', async () => {
    vi.stubGlobal('localStorage', { getItem: k => ({ wv_lang: 'fr' })[k] ?? null, setItem() {}, removeItem() {} });
    const { LanguageProvider } = await import('../../../lib/LanguageContext');
    const { default: Pro } = await import('../Pro.jsx');

    const html = renderToStaticMarkup(
      <LanguageProvider>
        <Pro onClose={() => {}} />
      </LanguageProvider>,
    );

    expect(html).toContain('data-testid="tab-pro-programmes"');
    expect(html).toContain('data-testid="tab-pro-clients"');
    expect(html).toContain('data-testid="template-posture"');
    expect(html).toContain('data-testid="template-shoulder"');
    expect(html).toContain('data-testid="template-conditioning"');
    expect(html).toContain('data-testid="pro-compare"');
  });
});
