import { describe, it, expect, vi, afterEach } from 'vitest';

vi.hoisted(() => {
  const any = new Proxy(function stub() {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : any), apply: () => any, set: () => true });
  globalThis.window ??= { devicePixelRatio: 1 };
  globalThis.document ??= { createElement: () => any };
  globalThis.navigator ??= { hardwareConcurrency: 8 };
});

import { renderToStaticMarkup } from 'react-dom/server';
import FilmExerciseDrawer from '../FilmExerciseDrawer';
import Film from '../Film';
import { LanguageProvider } from '../../../lib/LanguageContext';

vi.mock('../../../lib/liveCamera', () => ({
  canOpenCamera: () => true,
  readFilmMode: () => 'video',
  writeFilmMode: () => {},
}));

vi.mock('../../../lib/buildFlags', () => ({
  liveBuild: () => true,
}));

vi.mock('../lift-scenes', () => ({
  hasFigure: () => false,
  liftView: () => 'side',
  restBox: () => [1, 1],
  createLiftScene: () => () => {},
}));

vi.mock('../guide-figure', () => ({
  hasGuideFigure: () => false,
  GUIDE_BOX: [1, 1],
}));

vi.mock('../exercise-info', () => ({
  exerciseName: (key) => key.replace(/_/g, ' '),
  filmView: () => 'side',
  guideExercise: () => null,
}));

function renderDrawer(props = {}, lang = 'fr') {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } });
  return renderToStaticMarkup(
    <LanguageProvider>
      <FilmExerciseDrawer currentLift="squat" onSelect={() => {}} onClose={() => {}} {...props} />
    </LanguageProvider>
  );
}

describe('FilmExerciseDrawer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders drawer header, search input, and filter chips in French', () => {
    const html = renderDrawer({}, 'fr');
    expect(html).toContain('Catalogue d’exercices');
    expect(html).toContain('1 200+ variantes');
    expect(html).toContain('data-testid="drawer-search-input"');
    expect(html).toContain('data-testid="filter-chip-squat"');
    expect(html).toContain('data-testid="filter-chip-hinge"');
    expect(html).toContain('data-testid="filter-chip-push"');
    expect(html).toContain('data-testid="filter-chip-pull"');
    expect(html).toContain('data-testid="filter-chip-isolation"');
  });

  it('renders drawer header and search input in English', () => {
    const html = renderDrawer({}, 'en');
    expect(html).toContain('Exercise Catalog');
    expect(html).toContain('1,200+ variations');
    expect(html).toContain('data-testid="filter-chip-squat"');
  });

  it('lists initial exercises with their equipment and archetype badge', () => {
    const html = renderDrawer({}, 'en');
    expect(html).toContain('data-testid="drawer-exercise-list"');
    expect(html).toContain('film-drawer-item-archetype');
    expect(html).toContain('film-drawer-item-title');
  });
});

function renderFilm(props = {}, lang = 'fr') {
  const store = { wv_lang: lang };
  vi.stubGlobal('localStorage', { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } });
  return renderToStaticMarkup(
    <LanguageProvider>
      <Film lift="squat" onBack={() => {}} onFile={() => {}} {...props} />
    </LanguageProvider>
  );
}

describe('Film integration with exercise drawer and catalog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders change exercise button on the viewfinder', () => {
    const html = renderFilm({}, 'fr');
    expect(html).toContain('data-testid="film-switch-exercise"');
    expect(html).toContain('Changer');
  });

  it('renders expanded catalog exercise name and muscle tag when catalog lift is selected', () => {
    const html = renderFilm({ lift: 'pendulum_squat' }, 'en');
    expect(html).toContain('Pendulum Squat');
    expect(html).toContain('machine');
    expect(html).toContain('quadriceps');
  });
});

