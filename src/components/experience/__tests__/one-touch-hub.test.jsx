import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import OneTouchHub from '../OneTouchHub';

vi.mock('../OneTouchHub.css', () => ({}));

describe('OneTouchHub component', () => {
  it('renders the 3 primary one-touch modes in French', () => {
    const html = renderToStaticMarkup(
      <OneTouchHub fr={true} onStartLift={() => {}} onMobility={() => {}} onHistory={() => {}} onSelectCategory={() => {}} />
    );

    expect(html).toContain('data-testid="onetouch-hub"');
    expect(html).toContain('data-testid="onetouch-lift"');
    expect(html).toContain('data-testid="onetouch-mobility"');
    expect(html).toContain('data-testid="onetouch-history"');
    expect(html).toContain('S’entraîner');
    expect(html).toContain('Mobilité &amp; Santé');
    expect(html).toContain('Mon Suivi');
    expect(html).toContain('Explorer par groupe musculaire\u00A0:');
  });

  it('renders the 3 primary one-touch modes in English', () => {
    const html = renderToStaticMarkup(
      <OneTouchHub fr={false} onStartLift={() => {}} onMobility={() => {}} onHistory={() => {}} onSelectCategory={() => {}} />
    );

    expect(html).toContain('data-testid="onetouch-hub"');
    expect(html).toContain('Start Lift');
    expect(html).toContain('Mobility &amp; Health');
    expect(html).toContain('My Progress');
    expect(html).toContain('Browse by muscle group:');
  });

  it('renders quick muscle category chips', () => {
    const html = renderToStaticMarkup(
      <OneTouchHub fr={true} onStartLift={() => {}} onMobility={() => {}} onHistory={() => {}} onSelectCategory={() => {}} />
    );

    expect(html).toContain('data-testid="onetouch-chips"');
    expect(html).toContain('data-testid="onetouch-chip-all"');
    expect(html).toContain('data-testid="onetouch-chip-chest_arms"');
    expect(html).toContain('data-testid="onetouch-chip-back_shoulders"');
    expect(html).toContain('data-testid="onetouch-chip-legs"');
    expect(html).toContain('data-testid="onetouch-chip-core"');
    expect(html).toContain('data-testid="onetouch-chip-beta"');
    expect(html).toContain('Pecs &amp; Bras');
    expect(html).toContain('Cuisses &amp; Fessiers');
  });
});
