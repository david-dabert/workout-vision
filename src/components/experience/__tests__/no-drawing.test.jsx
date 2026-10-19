import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// David's iPhone, 5 October: the machine seated back extension borrowed the back extension's drawing, a body lying face
// down, where the lifter sits upright. An exercise with no fitting drawing shows none: an empty arch beside its name,
// and its movement in words where the drawing would be (exerciseGuide.js, noDrawing).
vi.mock('../lift-scenes', () => ({ hasFigure: () => false, liftView: () => null, topPose: () => null, META: {}, createLiftScene: () => null }));
vi.mock('../entry-scene', () => ({ Body: class {}, mapPose: () => null, DPR: 1, LITE: false }));
vi.mock('../stage-loop', () => ({ addLayer: () => () => {}, presence: () => 0 }));
// The guide reads the language from the app; here it is French.
vi.mock('../../../lib/LanguageContext', async (importOriginal) => ({ ...(await importOriginal()), useT: () => ({ lang: 'fr', setLang: () => {} }) }));

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

  // Audit of the live screens, 11 October: the guide a beginner sees before filming (App.jsx guideFirst) gave the words
  // no language, so a French beginner read them in English.
  it('shows them in French on the guide a beginner sees before filming', async () => {
    const { default: Guide } = await import('../Guide');
    const html = renderToStaticMarkup(<Guide lift="machine_seated_back_extension" onClose={() => {}} onChoose={() => {}} />);
    expect(html).toContain('data-testid="guide-focus"');
    expect(html).toContain('Assis face à l’avant');
    expect(html).not.toContain('Seated, facing forward');
  });

  // Since 19 October 2026 every exercise of the list shows the app's own still figure (public/guide-svg/), the guide's
  // drawing or the empty arch only where no figure exists.
  it('shows the app\'s still figure beside its name', () => {
    const html = renderToStaticMarkup(<Thumb exercise={e} />);
    expect(html).toContain('thumb-fig');
    expect(html).toContain('guide-svg/machine_seated_back_extension.svg');
    expect(html).not.toContain('<img');
  });

  it('gives every other exercise, the card lifts included, its figure, and keeps the drawing where none exists', () => {
    expect(renderToStaticMarkup(<Thumb exercise={getGuideExercise('back_extension')} />)).toContain('guide-svg/back_extension.svg');
    expect(renderToStaticMarkup(<Thumb exercise={getGuideExercise('squat')} />)).toContain('guide-svg/squat.svg');
    expect(renderToStaticMarkup(<Thumb exercise={{ key: 'no_such_exercise', frames: ['x.webp'] }} />)).toContain('x.webp');
  });
});
