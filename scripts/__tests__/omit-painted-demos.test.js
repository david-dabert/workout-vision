// The painted demo files (figures and verdicts burned into the picture) are left out of the built site; the raw clips
// the screens play, and every other demo file, stay in it (honesty pass, 14 October 2026).
import { describe, expect, it } from 'vitest';
import { isPaintedDemo } from '../omit-painted-demos.js';

describe('the painted demo files', () => {
  it('matches every painted file of public/demo', () => {
    for (const s of ['golf', 'tennis', 'padel', 'baseball', 'cycling', 'rowing', 'skiing', 'swimming']) {
      expect(isPaintedDemo(`demo/sports/${s}-demo-analyzed.mp4`), s).toBe(true);
      expect(isPaintedDemo(`demo/sports/${s}-demo-poster.jpg`), s).toBe(true);
    }
    expect(isPaintedDemo('demo/workoutvision-ridden-dressage-analyzed.mp4')).toBe(true);
    expect(isPaintedDemo('demo/workoutvision-equine-analyzed-demo.mp4')).toBe(true);
  });

  it('keeps the raw clips the screens play and the app’s own demo sets', () => {
    for (const s of ['golf', 'tennis', 'padel', 'baseball', 'cycling', 'rowing', 'skiing', 'swimming']) {
      expect(isPaintedDemo(`demo/sports/${s}-demo-raw.mp4`), s).toBe(false);
    }
    for (const f of ['demo/workoutvision-ridden-dressage-raw.mp4', 'demo/equine-trot-demo.mp4', 'demo/bicep-curl-5.mp4', 'demo/bicep-curl-5.jpg', 'index.html', 'assets/index.js']) {
      expect(isPaintedDemo(f), f).toBe(false);
    }
  });
});
