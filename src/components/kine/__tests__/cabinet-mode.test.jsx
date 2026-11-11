import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import KineCabinetMode from '../KineCabinetMode';

describe('KineCabinetMode component', () => {
  it('renders the multi-specialty clinic cabinet mode header and specialty chips', () => {
    const html = renderToStaticMarkup(<KineCabinetMode />);

    expect(html).toContain('data-testid="kine-cabinet-mode"');
    expect(html).toContain('Clinique de Pessac');
    expect(html).toContain('Pôle Genou &amp; LCA');
    expect(html).toContain('data-testid="cabinet-sp-shoulder"');
    expect(html).toContain('data-testid="cabinet-sp-knee"');
    expect(html).toContain('data-testid="cabinet-sp-lumbar"');
    expect(html).toContain('data-testid="cabinet-sp-hip"');
    expect(html).toContain('data-testid="cabinet-sp-ankle"');
    expect(html).toContain('data-testid="cabinet-sp-cervical"');
    expect(html).toContain('data-testid="open-pessac-hub-btn"');
    expect(html).toContain('data-testid="cabinet-run-assessment"');
  });

  it('has zero em-dashes in its rendered HTML', () => {
    const html = renderToStaticMarkup(<KineCabinetMode />);
    expect(html).not.toContain('\u2014');
  });
});
