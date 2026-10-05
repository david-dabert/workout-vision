import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// David's iPhone, 5 October: the machine seated back extension borrowed the back extension's drawing, a body lying face
// down, where the lifter sits upright. An exercise with no fitting drawing shows none: an empty arch beside its name,
// and its movement in words where the drawing would be (exerciseGuide.js, noDrawing).
vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null, META: {}, createLiftScene: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0 }));

describe('an exercise with no fitting drawing', async () => {
  const { getGuideExercise } = await import('../../../lib/exerciseGuide');
  const { GuideFrames, Thumb } = await import('../Guide');
  const e = getGuideExercise('machine_seated_back_extension');

  it('shows its movement in words, in French and in English, and no image', () => {
    const fr = renderToStaticMarkup(<GuideFrames exercise={e} fr />), en = renderToStaticMarkup(<GuideFrames exercise={e} fr={false} />);
    expect(fr).toContain('Assis face à l’avant');
    expect(en).toContain('Seated, facing forward');
    expect(fr + en).not.toContain('<img');
  });

  it('has an empty arch beside its name', () => {
    const html = renderToStaticMarkup(<Thumb exercise={e} />);
    expect(html).toContain('thumb-none');
    expect(html).not.toContain('<img');
  });

  it('leaves every other exercise its drawing', () => {
    expect(renderToStaticMarkup(<Thumb exercise={getGuideExercise('back_extension')} />)).toContain('guide/back-extension/frame-1.webp');
  });
});
