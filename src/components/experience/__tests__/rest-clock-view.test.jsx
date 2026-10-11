import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RestClock from '../RestClock';

// The time is drawn digit by digit (Digits.jsx, design/SYSTEM.md): its text is read without the tags.
const text = html => html.replace(/<[^>]+>/g, '');

// Design pass, 29 September: once the set is saved the rest is under way, so the clock runs from
// that moment without a tap; the tap is kept only to start it again after stopping it.
describe('the rest clock after a saved set', () => {
  it('runs from its first frame when started with the saved set', () => {
    const html = renderToStaticMarkup(<RestClock fr autoStart />);
    expect(html).toContain('role="timer"');
    expect(text(html)).toContain('0:00');
    expect(html).toContain('Arrêter le repos');
  });
  it('waits for a tap otherwise', () => {
    const html = renderToStaticMarkup(<RestClock fr={false} />);
    expect(html).not.toContain('role="timer"');
    expect(html).toContain('Start rest');
  });
});

// Review, 30 September: the result screen holds one clock for the set, whichever card shows it, so a
// rest the user stopped or restarted before a retried save is the rest the saved card shows.
describe('the rest clock shared across a retried save', () => {
  it('shows a stopped shared clock as stopped', async () => {
    const { restClock } = await import('../rest-clock');
    const shared = restClock(); shared.start(Date.now() - 90000); shared.stop();
    const html = renderToStaticMarkup(<RestClock fr clock={shared} />);
    expect(html).not.toContain('role="timer"');
    expect(html).toContain('Lancer le repos');
  });
  it('shows a restarted shared clock from its restart', async () => {
    const { restClock } = await import('../rest-clock');
    const shared = restClock(); shared.start(Date.now() - 30000);
    expect(text(renderToStaticMarkup(<RestClock fr clock={shared} />))).toContain('0:30');
  });
});
