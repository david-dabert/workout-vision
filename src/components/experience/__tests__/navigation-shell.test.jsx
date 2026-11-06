import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import NavigationShell from '../NavigationShell';

describe('NavigationShell (3-Destination App Shell)', () => {
  it('renders all three persistent tabs: Train, Progress, Explore', () => {
    const html = renderToStaticMarkup(
      <NavigationShell current="train" fr={false} onNavigate={() => {}} />
    );

    expect(html).toContain('Train');
    expect(html).toContain('Progress');
    expect(html).toContain('Explore');
    expect(html).toContain('nav-shell');
    expect(html).toContain('nav-tab-train');
    expect(html).toContain('nav-tab-progress');
    expect(html).toContain('nav-tab-explore');
  });

  it('renders French labels accurately', () => {
    const html = renderToStaticMarkup(
      <NavigationShell current="progress" fr={true} onNavigate={() => {}} />
    );

    expect(html).toContain('Entraînement');
    expect(html).toContain('Progrès');
    expect(html).toContain('Explorer');
  });

  it('highlights the active tab with the indicator pill', () => {
    const html = renderToStaticMarkup(
      <NavigationShell current="explore" fr={true} onNavigate={() => {}} />
    );

    expect(html).toContain('wv-nav-tab tactile is-active');
    expect(html).toContain('wv-nav-pill');
  });
});
