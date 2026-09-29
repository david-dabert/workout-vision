import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RestClock from '../RestClock';

// Design pass, 29 September: once the set is saved the rest is under way, so the clock runs from
// that moment without a tap; the tap is kept only to start it again after stopping it.
describe('the rest clock after a saved set', () => {
  it('runs from its first frame when started with the saved set', () => {
    const html = renderToStaticMarkup(<RestClock fr autoStart />);
    expect(html).toContain('role="timer"');
    expect(html).toContain('0:00');
    expect(html).toContain('Arrêter le repos');
  });
  it('waits for a tap otherwise', () => {
    const html = renderToStaticMarkup(<RestClock fr={false} />);
    expect(html).not.toContain('role="timer"');
    expect(html).toContain('Start rest');
  });
});
