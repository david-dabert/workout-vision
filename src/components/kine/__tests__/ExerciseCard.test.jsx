import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ExerciseCard from '../ExerciseCard';
import { exerciseById, LIBRARY, MOBILITY_SCREENS } from '../../../lib/kine/library';
import { KINE } from '../kine-copy';

describe('ExerciseCard Media and Guided Protocol Rendering', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const kFr = KINE.fr;

  it('renders HTML5 video element when exercise has validated online video', async () => {
    vi.stubEnv('VITE_KINE_MEDIA_URL', 'https://media.example.org');
    vi.resetModules();
    const { default: Card } = await import('../ExerciseCard');
    const { exerciseById: getEx } = await import('../../../lib/kine/library');
    const ex = getEx('mains-jointes');

    const html = renderToStaticMarkup(<Card ex={ex} fr={true} k={kFr} />);
    expect(html).toContain('class="kn-video"');
    expect(html).toContain('src="https://media.example.org/olivier-1-mains-jointes.mp4"');
    expect(html).not.toContain('kn-video-placeholder');
  });

  it('renders clinical protocol placeholder when exercise has no hosted reference video', async () => {
    vi.stubEnv('VITE_KINE_MEDIA_URL', 'https://media.example.org');
    vi.resetModules();
    const { default: Card } = await import('../ExerciseCard');
    const { exerciseById: getEx } = await import('../../../lib/kine/library');
    const ex = getEx('test-dorsiflexion-cheville');

    const html = renderToStaticMarkup(<Card ex={ex} fr={true} k={kFr} />);
    expect(html).not.toContain('class="kn-video"');
    expect(html).toContain('kn-video-placeholder');
    expect(html).toContain('Protocole guidé');
    expect(html).toContain('Cible\u00A0: 35° à 40°');
  });

  it('renders all four Olivier exercises with videos and all mobility screens with protocol badges', async () => {
    vi.stubEnv('VITE_KINE_MEDIA_URL', 'https://pub-r2.example.com');
    vi.resetModules();
    const { default: Card } = await import('../ExerciseCard');
    const { LIBRARY: lib, MOBILITY_SCREENS: screens } = await import('../../../lib/kine/library');

    for (const ex of lib) {
      const html = renderToStaticMarkup(<Card ex={ex} fr={true} k={kFr} />);
      expect(html).toContain(`src="https://pub-r2.example.com/${ex.file}.mp4"`);
      expect(html).not.toContain('kn-video-placeholder');
    }

    for (const ex of screens) {
      const html = renderToStaticMarkup(<Card ex={ex} fr={true} k={kFr} />);
      expect(html).not.toContain('class="kn-video"');
      expect(html).toContain('kn-video-placeholder');
    }
  });
});
