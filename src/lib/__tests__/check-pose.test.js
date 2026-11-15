import { describe, expect, it } from 'vitest';
import { delegateParam, DEMO_CLIPS, demoAssetUrl, demoVerdictText, landmarksPrint, poseLine } from '../check';

// The check page's GPU measurement (pillar 4, 9 October 2026): the parameter, the line of each row, the fingerprint.
describe('the check page\'s pose line', () => {
  it('reads ?delegate=gpu, and nothing else, as the GPU', () => {
    expect(delegateParam('?delegate=gpu')).toBe('GPU');
    expect(delegateParam('?delegate=GPU&x=1')).toBe('GPU');
    for (const q of ['', '?delegate=cpu', '?delegate=', '?gpu=1']) expect(delegateParam(q)).toBe(null);
  });
  it('says the delegate, the renderer on the GPU, the time per sample and the fingerprint', () => {
    expect(poseLine({ delegate: 'GPU', renderer: 'Apple GPU', msMedian: 41.5, msP90: 60 }, 'a1b2c3d4e5f6', false))
      .toBe('Model: GPU (Apple GPU) · 41.5 ms a sample (p90 60) · fingerprint a1b2c3d4e5f6');
    expect(poseLine({ delegate: 'CPU', renderer: null, msMedian: 84.2, msP90: 120.4 }, 'x', true))
      .toBe('Modèle : CPU · 84,2 ms par échantillon (p90 120,4) · empreinte x');
    expect(poseLine(null, null, false)).toBe('Model: unknown · ? ms a sample (p90 ?) · fingerprint ?');
  });
  it('gives the same fingerprint to the same landmarks, another to others', async () => {
    const a = [[{ x: 0.1, y: 0.2, z: 0.3, visibility: 1 }], null];
    const p = await landmarksPrint(a);
    expect(p).toMatch(/^[0-9a-f]{12}$/);
    expect(await landmarksPrint(JSON.parse(JSON.stringify(a)))).toBe(p);
    expect(await landmarksPrint([[{ x: 0.1, y: 0.2, z: 0.30001, visibility: 1 }], null])).not.toBe(p);
  });
  it('lists the five bundled demo clips and formats demo URLs and verdict tallies cleanly', () => {
    expect(DEMO_CLIPS).toHaveLength(5);
    expect(demoAssetUrl('bicep-curl-5.mp4', '/workout-vision/')).toBe('/workout-vision/demo/bicep-curl-5.mp4');
    expect(demoAssetUrl('dip-13.mp4', '/workout-vision')).toBe('/workout-vision/demo/dip-13.mp4');
    expect(demoVerdictText([{ exact: true, refused: false, error: false }, { exact: false, refused: true, error: false }], 5, false))
      .toBe('Bundled demo: 2 of 5 checked · 1 exact · 1 refused · 0 errors');
    expect(demoVerdictText([], 5, true)).toBe('Vidéos intégrées\u00A0: 0 sur 5 testées · 0 exactes · 0 refusées · 0 erreurs');
  });
});
