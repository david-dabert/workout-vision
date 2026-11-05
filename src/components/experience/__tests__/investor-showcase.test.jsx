import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import InvestorShowcaseModal from '../InvestorShowcaseModal';

describe('InvestorShowcaseModal', () => {
  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(<InvestorShowcaseModal isOpen={false} onClose={() => {}} />);
    expect(html).toBe('');
  });

  it('renders idle state with start button when isOpen is true', () => {
    const html = renderToStaticMarkup(<InvestorShowcaseModal isOpen={true} onClose={() => {}} />);
    expect(html).toContain('DÉMONSTRATION INVESTISSEUR');
    expect(html).toContain('Showcase Biomécanique en Direct');
    expect(html).toContain('Lancer la démonstration (Squat 9 reps)');
    expect(html).toContain('showcase-overlay');
  });
});
