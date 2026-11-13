import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MocapViewer from '../MocapViewer';

vi.mock('../MocapViewer.css', () => ({}));

describe('MocapViewer 3D Kinematic Component', () => {
  it('renders synthetic kinematic skeleton gracefully when no world landmarks are passed', () => {
    const html = renderToStaticMarkup(
      <MocapViewer worldLandmarks={null} lift="squat" fr={false} />
    );

    expect(html).toContain('data-testid="mocap-3d-viewer"');
    expect(html).toContain('Estimated 3D view');
    expect(html).toContain('360° Spatial Kinematics');
    expect(html).toContain('Drag to spin');
    expect(html).toContain('class="mocap-canvas"');
    expect(html).toContain('class="mocap-scrubber"');
    expect(html).toContain('1/30');
  });

  it('renders French labels when fr=true', () => {
    const html = renderToStaticMarkup(
      <MocapViewer worldLandmarks={null} lift="squat" fr={true} />
    );

    expect(html).toContain('data-testid="mocap-3d-viewer"');
    expect(html).toContain('Vue 3D estimée');
    expect(html).toContain('Cinématique spatiale 360°');
    expect(html).toContain('Faites glisser');
    expect(html).toContain('Position temporelle');
  });

  it('stabilizes input worldLandmarks sequence with ground contact engine', () => {
    const dummyLandmarks = Array.from({ length: 5 }, () =>
      Array.from({ length: 33 }, () => ({ x: 0, y: 0.5, z: 0, visibility: 0.9 }))
    );

    const html = renderToStaticMarkup(
      <MocapViewer worldLandmarks={dummyLandmarks} lift="biceps_curl" fr={false} />
    );

    expect(html).toContain('data-testid="mocap-3d-viewer"');
    expect(html).toContain('class="mocap-canvas"');
    expect(html).toContain('1/5');
  });
});
